const { connectDB } = require('../src/config/db');

async function checkAll() {
  const pool = await connectDB();
  
  // Check categories
  const cats = await pool.request().query(`SELECT * FROM ServiceCategories ORDER BY CategoryId`);
  console.log('\n=== DANH MỤC DỊCH VỤ ===');
  cats.recordset.forEach(c => console.log(`  ID: ${c.CategoryId} | ${c.CategoryName}`));
  
  // Check all services grouped by category
  const services = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Price, s.DurationMinutes, s.Status, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY c.CategoryName, s.ServiceId
  `);
  
  console.log('\n=== DỊCH VỤ THEO DANH MỤC ===');
  let currentCat = '';
  let count = 0;
  services.recordset.forEach(s => {
    if (s.CategoryName !== currentCat) {
      currentCat = s.CategoryName;
      console.log(`\n📂 ${currentCat || 'Không phân loại'}:`);
    }
    count++;
    console.log(`   ${count}. [ID ${s.ServiceId}] ${s.ServiceName} — ${Number(s.Price).toLocaleString('vi-VN')}đ — ${s.DurationMinutes} phút`);
  });
  
  console.log(`\n✅ Tổng: ${count} dịch vụ đang hoạt động`);
  
  process.exit(0);
}

checkAll().catch(err => { console.error(err); process.exit(1); });
