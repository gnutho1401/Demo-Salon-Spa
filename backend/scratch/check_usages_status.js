const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT definition 
    FROM sys.check_constraints 
    WHERE name = 'CK_CustomerPackageUsages_Status'
  `);
  console.log('CK_CustomerPackageUsages_Status definition:', res.recordset);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
