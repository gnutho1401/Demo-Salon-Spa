const { connectDB, sql } = require('../src/config/db');

async function listAllPackages() {
  const pool = await connectDB();
  
  const result = await pool.request().query(`
    SELECT p.PackageId, p.PackageName, p.Description, p.OriginalPrice, p.SalePrice, p.TotalSessions, pc.CategoryName
    FROM Packages p
    LEFT JOIN PackageCategories pc ON p.PackageCategoryId = pc.PackageCategoryId
  `);
  
  console.log('\n=== CURRENT PACKAGES ===');
  for (const p of result.recordset) {
    console.log(`\n📦 [ID ${p.PackageId}] Name: ${p.PackageName} | Category: ${p.CategoryName || 'N/A'}`);
    console.log(`   Original Price: ${Number(p.OriginalPrice).toLocaleString('vi-VN')}đ | Sale Price: ${Number(p.SalePrice).toLocaleString('vi-VN')}đ | Sessions: ${p.TotalSessions}`);
    console.log(`   Description: ${p.Description}`);
    
    // Services
    const svcs = await pool.request().input('PackageId', sql.Int, p.PackageId).query(`
      SELECT s.ServiceId, s.ServiceName, s.Price, ps.SessionCount
      FROM PackageServices ps
      JOIN Services s ON ps.ServiceId = s.ServiceId
      WHERE ps.PackageId = @PackageId
    `);
    
    if (svcs.recordset.length > 0) {
      console.log(`   Services inside:`);
      let totalSvcVal = 0;
      svcs.recordset.forEach(s => {
        const lineVal = Number(s.Price) * s.SessionCount;
        totalSvcVal += lineVal;
        console.log(`     - [ID ${s.ServiceId}] ${s.ServiceName} | Price: ${Number(s.Price).toLocaleString('vi-VN')}đ x ${s.SessionCount} sessions = ${lineVal.toLocaleString('vi-VN')}đ`);
      });
      console.log(`     Total Service Value: ${totalSvcVal.toLocaleString('vi-VN')}đ`);
    } else {
      console.log(`   ⚠️ NO SERVICES REGISTERED IN THIS PACKAGE`);
    }
  }
  
  process.exit(0);
}

listAllPackages().catch(err => { console.error(err); process.exit(1); });
