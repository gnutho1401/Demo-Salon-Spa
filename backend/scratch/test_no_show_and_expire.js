const { connectDB, sql } = require("../src/config/db");

async function testNoShowAndExpire() {
  const pool = await connectDB();
  console.log("Checking expired CustomerPackages...");

  const res = await pool.request().query(`
    SELECT cp.CustomerPackageId, cp.Status, cp.EndDate, p.PackageName
    FROM CustomerPackages cp
    JOIN Packages p ON cp.PackageId = p.PackageId
    WHERE cp.EndDate < CAST(GETDATE() AS DATE)
  `);

  console.log("Expired customer packages count in DB:", res.recordset.length);
  if (res.recordset.length > 0) {
    console.log("Sample expired packages:", res.recordset.slice(0, 5));
  }

  process.exit(0);
}

testNoShowAndExpire().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
