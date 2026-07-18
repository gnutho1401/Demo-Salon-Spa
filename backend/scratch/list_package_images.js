const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT PackageId, PackageName, ImageUrl, OriginalPrice, SalePrice, Status
    FROM Packages
    ORDER BY PackageId
  `);

  console.log('=== PACKAGE (COMBO) IMAGES ===');
  result.recordset.forEach(p => {
    console.log(`- ID: ${p.PackageId} | Name: "${p.PackageName}" | ImageUrl: "${p.ImageUrl}" | SalePrice: ${p.SalePrice}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
