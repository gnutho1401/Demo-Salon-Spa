const { connectDB, sql } = require('../src/config/db');

async function updateAll() {
  const pool = await connectDB();

  // Get all current services
  const current = (await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Price, c.CategoryName
    FROM Services s LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE' ORDER BY c.CategoryName, s.ServiceId
  `)).recordset;

  console.log(`\n📋 Tìm thấy ${current.length} dịch vụ cần cập nhật\n`);

  // Map: ServiceName -> { price (new, /10), desc (improved) }
  const updates = {
    // ═══ HAIR ═══
    'Cắt & tạo kiểu tóc': {
      price: 20000,
      desc: 'Dịch vụ cắt tóc và tạo kiểu chuyên nghiệp bởi stylist giàu kinh nghiệm. Tư vấn kiểu tóc phù hợp với khuôn mặt, phong cách cá nhân. Bao gồm gội đầu, cắt tỉa và sấy tạo kiểu hoàn chỉnh.'
    },
    'Nhuộm tóc thời trang': {
      price: 70000,
      desc: 'Nhuộm tóc thời trang với đa dạng tông màu từ tự nhiên đến trendy. Sử dụng thuốc nhuộm nhập khẩu ít hóa chất, bảo vệ cấu trúc tóc. Bao gồm tư vấn màu phù hợp da, gội và dưỡng sau nhuộm.'
    },
    'Uốn tóc setting': {
      price: 85000,
      desc: 'Uốn tóc setting tạo sóng lọn tự nhiên hoặc xoăn phồng Hàn Quốc. Sử dụng thuốc uốn cao cấp bảo vệ sợi tóc, giữ nếp bền đẹp 4-6 tháng. Bao gồm gội, uốn và sấy tạo kiểu.'
    },
    'Phục hồi tóc hư tổn': {
      price: 50000,
      desc: 'Liệu trình phục hồi chuyên sâu cho tóc bị hư tổn do hóa chất, nhiệt và tia UV. Sử dụng keratin, collagen và protein phục hồi sợi tóc từ bên trong, giúp tóc mềm mượt bóng khỏe trở lại.'
    },
    'Gội đầu dưỡng sinh thảo mộc': {
      price: 90000,
      desc: 'Gội đầu kết hợp massage bấm huyệt đầu cổ vai bằng tinh dầu thảo mộc thiên nhiên. Giúp thư giãn tinh thần, kích thích tuần hoàn máu, giảm stress và nuôi dưỡng da đầu khỏe mạnh.'
    },
    'Duỗi tóc keratin cao cấp': {
      price: 120000,
      desc: 'Duỗi tóc bằng keratin nguyên chất nhập khẩu, giúp tóc thẳng mượt tự nhiên không cứng. Bảo vệ cấu trúc tóc, giữ nếp bền đẹp 4-6 tháng. Phù hợp mọi loại tóc kể cả tóc đã qua hóa chất.'
    },
    'Hấp dầu phục hồi chuyên sâu': {
      price: 35000,
      desc: 'Ủ tóc bằng tinh chất argan oil và protein lụa tơ tằm, cung cấp dưỡng chất sâu cho sợi tóc. Phục hồi tóc khô xơ, chẻ ngọn, giúp tóc suôn mượt bóng khỏe ngay sau lần đầu sử dụng.'
    },
    'Tẩy tóc & nhuộm highlight': {
      price: 100000,
      desc: 'Tẩy tóc chuyên nghiệp kết hợp nhuộm highlight nhiều tông màu thời trang. Stylist tư vấn phối màu phù hợp với tông da và phong cách. Sử dụng sản phẩm cao cấp bảo vệ tóc tối đa.'
    },

    // ═══ SKINCARE ═══
    'Chăm sóc da mặt cơ bản': {
      price: 35000,
      desc: 'Liệu trình chăm sóc da mặt cơ bản gồm tẩy trang, rửa mặt sạch sâu, tẩy tế bào chết, hút nhờn, xông hơi, lấy mụn nhẹ, đắp mặt nạ dưỡng và thoa serum. Phù hợp mọi loại da.'
    },
    'Trị mụn chuyên sâu': {
      price: 65000,
      desc: 'Phác đồ điều trị mụn chuyên sâu bởi chuyên viên da liễu. Bao gồm soi da, phân tích loại mụn, làm sạch sâu, chiếu ánh sáng sinh học diệt khuẩn và đắp mặt nạ phục hồi. Hiệu quả rõ rệt sau 3-5 buổi.'
    },
    'Trẻ hóa da': {
      price: 90000,
      desc: 'Liệu trình trẻ hóa da bằng công nghệ RF kết hợp serum chống lão hóa. Kích thích sản sinh collagen tự nhiên, nâng cơ, giảm nếp nhăn và cải thiện độ đàn hồi. Làn da săn chắc trẻ trung hơn.'
    },
    'Cấy tinh chất phục hồi': {
      price: 75000,
      desc: 'Cấy tinh chất vitamin C, hyaluronic acid và niacinamide vào da bằng công nghệ điện di không kim. Giúp da sáng mịn, cấp ẩm sâu, mờ thâm nám và phục hồi da tổn thương hiệu quả.'
    },
    'Tẩy tế bào chết toàn thân': {
      price: 85000,
      desc: 'Tẩy da chết toàn thân bằng muối khoáng biển Chết kết hợp tinh dầu thiên nhiên. Loại bỏ lớp sừng già cỗi, kích thích tái tạo tế bào mới. Da mịn màng sáng đều ngay sau liệu trình.'
    },
    'Đắp mặt nạ collagen vàng': {
      price: 48000,
      desc: 'Mặt nạ vàng 24K kết hợp collagen thủy phân cấp ẩm chuyên sâu. Nuôi dưỡng da từ bên trong, tăng cường độ đàn hồi, giúp da căng mịn rạng rỡ. Phù hợp da khô, da lão hóa sớm.'
    },
    'Điều trị nám & tàn nhang': {
      price: 85000,
      desc: 'Phác đồ điều trị nám và tàn nhang bằng ánh sáng sinh học IPL kết hợp serum vitamin C liều cao. Làm mờ đốm nám, đều màu da và ngăn ngừa tái phát. Liệu trình 5-8 buổi cho kết quả tối ưu.'
    },
    'Chăm sóc da nam giới': {
      price: 40000,
      desc: 'Liệu trình chăm sóc da chuyên biệt cho nam giới. Làm sạch sâu, kiểm soát dầu nhờn, se khít lỗ chân lông và dưỡng ẩm cân bằng. Phù hợp da dầu, da hỗn hợp thường gặp ở nam.'
    },

    // ═══ MASSAGE ═══
    'Dịch vụ test PayOS 1.000đ': {
      price: 1000,
      desc: 'Dịch vụ dùng để test cổng thanh toán PayOS. Không phải dịch vụ thực tế.'
    },
    'Massage đá nóng': {
      price: 45000,
      desc: 'Massage toàn thân bằng đá bazan nóng kết hợp tinh dầu thiên nhiên. Nhiệt từ đá nóng giúp giãn cơ sâu, giải phóng điểm đau, cải thiện tuần hoàn máu và mang lại cảm giác thư giãn tuyệt đối.'
    },
    'Massage cổ vai gáy': {
      price: 25000,
      desc: 'Massage tập trung vùng cổ, vai và gáy bằng kỹ thuật bấm huyệt truyền thống. Giảm đau nhức, cứng cổ do ngồi máy tính lâu. Phù hợp dân văn phòng và người hay bị đau vai gáy.'
    },
    'Massage body tinh dầu thư giãn': {
      price: 55000,
      desc: 'Massage toàn thân bằng tinh dầu lavender, bạc hà và sả chanh tự nhiên. Kỹ thuật Thụy Điển nhẹ nhàng giúp thư giãn cơ bắp, giảm căng thẳng, cải thiện giấc ngủ và nâng cao tinh thần.'
    },
    'Massage chân & foot spa': {
      price: 30000,
      desc: 'Ngâm chân thảo dược ấm kết hợp massage bấm huyệt lòng bàn chân theo y học cổ truyền. Giảm mỏi chân, phù nề, thải độc qua gan bàn chân. Kết thúc bằng kem dưỡng ẩm chân mềm mịn.'
    },
    'Massage lưng trị liệu': {
      price: 38000,
      desc: 'Massage chuyên sâu vùng lưng bằng kỹ thuật bấm huyệt và xoa bóp cơ sâu. Giảm đau nhức cơ lưng, giãn cột sống, phù hợp người bị đau lưng mãn tính và dân văn phòng.'
    },
    'Massage bầu thư giãn': {
      price: 45000,
      desc: 'Liệu trình massage nhẹ nhàng an toàn dành riêng cho mẹ bầu từ tháng thứ 4. Giảm đau lưng, phù chân, cải thiện giấc ngủ. Kỹ thuật viên được đào tạo chuyên biệt về chăm sóc thai kỳ.'
    },

    // ═══ NAIL ═══
    'Nail cao cấp': {
      price: 25000,
      desc: 'Dịch vụ làm nail trọn gói cao cấp bao gồm cắt dũa tạo phom móng, đẩy da, sơn gel UV màu tự chọn và dưỡng biểu bì. Sử dụng sản phẩm nhập khẩu an toàn, bền màu 2-3 tuần.'
    },
    'Sơn gel Hàn Quốc': {
      price: 18000,
      desc: 'Sơn gel nhập khẩu Hàn Quốc chính hãng với hàng trăm màu thời trang. Bền màu 3-4 tuần không bong tróc, bóng đẹp tự nhiên. Bao gồm cắt dũa tạo phom và dưỡng biểu bì.'
    },
    'Chăm sóc móng tay chân': {
      price: 22000,
      desc: 'Chăm sóc móng tay và chân toàn diện gồm ngâm nước ấm thảo dược, cắt dũa tạo phom, đẩy và cắt da thừa, đánh bóng móng tự nhiên. Kết thúc bằng kem dưỡng tay chân mềm mịn.'
    },
    'Vẽ nail nghệ thuật đính đá': {
      price: 35000,
      desc: 'Thiết kế nail art nghệ thuật theo yêu cầu: vẽ tay, đính đá pha lê, charm và phụ kiện cao cấp. Phong cách đa dạng từ nhẹ nhàng đến lộng lẫy, phù hợp cho tiệc tối và sự kiện đặc biệt.'
    },
    'Tháo gel & chăm sóc móng': {
      price: 12000,
      desc: 'Tháo lớp gel/sơn cũ an toàn không gây tổn thương nền móng. Kết hợp dưỡng ẩm và phục hồi móng bằng serum keratin chuyên dụng, giúp móng chắc khỏe trở lại sau thời gian sơn gel.'
    },
    'Pedicure spa cao cấp': {
      price: 28000,
      desc: 'Chăm sóc bàn chân toàn diện cao cấp: ngâm muối khoáng biển Chết, tẩy chai sần gót chân, cắt dũa móng chân, đẩy da và sơn gel hoàn thiện. Bàn chân sạch đẹp mềm mịn.'
    },
    'Nail dipping powder': {
      price: 30000,
      desc: 'Kỹ thuật nhúng bột nail dipping powder tạo lớp phủ mỏng nhẹ cứng cáp, không cần đèn UV. Bền màu 3-4 tuần, an toàn cho nền móng tự nhiên. Hơn 50 màu bột thời trang để lựa chọn.'
    },

    // ═══ DETOX ═══
    'Detox body': {
      price: 80000,
      desc: 'Liệu trình detox body toàn thân bằng bùn khoáng thiên nhiên kết hợp tinh dầu thải độc. Loại bỏ độc tố tích tụ trong cơ thể, cải thiện tuần hoàn, giúp da sáng khỏe và tinh thần sảng khoái.'
    },
    'Giảm béo bụng': {
      price: 95000,
      desc: 'Liệu trình giảm béo vùng bụng bằng công nghệ RF và cavitation không xâm lấn. Phá hủy tế bào mỡ cứng đầu, săn chắc vùng eo. Kết hợp massage đào thải mỡ, hiệu quả sau 5-10 buổi.'
    },
    'Xông hơi thảo dược detox': {
      price: 35000,
      desc: 'Xông hơi phòng riêng với hỗn hợp thảo dược tự nhiên: sả, chanh, gừng, ngải cứu. Thải độc qua mồ hôi, thông thoáng lỗ chân lông, tăng cường hệ miễn dịch và cải thiện hô hấp.'
    },
    'Tắm trắng phi thuyền': {
      price: 70000,
      desc: 'Tắm trắng toàn thân trong máy phi thuyền nano kết hợp dưỡng chất glutathione và vitamin C liều cao. Da trắng sáng đều màu tự nhiên, không bong tróc. Hiệu quả rõ rệt sau 3-5 buổi.'
    },

    // ═══ MAKEUP ═══
    'Trang điểm dự tiệc': {
      price: 50000,
      desc: 'Trang điểm chuyên nghiệp cho dự tiệc, sự kiện, chụp ảnh. Phong cách Hàn Quốc nhẹ nhàng hoặc Âu Mỹ sang trọng tùy yêu cầu. Sử dụng mỹ phẩm cao cấp MAC, YSL, NARS giữ lớp nền bền đẹp cả ngày.'
    },
    'Trang điểm cô dâu': {
      price: 150000,
      desc: 'Dịch vụ trang điểm cô dâu trọn gói: makeup, làm tóc và phụ kiện. Tư vấn phong cách phù hợp từ nhẹ nhàng đến lộng lẫy. Sử dụng sản phẩm chống nước, giữ lớp nền hoàn hảo suốt ngày trọng đại.'
    },

    // ═══ TRIỆT LÔNG ═══
    'Triệt lông nách công nghệ OPT': {
      price: 20000,
      desc: 'Triệt lông nách vĩnh viễn bằng công nghệ OPT thế hệ mới, không đau, không kích ứng da. An toàn cho da nhạy cảm. Cam kết giảm 95% lông sau liệu trình 5-8 buổi, kết quả lâu dài.'
    },
    'Wax lông toàn thân': {
      price: 60000,
      desc: 'Tẩy lông toàn thân bằng sáp ong tự nhiên nhập khẩu, kết hợp gel dưỡng sau wax giúp da mịn màng. Kỹ thuật viên nhẹ nhàng chuyên nghiệp, hạn chế tối đa kích ứng và lông mọc ngược.'
    },
    'Triệt lông chân công nghệ Diode': {
      price: 50000,
      desc: 'Triệt lông chân vĩnh viễn bằng công nghệ Diode Laser bước sóng 808nm. Phù hợp mọi loại da, không để lại sẹo hay thâm. Mỗi buổi chỉ 30-45 phút, hiệu quả giảm 90% sau liệu trình.'
    },
    'Triệt lông bikini': {
      price: 40000,
      desc: 'Triệt lông vùng bikini bằng công nghệ IPL chuyên dụng an toàn. Thực hiện bởi chuyên viên nữ trong phòng riêng kín đáo, đảm bảo sự thoải mái tuyệt đối cho khách hàng.'
    },

    // ═══ PHUN XĂM THẨM MỸ ═══
    'Phun chân mày tán bột': {
      price: 150000,
      desc: 'Phun chân mày kỹ thuật tán bột tạo hiệu ứng tự nhiên như trang điểm nhẹ. Sử dụng mực nhập khẩu Hàn Quốc an toàn, lên màu chuẩn, giữ được 1-2 năm. Tạo dáng mày phù hợp khuôn mặt từng khách.'
    },
    'Phun môi collagen': {
      price: 200000,
      desc: 'Phun môi baby lips collagen hồng tự nhiên, không sưng, không đau nhờ kỹ thuật vi điểm hiện đại. Sử dụng mực organic châu Âu an toàn, lên màu chuẩn đẹp ngay lần đầu, giữ màu 2-3 năm.'
    },
    'Điêu khắc chân mày sợi': {
      price: 250000,
      desc: 'Kỹ thuật điêu khắc lông mày từng sợi 6D/9D siêu tự nhiên giống như lông mày thật. Phù hợp người mày thưa, rụng hoặc muốn thay đổi dáng mày. Kết quả bền đẹp 1-2 năm.'
    },
    'Xóa xăm thẩm mỹ cũ': {
      price: 80000,
      desc: 'Xóa xăm chân mày, môi cũ hỏng bằng công nghệ laser an toàn không để sẹo. Phục hồi màu da tự nhiên sau 2-3 buổi. Phù hợp khách muốn xóa sạch để làm lại phun xăm mới đẹp hơn.'
    },

    // ═══ NỐI MI & UỐN MI ═══
    'Nối mi classic tự nhiên': {
      price: 35000,
      desc: 'Nối mi sợi tơ 1:1 classic nhẹ nhàng tự nhiên, không gây nặng mắt. Sử dụng keo nối mi y tế Hàn Quốc không gây kích ứng. Giữ được 3-4 tuần, phù hợp mọi phong cách từ đi làm đến dự tiệc.'
    },
    'Nối mi volume bông hoa': {
      price: 55000,
      desc: 'Nối mi volume bouquet 3D-6D tạo hiệu ứng mi dày bồng bềnh quyến rũ. Sợi mi siêu nhẹ không gây rụng mi thật. Phù hợp cho tiệc tối, chụp ảnh thời trang và những dịp đặc biệt.'
    },
    'Uốn mi & nhuộm mi': {
      price: 28000,
      desc: 'Uốn cong mi tự nhiên kết hợp nhuộm mi đen đậm, giúp đôi mắt to tròn quyến rũ mà không cần mascara. Sử dụng dung dịch uốn thảo dược nhẹ nhàng, giữ nếp đẹp 6-8 tuần.'
    },
    'Tháo mi nối & chăm sóc': {
      price: 10000,
      desc: 'Tháo mi nối an toàn bằng dung dịch chuyên dụng không gây rụng mi thật. Kết hợp serum dưỡng mi chiết xuất biotin giúp mi tự nhiên phục hồi chắc khỏe, dài mượt hơn sau nối.'
    },
  };

  console.log('\n=== CẬP NHẬT GIÁ & MÔ TẢ ===');
  let updated = 0;
  for (const svc of current) {
    const upd = updates[svc.ServiceName];
    if (!upd) {
      console.log(`  ⚠️ Không tìm thấy cập nhật cho: "${svc.ServiceName}"`);
      continue;
    }

    await pool.request()
      .input('id', sql.Int, svc.ServiceId)
      .input('price', sql.Decimal(10, 2), upd.price)
      .input('desc', sql.NVarChar(sql.MAX), upd.desc)
      .query(`UPDATE Services SET Price = @price, Description = @desc WHERE ServiceId = @id`);

    const oldPrice = Number(svc.Price).toLocaleString('vi-VN');
    const newPrice = Number(upd.price).toLocaleString('vi-VN');
    console.log(`  ✅ ${svc.ServiceName}: ${oldPrice}đ → ${newPrice}đ`);
    updated++;
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  ✅ Đã cập nhật ${updated}/${current.length} dịch vụ`);
  console.log(`════════════════════════════════════════\n`);

  process.exit(0);
}

updateAll().catch(err => { console.error(err); process.exit(1); });
