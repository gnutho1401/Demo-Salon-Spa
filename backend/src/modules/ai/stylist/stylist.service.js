const { connectDB, sql } = require("../../../config/db");
const { generateContent } = require("../../../config/gemini");
const { analyzeImage } = require("../vision/face_analysis.service");
const { SYSTEM_PROMPT } = require("./stylist.prompt");

function normalizeAudience(value, customerGender = "") {
  const requested = String(value || "").trim().toUpperCase();
  if (["MALE", "FEMALE"].includes(requested)) return requested;
  const gender = String(customerGender || "").trim().toLowerCase();
  if (gender === "nam" || gender === "male") return "MALE";
  if (gender === "nữ" || gender === "nu" || gender === "female") return "FEMALE";
  return "FEMALE";
}

async function getCustomerContext(pool, customerId) {
  const customerResult = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT c.CustomerId, c.UserId, c.Gender, u.FullName, u.Phone, c.LoyaltyPoints, ml.LevelName
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE c.CustomerId = @CustomerId
    `);
  if (!customerResult.recordset[0]) return null;

  const historyResult = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT TOP (12)
             a.AppointmentId, a.AppointmentDate, a.Status, employeeUser.FullName AS StylistName,
             tn.Content AS NoteContent, tn.CustomerFeedback, tn.Recommendation AS NoteRec,
             r.Rating, r.Comment AS ReviewComment,
             (
               SELECT STRING_AGG(s.ServiceName, ', ')
               FROM AppointmentServices aps
               JOIN Services s ON aps.ServiceId = s.ServiceId
               WHERE aps.AppointmentId = a.AppointmentId
             ) AS Services
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users employeeUser ON e.UserId = employeeUser.UserId
      LEFT JOIN TreatmentNotes tn ON tn.AppointmentId = a.AppointmentId
      LEFT JOIN Reviews r ON r.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC
    `);

  return { profile: customerResult.recordset[0], history: historyResult.recordset };
}

async function getSalonContext(pool, audience) {
  const [servicesResult, techniciansResult, stylesResult] = await Promise.all([
    pool.request().query(`
      SELECT s.ServiceId, s.ServiceName, s.Price, s.DurationMinutes, c.CategoryName
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      WHERE s.Status = 'AVAILABLE'
    `),
    pool.request().query(`
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
    `),
    pool.request()
      .input("Audience", sql.NVarChar(10), audience)
      .query(`
      SELECT hs.StyleId, hs.StyleCode, hs.StyleName, hs.StyleType, hs.Description,
             hs.PromptTemplate, hs.ServiceId, hs.SortOrder, s.ServiceName,
             hs.Audience, hs.IsTrending, hs.TrendScore, hs.TrendYear,
             hs.TrendSourceUrl, hs.TrendLastVerifiedAt,
             hs.LoraTrigger, hs.PromptVersion
      FROM AIHairStyles hs
      LEFT JOIN Services s ON hs.ServiceId = s.ServiceId
      WHERE hs.IsActive = 1 AND hs.Audience IN (@Audience, N'UNISEX')
      ORDER BY hs.IsTrending DESC, hs.TrendScore DESC, hs.SortOrder, hs.StyleId
    `),
  ]);
  return {
    services: servicesResult.recordset,
    technicians: techniciansResult.recordset,
    styles: stylesResult.recordset,
  };
}

function styleRecommendation(style, reason) {
  return {
    style_id: style.StyleId,
    code: style.StyleCode,
    name: style.StyleName,
    description: `${style.Description} ${reason}`.trim(),
    service_id: style.ServiceId,
    service_name: style.ServiceName,
    audience: style.Audience || "UNISEX",
    is_trending: Boolean(style.IsTrending),
    trend_score: style.TrendScore == null ? null : Number(style.TrendScore),
    trend_year: style.TrendYear || null,
    trend_source_url: style.TrendSourceUrl || null,
  };
}

function chooseByCodes(styles, codes, limit) {
  const selected = [];
  for (const code of codes) {
    const style = styles.find((item) => item.StyleCode === code);
    if (style && !selected.includes(style)) selected.push(style);
  }
  for (const style of styles) {
    if (selected.length >= limit) break;
    if (!selected.includes(style)) selected.push(style);
  }
  return selected.slice(0, limit);
}

