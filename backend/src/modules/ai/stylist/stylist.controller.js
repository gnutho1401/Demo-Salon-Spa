const service = require('./stylist.service');
const { success, error } = require('../../../utils/response');
const { connectDB, sql } = require('../../../config/db');

async function getCustomerByUserId(pool, userId) {
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  return result.recordset[0];
}

async function analyze(req, res) {
  try {
    let { customer_id, image_url, audience } = req.body;
    
    if (!image_url) {
      return error(res, 'Vui lòng cung cấp image_url', 400);
    }

    if (!customer_id) {
      const pool = await connectDB();
      const customer = await getCustomerByUserId(pool, req.user.userId);
      if (!customer) {
        return error(res, 'Không tìm thấy hồ sơ khách hàng liên kết với tài khoản này', 404);
      }
      customer_id = customer.CustomerId;
    }

    const recommendations = await service.getStylistRecommendations(Number(customer_id), image_url, audience);
    return success(res, recommendations, 'Đề xuất từ AI Stylist thành công');
  } catch (err) {
    console.error('[AI Stylist Controller Error]:', err.message);
    const clientError = /ảnh chưa chính diện|không nhận diện được khuôn mặt|vui lòng cung cấp image_url/i.test(err.message);
    return error(res, err.message, clientError ? 400 : 500);
  }
}

async function getHistory(req, res) {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('UserId', sql.Int, req.user.userId)
      .query(`
        SELECT AuditId, AIResponse, CreatedAt
        FROM AIAuditLogs
        WHERE UserId = @UserId 
          AND FeatureName = 'AI Stylist Advisor'
          AND ModelName != 'rule-based-fallback'
        ORDER BY CreatedAt DESC
      `);

    const historyList = result.recordset.map(row => {
      try {
        const payload = JSON.parse(row.AIResponse);
        return {
          audit_id: row.AuditId,
          created_at: row.CreatedAt,
          analysis: payload.analysis,
          recommendations: payload.recommendations,
          trending: payload.trending,
          upsell: payload.upsell,
          booking_suggestion: payload.booking_suggestion,
          image_url: payload.image_url || '',
          is_fallback: payload.is_fallback || false,
          model_name: payload.model_name || 'gemini-2.5-flash'
        };
      } catch (parseErr) {
        return null;
      }
    }).filter(item => item !== null);

    return success(res, historyList, 'Tải lịch sử tư vấn thành công');
  } catch (err) {
    console.error('[AI Stylist History Error]:', err.message);
    return error(res, err.message, 500);
  }
}

module.exports = { analyze, getHistory };
