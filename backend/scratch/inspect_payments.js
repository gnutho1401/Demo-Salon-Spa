const { connectDB } = require("../src/config/db");

async function check() {
  const pool = await connectDB();
  
  console.log("--- CUSTOMER PACKAGES ---");
  const cp = await pool.request().query(`
    SELECT CustomerPackageId, CustomerId, PackageId, Status FROM CustomerPackages
  `);
  console.log(cp.recordset);

  console.log("--- PACKAGE PAYMENTS ---");
  const pp = await pool.request().query(`
    SELECT PackagePaymentId, CustomerPackageId, Amount, Status, TransactionCode, PaidAt FROM PackagePayments
  `);
  console.log(pp.recordset);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