function buildLocalPayloadLegacy(vision, salonContext) {
  const faceShape = String(vision.face_shape || "").toLowerCase();
  const skinTone = String(vision.skin_tone || "").toLowerCase();
  const haircutStyles = salonContext.styles.filter((style) => style.StyleType !== "COLOR");
  const colorStyles = salonContext.styles.filter((style) => style.StyleType === "COLOR");

  let haircutCodes = ["LAYER_FACE_FRAME", "KOREAN_VOLUME", "LONG_SOFT_WAVES"];
  if (faceShape.includes("tròn")) haircutCodes = ["LAYER_FACE_FRAME", "LONG_SOFT_WAVES", "KOREAN_VOLUME"];
  else if (faceShape.includes("vuông")) haircutCodes = ["LONG_SOFT_WAVES", "KOREAN_VOLUME", "LAYER_FACE_FRAME"];
  else if (faceShape.includes("dài")) haircutCodes = ["FRENCH_BOB", "KOREAN_VOLUME", "TEXTURED_PIXIE"];
  else if (faceShape.includes("kim cương")) haircutCodes = ["LAYER_FACE_FRAME", "FRENCH_BOB", "LONG_SOFT_WAVES"];
  else if (faceShape.includes("trái xoan")) haircutCodes = ["FRENCH_BOB", "LAYER_FACE_FRAME", "KOREAN_VOLUME"];

  let colorCodes = ["CHESTNUT_BROWN", "ASH_BROWN"];
  if (skinTone.includes("ấm")) colorCodes = ["CHESTNUT_BROWN", "COPPER_GLOW"];
  else if (skinTone.includes("lạnh")) colorCodes = ["ASH_BROWN", "PLATINUM_BEIGE"];
  else if (skinTone.includes("ngăm")) colorCodes = ["CHESTNUT_BROWN", "COPPER_GLOW"];

  const hairstyles = chooseByCodes(haircutStyles, haircutCodes, 2)
    .map((style) => styleRecommendation(style, `Phù hợp với dáng mặt ${vision.face_shape || "hiện tại"}.`));
  const colors = chooseByCodes(colorStyles, colorCodes, 2)
    .map((style) => styleRecommendation(style, `Hài hòa với ${vision.skin_tone || "tông da hiện tại"}.`));

  const hairServices = salonContext.services
    .filter((service) => /tóc|hair|nhuộm|uốn|phục hồi/i.test(`${service.ServiceName} ${service.CategoryName || ""}`))
    .sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0));
  const suggestedService = salonContext.services.find((service) => service.ServiceId === hairstyles[0]?.service_id)
    || hairServices[0]
    || salonContext.services[0]
    || null;
  const suggestedStylist = [...salonContext.technicians]
    .sort((a, b) => Number(b.AverageRating || 0) - Number(a.AverageRating || 0))[0] || null;

  return {
    analysis: {
      face_shape: vision.face_shape,
      hair_type: vision.hair_type,
      skin_tone: vision.skin_tone,
      hair_length: vision.hair_length,
      current_hair_color: vision.current_hair_color,
      confidence: vision.confidence,
      quality_score: vision.quality_score,
      warnings: vision.warnings || [],
    },
    recommendations: { hairstyles, colors },
    trending: {
      title: "Lookbook tóc đang có tại salon",
      styles: salonContext.styles.slice(0, 4).map((style) => style.StyleName),
    },
    upsell: hairServices.slice(0, 2).map((service) => ({
      service_id: service.ServiceId,
      service_name: service.ServiceName,
      reason: "Dịch vụ tóc đang có thật trong hệ thống và phù hợp để stylist tư vấn thêm sau khi kiểm tra chất tóc.",
    })),
    booking_suggestion: suggestedService ? {
      recommended_service_id: suggestedService.ServiceId,
      suggested_stylist_id: suggestedStylist?.EmployeeId || null,
      reason: suggestedStylist
        ? `${suggestedStylist.FullName} đang có đánh giá phù hợp cho buổi tư vấn trực tiếp.`
        : "Nên đặt lịch để stylist kiểm tra nền tóc và chất tóc trực tiếp.",
    } : null,
    marketing_insight: "Tư vấn được tạo từ phân tích local và dữ liệu dịch vụ thật của salon.",
    provider: vision.provider,
    model_name: vision.model_name,
    api_enhanced: Boolean(vision.api_enhanced),
    fallback_used: Boolean(vision.fallback_used),
    degraded: Boolean(vision.degraded),
  };
}

