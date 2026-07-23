const { connectDB, sql } = require("../src/config/db");

async function checkDebug() {
  const pool = await connectDB();

  console.log("=== APPOINTMENT SERVICES FOR COMBO APPOINTMENTS ===");
  const apptSvcs = await pool.request().query(`
    SELECT aps.*, s.ServiceName, u.FullName AS TechName
    FROM AppointmentServices aps
    JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    JOIN Services s ON aps.ServiceId = s.ServiceId
    LEFT JOIN Employees e ON aps.EmployeeId = e.EmployeeId
    LEFT JOIN Users u ON e.UserId = u.UserId
    WHERE a.CustomerPackageId IS NOT NULL
  `);
  console.log(JSON.stringify(apptSvcs.recordset, null, 2));

  process.exit(0);
}

checkDebug().catch(err => {
  console.error(err);
  process.exit(1);
});
