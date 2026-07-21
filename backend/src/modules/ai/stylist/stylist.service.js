const { connectDB, sql } = require('../../../config/db');
const { generateContent } = require('../../../config/gemini');
const { analyzeImage } = require('../vision/face_analysis.service');
const { SYSTEM_PROMPT } = require('./stylist.prompt');

function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/выглядеть/gi, 'trông')
    .replace(/блон\s*/gi, 'vàng ')
    .replace(/elongated/gi, 'thon dài')
    .replace(/[\u0400-\u04FF]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeText(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}

async function getCustomerContext(pool, customerId) {
  // 1. Get customer details
  const custResult = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .query(`
      SELECT c.CustomerId, c.UserId, u.FullName, u.Phone, c.LoyaltyPoints, ml.LevelName
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE c.CustomerId = @CustomerId
    `);
  
  if (custResult.recordset.length === 0) {
    return null;
  }
  const profile = custResult.recordset[0];

  // 2. Get booking history + treatment notes + reviews
  const historyResult = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .query(`
      SELECT a.AppointmentId, a.AppointmentDate, a.Status, e.FullName AS StylistName,
             tn.Title AS NoteTitle, tn.Content AS NoteContent, tn.ProductsUsed,
             tn.SkinCondition, tn.Technique, tn.CustomerFeedback, tn.Recommendation AS NoteRec,
             r.Rating, r.Comment AS ReviewComment,
             (
               SELECT string_agg(s.ServiceName, ', ')
               FROM AppointmentServices aps
               JOIN Services s ON aps.ServiceId = s.ServiceId
               WHERE aps.AppointmentId = a.AppointmentId
             ) AS Services
      FROM Appointments a
      LEFT JOIN Employees emp ON a.EmployeeId = emp.EmployeeId
      LEFT JOIN Users e ON emp.UserId = e.UserId
      LEFT JOIN TreatmentNotes tn ON tn.AppointmentId = a.AppointmentId
      LEFT JOIN Reviews r ON r.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC
    `);
  
  return { profile, history: historyResult.recordset };
}

async function getSalonContext(pool) {
  // 1. Get available services
  const servicesResult = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Price, s.DurationMinutes, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
  `);

  // 2. Get active technicians and average rating
  const techniciansResult = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization,
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

  return {
    services: servicesResult.recordset,
    technicians: techniciansResult.recordset
  };
}

function getRuleBasedFallback(visionResult, salonServices, salonTechnicians, profile) {
  const isThin = String(visionResult.hair_type).toLowerCase().includes('mỏng') || String(visionResult.hair_type).toLowerCase().includes('yếu');
  const isRound = String(visionResult.face_shape).toLowerCase().includes('tròn');
  const isDark = String(visionResult.skin_tone).toLowerCase().includes('ngăm') || String(visionResult.skin_tone).toLowerCase().includes('tối');

  // Find a matching hairstyle and color
  let recommendedHairstyle = isRound ? 'Tóc Layer tỉa dài ngang vai ôm sát' : 'Tóc uốn xoăn nhẹ lãng mạn';
  let recommendedColor = isDark ? 'Màu nâu hạt dẻ ấm áp' : 'Màu nâu trà sữa trẻ trung';

  // Find suitable services from available services
  const uonService = salonServices.find(s => s.ServiceName.toLowerCase().includes('uốn')) || { ServiceId: 9, ServiceName: 'Uốn tóc setting', Price: 450000 };
  const phuchoiService = salonServices.find(s => s.ServiceName.toLowerCase().includes('phục hồi') || s.ServiceName.toLowerCase().includes('hấp')) || { ServiceId: 7, ServiceName: 'Phục hồi tóc hư tổn', Price: 300000 };
  const nhuomService = salonServices.find(s => s.ServiceName.toLowerCase().includes('nhuộm')) || { ServiceId: 6, ServiceName: 'Nhuộm màu thời trang', Price: 500000 };

  // Select top stylist
  const topStylist = salonTechnicians.sort((a, b) => b.AverageRating - a.AverageRating)[0] || { EmployeeId: 2, FullName: 'Nguyễn Stylist', AverageRating: 5.0 };

  const upsellServices = [];
  if (isThin) {
    upsellServices.push({
      service_id: uonService.ServiceId,
      service_name: `Combo uốn phồng chân tóc chân ái + ${phuchoiService.ServiceName}`,
      reason: 'Giúp tạo độ bồng bềnh tự nhiên cho chất tóc mỏng, đồng thời cấp ẩm phục hồi tránh hư tổn xơ yếu.'
    });
  } else {
    upsellServices.push({
      service_id: nhuomService.ServiceId,
      service_name: `Combo Nhuộm thời trang + ${phuchoiService.ServiceName}`,
      reason: 'Đổi mới phong cách với màu nhuộm tôn da sáng, kết hợp hấp collagen để bảo vệ biểu bì tóc.'
    });
  }

  return {
    analysis: {
      face_shape: visionResult.face_shape || 'Tròn nhẹ',
      hair_type: visionResult.hair_type || 'Tóc tự nhiên',
      skin_tone: visionResult.skin_tone || 'Sáng ấm'
    },
    recommendations: {
      hairstyles: [
        {
          name: recommendedHairstyle,
          description: `Kiểu tóc giúp che khuyết điểm khuôn mặt ${visionResult.face_shape} và phù hợp chất tóc ${visionResult.hair_type}.`
        }
      ],
      colors: [
        {
          name: recommendedColor,
          description: `Tông màu nhuộm cực kỳ nịnh tông da ${visionResult.skin_tone} của bạn.`
        }
      ]
    },
    trending: {
      title: 'Trending Hè 2026',
      styles: ['Màu trà sữa mật ong', 'Cắt layer tầng bồng bềnh']
    },
    upsell: upsellServices,
    booking_suggestion: {
      recommended_service_id: upsellServices[0]?.service_id || uonService.ServiceId,
      suggested_stylist_id: topStylist.EmployeeId,
      reason: `Stylist ${topStylist.FullName} chuyên uốn tạo kiểu và nhuộm màu phục hồi, được đánh giá cao (${topStylist.AverageRating}/5 sao).`
    },
    marketing_insight: `Khách hàng ${profile.FullName} tích lũy được ${profile.LoyaltyPoints} điểm, đề xuất tặng thêm combo dầu gội phục hồi tại nhà để tăng gắn kết thương hiệu.`
  };
}

async function getStylistRecommendations(customerId, imageUrl) {
  const pool = await connectDB();

  // 1. Get Customer Context
  const customerCtx = await getCustomerContext(pool, customerId);
  if (!customerCtx) {
    throw new Error(`Không tìm thấy khách hàng với CustomerId: ${customerId}`);
  }
  const { profile, history } = customerCtx;

  // 2. Call Face Analysis service (multimodal vision)
  let visionResult;
  try {
    visionResult = await analyzeImage(imageUrl);
    if (visionResult && visionResult.is_face === false) {
      throw new Error(visionResult.error || 'Không nhận diện được khuôn mặt trong ảnh của bạn. Vui lòng chụp hoặc tải lên ảnh chân dung rõ nét hơn!');
    }
  } catch (err) {
    console.error('[AI Stylist] Face analysis failed:', err.message);
    throw new Error(err.message || 'Không thể nhận diện khuôn mặt trong ảnh.');
  }

  // 3. Get Salon Context (Services, Stylists)
  const salonCtx = await getSalonContext(pool);

  // 4. Construct user message prompt with details
  const historyText = history.length > 0
    ? history.map(h => `- Ngày ${new Date(h.AppointmentDate).toLocaleDateString('vi-VN')}: Làm [${h.Services || 'Không rõ dịch vụ'}] do Stylist ${h.StylistName || 'Không rõ'} thực hiện. Đánh giá: ${h.Rating || 'Chưa đánh giá'}/5. Ghi chú điều trị: ${h.NoteContent || 'Không có'}.`).join('\n')
    : 'Chưa có lịch sử làm tóc tại salon.';

  const servicesText = salonCtx.services.map(s => `- ID [${s.ServiceId}]: ${s.ServiceName} - Giá: ${s.Price?.toLocaleString('vi-VN')}đ (${s.CategoryName || 'Khác'})`).join('\n');
  const stylistsText = salonCtx.technicians.map(t => `- ID [${t.EmployeeId}]: Stylist ${t.FullName} - Chuyên môn: ${t.Specialization || 'Làm tóc chung'} (Đánh giá: ${t.AverageRating}/5)`).join('\n');

  const userMessage = `[KẾT QUẢ PHÂN TÍCH NHÂN TRẮC HỌC & VISION AI]:
- Dáng mặt chính (Face Shape): ${visionResult.face_shape || 'Trái xoan'}
- Đường viền hàm (Jawline): ${visionResult.jawline || 'V-line thon gọn'}
- Đặc điểm trán (Forehead): ${visionResult.forehead || 'Trán cao rộng'}
- Gò má (Cheekbones): ${visionResult.cheekbones || 'Đầy đặn cân đối'}
- Độ dài tóc hiện tại (Hair Length): ${visionResult.hair_length || 'Tóc lửng ngang vai'}
- Mật độ/Độ dày tóc (Hair Density): ${visionResult.hair_density || 'Mật độ trung bình'}
- Kết cấu chất tóc (Hair Texture): ${visionResult.hair_texture || 'Tóc thẳng tự nhiên'}
- Màu tóc hiện tại (Current Hair Color): ${visionResult.current_hair_color || 'Nâu hạt dẻ'}
- Tông màu da (Skin Tone): ${visionResult.skin_tone || 'Trắng hồng'}
- Sắc thái da (Undertone): ${visionResult.undertone || 'Tone ấm'}
- Mùa màu sắc cá nhân (Personal Color): ${visionResult.personal_color_season || 'Xuân ấm áp'}

[HỒ SƠ KHÁCH HÀNG]:
- Tên khách hàng: ${profile.FullName}
- Điểm Loyalty tích lũy: ${profile.LoyaltyPoints} điểm (Hạng: ${profile.LevelName || 'Standard'})
- Lịch sử trị liệu tóc trước đây:
${historyText}

[DANH SÁCH DỊCH VỤ HIỆN CÓ CỦA SALON]:
${servicesText}

[DANH SÁCH STYLIST CỦA SALON]:
${stylistsText}

Hãy phân tích kỹ lưỡng các đặc điểm nhân trắc học và đưa ra đề xuất kiểu tóc, màu nhuộm tôn dáng mặt & tông da, combo upsell dịch vụ giá trị cao và stylist phù hợp nhất cho khách hàng này. Đảm bảo trả về JSON cấu trúc chuẩn.`;

  let finalPayload;
  let isFallback = false;

  try {
    const aiResponse = await generateContent(SYSTEM_PROMPT, userMessage, { jsonMode: true, maxTokens: 4096 });
    let cleanAnswer = aiResponse.trim();
    const firstBrace = cleanAnswer.indexOf('{');
    const lastBrace = cleanAnswer.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanAnswer = cleanAnswer.substring(firstBrace, lastBrace + 1);
    }
    try {
      finalPayload = JSON.parse(cleanAnswer);
    } catch (parseErr) {
      // Fix common JSON issues like trailing commas or unescaped controls
      console.warn('[AI Stylist] Retrying parse with repaired JSON...');
      let repaired = cleanAnswer
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\u0000-\u001F]+/g, ' ');
      try {
        finalPayload = JSON.parse(repaired);
      } catch (err2) {
        console.error('[AI Stylist JSON Raw Answer]:', cleanAnswer);
        throw parseErr;
      }
    }

    // Ensure detailed analysis payload contains vision attributes
    const rawAnalysis = finalPayload.analysis || {};
    finalPayload.analysis = {
      face_shape: visionResult.face_shape || (typeof rawAnalysis === 'object' ? rawAnalysis.face_shape : null) || 'Trái xoan',
      face_shape_reason: visionResult.face_shape_reason || 'Tỉ lệ chiều dài và chiều rộng cân đối hài hòa theo chuẩn nhân trắc học',
      jawline: visionResult.jawline || 'V-line thon gọn',
      forehead: visionResult.forehead || 'Trán cao rộng',
      cheekbones: visionResult.cheekbones || 'Đầy đặn cân đối',
      chin: visionResult.chin || 'Cằm nhọn thon gọn',
      hair_length: visionResult.hair_length || 'Tóc lửng ngang vai',
      hair_density: visionResult.hair_density || 'Mật độ trung bình',
      hair_texture: visionResult.hair_texture || 'Tóc thẳng tự nhiên',
      current_hair_color: visionResult.current_hair_color || 'Nâu hạt dẻ',
      skin_tone: visionResult.skin_tone || (typeof rawAnalysis === 'object' ? rawAnalysis.skin_tone : null) || 'Trắng hồng',
      undertone: visionResult.undertone || 'Tone ấm',
      personal_color_season: visionResult.personal_color_season || 'Xuân ấm áp',
      hair_type: `${visionResult.hair_length || 'Tóc lửng'}, ${visionResult.hair_texture || 'Thẳng tự nhiên'} (${visionResult.hair_density || 'Mật độ trung bình'})`,
      summary: typeof rawAnalysis === 'string' ? rawAnalysis : (rawAnalysis.summary || `Khuôn mặt ${visionResult.face_shape || 'cân đối'} (${visionResult.face_shape_reason || ''}). Tóc ${visionResult.hair_length || 'lửng'}, ${visionResult.hair_texture || 'tự nhiên'}. Tông da ${visionResult.skin_tone || 'sáng'} (${visionResult.undertone || 'Tone ấm'}).`)
    };

    // --- Sanitize: ensure array fields are always arrays ---
    if (finalPayload.trending) {
      if (typeof finalPayload.trending.styles === 'string') {
        finalPayload.trending.styles = finalPayload.trending.styles
          .split(/,\s*/)
          .map(s => s.trim())
          .filter(Boolean);
      } else if (!Array.isArray(finalPayload.trending.styles)) {
        finalPayload.trending.styles = [];
      }
    }
    if (finalPayload.recommendations) {
      if (!Array.isArray(finalPayload.recommendations.hairstyles)) {
        finalPayload.recommendations.hairstyles = finalPayload.recommendations.hairstyles ? [finalPayload.recommendations.hairstyles] : [];
      }
      if (!Array.isArray(finalPayload.recommendations.colors)) {
        finalPayload.recommendations.colors = finalPayload.recommendations.colors ? [finalPayload.recommendations.colors] : [];
      }
    }
    if (!Array.isArray(finalPayload.upsell)) {
      finalPayload.upsell = finalPayload.upsell ? [finalPayload.upsell] : [];
    }
  } catch (err) {
    console.error('[AI Stylist] LLM generation failed with details:', err.message);
    throw new Error(`Dịch vụ AI Stylist không thể kết nối tới mô hình AI: ${err.message}. Vui lòng bấm thử lại sau ít phút!`);
  }

  finalPayload.image_url = imageUrl;
  sanitizeObject(finalPayload);

  // 5. Log to AIPredictions and AIAuditLogs
  try {
    // Log to AIPredictions
    await pool.request()
      .input('PredictionType', sql.NVarChar, 'STYLIST_ADVISOR')
      .input('Result', sql.NVarChar, `Đề xuất kiểu tóc cho KH ${profile.FullName}: ${finalPayload.recommendations?.hairstyles?.[0]?.name || 'Không có'}`)
      .query('INSERT INTO AIPredictions (PredictionType, Result) VALUES (@PredictionType, @Result)');

    // Log to AIAuditLogs
    await pool.request()
      .input('UserId', sql.Int, profile.UserId)
      .input('FeatureName', sql.NVarChar, 'AI Stylist Advisor')
      .input('Prompt', sql.NVarChar, `Phân tích ảnh chân dung khách hàng CustomerId ${customerId}`)
      .input('AIResponse', sql.NVarChar, JSON.stringify(finalPayload))
      .input('ModelName', sql.NVarChar, isFallback ? 'rule-based-fallback' : 'gemini-2.5-flash')
      .input('InputToken', sql.Int, 1800)
      .input('OutputToken', sql.Int, 1000)
      .input('Cost', sql.Decimal(18, 4), isFallback ? 0 : 0.0180)
      .query(`
        INSERT INTO AIAuditLogs (UserId, FeatureName, Prompt, AIResponse, ModelName, InputToken, OutputToken, Cost)
        VALUES (@UserId, @FeatureName, @Prompt, @AIResponse, @ModelName, @InputToken, @OutputToken, @Cost)
      `);
  } catch (logErr) {
    console.error('[AI Stylist] DB logging predictions/audit failed:', logErr.message);
  }

  return {
    ...finalPayload,
    is_fallback: isFallback,
    model_name: isFallback ? 'rule-based-fallback' : 'gemini-2.5-flash'
  };
}

module.exports = { getStylistRecommendations };
