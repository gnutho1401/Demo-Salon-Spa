const { connectDB, sql } = require('../src/config/db');

async function updateAllPackagesExact() {
  const pool = await connectDB();

  console.log('\n=== 1. TẠO DANH MỤC GÓI MỚI (NẾU CHƯA CÓ) ===');
  const packageCategories = [
    'Chăm sóc da',
    'Trị mụn',
    'Detox & Body',
    'Trẻ hóa da',
    'Tóc & Nail',
    'Massage & Thư giãn',
    'Dịch vụ Nail',
    'Phun xăm thẩm mỹ',
    'Nối mi & Uốn mi',
    'Triệt lông'
  ];

  for (const name of packageCategories) {
    const exists = await pool.request()
      .input('name', sql.NVarChar, name)
      .query(`SELECT COUNT(*) as c FROM PackageCategories WHERE CategoryName = @name`);
    if (exists.recordset[0].c === 0) {
      await pool.request()
        .input('name', sql.NVarChar, name)
        .query(`INSERT INTO PackageCategories (CategoryName) VALUES (@name)`);
      console.log(`  ✅ Đã tạo danh mục gói: ${name}`);
    }
  }

  // Category map
  const catRes = await pool.request().query(`SELECT PackageCategoryId, CategoryName FROM PackageCategories`);
  const catMap = {};
  catRes.recordset.forEach(c => catMap[c.CategoryName] = c.PackageCategoryId);

  // Services map
  const svcRes = await pool.request().query(`SELECT ServiceId, ServiceName, Price FROM Services WHERE Status = 'AVAILABLE'`);
  const svcMap = {};
  svcRes.recordset.forEach(s => svcMap[s.ServiceName] = { id: s.ServiceId, price: Number(s.Price) });

  console.log('\n=== 2. CẬP NHẬT GÓI LIỆU TRÌNH CHUẨN XÁC GIÁ ===');

  const packagesData = [
    {
      id: 1,
      name: 'Liệu trình căng bóng phục hồi chuyên sâu',
      desc: 'Liệu trình nuôi dưỡng chuyên sâu 5 buổi gồm chăm sóc da mặt cơ bản và cấy tinh chất phục hồi. Kích thích tái tạo da, mờ thâm sạm, mang lại làn da căng bóng mịn màng.',
      origPrice: 255000, // Exactly (35,000 * 3) + (75,000 * 2)
      salePrice: 200000,
      sessions: 5,
      catName: 'Chăm sóc da',
      imgUrl: '/images/services/skincare.png',
      services: [
        { name: 'Chăm sóc da mặt cơ bản', count: 3 },
        { name: 'Cấy tinh chất phục hồi', count: 2 }
      ]
    },
    {
      id: 2,
      name: 'Liệu trình trị mụn chuẩn y khoa',
      desc: 'Liệu trình 8 buổi điều trị các loại mụn bọc, mụn cám, mụn ẩn kết hợp đắp mặt nạ phục hồi da. Diệt khuẩn sâu, se khít lỗ chân lông và phục hồi nền da tổn thương.',
      origPrice: 430000, // Exactly (65,000 * 5) + (35,000 * 3)
      salePrice: 340000,
      sessions: 8,
      catName: 'Trị mụn',
      imgUrl: '/images/services/acne-care.png',
      services: [
        { name: 'Trị mụn chuyên sâu', count: 5 },
        { name: 'Chăm sóc da mặt cơ bản', count: 3 }
      ]
    },
    {
      id: 3,
      name: 'Combo giảm béo slim body toàn diện',
      desc: 'Liệu trình giảm béo công nghệ cao 10 buổi kết hợp massage detox đào thải mỡ thừa vùng bụng. Giúp thon gọn vòng eo, săn chắc cơ bụng và thải độc tố cơ thể.',
      origPrice: 875000, // Exactly (95,000 * 5) + (80,000 * 5)
      salePrice: 700000,
      sessions: 10,
      catName: 'Detox & Body',
      imgUrl: '/images/services/slim-belly.png',
      services: [
        { name: 'Giảm béo bụng', count: 5 },
        { name: 'Detox body', count: 5 }
      ]
    },
    {
      id: 4,
      name: 'Liệu trình trẻ hóa nâng cơ toàn diện',
      desc: 'Liệu trình trẻ hóa 6 buổi sử dụng công nghệ nâng cơ mặt kết hợp mặt nạ collagen tinh thể vàng 24K. Giúp làm mờ các nếp nhăn và tăng độ săn chắc đàn hồi cho da.',
      origPrice: 414000, // Exactly (90,000 * 3) + (48,000 * 3)
      salePrice: 330000,
      sessions: 6,
      catName: 'Trẻ hóa da',
      imgUrl: '/images/services/anti-aging.png',
      services: [
        { name: 'Trẻ hóa da', count: 3 },
        { name: 'Đắp mặt nạ collagen vàng', count: 3 }
      ]
    },
    {
      id: 5,
      name: 'Combo làm đẹp tóc và nail toàn diện',
      desc: 'Gói làm đẹp nhanh 3 buổi kết hợp tạo mẫu tóc thời trang uốn/nhuộm và vẽ móng nghệ thuật đính đá cao cấp. Phù hợp chuẩn bị trước các dịp lễ tiệc.',
      origPrice: 125000, // Exactly (20,000 * 1) + (70,000 * 1) + (35,000 * 1)
      salePrice: 100000,
      sessions: 3,
      catName: 'Tóc & Nail',
      imgUrl: '/images/services/hair-nail-combo.png',
      services: [
        { name: 'Cắt & tạo kiểu tóc', count: 1 },
        { name: 'Nhuộm tóc thời trang', count: 1 },
        { name: 'Vẽ nail nghệ thuật đính đá', count: 1 }
      ]
    },
    {
      id: 6,
      name: 'Gói thư giãn cuối tuần đặc biệt',
      desc: 'Liệu trình spa thư giãn 4 buổi gồm massage body tinh dầu thảo dược và chăm sóc da mặt nhẹ nhàng. Giải phóng mệt mỏi cơ bắp và căng thẳng hệ thần kinh.',
      origPrice: 180000, // Exactly (55,000 * 2) + (35,000 * 2)
      salePrice: 140000,
      sessions: 4,
      catName: 'Massage & Thư giãn',
      imgUrl: '/images/services/massage-relax.png',
      services: [
        { name: 'Massage body tinh dầu thư giãn', count: 2 },
        { name: 'Chăm sóc da mặt cơ bản', count: 2 }
      ]
    },
    {
      id: 7,
      name: 'Liệu trình chăm sóc & vẽ nail art VIP',
      desc: 'Liệu trình 10 buổi chăm sóc móng chuyên sâu kết hợp vẽ nail art đính đá cao cấp và pedicure gót chân. Giúp giữ bộ móng khỏe đẹp, bền màu lâu dài.',
      origPrice: 315000, // Exactly (35,000 * 5) + (28,000 * 5)
      salePrice: 250000,
      sessions: 10,
      catName: 'Dịch vụ Nail',
      imgUrl: '/images/services/nail-premium.png',
      services: [
        { name: 'Vẽ nail nghệ thuật đính đá', count: 5 },
        { name: 'Pedicure spa cao cấp', count: 5 }
      ]
    },
    {
      id: 8,
      name: 'Liệu trình phun xăm mày môi VIP',
      desc: 'Combo trọn gói 2 buổi phun chân mày tán bột và phun môi phủ collagen thế hệ mới. Tạo dáng mày cân đối sắc nét cùng đôi môi tươi tắn, căng mọng tự nhiên quyến rũ.',
      origPrice: 350000, // Exactly (150,000 * 1) + (200,000 * 1)
      salePrice: 280000,
      sessions: 2,
      catName: 'Phun xăm thẩm mỹ',
      imgUrl: '/images/services/pmu-eyebrow.png',
      services: [
        { name: 'Phun chân mày tán bột', count: 1 },
        { name: 'Phun môi collagen', count: 1 }
      ]
    },
    {
      id: 9,
      name: 'Gói nối mi & uốn cong mi quyến rũ',
      desc: 'Gói chăm sóc mi chuyên sâu 3 buổi gồm uốn mi thảo dược tự nhiên và nối mi classic Hàn Quốc siêu mỏng nhẹ. Cho đôi mắt to tròn, long lanh sắc nét cuốn hút.',
      origPrice: 98000, // Exactly (35,000 * 2) + (28,000 * 1)
      salePrice: 78000,
      sessions: 3,
      catName: 'Nối mi & Uốn mi',
      imgUrl: '/images/services/eyelash-extension.png',
      services: [
        { name: 'Nối mi classic tự nhiên', count: 2 },
        { name: 'Uốn mi & nhuộm mi', count: 1 }
      ]
    },
    {
      id: 10,
      name: 'Combo triệt lông vĩnh viễn toàn diện',
      desc: 'Liệu trình triệt lông 15 buổi chia đều cho 3 vùng: nách, chân và bikini bằng công nghệ Diode Laser an toàn không đau rát. Giúp da mịn màng, sáng khỏe tự tin.',
      origPrice: 550000, // Exactly (20,000 * 5) + (50,000 * 5) + (40,000 * 5)
      salePrice: 440000,
      sessions: 15,
      catName: 'Triệt lông',
      imgUrl: '/images/services/laser-removal.png',
      services: [
        { name: 'Triệt lông nách công nghệ OPT', count: 5 },
        { name: 'Triệt lông chân công nghệ Diode', count: 5 },
        { name: 'Triệt lông bikini', count: 5 }
      ]
    }
  ];

  for (const pkg of packagesData) {
    console.log(`\n⚙️ Đang đồng bộ gói: "${pkg.name}"`);

    // Check if package exists in DB
    const exists = await pool.request()
      .input('id', sql.Int, pkg.id)
      .query(`SELECT COUNT(*) as c FROM Packages WHERE PackageId = @id`);

    const catId = catMap[pkg.catName] || null;

    if (exists.recordset[0].c > 0) {
      // UPDATE package details
      await pool.request()
        .input('id', sql.Int, pkg.id)
        .input('name', sql.NVarChar, pkg.name)
        .input('desc', sql.NVarChar, pkg.desc)
        .input('origPrice', sql.Decimal(18, 2), pkg.origPrice)
        .input('salePrice', sql.Decimal(18, 2), pkg.salePrice)
        .input('sessions', sql.Int, pkg.sessions)
        .input('catId', sql.Int, catId)
        .input('img', sql.NVarChar, pkg.imgUrl)
        .query(`
          UPDATE Packages
          SET PackageName = @name,
              Description = @desc,
              OriginalPrice = @origPrice,
              SalePrice = @salePrice,
              TotalSessions = @sessions,
              PackageCategoryId = @catId,
              ImageUrl = @img,
              Status = 'ACTIVE'
          WHERE PackageId = @id
        `);
      console.log(`  ✅ Đã cập nhật gói ID: ${pkg.id}`);
    } else {
      // INSERT new package
      await pool.request()
        .input('id', sql.Int, pkg.id)
        .input('name', sql.NVarChar, pkg.name)
        .input('desc', sql.NVarChar, pkg.desc)
        .input('origPrice', sql.Decimal(18, 2), pkg.origPrice)
        .input('salePrice', sql.Decimal(18, 2), pkg.salePrice)
        .input('sessions', sql.Int, pkg.sessions)
        .input('catId', sql.Int, catId)
        .input('img', sql.NVarChar, pkg.imgUrl)
        .query(`
          SET IDENTITY_INSERT Packages ON;
          INSERT INTO Packages (PackageId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, PackageCategoryId, Status, IsHot, ValidityDays, ImageUrl)
          VALUES (@id, @name, @desc, @origPrice, @salePrice, @sessions, @catId, 'ACTIVE', 1, 180, @img);
          SET IDENTITY_INSERT Packages OFF;
        `);
      console.log(`  ✅ Đã tạo mới gói ID: ${pkg.id}`);
    }

    // Clean old services mapping
    await pool.request()
      .input('id', sql.Int, pkg.id)
      .query(`DELETE FROM PackageServices WHERE PackageId = @id`);

    // Insert new services mapping
    for (const sInfo of pkg.services) {
      const sData = svcMap[sInfo.name];
      if (!sData) {
        console.log(`  ❌ LỖI: Không tìm thấy dịch vụ "${sInfo.name}"!`);
        continue;
      }

      await pool.request()
        .input('pkgId', sql.Int, pkg.id)
        .input('svcId', sql.Int, sData.id)
        .input('sCount', sql.Int, sInfo.count)
        .query(`
          INSERT INTO PackageServices (PackageId, ServiceId, SessionCount)
          VALUES (@pkgId, @svcId, @sCount)
        `);
      console.log(`     ➕ Liên kết dịch vụ: "${sInfo.name}" x ${sInfo.count} buổi`);
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log('  🎉 ĐÃ CẬP NHẬT 10 GÓI COMBO HOÀN TOÀN CHUẨN XÁC!');
  console.log('════════════════════════════════════════\n');
  process.exit(0);
}

updateAllPackagesExact().catch(err => { console.error(err); process.exit(1); });
