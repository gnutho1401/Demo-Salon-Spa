const { connectDB } = require('../src/config/db');
connectDB().then(async pool => {
  const r = await pool.request().query("SELECT TOP 3 u.UserId, u.FullName, u.RoleId, e.Position FROM Users u JOIN Employees e ON u.UserId=e.UserId ORDER BY e.EmployeeId");
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
});
