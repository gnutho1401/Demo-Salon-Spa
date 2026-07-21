const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../public/images/avatars/default-avatar.png');
const sourcePath = path.join(__dirname, '../public/images/avatars/receptionist-1.png');

if (!fs.existsSync(targetPath)) {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('Successfully copied receptionist-1.png to default-avatar.png');
  } else {
    console.log('Source avatar receptionist-1.png does not exist.');
  }
} else {
  console.log('default-avatar.png already exists.');
}

process.exit(0);
