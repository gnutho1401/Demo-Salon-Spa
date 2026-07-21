const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = await connectDB();
  const hash = await bcrypt.hash('123456', 10);

  const emails = [
    'customer@salon.com',
    'receptionist1@salon.com',
    'technician@salon.com'
  ];

  for (const email of emails) {
    await pool.request()
      .input('Email', sql.NVarChar, email)
      .input('Hash', sql.NVarChar, hash)
      .query("UPDATE Users SET PasswordHash = @Hash, IsVerified = 1 WHERE Email = @Email");
    console.log(`✅ Set password "123456" for ${email}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
