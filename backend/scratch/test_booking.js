const { connectDB } = require("../src/config/db");
const sql = require("mssql");
const appointmentsService = require("../src/modules/appointments/appointments.service");

async function run() {
  const pool = await connectDB();
  
  // Clean up any existing appointments for test
  await pool.request().query(`
    DELETE FROM AppointmentStatusHistory WHERE AppointmentId IN (SELECT AppointmentId FROM Appointments WHERE CustomerId = 1 AND EmployeeId = 2 AND AppointmentDate = '2026-07-20');
    DELETE FROM AppointmentServices WHERE AppointmentId IN (SELECT AppointmentId FROM Appointments WHERE CustomerId = 1 AND EmployeeId = 2 AND AppointmentDate = '2026-07-20');
    DELETE FROM Invoices WHERE AppointmentId IN (SELECT AppointmentId FROM Appointments WHERE CustomerId = 1 AND EmployeeId = 2 AND AppointmentDate = '2026-07-20');
    DELETE FROM Appointments WHERE CustomerId = 1 AND EmployeeId = 2 AND AppointmentDate = '2026-07-20';
    DELETE FROM ShiftRegistrations WHERE TechnicianId = 2 AND ShiftId IN (SELECT ShiftId FROM WorkShifts WHERE ShiftDate = '2026-07-20');
  `);

  console.log("Creating new appointment for Employee 2 at 10:00 on 2026-07-20...");
  const appt = await appointmentsService.create(5, { // userId 5
    serviceId: 1,
    employeeId: 2,
    appointmentDate: '2026-07-20',
    startTime: '10:00',
    notes: 'Test auto shift'
  });

  console.log("Created Appointment:", appt);

  console.log("Checking dynamic shifts for Employee 2 on 2026-07-20...");
  const shifts = await pool.request()
    .input("TechnicianId", sql.Int, 2)
    .query(`
      SELECT 
        ws.ShiftId,
        ws.ShiftName,
        ws.ShiftDate,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM ShiftRegistrations sr 
          WHERE sr.ShiftId = ws.ShiftId AND sr.TechnicianId = @TechnicianId AND sr.Status = 'APPROVED'
        ) OR (ws.ShiftName <> N'Cả Ngày' AND EXISTS (
          SELECT 1 FROM Appointments a
          WHERE a.EmployeeId = @TechnicianId
            AND a.AppointmentDate = ws.ShiftDate
            AND a.Status NOT IN ('CANCELLED', 'NO_SHOW')
            AND CONVERT(VARCHAR(5), a.StartTime, 108) >= CONVERT(VARCHAR(5), ws.StartTime, 108)
            AND CONVERT(VARCHAR(5), a.StartTime, 108) < CONVERT(VARCHAR(5), ws.EndTime, 108)
        )) THEN 1 ELSE 0 END AS BIT) AS IsRegistered
      FROM WorkShifts ws
      WHERE ws.ShiftDate = '2026-07-20'
    `);
  console.log(shifts.recordset);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
