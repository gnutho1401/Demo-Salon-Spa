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
    const expandedTrendMigration = read("../database/migrations/expand_ai_hair_trends_2026_15.sql");
    expect(trendMigration).toContain("Audience NVARCHAR(10)");
    expect(trendMigration).toContain("IsTrending");
    expect(trendMigration).toContain("TrendSourceUrl");
    expect(trendMigration).toContain("SOFT_MODERN_MULLET_2026");
    expect(trendMigration).toContain("BUTTERFLY_LAYERS_2026");
    expect(expandedTrendMigration).toContain("BOX_BOB_2026");
    expect(expandedTrendMigration).toContain("MODERN_RACHEL_2026");
    expect(expandedTrendMigration).toContain("HEARTTHROB_FLOW_2026");
    expect(expandedTrendMigration).toContain("CHAMPAGNE_BRUNETTE_2026");
    expect((expandedTrendMigration.match(/hairtrend_[a-z0-9_]+_2026/g) || []).length).toBe(15);
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

  it("requires a verified frontal portrait and never persists its base64 in advisor audit", () => {
    const stylistSource = read("src/modules/ai/stylist/stylist.service.js");
    const workerSource = read("../ai-worker/hair-tryon/app/engine.py");

    expect(serviceSource).toContain("AI_HAIR_REQUIRE_FRONTAL");
    expect(serviceSource).toContain("pose.is_frontal !== true");
    expect(stylistSource).toContain("visionResult.is_frontal !== true");
    expect(stylistSource).toContain("delete auditPayload.image_url");
    expect(stylistSource).toContain("void logPrediction");
    expect(stylistSource).toContain("advisorApiEnabled && visionResult.api_enhanced");
    expect(stylistSource).toContain("SELECT TOP (12)");
    expect(workerSource).toContain("if not is_frontal:");
  });

  it("keeps automatic Internet discovery outside training until rights are reviewed", () => {
    const collectorSource = read("../ai-worker/hair-tryon/scripts/collect_openverse_hair_dataset.py");
    const preparationSource = read("../ai-worker/hair-tryon/scripts/prepare_lora_dataset.py");
    const runnerSource = read("../ai-worker/hair-tryon/scripts/run_automatic_dataset_pipeline.ps1");

    expect(collectorSource).toContain("https://api.openverse.org/v1/images/");
    expect(collectorSource).toContain('"code": "MODERN_RACHEL_2026"');
    expect(collectorSource).toContain('"code": "HEARTTHROB_FLOW_2026"');
    expect(collectorSource).toContain('"code": "CHERRY_MOCHA_2026"');
    expect(collectorSource).toContain('"rights_verified": False');
    expect(collectorSource).toContain('"personality_rights_verified": False');
    expect(collectorSource).toContain('"style_verified": False');
    expect(collectorSource).toContain('"training_approved": False');
    expect(preparationSource).toContain('rights_basis == "OPEN_LICENSE_DISCOVERY"');
    expect(preparationSource).toContain('record.get("personality_rights_verified") is not True');
    expect(preparationSource).toContain('record.get("style_verified") is not True');
    expect(preparationSource).toContain('record.get("training_approved") is not True');
    expect(preparationSource).toContain("if not is_frontal:");
    expect(runnerSource).toContain("Stopped before preparation");
    expect(runnerSource).toContain("[switch]$Train");
  });
});
