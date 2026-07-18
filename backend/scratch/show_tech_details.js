const { connectDB } = require('../src/config/db');

async function showDetailedTechnicians() {
  const pool = await connectDB();

  const res = (await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization, e.ImageUrl, u.AvatarUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    ORDER BY e.EmployeeId ASC
  `)).recordset;

  console.log('📋 Danh sách Kỹ thuật viên chi tiết từ DB:');
  console.table(res);

  process.exit(0);
}

showDetailedTechnicians().catch(console.error);
