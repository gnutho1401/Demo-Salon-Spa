const fs = require('fs');
const path = require('path');
const { connectDB, sql } = require('../src/config/db');

// Paths
const brainDir = 'C:\\Users\\HELLO\\.gemini\\antigravity-ide\\brain\\e4997716-e14f-4787-a55c-801b67a844de';
const destDir = path.join(__dirname, '../public/images/services');

// Copy generated files
function copyGeneratedFiles() {
  console.log('\n=== 1. SAO CHÉP FILE HÌNH ẢNH MỚI ===');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(brainDir);
  const mapping = [
    { prefix: 'svc_steam_detox_', dest: 'steam-detox.png' },
    { prefix: 'svc_whitening_', dest: 'whitening-capsule.png' },
    { prefix: 'svc_keratin_', dest: 'hair-keratin.png' },
    { prefix: 'svc_hair_treatment_', dest: 'hair-treatment-deep.png' },
    { prefix: 'svc_highlight_', dest: 'hair-highlight.png' },
    { prefix: 'svc_makeup_', dest: 'makeup-party.png' },
    { prefix: 'svc_eyelashes_', dest: 'eyelash-extension.png' },
    { prefix: 'svc_pmu_', dest: 'pmu-eyebrow.png' },
    { prefix: 'svc_laser_hair_', dest: 'laser-removal.png' },
  ];

  mapping.forEach(m => {
    const srcFile = files.find(f => f.startsWith(m.prefix) && f.endsWith('.png'));
    if (srcFile) {
      const srcPath = path.join(brainDir, srcFile);
      const destPath = path.join(destDir, m.dest);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ Đã sao chép: ${srcFile} -> ${m.dest}`);
    } else {
      console.log(`  ❌ Không tìm thấy file có tiền tố: ${m.prefix}`);
    }
  });
}

// Update Database images for services
async function updateDatabase() {
  console.log('\n=== 2. CẬP NHẬT ĐƯỜNG DẪN ẢNH VÀO CƠ SỞ DỮ LIỆU ===');
  const pool = await connectDB();

  // Define Image Map
  const imageMap = {
    // Detox
    'Xông hơi thảo dược detox': '/images/services/steam-detox.png',
    'Tắm trắng phi thuyền': '/images/services/whitening-capsule.png',

    // Hair
    'Duỗi tóc keratin cao cấp': '/images/services/hair-keratin.png',
    'Hấp dầu phục hồi chuyên sâu': '/images/services/hair-treatment-deep.png',
    'Tẩy tóc & nhuộm highlight': '/images/services/hair-highlight.png',

    // Makeup
    'Trang điểm dự tiệc': '/images/services/makeup-party.png',
    'Trang điểm cô dâu': '/images/services/makeup-party.png',

    // Massage
    'Massage body tinh dầu thư giãn': '/images/services/massage-relax.png',
    'Massage chân & foot spa': '/images/services/massage-relax.png',
    'Massage lưng trị liệu': '/images/services/neck-shoulder.png',
    'Massage bầu thư giãn': '/images/services/massage.png',

    // Nail
    'Vẽ nail nghệ thuật đính đá': '/images/services/korean-gel.png',
    'Tháo gel & chăm sóc móng': '/images/services/nail-care.png',
    'Pedicure spa cao cấp': '/images/services/nail-care.png',
    'Nail dipping powder': '/images/services/nail-premium.png',

    // Eyelashes
    'Nối mi classic tự nhiên': '/images/services/eyelash-extension.png',
    'Nối mi volume bông hoa': '/images/services/eyelash-extension.png',
    'Uốn mi & nhuộm mi': '/images/services/eyelash-extension.png',
    'Tháo mi nối & chăm sóc': '/images/services/eyelash-extension.png',

    // PMU
    'Phun chân mày tán bột': '/images/services/pmu-eyebrow.png',
    'Phun môi collagen': '/images/services/pmu-eyebrow.png',
    'Điêu khắc chân mày sợi': '/images/services/pmu-eyebrow.png',
    'Xóa xăm thẩm mỹ cũ': '/images/services/pmu-eyebrow.png',

    // Skincare
    'Đắp mặt nạ collagen vàng': '/images/services/skincare.png',
    'Điều trị nám & tàn nhang': '/images/services/acne-care.png',
    'Chăm sóc da nam giới': '/images/services/skincare-basic.png',

    // Laser Removal
    'Triệt lông nách công nghệ OPT': '/images/services/laser-underarm.png',
    'Wax lông toàn thân': '/images/services/laser-removal.png',
    'Triệt lông chân công nghệ Diode': '/images/services/laser-removal.png',
    'Triệt lông bikini': '/images/services/laser-bikini.png',
  };

  let updated = 0;
  for (const [serviceName, imageUrl] of Object.entries(imageMap)) {
    const result = await pool.request()
      .input('name', sql.NVarChar, serviceName)
      .input('img', sql.NVarChar, imageUrl)
      .query(`
        UPDATE Services
        SET ImageUrl = @img
        WHERE ServiceName = @name
      `);
    if (result.rowsAffected[0] > 0) {
      console.log(`  ✅ ${serviceName} -> ${imageUrl}`);
      updated++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  ✅ Đã cập nhật đường dẫn cho ${updated} dịch vụ trong DB`);
  console.log(`════════════════════════════════════════\n`);
}

async function main() {
  try {
    copyGeneratedFiles();
    await updateDatabase();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