function buildLocalPayload(vision, salonContext, audience = "FEMALE") {
  const normalizedAudience = normalizeAudience(audience);
  const faceShape = String(vision.face_shape || "").toLowerCase();
  const skinTone = String(vision.skin_tone || "").toLowerCase();
  const hairLength = String(vision.hair_length || "").toLowerCase();

  const trendingStyles = salonContext.styles
    .filter((style) => style.IsTrending)
    .sort((a, b) => Number(b.TrendScore || 0) - Number(a.TrendScore || 0));

  const haircutStyles = trendingStyles.filter((style) => style.StyleType !== "COLOR");
  const colorStyles = trendingStyles.filter((style) => style.StyleType === "COLOR");

  let haircutCodes = [];
  if (normalizedAudience === "MALE") {
    haircutCodes = ["UNDERCUT_MALE", "SIDEPART_MALE", "LAYER_MALE"]; // Default
    if (faceShape.includes("tròn")) haircutCodes = ["POMPADOUR_MALE", "QUIFF_MALE", "UNDERCUT_MALE"];
    else if (faceShape.includes("vuông")) haircutCodes = ["CREWCUT_MALE", "BUZZCUT_MALE", "FRENCHCROP_MALE"];
    else if (faceShape.includes("dài")) haircutCodes = ["TWOBLOCK_MALE", "TEXTUREDFRINGE_MALE", "LAYER_MALE"];
    else if (faceShape.includes("kim cương")) haircutCodes = ["FAUXHAWK_MALE", "QUIFF_MALE", "SIDEPART_MALE"];
    else if (faceShape.includes("trái xoan")) haircutCodes = ["UNDERCUT_MALE", "SLICKEDBACK_MALE", "TWOBLOCK_MALE"];
    
    // Điều chỉnh nếu tóc ngắn
    if (hairLength.includes("ngắn")) {
      haircutCodes.unshift("BUZZCUT_MALE", "SHORTQUIFF_MALE", "CAESARCUT_MALE");
    } else if (hairLength.includes("dài")) {
      haircutCodes.unshift("MULLET_MALE", "DREADLOCKS_MALE");
    }
  } else {
    haircutCodes = ["LAYER_FEMALE", "BOB_FEMALE", "WAVY_FEMALE"]; // Default
    if (faceShape.includes("tròn")) haircutCodes = ["LOB_FEMALE", "LAYER_FEMALE", "CURTAINBANGS_FEMALE"];
    else if (faceShape.includes("vuông")) haircutCodes = ["WAVY_FEMALE", "SHAG_FEMALE", "WISPYBANGS_FEMALE"];
    else if (faceShape.includes("dài")) haircutCodes = ["BOB_FEMALE", "PIXIE_FEMALE", "CCURL_FEMALE"];
    else if (faceShape.includes("kim cương")) haircutCodes = ["BUTTERFLY_FEMALE", "WOLF_FEMALE", "LOOSECURLS_FEMALE"];
    else if (faceShape.includes("trái xoan")) haircutCodes = ["HIME_FEMALE", "STRAIGHT_FEMALE", "BIGCURLS_FEMALE"];
    
    // Ưu tiên theo độ dài
    if (hairLength.includes("ngắn")) {
      haircutCodes.unshift("PIXIE_FEMALE", "BOB_FEMALE");
    } else if (hairLength.includes("ngang vai") || hairLength.includes("trung bình")) {
      haircutCodes.unshift("LOB_FEMALE", "FLIPPEDENDS_FEMALE", "MULLET_FEMALE");
    } else if (hairLength.includes("dài")) {
      haircutCodes.unshift("LAYER_FEMALE", "WAVY_FEMALE", "BIGCURLS_FEMALE");
    }
  }

  // Cập nhật mảng màu nếu có
  let colorCodes = [];
  if (skinTone.includes("ấm")) colorCodes = ["NÂU HẠT DẺ", "ĐỒNG ÁNH ĐỎ"];
  else if (skinTone.includes("lạnh")) colorCodes = ["NÂU KHÓI", "BẠCH KIM"];
  else if (skinTone.includes("ngăm")) colorCodes = ["NÂU SOCOLA", "NÂU ĐỎ"];

  const hairstyles = chooseByCodes(haircutStyles, haircutCodes, 3)
    .map((style) => styleRecommendation(style, `Rất hợp với dáng mặt ${vision.face_shape || "của bạn"} và phù hợp với nền tóc ${vision.hair_length || "hiện tại"}.`));
  const colors = chooseByCodes(colorStyles, colorCodes, 2)
    .map((style) => styleRecommendation(style, `Tôn lên ${vision.skin_tone || "tông da hiện tại"} của bạn.`));

  const hairServices = salonContext.services
    .filter((service) => /tóc|hair|nhuộm|uốn|phục hồi/i.test(`${service.ServiceName} ${service.CategoryName || ""}`))
    .sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0));
  const suggestedService = salonContext.services.find((service) => service.ServiceId === hairstyles[0]?.service_id)
    || hairServices[0]
    || salonContext.services[0]
    || null;
  const suggestedStylist = [...salonContext.technicians]
    .sort((a, b) => Number(b.AverageRating || 0) - Number(a.AverageRating || 0))[0] || null;

  return {
    audience: normalizedAudience,
    analysis: {
      is_face: vision.is_face,
      is_frontal: vision.is_frontal,
      pose: vision.pose,
      pose_score: vision.pose_score,
      analysis_route: vision.analysis_route,
      face_shape: vision.face_shape,
      hair_type: vision.hair_type,
      skin_tone: vision.skin_tone,
      hair_length: vision.hair_length,
      current_hair_color: vision.current_hair_color,
      confidence: vision.confidence,
      quality_score: vision.quality_score,
      warnings: vision.warnings || [],
    },
    recommendations: { hairstyles, colors },
    trending: {
      title: normalizedAudience === "MALE" ? "Hot trend tóc nam 2026" : "Hot trend tóc nữ 2026",
      styles: trendingStyles.slice(0, 6).map((style) => style.StyleName),
      catalog: trendingStyles.slice(0, 6).map((style) => styleRecommendation(style, "Xu hướng đã được biên tập và xác minh nguồn.")),
      verified_at: trendingStyles[0]?.TrendLastVerifiedAt || null,
    },
    upsell: hairServices.slice(0, 2).map((service) => ({
      service_id: service.ServiceId,
      service_name: service.ServiceName,
      reason: "Dịch vụ thật trong hệ thống, phù hợp để stylist kiểm tra nền tóc và chất tóc trước khi thực hiện.",
    })),
    booking_suggestion: suggestedService ? {
      recommended_service_id: suggestedService.ServiceId,
      suggested_stylist_id: suggestedStylist?.EmployeeId || null,
      reason: suggestedStylist
        ? `${suggestedStylist.FullName} đang có đánh giá phù hợp cho buổi tư vấn trực tiếp.`
        : "Nên đặt lịch để stylist kiểm tra nền tóc và chất tóc trực tiếp.",
    } : null,
    marketing_insight: "API phân tích đặc điểm; catalog và lịch sử dịch vụ lấy từ database thật; ảnh thử tóc có thể tạo qua Gemini hoặc Local.",
    pipeline: {
      analysis: "API_FIRST_WITH_LOCAL_FALLBACK",
      try_on: "API_OR_LOCAL",
      zero_generation_api_cost: false,
    },
    provider: vision.provider,
    model_name: vision.model_name,
    api_enhanced: Boolean(vision.api_enhanced),
    fallback_used: Boolean(vision.fallback_used),
    degraded: Boolean(vision.degraded),
    warnings: vision.warnings || [],
  };
}

