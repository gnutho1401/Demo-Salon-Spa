const { connectDB, sql } = require('../src/config/db');
const { getAvailableSlots } = require('../src/modules/appointments/availability.service');
const { create, cancelAppointment } = require('../src/modules/appointments/appointments.service');
const { runAutoMatch } = require('../src/modules/waiting-list/waiting-list.service');

async function testFlow() {
  const pool = await connectDB();
  console.log("=== STEP 1: Setting up test data ===");
  
  const custRes = await pool.request().query("SELECT TOP 2 CustomerId, UserId FROM Customers ORDER BY CustomerId ASC");
  const cust1 = custRes.recordset[0];
  const cust2 = custRes.recordset[1];
  
  const empRes = await pool.request().query("SELECT TOP 1 e.EmployeeId, es.ServiceId FROM Employees e JOIN EmployeeServices es ON e.EmployeeId = es.EmployeeId WHERE e.Status = 'ACTIVE'");
  const emp = empRes.recordset[0];
  
  const testDate = "2026-08-20";
  
  // Find a free slot for testDate
  const initialSlots = await getAvailableSlots({
    employeeId: emp.EmployeeId,
    serviceId: emp.ServiceId,
    appointmentDate: testDate
  });
  const freeSlots = Array.isArray(initialSlots) ? initialSlots : (initialSlots.slots || []);
  if (freeSlots.length === 0) {
    console.error("No free slots on test date", testDate);
    process.exit(1);
  }
  const testSlot = freeSlots[0];
  const testTime = `${testSlot.startTime}:00`;
  const testTimeEnd = `${testSlot.endTime}:00`;

  console.log(`Test setup: Cust1=${cust1.CustomerId}, Cust2=${cust2.CustomerId}, Emp=${emp.EmployeeId}, Service=${emp.ServiceId}, Date=${testDate}, Time=${testTime}`);

  // Create an initial appointment for Cust1 at testTime
  let appt1;
  try {
    appt1 = await create(cust1.UserId, {
      serviceId: emp.ServiceId,
      employeeId: emp.EmployeeId,
      appointmentDate: testDate,
      startTime: testSlot.startTime
    });
    console.log(`Created Initial Appointment ID: ${appt1.AppointmentId}, Status: ${appt1.Status}`);
  } catch (err) {
    console.error("Failed to create appt1:", err.message);
    process.exit(1);
  }

  // Create a WaitingList entry for Cust2 for the same service and date
  const waitingRes = await pool.request()
    .input("CustomerId", sql.Int, cust2.CustomerId)
    .input("ServiceId", sql.Int, emp.ServiceId)
    .input("PreferredEmployeeId", sql.Int, emp.EmployeeId)
    .input("PreferredDate", sql.VarChar, testDate)
    .input("PreferredTimeFrom", sql.VarChar, testTime)
    .input("PreferredTimeTo", sql.VarChar, testTimeEnd)
    .query(`
      INSERT INTO WaitingList 
      (CustomerId, ServiceId, PreferredEmployeeId, PreferredDate, PreferredTimeFrom, PreferredTimeTo, Status, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @ServiceId, @PreferredEmployeeId, @PreferredDate, @PreferredTimeFrom, @PreferredTimeTo, 'WAITING', GETDATE(), GETDATE())
    `);
  const waitingItem = waitingRes.recordset[0];
  console.log(`Created WaitingList Entry ID: ${waitingItem.WaitingId}, Status: ${waitingItem.Status}`);

  console.log("\n=== STEP 2: Canceling initial appointment & running autoMatch ===");
  await cancelAppointment(appt1.AppointmentId, { reason: "Test cancellation" }, { userId: cust1.UserId });
  console.log("Appointment 1 canceled.");

  // Wait 1 sec for async autoMatch to complete if any
  await new Promise(r => setTimeout(r, 1000));

  // Check WaitingList item status
  const checkWaiting = await pool.request()
    .input("WaitingId", sql.Int, waitingItem.WaitingId)
    .query("SELECT * FROM WaitingList WHERE WaitingId = @WaitingId");
  const updatedWaiting = checkWaiting.recordset[0];
  console.log("WaitingList item after cancellation:", {
    WaitingId: updatedWaiting.WaitingId,
    Status: updatedWaiting.Status,
    MatchedEmployeeId: updatedWaiting.MatchedEmployeeId,
    MatchedDate: updatedWaiting.MatchedDate,
    MatchedStartTime: updatedWaiting.MatchedStartTime,
    MatchedEndTime: updatedWaiting.MatchedEndTime,
    HoldExpiresAt: updatedWaiting.HoldExpiresAt
  });

  console.log("\n=== STEP 3: Checking available slots for Cust1 (another user) ===");
  const slotsAfterMatch = await getAvailableSlots({
    employeeId: emp.EmployeeId,
    serviceId: emp.ServiceId,
    appointmentDate: testDate
  });
  const foundSlot = (Array.isArray(slotsAfterMatch) ? slotsAfterMatch : (slotsAfterMatch.slots || [])).find(s => s.startTime === testSlot.startTime);
  console.log(`Is ${testSlot.startTime} slot in available slots list?`, foundSlot ? "YES (BUG - Still available!)" : "NO (CORRECT - Locked/Busy!)");

  console.log("\n=== STEP 4: Attempting to create an appointment for Cust1 at " + testSlot.startTime + " ===");
  try {
    await create(cust1.UserId, {
      serviceId: emp.ServiceId,
      employeeId: emp.EmployeeId,
      appointmentDate: testDate,
      startTime: testSlot.startTime
    });
    console.log(`ERROR! Cust1 was able to book ${testSlot.startTime} slot even though it was MATCHED!`);
  } catch (err) {
    console.log("SUCCESS! Booking rejected:", err.message);
  }

  // Cleanup test data
  await pool.request().input("AppointmentId", sql.Int, appt1.AppointmentId).query("DELETE FROM AppointmentServices WHERE AppointmentId = @AppointmentId; DELETE FROM Invoices WHERE AppointmentId = @AppointmentId; DELETE FROM Appointments WHERE AppointmentId = @AppointmentId");
  await pool.request().input("WaitingId", sql.Int, waitingItem.WaitingId).query("DELETE FROM WaitingList WHERE WaitingId = @WaitingId");
  console.log("\nCleanup done.");
  process.exit(0);
}

testFlow().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
