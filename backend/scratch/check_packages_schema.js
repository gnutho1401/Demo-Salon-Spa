const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  
  const customerPackagesResult = await pool.request().query(`
    SELECT TOP 5 * FROM CustomerPackages
  `);
  console.log('=== CustomerPackages columns ===');
  console.log(customerPackagesResult.recordset[0] ? Object.keys(customerPackagesResult.recordset[0]) : 'None');
  console.log(customerPackagesResult.recordset);

  const packageInvoicesResult = await pool.request().query(`
    SELECT TOP 5 * FROM Invoices WHERE AppointmentId IS NULL
  `);
  console.log('=== Package/Other Invoices ===');
  console.log(packageInvoicesResult.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
