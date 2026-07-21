const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function setBichNgocPass() {
  const pool = await connectDB();
  const hash123456 = await bcrypt.hash('123456', 10);

  await pool.request()
    .input('email', sql.NVarChar, 'bichngoc@lunaspa.com')
    .input('hash', sql.NVarChar, hash123456)
    .query('UPDATE Users SET PasswordHash = @hash, IsVerified = 1 WHERE Email = @email');

  console.log('✅ Đã đặt mật khẩu cho bichngoc@lunaspa.com là: 123456 (hoặc Luna@2026)');
  process.exit(0);
}

setBichNgocPass().catch(err => { console.error(err); process.exit(1); });
