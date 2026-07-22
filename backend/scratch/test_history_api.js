const { connectDB, sql } = require("../src/config/db");
const packagesService = require("../src/modules/packages/packages.service");

async function testHistory() {
  const pool = await connectDB();
  
  // Find a customer with completed appointments
  const res = await pool.request().query(`
    SELECT DISTINCT CustomerId FROM Appointments WHERE CustomerPackageId IS NOT NULL
  `);

  console.log("Customers with combo appts:", res.recordset);

  for (const row of res.recordset) {
    const data = await packagesService.getComboHistoryAndReviews(row.CustomerId);
    console.log(`History for Customer #${row.CustomerId}:`, JSON.stringify(data, null, 2));
  }

  process.exit(0);
}

testHistory().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
