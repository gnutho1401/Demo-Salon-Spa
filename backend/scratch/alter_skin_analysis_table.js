const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    console.log("Connected to Database to alter AISkinAnalysisHistory table...");

    await pool.query(`
      IF COL_LENGTH('AISkinAnalysisHistory', 'Pores') IS NULL
      BEGIN
          ALTER TABLE AISkinAnalysisHistory ADD 
              Pores NVARCHAR(100) NULL,
              Hydration NVARCHAR(100) NULL,
              Sebum NVARCHAR(100) NULL,
              SkinBarrier NVARCHAR(100) NULL,
              Elasticity NVARCHAR(100) NULL,
              DarkCircles NVARCHAR(100) NULL;
          PRINT 'Added new columns to AISkinAnalysisHistory successfully.';
      END
      ELSE
      BEGIN
          PRINT 'New columns already exist.';
      END
    `);
    console.log("Table altered successfully!");
  } catch (err) {
    console.error("Failed to alter table:", err);
  } finally {
    process.exit(0);
  }
})();
