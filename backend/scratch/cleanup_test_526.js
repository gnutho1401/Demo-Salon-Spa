const { connectDB } = require('../src/config/db');

async function cleanup() {
  const pool = await connectDB();
  await pool.request().query(`DELETE FROM AppointmentServices WHERE AppointmentId = 526`);
  await pool.request().query(`DELETE FROM CustomerPackageUsages WHERE AppointmentId = 526`);
  await pool.request().query(`DELETE FROM Appointments WHERE AppointmentId = 526`);
  await pool.request().query(`DELETE FROM CustomerPackages WHERE CustomerPackageId = 96`);
  console.log('Cleaned up test appt 526 & package 96');
  process.exit(0);
}

cleanup();
