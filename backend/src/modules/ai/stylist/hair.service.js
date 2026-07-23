const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { connectDB, sql } = require("../../../config/db");

const PRIVATE_IMAGE_ROOT = path.resolve(__dirname, "../../../../private/ai-hair");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizePrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 800);
}

function normalizeAudience(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["MALE", "FEMALE"].includes(normalized) ? normalized : null;
}

function getExtension(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType };
}

function assertImagePayload(image) {
  if (!image?.buffer?.length) throw new Error("Ảnh chân dung không hợp lệ hoặc bị trống.");
  if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.");
  if (image.buffer.length > MAX_IMAGE_BYTES) throw new Error("Ảnh vượt quá 10 MB. Vui lòng chọn ảnh nhỏ hơn.");
  return image;
}

function isBlockedRemoteHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "::1" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

async function loadInputImage(imageUrl) {
  const inlineImage = parseDataUrl(imageUrl);
  if (inlineImage) return assertImagePayload(inlineImage);

  let parsed;
  try {
    parsed = new URL(String(imageUrl || ""));
  } catch {
    throw new Error("Ảnh đầu vào phải là tệp ảnh hợp lệ.");
  }

  if (parsed.protocol !== "https:" || isBlockedRemoteHost(parsed.hostname)) {
    throw new Error("URL ảnh không an toàn. Vui lòng tải ảnh trực tiếp từ thiết bị.");
  }

  const response = await axios.get(parsed.toString(), {
    responseType: "arraybuffer",
    timeout: 15000,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 300,
  });
  const mimeType = String(response.headers["content-type"] || "").split(";")[0].toLowerCase();
  return assertImagePayload({ buffer: Buffer.from(response.data), mimeType });
}

function buildHairEditPrompt(stylePrompt, customPrompt) {
  const desiredLook = [stylePrompt, customPrompt]
    .map(normalizePrompt)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(". ");

  return `Bạn là chuyên gia chỉnh sửa ảnh thử kiểu tóc cho salon cao cấp.
Chỉ thay đổi mái tóc của người trong ảnh theo mô tả: ${desiredLook}.

Yêu cầu bắt buộc:
- Giữ nguyên chính xác danh tính, toàn bộ đường nét khuôn mặt, màu da, mắt, lông mày, mũi, miệng, biểu cảm và góc đầu.
- Giữ nguyên cơ thể, trang phục, phụ kiện, nền, ánh sáng, bố cục và khung cắt của ảnh gốc.
- Tạo đường chân tóc tự nhiên; xử lý đúng phần tóc che tai, trán và cổ; sợi tóc có kết cấu, bóng và bóng đổ chân thực.
- Không làm đẹp da, không trang điểm, không đổi tuổi hoặc giới tính, không thêm chữ, logo hay khung ảnh.
- Kết quả phải là ảnh chân dung quang thực dùng để tư vấn tại salon, không phải tranh minh họa.
Chỉ trả về đúng một ảnh kết quả.`;
}

function extractGeminiImage(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) return null;
  return {
    buffer: Buffer.from(inlineData.data, "base64"),
    mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
  };
}

