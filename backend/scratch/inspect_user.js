const { connectDB } = require("../src/config/db");

async function check() {
  const pool = await connectDB();
  
  const user = await pool.request().query(`
    SELECT u.UserId, u.Email, u.Phone, u.PasswordHash, u.FullName, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE u.UserId = 136 OR u.FullName LIKE N'%Hoài An%'
  `);
  console.log(user.recordset);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
