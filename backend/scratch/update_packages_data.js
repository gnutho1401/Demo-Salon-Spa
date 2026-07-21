const { connectDB, sql } = require('../src/config/db');

async function updatePackages() {
  const pool = await connectDB();

  console.log('\n=== 1. TẠO DANH MỤC GÓI MỚI (NẾU CHƯA CÓ) ===');
  const packageCategories = [
    'Chăm sóc da',
    'Trị mụn',
    'Detox & Body',
    'Trẻ hóa da',
    'Tóc & Nail',
    'Massage & Thư giãn',
    'Dịch vụ Nail'
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
    } else {
      console.log(`  ⏭️ Danh mục gói "${name}" đã tồn tại`);
    }
  }

  // Get Category Map
  const catRes = await pool.request().query(`SELECT PackageCategoryId, CategoryName FROM PackageCategories`);
  const catMap = {};
  catRes.recordset.forEach(c => catMap[c.CategoryName] = c.PackageCategoryId);

  // Get Services Map to find correct IDs
  const svcRes = await pool.request().query(`SELECT ServiceId, ServiceName, Price FROM Services WHERE Status = 'AVAILABLE'`);
  const svcMap = {};
  svcRes.recordset.forEach(s => svcMap[s.ServiceName] = { id: s.ServiceId, price: Number(s.Price) });

  console.log('\n=== 2. THIẾT LẬP DỮ LIỆU GÓI MỚI ===');

  const packagesData = [
    {
      id: 1,
      name: 'Liệu trình căng bóng phục hồi chuyên sâu',
      desc: 'Liệu trình nuôi dưỡng chuyên sâu 5 buổi gồm chăm sóc da mặt cơ bản và cấy tinh chất phục hồi. Kích thích tái tạo da, mờ thâm sạm, mang lại làn da căng bóng mịn màng và tràn đầy sức sống.',
      origPrice: 250000,
      salePrice: 200000,
      sessions: 5,
      catName: 'Chăm sóc da',
      services: [
        { name: 'Chăm sóc da mặt cơ bản', count: 3 },
        { name: 'Cấy tinh chất phục hồi', count: 2 }
      ]
    },
    {
      id: 2,
      name: 'Liệu trình trị mụn chuẩn y khoa',
      desc: 'Liệu trình 8 buổi điều trị các loại mụn bọc, mụn cám, mụn ẩn kết hợp đắp mặt nạ phục hồi da. Diệt khuẩn sâu, se khít lỗ chân lông và phục hồi nền da tổn thương không để lại sẹo thâm.',
      origPrice: 430000,
      salePrice: 340000,
      sessions: 8,
      catName: 'Trị mụn',
      services: [
        { name: 'Trị mụn chuyên sâu', count: 5 },
        { name: 'Chăm sóc da mặt cơ bản', count: 3 }
      ]
    },
    {
      id: 3,
      name: 'Combo giảm béo slim body toàn diện',
      desc: 'Liệu trình giảm béo công nghệ cao 10 buổi kết hợp massage detox đào thải mỡ thừa vùng bụng. Giúp thon gọn vòng eo, săn chắc cơ bụng và thải độc tố cơ thể một cách tự nhiên khoa học.',
      origPrice: 870000,
      salePrice: 700000,
      sessions: 10,
      catName: 'Detox & Body',
      services: [
        { name: 'Giảm béo bụng', count: 5 },
        { name: 'Detox body', count: 5 }
      ]
    },
    {
      id: 4,
      name: 'Liệu trình trẻ hóa nâng cơ toàn diện',
      desc: 'Liệu trình trẻ hóa 6 buổi sử dụng công nghệ nâng cơ mặt kết hợp mặt nạ collagen tinh thể vàng 24K. Giúp làm mờ các nếp nhăn vùng mắt khóe miệng, nâng cơ chảy xệ, kéo lại thanh xuân.',
      origPrice: 410000,
      salePrice: 330000,
      sessions: 6,
      catName: 'Trẻ hóa da',
      services: [
        { name: 'Trẻ hóa da', count: 3 },
        { name: 'Đắp mặt nạ collagen vàng', count: 3 }
      ]
    },
    {
      id: 5,
      name: 'Combo làm đẹp tóc và nail toàn diện',
      desc: 'Gói làm đẹp nhanh 3 buổi kết hợp tạo mẫu tóc thời trang uốn/nhuộm và vẽ móng nghệ thuật đính đá cao cấp. Phù hợp chuẩn bị trước các dịp lễ tiệc hoặc F5 bản thân toàn diện.',
      origPrice: 125000,
      salePrice: 100000,
      sessions: 3,
      catName: 'Tóc & Nail',
      services: [
        { name: 'Cắt & tạo kiểu tóc', count: 1 },
        { name: 'Nhuộm tóc thời trang', count: 1 },
        { name: 'Vẽ nail nghệ thuật đính đá', count: 1 }
      ]
    },
    {
      id: 6,
      name: 'Gói thư giãn cuối tuần đặc biệt',
      desc: 'Liệu trình spa thư giãn 4 buổi gồm massage body tinh dầu thảo dược và chăm sóc da mặt nhẹ nhàng. Giải phóng mệt mỏi cơ bắp, thư giãn hệ thần kinh và nạp năng lượng sau tuần làm việc.',
      origPrice: 180000,
      salePrice: 140000,
      sessions: 4,
      catName: 'Massage & Thư giãn',
      services: [
        { name: 'Massage body tinh dầu thư giãn', count: 2 },
        { name: 'Chăm sóc da mặt cơ bản', count: 2 }
      ]
    },
    {
      id: 7,
      name: 'Liệu trình chăm sóc & vẽ nail art VIP',
      desc: 'Liệu trình 10 buổi chăm sóc móng chuyên sâu kết hợp vẽ nail art đính đá cao cấp và pedicure gót chân. Giúp giữ bộ móng khỏe đẹp, bền màu lâu dài và đôi bàn chân gót sen mịn màng.',
      origPrice: 310000,
      salePrice: 250000,
      sessions: 10,
      catName: 'Dịch vụ Nail',
      services: [
        { name: 'Vẽ nail nghệ thuật đính đá', count: 5 },
        { name: 'Pedicure spa cao cấp', count: 5 }
      ]
    }
  ];

  for (const pkg of packagesData) {
    console.log(`\n⚙️ Đang xử lý gói: "${pkg.name}"`);

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
        .query(`
          UPDATE Packages
          SET PackageName = @name,
              Description = @desc,
              OriginalPrice = @origPrice,
              SalePrice = @salePrice,
              TotalSessions = @sessions,
              PackageCategoryId = @catId,
              Status = 'ACTIVE'
          WHERE PackageId = @id
        `);
      console.log(`  ✅ Đã UPDATE gói ID: ${pkg.id}`);
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
        .query(`
          SET IDENTITY_INSERT Packages ON;
          INSERT INTO Packages (PackageId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, PackageCategoryId, Status, IsHot, ValidityDays)
          VALUES (@id, @name, @desc, @origPrice, @salePrice, @sessions, @catId, 'ACTIVE', 1, 180);
          SET IDENTITY_INSERT Packages OFF;
        `);
      console.log(`  ✅ Đã INSERT gói mới ID: ${pkg.id}`);
    }

    // Clean old services mapping
    await pool.request()
      .input('id', sql.Int, pkg.id)
      .query(`DELETE FROM PackageServices WHERE PackageId = @id`);

    // Insert new services mapping
    for (const sInfo of pkg.services) {
      const sData = svcMap[sInfo.name];
      if (!sData) {
        console.log(`  ❌ Không tìm thấy dịch vụ: "${sInfo.name}" trong bảng Services!`);
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
  console.log('  🎉 ĐÃ CẬP NHẬT TOÀN BỘ GÓI VÀ DỊCH VỤ THÀNH CÔNG!');
  console.log('════════════════════════════════════════\n');
  process.exit(0);
}

updatePackages().catch(err => { console.error(err); process.exit(1); });
