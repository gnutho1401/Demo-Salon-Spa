const axios = require("axios");

// We'll use a sample image URL to test
const testImageUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200";
const prompt = "make her hair pink";

async function test() {
  try {
    console.log("Calling free Hugging Face Gradio Space API...");
    const response = await axios.post(
      "https://timbrooks-instruct-pix2pix.hf.space/api/predict",
      {
        data: [
          testImageUrl,      // Image input (can be URL)
          prompt,            // Prompt instruction
          7.5,               // Text guidance scale
          1.5,               // Image guidance scale
          15,                // Steps
          0                  // Seed
        ]
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 25000
      }
    );
    console.log("Response status:", response.status);
    console.log("Response data keys:", Object.keys(response.data));
    if (response.data && response.data.data) {
      console.log("Success! Output:", response.data.data);
    } else {
      console.log("Response:", JSON.stringify(response.data));
    }
  } catch (err) {
    console.error("Gradio API Error:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data));
    } else {
      console.error("Message:", err.message);
    }
  }
}

test();
