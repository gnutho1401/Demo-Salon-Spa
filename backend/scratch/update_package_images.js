const { connectDB, sql } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '../public/images/packages');
const SERVICES_DIR = path.join(__dirname, '../public/images/services');
const GALLERY_DIR = path.join(__dirname, '../public/images/gallery');

const packageUpdates = [
  { id: 1, name: 'Liệu trình căng bóng phục hồi chuyên sâu', url: '/images/packages/glow-skin.png' },
  { id: 2, name: 'Liệu trình trị mụn chuẩn y khoa', url: '/images/packages/acne-package.png' },
  { id: 3, name: 'Combo giảm béo slim body toàn diện', url: '/images/packages/slim-body.png' },
  { id: 4, name: 'Liệu trình trẻ hóa nâng cơ toàn diện', url: '/images/packages/anti-aging-package.png' },
  { id: 5, name: 'Combo làm đẹp tóc và nail toàn diện', url: '/images/packages/hair-nail.png' },
  { id: 6, name: 'Gói thư giãn cuối tuần đặc biệt', url: '/images/packages/relax-weekend.png' },
  { id: 7, name: 'Liệu trình chăm sóc & vẽ nail art VIP', url: '/images/packages/nail-package-vip.png', copyFrom: path.join(GALLERY_DIR, 'nails.png') },
  { id: 8, name: 'Liệu trình phun xăm mày môi VIP', url: '/images/packages/pmu-package-vip.png', copyFrom: path.join(SERVICES_DIR, 'pmu-lips.png') },
  { id: 9, name: 'Gói nối mi & uốn cong mi quyến rũ', url: '/images/packages/eyelash-package.png', copyFrom: path.join(SERVICES_DIR, 'eyelash-perm.png') },
  { id: 10, name: 'Combo triệt lông vĩnh viễn toàn diện', url: '/images/packages/laser-package.png', copyFrom: path.join(SERVICES_DIR, 'laser-legs.png') }
];

async function main() {
  const pool = await connectDB();

  for (const update of packageUpdates) {
    // Perform copy if copyFrom is defined
    if (update.copyFrom) {
      const destPath = path.join(PACKAGES_DIR, path.basename(update.url));
      console.log(`Copying source image to ${destPath}...`);
      if (fs.existsSync(update.copyFrom)) {
        fs.copyFileSync(update.copyFrom, destPath);
        console.log(`✅ Copied image to ${update.url}`);
      } else {
        console.warn(`⚠️ Warning: Source file not found: ${update.copyFrom}`);
      }
    }

    // Update database
    console.log(`Updating database for Package ID ${update.id} ("${update.name}") -> ImageUrl: "${update.url}"`);
    await pool.request()
      .input('PackageId', sql.Int, update.id)
      .input('ImageUrl', sql.NVarChar, update.url)
      .query(`
        UPDATE Packages
        SET ImageUrl = @ImageUrl
        WHERE PackageId = @PackageId
      `);
    console.log('✅ Updated database!');
  }

  console.log('\nAll package images updated successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
