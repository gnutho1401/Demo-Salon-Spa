const { sql, connectDB } = require('../../config/db');
const { generateContent } = require('../../config/gemini');

async function getCustomerByUserId(pool, userId) {
  const result = await pool.request().input('UserId', sql.Int, userId).query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  return result.recordset[0];
}

async function getAll() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT ar.*, s.ServiceName, s.Price, s.DurationMinutes
    FROM AIRecommendations ar
    LEFT JOIN Services s ON ar.ServiceId = s.ServiceId
    ORDER BY ar.CreatedAt DESC
  `);
  return result.recordset;
}

async function getMine(userId) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) return [];

  let result = await pool.request().input('CustomerId', sql.Int, customer.CustomerId).query(`
    SELECT TOP 8
      ar.RecommendationId, ar.RecommendationType, ar.Reason, ar.CreatedAt,
      s.ServiceId, s.ServiceName, s.Description, s.DurationMinutes, s.Price, s.ImageUrl
    FROM AIRecommendations ar
    LEFT JOIN Services s ON ar.ServiceId = s.ServiceId
    WHERE ar.CustomerId = @CustomerId OR ar.CustomerId IS NULL
    ORDER BY ar.CreatedAt DESC
  `);

  if (result.recordset.length === 0) {
    result = await pool.request().query(`
      SELECT TOP 4
        NULL AS RecommendationId,
        N'SERVICE_SUGGESTION' AS RecommendationType,
        N'Dịch vụ nổi bật phù hợp cho khách hàng mới.' AS Reason,
        GETDATE() AS CreatedAt,
        s.ServiceId, s.ServiceName, s.Description, s.DurationMinutes, s.Price, s.ImageUrl
      FROM Services s
      WHERE s.Status = 'AVAILABLE'
      ORDER BY s.ServiceId ASC
    `);
  }

  return result.recordset;
}

/**
 * Lấy context từ database để cung cấp cho Gemini
 */
async function buildSalonContext(pool, userId) {
  // 1. Lấy danh sách dịch vụ
  const servicesResult = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Description, s.DurationMinutes, s.Price, s.Status, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY c.CategoryName, s.ServiceName
  `);

  // 1.5. Lấy danh sách kỹ thuật viên đang hoạt động
  const employeesResult = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization, e.YearsOfExperience,
           ISNULL(r.AverageRating, 0) AS AverageRating
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    OUTER APPLY (
      SELECT CAST(AVG(CAST(TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
      FROM Reviews rv
      WHERE rv.EmployeeId = e.EmployeeId AND rv.Status = 'APPROVED'
    ) r
    WHERE e.Status = 'ACTIVE'
  `);

  // 1.6. Lấy ca trực của kỹ thuật viên trong 3 ngày tới
  const shiftsResult = await pool.request().query(`
    SELECT EmployeeId, 
           CONVERT(VARCHAR(10), ShiftDate, 120) AS ShiftDate,
           CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
           CONVERT(VARCHAR(5), EndTime, 108) AS EndTime
    FROM WorkShifts
    WHERE ShiftDate >= CAST(GETDATE() AS DATE)
      AND ShiftDate <= DATEADD(day, 2, GETDATE())
      AND IsDayOff = 0
    ORDER BY ShiftDate ASC, StartTime ASC
  `);

  // 1.7. Lấy danh sách chi nhánh của salon
  const branchesResult = await pool.request().query(`
    SELECT BranchId, BranchName, Address, Phone
    FROM Branches
  `);

  // 2. Lấy lịch sử appointment của khách (nếu có)
  let customerHistory = [];
  const customer = await getCustomerByUserId(pool, userId);
  if (customer) {
    const historyResult = await pool.request()
      .input('CustomerId', sql.Int, customer.CustomerId)
      .query(`
        SELECT TOP 10
          s.ServiceName, a.AppointmentDate, a.Status, a.Notes
        FROM Appointments a
        LEFT JOIN AppointmentServices ads ON a.AppointmentId = ads.AppointmentId
        LEFT JOIN Services s ON ads.ServiceId = s.ServiceId
        WHERE a.CustomerId = @CustomerId
        ORDER BY a.AppointmentDate DESC
      `);
    customerHistory = historyResult.recordset;
  }

  // 3. Lấy chat history gần nhất để tạo context
  const chatHistoryResult = await pool.request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT TOP 6 Question, Answer
      FROM AIChatLogs
      WHERE UserId = @UserId
      ORDER BY CreatedAt DESC
    `);
  const recentChats = chatHistoryResult.recordset.reverse();

  // Build context string
  const servicesList = servicesResult.recordset.map(s =>
    `- [ID: ${s.ServiceId}] ${s.ServiceName} (${s.CategoryName || 'Chung'}): ${s.Price?.toLocaleString('vi-VN')}đ, ${s.DurationMinutes} phút${s.Description ? ' - ' + s.Description : ''}`
  ).join('\n');

  const historyText = customerHistory.length > 0
    ? customerHistory.map(h => `- ${h.ServiceName} (${new Date(h.AppointmentDate).toLocaleDateString('vi-VN')}) - ${h.Status}`).join('\n')
    : 'Chưa có lịch sử sử dụng dịch vụ.';

  const chatContext = recentChats.length > 0
    ? recentChats.map(c => `Khách: ${c.Question}\nAI: ${c.Answer}`).join('\n')
    : '';

  // Map shifts to employees
  const employeeShiftsMap = {};
  shiftsResult.recordset.forEach(s => {
    if (!employeeShiftsMap[s.EmployeeId]) {
      employeeShiftsMap[s.EmployeeId] = [];
    }
    employeeShiftsMap[s.EmployeeId].push(`${s.ShiftDate} (${s.StartTime}-${s.EndTime})`);
  });

  const techniciansList = employeesResult.recordset.map(e => {
    const shifts = employeeShiftsMap[e.EmployeeId] || [];
    const shiftsStr = shifts.length > 0 ? shifts.join(', ') : 'Không có ca làm việc';
    return `- [Stylist ID: ${e.EmployeeId}] ${e.FullName} (${e.Position || 'Kỹ thuật viên'}): Chuyên môn: ${e.Specialization || 'Chăm sóc chung'}, ${e.YearsOfExperience} năm kinh nghiệm, Đánh giá: ${e.AverageRating}/5. Lịch trực 3 ngày tới: ${shiftsStr}`;
  }).join('\n');

  const branchesList = branchesResult.recordset.map(b =>
    `- Chi nhánh ${b.BranchName}: Địa chỉ: ${b.Address || 'Chưa cập nhật'}, Điện thoại: ${b.Phone || 'Chưa cập nhật'}`
  ).join('\n');

  return { servicesList, techniciansList, branchesList, historyText, chatContext };
}

/**
 * Chat với Gemini AI - thay thế hệ thống if-else cũ
 */
async function chat(userId, question) {
  const pool = await connectDB();
  const text = String(question || '').trim();
  if (!text) throw new Error('Vui lòng nhập câu hỏi');

  let answer;

  try {
    // Lấy context từ database
    const { servicesList, techniciansList, branchesList, historyText, chatContext } = await buildSalonContext(pool, userId);
    const todayStr = new Date().toISOString().split('T')[0];

    // Tạo system prompt
    const systemPrompt = `Bạn là trợ lý AI thông minh của **Beauty Salon** - một salon làm đẹp chuyên nghiệp.
(Hôm nay là ngày: ${todayStr})

## Vai trò:
- Tư vấn dịch vụ làm đẹp phù hợp cho khách hàng
- Trả lời các câu hỏi về giá cả, thời lượng, dịch vụ, ca trực, giờ trống của kỹ thuật viên/stylist, địa chỉ chi nhánh.
- Hỗ trợ khách hàng xem lịch hẹn, hủy lịch hẹn, xem voucher, xem lịch sử dịch vụ hoặc chọn giờ trống đặt lịch trực tiếp ngay trong khung chat này.
- Đề xuất combo/gói dịch vụ phù hợp

## Quy tắc:
1. LUÔN trả lời bằng **tiếng Việt**, thân thiện, chuyên nghiệp
2. Trả lời ngắn gọn, dễ hiểu (tối đa 3-4 câu cho câu hỏi đơn giản)
3. Khi gợi ý dịch vụ, LUÔN đề cập giá và thời lượng
4. Nếu khách hỏi ngoài phạm vi salon → nhẹ nhàng chuyển hướng về dịch vụ
5. Sử dụng emoji phù hợp để tạo cảm giác thân thiện
6. KHÔNG tự bịa dịch vụ hoặc giá không có trong danh sách
7. Nếu khách muốn đặt lịch thông thường → hướng dẫn vào trang "Đặt lịch hẹn" trên menu
8. Khi tư vấn hoặc giới thiệu dịch vụ cụ thể có sẵn trong danh sách dịch vụ, hãy LUÔN chèn thêm một liên kết đặt lịch có định dạng chính xác là: [Đặt lịch: Tên dịch vụ | ID] (ví dụ: nếu dịch vụ có [ID: 3] là "Cắt tóc nam", hãy viết: "[Đặt lịch: Cắt tóc nam | 3]"). KHÔNG tự bịa ID, hãy lấy đúng ID tương ứng của dịch vụ từ danh sách dịch vụ được cung cấp bên dưới.
9. Khi giới thiệu kỹ thuật viên/stylist cho một dịch vụ cụ thể, bạn có thể tạo một nút đặt lịch kết hợp cả dịch vụ và stylist bằng định dạng chính xác là: [Đặt lịch: Tên dịch vụ | ID | Stylist: Tên stylist | StylistID] (ví dụ: nếu dịch vụ có [ID: 3] và stylist "Nguyễn Văn A" có [Stylist ID: 2], hãy viết: "[Đặt lịch: Cắt tóc nam | 3 | Stylist: Nguyễn Văn A | 2]").
10. Tích hợp tiện ích tương tác trực tiếp (WIDGET) trong khung chat:
- Khi khách hàng muốn xem danh sách lịch hẹn sắp tới hoặc hủy lịch (ví dụ: "lịch hẹn của tôi", "tôi đã đặt lịch nào", "xem lịch hẹn", "hủy lịch"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:MY_APPOINTMENTS]]
- Khi khách hàng muốn xem danh sách voucher ưu đãi của họ (ví dụ: "tôi có voucher nào không", "xem voucher của tôi", "mã giảm giá"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:MY_VOUCHERS]]
- Khi khách hàng muốn đặt lịch trực tiếp, hỏi giờ trống hoặc có ý định đặt hẹn cho một dịch vụ cụ thể (ví dụ: "đặt lịch uốn tóc", "tìm giờ trống làm nail ngày mai", "tôi muốn đặt lịch gội đầu", "có giờ trống nào cho nhuộm tóc không"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SLOTS|ServiceID|StylistID|YYYY-MM-DD]] (ví dụ: nếu đặt Uốn tóc ID: 9 với stylist ID: 9 vào ngày 2026-06-21, hãy chèn: [[WIDGET:SLOTS|9|9|2026-06-21]]). Phải chuyển đổi các cụm từ chỉ ngày (như "ngày mai", "hôm nay", "thứ hai tới") thành định dạng YYYY-MM-DD dựa trên ngày hôm nay là ${todayStr}. Nếu khách chưa chọn stylist, hãy để trống StylistID (ví dụ: [[WIDGET:SLOTS|9||2026-06-21]] hoặc [[WIDGET:SLOTS|9||]]). Nếu khách chưa chọn ngày, hãy để trống ngày (ví dụ: [[WIDGET:SLOTS|9|9|]] hoặc [[WIDGET:SLOTS|9||]]). LUÔN chèn widget này ngay khi khách nhắc tới ý định đặt lịch làm dịch vụ để khách có thể thao tác chọn nhanh chóng và trực tiếp.
- Khi khách hàng muốn xem lịch sử sử dụng dịch vụ hoặc các dịch vụ đã từng làm trước đây (ví dụ: "lịch sử dịch vụ", "tôi đã từng làm dịch vụ nào", "xem lịch sử làm đẹp"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SERVICE_HISTORY]]

## Danh sách dịch vụ hiện có:
${servicesList}

## Danh sách kỹ thuật viên/stylist hiện có và lịch trực của họ:
${techniciansList}

## Danh sách chi nhánh của salon:
${branchesList}

## Lịch sử sử dụng dịch vụ của khách hàng này:
${historyText}

## Hướng dẫn hệ thống & Chính sách của Salon:
- Đặt lịch: Khách hàng có thể đặt lịch nhanh qua WIDGET:SLOTS ngay trong chat hoặc truy cập trang "Đặt lịch hẹn" trên menu.
- Xem lịch hẹn: Khách hàng có thể xem tại WIDGET:MY_APPOINTMENTS hoặc vào trang "Lịch hẹn của tôi" trên menu.
- Đổi/Hủy lịch: Chỉ được thực hiện đổi hoặc hủy lịch hẹn TRƯỚC giờ hẹn ít nhất 2 tiếng. Không hỗ trợ đổi/hủy lịch hẹn sát giờ dưới 2 tiếng.
- Thanh toán: Hỗ trợ thanh toán online an toàn qua VNPay và PayOS (chuyển khoản ngân hàng trực tiếp).
- Hoàn tiền: Nếu khách hàng hủy lịch hẹn đã thanh toán TRƯỚC ít nhất 2 tiếng so với giờ hẹn, hệ thống sẽ tự động hoàn trả 100% tiền thanh toán cho khách hàng qua cổng thanh toán tương ứng. Hủy sát giờ dưới 2 tiếng không được hoàn tiền.
- Xem voucher: Khách có thể xem voucher tại WIDGET:MY_VOUCHERS hoặc trang Vouchers.
- Xem lịch sử: Khách có thể xem tại WIDGET:SERVICE_HISTORY hoặc trang lịch sử.`;

    // Thêm chat context nếu có
    let fullQuestion = text;
    if (chatContext) {
      fullQuestion = `[Lịch sử chat gần đây]\n${chatContext}\n\n[Câu hỏi hiện tại]\n${text}`;
    }

    // Gọi Gemini API
    answer = await generateContent(systemPrompt, fullQuestion);

  } catch (err) {
    console.error('Gemini API error:', err.message);
    // Fallback nếu Gemini lỗi
    answer = await getFallbackAnswer(pool, userId, text);
  }

  // Lưu vào database
  const saved = await pool.request()
    .input('UserId', sql.Int, userId)
    .input('Question', sql.NVarChar, text)
    .input('Answer', sql.NVarChar, answer)
    .query(`
      INSERT INTO AIChatLogs (UserId, Question, Answer)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Question, @Answer)
    `);

  return saved.recordset[0];
}

/**
 * Fallback khi Gemini API lỗi - tìm kiếm dịch vụ trong DB và sinh widget tương ứng
 */
async function getFallbackAnswer(pool, userId, text) {
  const lower = text.toLowerCase();

  // 1. Voucher/Khuyến mãi
  if (lower.includes('voucher') || lower.includes('mã giảm') || lower.includes('khuyến mãi') || lower.includes('discount')) {
    return '🎁 Dưới đây là danh sách các voucher ưu đãi hiện tại của bạn. Nhấp vào mã để sao chép:\n\n[[WIDGET:MY_VOUCHERS]]';
  }

  // 2. Lịch sử dịch vụ
  if (lower.includes('lịch sử') || lower.includes('dịch vụ đã làm') || lower.includes('đã sử dụng') || lower.includes('từng làm')) {
    return '📜 Dưới đây là lịch sử các dịch vụ làm đẹp bạn đã thực hiện tại salon của chúng tôi:\n\n[[WIDGET:SERVICE_HISTORY]]';
  }

  // 3. Danh sách lịch hẹn / Hủy / Đổi lịch
  if (lower.includes('lịch hẹn') || lower.includes('đã đặt') || lower.includes('hủy lịch') || lower.includes('đổi lịch') || lower.includes('lịch của tôi')) {
    return '📅 Dưới đây là các lịch hẹn sắp tới của bạn. Bạn có thể thay đổi thời gian (đổi lịch trực tiếp) hoặc hủy lịch hẹn ngay tại đây:\n\n[[WIDGET:MY_APPOINTMENTS]]';
  }

  // 4. Đặt lịch / Giờ trống
  if (lower.includes('đặt') || lower.includes('giờ trống') || lower.includes('lịch') || lower.includes('slot') || lower.includes('booking') || lower.includes('làm')) {
    try {
      // Tìm dịch vụ phù hợp trong DB
      const servicesResult = await pool.request().query("SELECT ServiceId, ServiceName FROM Services WHERE Status = 'AVAILABLE'");
      const services = servicesResult.recordset;
      
      // Tìm xem tên dịch vụ nào xuất hiện trong câu hỏi
      let matchedService = null;
      for (const s of services) {
        const nameLower = s.ServiceName.toLowerCase();
        if (lower.includes(nameLower) || nameLower.includes(lower.replace(/(đặt lịch|đặt|giờ trống|lịch|slot|booking)/g, '').trim())) {
          matchedService = s;
          break;
        }
      }
      
      // Nếu không khớp trực tiếp, thử tìm từ khóa thông thường
      if (!matchedService) {
        if (lower.includes('tóc') || lower.includes('cắt') || lower.includes('uốn') || lower.includes('nhuộm') || lower.includes('gội')) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('tóc') || s.ServiceName.toLowerCase().includes('cắt') || s.ServiceName.toLowerCase().includes('uốn') || s.ServiceName.toLowerCase().includes('gội'));
        } else if (lower.includes('nail') || lower.includes('móng') || lower.includes('sơn')) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('nail') || s.ServiceName.toLowerCase().includes('móng') || s.ServiceName.toLowerCase().includes('sơn'));
        } else if (lower.includes('massage') || lower.includes('spa') || lower.includes('body')) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('massage') || s.ServiceName.toLowerCase().includes('spa') || s.ServiceName.toLowerCase().includes('body'));
        } else if (lower.includes('da') || lower.includes('mặt') || lower.includes('skincare') || lower.includes('mụn')) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('da') || s.ServiceName.toLowerCase().includes('mặt') || s.ServiceName.toLowerCase().includes('skincare') || s.ServiceName.toLowerCase().includes('mụn'));
        }
      }

      if (matchedService) {
        return `📅 Tôi đã mở bảng giờ trống cho dịch vụ **${matchedService.ServiceName}**. Bạn có thể chọn Stylist yêu thích và thời gian trực tiếp bên dưới để đặt lịch nhanh:\n\n[[WIDGET:SLOTS|${matchedService.ServiceId}||]]`;
      }
    } catch (dbErr) {
      console.error('Fallback DB service search failed:', dbErr.message);
    }
  }

  // Fallback thông thường khác
  if (lower.includes('nail') || lower.includes('móng')) return '💅 Với dịch vụ nail, bạn có thể chọn các gói làm móng cao cấp, sơn gel hoặc đính đá nghệ thuật. Bạn nên đặt lịch hẹn trực tiếp bằng cách nhắn tin "đặt lịch làm nail" tại đây.';
  if (lower.includes('hair') || lower.includes('tóc')) return '💇 Về tóc, salon có cắt tạo kiểu nam/nữ, nhuộm màu thời trang, uốn xoăn và hấp phục hồi collagen. Hãy gõ "đặt lịch làm tóc" để chọn giờ hẹn trống nhé.';
  if (lower.includes('massage') || lower.includes('spa')) return '💆 Massage body đá nóng và chăm sóc sức khỏe của chúng tôi sẽ giúp bạn thư giãn tốt nhất. Hãy nhắn "đặt lịch massage" để đặt chỗ.';
  if (lower.includes('da') || lower.includes('skincare')) return '✨ Chúng tôi có các liệu trình chăm sóc da mặt chuyên sâu, hút chì thải độc và trị liệu mụn chuyên nghiệp. Hãy gõ "đặt lịch skincare" để tiến hành đặt chỗ.';
  if (lower.includes('giá') || lower.includes('bao nhiêu')) return '💰 Bảng giá của từng dịch vụ được niêm yết công khai tại mục Dịch vụ. Bạn cũng có thể xem giá trực tiếp khi chọn dịch vụ đặt lịch trong khung chat này.';
  
  return '😊 Xin chào! Hiện tại tôi có thể hỗ trợ bạn trực tiếp các việc sau:\n- Đặt lịch hẹn mới (ví dụ: gõ "tôi muốn đặt lịch uốn tóc")\n- Xem lịch hẹn sắp tới & đổi lịch/hủy lịch (gõ "xem lịch hẹn của tôi")\n- Xem các voucher ưu đãi (gõ "voucher của tôi")\n- Xem lịch sử làm đẹp (gõ "lịch sử dịch vụ")';
}