function findCatalogStyle(value, styles, type) {
  const needle = String(value?.code || value?.name || "").toLowerCase().trim();
  if (!needle) return null;
  return styles.find((style) => style.StyleType === type && (
    String(style.StyleCode).toLowerCase() === needle
    || String(style.StyleName).toLowerCase() === needle
    || needle.includes(String(style.StyleName).toLowerCase())
    || String(style.StyleName).toLowerCase().includes(needle)
  )) || null;
}

function normalizeApiPayload(apiPayload, localPayload, salonContext) {
  const apiRecommendations = apiPayload?.recommendations || {};
  const hairstyles = (Array.isArray(apiRecommendations.hairstyles) ? apiRecommendations.hairstyles : [])
    .map((item) => ({ item, style: findCatalogStyle(item, salonContext.styles, "CUT")
      || findCatalogStyle(item, salonContext.styles, "TEXTURE") }))
    .filter(({ style }) => style)
    .map(({ item, style }) => styleRecommendation(style, item.description || ""));
  const colors = (Array.isArray(apiRecommendations.colors) ? apiRecommendations.colors : [])
    .map((item) => ({ item, style: findCatalogStyle(item, salonContext.styles, "COLOR") }))
    .filter(({ style }) => style)
    .map(({ item, style }) => styleRecommendation(style, item.description || ""));

  const serviceIds = new Set(salonContext.services.map((service) => Number(service.ServiceId)));
  const employeeIds = new Set(salonContext.technicians.map((employee) => Number(employee.EmployeeId)));
  const upsell = (Array.isArray(apiPayload?.upsell) ? apiPayload.upsell : [])
    .filter((item) => serviceIds.has(Number(item.service_id)));
  const booking = apiPayload?.booking_suggestion;
  const validBooking = booking && serviceIds.has(Number(booking.recommended_service_id))
    ? {
      ...booking,
      suggested_stylist_id: employeeIds.has(Number(booking.suggested_stylist_id))
        ? Number(booking.suggested_stylist_id)
        : localPayload.booking_suggestion?.suggested_stylist_id || null,
    }
    : localPayload.booking_suggestion;

  const trendingStyles = Array.isArray(apiPayload?.trending?.styles)
    ? apiPayload.trending.styles
    : typeof apiPayload?.trending?.styles === "string"
      ? apiPayload.trending.styles.split(",").map((item) => item.trim()).filter(Boolean)
      : localPayload.trending.styles;

  return {
    ...localPayload,
    ...apiPayload,
    analysis: localPayload.analysis,
    audience: localPayload.audience,
    pipeline: localPayload.pipeline,
    recommendations: {
      hairstyles: hairstyles.length ? hairstyles : localPayload.recommendations.hairstyles,
      colors: colors.length ? colors : localPayload.recommendations.colors,
    },
    trending: {
      title: apiPayload?.trending?.title || localPayload.trending.title,
      styles: trendingStyles,
    },
    upsell: upsell.length ? upsell : localPayload.upsell,
    booking_suggestion: validBooking,
    provider: `${localPayload.provider}+api-advisor`,
    model_name: `${localPayload.model_name} + AI Advisor`,
    api_enhanced: true,
    fallback_used: false,
  };
}

