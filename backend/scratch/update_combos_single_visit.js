const { connectDB, sql } = require('../src/config/db');

async function main() {
  const pool = await connectDB();

  const packagesData = [
    {
      PackageId: 1,
      PackageName: 'Combo F5 Nhan Sắc & Dưỡng Sinh',
      Description: 'Gói combo làm đẹp và thư giãn trọn gói 1 lượt trong ngày. Bao gồm gội đầu dưỡng sinh, chăm sóc da mặt cơ bản và massage cổ vai gáy giải tỏa mệt mỏi.',
      OriginalPrice: 150000,
      SalePrice: 120000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 17, SessionCount: 1 },
        { ServiceId: 11, SessionCount: 1 },
        { ServiceId: 3, SessionCount: 1 }
      ]
    },
    {
      PackageId: 2,
      PackageName: 'Combo Trị Mụn & Phục Hồi Y Khoa',
      Description: 'Combo chăm sóc trọn gói 1 lượt gồm trị mụn chuyên sâu, đắp mặt nạ collagen vàng và cấy tinh chất phục hồi giúp da mờ thâm se khít lỗ chân lông.',
      OriginalPrice: 188000,
      SalePrice: 149000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 12, SessionCount: 1 },
        { ServiceId: 27, SessionCount: 1 },
        { ServiceId: 14, SessionCount: 1 }
      ]
    },
    {
      PackageId: 3,
      PackageName: 'Combo Slim Body & Thải Độc Spa',
      Description: 'Combo giảm béo & detox trọn gói 1 lượt. Kết hợp massage detox body đào thải mỡ thừa, giảm béo bụng và xông hơi thảo dược thư giãn.',
      OriginalPrice: 210000,
      SalePrice: 169000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 16, SessionCount: 1 },
        { ServiceId: 15, SessionCount: 1 },
        { ServiceId: 31, SessionCount: 1 }
      ]
    },
    {
      PackageId: 4,
      PackageName: 'Combo Trẻ Hóa & Nâng Cơ Hoàng Gia',
      Description: 'Combo nâng cơ trẻ hóa trọn gói 1 lượt. Bao gồm công nghệ trẻ hóa da, cấy tinh chất phục hồi và đắp mặt nạ collagen vàng 24K.',
      OriginalPrice: 213000,
      SalePrice: 169000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 13, SessionCount: 1 },
        { ServiceId: 14, SessionCount: 1 },
        { ServiceId: 27, SessionCount: 1 }
      ]
    },
    {
      PackageId: 5,
      PackageName: 'Combo Nàng Thơ Tóc & Nail Nổi Bật',
      Description: 'Combo tạo kiểu trọn gói 1 lượt thích hợp trước các dịp lễ tiệc. Gồm cắt tạo kiểu tóc, nhuộm thời trang và vẽ nail nghệ thuật đính đá.',
      OriginalPrice: 125000,
      SalePrice: 99000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 7, SessionCount: 1 },
        { ServiceId: 8, SessionCount: 1 },
        { ServiceId: 24, SessionCount: 1 }
      ]
    },
    {
      PackageId: 6,
      PackageName: 'Combo Thư Giãn Cuối Tuần VIP',
      Description: 'Gói liệu trình thư giãn trọn gói 1 lượt. Bao gồm massage body tinh dầu thảo dược, massage chân & foot spa và chăm sóc da mặt nhẹ nhàng.',
      OriginalPrice: 120000,
      SalePrice: 95000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 21, SessionCount: 1 },
        { ServiceId: 22, SessionCount: 1 },
        { ServiceId: 11, SessionCount: 1 }
      ]
    },
    {
      PackageId: 7,
      PackageName: 'Combo Chăm Sóc Móng Spa & Nail Art',
      Description: 'Combo làm móng trọn gói 1 lượt gồm chăm sóc móng tay chân, vẽ nail art đính đá cao cấp và pedicure spa gót chân.',
      OriginalPrice: 85000,
      SalePrice: 69000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 6, SessionCount: 1 },
        { ServiceId: 24, SessionCount: 1 },
        { ServiceId: 26, SessionCount: 1 }
      ]
    },
    {
      PackageId: 8,
      PackageName: 'Combo Phun Xăm Thẩm Mỹ Mày & Môi Collagen',
      Description: 'Combo phun xăm trọn gói 1 lượt bao gồm phun chân mày tán bột sắc nét và phun môi phủ collagen căng mọng tự nhiên.',
      OriginalPrice: 350000,
      SalePrice: 279000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 36, SessionCount: 1 },
        { ServiceId: 37, SessionCount: 1 }
      ]
    },
    {
      PackageId: 9,
      PackageName: 'Combo Mắt Đẹp Long Lanh Nối Mi & Uốn Mi',
      Description: 'Combo nối & uốn mi trọn gói 1 lượt cho đôi mắt sắc nét cuốn hút. Bao gồm uốn mi & nhuộm mi thảo dược và nối mi classic tự nhiên.',
      OriginalPrice: 63000,
      SalePrice: 49000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 40, SessionCount: 1 },
        { ServiceId: 42, SessionCount: 1 }
      ]
    },
    {
      PackageId: 10,
      PackageName: 'Combo Triệt Lông Toàn Thân Diode Laser',
      Description: 'Combo triệt lông trọn gói 1 lượt 3 vùng (nách, chân, bikini) công nghệ Diode Laser an toàn không đau rát, giúp da mịn màng tự tin.',
      OriginalPrice: 110000,
      SalePrice: 89000,
      TotalSessions: 1,
      ValidityDays: 30,
      services: [
        { ServiceId: 34, SessionCount: 1 },
        { ServiceId: 46, SessionCount: 1 },
        { ServiceId: 47, SessionCount: 1 }
      ]
    }
  ];

  for (const pkg of packagesData) {
    console.log(`Updating Package ID ${pkg.PackageId}: ${pkg.PackageName}...`);

    await pool.request()
      .input('PackageId', sql.Int, pkg.PackageId)
      .input('PackageName', sql.NVarChar, pkg.PackageName)
      .input('Description', sql.NVarChar, pkg.Description)
      .input('OriginalPrice', sql.Decimal(18, 2), pkg.OriginalPrice)
      .input('SalePrice', sql.Decimal(18, 2), pkg.SalePrice)
      .input('TotalSessions', sql.Int, pkg.TotalSessions)
      .input('ValidityDays', sql.Int, pkg.ValidityDays)
      .query(`
        UPDATE Packages
        SET PackageName = @PackageName,
            Description = @Description,
            OriginalPrice = @OriginalPrice,
            SalePrice = @SalePrice,
            TotalSessions = @TotalSessions,
            ValidityDays = @ValidityDays,
            UpdatedAt = GETDATE()
        WHERE PackageId = @PackageId
      `);

    // Delete old PackageServices
    await pool.request()
      .input('PackageId', sql.Int, pkg.PackageId)
      .query('DELETE FROM PackageServices WHERE PackageId = @PackageId');

    // Insert new PackageServices
    for (const svc of pkg.services) {
      await pool.request()
        .input('PackageId', sql.Int, pkg.PackageId)
        .input('ServiceId', sql.Int, svc.ServiceId)
        .input('SessionCount', sql.Int, svc.SessionCount)
        .query(`
          INSERT INTO PackageServices (PackageId, ServiceId, SessionCount)
          VALUES (@PackageId, @ServiceId, @SessionCount)
        `);
    }
  }

  console.log('✅ Updated all Packages to Single-Visit 1-Session Combo Bundles successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
