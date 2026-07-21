const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const r = await pool.request().input("Email", sql.NVarChar, 'receptionist@salon.com').query(`
    SELECT UserId, Email, Status, IsVerified, PasswordHash, RoleId
    FROM Users
    WHERE Email = @Email
  `);
  console.log("Receptionist user row:", r.recordset[0]);
  process.exit(0);
})();
