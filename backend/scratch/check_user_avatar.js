const { connectDB } = require('../src/config/db');
require('dotenv').config();

async function main() {
  const pool = await connectDB();
  
  try {
    const result = await pool.query("SELECT UserId, FullName, Email, AvatarUrl, GoogleId FROM Users WHERE Email = 'dgkkienkji@gmail.com'");
    console.log('User data in DB:', JSON.stringify(result.recordset, null, 2));
  } catch (err) {
    console.error('Error fetching user:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
