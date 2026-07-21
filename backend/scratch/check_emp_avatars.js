const { connectDB } = require('../src/config/db');

async function checkEmpAvatars() {
  const pool = await connectDB();
  const res = (await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.ImageUrl, u.AvatarUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
  `)).recordset;

  console.log('Kỹ thuật viên & Avatar:', res);
  process.exit(0);
}

checkEmpAvatars().catch(console.error);
