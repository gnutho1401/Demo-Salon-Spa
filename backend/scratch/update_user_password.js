const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function main() {
  const pool = await connectDB();
  
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    console.log('Generated hash for "123456":', hashedPassword);
    
    await pool.request()
      .input('Email', sql.NVarChar, 'dgkkienkji@gmail.com')
      .input('PasswordHash', sql.NVarChar, hashedPassword)
      .query("UPDATE Users SET PasswordHash = @PasswordHash, IsVerified = 1 WHERE Email = @Email");
      
    console.log('✅ User password updated to "123456"!');
  } catch (err) {
    console.error('❌ Error updating password:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