function buildAdvisorPrompt(profile, history, visionResult, salonContext) {
  const historyText = history.length
    ? history.slice(0, 12).map((item) => `- ${new Date(item.AppointmentDate).toLocaleDateString("vi-VN")}: ${item.Services || "Dịch vụ chưa rõ"}; đánh giá ${item.Rating || "chưa có"}/5.`).join("\n")
    : "Chưa có lịch sử làm tóc tại salon.";
  const serviceText = salonContext.services.map((service) => `- ID [${service.ServiceId}]: ${service.ServiceName} (${Number(service.Price || 0).toLocaleString("vi-VN")}đ)`).join("\n");
  const stylistText = salonContext.technicians.map((stylist) => `- ID [${stylist.EmployeeId}]: ${stylist.FullName}; đánh giá ${stylist.AverageRating}/5`).join("\n");
  const styleText = salonContext.styles.map((style) => `- ${style.StyleCode}: ${style.StyleName}; loại ${style.StyleType}; service_id ${style.ServiceId || "null"}`).join("\n");
  return `[PHÂN TÍCH ẢNH ĐÃ CHUẨN HÓA]
- Dáng mặt: ${visionResult.face_shape}
- Tóc hiện tại: ${visionResult.hair_type}
- Tông da: ${visionResult.skin_tone}

[KHÁCH HÀNG]
- Tên: ${profile.FullName}
- Điểm: ${profile.LoyaltyPoints}; hạng ${profile.LevelName || "Standard"}
${historyText}

[MẪU TÓC ĐƯỢC PHÉP ĐỀ XUẤT]
${styleText}

[DỊCH VỤ THẬT]
${serviceText}

[STYLIST THẬT]
${stylistText}

Chỉ dùng mã mẫu, service_id và stylist_id có trong danh sách trên. Trả JSON đúng contract.`;
}

