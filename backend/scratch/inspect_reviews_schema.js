const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Reviews'
  `);
  console.log('Reviews table columns:', res.recordset);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
