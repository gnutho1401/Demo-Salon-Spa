const { connectDB } = require("../src/config/db");

async function check() {
  try {
    const pool = await connectDB();
    const res = await pool.request().query("SELECT TOP 10 * FROM WorkShifts");
    console.log("WorkShifts:", res.recordset);
    
    const res2 = await pool.request().query("SELECT TOP 10 * FROM ShiftRegistrations");
    console.log("ShiftRegistrations:", res2.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
