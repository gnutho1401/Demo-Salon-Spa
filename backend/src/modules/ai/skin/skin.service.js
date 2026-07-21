const axios = require('axios');
const { connectDB, sql } = require('../../../config/db');

async function downloadImageAsBase64(url) {
  if (url.startsWith('data:')) {
    const matches = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Định dạng ảnh base64 không hợp lệ.');
    }
    return {
      base64Data: matches[2],
      mimeType: matches[1]
    };
  }
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    const buffer = Buffer.from(response.data);
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    return {
      base64Data: buffer.toString('base64'),
      mimeType
    };
  } catch (err) {
    console.error('[Skin AI] Download image failed:', url, err.message);
    throw err;
  }
}

async function getCustomerByUserId(pool, userId) {
  const result = await pool.request()
    .input('UserId', sql.Int, userId)
    .query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  return result.recordset[0];
}

async function analyzeSkinImage(imageUrl, servicesList) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  const systemInstruction = `Bạn là chuyên gia thẩm mỹ, bác sĩ da liễu phân tích sức khỏe làn da qua hình ảnh. Ảnh đầu vào có thể là ảnh chân dung toàn mặt (selfie/portrait) HOẶC ảnh chụp cận cảnh (close-up) một vùng da cụ thể (như trán, má, mũi, da tay, da body...) cần phân tích.
Nhiệm vụ của bạn là phân tích chi tiết tình trạng da của khách hàng trong ảnh.
QUAN TRỌNG: Hãy kiểm tra xem hình ảnh có chứa khuôn mặt người hoặc một vùng da người rõ nét hay không.
Nếu hình ảnh hoàn toàn không chứa khuôn mặt người và không chứa vùng da người nào (ví dụ: ảnh phong cảnh, thú cưng, đồ vật, thức ăn, văn bản...), hãy trả về JSON dạng:
{
  "is_face": false,
  "error": "Không nhận diện được khuôn mặt hoặc vùng da người trong ảnh. Vui lòng chụp rõ nét khuôn mặt hoặc chụp cận cảnh vùng da cần được phân tích!"
}

Nếu ảnh hợp lệ, hãy phân tích và trả về JSON có cấu trúc chính xác sau:
{
  "is_face": true,
  "skin_type": "Loại da (ví dụ: Da dầu, Da khô, Da thường, Da nhạy cảm, Da hỗn hợp)",
  "acne_level": "Mức độ mụn (ví dụ: Không có, Nhẹ, Trung bình, Nặng)",
  "wrinkle_level": "Mức độ nếp nhăn (ví dụ: Không có, Nhẹ, Trung bình, Nặng)",
  "dark_spots": "Mức độ tàn nhang/thâm sạm (ví dụ: Không có, Ít, Nhiều)",
  "redness": "Mức độ ửng đỏ/kích ứng (ví dụ: Không có, Ít, Nhiều)",
  "pores": "Mức độ lỗ chân lông (ví dụ: Nhỏ se khít, Bình thường, Nở rộng, Bít tắc mụn cám)",
  "hydration": "Độ cấp ẩm (ví dụ: Đủ nước mịn màng, Thiếu ẩm nhẹ, Khô ráp mất nước)",
  "sebum": "Độ tiết dầu (ví dụ: Bình thường, Ít dầu thừa, Thừa dầu vùng chữ T, Nhiều bã nhờn)",
  "skin_barrier": "Hàng rào bảo vệ da (ví dụ: Khỏe mạnh, Tổn thương nhẹ, Suy yếu dễ kích ứng)",
  "elasticity": "Độ đàn hồi & Lão hóa (ví dụ: Đàn hồi tốt săn chắc, Bắt đầu lão hóa chảy xệ, Xuất hiện nếp nhăn tĩnh)",
  "dark_circles": "Quầng thâm mắt (ví dụ: Không có, Nhẹ, Thâm quầng rõ rệt)",
  "skin_score": 85, // Điểm số sức khỏe làn da tổng thể từ 0 đến 100
  "summary": "Tóm tắt ngắn gọn tình trạng da hiện tại của khách hàng (2-3 câu).",
  "routine_suggestion": "Lộ trình chăm sóc da gợi ý chi tiết (Routine sáng và tối) dành cho họ.",
  "recommended_services": [
    {
      "service_id": 10, // ID của dịch vụ thực tế lấy từ danh sách dưới đây phù hợp nhất với vấn đề của họ
      "service_name": "Tên dịch vụ",
      "reason": "Giải thích chi tiết tại sao liệu trình này lại cần thiết và giúp ích cho da của họ."
    }
  ]
}

QUY TẮC CHỌN DỊCH VỤ ĐỀ XUẤT:
Hãy xem xét kỹ danh sách dịch vụ Spa & Chăm sóc da của chúng tôi dưới đây. Hãy chọn từ 1 đến 2 dịch vụ thực tế có ID tương ứng phù hợp nhất để điều trị các vấn đề da của khách (ví dụ: nếu da mụn nhiều thì gợi ý liệu trình trị mụn, da khô thì gợi ý liệu trình cấp ẩm, da có nếp nhăn/lão hóa thì gợi ý liệu trình trẻ hóa/nâng cơ). KHÔNG tự bịa ID dịch vụ không có trong danh sách.

DANH SÁCH DỊCH VỤ HIỆN CÓ CỦA SALON:
${servicesList}

Quy tắc: Trả về chuỗi JSON thuần túy, KHÔNG bao gồm ký tự bao ngoài như bọc thẻ markdown \`\`\`json ... \`\`\` hay các giải thích dư thừa ngoài JSON.`;

  let base64Data = null;
  let mimeType = 'image/jpeg';
  let dataUri = imageUrl;

  try {
    const downloaded = await downloadImageAsBase64(imageUrl);
    base64Data = downloaded.base64Data;
    mimeType = downloaded.mimeType || 'image/jpeg';
    dataUri = `data:${mimeType};base64,${base64Data}`;
  } catch (imgErr) {
    console.warn('[Skin AI] Failed to convert image to base64:', imgErr.message);
  }

  // 1. Thử gọi trực tiếp Google Gemini API (Chỉ khi có key hợp lệ dạng AIzaSy...)
  if (geminiApiKey && geminiApiKey.startsWith('AIzaSy') && base64Data) {
    const geminiModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const gModel of geminiModels) {
      try {
        console.log(`[Skin AI] Attempting direct Google Gemini Vision call (${gModel})...`);
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiApiKey}`,
          {
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemInstruction },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey
            },
            timeout: 25000
          }
        );

        let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Skin AI] Direct Gemini (${gModel}) successful!`);
          text = text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          }
          return JSON.parse(text);
        }
      } catch (err) {
        console.warn(`[Skin AI] Direct Gemini (${gModel}) failed:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  // 2. Thử gọi OpenRouter Vision API làm phương án dự phòng
  if (openrouterApiKey) {
    const visionModels = [
      'google/gemini-2.5-flash-lite',
      'google/gemini-2.5-flash',
      'openrouter/auto'
    ];

    for (const model of visionModels) {
      try {
        console.log(`[Skin AI] Attempting OpenRouter Vision call with model: ${model}...`);
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: model,
            max_tokens: 2500,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: systemInstruction },
                  { type: 'image_url', image_url: { url: dataUri } }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${openrouterApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 25000
          }
        );

        let content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[Skin AI] OpenRouter successful with model: ${model}!`);
          content = content.trim();
          if (content.startsWith('```')) {
            content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          }
          return JSON.parse(content);
        }
      } catch (err) {
        console.warn(`[Skin AI] OpenRouter failed for model ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  // 3. Nếu tất cả AI đều bị quá hạn Token/Rate-limit (429) hoặc tạm lỗi kết nối
  console.warn('[Skin AI] All AI APIs failed/rate limited.');
  return {
    is_face: false,
    error: 'Hệ thống AI không thể phân tích da do lỗi kết nối dịch vụ nhận diện (hết token/rate-limit). Vui lòng thử lại sau ít phút hoặc tải lên ảnh chân dung hoặc vùng da rõ nét hơn!'
  };
}

async function analyzeSkin(userId, imageUrl) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) {
    throw new Error('Không tìm thấy tài khoản khách hàng tương ứng trên hệ thống.');
  }

  // Lấy danh sách dịch vụ Spa/Skincare để làm context cho AI
  const servicesResult = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.Price, s.DurationMinutes, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE' AND (
      c.CategoryName LIKE N'%da%' OR 
      c.CategoryName LIKE N'%spa%' OR 
      c.CategoryName LIKE N'%liệu trình%' OR 
      s.ServiceName LIKE N'%da%' OR 
      s.ServiceName LIKE N'%mặt%' OR
      s.ServiceName LIKE N'%mụn%' OR
      s.ServiceName LIKE N'%thải độc%' OR
      s.ServiceName LIKE N'%tắm trắng%'
    )
  `);

  const servicesText = servicesResult.recordset.map(s => 
    `- [ID: ${s.ServiceId}] ${s.ServiceName} (Thuộc nhóm: ${s.CategoryName || 'Skincare'}): ${s.Price?.toLocaleString('vi-VN')}đ, thời lượng ${s.DurationMinutes} phút.`
  ).join('\n');

  // Gọi phân tích hình ảnh qua AI
  const analysis = await analyzeSkinImage(imageUrl, servicesText);
  if (!analysis.is_face) {
    return analysis; // Trả về lỗi không nhận diện mặt
  }

  // Lưu kết quả vào cơ sở dữ liệu nếu phân tích thành công
  await pool.request()
    .input('CustomerId', sql.Int, customer.CustomerId)
    .input('ImageUrl', sql.NVarChar, imageUrl)
    .input('SkinType', sql.NVarChar, analysis.skin_type)
    .input('AcneLevel', sql.NVarChar, analysis.acne_level)
    .input('WrinkleLevel', sql.NVarChar, analysis.wrinkle_level)
    .input('DarkSpots', sql.NVarChar, analysis.dark_spots)
    .input('Redness', sql.NVarChar, analysis.redness)
    .input('SkinScore', sql.Int, analysis.skin_score)
    .input('Summary', sql.NVarChar, analysis.summary)
    .input('RoutineSuggestion', sql.NVarChar, analysis.routine_suggestion)
    .input('Pores', sql.NVarChar, analysis.pores || 'Bình thường')
    .input('Hydration', sql.NVarChar, analysis.hydration || 'Đủ ẩm')
    .input('Sebum', sql.NVarChar, analysis.sebum || 'Bình thường')
    .input('SkinBarrier', sql.NVarChar, analysis.skin_barrier || 'Khỏe mạnh')
    .input('Elasticity', sql.NVarChar, analysis.elasticity || 'Tốt')
    .input('DarkCircles', sql.NVarChar, analysis.dark_circles || 'Không có')
    .query(`
      INSERT INTO AISkinAnalysisHistory (
        CustomerId, ImageUrl, SkinType, AcneLevel, WrinkleLevel, DarkSpots, Redness, SkinScore, Summary, RoutineSuggestion,
        Pores, Hydration, Sebum, SkinBarrier, Elasticity, DarkCircles
      ) VALUES (
        @CustomerId, @ImageUrl, @SkinType, @AcneLevel, @WrinkleLevel, @DarkSpots, @Redness, @SkinScore, @Summary, @RoutineSuggestion,
        @Pores, @Hydration, @Sebum, @SkinBarrier, @Elasticity, @DarkCircles
      )
    `);

  return {
    ...analysis,
    image_url: imageUrl,
    created_at: new Date()
  };
}

async function getHistory(userId) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) return [];

  const result = await pool.request()
    .input('CustomerId', sql.Int, customer.CustomerId)
    .query(`
      SELECT AnalysisId, ImageUrl, SkinType, AcneLevel, WrinkleLevel, DarkSpots, Redness, SkinScore, Summary, RoutineSuggestion, CreatedAt,
             Pores, Hydration, Sebum, SkinBarrier, Elasticity, DarkCircles
      FROM AISkinAnalysisHistory
      WHERE CustomerId = @CustomerId
      ORDER BY CreatedAt ASC
    `);

  return result.recordset;
}

module.exports = {
  analyzeSkin,
  getHistory
};
