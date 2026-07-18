const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function enrichAll() {
  const pool = await connectDB();

  // ═══════════════════════════════════
  // 1. THÊM DANH MỤC MỚI
  // ═══════════════════════════════════
  console.log('\n=== 1. THÊM DANH MỤC ===');
  const newCats = ['Phun xăm thẩm mỹ', 'Nối mi & Uốn mi'];
  const existingCats = (await pool.request().query(`SELECT CategoryName FROM ServiceCategories`)).recordset.map(c => c.CategoryName);

  for (const name of newCats) {
    if (!existingCats.includes(name)) {
      await pool.request().input('n', sql.NVarChar, name).query(`INSERT INTO ServiceCategories (CategoryName) VALUES (@n)`);
      console.log(`  ✅ Tạo danh mục: ${name}`);
    } else {
      console.log(`  ⏭️ "${name}" đã tồn tại`);
    }
  }

  // Get all category IDs
  const cats = (await pool.request().query(`SELECT CategoryId, CategoryName FROM ServiceCategories`)).recordset;
  const catMap = {};
  cats.forEach(c => catMap[c.CategoryName] = c.CategoryId);

  // ═══════════════════════════════════
  // 2. THÊM DỊCH VỤ MỚI
  // ═══════════════════════════════════
  console.log('\n=== 2. THÊM DỊCH VỤ ===');

  const newServices = [
    // ── Phun xăm thẩm mỹ ──
    { name: 'Phun chân mày tán bột', desc: 'Phun chân mày nghệ thuật kỹ thuật tán bột tự nhiên, sử dụng mực nhập khẩu Hàn Quốc an toàn, lên màu tự nhiên giữ được 1-2 năm. Tạo dáng mày phù hợp khuôn mặt.', price: 1500000, duration: 90, cat: 'Phun xăm thẩm mỹ' },
    { name: 'Phun môi collagen', desc: 'Phun môi baby lips collagen đỏ hồng tự nhiên, không sưng, không đau, lên màu chuẩn ngay lần đầu. Sử dụng mực organic châu Âu an toàn cho da nhạy cảm.', price: 2000000, duration: 120, cat: 'Phun xăm thẩm mỹ' },
    { name: 'Điêu khắc chân mày sợi', desc: 'Kỹ thuật điêu khắc lông mày từng sợi 6D/9D siêu tự nhiên như mày thật, phù hợp cho người mày thưa hoặc muốn thay đổi dáng mày thời trang.', price: 2500000, duration: 120, cat: 'Phun xăm thẩm mỹ' },
    { name: 'Xóa xăm thẩm mỹ cũ', desc: 'Xóa xăm chân mày, môi cũ bằng laser Pico an toàn không để sẹo, phục hồi màu da tự nhiên. Phù hợp cho khách muốn làm lại phun xăm mới.', price: 800000, duration: 60, cat: 'Phun xăm thẩm mỹ' },

    // ── Nối mi & Uốn mi ──
    { name: 'Nối mi classic tự nhiên', desc: 'Nối mi sợi tơ 1:1 classic nhẹ nhàng tự nhiên, không gây nặng mắt. Sử dụng keo nối mi y tế Hàn Quốc, giữ được 3-4 tuần.', price: 350000, duration: 75, cat: 'Nối mi & Uốn mi' },
    { name: 'Nối mi volume bông hoa', desc: 'Nối mi volume bouquet 3D-6D tạo hiệu ứng mi dày bồng bềnh quyến rũ, phù hợp cho các buổi tiệc tối và chụp ảnh thời trang.', price: 550000, duration: 90, cat: 'Nối mi & Uốn mi' },
    { name: 'Uốn mi & nhuộm mi', desc: 'Uốn cong mi tự nhiên bằng keo thảo dược kết hợp nhuộm mi đen đậm, giúp đôi mắt to tròn long lanh mà không cần mascara. Giữ nếp 6-8 tuần.', price: 280000, duration: 50, cat: 'Nối mi & Uốn mi' },
    { name: 'Tháo mi nối & chăm sóc', desc: 'Tháo mi nối an toàn bằng dung dịch chuyên dụng, kết hợp serum dưỡng mi giúp mi thật phục hồi chắc khỏe sau nối.', price: 100000, duration: 30, cat: 'Nối mi & Uốn mi' },

    // ── Bổ sung Massage ──
    { name: 'Massage bầu thư giãn', desc: 'Liệu trình massage nhẹ nhàng dành riêng cho mẹ bầu từ tháng thứ 4, giúp giảm đau lưng, phù chân và cải thiện giấc ngủ. Kỹ thuật viên được đào tạo chuyên biệt.', price: 450000, duration: 60, cat: 'Massage' },

    // ── Bổ sung Detox ──
    { name: 'Tắm trắng phi thuyền', desc: 'Tắm trắng toàn thân trong phi thuyền nano kết hợp tinh chất glutathione và vitamin C liều cao, giúp da trắng sáng đều màu sau 1-3 buổi.', price: 700000, duration: 75, cat: 'Detox' },

    // ── Bổ sung Triệt lông ──
    { name: 'Triệt lông chân công nghệ Diode', desc: 'Triệt lông chân vĩnh viễn bằng công nghệ Diode Laser thế hệ mới, không đau, an toàn cho mọi loại da. Hiệu quả giảm 90% sau liệu trình.', price: 500000, duration: 45, cat: 'Triệt lông' },
    { name: 'Triệt lông bikini', desc: 'Triệt lông vùng bikini bằng công nghệ IPL chuyên dụng, thực hiện bởi chuyên viên nữ trong phòng riêng kín đáo, đảm bảo thoải mái và an toàn.', price: 400000, duration: 40, cat: 'Triệt lông' },

    // ── Bổ sung Hair ──
    { name: 'Tẩy tóc & nhuộm highlight', desc: 'Tẩy tóc chuyên nghiệp kết hợp nhuộm highlight nhiều tông màu thời trang theo xu hướng K-pop, sử dụng thuốc nhuộm Goldwell bảo vệ tóc.', price: 1000000, duration: 180, cat: 'Hair' },

    // ── Bổ sung Skincare ──
    { name: 'Chăm sóc da nam giới', desc: 'Liệu trình chăm sóc da chuyên biệt cho nam giới: làm sạch sâu, hút nhờn, se khít lỗ chân lông và dưỡng ẩm. Phù hợp da dầu và da hỗn hợp nam.', price: 400000, duration: 60, cat: 'Skincare' },

    // ── Bổ sung Nail ──
    { name: 'Nail dipping powder', desc: 'Kỹ thuật nhúng bột nail dipping powder không cần đèn UV, lớp phủ mỏng nhẹ bền màu 3-4 tuần, an toàn cho nền móng tự nhiên.', price: 300000, duration: 55, cat: 'Nail' },
  ];

  let addedSvc = 0;
  for (const svc of newServices) {
    const exists = (await pool.request().input('n', sql.NVarChar, svc.name).query(`SELECT COUNT(*) as c FROM Services WHERE ServiceName = @n`)).recordset[0].c;
    if (exists > 0) { console.log(`  ⏭️ "${svc.name}" đã tồn tại`); continue; }

    await pool.request()
      .input('name', sql.NVarChar, svc.name)
      .input('desc', sql.NVarChar, svc.desc)
      .input('price', sql.Decimal(10, 2), svc.price)
      .input('dur', sql.Int, svc.duration)
      .input('cat', sql.Int, catMap[svc.cat])
      .input('st', sql.NVarChar, 'AVAILABLE')
      .query(`INSERT INTO Services (ServiceName, Description, Price, DurationMinutes, CategoryId, Status) VALUES (@name, @desc, @price, @dur, @cat, @st)`);
    console.log(`  ✅ ${svc.name} (${svc.cat}) — ${svc.price.toLocaleString('vi-VN')}đ`);
    addedSvc++;
  }

  // ═══════════════════════════════════
  // 3. THÊM KỸ THUẬT VIÊN MỚI
  // ═══════════════════════════════════
  console.log('\n=== 3. THÊM KỸ THUẬT VIÊN ===');
  const passwordHash = await bcrypt.hash('Luna@2026', 10);

  const newEmps = [
    {
      fullName: 'Ngọc Diệp',
      email: 'ngocdiep@lunaspa.com',
      phone: '0905222301',
      position: 'Chuyên viên Phun xăm thẩm mỹ',
      specialization: 'Phun chân mày, Phun môi, Điêu khắc',
      years: 7,
      bio: 'Master phun xăm thẩm mỹ với chứng chỉ quốc tế PMU Academy Korea, hơn 7 năm kinh nghiệm và hàng nghìn ca phun xăm thành công.'
    },
    {
      fullName: 'Thanh Trúc',
      email: 'thanhtruc@lunaspa.com',
      phone: '0905222302',
      position: 'Chuyên viên Nối mi',
      specialization: 'Nối mi Classic, Volume, Mega Volume',
      years: 4,
      bio: 'Lash artist chuyên nghiệp với kỹ thuật nối mi volume bouquet tinh xảo, từng tham gia các cuộc thi nối mi quốc tế và đạt giải cao.'
    },
    {
      fullName: 'Bích Ngọc',
      email: 'bichngoc@lunaspa.com',
      phone: '0905222303',
      position: 'Chuyên viên Massage & Bầu',
      specialization: 'Massage, Prenatal Care',
      years: 5,
      bio: 'Chuyên viên massage được đào tạo chuyên biệt về chăm sóc bà bầu và trị liệu cơ thể, sở hữu chứng chỉ Prenatal Massage Therapy quốc tế.'
    },
    {
      fullName: 'Hoài An',
      email: 'hoaian@lunaspa.com',
      phone: '0905222304',
      position: 'Chuyên viên Tắm trắng & Detox',
      specialization: 'Body Whitening, Detox, Slimming',
      years: 3,
      bio: 'Chuyên viên tắm trắng phi thuyền và detox body chuyên sâu, am hiểu về các công nghệ làm đẹp body hiện đại nhất.'
    },
  ];

  let addedEmp = 0;
  for (const emp of newEmps) {
    const exists = (await pool.request().input('e', sql.NVarChar, emp.email).query(`SELECT COUNT(*) as c FROM Users WHERE Email = @e`)).recordset[0].c;
    if (exists > 0) { console.log(`  ⏭️ "${emp.fullName}" đã tồn tại`); continue; }

    const userRes = await pool.request()
      .input('fn', sql.NVarChar, emp.fullName)
      .input('em', sql.NVarChar, emp.email)
      .input('ph', sql.NVarChar, emp.phone)
      .input('pw', sql.NVarChar, passwordHash)
      .input('ri', sql.Int, 4)
      .query(`INSERT INTO Users (FullName, Email, Phone, PasswordHash, IsVerified, RoleId) OUTPUT INSERTED.UserId VALUES (@fn, @em, @ph, @pw, 1, @ri)`);
    
    const userId = userRes.recordset[0].UserId;

    await pool.request()
      .input('uid', sql.Int, userId)
      .input('bid', sql.Int, 1)
      .input('pos', sql.NVarChar, emp.position)
      .input('spec', sql.NVarChar, emp.specialization)
      .input('yrs', sql.Int, emp.years)
      .input('bio', sql.NVarChar, emp.bio)
      .input('st', sql.NVarChar, 'ACTIVE')
      .query(`INSERT INTO Employees (UserId, BranchId, Position, Specialization, YearsOfExperience, Bio, Status) VALUES (@uid, @bid, @pos, @spec, @yrs, @bio, @st)`);

    console.log(`  ✅ ${emp.fullName} — ${emp.position} (${emp.specialization}) — ${emp.years} năm`);
    addedEmp++;
  }

  // ═══════════════════════════════════
  // 4. TỔNG KẾT
  // ═══════════════════════════════════
  const svcSummary = (await pool.request().query(`
    SELECT c.CategoryName, COUNT(*) as Cnt
    FROM Services s LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    GROUP BY c.CategoryName ORDER BY c.CategoryName
  `)).recordset;

  const empSummary = (await pool.request().query(`
    SELECT COUNT(*) as cnt FROM Employees e JOIN Users u ON e.UserId = u.UserId
    WHERE e.Status = 'ACTIVE' AND u.RoleId = 4
  `)).recordset[0].cnt;

  console.log('\n════════════════════════════════════════');
  console.log(`  📋 DỊCH VỤ (thêm ${addedSvc} mới)`);
  console.log('════════════════════════════════════════');
  let totalSvc = 0;
  svcSummary.forEach(r => { console.log(`  📂 ${r.CategoryName}: ${r.Cnt} dịch vụ`); totalSvc += r.Cnt; });
  console.log(`  ──────────────────────`);
  console.log(`  🏷️  TỔNG: ${totalSvc} dịch vụ`);

  console.log('\n════════════════════════════════════════');
  console.log(`  👩‍🔧 KỸ THUẬT VIÊN (thêm ${addedEmp} mới)`);
  console.log('════════════════════════════════════════');
  console.log(`  🏷️  TỔNG: ${empSummary} kỹ thuật viên`);
  console.log('════════════════════════════════════════\n');

  process.exit(0);
}

enrichAll().catch(err => { console.error(err); process.exit(1); });
