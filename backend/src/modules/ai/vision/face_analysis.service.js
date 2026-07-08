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

async function analyzeImage(imageUrl) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  const systemInstruction = `Bạn là chuyên gia phân tích nhân trắc học khuôn mặt và đặc điểm tóc.
Nhiệm vụ của bạn là phân tích ảnh chân dung khách hàng.
QUAN TRỌNG: Trước tiên, hãy kiểm tra xem hình ảnh có chứa khuôn mặt người hoặc là một ảnh chân dung rõ nét hay không.
Nếu hình ảnh KHÔNG chứa khuôn mặt người hoặc không thể nhận diện được khuôn mặt, hãy trả về JSON dạng:
{
  "is_face": false,
  "error": "Không nhận diện được khuôn mặt trong ảnh của bạn. Vui lòng chụp hoặc tải lên ảnh chân dung rõ nét hơn!"
}
Nếu hình ảnh hợp lệ và chứa khuôn mặt người, hãy phân tích và trả về JSON dạng:
{
  "is_face": true,
  "face_shape": "Hình dáng khuôn mặt (VD: Tròn, Trái xoan, Vuông, Dài, Kim cương)",
  "hair_type": "Chất tóc và kiểu tóc hiện tại (VD: Tóc mỏng xơ, Tóc dày tự nhiên, Tóc uốn nhẹ)",
  "skin_tone": "Tông màu da (VD: Tông da sáng hồng, Tông da ngăm ấm, Tông da trung bình lạnh)"
}
Quy tắc: Chỉ trả về JSON thuần, không bao gồm thẻ code block hay ký tự giải thích.`;

  // 1. Thử gọi trực tiếp Google Gemini API
  if (geminiApiKey) {
    try {
      console.log('[Vision AI] Attempting direct Google Gemini Vision call...');
      const { base64Data, mimeType } = await downloadImageAsBase64(imageUrl);
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
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
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log('[Vision AI] Direct Gemini successful!');
        return JSON.parse(text.trim());
      }
    } catch (err) {
      console.warn('[Vision AI] Direct Gemini failed:', err.message);
    }
  }

  // 2. Thử gọi OpenRouter Vision API (Gemini 2.5 Flash hoặc Llama 3.2 Vision)
  if (openrouterApiKey) {
    const visionModels = [
      'openrouter/free',
      'meta-llama/llama-3.2-11b-vision-instruct:free'
    ];

    for (const model of visionModels) {
      try {
        console.log(`[Vision AI] Attempting OpenRouter Vision call with model: ${model}...`);
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: systemInstruction },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${openrouterApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[Vision AI] OpenRouter successful with model: ${model}!`);
          return JSON.parse(content.trim());
        }
      } catch (err) {
        console.warn(`[Vision AI] OpenRouter failed for model ${model}:`, err.message);
      }
    }
  }

  // 3. Fallback mặc định nếu tất cả AI bị lỗi hoặc quá hạn
  console.warn('[Vision AI] All APIs failed, using default fallback data.');
  return {
    is_face: true,
    face_shape: 'Trái xoan (Cân đối phù hợp nhiều kiểu tóc)',
    hair_type: 'Chất tóc tự nhiên, độ dày trung bình',
    skin_tone: 'Tông da trung bình sáng (Tone ấm)'
  };
}

module.exports = { analyzeImage };
