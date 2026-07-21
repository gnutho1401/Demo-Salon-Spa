const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query('SELECT TOP 1 * FROM CustomerPackageUsages');
  console.log('CustomerPackageUsages cols:', Object.keys(res.recordset[0] || {}));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
