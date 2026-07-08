const Replicate = require("replicate");

async function editHair(imageUrl, prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  const normalizedPrompt = String(prompt || '').toLowerCase();

  // 1. Nếu có token Replicate trong file .env, gọi thực tế đến model InstructPix2Pix
  if (token) {
    try {
      console.log("[AI Hair Try-on] Found Replicate API Token. Starting real inference...");
      const replicate = new Replicate({ auth: token });
      
      const output = await replicate.run(
        "timbrooks/instruct-pix2pix:30c1d0b916a6f8efce20f144d7b3c6c31934a772458ddaf597be6e576fc9e614",
        {
          input: {
            image: imageUrl,
            prompt: prompt,
            num_outputs: 1,
            guidance_scale: 7.5,
            image_guidance_scale: 1.5,
            num_inference_steps: 25
          }
        }
      );

      if (output && output.length > 0) {
        console.log("[AI Hair Try-on] Real Replicate call successful:", output[0]);
        return {
          success: true,
          edited_image_url: output[0],
          is_mock: false
        };
      }
      throw new Error("Không nhận được ảnh kết quả từ Replicate API.");
    } catch (err) {
      console.error("[AI Hair Try-on Replicate Error, falling back to mock]:", err.message);
    }
  }

  // 2. Chế độ Mock Fallback thông minh: Dựa vào từ khóa trong prompt trả về ảnh Unsplash chất lượng cao
  console.log("[AI Hair Try-on] Running in smart mock simulation mode...");
  await new Promise(resolve => setTimeout(resolve, 1500)); // Giả lập độ trễ mạng 1.5s giống AI thật

  let mockUrl = "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&auto=format&fit=crop&q=80"; // Mặc định: tóc vàng/nâu hạt dẻ uốn nhẹ

  if (normalizedPrompt.includes("hồng") || normalizedPrompt.includes("pink")) {
    // Tóc hồng cá tính
    mockUrl = "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("xanh") || normalizedPrompt.includes("blue") || normalizedPrompt.includes("rêu") || normalizedPrompt.includes("green")) {
    // Tóc xanh dương khói
    mockUrl = "https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("vàng") || normalizedPrompt.includes("blonde") || normalizedPrompt.includes("bạch kim") || normalizedPrompt.includes("platinum")) {
    // Tóc vàng bạch kim sang chảnh
    mockUrl = "https://images.unsplash.com/photo-1605980776566-0486c3ac7617?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("ngắn") || normalizedPrompt.includes("short") || normalizedPrompt.includes("pixie") || normalizedPrompt.includes("bob")) {
    // Tóc tém ngắn pixie cá tính
    mockUrl = "https://images.unsplash.com/photo-1595959183075-c1d09e77f34b?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("đỏ") || normalizedPrompt.includes("red")) {
    // Tóc đỏ hung quyến rũ
    mockUrl = "https://images.unsplash.com/photo-1582126892902-60292b3a6288?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("xoăn") || normalizedPrompt.includes("curly") || normalizedPrompt.includes("xoắn") || normalizedPrompt.includes("wavy")) {
    // Tóc uốn xoăn lọn dài quyến rũ
    mockUrl = "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600&auto=format&fit=crop&q=80";
  } else if (normalizedPrompt.includes("tím") || normalizedPrompt.includes("purple")) {
    // Tóc tím pastel khói
    mockUrl = "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80";
  }

  return {
    success: true,
    edited_image_url: mockUrl,
    is_mock: true
  };
}

module.exports = { editHair };
