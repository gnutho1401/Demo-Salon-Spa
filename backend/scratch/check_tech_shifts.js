const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Status, r.RoleName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE r.RoleName IN ('TECHNICIAN', 'STYLIST')
  `);
  console.log('Technicians in DB:', res.recordset);

  const shiftsRes = await pool.request().query(`
    SELECT TOP 10 sr.RegistrationId, sr.TechnicianId, sr.Status, ws.ShiftDate, ws.StartTime, ws.EndTime, ws.ShiftName
    FROM ShiftRegistrations sr
    JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
  `);
  console.log('Sample ShiftRegistrations:', shiftsRes.recordset);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
