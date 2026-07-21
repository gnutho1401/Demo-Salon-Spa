const { connectDB, sql } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\HELLO\\.gemini\\antigravity-ide\\brain\\3e0d2e96-a034-4b8c-91d2-c350acb82147';
const DEST_DIR = path.join(__dirname, '../public/images/services');

async function main() {
  const pool = await connectDB();
  const files = fs.readdirSync(ARTIFACT_DIR);

  // 1. Copy generated massage_test for ID 1
  const massageTestFile = files.find(f => f.startsWith('massage_test') && f.endsWith('.png'));
  if (massageTestFile) {
    console.log(`Copying generated massage_test image...`);
    fs.copyFileSync(path.join(ARTIFACT_DIR, massageTestFile), path.join(DEST_DIR, 'massage-test.png'));
    await pool.request()
      .input('ServiceId', sql.Int, 1)
      .input('ImageUrl', sql.NVarChar, '/images/services/massage-test.png')
      .query('UPDATE Services SET ImageUrl = @ImageUrl WHERE ServiceId = @ServiceId');
    console.log('✅ Updated Service ID 1');
  }

  // 2. Copy generated eyelash_removal for ID 43
  const eyelashRemovalFile = files.find(f => f.startsWith('eyelash_removal') && f.endsWith('.png'));
  if (eyelashRemovalFile) {
    console.log(`Copying generated eyelash_removal image...`);
    fs.copyFileSync(path.join(ARTIFACT_DIR, eyelashRemovalFile), path.join(DEST_DIR, 'eyelash-removal.png'));
    await pool.request()
      .input('ServiceId', sql.Int, 43)
      .input('ImageUrl', sql.NVarChar, '/images/services/eyelash-removal.png')
      .query('UPDATE Services SET ImageUrl = @ImageUrl WHERE ServiceId = @ServiceId');
    console.log('✅ Updated Service ID 43');
  }

  // 3. Copy pmu-microblading.png -> pmu-removal.png for ID 39
  console.log(`Copying pmu-microblading.png -> pmu-removal.png...`);
  fs.copyFileSync(path.join(DEST_DIR, 'pmu-microblading.png'), path.join(DEST_DIR, 'pmu-removal.png'));
  await pool.request()
    .input('ServiceId', sql.Int, 39)
    .input('ImageUrl', sql.NVarChar, '/images/services/pmu-removal.png')
    .query('UPDATE Services SET ImageUrl = @ImageUrl WHERE ServiceId = @ServiceId');
  console.log('✅ Updated Service ID 39');

  // 4. Copy laser-removal.png -> laser-bikini.png for ID 47
  console.log(`Copying laser-removal.png -> laser-bikini.png...`);
  fs.copyFileSync(path.join(DEST_DIR, 'laser-removal.png'), path.join(DEST_DIR, 'laser-bikini.png'));
  await pool.request()
    .input('ServiceId', sql.Int, 47)
    .input('ImageUrl', sql.NVarChar, '/images/services/laser-bikini.png')
    .query('UPDATE Services SET ImageUrl = @ImageUrl WHERE ServiceId = @ServiceId');
  console.log('✅ Updated Service ID 47');

  console.log('\nAll remaining de-duplications and database updates completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