async function generateWithLocal(inputImage, prompt, context = {}) {
  const baseUrl = String(process.env.LOCAL_HAIR_API_URL || "http://127.0.0.1:8189").replace(/\/$/, "");
  const timeout = Math.max(120000, Number(process.env.AI_HAIR_JOB_TIMEOUT_MS) || 900000);
  const headers = { "Content-Type": "application/json" };
  if (process.env.LOCAL_HAIR_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.LOCAL_HAIR_API_TOKEN}`;
  }

  const response = await axios.post(
    `${baseUrl}/v1/hair/try-on`,
    {
      image_base64: inputImage.buffer.toString("base64"),
      mime_type: inputImage.mimeType,
      prompt,
      request_id: context.requestId || crypto.randomUUID(),
      style: context.style || null,
    },
    {
      headers,
      timeout,
      maxBodyLength: 30 * 1024 * 1024,
      maxContentLength: 30 * 1024 * 1024,
    },
  );

  const encodedImage = response.data?.image_base64;
  if (!encodedImage) throw new Error("AI local không trả về ảnh kết quả.");
  const buffer = Buffer.from(encodedImage, "base64");
  if (!buffer.length) throw new Error("Ảnh do AI local trả về không hợp lệ.");

  return {
    buffer,
    mimeType: response.data?.mime_type || "image/jpeg",
    provider: "local",
    modelName: response.data?.model || "stable-diffusion-2-inpainting",
    providerRequestId: response.data?.request_id || context.requestId || null,
    inputToken: null,
    outputToken: null,
    cost: 0,
  };
}

async function generateWithGemini(inputImage, prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình.");

  const configuredModel = String(process.env.GEMINI_IMAGE_MODEL || "").trim();
  const models = [...new Set([
    configuredModel,
    "gemini-3.1-flash-image",
    "gemini-2.5-flash-image",
  ].filter(Boolean))];
  const timeout = Math.max(30000, Number(process.env.AI_HAIR_JOB_TIMEOUT_MS) || 120000);
  let lastError;

  for (const model of models) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: inputImage.mimeType, data: inputImage.buffer.toString("base64") } },
            ],
          }],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        },
        {
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          timeout,
          maxBodyLength: 30 * 1024 * 1024,
        },
      );

      const image = extractGeminiImage(response.data);
      if (!image?.buffer?.length) throw new Error("Model không trả về ảnh kết quả.");

      const usage = response.data?.usageMetadata || {};
      return {
        ...image,
        provider: "google",
        modelName: model,
        providerRequestId: response.headers?.["x-request-id"] || null,
        inputToken: Number(usage.promptTokenCount || 0) || null,
        outputToken: Number(usage.candidatesTokenCount || 0) || null,
      };
    } catch (error) {
      lastError = error;
      console.warn(`[AI Hair Try-on] Gemini model ${model} failed:`, error.response?.data?.error?.message || error.message);
    }
  }

  throw lastError || new Error("Không thể tạo ảnh bằng Gemini.");
}

async function generateWithReplicate(inputImage, prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN chưa được cấu hình.");

  const version = process.env.REPLICATE_HAIR_MODEL_VERSION ||
    "30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f";
  const timeout = Math.max(30000, Number(process.env.AI_HAIR_JOB_TIMEOUT_MS) || 120000);
  const authorization = `Bearer ${token}`;
  const start = await axios.post(
    "https://api.replicate.com/v1/predictions",
    {
      version,
      input: {
        image: `data:${inputImage.mimeType};base64,${inputImage.buffer.toString("base64")}`,
        prompt,
        negative_prompt: "different person, changed face, face retouching, makeup, distorted face, extra person, text, watermark, illustration",
        num_outputs: 1,
        guidance_scale: 7.5,
        image_guidance_scale: 1.7,
        num_inference_steps: 35,
      },
    },
    { headers: { Authorization: authorization, "Content-Type": "application/json" }, timeout: 15000, maxBodyLength: 30 * 1024 * 1024 },
  );

  let prediction = start.data;
  const deadline = Date.now() + timeout;
  while (!["succeeded", "failed", "canceled"].includes(prediction.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await axios.get(prediction.urls.get, { headers: { Authorization: authorization }, timeout: 10000 });
    prediction = status.data;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(prediction.error || `Replicate kết thúc với trạng thái ${prediction.status || "timeout"}.`);
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl) throw new Error("Replicate không trả về ảnh kết quả.");
  const imageResponse = await axios.get(outputUrl, { responseType: "arraybuffer", timeout: 30000 });
  return {
    buffer: Buffer.from(imageResponse.data),
    mimeType: String(imageResponse.headers["content-type"] || "image/png").split(";")[0],
    provider: "replicate",
    modelName: `timothybrooks/instruct-pix2pix:${version.slice(0, 12)}`,
    providerRequestId: prediction.id || null,
    inputToken: null,
    outputToken: null,
  };
}

async function generateWithFal(inputImage, prompt) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY chưa được cấu hình.");

  const model = process.env.FAL_HAIR_MODEL || "fal-ai/image-editing/hair-change";
  const timeout = Math.max(30000, Number(process.env.AI_HAIR_JOB_TIMEOUT_MS) || 120000);
  const response = await axios.post(
    `https://fal.run/${model}`,
    {
      image_url: `data:${inputImage.mimeType};base64,${inputImage.buffer.toString("base64")}`,
      prompt,
      guidance_scale: 3.5,
      num_inference_steps: 30,
      safety_tolerance: "2",
      output_format: "jpeg",
      sync_mode: true,
    },
    {
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout,
      maxBodyLength: 30 * 1024 * 1024,
    },
  );

  const output = response.data?.images?.[0];
  if (!output?.url) throw new Error("fal.ai không trả về ảnh kết quả.");

  let image;
  if (String(output.url).startsWith("data:")) {
    image = parseDataUrl(output.url);
  } else {
    const imageResponse = await axios.get(output.url, {
      responseType: "arraybuffer",
      timeout: Math.min(timeout, 30000),
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
    });
    image = {
      buffer: Buffer.from(imageResponse.data),
      mimeType: String(output.content_type || imageResponse.headers["content-type"] || "image/jpeg").split(";")[0],
    };
  }

  if (!image?.buffer?.length) throw new Error("Ảnh fal.ai trả về không hợp lệ.");
  return {
    ...image,
    provider: "fal",
    modelName: model,
    providerRequestId: response.headers?.["x-fal-request-id"] || response.data?.request_id || null,
    inputToken: null,
    outputToken: null,
    cost: Number.isFinite(Number(process.env.FAL_HAIR_COST_USD))
      ? Number(process.env.FAL_HAIR_COST_USD)
      : null,
  };
}

