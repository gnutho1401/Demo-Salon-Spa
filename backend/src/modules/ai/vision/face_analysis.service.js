const axios = require("axios");

const SUPPORTED_IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s;

const VISION_INSTRUCTION = `Bạn là chuyên gia phân tích khuôn mặt và mái tóc cho salon.
Kiểm tra ảnh có một khuôn mặt người rõ ràng hay không và chỉ trả về JSON thuần:
{
  "is_face": true,
  "is_frontal": true,
  "pose": "frontal | angled_left | angled_right",
  "pose_score": 0.0,
  "face_shape": "Tròn | Trái xoan | Vuông | Dài | Kim cương",
  "hair_type": "Mô tả ngắn chất tóc và độ dài",
  "skin_tone": "Mô tả ngắn tông da"
}
Nếu không thấy khuôn mặt, trả {"is_face":false,"error":"Lý do"}. Không thêm markdown.`;

function parseJsonText(value) {
  const clean = String(value || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!clean) throw new Error("Nhà cung cấp AI không trả nội dung phân tích.");
  return JSON.parse(clean);
}

function parseInlineImage(imageUrl) {
  const match = String(imageUrl || "").match(SUPPORTED_IMAGE_PATTERN);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64Data: match[2] };
}

async function downloadImageAsBase64(url) {
  const inline = parseInlineImage(url);
  if (inline) return inline;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
  });
  return {
    base64Data: Buffer.from(response.data).toString("base64"),
    mimeType: String(response.headers["content-type"] || "image/jpeg").split(";")[0],
  };
}

function normalizeAnalysis(result, metadata = {}) {
  const confidence = Number(result?.confidence);
  const qualityScore = Number(result?.quality_score);
  return {
    is_face: result?.is_face !== false,
    is_frontal: typeof result?.is_frontal === "boolean" ? result.is_frontal : null,
    pose: result?.pose || null,
    pose_score: Number.isFinite(Number(result?.pose_score)) ? Number(result.pose_score) : null,
    face_shape: result?.face_shape || "Chưa xác định",
    hair_type: result?.hair_type || "Chưa xác định",
    hair_length: result?.hair_length || null,
    current_hair_color: result?.current_hair_color || null,
    skin_tone: result?.skin_tone || "Chưa xác định",
    confidence: Number.isFinite(confidence) ? confidence : null,
    quality_score: Number.isFinite(qualityScore) ? qualityScore : null,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    error: result?.error || null,
    provider: metadata.provider || result?.provider || "unknown",
    model_name: metadata.modelName || result?.model_name || "unknown",
    api_enhanced: Boolean(metadata.apiEnhanced),
    fallback_used: Boolean(metadata.fallbackUsed),
    degraded: Boolean(metadata.degraded),
    metrics: result?.metrics || {},
  };
}

async function analyzeWithLocal(image) {
  const baseUrl = String(process.env.LOCAL_HAIR_API_URL || "http://127.0.0.1:8189").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (process.env.LOCAL_HAIR_API_TOKEN) headers.Authorization = `Bearer ${process.env.LOCAL_HAIR_API_TOKEN}`;
  const response = await axios.post(`${baseUrl}/v1/analyze`, {
    image_base64: image.base64Data,
    mime_type: image.mimeType,
  }, {
    headers,
    timeout: Math.max(15000, Number(process.env.AI_VISION_LOCAL_TIMEOUT_MS) || 45000),
    maxBodyLength: 15 * 1024 * 1024,
  });
  return normalizeAnalysis(response.data, {
    provider: "local",
    modelName: response.data?.model_name || "bisenet-resnet18",
  });
}

async function analyzeWithGemini(image) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình.");
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      contents: [{ role: "user", parts: [
        { text: VISION_INSTRUCTION },
        { inlineData: { mimeType: image.mimeType, data: image.base64Data } },
      ] }],
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    },
    { headers: { "Content-Type": "application/json" }, timeout: Math.max(3000, Number(process.env.AI_VISION_TIMEOUT_MS) || 12000) },
  );
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return normalizeAnalysis(parseJsonText(text), {
    provider: "google",
    modelName: "gemini-1.5-flash",
    apiEnhanced: true,
  });
}

