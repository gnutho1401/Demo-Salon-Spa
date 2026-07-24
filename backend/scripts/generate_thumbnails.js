const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Lỗi: Không tìm thấy GEMINI_API_KEY trong file .env");
  process.exit(1);
}

// 36 Kiểu tóc
const styles = [
  // NAM
  { code: 'UNDERCUT_MALE', audience: 'MALE', name: 'Undercut', desc: 'Cắt ngắn hoặc cạo hai bên và phía sau, phần tóc trên đỉnh đầu để dài hơn để vuốt ngược hoặc tạo kiểu.' },
  { code: 'POMPADOUR_MALE', audience: 'MALE', name: 'Pompadour', desc: 'Phần tóc mái được vuốt ngược và tạo độ phồng lớn, mang lại vẻ lịch lãm, cổ điển.' },
  { code: 'QUIFF_MALE', audience: 'MALE', name: 'Quiff', desc: 'Gần giống Pompadour nhưng phần mái vuốt hắt lên trên và hơi hướng về phía trước, trẻ trung hơn.' },
  { code: 'SIDEPART_MALE', audience: 'MALE', name: 'Side Part', desc: 'Tóc được chia ngôi lệch (7/3 hoặc 8/2), chải chuốt gọn gàng, phù hợp với môi trường công sở.' },
  { code: 'TWOBLOCK_MALE', audience: 'MALE', name: 'Two Block', desc: 'Kiểu tóc Hàn Quốc với phần đỉnh đầu để dài, uốn nhẹ hoặc tỉa layer, hai bên và gáy cắt gọn.' },
  { code: 'MULLET_MALE', audience: 'MALE', name: 'Mullet', desc: 'Hai bên cắt ngắn nhưng phần tóc gáy để dài chạm hoặc qua cổ.' },
  { code: 'BUZZCUT_MALE', audience: 'MALE', name: 'Buzz Cut', desc: 'Tóc được cạo rất ngắn và đều sát da đầu, mát mẻ và nam tính.' },
  { code: 'CREWCUT_MALE', audience: 'MALE', name: 'Crew Cut', desc: 'Phiên bản dài hơn của Buzz Cut một chút, phần đỉnh đầu dài hơn hai bên và gáy.' },
  { code: 'FRENCHCROP_MALE', audience: 'MALE', name: 'French Crop', desc: 'Hai bên cắt sát, phần tóc trên đỉnh để ngắn và mái được tỉa ngang hoặc rủ xuống trán.' },
  { code: 'SLICKEDBACK_MALE', audience: 'MALE', name: 'Slicked Back', desc: 'Toàn bộ tóc được vuốt ép sát ra sau bằng pomade hoặc gel bóng.' },
  { code: 'MOHICAN_MALE', audience: 'MALE', name: 'Mohican', desc: 'Hai bên cạo sát, phần tóc từ trán kéo dài xuống gáy được để dài hơn và thường vuốt chụm lại.' },
  { code: 'IVYLEAGUE_MALE', audience: 'MALE', name: 'Ivy League', desc: 'Sự kết hợp giữa Crew Cut và Side Part, phần mái đủ dài để vuốt rẽ ngôi nhẹ.' },
  { code: 'LAYER_MALE', audience: 'MALE', name: 'Layer Nam', desc: 'Tóc được cắt tỉa thành nhiều tầng đan xen, tạo độ phồng và tự nhiên.' },
  { code: 'FAUXHAWK_MALE', audience: 'MALE', name: 'Faux Hawk', desc: 'Tương tự Mohican nhưng phần đỉnh không vuốt quá sắc nhọn, hai bên không cạo quá sát.' },
  { code: 'TEXTUREDFRINGE_MALE', audience: 'MALE', name: 'Textured Fringe', desc: 'Tóc mái để rủ xuống nhưng được tỉa lộn xộn có chủ đích, tạo hiệu ứng đan xen.' },
  { code: 'SHORTQUIFF_MALE', audience: 'MALE', name: 'Short Quiff', desc: 'Quiff nhưng với độ dài tóc ngắn hơn, dễ vuốt và không mất nhiều thời gian chăm sóc.' },
  { code: 'CAESARCUT_MALE', audience: 'MALE', name: 'Caesar Cut', desc: 'Tóc cắt ngắn sát với phần mái được tỉa bằng và chải rủ xuống trán.' },
  { code: 'DREADLOCKS_MALE', audience: 'MALE', name: 'Dreadlocks', desc: 'Kiểu tóc cá tính mang phong cách Hip-hop, tóc được tết thành từng lọn bết chặt vào nhau.' },
  // NỮ
  { code: 'BOB_FEMALE', audience: 'FEMALE', name: 'Tóc Bob', desc: 'Tóc cắt ngắn ngang xương hàm hoặc ngang cằm, có thể duỗi thẳng, uốn cụp hoặc làm xoăn nhẹ.' },
  { code: 'LOB_FEMALE', audience: 'FEMALE', name: 'Tóc Lob (Long Bob)', desc: 'Phiên bản dài hơn của tóc Bob, thường dài đến ngang vai.' },
  { code: 'PIXIE_FEMALE', audience: 'FEMALE', name: 'Pixie', desc: 'Cắt rất ngắn sát gáy và hai bên, phần mái có thể để lệch hoặc uốn nhẹ, cực kỳ cá tính.' },
  { code: 'LAYER_FEMALE', audience: 'FEMALE', name: 'Tóc Layer', desc: 'Tóc được tỉa so le thành nhiều lớp, giúp tóc trông bồng bềnh và ôm sát khuôn mặt.' },
  { code: 'BUTTERFLY_FEMALE', audience: 'FEMALE', name: 'Butterfly Cut', desc: 'Tóc layer với các lớp tóc ngắn ôm mặt và các lớp dài xõa bung ra sau.' },
  { code: 'HIME_FEMALE', audience: 'FEMALE', name: 'Hime Cut', desc: 'Tóc dài thẳng với hai lọn tóc mai phía trước được cắt bằng ngang má hoặc cằm.' },
  { code: 'WOLF_FEMALE', audience: 'FEMALE', name: 'Wolf Cut', desc: 'Sự pha trộn giữa Mullet và Shag, tóc được tỉa xù xù lộn xộn bồng bềnh, phần gáy để dài.' },
  { code: 'SHAG_FEMALE', audience: 'FEMALE', name: 'Shag Cut', desc: 'Kiểu tóc tỉa layer nhiều lớp một cách ngẫu hứng, tạo vẻ ngoài hơi rối và phóng khoáng.' },
  { code: 'WAVY_FEMALE', audience: 'FEMALE', name: 'Tóc uốn sóng nước', desc: 'Tóc dài được uốn xoăn nhẹ nhàng, tạo thành các lọn sóng bồng bềnh và tự nhiên.' },
  { code: 'HIPPIE_FEMALE', audience: 'FEMALE', name: 'Tóc xoăn Hippie', desc: 'Tóc được uốn xoăn tít từ chân đến ngọn, mang đậm phong cách vintage và nghệ thuật.' },
  { code: 'CURTAINBANGS_FEMALE', audience: 'FEMALE', name: 'Tóc mái bay', desc: 'Tóc mái được chia đôi và cắt uốn lơi sang hai bên, ôm nhẹ vào gò má.' },
  { code: 'WISPYBANGS_FEMALE', audience: 'FEMALE', name: 'Tóc mái thưa', desc: 'Tóc mái cắt mỏng, lơ thơ trước trán theo phong cách Hàn Quốc.' },
  { code: 'STRAIGHT_FEMALE', audience: 'FEMALE', name: 'Tóc duỗi thẳng', desc: 'Tóc để dài và duỗi thẳng mượt, không bao giờ lỗi mốt.' },
  { code: 'CCURL_FEMALE', audience: 'FEMALE', name: 'Tóc cụp chữ C', desc: 'Phần đuôi tóc uốn cụp nhẹ vào trong (hình chữ C), mang lại vẻ thanh lịch và nữ tính.' },
  { code: 'BIGCURLS_FEMALE', audience: 'FEMALE', name: 'Tóc xoăn lọn to', desc: 'Tóc dài uốn xoăn ở phần đuôi với các lọn to, quyến rũ và phù hợp cho các dịp sang trọng.' },
  { code: 'LOOSECURLS_FEMALE', audience: 'FEMALE', name: 'Tóc uốn lơi', desc: 'Các lọn tóc xoăn rất nhẹ, nhìn như chỉ hơi gợn sóng, cực kỳ tự nhiên.' },
  { code: 'FLIPPEDENDS_FEMALE', audience: 'FEMALE', name: 'Tóc ngang vai uốn vểnh', desc: 'Tóc cắt ngang vai và phần đuôi được uốn vểnh nhẹ ra ngoài thay vì uốn cụp vào trong.' },
  { code: 'MULLET_FEMALE', audience: 'FEMALE', name: 'Mullet Nữ', desc: 'Tương tự mullet nam nhưng được tỉa mềm mại hơn, ôm sát khuôn mặt và tạo vẻ cool ngầu.' },
];

