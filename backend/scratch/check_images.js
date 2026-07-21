const { connectDB } = require('../src/config/db');

async function checkImages() {
  const pool = await connectDB();
  const result = (await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.ImageUrl, c.CategoryName
    FROM Services s LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE' ORDER BY c.CategoryName, s.ServiceId
  `)).recordset;

  console.log('\n=== DỊCH VỤ & HÌNH ẢNH ===');
  result.forEach(s => {
    const hasImg = s.ImageUrl ? '✅' : '❌';
    console.log(`  ${hasImg} [${s.CategoryName}] ${s.ServiceName} → ${s.ImageUrl || 'CHƯA CÓ ẢNH'}`);
  });

  const missing = result.filter(s => !s.ImageUrl);
  console.log(`\n📊 Có ảnh: ${result.length - missing.length}/${result.length} | Thiếu: ${missing.length}`);
  if (missing.length > 0) {
    console.log('\n❌ Dịch vụ chưa có ảnh:');
    missing.forEach(s => console.log(`  - [ID ${s.ServiceId}] ${s.ServiceName} (${s.CategoryName})`));
  }

  process.exit(0);
}
checkImages().catch(err => { console.error(err); process.exit(1); });
