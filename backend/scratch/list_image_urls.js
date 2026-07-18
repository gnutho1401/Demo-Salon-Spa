const { connectDB, sql } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.ImageUrl, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    ORDER BY c.CategoryName, s.ServiceId
  `);

  console.log('=== SERVICE IMAGES ===');
  result.recordset.forEach(s => {
    console.log(`- ID: ${s.ServiceId} | Service: "${s.ServiceName}" | Category: "${s.CategoryName}" | ImageUrl: "${s.ImageUrl}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
