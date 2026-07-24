const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "sa",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "BeautySalonSystem1",
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
  },
};

async function main() {
  const pool = await sql.connect(config);
  try {
    const result = await pool.request().query(`
      SELECT Audience, StyleType, COUNT(1) AS Total
      FROM AIHairStyles
      WHERE PromptVersion = N'v3-trends-2026'
      GROUP BY Audience, StyleType
      ORDER BY Audience, StyleType;

      SELECT COUNT(1) AS NewStyles,
             COUNT(DISTINCT StyleCode) AS UniqueCodes,
             SUM(CASE WHEN IsActive = 1 AND IsTrending = 1 THEN 1 ELSE 0 END) AS ActiveTrending
      FROM AIHairStyles
      WHERE PromptVersion = N'v3-trends-2026';

      SELECT COUNT(1) AS TotalTrending2026
      FROM AIHairStyles
      WHERE IsTrending = 1 AND TrendYear = 2026;
    `);
    console.log(JSON.stringify({
      groups: result.recordsets[0],
      verification: result.recordsets[1][0],
      total: result.recordsets[2][0],
    }, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
