const { connectDB, sql } = require("../src/config/db");

async function checkMapping() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT es.EmployeeId, u.FullName, es.ServiceId, s.ServiceName
    FROM EmployeeServices es
    JOIN Employees e ON es.EmployeeId = e.EmployeeId
    JOIN Users u ON e.UserId = u.UserId
    JOIN Services s ON es.ServiceId = s.ServiceId
  `);
  console.log("EmployeeServices count:", res.recordset.length);
  console.log("Sample mappings:", res.recordset.slice(0, 15));
  process.exit(0);
}

checkMapping().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
