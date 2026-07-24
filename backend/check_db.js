require('dotenv').config({ path: 'e:\\Demo-Salon-Spa\\backend\\.env' });
const { connectDB } = require('e:\\Demo-Salon-Spa\\backend\\src\\config\\db');

async function run() {
  const pool = await connectDB();
  const res = await pool.request().query("SELECT StyleCode, StyleName, Audience FROM dbo.AIHairStyles WHERE IsActive = 1");
  console.log(res.recordset);
  process.exit(0);
}
run();
