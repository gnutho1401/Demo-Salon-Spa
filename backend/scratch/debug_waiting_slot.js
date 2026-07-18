const { connectDB, sql } = require('../src/config/db');
const { getAvailableSlots } = require('../src/modules/appointments/availability.service');

async function debug() {
  const pool = await connectDB();
  console.log("Checking columns of Appointments and WaitingList...");
  const apptCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Appointments'
  `);
  console.log("Appointments Columns:", apptCols.recordset);

  const waitingCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WaitingList'
  `);
  console.log("WaitingList Columns:", waitingCols.recordset);

  const waitingMatched = await pool.request().query(`
    SELECT WaitingId, CustomerId, ServiceId, Status, MatchedEmployeeId, MatchedDate, MatchedStartTime, MatchedEndTime, HoldExpiresAt
    FROM WaitingList
    WHERE Status IN ('WAITING', 'MATCHED')
  `);
  console.log("Current WAITING / MATCHED items:", waitingMatched.recordset);

  process.exit(0);
}

debug();