function parseAiPayload(response) {
  const clean = String(response || "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

async function logPrediction(pool, customerId, profile, payload) {
  try {
    const auditPayload = { ...payload };
    delete auditPayload.image_url;
    await pool.request()
      .input("PredictionType", sql.NVarChar, "STYLIST_ADVISOR")
      .input("Result", sql.NVarChar, `Đề xuất kiểu tóc cho KH ${profile.FullName}: ${payload.recommendations?.hairstyles?.[0]?.name || "Không có"}`)
      .query("INSERT INTO AIPredictions (PredictionType, Result) VALUES (@PredictionType, @Result)");
    await pool.request()
      .input("UserId", sql.Int, profile.UserId)
      .input("FeatureName", sql.NVarChar, "AI Stylist Advisor")
      .input("Prompt", sql.NVarChar, `Phân tích ảnh chân dung CustomerId ${customerId}`)
      .input("AIResponse", sql.NVarChar(sql.MAX), JSON.stringify(auditPayload))
      .input("ModelName", sql.NVarChar, payload.model_name || "salon-local-stylist")
      .input("InputToken", sql.Int, null)
      .input("OutputToken", sql.Int, null)
      .input("Cost", sql.Decimal(18, 4), payload.api_enhanced ? null : 0)
      .query(`
        INSERT INTO AIAuditLogs (UserId, FeatureName, Prompt, AIResponse, ModelName, InputToken, OutputToken, Cost)
        VALUES (@UserId, @FeatureName, @Prompt, @AIResponse, @ModelName, @InputToken, @OutputToken, @Cost)
      `);
  } catch (error) {
    console.error("[AI Stylist] DB logging failed:", error.message);
  }
}

async function getStylistRecommendations(customerId, imageUrl, audience) {
  const pool = await connectDB();
  const rawAudience = String(audience || "").trim().toUpperCase();
  const requestedAudience = ["MALE", "FEMALE"].includes(rawAudience) ? rawAudience : null;
  const customerContextPromise = getCustomerContext(pool, customerId);
  const visionPromise = analyzeImage(imageUrl);
  const salonContextPromise = requestedAudience
    ? getSalonContext(pool, requestedAudience)
    : customerContextPromise.then((context) => getSalonContext(
      pool,
      normalizeAudience(null, context?.profile?.Gender),
    ));
  const [customerContext, visionResult, salonContext] = await Promise.all([
    customerContextPromise,
    visionPromise,
    salonContextPromise,
  ]);
  const selectedAudience = normalizeAudience(requestedAudience, customerContext?.profile?.Gender);
  if (!customerContext) throw new Error(`Không tìm thấy khách hàng với CustomerId: ${customerId}`);
  if (visionResult.is_face === false) {
    throw new Error(visionResult.error || "Không nhận diện được khuôn mặt trong ảnh. Vui lòng dùng ảnh chân dung rõ nét hơn.");
  }
  if (visionResult.is_frontal !== true) {
    throw new Error("Ảnh chưa chính diện. Vui lòng nhìn thẳng vào camera, giữ đầu cân bằng và để thấy rõ hai bên tóc.");
  }

  const localPayload = buildLocalPayload(visionResult, salonContext, selectedAudience);
  let finalPayload = localPayload;
  const advisorApiEnabled = String(process.env.AI_STYLIST_API_ENHANCE_ENABLED || "true").toLowerCase() !== "false";
  // If vision providers already exhausted their quota/timeout, do not call the
  // same providers a second time. Local DB-backed recommendations are complete
  // and keep the response inside the interactive request timeout.
  if (advisorApiEnabled && visionResult.api_enhanced) {
    try {
      const prompt = buildAdvisorPrompt(customerContext.profile, customerContext.history, visionResult, salonContext);
      const response = await generateContent(SYSTEM_PROMPT, prompt, {
        jsonMode: true,
        maxTokens: 4096,
        timeoutMs: Math.max(3000, Number(process.env.AI_STYLIST_TIMEOUT_MS) || 5000),
        maxProviderAttempts: Math.max(1, Number(process.env.AI_STYLIST_API_MAX_ATTEMPTS) || 2),
      });
      finalPayload = normalizeApiPayload(parseAiPayload(response), localPayload, salonContext);
    } catch (error) {
      console.warn("[AI Stylist] API advisor unavailable, using local recommendations:", error.message);
      finalPayload = {
        ...localPayload,
        fallback_used: true,
        warnings: [...(localPayload.warnings || []), "Tư vấn API không khả dụng; đang dùng đề xuất local từ dữ liệu salon."],
      };
    }
  }

  const responsePayload = {
    ...finalPayload,
    is_fallback: Boolean(finalPayload.fallback_used),
  };
  // Audit persistence must never block an interactive AI response.
  void logPrediction(pool, customerId, customerContext.profile, responsePayload);
  return responsePayload;
}

module.exports = {
  buildLocalPayload,
  getStylistRecommendations,
  normalizeApiPayload,
  normalizeAudience,
};
