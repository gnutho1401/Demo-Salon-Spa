const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT u.UserId, e.EmployeeId, u.FullName, u.AvatarUrl, e.ImageUrl
    FROM Users u
    LEFT JOIN Employees e ON u.UserId = e.UserId
    WHERE u.RoleId = 4
  `);

  console.log('=== USERS AVATARURL vs EMPLOYEES IMAGEURL ===');
  result.recordset.forEach(r => {
    console.log(`UserId: ${r.UserId} | EmpId: ${r.EmployeeId} | Name: "${r.FullName}" | User.AvatarUrl: "${r.AvatarUrl || 'NULL'}" | Emp.ImageUrl: "${r.ImageUrl || 'NULL'}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
