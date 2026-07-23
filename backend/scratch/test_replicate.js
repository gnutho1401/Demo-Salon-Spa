const axios = require("axios");

const token = process.env.REPLICATE_API_TOKEN || "";
// A small sample public image url for testing
const testImageUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200";
const prompt = "make her hair pink";

async function test() {
  try {
    console.log("Sending prediction request to Replicate...");
    const startResponse = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: "30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
        input: {
          image: testImageUrl,
          prompt: prompt,
          num_outputs: 1,
          guidance_scale: 7.5,
          image_guidance_scale: 1.5,
          num_inference_steps: 15
        }
      },
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Start prediction response status:", startResponse.status);
    console.log("Prediction ID:", startResponse.data.id);
    console.log("Status:", startResponse.data.status);
    console.log("Urls:", startResponse.data.urls);
    
    let prediction = startResponse.data;
    const getUrl = prediction.urls.get;

    let attempts = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 15) {
      console.log(`Polling status (attempt ${attempts + 1})... Current status: ${prediction.status}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const checkResponse = await axios.get(getUrl, {
        headers: { Authorization: `Token ${token}` }
      });
      prediction = checkResponse.data;
      attempts++;
    }
    
    console.log("Final status:", prediction.status);
    if (prediction.status === "succeeded") {
      console.log("Output:", prediction.output);
    } else {
      console.error("Error details:", prediction.error);
    }
  } catch (err) {
    console.error("Axios Error:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", JSON.stringify(err.response.data));
    } else {
      console.error("Message:", err.message);
    }
  }
}

test();
