const axios = require("axios");
const dns = require("dns").promises;
const https = require("https");

// Set dns servers specifically for the promises module
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

// A sample public image url for testing
const testImageUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200";
const prompt = "make her hair pink";

async function test() {
  try {
    console.log("Resolving api-inference.huggingface.co manually via Google DNS...");
    const ips = await dns.resolve4("api-inference.huggingface.co");
    console.log("Resolved IPs:", ips);
    if (!ips || ips.length === 0) {
      throw new Error("Could not resolve IP address.");
    }
    
    const targetIp = ips[0];
    console.log(`Using resolved IP ${targetIp} to call Hugging Face...`);

    // Download sample image as buffer
    const imgResponse = await axios.get(testImageUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imgResponse.data);

    // Call Hugging Face API using resolved IP
    const response = await axios.post(
      `https://${targetIp}/models/timbrooks/instruct-pix2pix`,
      buffer,
      {
        headers: {
          "Host": "api-inference.huggingface.co",
          "Content-Type": "image/jpeg",
          "X-Prompt": prompt
        },
        params: {
          prompt: prompt
        },
        // Disable SSL certificate check since we are using raw IP address
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        responseType: "arraybuffer"
      }
    );

    console.log("Success! Response status:", response.status);
    console.log("Response content type:", response.headers["content-type"]);
    console.log("Response length:", response.data.length);
  } catch (err) {
    console.error("Manual DNS Hugging Face API Error:");
    if (err.response) {
      console.error("Status:", err.response.status);
      const errText = Buffer.from(err.response.data).toString("utf-8");
      console.error("Data:", errText);
    } else {
      console.error("Message:", err.message);
    }
  }
}

test();
