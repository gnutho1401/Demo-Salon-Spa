const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const email = 'receptionist@salon.com';
  
  // 1. Run full query
  const resFull = await pool.request().input("Email", sql.NVarChar, email).query(`
    SELECT
      u.UserId,
      u.FullName,
      u.Email,
      u.RoleId,
      r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN Customers c ON u.UserId = c.UserId
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    WHERE u.Email = @Email
  `);
  console.log("Full query result:", resFull.recordset[0]);

  // 2. Simple query
  const resSimple = await pool.request().input("Email", sql.NVarChar, email).query(`
    SELECT u.UserId, u.Email, u.RoleId, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE u.Email = @Email
  `);
  console.log("Simple query result:", resSimple.recordset[0]);

  process.exit(0);
})();
