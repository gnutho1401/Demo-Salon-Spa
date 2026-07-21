const { connectDB } = require('../src/config/db');

async function queryShiftsAndAppointments() {
  const pool = await connectDB();
  
  const shifts = await pool.request().query(`
    SELECT DISTINCT StartTime, EndTime
    FROM Shifts
  `);
  console.log('--- Unique Shift Times ---');
  console.log(shifts.recordset);
  
  const appts = await pool.request().query(`
    SELECT DISTINCT StartTime, EndTime
    FROM Appointments
    ORDER BY StartTime
  `);
  console.log('--- Unique Appointment Times ---');
  console.log(appts.recordset);

  process.exit(0);
}

queryShiftsAndAppointments().catch(err => {
  console.error(err);
  process.exit(1);
});
