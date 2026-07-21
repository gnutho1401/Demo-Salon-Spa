const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  console.log('=== CLEARING ALL COMBO USAGE & PURCHASE HISTORY ===\n');

  // 1. Delete CustomerPackageUsages
  const usagesRes = await pool.request().query('DELETE FROM CustomerPackageUsages');
  console.log(`- Deleted ${usagesRes.rowsAffected[0] || 0} rows from CustomerPackageUsages`);

  // 2. Delete PackageMembers
  const membersRes = await pool.request().query('DELETE FROM PackageMembers');
  console.log(`- Deleted ${membersRes.rowsAffected[0] || 0} rows from PackageMembers`);

  // 3. Delete PackagePayments
  const paymentsRes = await pool.request().query('DELETE FROM PackagePayments');
  console.log(`- Deleted ${paymentsRes.rowsAffected[0] || 0} rows from PackagePayments`);

  // 4. Unlink CustomerPackageId from Appointments
  const apptsRes = await pool.request().query('UPDATE Appointments SET CustomerPackageId = NULL WHERE CustomerPackageId IS NOT NULL');
  console.log(`- Unlinked CustomerPackageId from ${apptsRes.rowsAffected[0] || 0} Appointments`);

  // 5. Delete CustomerPackages
  const pkgsRes = await pool.request().query('DELETE FROM CustomerPackages');
  console.log(`- Deleted ${pkgsRes.rowsAffected[0] || 0} rows from CustomerPackages`);

  console.log('\n✅ Successfully cleared all combo purchase and usage history from the system!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed to clear combo history:', err);
  process.exit(1);
});
