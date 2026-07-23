jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require("axios");
const {
  analyzeImage,
  buildSafeFallback,
  mergeAnalysis,
} = require("../../src/modules/ai/vision/face_analysis.service");
const {
  buildLocalPayload,
  normalizeApiPayload,
} = require("../../src/modules/ai/stylist/stylist.service");

const IMAGE_DATA_URL = `data:image/jpeg;base64,${Buffer.from("test-image").toString("base64")}`;

function localVision(overrides = {}) {
  return {
    is_face: true,
    is_frontal: true,
    pose: "frontal",
    pose_score: 0.91,
    face_shape: "Tròn",
    hair_type: "Tóc trung bình, sắc nâu tự nhiên",
    hair_length: "Tóc trung bình",
    current_hair_color: "nâu tự nhiên",
    skin_tone: "Tông da sáng ấm",
    provider: "local",
    model_name: "bisenet-resnet18",
    confidence: 0.88,
    quality_score: 0.84,
    warnings: [],
    metrics: { face_ratio: 0.08 },
    ...overrides,
  };
}

function salonContext() {
  return {
    styles: [
      { StyleId: 1, StyleCode: "LAYER_FACE_FRAME", StyleName: "Layer ôm khuôn mặt", StyleType: "CUT", Audience: "FEMALE", Description: "Layer mềm.", ServiceId: 10, ServiceName: "Cắt tóc" },
      { StyleId: 2, StyleCode: "LONG_SOFT_WAVES", StyleName: "Sóng dài mềm mại", StyleType: "TEXTURE", Audience: "FEMALE", Description: "Sóng lơi.", ServiceId: 11, ServiceName: "Uốn tóc" },
      { StyleId: 3, StyleCode: "CHESTNUT_BROWN", StyleName: "Nâu hạt dẻ", StyleType: "COLOR", Audience: "UNISEX", Description: "Nâu ấm.", ServiceId: 12, ServiceName: "Nhuộm tóc" },
      { StyleId: 4, StyleCode: "COPPER_GLOW", StyleName: "Đồng ánh quế", StyleType: "COLOR", Audience: "UNISEX", Description: "Đồng ấm.", ServiceId: 12, ServiceName: "Nhuộm tóc" },
    ],
    services: [
      { ServiceId: 10, ServiceName: "Cắt tóc", Price: 200000, CategoryName: "Tóc" },
      { ServiceId: 11, ServiceName: "Uốn tóc", Price: 600000, CategoryName: "Tóc" },
      { ServiceId: 12, ServiceName: "Nhuộm tóc", Price: 700000, CategoryName: "Tóc" },
    ],
    technicians: [
      { EmployeeId: 7, FullName: "Stylist Local", AverageRating: 4.9 },
    ],
  };
}

