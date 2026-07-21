const { connectDB, sql } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\HELLO\\.gemini\\antigravity-ide\\brain\\3e0d2e96-a034-4b8c-91d2-c350acb82147';
const DEST_DIR = path.join(__dirname, '../public/images/services');

// Mapping of generated image keys to new files and Service IDs
const imageUpdates = [
  {
    key: 'makeup_bridal',
    destFile: 'makeup-bridal.png',
    serviceId: 33,
    serviceName: 'Trang điểm cô dâu'
  },
  {
    key: 'massage_foot',
    destFile: 'massage-foot.png',
    serviceId: 22,
    serviceName: 'Massage chân & foot spa'
  },
  {
    key: 'massage_back',
    destFile: 'massage-back.png',
    serviceId: 23,
    serviceName: 'Massage lưng trị liệu'
  },
  {
    key: 'nail_art_stones',
    destFile: 'nail-art-stones.png',
    serviceId: 24,
    serviceName: 'Vẽ nail nghệ thuật đính đá'
  },
  {
    key: 'nail_gel_removal',
    destFile: 'nail-gel-removal.png',
    serviceId: 25,
    serviceName: 'Tháo gel & chăm sóc móng'
  },
  {
    key: 'nail_pedicure',
    destFile: 'nail-pedicure.png',
    serviceId: 26,
    serviceName: 'Pedicure spa cao cấp'
  },
  {
    key: 'nail_dipping',
    destFile: 'nail-dipping.png',
    serviceId: 50,
    serviceName: 'Nail dipping powder'
  },
  {
    key: 'eyelash_volume',
    destFile: 'eyelash-volume.png',
    serviceId: 41,
    serviceName: 'Nối mi volume bông hoa'
  },
  {
    key: 'eyelash_perm',
    destFile: 'eyelash-perm.png',
    serviceId: 42,
    serviceName: 'Uốn mi & nhuộm mi'
  },
  {
    key: 'pmu_lips',
    destFile: 'pmu-lips.png',
    serviceId: 37,
    serviceName: 'Phun môi collagen'
  },
  {
    key: 'pmu_microblading',
    destFile: 'pmu-microblading.png',
    serviceId: 38,
    serviceName: 'Điêu khắc chân mày sợi'
  },
  {
    key: 'skincare_men',
    destFile: 'skincare-men.png',
    serviceId: 49,
    serviceName: 'Chăm sóc da nam giới'
  },
  {
    key: 'melasma_treatment',
    destFile: 'melasma-treatment.png',
    serviceId: 28,
    serviceName: 'Điều trị nám & tàn nhang'
  },
  {
    key: 'waxing_body',
    destFile: 'waxing-body.png',
    serviceId: 35,
    serviceName: 'Wax lông toàn thân'
  },
  {
    key: 'laser_legs',
    destFile: 'laser-legs.png',
    serviceId: 46,
    serviceName: 'Triệt lông chân công nghệ Diode'
  }
];

async function main() {
  const pool = await connectDB();
  
  // Create destination directory if not exists
  fs.mkdirSync(DEST_DIR, { recursive: true });

  // Read all files in artifacts directory to find the generated images (which have timestamps)
  const files = fs.readdirSync(ARTIFACT_DIR);

  for (const update of imageUpdates) {
    // Find the file that starts with update.key
    const matchedFile = files.find(f => f.startsWith(update.key) && f.endsWith('.png'));
    if (!matchedFile) {
      console.warn(`⚠️ Warning: Could not find generated image for key "${update.key}" in artifacts folder.`);
      continue;
    }

    const srcPath = path.join(ARTIFACT_DIR, matchedFile);
    const destPath = path.join(DEST_DIR, update.destFile);

    console.log(`Copying ${matchedFile} -> ${update.destFile}...`);
    fs.copyFileSync(srcPath, destPath);

    // Update ImageUrl in database
    const dbUrl = `/images/services/${update.destFile}`;
    console.log(`Updating database for service ID ${update.serviceId} ("${update.serviceName}") -> ImageUrl: "${dbUrl}"`);
    
    await pool.request()
      .input('ServiceId', sql.Int, update.serviceId)
      .input('ImageUrl', sql.NVarChar, dbUrl)
      .query(`
        UPDATE Services
        SET ImageUrl = @ImageUrl
        WHERE ServiceId = @ServiceId
      `);
    console.log('✅ Updated!');
  }

  console.log('\nAll image file copies and database updates completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
