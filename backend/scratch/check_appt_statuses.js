const { connectDB, sql } = require("../src/config/db");

async function checkApptStatuses() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT DISTINCT Status FROM Appointments
  `);
  console.log("Distinct Appointment Statuses in DB:", res.recordset);

  const comboAppts = await pool.request().query(`
    SELECT a.AppointmentId, a.CustomerPackageId, a.CustomerId, a.Status, a.AppointmentDate, a.StartTime
    FROM Appointments a
    WHERE a.CustomerPackageId IS NOT NULL
  `);
  console.log("Combo Appts in DB:", comboAppts.recordset);

  process.exit(0);
}

checkApptStatuses();
