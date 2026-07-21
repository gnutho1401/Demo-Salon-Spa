const { connectDB } = require('../src/config/db');

async function checkPackages() {
  const pool = await connectDB();
  
  // Get all packages
  const packages = await pool.request().query(`
    SELECT PackageId, Name, Description, Price, Status, ImageUrl
    FROM Packages
    ORDER BY PackageId
  `);
  
  console.log('\n=== DANH SÁCH GÓI / COMBO (Packages) ===');
  for (const pkg of packages.recordset) {
    console.log(`\n📦 [ID ${pkg.PackageId}] ${pkg.Name} | Giá: ${Number(pkg.Price).toLocaleString('vi-VN')}đ | Status: ${pkg.Status}`);
    console.log(`   Mô tả: ${pkg.Description}`);
    
    // Get services in this package
    const items = await pool.request()
      .input('pkgId', pkg.PackageId)
      .query(`
        SELECT ps.ServiceId, s.ServiceName, s.Price as ServicePrice, ps.Quantity
        FROM PackageServices ps
        JOIN Services s ON ps.ServiceId = s.ServiceId
        WHERE ps.PackageId = @pkgId
      `);
    
    if (items.recordset.length > 0) {
      console.log(`   Dịch vụ đi kèm:`);
      let sumPrice = 0;
      items.recordset.forEach(item => {
        const itemTotal = Number(item.ServicePrice) * item.Quantity;
        sumPrice += itemTotal;
        console.log(`     - [ID ${item.ServiceId}] ${item.ServiceName} (SL: ${item.Quantity}) | Giá đơn lẻ: ${Number(item.ServicePrice).toLocaleString('vi-VN')}đ (Tổng: ${itemTotal.toLocaleString('vi-VN')}đ)`);
      });
      console.log(`     Total services value if bought individually: ${sumPrice.toLocaleString('vi-VN')}đ (Package price: ${Number(pkg.Price).toLocaleString('vi-VN')}đ)`);
    } else {
      console.log(`   ⚠️ CHƯA CÓ DỊCH VỤ ĐI KÈM TRONG GÓI NÀY!`);
    }
  }
  
  process.exit(0);
}

checkPackages().catch(err => { console.error(err); process.exit(1); });
