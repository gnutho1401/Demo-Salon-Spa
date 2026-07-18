const fs = require('fs');
const path = require('path');

function getFiles(dir, files_ = []) {
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      const ext = path.extname(name).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        files_.push(name);
      }
    }
  }
  return files_;
}

const backendImagesDir = path.join(__dirname, '../public/images');
if (fs.existsSync(backendImagesDir)) {
  const allImages = getFiles(backendImagesDir);
  console.log('=== ALL BACKEND IMAGES ===');
  allImages.forEach(img => {
    console.log(path.relative(backendImagesDir, img));
  });
} else {
  console.log('Backend images directory not found.');
}

process.exit(0);
