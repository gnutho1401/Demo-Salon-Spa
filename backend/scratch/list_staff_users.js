const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const r = await pool.request().query(`
    SELECT u.UserId, u.FullName, u.Email, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE r.RoleName IN ('Receptionist', 'Admin', 'Manager')
  `);
  console.log("Authorized Staff Accounts:");
  console.table(r.recordset);
  process.exit(0);
})();
