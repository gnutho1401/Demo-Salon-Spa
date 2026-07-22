const { connectDB, sql } = require("../src/config/db");

async function checkApptServices() {
  const pool = await connectDB();
  const columns = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'AppointmentServices'
  `);
  console.log("AppointmentServices columns:", columns.recordset);
  process.exit(0);
}

checkApptServices();
