const { sql, connectDB } = require('../../config/db');
const { generateContent } = require('../../config/gemini');
const { sendMail } = require('../../utils/sendMail');

async function getCustomerByUserId(pool, userId) {
  if (!userId) return null;
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
    SELECT sr.TechnicianId AS EmployeeId, 
           CONVERT(VARCHAR(10), ws.ShiftDate, 120) AS ShiftDate,
           CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
           CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime
    FROM ShiftRegistrations sr
    JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
    WHERE sr.Status = 'APPROVED'
      AND ws.ShiftDate >= CAST(GETDATE() AS DATE)
      AND ws.ShiftDate <= DATEADD(day, 2, GETDATE())
    ORDER BY ws.ShiftDate ASC, ws.StartTime ASC
  `);

  // 1.7. Lấy danh sách chi nhánh của salon
  const branchesResult = await pool.request().query(`
    SELECT BranchId, BranchName, Address, Phone
    FROM Branches
  `);

  // 1.8. Lấy danh sách gói combo dịch vụ đang bán
  const packagesResult = await pool.request().query(`
    SELECT PackageId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, ValidityDays
    FROM Packages
    WHERE Status = 'ACTIVE'
    ORDER BY PackageName
  `);

  // 2. Lấy lịch sử appointment của khách (nếu có)
  let customerHistory = [];
  if (userId) {
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
  }

  // 3. Lấy chat history gần nhất để tạo context (nếu có)
  let recentChats = [];
  if (userId) {
    const chatHistoryResult = await pool.request()
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT TOP 6 Question, Answer
        FROM AIChatLogs
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);
    recentChats = chatHistoryResult.recordset.reverse();
  }

  // Build context string
  const servicesList = servicesResult.recordset.map(s =>
    `- [ID: ${s.ServiceId}] ${s.ServiceName} (${s.CategoryName || 'Chung'}): ${s.Price?.toLocaleString('vi-VN')}đ, ${s.DurationMinutes} phút${s.Description ? ' - ' + s.Description : ''}`
  ).join('\n');

  const packagesList = packagesResult.recordset.map(p =>
    `- [Gói Combo ID: ${p.PackageId}] ${p.PackageName}: Giá bán ${p.SalePrice?.toLocaleString('vi-VN')}đ (Giá gốc ${p.OriginalPrice?.toLocaleString('vi-VN')}đ), Gồm ${p.TotalSessions} buổi, HSD ${p.ValidityDays} ngày${p.Description ? ' - ' + p.Description : ''}`
  ).join('\n');

  const historyText = customerHistory.length > 0
    ? customerHistory.map(h => `- ${h.ServiceName} (${new Date(h.AppointmentDate).toLocaleDateString('vi-VN')}) - ${h.Status}`).join('\n')
    : 'Chưa có lịch sử sử dụng dịch vụ.';

  const chatContext = recentChats.length > 0
    ? recentChats.map(c => {
        const cleanAns = String(c.Answer || '')
          .replace(/\[\[WIDGET:[^\]]+\]\]/g, '')
          .replace(/\[\[SUGGESTIONS:[^\]]+\]\]/g, '')
          .trim();
        return `Khách: ${c.Question}\nAI: ${cleanAns}`;
      }).join('\n')
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

  return { servicesList, techniciansList, branchesList, packagesList, historyText, chatContext };
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
    const { servicesList, techniciansList, branchesList, packagesList, historyText, chatContext } = await buildSalonContext(pool, userId);
    const todayStr = new Date().toISOString().split('T')[0];

    // Tạo system prompt
    const systemPrompt = `Bạn là trợ lý AI thông minh của **Beauty Salon** - một salon làm đẹp chuyên nghiệp.
(Hôm nay là ngày: ${todayStr})

## Vai trò:
- Tư vấn dịch vụ làm đẹp và các gói combo phù hợp cho khách hàng.
- Trả lời các câu hỏi về giá cả, thời lượng, dịch vụ, ca trực, giờ trống của kỹ thuật viên/stylist, địa chỉ chi nhánh.
- Hỗ trợ khách hàng xem lịch hẹn, hủy lịch hẹn, xem voucher, xem lịch sử dịch vụ hoặc chọn giờ trống đặt lịch trực tiếp ngay trong khung chat này.
- Đề xuất combo/gói dịch vụ phù hợp

## Quy tắc:
1. LUÔN trả lời bằng **tiếng Việt**, thân thiện, chuyên nghiệp
2. Trả lời ngắn gọn, dễ hiểu (tối đa 3-4 câu cho câu hỏi đơn giản)
3. Khi gợi ý dịch vụ, LUÔN đề cập giá và thời lượng. Khi gợi ý gói combo, hãy giới thiệu giá bán, số buổi trị liệu và hạn sử dụng.
4. Nếu khách hỏi ngoài phạm vi salon → nhẹ nhàng chuyển hướng về dịch vụ
5. Sử dụng emoji phù hợp để tạo cảm giác thân thiện
6. KHÔNG tự bịa dịch vụ hoặc giá không có trong danh sách
7. Nếu khách muốn đặt lịch thông thường → hướng dẫn vào trang "Đặt lịch hẹn" trên menu. Nếu khách muốn mua gói combo dịch vụ, hãy hướng dẫn khách truy cập trang "Gói dịch vụ" trên menu để đăng ký mua.
8. Khi tư vấn hoặc giới thiệu dịch vụ cụ thể có sẵn trong danh sách dịch vụ, hãy LUÔN chèn thêm một liên kết đặt lịch có định dạng chính xác là: [Đặt lịch: Tên dịch vụ | ID] (ví dụ: nếu dịch vụ có [ID: 3] là "Cắt tóc nam", hãy viết: "[Đặt lịch: Cắt tóc nam | 3]"). KHÔNG tự bịa ID, hãy lấy đúng ID tương ứng của dịch vụ từ danh sách dịch vụ được cung cấp bên dưới.
9. Khi giới thiệu kỹ thuật viên/stylist cho một dịch vụ cụ thể, bạn có thể tạo một nút đặt lịch kết hợp cả dịch vụ và stylist bằng định dạng chính xác là: [Đặt lịch: Tên dịch vụ | ID | Stylist: Tên stylist | StylistID] (ví dụ: nếu dịch vụ có [ID: 3] và stylist "Nguyễn Văn A" có [Stylist ID: 2], hãy viết: "[Đặt lịch: Cắt tóc nam | 3 | Stylist: Nguyễn Văn A | 2]").
10. Tích hợp tiện ích tương tác trực tiếp (WIDGET) trong khung chat:
- Khi khách hàng muốn xem danh sách lịch hẹn sắp tới hoặc hủy lịch (ví dụ: "lịch hẹn của tôi", "tôi đã đặt lịch nào", "xem lịch hẹn", "hủy lịch"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:MY_APPOINTMENTS]]
- Khi khách hàng muốn xem danh sách voucher ưu đãi của họ (ví dụ: "tôi có voucher nào không", "xem voucher của tôi", "mã giảm giá"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:MY_VOUCHERS]]
- Khi khách hàng muốn đặt lịch trực tiếp, hỏi giờ trống hoặc có ý định đặt hẹn cho một dịch vụ cụ thể (ví dụ: "đặt lịch uốn tóc", "tìm giờ trống làm nail ngày mai", "tôi muốn đặt lịch gội đầu", "có giờ trống nào cho nhuộm tóc không"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SLOTS|ServiceID|StylistID|YYYY-MM-DD]] (ví dụ: nếu đặt Uốn tóc ID: 9 với stylist ID: 9 vào ngày 2026-06-21, hãy chèn: [[WIDGET:SLOTS|9|9|2026-06-21]]). Phải chuyển đổi các cụm từ chỉ ngày (như "ngày mai", "hôm nay", "thứ hai tới") thành định dạng YYYY-MM-DD dựa trên ngày hôm nay là ${todayStr}. Nếu khách chưa chọn stylist, hãy để trống StylistID (ví dụ: [[WIDGET:SLOTS|9||2026-06-21]] hoặc [[WIDGET:SLOTS|9||]]). Nếu khách chưa chọn ngày, hãy để trống ngày (ví dụ: [[WIDGET:SLOTS|9|9|]] hoặc [[WIDGET:SLOTS|9||]]). LUÔN chèn widget này ngay khi khách nhắc tới ý định đặt lịch làm dịch vụ để khách có thể thao tác chọn nhanh chóng và trực tiếp.
- Khi khách hàng muốn tìm kiếm các dịch vụ làm đẹp hoặc muốn biết tiệm có dịch vụ nào (ví dụ: "tìm dịch vụ mụn", "ở đây có dịch vụ tóc nào không", "tìm dịch vụ dưới 300k", "dưỡng ẩm da", "dịch vụ làm sạch"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SEARCH_SERVICES|Từ khóa tìm kiếm]] (ví dụ: [[WIDGET:SEARCH_SERVICES|mụn]] hoặc [[WIDGET:SEARCH_SERVICES|tóc]]). Nếu khách hỏi toàn bộ dịch vụ, hãy để trống từ khóa: [[WIDGET:SEARCH_SERVICES|]].
- Khi khách hàng muốn tìm kiếm hoặc hỏi về các chuyên viên, kỹ thuật viên làm đẹp (ví dụ: "ai uốn tóc đẹp", "tìm kỹ thuật viên uốn tóc", "các stylist ở đây là ai", "chuyên viên trị mụn"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SEARCH_STYLISTS|Từ khóa tìm kiếm]] (ví dụ: [[WIDGET:SEARCH_STYLISTS|uốn]] hoặc [[WIDGET:SEARCH_STYLISTS|Nguyễn Văn A]]). Nếu hỏi chung chung, hãy để trống từ khóa: [[WIDGET:SEARCH_STYLISTS|]].
- Khi khách hàng muốn xem lịch sử sử dụng dịch vụ hoặc các dịch vụ đã từng làm trước đây (ví dụ: "lịch sử dịch vụ", "tôi đã từng làm dịch vụ nào", "xem lịch sử làm đẹp"), bạn hãy trả lời lịch sự và bắt buộc chèn dòng này ở cuối câu trả lời (phải trên dòng riêng biệt): [[WIDGET:SERVICE_HISTORY]]

