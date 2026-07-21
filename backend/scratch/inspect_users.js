const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT u.UserId, u.Email, u.FullName, u.GoogleId, u.RoleId, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    ORDER BY r.RoleName, u.UserId
  `);
  console.log('All Users in DB:', res.recordset);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
