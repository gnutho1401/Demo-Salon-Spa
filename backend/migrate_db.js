const sql = require("mssql");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

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
  let pool;
  try {
    console.log("Connecting to SQL Server:", dbConfig.server, "Database:", dbConfig.database);
    pool = await sql.connect(dbConfig);
    console.log("Connected successfully!");

    const sqlFilePath = "C:\\Users\\HELLO\\.gemini\\antigravity-ide\\brain\\728ec183-9f15-4179-ad22-1179d6c0f834\\scratch\\create_treatment_notes_v2_prod.sql";
    const rawSql = fs.readFileSync(sqlFilePath, "utf8");

    // Split SQL by GO keyword
    const statements = rawSql
      .split(/\bGO\b/gi)
      .map(s => s.trim())
      .filter(Boolean);

    console.log(`Found ${statements.length} sql statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}...`);
      await pool.request().query(statements[i]);
    }

    console.log("Database migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