11. LUÔN LUÔN chèn dòng này ở cuối cùng của mỗi câu trả lời (trên dòng riêng biệt, sau bất kỳ WIDGET nào) chứa từ 2 đến 3 câu gợi ý hỏi tiếp theo có liên quan đến ngữ cảnh chat, viết theo góc nhìn của khách hàng: [[SUGGESTIONS:Câu hỏi gợi ý 1|Câu hỏi gợi ý 2|Câu hỏi gợi ý 3]] (ví dụ: [[SUGGESTIONS:Tôi muốn xem giờ trống làm tóc|Tìm stylist chuyên làm nail|Voucher ưu đãi của tôi là gì?]] hoặc [[SUGGESTIONS:Xem lịch hẹn đã đặt|Giá dịch vụ trị mụn là bao nhiêu?|Hủy lịch hẹn của tôi]]).

## Danh sách dịch vụ hiện có:
${servicesList}

## Danh sách các gói Combo dịch vụ hiện có:
${packagesList}

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

  // Lưu vào database nếu người dùng đã đăng nhập (userId có giá trị)
  if (userId) {
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
  } else {
    // Trả về đối tượng giả lập cho khách vãng lai
    return {
      ChatId: 0,
      UserId: null,
      Question: text,
      Answer: answer,
      CreatedAt: new Date()
    };
  }
}

/**
 * Fallback khi Gemini API lỗi - tìm kiếm dịch vụ trong DB và sinh widget tương ứng
 */