async function getChatHistory(userId) {
  const pool = await connectDB();
  const result = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT TOP 20 ChatId, Question, Answer, CreatedAt
    FROM AIChatLogs
    WHERE UserId = @UserId
    ORDER BY CreatedAt DESC
  `);
  return result.recordset.reverse();
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input('RecommendationId', sql.Int, id).query('SELECT * FROM AIRecommendations WHERE RecommendationId = @RecommendationId');
  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();
  const result = await pool.request()
    .input('CustomerId', sql.Int, data.customerId || data.CustomerId || null)
    .input('ServiceId', sql.Int, data.serviceId || data.ServiceId || null)
    .input('RecommendationType', sql.NVarChar, data.recommendationType || data.RecommendationType || 'SERVICE_SUGGESTION')
    .input('Reason', sql.NVarChar, data.reason || data.Reason || null)
    .query(`
      INSERT INTO AIRecommendations (CustomerId, ServiceId, RecommendationType, Reason)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @ServiceId, @RecommendationType, @Reason)
    `);
  return result.recordset[0];
}

async function update(id, data) { return { RecommendationId: Number(id), ...data }; }
async function remove(id) {
  const pool = await connectDB();
  await pool.request().input('RecommendationId', sql.Int, id).query('DELETE FROM AIRecommendations WHERE RecommendationId = @RecommendationId');
  return { RecommendationId: Number(id) };
}

module.exports = { getAll, getMine, chat, getChatHistory, getById, create, update, remove };
