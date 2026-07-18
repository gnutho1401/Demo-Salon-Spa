const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../public/images/services/default-service.png');
const sourcePath = path.join(__dirname, '../public/images/services/massage.png');

if (!fs.existsSync(targetPath)) {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('Successfully copied massage.png to default-service.png');
  } else {
    console.log('Source image massage.png does not exist.');
  }
} else {
  console.log('default-service.png already exists.');
}

process.exit(0);