async function analyzeWithOpenRouter(image) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY chưa được cấu hình.");
  const models = ["openrouter/free", "meta-llama/llama-3.2-11b-vision-instruct:free"];
  let lastError;
  const maxModels = Math.max(1, Number(process.env.AI_VISION_OPENROUTER_MODEL_ATTEMPTS) || 1);
  for (const model of models.slice(0, maxModels)) {
    try {
      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model,
        messages: [{ role: "user", content: [
          { type: "text", text: VISION_INSTRUCTION },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64Data}` } },
        ] }],
        response_format: { type: "json_object" },
      }, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Beauty Salon AI Stylist",
        },
        timeout: Math.max(3000, Number(process.env.AI_VISION_TIMEOUT_MS) || 12000),
      });
      return normalizeAnalysis(parseJsonText(response.data?.choices?.[0]?.message?.content), {
        provider: "openrouter",
        modelName: model,
        apiEnhanced: true,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("OpenRouter Vision không khả dụng.");
}

function mergeAnalysis(localResult, apiResult) {
  if (!apiResult) return localResult;
  if (apiResult.is_face === false) {
    return { ...localResult, warnings: [...localResult.warnings, apiResult.error].filter(Boolean) };
  }
  return {
    ...localResult,
    is_frontal: typeof apiResult.is_frontal === "boolean" ? apiResult.is_frontal : localResult.is_frontal,
    pose: apiResult.pose || localResult.pose,
    pose_score: apiResult.pose_score ?? localResult.pose_score,
    face_shape: apiResult.face_shape !== "Chưa xác định" ? apiResult.face_shape : localResult.face_shape,
    hair_type: apiResult.hair_type !== "Chưa xác định" ? apiResult.hair_type : localResult.hair_type,
    skin_tone: apiResult.skin_tone !== "Chưa xác định" ? apiResult.skin_tone : localResult.skin_tone,
    provider: `${localResult.provider}+${apiResult.provider}`,
    model_name: `${localResult.model_name} + ${apiResult.model_name}`,
    api_enhanced: true,
    fallback_used: false,
    local_analysis: localResult,
  };
}

function buildSafeFallback(failures) {
  return normalizeAnalysis({
    is_face: true,
    is_frontal: true,
    face_shape: "Chưa xác định — hãy dùng ảnh chính diện",
    hair_type: "Chưa xác định — lookbook vẫn sẵn sàng",
    skin_tone: "Chưa xác định",
    warnings: [
      "Phân tích ảnh nâng cao tạm thời không khả dụng. Bạn vẫn có thể chọn và thử mẫu tóc local.",
      ...failures,
    ],
  }, {
    provider: "safe-local-fallback",
    modelName: "salon-rule-engine",
    fallbackUsed: true,
    degraded: true,
  });
}

function summarizeFailure(provider, error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.error?.message || error?.response?.data?.detail || error?.message || "không rõ lỗi";
  const quota = status === 429 || /quota|rate limit|credit|billing/i.test(String(detail));
  return `${provider}: ${quota ? "hết quota/giới hạn" : String(detail).slice(0, 160)}`;
}

async function analyzeImageLegacy(imageUrl) {
  const image = await downloadImageAsBase64(imageUrl);
  const failures = [];
  const localEnabled = String(process.env.AI_VISION_LOCAL_ENABLED || "true").toLowerCase() !== "false";
  const enhanceEnabled = String(process.env.AI_VISION_API_ENHANCE_ENABLED || "true").toLowerCase() !== "false";
  let localResult = null;

  if (localEnabled) {
    try {
      localResult = await analyzeWithLocal(image);
      if (localResult.is_face === false) return localResult;
    } catch (error) {
      const failure = summarizeFailure("local", error);
      failures.push(failure);
      console.warn(`[Vision AI] ${failure}`);
    }
  }

  let apiResult = null;
  if (enhanceEnabled) {
    const order = String(process.env.AI_VISION_PROVIDER_ORDER || "local,gemini,openrouter")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item, index, list) => ["gemini", "openrouter"].includes(item) && list.indexOf(item) === index);
    const providers = { gemini: analyzeWithGemini, openrouter: analyzeWithOpenRouter };
    const maxAttempts = Math.max(1, Number(process.env.AI_VISION_API_MAX_ATTEMPTS) || 2);
    let attempts = 0;
    for (const provider of order) {
      if (attempts >= maxAttempts) break;
      attempts += 1;
      try {
        apiResult = await providers[provider](image);
        break;
      } catch (error) {
        const failure = summarizeFailure(provider, error);
        failures.push(failure);
        console.warn(`[Vision AI] ${failure}`);
      }
    }
  }

  if (localResult) {
    const result = mergeAnalysis(localResult, apiResult);
    if (!apiResult && failures.length) {
      result.fallback_used = true;
      result.warnings = [...result.warnings, "API nâng cao không khả dụng; hệ thống đang dùng phân tích local."];
    }
    return result;
  }
  if (apiResult) return apiResult;
  return buildSafeFallback(failures);
}

async function analyzeImage(imageUrl) {
  const image = await downloadImageAsBase64(imageUrl);
  const failures = [];
  const localEnabled = String(process.env.AI_VISION_LOCAL_ENABLED || "true").toLowerCase() !== "false";
  const apiEnabled = String(process.env.AI_VISION_API_ENHANCE_ENABLED || "true").toLowerCase() !== "false";
  const strategy = String(process.env.AI_VISION_STRATEGY || "api-first").trim().toLowerCase();
  const providerOrder = String(process.env.AI_VISION_PROVIDER_ORDER || "gemini,openrouter,local")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, list) => ["gemini", "openrouter"].includes(item) && list.indexOf(item) === index);
  const providers = { gemini: analyzeWithGemini, openrouter: analyzeWithOpenRouter };
  const maxAttempts = Math.max(1, Number(process.env.AI_VISION_API_MAX_ATTEMPTS) || 2);

  const runApi = async () => {
    if (!apiEnabled) return null;
    let attempts = 0;
    for (const provider of providerOrder) {
      if (attempts >= maxAttempts) break;
      attempts += 1;
      try {
        return await providers[provider](image);
      } catch (error) {
        const failure = summarizeFailure(provider, error);
        failures.push(failure);
        console.warn(`[Vision AI] ${failure}`);
      }
    }
    return null;
  };

  const runLocal = async () => {
    if (!localEnabled) return null;
    try {
      return await analyzeWithLocal(image);
    } catch (error) {
      const failure = summarizeFailure("local", error);
      failures.push(failure);
      console.warn(`[Vision AI] ${failure}`);
      return null;
    }
  };

  let apiResult = null;
  let localResult = null;
  if (strategy === "local-first") {
    localResult = await runLocal();
    if (localResult?.is_face === false) return { ...localResult, analysis_route: "LOCAL_FACE_GUARD" };
    apiResult = await runApi();
  } else {
    // API enrichment and the mandatory local safety check are independent.
    // Starting them together keeps the API-first result contract without
    // making users wait for the sum of both provider timeouts.
    [apiResult, localResult] = await Promise.all([runApi(), runLocal()]);
    if (!apiResult && localResult?.is_face === false) return { ...localResult, analysis_route: "LOCAL_FACE_GUARD" };
  }

  if (apiResult && localResult) {
    return {
      ...mergeAnalysis(localResult, apiResult),
      analysis_route: "API_WITH_LOCAL_SAFETY",
    };
  }
  if (apiResult) {
    return {
      ...apiResult,
      analysis_route: "API_ONLY",
      fallback_used: false,
    };
  }
  if (localResult) {
    return {
      ...localResult,
      analysis_route: "LOCAL_FALLBACK",
      fallback_used: apiEnabled,
      warnings: [
        ...(localResult.warnings || []),
        ...(apiEnabled ? ["API phân tích không khả dụng; hệ thống tự động chuyển sang phân tích local."] : []),
      ],
      failures,
    };
  }
  return {
    ...buildSafeFallback(failures),
    analysis_route: "RULE_FALLBACK",
  };
}

module.exports = {
  analyzeImage,
  analyzeWithLocal,
  buildSafeFallback,
  mergeAnalysis,
  normalizeAnalysis,
};
