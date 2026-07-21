const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    console.log("Connecting to Database to execute migration...");
    const pool = await connectDB();
    console.log("Connected successfully!");

    console.log("Creating AISkinAnalysisHistory table if not exists...");
    await pool.query(`
      IF OBJECT_ID('AISkinAnalysisHistory', 'U') IS NULL
      BEGIN
          CREATE TABLE AISkinAnalysisHistory (
              AnalysisId INT IDENTITY(1,1) PRIMARY KEY,
              CustomerId INT NOT NULL,
              ImageUrl NVARCHAR(MAX) NOT NULL,
              SkinType NVARCHAR(50) NOT NULL,
              AcneLevel NVARCHAR(50) NOT NULL,
              WrinkleLevel NVARCHAR(50) NOT NULL,
              DarkSpots NVARCHAR(50) NOT NULL,
              Redness NVARCHAR(50) NOT NULL,
              SkinScore INT NOT NULL,
              Summary NVARCHAR(MAX) NOT NULL,
              RoutineSuggestion NVARCHAR(MAX) NOT NULL,
              CreatedAt DATETIME DEFAULT GETDATE(),
              CONSTRAINT FK_SkinAnalysis_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE
          );
          PRINT 'Table AISkinAnalysisHistory created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Table AISkinAnalysisHistory already exists.';
      END
    `);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration execution failed:", err);
  } finally {
    process.exit(0);
  }
})();
