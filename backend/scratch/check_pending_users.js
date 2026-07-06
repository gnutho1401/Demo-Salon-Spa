require('dotenv').config();
const { sql, connectDB } = require('../src/config/db');

async function check() {
  try {
    const pool = await connectDB();
    console.log('Querying PendingUsers table...');
    const result = await pool.request().query('SELECT TOP 10 * FROM PendingUsers ORDER BY PendingUserId DESC');
    console.log('Pending Users:');
    console.dir(result.recordset, { depth: null, colors: true });

    console.log('\nQuerying recently registered Users table...');
    const usersResult = await pool.request().query('SELECT TOP 10 UserId, FullName, Email, IsVerified, CreatedAt FROM Users ORDER BY UserId DESC');
    console.log('Users:');
    console.dir(usersResult.recordset, { depth: null, colors: true });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
