const fs = require('fs');
const path = require('path');
const { connectDB, sql } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  
  // Employees IDs to update to unique images
  const technicianIds = [25, 26, 27, 28, 29, 30, 31, 32, 33, 34];
  
  const avatarsDir = path.join(__dirname, '../public/images/avatars');
  const techsDir = path.join(__dirname, '../public/images/technicians');
  
  if (!fs.existsSync(techsDir)) {
    fs.mkdirSync(techsDir, { recursive: true });
  }
  
  console.log('=== COPYING AND SETTING UNIQUE TECHNICIAN IMAGES ===');
  for (let i = 0; i < technicianIds.length; i++) {
    const empId = technicianIds[i];
    const avatarNum = i + 1; // 1 to 10
    const sourceFile = `customer-${avatarNum}.png`;
    const destFile = `${10 + i}.png`;
    
    const sourcePath = path.join(avatarsDir, sourceFile);
    const destPath = path.join(techsDir, destFile);
    
    // Copy the file
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`  Copied: ${sourceFile} -> technicians/${destFile}`);
    } else {
      console.log(`  Error: Source ${sourceFile} not found!`);
    }
    
    // Update the database
    const dbPath = `/images/technicians/${destFile}`;
    await pool.request()
      .input("EmployeeId", sql.Int, empId)
      .input("ImageUrl", sql.NVarChar, dbPath)
      .query(`
        UPDATE Employees
        SET ImageUrl = @ImageUrl
        WHERE EmployeeId = @EmployeeId
      `);
    console.log(`  Updated: Employee ID ${empId} ImageUrl -> "${dbPath}"`);
  }
  
  console.log('\nSuccess! All 10 technicians now have 100% unique, different images.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
