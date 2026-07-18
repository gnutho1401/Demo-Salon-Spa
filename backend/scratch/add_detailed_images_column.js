const sql = require("mssql");
require("dotenv").config({ path: "../.env" });

const dbConfig = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "sa",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "BeautySalonSystem1",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
  }
};

async function main() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("Connected!");
    
    // Check if column already exists
    const checkCol = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TreatmentNotesV2' AND COLUMN_NAME = 'detailed_images'
    `);
    
    if (checkCol.recordset.length === 0) {
      console.log("Adding column detailed_images...");
      await pool.request().query(`
        ALTER TABLE TreatmentNotesV2 ADD detailed_images NVARCHAR(MAX) NULL
      `);
      console.log("Column detailed_images added successfully!");
    } else {
      console.log("Column detailed_images already exists!");
    }
    
    await sql.close();
  } catch (err) {
    console.error(err);
  }
}

main();
