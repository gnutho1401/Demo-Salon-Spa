const axios = require("axios");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Models to try in order of preference on OpenRouter
const MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

/**
 * Gọi AI hỗ trợ cả Google Gemini trực tiếp (tối ưu nhất) và OpenRouter (dự phòng)
 * @param {string} systemPrompt - System instruction cho AI
 * @param {string} userMessage - Câu hỏi của user
 * @param {object} options - Tuỳ chọn bổ sung: { jsonMode: bool, maxTokens: number }
 * @returns {Promise<string>} - Response text từ AI
 */
async function generateContent(systemPrompt, userMessage, options = {}) {
  const {
    jsonMode = false,
    maxTokens = 4096,
    timeoutMs = 20000,
    maxProviderAttempts = 2,
  } = options;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  let attempts = 0;
  let lastError = null;

  // 1. Thử gọi Google Gemini trực tiếp
  if (geminiApiKey && attempts < maxProviderAttempts) {
    attempts += 1;
    try {
      console.log("[AI] Attempting call to direct Google Gemini API...");
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userMessage }],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: timeoutMs,
        },
      );

      const answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer) {
        console.log("[AI] Success with Google Gemini direct API!");
        return answer;
      }
    } catch (err) {
      lastError = err;
      console.warn(
        `[AI] Direct Gemini API failed: ${err.message}. Falling back to OpenRouter...`,
      );
    }
  }

  // 2. Fallback sang OpenRouter nếu không dùng được Google Gemini trực tiếp
  if (!openrouterApiKey) {
    throw new Error(
      "Chưa cấu hình API Key cho Google Gemini (GEMINI_API_KEY) hoặc OpenRouter (OPENROUTER_API_KEY) trong file .env",
    );
  }

  for (const model of MODELS) {
    if (attempts >= maxProviderAttempts) break;
    attempts += 1;
    try {
      console.log(`[AI] Attempting OpenRouter call with model: ${model}`);
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Beauty Salon AI Assistant",
          },
          timeout: timeoutMs,
        },
      );

      const answer = response.data?.choices?.[0]?.message?.content;
      if (answer) {
        console.log(`[AI] Success with OpenRouter model: ${model}`);
        return answer;
      }
    } catch (err) {
      console.warn(`[AI] OpenRouter model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(
    `Tất cả các model AI đều thất bại. Lỗi cuối cùng: ${lastError ? lastError.message : "Unknown"}`,
  );
}

module.exports = { generateContent };