async function generateWithOpenRouter(inputImage, prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY chưa được cấu hình.");
  const model = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-image";
  const timeout = Math.max(30000, Number(process.env.AI_HAIR_JOB_TIMEOUT_MS) || 120000);
  const response = await axios.post(
    "https://openrouter.ai/api/v1/images",
    {
      model,
      prompt,
      input_references: [{
        type: "image_url",
        image_url: { url: `data:${inputImage.mimeType};base64,${inputImage.buffer.toString("base64")}` },
      }],
      n: 1,
      resolution: "1K",
      output_format: "jpeg",
      output_compression: 90,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "Beauty Salon AI Stylist",
      },
      timeout,
      maxBodyLength: 30 * 1024 * 1024,
    },
  );

  const output = response.data?.data?.[0];
  if (!output?.b64_json) throw new Error("OpenRouter không trả về ảnh kết quả.");
  const usage = response.data?.usage || {};
  return {
    buffer: Buffer.from(output.b64_json, "base64"),
    mimeType: output.media_type || "image/jpeg",
    provider: "openrouter",
    modelName: model,
    providerRequestId: response.headers?.["x-request-id"] || null,
    inputToken: Number(usage.prompt_tokens || 0) || null,
    outputToken: Number(usage.completion_tokens || 0) || null,
    cost: Number.isFinite(Number(usage.cost)) ? Number(usage.cost) : null,
  };
}

function summarizeProviderError(provider, error) {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.error?.message || error?.response?.data?.detail || error?.message || "").toLowerCase();
  if (status === 401 || /invalid.*(key|token)|authentication token/.test(message)) return `${provider}: khóa API không hợp lệ`;
  if (status === 402 || /credit|balance|billing/.test(message)) return `${provider}: tài khoản chưa có số dư/billing`;
  if (status === 429 || /quota|rate limit/.test(message)) return `${provider}: đã hết quota hoặc đang bị giới hạn`;
  return `${provider}: tạm thời không khả dụng`;
}

