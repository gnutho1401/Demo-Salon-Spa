const { connectDB, sql } = require('../src/config/db');

async function addServices() {
  const pool = await connectDB();

  // 1. Add new categories: Makeup, Triệt lông
  console.log('\n=== THÊM DANH MỤC MỚI ===');
  
  const existingCats = await pool.request().query(`SELECT CategoryName FROM ServiceCategories`);
  const catNames = existingCats.recordset.map(c => c.CategoryName);
  
  const newCats = ['Makeup', 'Triệt lông'];
  for (const name of newCats) {
    if (!catNames.includes(name)) {
      await pool.request()
        .input('name', sql.NVarChar, name)
        .query(`INSERT INTO ServiceCategories (CategoryName) VALUES (@name)`);
      console.log(`  ✅ Đã tạo danh mục: ${name}`);
    } else {
      console.log(`  ⏭️ Danh mục "${name}" đã tồn tại`);
    }
  }

  // Get all category IDs
  const cats = await pool.request().query(`SELECT CategoryId, CategoryName FROM ServiceCategories`);
  const catMap = {};
  cats.recordset.forEach(c => catMap[c.CategoryName] = c.CategoryId);

  // 2. New services to add
  const newServices = [
    // Massage (thêm 3)
    { name: 'Massage body tinh dầu thư giãn', desc: 'Liệu trình massage toàn thân bằng tinh dầu lavender và bạc hà tự nhiên, kết hợp kỹ thuật Thụy Điển giúp giải phóng cơ bắp và thư giãn tinh thần sâu.', price: 550000, duration: 90, cat: 'Massage' },
    { name: 'Massage chân & foot spa', desc: 'Ngâm chân thảo dược ấm kết hợp massage bấm huyệt lòng bàn chân, giúp thải độc, giảm sưng phù và cải thiện tuần hoàn máu hiệu quả.', price: 300000, duration: 60, cat: 'Massage' },
    { name: 'Massage lưng trị liệu', desc: 'Massage chuyên sâu vùng lưng bằng kỹ thuật bấm huyệt y học cổ truyền kết hợp đá nóng bazan, giảm đau nhức cơ lưng và xương khớp.', price: 380000, duration: 55, cat: 'Massage' },

    // Nail (thêm 3)
    { name: 'Vẽ nail nghệ thuật đính đá', desc: 'Dịch vụ vẽ nail thiết kế đính đá pha lê Swarovski và charm cao cấp theo xu hướng K-beauty, phù hợp dự tiệc và sự kiện đặc biệt.', price: 350000, duration: 75, cat: 'Nail' },
    { name: 'Tháo gel & chăm sóc móng', desc: 'Tháo gel an toàn không gây hại móng, kết hợp dưỡng ẩm và phục hồi nền móng bằng serum keratin chuyên dụng.', price: 120000, duration: 30, cat: 'Nail' },
    { name: 'Pedicure spa cao cấp', desc: 'Chăm sóc bàn chân toàn diện bao gồm cắt da, dũa móng, ngâm muối khoáng biển Chết, tẩy chai sần và sơn gel hoàn thiện.', price: 280000, duration: 60, cat: 'Nail' },

    // Skincare (thêm 2)
    { name: 'Đắp mặt nạ collagen vàng', desc: 'Mặt nạ vàng 24K kết hợp collagen thủy phân tự nhiên giúp tái tạo tế bào, nâng cơ và cải thiện độ đàn hồi cho làn da rạng rỡ.', price: 480000, duration: 50, cat: 'Skincare' },
    { name: 'Điều trị nám & tàn nhang', desc: 'Phác đồ điều trị nám chuyên sâu sử dụng công nghệ ánh sáng sinh học kết hợp serum vitamin C liều cao, giúp làm mờ sạm nám và đều màu da.', price: 850000, duration: 75, cat: 'Skincare' },

    // Hair (thêm 2)
    { name: 'Duỗi tóc keratin cao cấp', desc: 'Duỗi tóc bằng keratin nguyên chất nhập khẩu từ Brazil, giúp tóc thẳng mượt tự nhiên, bóng khỏe và giữ nếp lâu dài đến 6 tháng.', price: 1200000, duration: 180, cat: 'Hair' },
    { name: 'Hấp dầu phục hồi chuyên sâu', desc: 'Ủ tóc bằng tinh chất argan oil và protein lụa, phục hồi tóc khô xơ, gãy rụng sau hóa chất, giúp tóc chắc khỏe và bóng mượt.', price: 350000, duration: 60, cat: 'Hair' },

    // Detox (thêm 1)
    { name: 'Xông hơi thảo dược detox', desc: 'Xông hơi phòng riêng với thảo dược tự nhiên (sả, chanh, gừng, ngải cứu), giúp thải độc qua mồ hôi, thông thoáng lỗ chân lông và tăng cường miễn dịch.', price: 350000, duration: 45, cat: 'Detox' },

    // Makeup (mới - 2)
    { name: 'Trang điểm dự tiệc', desc: 'Trang điểm chuyên nghiệp phong cách Hàn Quốc hoặc Tây Âu sang trọng, phù hợp cho các buổi tiệc, sự kiện và chụp ảnh. Sử dụng mỹ phẩm cao cấp MAC, YSL.', price: 500000, duration: 60, cat: 'Makeup' },
    { name: 'Trang điểm cô dâu', desc: 'Dịch vụ trang điểm cô dâu trọn gói bao gồm makeup, làm tóc và phụ kiện. Phong cách nhẹ nhàng tự nhiên hoặc sang trọng lộng lẫy theo yêu cầu.', price: 1500000, duration: 120, cat: 'Makeup' },

    // Triệt lông (mới - 2)
    { name: 'Triệt lông nách công nghệ OPT', desc: 'Triệt lông nách vĩnh viễn bằng công nghệ OPT không đau, không kích ứng da. Cam kết giảm 95% lông sau liệu trình 5-8 buổi.', price: 200000, duration: 30, cat: 'Triệt lông' },
    { name: 'Wax lông toàn thân', desc: 'Tẩy lông toàn thân bằng sáp ong tự nhiên kết hợp gel dưỡng sau wax giúp da mịn màng, hạn chế kích ứng và mọc lại chậm.', price: 600000, duration: 90, cat: 'Triệt lông' },
  ];

  console.log('\n=== THÊM DỊCH VỤ MỚI ===');
  let added = 0;
  for (const svc of newServices) {
    // Check if name already exists
    const exists = await pool.request()
      .input('name', sql.NVarChar, svc.name)
      .query(`SELECT COUNT(*) as cnt FROM Services WHERE ServiceName = @name`);
    
    if (exists.recordset[0].cnt > 0) {
      console.log(`  ⏭️ "${svc.name}" đã tồn tại, bỏ qua`);
      continue;
    }

    await pool.request()
      .input('name', sql.NVarChar, svc.name)
      .input('desc', sql.NVarChar, svc.desc)
      .input('price', sql.Decimal(10, 2), svc.price)
      .input('duration', sql.Int, svc.duration)
      .input('catId', sql.Int, catMap[svc.cat])
      .input('status', sql.NVarChar, 'AVAILABLE')
      .query(`
        INSERT INTO Services (ServiceName, Description, Price, DurationMinutes, CategoryId, Status)
        VALUES (@name, @desc, @price, @duration, @catId, @status)
      `);
    console.log(`  ✅ Đã thêm: ${svc.name} (${svc.cat}) — ${svc.price.toLocaleString('vi-VN')}đ`);
    added++;
  }

  // Final summary
  const total = await pool.request().query(`
    SELECT c.CategoryName, COUNT(*) as Cnt
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    GROUP BY c.CategoryName
    ORDER BY c.CategoryName
  `);
  
  console.log(`\n=== TỔNG KẾT (đã thêm ${added} dịch vụ) ===`);
  let totalCount = 0;
  total.recordset.forEach(r => {
    console.log(`  📂 ${r.CategoryName}: ${r.Cnt} dịch vụ`);
    totalCount += r.Cnt;
  });
  console.log(`  ─────────────────────`);
  console.log(`  🏷️  TỔNG: ${totalCount} dịch vụ`);

  process.exit(0);
}

addServices().catch(err => { console.error(err); process.exit(1); });