const OUTPUT_DIR = path.resolve(__dirname, '../../frontend/public/images/hairstyles');

async function ensureDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {}
}

async function extractGeminiImage(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) return null;
  return Buffer.from(inlineData.data, "base64");
}

async function generateImage(style, retries = 3) {
  const filename = `${style.code.toLowerCase().replace('_', '-')}.jpg`;
  const filePath = path.join(OUTPUT_DIR, filename);
  
  try {
    await fs.access(filePath);
    console.log(`[BỎ QUA] Đã có ảnh cho ${style.name} (${filename})`);
    return;
  } catch (err) {}

  console.log(`[ĐANG TẠO] Ảnh cho ${style.name}...`);
  const gender = style.audience === 'MALE' ? 'handsome young man' : 'beautiful young woman';
  const prompt = `Professional photography portrait of a ${gender} with a ${style.name} hairstyle. ${style.desc}. Ultra detailed, photorealistic, salon catalog, clean background, perfect lighting, facing camera.`;
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${seed}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      await fs.writeFile(filePath, response.data);
      console.log(`[THÀNH CÔNG] Đã lưu ${filename}`);
      return;
    } catch (error) {
      const status = error.response ? error.response.status : null;
      if (status === 429 || error.code === 'ECONNABORTED') {
        console.warn(`[THỬ LẠI LẦN ${attempt}] Lỗi ${status || 'Timeout'} khi tạo ${style.name}. Chờ 15s...`);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 15000));
        } else {
          console.error(`[THẤT BẠI] Lỗi khi tạo ${style.name} sau ${retries} lần thử.`);
        }
      } else {
        console.error(`[THẤT BẠI] Lỗi không xác định khi tạo ${style.name}:`, error.message);
        break;
      }
    }
  }
}

async function main() {
  await ensureDir();
  console.log(`Bắt đầu sinh 36 ảnh đại diện vào thư mục: ${OUTPUT_DIR}`);
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    await generateImage(style);
    if (i < styles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }
  console.log("Hoàn tất sinh ảnh!");
}

main();
