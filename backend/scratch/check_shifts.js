const { connectDB } = require("../src/config/db");

async function check() {
  const pool = await connectDB();
  
  console.log("--- WORK SHIFTS on 2026-07-15 ---");
  const shifts = await pool.request().query(`
    SELECT ShiftId, ShiftName, ShiftDate, StartTime, EndTime, Status 
    FROM WorkShifts 
    WHERE ShiftDate = '2026-07-15'
  `);
  console.log(shifts.recordset);

  console.log("--- SHIFT REGISTRATIONS ---");
  const regs = await pool.request().query(`
    SELECT sr.RegistrationId, sr.ShiftId, sr.TechnicianId, sr.Status, ws.ShiftName, ws.ShiftDate
    FROM ShiftRegistrations sr
    JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
    WHERE ws.ShiftDate = '2026-07-15'
  `);
  console.log(regs.recordset);

  console.log("--- APPOINTMENTS on 2026-07-15 ---");
  const appts = await pool.request().query(`
    SELECT AppointmentId, CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime, Status
    FROM Appointments
    WHERE AppointmentDate = '2026-07-15'
  `);
  console.log(appts.recordset);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
