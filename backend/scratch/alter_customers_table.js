const { connectDB, sql } = require("../src/config/db");

async function main() {
  const pool = await connectDB();
  
  // Alter Table to add VIPExpiredAt
  console.log("Altering Customers table to add VIPExpiredAt column...");
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Customers' AND COLUMN_NAME = 'VIPExpiredAt'
    )
    BEGIN
      ALTER TABLE Customers ADD VIPExpiredAt DATETIME NULL;
      PRINT 'VIPExpiredAt column added successfully.';
    END
    ELSE
    BEGIN
      PRINT 'VIPExpiredAt column already exists.';
    END
  `);

  console.log("Done.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
