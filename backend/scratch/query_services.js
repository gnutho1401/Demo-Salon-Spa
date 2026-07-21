const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    const result = await pool.query('SELECT ServiceId, ServiceName, Price FROM Services');
    console.log("Current Services in database:");
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
