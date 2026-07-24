const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'BeautySalonSystem',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function runSeed() {
  try {
    console.log("Connecting to DB:", dbConfig.database);
    const pool = await sql.connect(dbConfig);
    const sqlScript = fs.readFileSync(path.resolve(__dirname, '../../database/seeds/seed_colors.sql'), 'utf8');
    
    // Split by GO if necessary, but mssql request().batch() can run batches
    console.log("Executing SQL...");
    await pool.request().batch(sqlScript);
    
    console.log("Success!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

runSeed();
