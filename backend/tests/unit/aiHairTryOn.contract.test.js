const fs = require("fs");
const path = require("path");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");
}

describe("AI Hair Try-on contract", () => {
  const serviceSource = read("src/modules/ai/stylist/hair.service.js");
  const controllerSource = read("src/modules/ai/stylist/hair.controller.js");
  const migrationSource = read("../database/migrations/create_ai_hair_tryon.sql");

  it("uses the zero-fee local provider first and keeps opt-in real-provider fallbacks", () => {
    expect(serviceSource).toContain('provider: "local"');
    expect(serviceSource).toContain("AI_HAIR_FORCE_LOCAL");
    expect(serviceSource).toContain("LOCAL_HAIR_API_URL");
    expect(serviceSource).toContain("https://fal.run/${model}");
    expect(serviceSource).toContain('"local,fal,gemini,openrouter,replicate"');
    expect(serviceSource).toContain('provider: "fal"');
    expect(serviceSource).not.toMatch(/unsplash|is_mock:\s*true/i);
  });

  it("stores gender-scoped, source-verified trend metadata", () => {
    const trendMigration = read("../database/migrations/upgrade_ai_hair_trends_2026.sql");
    expect(trendMigration).toContain("Audience NVARCHAR(10)");
    expect(trendMigration).toContain("IsTrending");
    expect(trendMigration).toContain("TrendSourceUrl");
    expect(trendMigration).toContain("SOFT_MODERN_MULLET_2026");
    expect(trendMigration).toContain("BUTTERFLY_LAYERS_2026");
  });

  it("persists normalized styles and private try-on history", () => {
    expect(migrationSource).toMatch(/CREATE TABLE dbo\.AIHairStyles/i);
    expect(migrationSource).toMatch(/CREATE TABLE dbo\.AIHairTryOns/i);
    expect(serviceSource).toContain("PRIVATE_IMAGE_ROOT");
    expect(serviceSource).toContain("purgeExpiredTryOns");
  });

  it("returns provider failures as an upstream error, not invalid user input", () => {
    expect(controllerSource).toContain("clientError ? 400 : 502");
    expect(controllerSource).not.toMatch(/const clientError = \/Vui lòng\|không hợp lệ/);
  });

  it("exposes local analysis and does not let cloud quota block the lookbook", () => {
    const visionSource = read("src/modules/ai/vision/face_analysis.service.js");
    const stylistSource = read("src/modules/ai/stylist/stylist.service.js");
    const workerSource = read("../ai-worker/hair-tryon/app/main.py");

    expect(workerSource).toContain('@app.post("/v1/analyze"');
    expect(visionSource).toContain("AI_VISION_API_ENHANCE_ENABLED");
    expect(visionSource).toContain("safe-local-fallback");
    expect(stylistSource).toContain("buildLocalPayload");
    expect(stylistSource).toContain("API advisor unavailable, using local recommendations");
  });
});
