const axios = require('axios');

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
    console.error('[Vision AI] Download failed for URL:', url, err.message);
    throw err;
  }
}

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

async function analyzeImage(imageUrl) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  const systemInstruction = `Bạn là Bác sĩ - Chuyên gia Nhân trắc học khuôn mặt & Tạo mẫu tóc nghệ thuật cao cấp.
Nhiệm vụ của bạn là soi kỹ bức ảnh chân dung khách hàng và đo lường tỉ lệ hình học khuôn mặt thực tế để đưa ra kết luận nhân trắc học chính xác nhất.

QUY TẮC XÁC ĐỊNH DÁNG MẶT NHÂN TRẮC HỌC (BẮT BUỘC ĐO LƯỜNG THEO TỈ LỆ):
1. **TRÁI XOAN (Oval)**: Chiều dài mặt gấp khoảng 1.3 - 1.5 lần chiều rộng gò má; trán hơi rộng hơn cằm một chút; đường viền hàm cong tròn mềm mại không góc cạnh thô.
2. **TRÒN (Round)**: Chiều dài và chiều rộng mặt gần như bằng nhau (tỉ lệ ~1:1); gò má là phần rộng nhất; đường hàm uốn tròn mềm mại, cằm tròn không có góc cạnh sắc.
3. **VUÔNG (Square)**: Chiều dài và chiều rộng mặt tương đương; trán, gò má và đường hàm có độ rộng gần bằng nhau; góc hàm bướng góc cạnh rõ rệt, cằm phẳng/vuông.
4. **DÀI / CHỮ NHẬT (Oblong/Rectangle)**: Chiều dài mặt lớn hơn rõ rệt so với chiều rộng (> 1.5 lần); trán cao dài; nếu đường hàm góc cạnh là Chữ Nhật, nếu đường hàm mềm mại là Dài.
5. **KIM CƯƠNG (Diamond)**: Gò má nổi bật là phần rộng nhất trên mặt; trán hẹp và cằm nhọn/hẹp rõ rệt.
6. **TRÁI TIM (Heart) / TAM GIÁC NGƯỢC**: Trán là phần rộng nhất; đường hàm thon dần xuống cằm nhọn V-line thanh thoát.
7. **TÁO / QUẢ LÊ (Triangle)**: Đường hàm và phần dưới mặt rộng hơn rõ rệt so với trán.

QUY TẮC NGÔN NGỮ:
- Trả lời 100% bằng TIẾNG VIỆT THUẦN CHUẨN, giàu tính chuyên môn.
- TUYỆT ĐỐI KHÔNG trộn từ tiếng Nga, Anh hay ngôn ngữ khác trong kết quả JSON.

QUAN TRỌNG: Hãy kiểm tra xem ảnh có chứa khuôn mặt người hay không.
Nếu KHÔNG chứa khuôn mặt người, trả về JSON:
{
  "is_face": false,
  "error": "Không nhận diện được khuôn mặt trong ảnh của bạn. Vui lòng chụp hoặc tải lên ảnh chân dung góc thẳng, rõ nét khuôn mặt và mái tóc!"
}

Nếu ảnh hợp lệ, hãy đo lường tỉ lệ và trả về JSON thuần:
{
  "is_face": true,
  "face_shape": "Dáng mặt chính xác (Chỉ chọn 1 trong các chuẩn: Trái xoan, Tròn, Vuông, Dài, Kim cương, Trái tim, Chữ nhật, Quả lê)",
  "face_shape_reason": "Lý do nhân trắc học chi tiết (Mô tả chính xác tỉ lệ trán-gò má-hàm-cằm nhận diện được trên ảnh của khách)",
  "jawline": "Đường viền hàm (VD: V-line thon gọn, Hàm vuông góc cạnh, Hàm tròn mềm mại)",
  "forehead": "Đặc điểm trán (VD: Trán cao rộng, Trán hẹp cân đối, Trán tròn)",
  "cheekbones": "Đặc điểm gò má (VD: Gò má cao sắc nét, Gò má đầy đặn cân đối, Gò má thon)",
  "chin": "Đặc điểm cằm (VD: Cằm nhọn V-line, Cằm vuông phẳng, Cằm tròn chẻ)",
  "hair_length": "Độ dài tóc hiện tại (VD: Tóc dài ngang lưng, Tóc lửng ngang vai, Tóc tém ngắn Pixie)",
  "hair_density": "Mật độ/độ dày tóc (VD: Tóc mỏng xẹp, Tóc dày bồng bềnh, Mật độ trung bình)",
  "hair_texture": "Kết cấu chất tóc (VD: Tóc thẳng tự nhiên, Tóc uốn sóng lơi, Tóc xoăn tơ mềm, Tóc rễ tre thô cứng)",
  "current_hair_color": "Màu tóc hiện tại (VD: Đen tuyền tự nhiên, Nâu hạt dẻ, Nâu vàng, Nhuộm phai màu)",
  "skin_tone": "Tông màu da (VD: Da trắng hồng rạng rỡ, Da ngăm bánh mật, Da trung tính, Da ngăm tối)",
  "undertone": "Sắc thái da (VD: Tone ấm Warm, Tone lạnh Cool, Tone trung tính Neutral)",
  "personal_color_season": "Mùa màu sắc cá nhân (VD: Xuân ấm áp, Hè dịu mát, Thu trầm ấm, Đông sắc sảo)"
}
Quy tắc: Chỉ trả về JSON thuần, không bao gồm thẻ code block hay ký tự giải thích.`;

  let base64Data = null;
  let mimeType = 'image/jpeg';
  let dataUri = imageUrl;

  try {
    const downloaded = await downloadImageAsBase64(imageUrl);
    base64Data = downloaded.base64Data;
    mimeType = downloaded.mimeType || 'image/jpeg';
    dataUri = `data:${mimeType};base64,${base64Data}`;
  } catch (imgErr) {
    console.warn('[Vision AI] Failed to convert image to base64:', imgErr.message);
  }

  // 1. Thử gọi trực tiếp Google Gemini API (Chỉ khi có key hợp lệ dạng AIzaSy...)
  if (geminiApiKey && geminiApiKey.startsWith('AIzaSy') && base64Data) {
    const geminiModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const gModel of geminiModels) {
      try {
        console.log(`[Vision AI] Attempting direct Google Gemini Vision call (${gModel})...`);
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
            timeout: 20000
          }
        );

        let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Vision AI] Direct Gemini (${gModel}) successful!`);
          text = text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          }
          return sanitizeObject(JSON.parse(text));
        }
      } catch (err) {
        console.warn(`[Vision AI] Direct Gemini (${gModel}) failed:`, err.response?.data?.error?.message || err.message);
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
        console.log(`[Vision AI] Attempting OpenRouter Vision call with model: ${model}...`);
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
            timeout: 20000
          }
        );

        let content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[Vision AI] OpenRouter successful with model: ${model}!`);
          content = content.trim();
          if (content.startsWith('```')) {
            content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          }
          return sanitizeObject(JSON.parse(content));
        }
      } catch (err) {
        console.warn(`[Vision AI] OpenRouter failed for model ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  // 3. Nếu dịch vụ AI bị gián đoạn/lỗi kết nối, báo lỗi rõ ràng chứ không giả lập nhận diện sai
  console.warn('[Vision AI] All Vision AI APIs failed/rate limited.');
  return sanitizeObject({
    is_face: false,
    error: 'Hệ thống AI không thể phân tích ảnh do lỗi kết nối dịch vụ nhận diện (hết token/rate-limit). Vui lòng thử lại sau ít phút hoặc tải lên ảnh chân dung rõ nét hơn!'
  });
}

module.exports = { analyzeImage };
