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
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'TreatmentNotesV2'
    `);
    console.log("Columns in TreatmentNotesV2:");
    console.log(JSON.stringify(result.recordset, null, 2));
    await sql.close();
  } catch (err) {
    console.error(err);
  }
}

main();
