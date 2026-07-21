const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    console.log("Connecting to Database to alter AISkinAnalysisHistory column sizes...");

    await pool.query(`
      ALTER TABLE AISkinAnalysisHistory ALTER COLUMN SkinType NVARCHAR(MAX) NOT NULL;
      ALTER TABLE AISkinAnalysisHistory ALTER COLUMN AcneLevel NVARCHAR(MAX) NOT NULL;
      ALTER TABLE AISkinAnalysisHistory ALTER COLUMN WrinkleLevel NVARCHAR(MAX) NOT NULL;
      ALTER TABLE AISkinAnalysisHistory ALTER COLUMN DarkSpots NVARCHAR(MAX) NOT NULL;
      ALTER TABLE AISkinAnalysisHistory ALTER COLUMN Redness NVARCHAR(MAX) NOT NULL;

      IF COL_LENGTH('AISkinAnalysisHistory', 'Pores') IS NOT NULL
      BEGIN
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN Pores NVARCHAR(MAX) NULL;
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN Hydration NVARCHAR(MAX) NULL;
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN Sebum NVARCHAR(MAX) NULL;
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN SkinBarrier NVARCHAR(MAX) NULL;
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN Elasticity NVARCHAR(MAX) NULL;
          ALTER TABLE AISkinAnalysisHistory ALTER COLUMN DarkCircles NVARCHAR(MAX) NULL;
      END
    `);
    console.log("Successfully expanded column capacity of AISkinAnalysisHistory to NVARCHAR(MAX)!");
  } catch (err) {
    console.error("Failed to alter columns:", err);
  } finally {
    process.exit(0);
  }
})();
