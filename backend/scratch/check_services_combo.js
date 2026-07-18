const { connectDB } = require('../src/config/db');

async function checkServices() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Price, s.Status, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY s.ServiceId DESC
  `);
  
  console.log('\n=== ALL AVAILABLE SERVICES ===');
  result.recordset.forEach(s => {
    const isCombo = /combo|gói|liệu trình/i.test(s.ServiceName);
    console.log(`${isCombo ? '⚠️ COMBO?' : '  '}  ID: ${s.ServiceId} | ${s.ServiceName} | ${Number(s.Price).toLocaleString('vi-VN')}đ | Category: ${s.CategoryName || 'N/A'}`);
  });
  
  console.log(`\nTotal: ${result.recordset.length} services`);
  process.exit(0);
}

checkServices().catch(err => { console.error(err); process.exit(1); });
