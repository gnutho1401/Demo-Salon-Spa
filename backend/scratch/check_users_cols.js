const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const r = await pool.request().query(`
    SELECT TOP 1 * FROM Users
  `);
  console.log("User Columns and Sample Data:");
  console.log(r.recordset[0]);
  process.exit(0);
})();
