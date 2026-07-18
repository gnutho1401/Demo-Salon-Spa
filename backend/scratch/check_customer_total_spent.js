const { sql, connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const customerId = 1; // Example CustomerId

  const appointmentSpent = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT SUM(i.FinalAmount) AS AppointmentSpent
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId AND i.Status = 'PAID'
    `);

  const packageSpent = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT SUM(pp.Amount) AS PackageSpent
      FROM PackagePayments pp
      JOIN CustomerPackages cp ON pp.CustomerPackageId = cp.CustomerPackageId
      WHERE cp.CustomerId = @CustomerId AND pp.Status = 'PAID'
    `);

  const appSum = appointmentSpent.recordset[0]?.AppointmentSpent || 0;
  const pkgSum = packageSpent.recordset[0]?.PackageSpent || 0;
  console.log(`Customer: ${customerId}`);
  console.log(`Appointment invoice payments: ${appSum}`);
  console.log(`Package purchase payments: ${pkgSum}`);
  console.log(`Total spent: ${appSum + pkgSum}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
