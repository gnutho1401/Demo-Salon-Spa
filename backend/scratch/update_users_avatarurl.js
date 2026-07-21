const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  
  console.log('=== UPDATING USERS.AVATARURL IN DATABASE ===');
  const updateResult = await pool.request().query(`
    UPDATE u
    SET u.AvatarUrl = e.ImageUrl
    FROM Users u
    JOIN Employees e ON u.UserId = e.UserId
    WHERE u.RoleId = 4 
      AND (u.AvatarUrl IS NULL OR u.AvatarUrl = '' OR u.AvatarUrl = 'NULL')
  `);

  console.log(`Updated ${updateResult.rowsAffected[0]} records in the Users table.`);

  // Verify updates
  const verifyResult = await pool.request().query(`
    SELECT u.UserId, e.EmployeeId, u.FullName, u.AvatarUrl, e.ImageUrl
    FROM Users u
    LEFT JOIN Employees e ON u.UserId = e.UserId
    WHERE u.RoleId = 4
    ORDER BY e.EmployeeId ASC
  `);

  console.log('\n=== VERIFICATION LIST ===');
  verifyResult.recordset.forEach(r => {
    console.log(`UserId: ${r.UserId} | EmpId: ${r.EmployeeId} | Name: "${r.FullName}" | User.AvatarUrl: "${r.AvatarUrl}" | Emp.ImageUrl: "${r.ImageUrl}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
