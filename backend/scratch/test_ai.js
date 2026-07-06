const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { getStylistRecommendations } = require('../src/modules/ai/stylist/stylist.service');

// Test with an actual customerId from the database
async function test() {
  console.log("\n--- Testing getStylistRecommendations end-to-end ---");
  const img = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?fit=crop&w=500&h=500";

  try {
    // customerId = 1 (change if needed)
    const result = await getStylistRecommendations(1, img);
    console.log("\n=== AI RESULT ===");
    console.log("Analysis:", JSON.stringify(result.analysis, null, 2));
    console.log("Recommendations:", JSON.stringify(result.recommendations, null, 2));
    console.log("Upsell:", JSON.stringify(result.upsell, null, 2));
    console.log("Booking suggestion:", JSON.stringify(result.booking_suggestion, null, 2));
    console.log("\n=== SUCCESS - Real AI response obtained! ===");
  } catch (err) {
    console.error("FAILED:", err.message);
    if (err.stack) console.error(err.stack);
  }

  process.exit(0);
}

test();
