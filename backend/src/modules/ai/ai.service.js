const { sql, connectDB } = require('../../config/db');

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

async function chat(userId, question) {
  const pool = await connectDB();
  const text = String(question || '').trim();
  if (!text) throw new Error('Vui lòng nhập câu hỏi');

  const lower = text.toLowerCase();
  let answer = 'Cảm ơn bạn đã liên hệ. Bạn có thể xem danh sách dịch vụ, chọn kỹ thuật viên và đặt lịch trực tiếp trên hệ thống.';

  if (lower.includes('nail')) answer = 'Với dịch vụ nail, bạn có thể chọn Nail cao cấp, thời lượng khoảng 45 phút. Bạn nên đặt lịch trước để chọn được kỹ thuật viên phù hợp.';
  else if (lower.includes('hair') || lower.includes('tóc')) answer = 'Với dịch vụ tóc, hệ thống có cắt tạo kiểu và nhuộm tóc. Bạn có thể chọn dịch vụ, ngày giờ và stylist trong trang Đặt lịch hẹn.';
  else if (lower.includes('massage') || lower.includes('spa')) answer = 'Massage thư giãn phù hợp nếu bạn muốn giảm căng thẳng. Thời lượng thường khoảng 60 phút.';
  else if (lower.includes('da') || lower.includes('skincare')) answer = 'Chăm sóc da mặt phù hợp cho khách muốn làm sạch và thư giãn. Bạn có thể đặt lịch với kỹ thuật viên skincare.';
  else if (lower.includes('giá') || lower.includes('bao nhiêu')) answer = 'Giá dịch vụ được hiển thị tại trang Dịch vụ và trang Chi tiết dịch vụ. Khi đặt lịch, hệ thống sẽ hiển thị giá trước khi xác nhận.';
  else if (lower.includes('hủy') || lower.includes('đổi lịch')) answer = 'Bạn có thể vào Lịch hẹn của tôi để hủy lịch hoặc chỉnh sửa lịch hẹn khi lịch chưa hoàn tất.';

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
