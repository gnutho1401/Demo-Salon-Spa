const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.ImageUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
  `);

  console.log('=== EMPLOYEE IMAGE URLS ===');
  result.recordset.forEach(r => {
    console.log(`ID: ${r.EmployeeId} | Name: "${r.FullName}" | ImageUrl: "${r.ImageUrl || 'NULL'}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
