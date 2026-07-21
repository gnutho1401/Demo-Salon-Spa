const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT TOP 1 *
    FROM Invoices
  `);

  console.log('=== INVOICE COLUMNS ===');
  console.log(result.recordset[0] ? Object.keys(result.recordset[0]) : 'No invoices found');

  const sumResult = await pool.request().query(`
    SELECT SUM(FinalAmount) AS TotalSpent
    FROM Invoices
    WHERE Status = 'PAID'
  `);
  console.log('Test Sum of PAID Invoices:', sumResult.recordset[0]);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
