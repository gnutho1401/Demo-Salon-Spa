const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Models to try in order of preference on OpenRouter (auto/free router handles free tier model selection)
const MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'openrouter/auto',
  'google/gemini-2.5-pro'
];

/**
 * Gọi AI hỗ trợ cả Google Gemini trực tiếp (tối ưu nhất) và OpenRouter (dự phòng)
 * @param {string} systemPrompt - System instruction cho AI
 * @param {string} userMessage - Câu hỏi của user
 * @param {object} options - Tuỳ chọn bổ sung: { jsonMode: bool, maxTokens: number }
 * @returns {Promise<string>} - Response text từ AI
 */
async function generateContent(systemPrompt, userMessage, options = {}) {
  const { jsonMode = false, maxTokens = 8192 } = options;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  // 1. Thử gọi Google Gemini trực tiếp (Chỉ khi có key hợp lệ dạng AIzaSy...)
  if (geminiApiKey && geminiApiKey.startsWith('AIzaSy')) {
    const gModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    for (const modelName of gModels) {
      try {
        console.log(`[AI] Attempting call to direct Google Gemini API (${modelName})...`);
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
          {
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userMessage }]
              }
            ],
            generationConfig: {
              maxOutputTokens: maxTokens,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {})
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey
            },
            timeout: 30000
          }
        );

        const answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) {
          console.log(`[AI] Success with Google Gemini direct API (${modelName})!`);
          return answer;
        }
      } catch (err) {
        console.warn(`[AI] Direct Gemini API (${modelName}) failed: ${err.response?.data?.error?.message || err.message}`);
      }
    }
  }

  // 2. Fallback sang OpenRouter nếu không dùng được Google Gemini trực tiếp
  if (!openrouterApiKey) {
    throw new Error('Chưa cấu hình API Key cho Google Gemini (GEMINI_API_KEY) hoặc OpenRouter (OPENROUTER_API_KEY) trong file .env');
  }

  // Nếu yêu cầu JSON, bổ sung instruction rõ ràng vào system prompt
  const enhancedSystemPrompt = jsonMode
    ? systemPrompt + '\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no explanation, no text before or after the JSON object.'
    : systemPrompt;

  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`[AI] Attempting OpenRouter call with model: ${model}`);

      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: Math.min(maxTokens || 2000, 4000),
      };

      // Request JSON format if supported
      if (jsonMode) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await axios.post(
        OPENROUTER_URL,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5173',
            'X-Title': 'Beauty Salon AI Assistant',
          },
          timeout: 30000,
        }
      );

      const answer = response.data?.choices?.[0]?.message?.content;
      if (answer) {
        console.log(`[AI] Success with OpenRouter model: ${model}`);
        return answer;
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI] OpenRouter model ${model} failed: ${errMsg}`);
      lastError = err;
      // Nếu bị giới hạn rate limit (429), không cần thử lặp lại các model khác vì cả tài khoản đều bị rate limit
      if (err.response?.status === 429) {
        console.warn('[AI] OpenRouter rate limit reached (429 - free-models-per-day limit).');
        break;
      }
    }
  }

  throw new Error(`AI API Rate Limit hoặc Hết Token: ${lastError ? (lastError.response?.data?.error?.message || lastError.message) : 'Unknown'}`);
}

module.exports = { generateContent };
