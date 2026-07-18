const { connectDB, sql } = require('../src/config/db');

async function findBichNgoc() {
  const pool = await connectDB();

  console.log('🔍 Đang tìm kiếm tài khoản Bích Ngọc...');

  const res = await pool.request()
    .input('term', sql.NVarChar, '%Ngọc%')
    .query(`
      SELECT u.UserId, u.Email, u.FullName, u.Phone, r.RoleName
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.RoleId
      WHERE u.FullName LIKE @term OR u.Email LIKE @term
    `);

  console.log('Kết quả tìm kiếm Users:', res.recordset);

  process.exit(0);
}

findBichNgoc().catch(err => {
  console.error(err);
  process.exit(1);
});
