const { connectDB } = require("../src/config/db");

async function check() {
  try {
    const pool = await connectDB();
    const res = await pool.request().query(`
      SELECT
        u.UserId,
        u.FullName,
        e.EmployeeId,
        e.Position,
        e.HireDate,
        b.BranchName
      FROM Users u
      LEFT JOIN Employees e ON u.UserId = e.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      WHERE u.UserId = 7
    `);
    console.log("Profile data for receptionist 7:", res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
