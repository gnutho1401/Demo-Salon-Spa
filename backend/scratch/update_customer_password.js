const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    const email = 'customer@salon.com';
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Updating password of ${email} to ${password}...`);
    await pool.request()
      .input('Email', sql.NVarChar, email)
      .input('PasswordHash', sql.NVarChar, hashedPassword)
      .query('UPDATE Users SET PasswordHash = @PasswordHash, IsVerified = 1, Status = \'ACTIVE\' WHERE Email = @Email');

    console.log("Password updated successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
