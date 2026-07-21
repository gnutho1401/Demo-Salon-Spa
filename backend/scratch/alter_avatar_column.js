const { connectDB } = require('../src/config/db');
require('dotenv').config();

async function main() {
  const pool = await connectDB();
  
  try {
    console.log('Altering Users.AvatarUrl column size...');
    await pool.query('ALTER TABLE Users ALTER COLUMN AvatarUrl NVARCHAR(1000) NULL');
    console.log('✅ Users.AvatarUrl altered successfully!');
  } catch (err) {
    console.error('❌ Error altering Users.AvatarUrl:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