async function getFallbackAnswer(pool, userId, text) {
  const lower = text.toLowerCase();

  // Helper to safely match keyword without substring collisions (e.g. uốn vs muốn)
  const match = (keywords, exclusions = []) => {
    return keywords.some(kw => {
      if (!lower.includes(kw)) return false;
      if (exclusions.some(exc => lower.includes(exc))) return false;
      return true;
    });
  };

  // 1. Voucher/Khuyến mãi
  if (match(['voucher', 'mã giảm', 'khuyến mãi', 'discount'])) {
    if (!userId) return '🎁 Vui lòng đăng nhập để xem danh sách voucher ưu đãi của bạn.';
    return '🎁 Dưới đây là danh sách các voucher ưu đãi hiện tại của bạn. Nhấp vào mã để sao chép:\n\n[[WIDGET:MY_VOUCHERS]]';
  }

  // 2. Lịch sử dịch vụ
  if (match(['lịch sử', 'dịch vụ đã làm', 'đã sử dụng', 'từng làm'])) {
    if (!userId) return '📜 Vui lòng đăng nhập để xem lịch sử dịch vụ làm đẹp của bạn.';
    return '📜 Dưới đây là lịch sử các dịch vụ làm đẹp bạn đã thực hiện tại salon của chúng tôi:\n\n[[WIDGET:SERVICE_HISTORY]]';
  }

  // 3. Danh sách lịch hẹn / Hủy / Đổi lịch
  if (match(['lịch hẹn', 'đã đặt', 'hủy lịch', 'đổi lịch', 'lịch của tôi'])) {
    if (!userId) return '📅 Vui lòng đăng nhập để xem hoặc quản lý lịch hẹn sắp tới của bạn.';
    return '📅 Dưới đây là các lịch hẹn sắp tới của bạn. Bạn có thể thay đổi thời gian (đổi lịch trực tiếp) hoặc hủy lịch hẹn ngay tại đây:\n\n[[WIDGET:MY_APPOINTMENTS]]';
  }

  // 4. Đặt lịch / Giờ trống
  if (match(['đặt', 'giờ trống', 'lịch', 'slot', 'booking', 'làm'], ['hủy lịch', 'đổi lịch', 'lịch sử', 'lịch hẹn'])) {
    try {
      // Tìm dịch vụ phù hợp trong DB
      const servicesResult = await pool.request().query("SELECT ServiceId, ServiceName FROM Services WHERE Status = 'AVAILABLE'");
      const services = servicesResult.recordset;
      
      // Tìm xem tên dịch vụ nào xuất hiện trong câu hỏi
      let matchedService = null;
      for (const s of services) {
        const nameLower = s.ServiceName.toLowerCase();
        if (lower.includes(nameLower)) {
          matchedService = s;
          break;
        }
      }
      
      // Nếu không khớp trực tiếp, thử tìm từ khóa thông thường
      if (!matchedService) {
        if (match(['tóc', 'cắt', 'uốn', 'nhuộm', 'gội'], ['muốn', 'cuốn'])) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('tóc') || s.ServiceName.toLowerCase().includes('cắt') || s.ServiceName.toLowerCase().includes('uốn') || s.ServiceName.toLowerCase().includes('gội'));
        } else if (match(['nail', 'móng', 'sơn'])) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('nail') || s.ServiceName.toLowerCase().includes('móng') || s.ServiceName.toLowerCase().includes('sơn'));
        } else if (match(['massage', 'spa', 'body'])) {
          matchedService = services.find(s => s.ServiceName.toLowerCase().includes('massage') || s.ServiceName.toLowerCase().includes('spa') || s.ServiceName.toLowerCase().includes('body'));
        } else if (match(['da', 'mặt', 'skincare', 'mụn'])) {
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

  // 5. Tìm kiếm dịch vụ dựa trên triệu chứng hoặc nhu cầu đặc biệt (đau lưng, mụn, tóc xơ, v.v.)
  try {
    const servicesResult = await pool.request().query("SELECT ServiceId, ServiceName, Description, Price, DurationMinutes FROM Services WHERE Status = 'AVAILABLE'");
    const services = servicesResult.recordset;

    let matchedServices = [];
    let symptomTitle = "";
    if (match(['đau lưng', 'vai gáy', 'mỏi cổ', 'nhức mỏi', 'mệt mỏi', 'massage', 'đá nóng', 'stress', 'mỏi lưng'])) {
      symptomTitle = "giảm đau nhức mỏi cơ và thư giãn";
      matchedServices = services.filter(s => 
        s.ServiceName.toLowerCase().includes('massage') || 
        s.ServiceName.toLowerCase().includes('body') ||
        s.Description?.toLowerCase().includes('massage') ||
        s.Description?.toLowerCase().includes('thư giãn') ||
        s.Description?.toLowerCase().includes('vai gáy')
      );
    } else if (match(['mụn', 'skincare', 'thâm', 'nám', 'sạch da', 'da mặt', 'hút chì', 'da dầu', 'da khô', 'rửa mặt'])) {
      symptomTitle = "chăm sóc và trị liệu da mặt chuyên sâu";
      matchedServices = services.filter(s => 
        s.ServiceName.toLowerCase().includes('da') || 
        s.ServiceName.toLowerCase().includes('mặt') ||
        s.ServiceName.toLowerCase().includes('mụn') ||
        s.ServiceName.toLowerCase().includes('tẩy') ||
        s.Description?.toLowerCase().includes('da') ||
        s.Description?.toLowerCase().includes('mụn') ||
        s.Description?.toLowerCase().includes('skincare')
      );
    } else if (match(['gội', 'da đầu', 'gàu', 'dưỡng sinh', 'thảo dược', 'rụng tóc', 'ngứa đầu'])) {
      symptomTitle = "chăm sóc da đầu và gội dưỡng sinh thảo dược";
      matchedServices = services.filter(s => 
        s.ServiceName.toLowerCase().includes('gội') || 
        s.ServiceName.toLowerCase().includes('đầu') ||
        s.Description?.toLowerCase().includes('gội') ||
        s.Description?.toLowerCase().includes('da đầu')
      );
    } else if (match(['uốn', 'nhuộm', 'cắt tóc', 'tạo kiểu', 'duỗi', 'phục hồi tóc', 'chẻ ngọn', 'tóc xơ'], ['muốn', 'cuốn'])) {
      symptomTitle = "cắt tạo kiểu và phục hồi tóc chuyên sâu";
      matchedServices = services.filter(s => 
        s.ServiceName.toLowerCase().includes('uốn') || 
        s.ServiceName.toLowerCase().includes('nhuộm') ||
        s.ServiceName.toLowerCase().includes('tóc') ||
        s.ServiceName.toLowerCase().includes('cắt') ||
        s.Description?.toLowerCase().includes('tóc')
      );
    }

    if (matchedServices.length > 0) {
      const listText = matchedServices.map(s => `- **${s.ServiceName}** (${Number(s.Price).toLocaleString('vi-VN')}đ • ${s.DurationMinutes} phút)`).join('\n');
      return `💆 Rất chia sẻ với tình trạng hiện tại của bạn. Salon gợi ý các liệu trình **${symptomTitle}** phù hợp nhất dành cho bạn dưới đây:\n\n${listText}\n\nBạn có thể nhấp vào bảng giờ trống hoặc đặt lịch nhanh cho các dịch vụ này ngay dưới đây:\n\n[[WIDGET:SEARCH_SERVICES|${matchedServices[0].ServiceName.split(' ')[0]}]]\n\n[[SUGGESTIONS:Xem giờ trống dịch vụ này|Voucher ưu đãi của tôi|Hỏi đáp dịch vụ khác]]`;
    }
  } catch (err) {
    console.error('Symptoms fallback lookup failed:', err.message);
  }

  // Fallback thông thường khác
  if (match(['nail', 'móng'])) return '💅 Với dịch vụ nail, bạn có thể chọn các gói làm móng cao cấp, sơn gel hoặc đính đá nghệ thuật. Bạn nên đặt lịch hẹn trực tiếp bằng cách nhắn tin "đặt lịch làm nail" tại đây.\n\n[[WIDGET:SEARCH_SERVICES|nail]]\n\n[[SUGGESTIONS:Đặt lịch sơn gel móng|Xem voucher của tôi|Tư vấn chăm sóc da]]';
  if (match(['hair', 'tóc'])) return '💇 Về tóc, salon có cắt tạo kiểu nam/nữ, nhuộm màu thời trang, uốn xoăn và hấp phục hồi collagen. Hãy chọn dịch vụ uốn/cắt/nhuộm tóc trực tiếp bên dưới:\n\n[[WIDGET:SEARCH_SERVICES|tóc]]\n\n[[SUGGESTIONS:Xem giờ trống làm tóc|Tìm stylist uốn tóc đẹp|Khuyến mãi combo tóc]]';
  if (match(['massage', 'spa'])) return '💆 Massage body đá nóng và chăm sóc sức khỏe của chúng tôi sẽ giúp bạn thư giãn tốt nhất. Chọn dịch vụ massage bên dưới để xem giờ trống:\n\n[[WIDGET:SEARCH_SERVICES|massage]]\n\n[[SUGGESTIONS:Đặt lịch Massage Body|Xem các chuyên viên massage|Voucher áp dụng]]';
  if (match(['da', 'skincare'], ['đá'])) return '✨ Chúng tôi có các liệu trình chăm sóc da mặt chuyên sâu, hút chì thải độc và trị liệu mụn chuyên nghiệp. Hãy chọn dịch vụ chăm sóc da bên dưới:\n\n[[WIDGET:SEARCH_SERVICES|da]]\n\n[[SUGGESTIONS:Đặt lịch nặn mụn|Xem chuyên viên chăm sóc da|Giá dịch vụ hút chì]]';
  if (match(['giá', 'bao nhiêu'])) return '💰 Bảng giá của từng dịch vụ được niêm yết công khai tại mục Dịch vụ. Bạn cũng có thể xem giá trực tiếp khi chọn dịch vụ đặt lịch trong khung chat này:\n\n[[WIDGET:SEARCH_SERVICES|]]\n\n[[SUGGESTIONS:Xem voucher giảm giá|Đặt lịch cắt tóc nam|Liên hệ chi nhánh]]';
  
  return '😊 Xin chào! Hiện tại tôi có thể hỗ trợ bạn trực tiếp các việc sau:\n- Tư vấn & đặt lịch dịch vụ (ví dụ: gõ "tôi bị đau lưng", "tôi muốn làm nail")\n- Xem lịch hẹn sắp tới & đổi lịch/hủy lịch (gõ "lịch hẹn của tôi")\n- Xem các voucher ưu đãi (gõ "voucher của tôi")\n- Xem lịch sử làm đẹp (gõ "lịch sử dịch vụ")\n\n[[SUGGESTIONS:Tôi bị đau lưng mỏi cổ|Tôi muốn tư vấn trị mụn|Xem voucher giảm giá của tôi]]';
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

function ruleBasedChurnPrediction(customerData) {
  const CURRENT_DATE = new Date('2026-06-27');
  const results = [];

  for (const c of customerData) {
    let risk_score = 15; // base score
    const reason = [];
    const recommended_action = [];

    // Check no-shows
    if (c.no_show_count > 0) {
      risk_score += c.no_show_count * 20;
      reason.push(`Số lần đặt lịch nhưng không đến (no-show) cao: ${c.no_show_count} lần`);
    }

    // Check cancellations
    if (c.cancellation_count > 0) {
      risk_score += Math.min(c.cancellation_count * 4, 30);
      reason.push(`Tần suất hủy lịch hẹn nhiều: ${c.cancellation_count} lần`);
    }

    // Check feedback rating
    if (c.feedback_rating !== null && c.feedback_rating < 3.5) {
      risk_score += (3.5 - c.feedback_rating) * 20 + 10;
      reason.push(`Đánh giá mức độ hài lòng thấp: ${c.feedback_rating}/5 sao`);
    }

    // Check recency
    if (c.last_visit_date) {
      const lastVisit = new Date(c.last_visit_date);
      const daysSinceLast = Math.round((CURRENT_DATE - lastVisit) / (1000 * 60 * 60 * 24));

      if (c.avg_days_between_visits) {
        if (daysSinceLast > c.avg_days_between_visits * 2) {
          risk_score += 35;
          reason.push(`Đã ${daysSinceLast} ngày chưa quay lại, vượt xa tần suất trung bình (${c.avg_days_between_visits} ngày)`);
        } else if (daysSinceLast > c.avg_days_between_visits * 1.3) {
          risk_score += 20;
          reason.push(`Đã ${daysSinceLast} ngày chưa quay lại, lâu hơn tần suất trung bình (${c.avg_days_between_visits} ngày)`);
        }
      } else {
        if (daysSinceLast > 60) {
          risk_score += 25;
          reason.push(`Đã ${daysSinceLast} ngày kể từ lần ghé thăm duy nhất`);
        } else if (daysSinceLast > 30) {
          risk_score += 15;
          reason.push(`Đã ${daysSinceLast} ngày kể từ lần ghé thăm duy nhất`);
        }
      }
    } else {
      risk_score += 15;
      reason.push("Đăng ký tài khoản nhưng chưa thực hiện dịch vụ nào");
    }

    risk_score = Math.min(Math.max(Math.round(risk_score), 0), 100);

    let risk_level = 'LOW_RISK';
    if (risk_score >= 70) {
      risk_level = 'HIGH_RISK';
    } else if (risk_score >= 40) {
      risk_level = 'MEDIUM_RISK';
    }

    if (risk_level === 'HIGH_RISK') {
      recommended_action.push("💝 Gửi tặng Voucher giảm giá 20% áp dụng cho toàn bộ dịch vụ.");
      
      let hasBodySpa = false;
      if (c.favorite_services && c.favorite_services.length > 0) {
        hasBodySpa = c.favorite_services.some(svc => 
          svc.includes("Massage") || svc.includes("Spa") || svc.includes("Chăm sóc da") || svc.includes("Thảo dược")
        );
      }
      if (hasBodySpa) {
        recommended_action.push("🎁 Tặng kèm 01 suất Massage cổ vai gáy miễn phí ở lần hẹn tiếp theo.");
      } else {
        recommended_action.push("🎁 Tặng kèm 01 suất Phục hồi tóc hư tổn miễn phí ở lần hẹn tiếp theo.");
      }
      recommended_action.push("👑 Đặc cách nâng cấp lên hạng thành viên VIP để giữ chân khách hàng.");
    } else if (risk_level === 'MEDIUM_RISK') {
      recommended_action.push("✉️ Gửi tin nhắn Zalo/SMS hỏi thăm sức khỏe và nhắc lịch chăm sóc định kỳ.");
      recommended_action.push("🎫 Tặng Voucher ưu đãi 15% cho dịch vụ được yêu thích của khách.");
      recommended_action.push("🌟 Tặng +200 điểm tích lũy Loyalty để kích thích khách hàng quay lại.");
    } else {
      recommended_action.push("💝 Gửi tặng Voucher giảm giá 10% áp dụng cho toàn bộ dịch vụ.");
      if (c.favorite_services && c.favorite_services.length > 0) {
        recommended_action.push(`✨ Giới thiệu liệu trình làm đẹp mới liên quan đến ${c.favorite_services[0]}.`);
      } else {
        recommended_action.push("✨ Giới thiệu dịch vụ mới chăm sóc da mặt chuyên sâu.");
      }
    }

    results.push({
      customer_id: c.customer_id,
      name: c.name,
      risk_level,
      risk_score,
      reason: reason.length > 0 ? reason : ["Khách hàng có lịch sử hoạt động bình thường, ổn định."],
      recommended_action
    });
  }

  const high = results.filter(r => r.risk_level === 'HIGH_RISK').length;
  const med = results.filter(r => r.risk_level === 'MEDIUM_RISK').length;
  const low = results.filter(r => r.risk_level === 'LOW_RISK').length;

  return {
    summary: `Hệ thống tự động ghi nhận tổng cộng ${results.length} khách hàng đang hoạt động. Trong đó, có ${high} khách hàng xếp hạng rủi ro cao (HIGH_RISK), ${med} khách hàng rủi ro trung bình (MEDIUM_RISK), và ${low} khách hàng ổn định (LOW_RISK).`,
    customers: results.sort((a, b) => b.risk_score - a.risk_score)
  };
}

async function predictCustomersChurn(executorUserId) {
  const pool = await connectDB();
  
  // 1. Get all customers
  const customersResult = await pool.request().query(`
    SELECT c.CustomerId, u.FullName, u.Phone, u.Email, c.CreatedAt
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
  `);
  const customers = customersResult.recordset;

  // Get all appointments
  const appResult = await pool.request().query(`
    SELECT a.AppointmentId, a.CustomerId, a.AppointmentDate, a.Status,
           i.InvoiceId, p.Amount, p.Status AS PaymentStatus
    FROM Appointments a
    LEFT JOIN Invoices i ON i.AppointmentId = a.AppointmentId
    LEFT JOIN Payments p ON p.InvoiceId = i.InvoiceId
    ORDER BY a.CustomerId, a.AppointmentDate ASC
  `);
  const appointments = appResult.recordset;

  // Get all appointment services to identify services used
  const appServicesResult = await pool.request().query(`
    SELECT aps.AppointmentId, s.ServiceName
    FROM AppointmentServices aps
    JOIN Services s ON aps.ServiceId = s.ServiceId
  `);
  const appServices = appServicesResult.recordset;
  const servicesByApp = {};
  appServices.forEach(s => {
    if (!servicesByApp[s.AppointmentId]) servicesByApp[s.AppointmentId] = [];
    servicesByApp[s.AppointmentId].push(s.ServiceName);
  });

  // Query customer packages count
  const pkgsResult = await pool.request().query(`
    SELECT CustomerId, COUNT(*) AS PackageCount
    FROM CustomerPackages
    GROUP BY CustomerId
  `);
  const packageCountMap = new Map(pkgsResult.recordset.map(row => [row.CustomerId, row.PackageCount]));

  // Get all reviews
  const reviewsResult = await pool.request().query(`
    SELECT CustomerId, Rating
    FROM Reviews
  `);
  const reviews = reviewsResult.recordset;

  // Map data
  const customerData = customers.map(cust => {
    const custApps = appointments.filter(a => a.CustomerId === cust.CustomerId);
    const custReviews = reviews.filter(r => r.CustomerId === cust.CustomerId);
    
    const completedApps = custApps.filter(a => a.Status === 'COMPLETED');
    const total_visits = completedApps.length;
    const package_count = packageCountMap.get(cust.CustomerId) || 0;
    
    const lastVisit = completedApps.length > 0 ? completedApps[completedApps.length - 1] : null;
    const last_visit_date = lastVisit ? new Date(lastVisit.AppointmentDate).toISOString().split('T')[0] : null;

    // Compute avg_days_between_visits
    let avg_days_between_visits = null;
    if (completedApps.length > 1) {
      let diffSum = 0;
      for (let i = 1; i < completedApps.length; i++) {
        const d1 = new Date(completedApps[i - 1].AppointmentDate);
        const d2 = new Date(completedApps[i].AppointmentDate);
        const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24);
        diffSum += diffDays;
      }
      avg_days_between_visits = Math.round(diffSum / (completedApps.length - 1));
    }

    // Compute total spent (sum of paid invoices)
    const total_spent = custApps
      .filter(a => a.PaymentStatus === 'PAID')
      .reduce((sum, a) => sum + (a.Amount || 0), 0);

    // Favorite services
    const serviceCounts = {};
    custApps.forEach(a => {
      const svcs = servicesByApp[a.AppointmentId] || [];
      svcs.forEach(s => {
        serviceCounts[s] = (serviceCounts[s] || 0) + 1;
      });
    });
    const favorite_services = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    // Cancellation and no show counts
    const cancellation_count = custApps.filter(a => a.Status.includes('CANCEL') || a.Status === 'CANCELLED').length;
    const no_show_count = custApps.filter(a => a.Status === 'NO_SHOW').length;

    // Feedback rating
    const avgRating = custReviews.length > 0
      ? parseFloat((custReviews.reduce((sum, r) => sum + r.Rating, 0) / custReviews.length).toFixed(1))
      : null;

    // Booking history simplified (last 5 bookings)
    const booking_history = custApps.slice(-5).map(a => ({
      date: new Date(a.AppointmentDate).toISOString().split('T')[0],
      status: a.Status,
      services: servicesByApp[a.AppointmentId] || []
    }));

    return {
      customer_id: cust.CustomerId.toString(),
      name: cust.FullName,
      phone: cust.Phone || null,
      email: cust.Email || null,
      total_visits,
      last_visit_date,
      avg_days_between_visits,
      total_spent,
      favorite_services,
      booking_history,
      cancellation_count,
      no_show_count,
      feedback_rating: avgRating,
      package_count
    };
  }).filter(c => c.total_visits > 0 || c.cancellation_count > 0 || c.no_show_count > 0);

  let resultPayload;
  let isFallback = false;

  const systemPrompt = `Bạn là một AI phân tích hành vi khách hàng cho hệ thống quản lý salon làm đẹp.
Nhiệm vụ của bạn là dự đoán khách hàng nào có nguy cơ không quay lại (churn) và đề xuất hành động giữ chân khách hàng phù hợp.

## TIÊU CHÍ PHÂN TÍCH
Bạn cần dựa vào các tín hiệu sau:
- Nếu last_visit_date quá xa so với avg_days_between_visits → tăng rủi ro
- Nếu cancellation_count cao → tăng rủi ro
- Nếu no_show_count cao → tăng rủi ro
- Nếu tổng chi tiêu giảm dần → tăng rủi ro
- Nếu feedback_rating thấp (< 3.5) → tăng rủi ro
- Nếu tần suất đặt lịch giảm → tăng rủi ro

## OUTPUT BẮT BUỘC
Trả về JSON theo format:
{
  "summary": "Tổng quan về tình trạng khách hàng",
  "customers": [
    {
      "customer_id": "...",
      "name": "...",
      "risk_level": "LOW_RISK | MEDIUM_RISK | HIGH_RISK",
      "risk_score": 0-100,
      "reason": [
        "Lý do rủi ro 1",
        "Lý do rủi ro 2"
      ],
      "recommended_action": [
        "Đề xuất hành động giữ chân 1",
        "Đề xuất hành động giữ chân 2"
      ]
    }
  ]
}

## QUY TẮC ĐỀ XUẤT HÀNH ĐỘNG (RECOMMENDED_ACTION)
Hãy đề xuất các hành động cụ thể, thiết thực và chuyên nghiệp theo phân nhóm rủi ro:
1. HIGH_RISK (Rủi ro cao):
   - 💝 Gửi tặng Voucher giảm giá 20% áp dụng cho toàn bộ dịch vụ.
   - 🎁 Tặng kèm 01 suất Massage cổ vai gáy miễn phí ở lần hẹn tiếp theo (nếu khách hàng thích làm massage/spa) HOẶC 🎁 Tặng kèm 01 suất Phục hồi tóc hư tổn miễn phí ở lần hẹn tiếp theo (nếu khách hàng thích làm tóc hoặc không rõ sở thích). Chỉ chọn duy nhất 1 món quà dịch vụ miễn phí phù hợp nhất cho mỗi khách hàng.
   - 👑 Đặc cách nâng cấp lên hạng thành viên VIP để giữ chân khách hàng.
2. MEDIUM_RISK (Rủi ro trung bình):
   - ✉️ Gửi tin nhắn Zalo/SMS hỏi thăm sức khỏe và nhắc lịch chăm sóc định kỳ.
   - 🎫 Tặng Voucher ưu đãi 15% cho dịch vụ được yêu thích của khách.
   - 🌟 Tặng +200 điểm tích lũy Loyalty để kích thích khách hàng quay lại.
3. LOW_RISK (Rủi ro thấp / Ổn định):
   - 💝 Gửi tặng Voucher giảm giá 10% áp dụng cho toàn bộ dịch vụ.
   - ✨ Giới thiệu liệu trình làm đẹp mới liên quan đến dịch vụ khách hay dùng (không tặng điểm, không nâng VIP).

## QUY TẮC QUAN TRỌNG
- Không được trả lời ngoài JSON. Không có thẻ markdown \`\`\`json ngoài kết quả.
- Không được giải thích dài dòng.
- Mỗi khách phải có risk_score rõ ràng.
- reasoning phải ngắn gọn, đúng dữ liệu.`;

  try {
    const aiResponse = await generateContent(systemPrompt, JSON.stringify(customerData));
    let cleanAnswer = aiResponse.trim();
    if (cleanAnswer.startsWith('```')) {
      cleanAnswer = cleanAnswer.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    resultPayload = JSON.parse(cleanAnswer);
  } catch (err) {
    console.warn('[AI] predictCustomersChurn failed, falling back to rule-based logic:', err.message);
    resultPayload = ruleBasedChurnPrediction(customerData);
    isFallback = true;
  }

  try {
    // 1. Ghi nhận vào AIPredictions
    await pool.request()
      .input('PredictionType', sql.NVarChar, 'CUSTOMER_CHURN')
      .input('Result', sql.NVarChar, resultPayload.summary)
      .query('INSERT INTO AIPredictions (PredictionType, Result) VALUES (@PredictionType, @Result)');

    // 2. Ghi nhận vào AIAuditLogs
    await pool.request()
      .input('UserId', sql.Int, executorUserId || null)
      .input('FeatureName', sql.NVarChar, 'Customer Churn Prediction')
      .input('Prompt', sql.NVarChar, 'Phân tích rủi ro churn dựa trên dữ liệu khách hàng')
      .input('AIResponse', sql.NVarChar, JSON.stringify(resultPayload))
      .input('ModelName', sql.NVarChar, isFallback ? 'rule-based-fallback' : 'gemini-2.5-flash')
      .input('InputToken', sql.Int, 1200)
      .input('OutputToken', sql.Int, 800)
      .input('Cost', sql.Decimal(18, 4), isFallback ? 0 : 0.0150)
      .query(`
        INSERT INTO AIAuditLogs (UserId, FeatureName, Prompt, AIResponse, ModelName, InputToken, OutputToken, Cost)
        VALUES (@UserId, @FeatureName, @Prompt, @AIResponse, @ModelName, @InputToken, @OutputToken, @Cost)
      `);
  } catch (dbLogErr) {
    console.error('[AI] DB logging prediction/audit failed:', dbLogErr.message);
  }

  // Enrich result payload with dynamic segment tags and raw metrics for dashboard
  const enrichedCustomers = resultPayload.customers.map(c => {
    const orig = customerData.find(o => o.customer_id === c.customer_id);
    const segments = [];
    if (orig) {
      if (orig.total_spent >= 5000000 || orig.total_visits >= 10) {
        segments.push("Khách VIP");
      }
      if (c.risk_level === 'HIGH_RISK' || c.risk_score >= 60) {
        segments.push("Nguy cơ rời bỏ");
      }
      if (orig.last_visit_date) {
        const lastVisit = new Date(orig.last_visit_date);
        const daysSinceLast = Math.round((new Date('2026-06-27') - lastVisit) / (1000 * 60 * 60 * 24));
        if (daysSinceLast > 45) {
          segments.push("Lâu chưa quay lại");
        }
      }
      if (orig.cancellation_count >= 2 || orig.no_show_count >= 1) {
        segments.push("Hay hủy lịch");
      }
      if (orig.total_spent >= 1000000 && orig.package_count === 0) {
        segments.push("Tiềm năng mua gói");
      }
    }
    if (segments.length === 0) {
      segments.push("Khách hàng phổ thông");
    }
    return {
      ...c,
      segments,
      phone: orig ? orig.phone : null,
      email: orig ? orig.email : null,
      total_visits: orig ? orig.total_visits : 0,
      total_spent: orig ? orig.total_spent : 0,
      last_visit_date: orig ? orig.last_visit_date : null,
      cancellation_count: orig ? orig.cancellation_count : 0,
      no_show_count: orig ? orig.no_show_count : 0,
      feedback_rating: orig ? orig.feedback_rating : null
    };
  });

  resultPayload.customers = enrichedCustomers.sort((a, b) => b.risk_score - a.risk_score);

  return resultPayload;
}

async function sendVoucherToCustomer(customerId, voucherId, discountPercent) {
  const pool = await connectDB();
  
  const custRes = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query("SELECT c.CustomerId, u.FullName, u.UserId, u.Email FROM Customers c JOIN Users u ON c.UserId = u.UserId WHERE c.CustomerId = @CustomerId");
  const customer = custRes.recordset[0];
  if (!customer) throw new Error("Khách hàng không tồn tại");

  let voucherCode = "";
  let discountType = "PERCENT";
  let discountVal = 20;
  let finalVoucherId = voucherId;

  if (discountPercent) {
    discountVal = Number(discountPercent);
    voucherCode = `CRM${discountVal}${customerId}${Math.floor(1000 + Math.random() * 9000)}`;
    
    const voucherInsert = await pool.request()
      .input("Code", sql.NVarChar, voucherCode)
      .input("DiscountValue", sql.Decimal(18, 2), discountVal)
      .query(`
        INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderAmount, StartDate, EndDate, Quantity, Status)
        OUTPUT INSERTED.VoucherId
        VALUES (@Code, 'PERCENT', @DiscountValue, 0, CAST(GETDATE() AS DATE), CAST(DATEADD(month, 3, GETDATE()) AS DATE), 1, 'ACTIVE')
      `);
    finalVoucherId = voucherInsert.recordset[0].VoucherId;
  } else {
    const vouchRes = await pool.request()
      .input("VoucherId", sql.Int, voucherId)
      .query("SELECT VoucherId, Code, DiscountValue, DiscountType FROM Vouchers WHERE VoucherId = @VoucherId AND Status = 'ACTIVE'");
    const voucher = vouchRes.recordset[0];
    if (!voucher) throw new Error("Voucher không tồn tại hoặc đã hết hạn/bị vô hiệu hóa");
    voucherCode = voucher.Code;
    discountType = voucher.DiscountType;
    discountVal = Number(voucher.DiscountValue);
  }

  await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("VoucherId", sql.Int, finalVoucherId)
    .query(`
      MERGE INTO CustomerVouchers AS target
      USING (SELECT @CustomerId AS CustomerId, @VoucherId AS VoucherId) AS source
      ON (target.CustomerId = source.CustomerId AND target.VoucherId = source.VoucherId)
      WHEN MATCHED THEN
        UPDATE SET UsedStatus = 0
      WHEN NOT MATCHED THEN
        INSERT (CustomerId, VoucherId, UsedStatus) VALUES (@CustomerId, @VoucherId, 0);
    `);

  const title = "🎁 Bạn nhận được quà tặng Voucher từ Salon!";
  const content = `Beauty Salon thân tặng quý khách voucher ưu đãi: ${voucherCode} (Giảm ${discountType === 'PERCENT' ? `${discountVal}%` : `${discountVal.toLocaleString('vi-VN')}đ`}). Trân trọng kính mời quý khách đặt lịch hẹn trải nghiệm dịch vụ.`;
  
  await pool.request()
    .input("UserId", sql.Int, customer.UserId)
    .input("Title", sql.NVarChar, title)
    .input("Content", sql.NVarChar, content)
    .input("Type", sql.NVarChar, "PROMOTION")
    .query("INSERT INTO Notifications (UserId, Title, Content, Type, CreatedAt, IsRead) VALUES (@UserId, @Title, @Content, @Type, GETDATE(), 0)");

  // Send email if email exists
  if (customer.Email) {
    try {
      await sendMail({
        to: customer.Email,
        subject: `🎁 Quà tặng Voucher giảm giá ${discountType === 'PERCENT' ? `${discountVal}%` : `${discountVal.toLocaleString('vi-VN')}đ`} từ Beauty Salon!`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ebdcc5; padding: 20px; border-radius: 12px;">
            <h2 style="color: #1b3d2f; text-align: center;">Món Quà Tri Ân Đặc Biệt</h2>
            <p>Chào <strong>${customer.FullName}</strong>,</p>
            <p>Đã lâu rồi Beauty Salon chưa có cơ hội được đồng hành và chăm sóc sắc đẹp cho bạn. Chúng tôi rất nhớ bạn và mong muốn được mang đến những trải nghiệm tuyệt vời nhất ở lần hẹn tiếp theo.</p>
            <p>Chúng tôi xin gửi tặng riêng bạn một mã Voucher ưu đãi đặc biệt:</p>
            <div style="background-color: #fcf8f2; border: 1px dashed #b45309; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 1.2rem; color: #8c2d19; font-weight: bold; letter-spacing: 1px;">Mã Voucher: ${voucherCode}</span>
              <br/>
              <span style="font-size: 0.9rem; color: #6b7280;">Ưu đãi giảm giá <strong>${discountType === 'PERCENT' ? `${discountVal}%` : `${discountVal.toLocaleString('vi-VN')}đ`}</strong> cho toàn bộ dịch vụ</span>
            </div>
            <p><strong>Hạn sử dụng:</strong> 3 tháng kể từ ngày nhận được email này.</p>
            <p>Bạn có thể áp dụng mã này khi đặt lịch trực tiếp trên website của chúng tôi hoặc xuất trình cho lễ tân khi thanh toán tại quầy.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #1b3d2f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Đặt lịch hẹn ngay</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
            <p style="font-size: 0.8rem; color: #999; text-align: center;">Mọi thắc mắc xin vui lòng liên hệ hotline của salon. Trân trọng cảm ơn!</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("[Mail Error] Gửi mail voucher thất bại:", mailErr.message);
    }
  }

  return { message: `Đã gửi tặng Voucher ${voucherCode} thành công cho khách hàng ${customer.FullName}.` };
}

async function sendReminderToCustomer(customerId, message) {
  const pool = await connectDB();

  const custRes = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query("SELECT c.CustomerId, u.FullName, u.UserId, u.Email FROM Customers c JOIN Users u ON c.UserId = u.UserId WHERE c.CustomerId = @CustomerId");
  const customer = custRes.recordset[0];
  if (!customer) throw new Error("Khách hàng không tồn tại");

  await pool.request()
    .input("UserId", sql.Int, customer.UserId)
    .input("Title", sql.NVarChar, "Chăm sóc khách hàng (Beauty Salon)")
    .input("Content", sql.NVarChar, message)
    .input("Type", sql.NVarChar, "PROMOTION")
    .query("INSERT INTO Notifications (UserId, Title, Content, Type, CreatedAt, IsRead) VALUES (@UserId, @Title, @Content, @Type, GETDATE(), 0)");

  // Send email if email exists
  if (customer.Email) {
    try {
      await sendMail({
        to: customer.Email,
        subject: "💌 Lời nhắn từ Beauty Salon",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ebdcc5; padding: 20px; border-radius: 12px;">
            <h2 style="color: #1b3d2f; text-align: center;">Lời Nhắn Gửi Yêu Thương</h2>
            <p>Chào <strong>${customer.FullName}</strong>,</p>
            <div style="background-color: #faf8f5; border-left: 4px solid #1b3d2f; padding: 15px; font-style: italic; margin: 20px 0; white-space: pre-line;">
              ${message}
            </div>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #1b3d2f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Ghé thăm Beauty Salon</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
            <p style="font-size: 0.8rem; color: #999; text-align: center;">Mọi thắc mắc xin vui lòng liên hệ hotline của salon. Trân trọng cảm ơn!</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("[Mail Error] Gửi mail nhắc nhở thất bại:", mailErr.message);
    }
  }

  return { message: `Đã gửi nhắc nhở chăm sóc thành công tới khách hàng ${customer.FullName}.` };
}

async function upgradeToVIP(customerId) {
  const pool = await connectDB();
  
  const levelRes = await pool.request()
    .query("SELECT MembershipLevelId, LevelName FROM MembershipLevels WHERE LevelName = 'Diamond' OR LevelName = 'VIP' OR LevelName = 'Gold' ORDER BY MinPoints DESC");
  let vipLevelId = null;
  if (levelRes.recordset.length > 0) {
    vipLevelId = levelRes.recordset[0].MembershipLevelId;
  } else {
    const allLevels = await pool.request().query("SELECT TOP 1 MembershipLevelId FROM MembershipLevels ORDER BY MinPoints DESC");
    if (allLevels.recordset.length > 0) {
      vipLevelId = allLevels.recordset[0].MembershipLevelId;
    }
  }
  
  if (!vipLevelId) throw new Error("Không thể tìm thấy cấp độ thành viên VIP/cao cấp để nâng cấp");

  await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("LevelId", sql.Int, vipLevelId)
    .query("UPDATE Customers SET MembershipLevelId = @LevelId, VIPExpiredAt = DATEADD(minute, 1, GETUTCDATE()) WHERE CustomerId = @CustomerId");
    
  const custRes = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query("SELECT u.FullName, u.UserId, u.Email FROM Customers c JOIN Users u ON c.UserId = u.UserId WHERE c.CustomerId = @CustomerId");
  const customer = custRes.recordset[0];

  const title = "👑 Chúc mừng! Bạn đã được nâng cấp thử nghiệm hạng thành viên VIP!";
  const content = `Beauty Salon trân trọng thông báo quý khách ${customer.FullName} đã được đặc cách nâng cấp thử nghiệm hạng thành viên VIP (hiệu lực trong 1 phút để trải nghiệm ưu đãi).`;
  
  await pool.request()
    .input("UserId", sql.Int, customer.UserId)
    .input("Title", sql.NVarChar, title)
    .input("Content", sql.NVarChar, content)
    .input("Type", sql.NVarChar, "SYSTEM")
    .query("INSERT INTO Notifications (UserId, Title, Content, Type, CreatedAt, IsRead) VALUES (@UserId, @Title, @Content, @Type, GETDATE(), 0)");

  // Send email if email exists
  if (customer.Email) {
    try {
      await sendMail({
        to: customer.Email,
        subject: "👑 Chúc mừng! Bạn đã được đặc cách nâng cấp thử nghiệm hạng VIP tại Beauty Salon!",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ebdcc5; padding: 20px; border-radius: 12px;">
            <h2 style="color: #b45309; text-align: center;">✨ Thử Nghiệm Thành Viên VIP ✨</h2>
            <p>Chào <strong>${customer.FullName}</strong>,</p>
            <p>Beauty Salon vô cùng trân trọng sự tin dùng và yêu mến của bạn dành cho các dịch vụ chăm sóc sắc đẹp của chúng tôi trong thời gian qua.</p>
            <p>Để tri ân đặc biệt và giúp bạn trải nghiệm trước quyền lợi, chúng tôi xin trân trọng thông báo tài khoản của bạn đã được đặc cách nâng cấp thử nghiệm lên cấp bậc thành viên <strong>VIP (hiệu lực trong 1 phút)</strong>.</p>
            <div style="background-color: #fdfaf2; border: 1px solid #ebdcc5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #b45309; margin-top: 0;">Đặc Quyền VIP Trải Nghiệm (Hiệu lực: 1 phút):</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Chiết khấu ưu đãi lớn trên mọi hóa đơn dịch vụ đặt lịch trong thời gian hiệu lực.</li>
                <li>Trải nghiệm đặc quyền VIP trực tiếp trên hệ thống đặt lịch.</li>
              </ul>
            </div>
            <p>Chúng tôi hy vọng sẽ luôn được phục vụ và đồng hành cùng hành trình duy trì vẻ đẹp và sự tự tin của bạn.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #1b3d2f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Truy cập tài khoản VIP</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
            <p style="font-size: 0.8rem; color: #999; text-align: center;">Trân trọng cảm ơn quý khách!</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("[Mail Error] Gửi mail nâng cấp VIP thất bại:", mailErr.message);
    }
  }

  return { message: `Đã nâng cấp khách hàng ${customer.FullName} lên VIP và gửi thông báo thành công!` };
}

async function giftFreeService(customerId, serviceName) {
  const pool = await connectDB();
  const custRes = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query("SELECT u.FullName, u.UserId, u.Email FROM Customers c JOIN Users u ON c.UserId = u.UserId WHERE c.CustomerId = @CustomerId");
  const customer = custRes.recordset[0];
  if (!customer) throw new Error("Khách hàng không tồn tại");

  const serviceRes = await pool.request()
    .input("ServiceName", sql.NVarChar, `%${serviceName.slice(0, 7)}%`)
    .query("SELECT TOP 1 Price FROM Services WHERE ServiceName LIKE @ServiceName AND Status = 'AVAILABLE'");
  
  let giftValue = 150000;
  if (serviceRes.recordset.length > 0) {
    giftValue = Number(serviceRes.recordset[0].Price);
  }

  const cleanCode = serviceName.includes("Phục hồi") || serviceName.includes("tóc")
    ? `FREEPH${customerId}${Math.floor(1000 + Math.random() * 9000)}` 
    : `FREEMS${customerId}${Math.floor(1000 + Math.random() * 9000)}`;

  const voucherInsert = await pool.request()
    .input("Code", sql.NVarChar, cleanCode)
    .input("DiscountValue", sql.Decimal(18, 2), giftValue)
    .query(`
      INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderAmount, StartDate, EndDate, Quantity, Status)
      OUTPUT INSERTED.VoucherId
      VALUES (@Code, 'AMOUNT', @DiscountValue, 0, CAST(GETDATE() AS DATE), CAST(DATEADD(month, 3, GETDATE()) AS DATE), 1, 'ACTIVE')
    `);
  const newVoucherId = voucherInsert.recordset[0].VoucherId;

  await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("VoucherId", sql.Int, newVoucherId)
    .query("INSERT INTO CustomerVouchers (CustomerId, VoucherId, UsedStatus) VALUES (@CustomerId, @VoucherId, 0)");

  const title = `💆 Quà tặng dịch vụ miễn phí: ${serviceName}!`;
  const content = `Beauty Salon thân tặng quý khách ${customer.FullName} một suất ${serviceName} miễn phí. Mã Voucher ưu đãi đã được nạp trực tiếp vào tài khoản của bạn: ${cleanCode} (Trị giá ${giftValue.toLocaleString('vi-VN')}đ). Bạn có thể áp dụng mã này khi đặt lịch hoặc đưa cho lễ tân khi thanh toán.`;

  await pool.request()
    .input("UserId", sql.Int, customer.UserId)
    .input("Title", sql.NVarChar, title)
    .input("Content", sql.NVarChar, content)
    .input("Type", sql.NVarChar, "PROMOTION")
    .query("INSERT INTO Notifications (UserId, Title, Content, Type, CreatedAt, IsRead) VALUES (@UserId, @Title, @Content, @Type, GETDATE(), 0)");

  // Send email if email exists
  if (customer.Email) {
    try {
      await sendMail({
        to: customer.Email,
        subject: `💆 Quà tặng dịch vụ miễn phí: ${serviceName} từ Beauty Salon!`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ebdcc5; padding: 20px; border-radius: 12px;">
            <h2 style="color: #1b3d2f; text-align: center;">Quà Tặng Đặc Biệt Dành Cho Bạn</h2>
            <p>Chào <strong>${customer.FullName}</strong>,</p>
            <p>Để tri ân sự đồng hành của bạn và mong muốn mang đến những phút giây thư giãn tuyệt vời, Beauty Salon xin gửi tặng riêng bạn một suất <strong>${serviceName}</strong> hoàn toàn miễn phí.</p>
            <p>Mã Voucher quà tặng đã được nạp trực tiếp vào tài khoản của bạn:</p>
            <div style="background-color: #fcf8f2; border: 1px dashed #b45309; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 1.2rem; color: #8c2d19; font-weight: bold; letter-spacing: 1px;">Mã Quà Tặng: ${cleanCode}</span>
              <br/>
              <span style="font-size: 0.9rem; color: #6b7280;">Trị giá <strong>${giftValue.toLocaleString('vi-VN')}đ</strong> (Miễn phí 100% dịch vụ ${serviceName})</span>
            </div>
            <p><strong>Hạn sử dụng:</strong> 3 tháng kể từ ngày nhận được email này.</p>
            <p>Bạn có thể áp dụng mã này khi đặt lịch trực tiếp trên website của chúng tôi hoặc xuất trình cho lễ tân khi thanh toán tại quầy.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #1b3d2f; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Đặt lịch hẹn ngay</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
            <p style="font-size: 0.8rem; color: #999; text-align: center;">Mọi thắc mắc xin vui lòng liên hệ hotline của salon. Trân trọng cảm ơn!</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("[Mail Error] Gửi mail quà tặng dịch vụ thất bại:", mailErr.message);
    }
  }

  return { message: `Đã tặng quà miễn phí (${serviceName}) thành công cho ${customer.FullName}. Mã voucher: ${cleanCode}` };
}

async function addLoyaltyPoints(customerId, points) {
  const pool = await connectDB();
  await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("Points", sql.Int, points)
    .query("UPDATE Customers SET LoyaltyPoints = LoyaltyPoints + @Points WHERE CustomerId = @CustomerId");

  // Automatically recalculate and update membership rank based on new loyalty points (only keep or upgrade, no downgrade)
  await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      UPDATE c
      SET MembershipLevelId = lv.MembershipLevelId
      FROM Customers c
      LEFT JOIN MembershipLevels cur ON c.MembershipLevelId = cur.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 MembershipLevelId, MinPoints
        FROM MembershipLevels
        WHERE MinPoints <= ISNULL(c.LoyaltyPoints, 0)
        ORDER BY MinPoints DESC
      ) lv
      WHERE c.CustomerId = @CustomerId
        AND lv.MembershipLevelId IS NOT NULL
        AND (cur.MinPoints IS NULL OR lv.MinPoints >= cur.MinPoints)
    `);

  const custRes = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query("SELECT u.FullName, u.UserId, u.Email, c.LoyaltyPoints FROM Customers c JOIN Users u ON c.UserId = u.UserId WHERE c.CustomerId = @CustomerId");
  const customer = custRes.recordset[0];

  const title = `🌟 Điểm thưởng tích lũy tăng thêm: +${points} điểm!`;
  const content = `Chúc mừng quý khách ${customer.FullName} đã được cộng thêm ${points} điểm tích lũy thành viên từ hệ thống chăm sóc khách hàng. Tổng điểm hiện tại của bạn là: ${customer.LoyaltyPoints} điểm.`;

  await pool.request()
    .input("UserId", sql.Int, customer.UserId)
    .input("Title", sql.NVarChar, title)
    .input("Content", sql.NVarChar, content)
    .input("Type", sql.NVarChar, "SYSTEM")
    .query("INSERT INTO Notifications (UserId, Title, Content, Type, CreatedAt, IsRead) VALUES (@UserId, @Title, @Content, @Type, GETDATE(), 0)");

  // Send email if email exists
  if (customer.Email) {
    try {
      await sendMail({
        to: customer.Email,
        subject: `🌟 Bạn nhận được điểm thưởng Loyalty từ Beauty Salon!`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ebdcc5; padding: 20px; border-radius: 12px;">
            <h2 style="color: #1b3d2f; text-align: center;">Tích Điểm Loyalty Points</h2>
            <p>Chào <strong>${customer.FullName}</strong>,</p>
            <p>Bạn vừa nhận được thêm điểm thưởng từ hệ thống chăm sóc khách hàng tự động của chúng tôi:</p>
            <div style="background-color: #f0f7f4; border: 1px solid #d1e7dd; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 1.2rem; color: #157347; font-weight: bold;">+${points} Điểm Thưởng</span>
              <br/>
              <span style="font-size: 0.9rem; color: #6b7280;">Tổng số điểm tích lũy hiện tại: <strong>${customer.LoyaltyPoints}</strong> điểm</span>
            </div>
            <p>Điểm Loyalty có thể dùng để thăng hạng thành viên hoặc quy đổi ra các voucher ưu đãi hấp dẫn ở lần hẹn tiếp theo.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
            <p style="font-size: 0.8rem; color: #999; text-align: center;">Trân trọng cảm ơn quý khách!</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("[Mail Error] Gửi mail tích điểm thất bại:", mailErr.message);
    }
  }

  return { message: `Đã tặng +${points} điểm tích lũy thành công cho khách hàng ${customer.FullName}.` };
}

async function clearChatHistory(userId) {
  const pool = await connectDB();
  await pool.request()
    .input("UserId", sql.Int, userId)
    .query("DELETE FROM AIChatLogs WHERE UserId = @UserId");
  return { success: true, message: "Đã xóa lịch sử trò chuyện thành công" };
}

module.exports = { 
  getAll, 
  getMine, 
  chat, 
  getChatHistory, 
  getById, 
  create, 
  update, 
  remove, 
  predictCustomersChurn,
  sendVoucherToCustomer,
  sendReminderToCustomer,
  upgradeToVIP,
  giftFreeService,
  addLoyaltyPoints,
  clearChatHistory
};