async function generateRealHairImage(inputImage, prompt, context = {}) {
  const failures = [];
  const localEnabled = String(process.env.AI_HAIR_LOCAL_ENABLED || "").toLowerCase() === "true";
  const forceLocal = String(process.env.AI_HAIR_FORCE_LOCAL || "true").toLowerCase() !== "false";
  const providers = {
    local: { enabled: localEnabled, label: "AI local", generate: generateWithLocal },
    fal: { enabled: Boolean(process.env.FAL_KEY), label: "fal.ai", generate: generateWithFal },
    gemini: { enabled: Boolean(process.env.GEMINI_API_KEY), label: "Gemini", generate: generateWithGemini },
    openrouter: { enabled: Boolean(process.env.OPENROUTER_API_KEY), label: "OpenRouter", generate: generateWithOpenRouter },
    replicate: { enabled: Boolean(process.env.REPLICATE_API_TOKEN), label: "Replicate", generate: generateWithReplicate },
  };
  const order = forceLocal
    ? ["local"]
    : String(process.env.AI_HAIR_PROVIDER_ORDER || "local,fal,gemini,openrouter,replicate")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name, index, list) => providers[name] && list.indexOf(name) === index);

  for (const name of order) {
    const provider = providers[name];
    if (!provider.enabled) continue;
    try {
      return await provider.generate(inputImage, prompt, context);
    } catch (error) {
      console.warn(`[AI Hair Try-on] ${provider.label} failed:`, error.response?.data?.error?.message || error.message);
      failures.push(summarizeProviderError(provider.label, error));
    }
  }

  if (failures.length === 0) {
    throw new Error("Chưa cấu hình AI thử tóc. Có thể bật AI local miễn phí bằng AI_HAIR_LOCAL_ENABLED=true.");
  }
  throw new Error(`Không thể tạo ảnh thử tóc lúc này. ${failures.join(" | ")}`);
}

async function getCustomer(pool, userId) {
  const result = await pool.request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  return result.recordset[0] || null;
}

async function purgeExpiredTryOns(pool) {
  const expired = await pool.request().query(`
    DELETE TOP (50) FROM AIHairTryOns
    OUTPUT DELETED.SourceImagePath, DELETED.ResultImagePath
    WHERE ExpiresAt IS NOT NULL AND ExpiresAt < SYSUTCDATETIME()
  `);

  await Promise.all(expired.recordset
    .flatMap((row) => [row.SourceImagePath, row.ResultImagePath])
    .filter(Boolean)
    .map(async (relativePath) => {
      const absolutePath = path.resolve(PRIVATE_IMAGE_ROOT, relativePath);
      if (absolutePath.startsWith(`${PRIVATE_IMAGE_ROOT}${path.sep}`)) {
        await fs.unlink(absolutePath).catch(() => {});
      }
    }));
}

function mapStyle(row) {
  return {
    style_id: row.StyleId,
    code: row.StyleCode,
    name: row.StyleName,
    type: row.StyleType,
    length: row.HairLength,
    texture: row.HairTexture,
    maintenance: row.MaintenanceLevel,
    description: row.Description,
    prompt: row.PromptTemplate,
    thumbnail_url: row.ThumbnailUrl,
    accent_color: row.AccentColor,
    service_id: row.ServiceId,
    service_name: row.ServiceName,
    audience: row.Audience || "UNISEX",
    is_trending: Boolean(row.IsTrending),
    trend_score: row.TrendScore == null ? null : Number(row.TrendScore),
    trend_year: row.TrendYear || null,
    trend_source_url: row.TrendSourceUrl || null,
    trend_last_verified_at: row.TrendLastVerifiedAt || null,
    lora_trigger: row.LoraTrigger || null,
    prompt_version: row.PromptVersion || "v1",
  };
}

async function getStyles({ audience, trending } = {}) {
  const normalizedAudience = normalizeAudience(audience);
  const trendingOnly = String(trending || "").toLowerCase() === "true";
  const pool = await connectDB();
  const result = await pool.request()
    .input("Audience", sql.NVarChar(10), normalizedAudience)
    .input("TrendingOnly", sql.Bit, trendingOnly)
    .query(`
    SELECT hs.StyleId, hs.StyleCode, hs.StyleName, hs.StyleType, hs.HairLength,
           hs.HairTexture, hs.MaintenanceLevel, hs.Description, hs.PromptTemplate,
           hs.ThumbnailUrl, hs.AccentColor, hs.ServiceId, s.ServiceName,
           hs.Audience, hs.IsTrending, hs.TrendScore, hs.TrendYear,
           hs.TrendSourceUrl, hs.TrendLastVerifiedAt, hs.LoraTrigger, hs.PromptVersion
    FROM AIHairStyles hs
    LEFT JOIN Services s ON hs.ServiceId = s.ServiceId
    WHERE hs.IsActive = 1
      AND (@Audience IS NULL OR hs.Audience IN (@Audience, N'UNISEX'))
      AND (@TrendingOnly = 0 OR hs.IsTrending = 1)
    ORDER BY hs.IsTrending DESC, hs.TrendScore DESC, hs.SortOrder, hs.StyleId
  `);
  return result.recordset.map(mapStyle);
}

