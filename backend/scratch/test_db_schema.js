const { connectDB, sql } = require("../src/config/db");

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Customers'
  `);
  console.log("Customers columns:");
  console.log(res.recordset);

  const res2 = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'MembershipLevels'
  `);
  console.log("MembershipLevels columns:");
  console.log(res2.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
