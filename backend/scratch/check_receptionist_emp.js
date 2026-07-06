const { connectDB } = require("../src/config/db");

async function check() {
  try {
    const pool = await connectDB();
    const res = await pool.request().query(`
      SELECT u.UserId, u.FullName, e.EmployeeId, r.RoleName
      FROM Users u
      LEFT JOIN Employees e ON u.UserId = e.UserId
      LEFT JOIN Roles r ON u.RoleId = r.RoleId
      WHERE u.RoleId = 3
    `);
    console.log("Receptionists and their Employee IDs:", res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