describe("AI Stylist hybrid local/API", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.AI_VISION_LOCAL_ENABLED = "true";
    process.env.AI_VISION_API_ENHANCE_ENABLED = "false";
    process.env.AI_VISION_STRATEGY = "api-first";
    process.env.LOCAL_HAIR_API_URL = "http://127.0.0.1:8189";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns normalized local analysis without requiring a cloud API", async () => {
    axios.post.mockResolvedValueOnce({ data: localVision() });

    const result = await analyzeImage(IMAGE_DATA_URL);

    expect(axios.post).toHaveBeenCalledWith(
      "http://127.0.0.1:8189/v1/analyze",
      expect.objectContaining({ mime_type: "image/jpeg" }),
      expect.any(Object),
    );
    expect(result).toEqual(expect.objectContaining({
      provider: "local",
      model_name: "bisenet-resnet18",
      face_shape: "Tròn",
      api_enhanced: false,
    }));
  });

  it("merges API enrichment with the required local analysis", async () => {
    process.env.AI_VISION_API_ENHANCE_ENABLED = "true";
    process.env.AI_VISION_PROVIDER_ORDER = "gemini,local";
    process.env.GEMINI_API_KEY = "test-key";
    axios.post
      .mockResolvedValueOnce({
        data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
          is_face: true,
          is_frontal: true,
          pose: "frontal",
          pose_score: 0.94,
          face_shape: "Trái xoan",
          hair_type: "Tóc dày tự nhiên",
          skin_tone: "Tông da sáng trung tính",
        }) }] } }] },
      })
      .mockResolvedValueOnce({ data: localVision() });

    const result = await analyzeImage(IMAGE_DATA_URL);

    expect(result.provider).toBe("local+google");
    expect(result.api_enhanced).toBe(true);
    expect(result.local_analysis.provider).toBe("local");
    expect(result.face_shape).toBe("Trái xoan");
    expect(result.analysis_route).toBe("API_WITH_LOCAL_SAFETY");
  });

  it("keeps the lookbook available when every analyzer is unavailable", async () => {
    axios.post.mockRejectedValueOnce(new Error("worker offline"));

    const result = await analyzeImage(IMAGE_DATA_URL);

    expect(result).toEqual(expect.objectContaining({
      provider: "safe-local-fallback",
      fallback_used: true,
      degraded: true,
      is_face: true,
    }));
  });

  it("builds recommendations only from real salon styles and services", () => {
    const payload = buildLocalPayload(localVision(), salonContext());

    expect(payload.recommendations.hairstyles.map((item) => item.code)).toContain("LAYER_FACE_FRAME");
    expect(payload.recommendations.colors.map((item) => item.code)).toEqual(expect.arrayContaining(["CHESTNUT_BROWN", "COPPER_GLOW"]));
    expect(payload.booking_suggestion.recommended_service_id).toBe(10);
    expect(payload.booking_suggestion.suggested_stylist_id).toBe(7);
  });

  it("keeps male and female trend catalogs separated", () => {
    const context = salonContext();
    context.styles.push(
      { StyleId: 20, StyleCode: "SOFT_MODERN_MULLET_2026", StyleName: "Soft modern mullet", StyleType: "CUT", Audience: "MALE", IsTrending: true, TrendScore: 99, Description: "Mullet mềm.", ServiceId: 10, ServiceName: "Cắt tóc" },
      { StyleId: 21, StyleCode: "BUTTERFLY_LAYERS_2026", StyleName: "Butterfly layers", StyleType: "CUT", Audience: "FEMALE", IsTrending: true, TrendScore: 98, Description: "Layer cánh bướm.", ServiceId: 10, ServiceName: "Cắt tóc" },
    );

    const male = buildLocalPayload(localVision(), { ...context, styles: context.styles.filter((style) => ["MALE", "UNISEX"].includes(style.Audience)) }, "MALE");
    const female = buildLocalPayload(localVision(), { ...context, styles: context.styles.filter((style) => ["FEMALE", "UNISEX"].includes(style.Audience)) }, "FEMALE");

    expect(male.audience).toBe("MALE");
    expect(male.recommendations.hairstyles[0].code).toBe("SOFT_MODERN_MULLET_2026");
    expect(female.audience).toBe("FEMALE");
    expect(female.recommendations.hairstyles[0].code).toBe("BUTTERFLY_LAYERS_2026");
  });

  it("rejects hallucinated API catalog entries and preserves local recommendations", () => {
    const localPayload = buildLocalPayload(localVision(), salonContext());
    const merged = normalizeApiPayload({
      recommendations: {
        hairstyles: [{ name: "Kiểu tóc không tồn tại" }],
        colors: [{ name: "Màu không tồn tại" }],
      },
      upsell: [{ service_id: 9999, service_name: "Dịch vụ giả" }],
      booking_suggestion: { recommended_service_id: 9999, suggested_stylist_id: 9999 },
    }, localPayload, salonContext());

    expect(merged.recommendations).toEqual(localPayload.recommendations);
    expect(merged.upsell).toEqual(localPayload.upsell);
    expect(merged.booking_suggestion).toEqual(localPayload.booking_suggestion);
  });

  it("keeps local identity fields authoritative when API data is merged", () => {
    const merged = mergeAnalysis(
      { ...localVision(), warnings: [] },
      { ...localVision({ provider: "google", model_name: "gemini", face_shape: "Vuông" }), api_enhanced: true },
    );
    expect(merged.face_shape).toBe("Vuông");
    expect(merged.local_analysis.provider).toBe("local");
  });

  it("produces a standardized safe fallback contract", () => {
    const fallback = buildSafeFallback(["local: offline"]);
    expect(fallback.warnings).toEqual(expect.arrayContaining(["local: offline"]));
    expect(fallback.model_name).toBe("salon-rule-engine");
  });
});
