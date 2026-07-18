const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT TOP 1 *
    FROM Reviews
  `);

  console.log('=== REVIEWS COLUMNS ===');
  console.log(result.recordset[0] ? Object.keys(result.recordset[0]) : 'No reviews found');

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
