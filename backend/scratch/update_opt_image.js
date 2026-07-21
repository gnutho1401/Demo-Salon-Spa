const { connectDB, sql } = require('../src/config/db');

async function updateServiceImages() {
  try {
    console.log('Connecting to database...');
    const pool = await connectDB();

    console.log('Updating images for underarm and bikini services...');
    
    // 1. Underarm
    const underarmRes = await pool.request()
      .input('name', sql.NVarChar, 'Triệt lông nách công nghệ OPT')
      .input('img', sql.NVarChar, '/images/services/laser-underarm.png')
      .query(`
        UPDATE Services
        SET ImageUrl = @img
        WHERE ServiceName = @name
      `);

    if (underarmRes.rowsAffected[0] > 0) {
      console.log('✅ Updated "Triệt lông nách công nghệ OPT" image successfully!');
    } else {
      console.log('❌ Service "Triệt lông nách công nghệ OPT" not found in database.');
    }

    // 2. Bikini
    const bikiniRes = await pool.request()
      .input('name', sql.NVarChar, 'Triệt lông bikini')
      .input('img', sql.NVarChar, '/images/services/laser-bikini.png')
      .query(`
        UPDATE Services
        SET ImageUrl = @img
        WHERE ServiceName = @name
      `);

    if (bikiniRes.rowsAffected[0] > 0) {
      console.log('✅ Updated "Triệt lông bikini" image successfully!');
    } else {
      console.log('❌ Service "Triệt lông bikini" not found in database.');
    }

  } catch (error) {
    console.error('Database update error:', error);
  } finally {
    process.exit();
  }
}

updateServiceImages();