async function createTryOn({ userId, imageUrl, prompt, styleId }) {
  const inputImage = await loadInputImage(imageUrl);
  const pool = await connectDB();
  await purgeExpiredTryOns(pool).catch((error) => {
    console.warn("[AI Hair Try-on] Không thể dọn ảnh hết hạn:", error.message);
  });
  const customer = await getCustomer(pool, userId);
  if (!customer) throw new Error("Tài khoản chưa được liên kết với hồ sơ khách hàng.");

  let style = null;
  if (styleId) {
    const result = await pool.request()
      .input("StyleId", sql.Int, Number(styleId))
      .query(`
        SELECT hs.*, s.ServiceName
        FROM AIHairStyles hs
        LEFT JOIN Services s ON hs.ServiceId = s.ServiceId
        WHERE hs.StyleId = @StyleId AND hs.IsActive = 1
      `);
    style = result.recordset[0] || null;
    if (!style) throw new Error("Mẫu tóc đã chọn không tồn tại hoặc đã ngừng sử dụng.");
  }

  const customPrompt = normalizePrompt(prompt);
  if (!style && !customPrompt) throw new Error("Vui lòng chọn mẫu tóc hoặc nhập mô tả mong muốn.");
  const effectivePrompt = customPrompt || style?.PromptTemplate;
  const providerPrompt = buildHairEditPrompt(style?.PromptTemplate, effectivePrompt);
  const startedAt = Date.now();

  const inserted = await pool.request()
    .input("UserId", sql.Int, userId)
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("StyleId", sql.Int, style?.StyleId || null)
    .input("CustomPrompt", sql.NVarChar(1000), effectivePrompt)
    .input("ExpiresAt", sql.DateTime2, new Date(Date.now() + (Number(process.env.AI_HAIR_RETENTION_DAYS) || 30) * 86400000))
    .query(`
      INSERT INTO AIHairTryOns (UserId, CustomerId, StyleId, CustomPrompt, Status, ExpiresAt)
      OUTPUT INSERTED.TryOnId
      VALUES (@UserId, @CustomerId, @StyleId, @CustomPrompt, N'PROCESSING', @ExpiresAt)
    `);
  const tryOnId = inserted.recordset[0].TryOnId;

  try {
    const generated = await generateRealHairImage(inputImage, providerPrompt, {
      requestId: String(tryOnId),
      style: style ? {
        code: style.StyleCode,
        name: style.StyleName,
        type: style.StyleType,
        length: style.HairLength,
        texture: style.HairTexture,
        audience: style.Audience,
        is_trending: Boolean(style.IsTrending),
        lora_trigger: style.LoraTrigger,
        prompt_version: style.PromptVersion,
      } : null,
    });
    const userFolder = `user-${userId}`;
    const uniqueName = `${tryOnId}-${crypto.randomUUID()}`;
    const sourceRelative = path.join(userFolder, `${uniqueName}-source${getExtension(inputImage.mimeType)}`);
    const resultRelative = path.join(userFolder, `${uniqueName}-result${getExtension(generated.mimeType)}`);
    const sourceAbsolute = path.join(PRIVATE_IMAGE_ROOT, sourceRelative);
    const resultAbsolute = path.join(PRIVATE_IMAGE_ROOT, resultRelative);

    await fs.mkdir(path.dirname(sourceAbsolute), { recursive: true });
    await Promise.all([
      fs.writeFile(sourceAbsolute, inputImage.buffer),
      fs.writeFile(resultAbsolute, generated.buffer),
    ]);

    const latencyMs = Date.now() - startedAt;
    await pool.request()
      .input("TryOnId", sql.BigInt, tryOnId)
      .input("SourceImagePath", sql.NVarChar(1000), sourceRelative)
      .input("ResultImagePath", sql.NVarChar(1000), resultRelative)
      .input("ResultMimeType", sql.NVarChar(100), generated.mimeType)
      .input("Provider", sql.NVarChar(50), generated.provider)
      .input("ModelName", sql.NVarChar(150), generated.modelName)
      .input("ProviderRequestId", sql.NVarChar(200), generated.providerRequestId)
      .input("LatencyMs", sql.Int, latencyMs)
      .input("InputToken", sql.Int, generated.inputToken)
      .input("OutputToken", sql.Int, generated.outputToken)
      .query(`
        UPDATE AIHairTryOns
        SET SourceImagePath = @SourceImagePath,
            ResultImagePath = @ResultImagePath,
            ResultMimeType = @ResultMimeType,
            Provider = @Provider,
            ModelName = @ModelName,
            ProviderRequestId = @ProviderRequestId,
            Status = N'SUCCEEDED',
            LatencyMs = @LatencyMs,
            InputToken = @InputToken,
            OutputToken = @OutputToken,
            CompletedAt = SYSUTCDATETIME()
        WHERE TryOnId = @TryOnId
      `);

    const auditResponse = JSON.stringify({
      try_on_id: String(tryOnId),
      style_code: style?.StyleCode || null,
      provider: generated.provider,
      model: generated.modelName,
      latency_ms: latencyMs,
      output_mime_type: generated.mimeType,
    });
    await pool.request()
      .input("UserId", sql.Int, userId)
      .input("Prompt", sql.NVarChar, `Thử tóc: ${effectivePrompt}`)
      .input("AIResponse", sql.NVarChar, auditResponse)
      .input("ModelName", sql.NVarChar, generated.modelName)
      .input("InputToken", sql.Int, generated.inputToken)
      .input("OutputToken", sql.Int, generated.outputToken)
      .input("Cost", sql.Decimal(18, 4), generated.cost ?? null)
      .query(`
        INSERT INTO AIAuditLogs (UserId, FeatureName, Prompt, AIResponse, ModelName, InputToken, OutputToken, Cost)
        VALUES (@UserId, N'AI Hair Try-on', @Prompt, @AIResponse, @ModelName, @InputToken, @OutputToken, @Cost)
      `);

    return {
      try_on_id: String(tryOnId),
      status: "SUCCEEDED",
      style: style ? mapStyle(style) : null,
      prompt: effectivePrompt,
      provider: generated.provider,
      model_name: generated.modelName,
      latency_ms: latencyMs,
      edited_image_data: `data:${generated.mimeType};base64,${generated.buffer.toString("base64")}`,
      is_mock: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await pool.request()
      .input("TryOnId", sql.BigInt, tryOnId)
      .input("LatencyMs", sql.Int, latencyMs)
      .input("ErrorMessage", sql.NVarChar(1000), String(error.message || "Unknown error").slice(0, 1000))
      .query(`
        UPDATE AIHairTryOns
        SET Status = N'FAILED', LatencyMs = @LatencyMs, ErrorMessage = @ErrorMessage, CompletedAt = SYSUTCDATETIME()
        WHERE TryOnId = @TryOnId
      `);
    throw error;
  }
}

async function getHistory(userId) {
  const pool = await connectDB();
  await purgeExpiredTryOns(pool).catch((error) => {
    console.warn("[AI Hair Try-on] Không thể dọn ảnh hết hạn:", error.message);
  });
  const result = await pool.request()
    .input("UserId", sql.Int, userId)
    .query(`
      SELECT TOP 24 t.TryOnId, t.CustomPrompt, t.Provider, t.ModelName, t.Status,
             t.LatencyMs, t.IsFavorite, t.ErrorMessage, t.CreatedAt, t.CompletedAt,
             hs.StyleId, hs.StyleCode, hs.StyleName, hs.StyleType, hs.HairLength,
             hs.HairTexture, hs.MaintenanceLevel, hs.Description, hs.PromptTemplate,
             hs.ThumbnailUrl, hs.AccentColor, hs.ServiceId, s.ServiceName,
             hs.Audience, hs.IsTrending, hs.TrendScore, hs.TrendYear,
             hs.TrendSourceUrl, hs.TrendLastVerifiedAt, hs.LoraTrigger, hs.PromptVersion
      FROM AIHairTryOns t
      LEFT JOIN AIHairStyles hs ON t.StyleId = hs.StyleId
      LEFT JOIN Services s ON hs.ServiceId = s.ServiceId
      WHERE t.UserId = @UserId
      ORDER BY t.CreatedAt DESC
    `);

  return result.recordset.map((row) => ({
    try_on_id: String(row.TryOnId),
    prompt: row.CustomPrompt,
    provider: row.Provider,
    model_name: row.ModelName,
    status: row.Status,
    latency_ms: row.LatencyMs,
    is_favorite: Boolean(row.IsFavorite),
    error_message: row.ErrorMessage,
    created_at: row.CreatedAt,
    completed_at: row.CompletedAt,
    style: row.StyleId ? mapStyle(row) : null,
    source_image_endpoint: `/ai/stylist/tryon/${row.TryOnId}/image/source`,
    result_image_endpoint: row.Status === "SUCCEEDED" ? `/ai/stylist/tryon/${row.TryOnId}/image/result` : null,
  }));
}

async function getImage(userId, tryOnId, variant) {
  const column = variant === "source" ? "SourceImagePath" : "ResultImagePath";
  const pool = await connectDB();
  const result = await pool.request()
    .input("UserId", sql.Int, userId)
    .input("TryOnId", sql.BigInt, tryOnId)
    .query(`SELECT ${column} AS ImagePath, ResultMimeType FROM AIHairTryOns WHERE TryOnId = @TryOnId AND UserId = @UserId`);
  const row = result.recordset[0];
  if (!row?.ImagePath) throw new Error("Không tìm thấy ảnh hoặc bạn không có quyền truy cập.");

  const absolutePath = path.resolve(PRIVATE_IMAGE_ROOT, row.ImagePath);
  if (!absolutePath.startsWith(`${PRIVATE_IMAGE_ROOT}${path.sep}`)) throw new Error("Đường dẫn ảnh không hợp lệ.");
  const buffer = await fs.readFile(absolutePath);
  return {
    buffer,
    mimeType: variant === "source" ? `image/${path.extname(row.ImagePath).toLowerCase() === ".png" ? "png" : path.extname(row.ImagePath).toLowerCase() === ".webp" ? "webp" : "jpeg"}` : (row.ResultMimeType || "image/jpeg"),
  };
}

async function setFavorite(userId, tryOnId, isFavorite) {
  const pool = await connectDB();
  const result = await pool.request()
    .input("UserId", sql.Int, userId)
    .input("TryOnId", sql.BigInt, tryOnId)
    .input("IsFavorite", sql.Bit, Boolean(isFavorite))
    .query(`
      UPDATE AIHairTryOns SET IsFavorite = @IsFavorite
      OUTPUT INSERTED.TryOnId, INSERTED.IsFavorite
      WHERE TryOnId = @TryOnId AND UserId = @UserId AND Status = N'SUCCEEDED'
    `);
  if (!result.recordset[0]) throw new Error("Không tìm thấy kết quả thử tóc.");
  return { try_on_id: String(result.recordset[0].TryOnId), is_favorite: Boolean(result.recordset[0].IsFavorite) };
}

async function removeTryOn(userId, tryOnId) {
  const pool = await connectDB();
  const found = await pool.request()
    .input("UserId", sql.Int, userId)
    .input("TryOnId", sql.BigInt, tryOnId)
    .query("SELECT SourceImagePath, ResultImagePath FROM AIHairTryOns WHERE TryOnId = @TryOnId AND UserId = @UserId");
  const row = found.recordset[0];
  if (!row) throw new Error("Không tìm thấy kết quả thử tóc.");

  await pool.request()
    .input("UserId", sql.Int, userId)
    .input("TryOnId", sql.BigInt, tryOnId)
    .query("DELETE FROM AIHairTryOns WHERE TryOnId = @TryOnId AND UserId = @UserId");

  await Promise.all([row.SourceImagePath, row.ResultImagePath].filter(Boolean).map(async (relativePath) => {
    const absolutePath = path.resolve(PRIVATE_IMAGE_ROOT, relativePath);
    if (absolutePath.startsWith(`${PRIVATE_IMAGE_ROOT}${path.sep}`)) {
      await fs.unlink(absolutePath).catch(() => {});
    }
  }));
  return { try_on_id: String(tryOnId), deleted: true };
}

module.exports = {
  createTryOn,
  getStyles,
  getHistory,
  getImage,
  setFavorite,
  removeTryOn,
  normalizeAudience,
};
