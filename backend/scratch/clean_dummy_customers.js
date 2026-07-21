const { connectDB } = require('../src/config/db');

async function cleanDummyCustomers() {
  const pool = await connectDB();
  console.log('=== CLEANING DUMMY CUSTOMER ACCOUNTS ===');

  // Find dummy customer UserIds & CustomerIds
  const targetRes = await pool.request().query(`
    SELECT u.UserId, c.CustomerId, u.Email, u.FullName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    LEFT JOIN Customers c ON u.UserId = c.UserId
    WHERE r.RoleName = 'CUSTOMER'
      AND u.Email <> 'customer@salon.com'
      AND u.GoogleId IS NULL
  `);

  const dummyUsers = targetRes.recordset || [];
  console.log(`Found ${dummyUsers.length} dummy customer accounts to remove.`);

  if (dummyUsers.length === 0) {
    console.log('No dummy customer accounts to delete.');
    process.exit(0);
  }

  const userIds = dummyUsers.map(u => u.UserId).filter(Boolean);
  const customerIds = dummyUsers.map(u => u.CustomerId).filter(Boolean);

  const uIdListStr = userIds.join(',');
  const cIdListStr = customerIds.join(',');

  const apptSubQuery = `SELECT AppointmentId FROM Appointments WHERE CustomerId IN (${cIdListStr})`;

  const runSql = async (name, sqlQuery) => {
    try {
      const res = await pool.request().query(sqlQuery);
      console.log(`[${name}] Done (${res.rowsAffected ? res.rowsAffected.reduce((a,b)=>a+b,0) : 0} rows)`);
    } catch (err) {
      console.log(`[${name}] Skipped/Error: ${err.message}`);
    }
  };

  try {
    if (customerIds.length > 0) {
      console.log('Deleting dependent records across all linked tables...');
      
      await runSql('TechnicianServiceEarnings', `DELETE FROM TechnicianServiceEarnings WHERE AppointmentId IN (${apptSubQuery})`);
      await runSql('TreatmentNotes', `DELETE FROM TreatmentNotes WHERE AppointmentId IN (${apptSubQuery})`);

      // 1. Delete Payments linked to Invoices of these Appointments
      await runSql('Payments', `DELETE FROM Payments WHERE InvoiceId IN (SELECT InvoiceId FROM Invoices WHERE AppointmentId IN (${apptSubQuery}))`);

      // 2. Delete Invoices linked to these Appointments
      await runSql('Invoices', `DELETE FROM Invoices WHERE AppointmentId IN (${apptSubQuery})`);

      // 3. Delete Reschedule & Status History
      await runSql('AppointmentRescheduleRequests', `DELETE FROM AppointmentRescheduleRequests WHERE AppointmentId IN (${apptSubQuery})`);
      await runSql('AppointmentStatusHistory', `DELETE FROM AppointmentStatusHistory WHERE AppointmentId IN (${apptSubQuery})`);

      // 4. Delete AppointmentServices
      await runSql('AppointmentServices', `DELETE FROM AppointmentServices WHERE AppointmentId IN (${apptSubQuery})`);

      // 5. Delete CustomerPackageUsages, Payments, Members & Packages
      await runSql('CustomerPackageUsages', `DELETE FROM CustomerPackageUsages WHERE UsedBy IN (${uIdListStr}) OR AppointmentId IN (${apptSubQuery}) OR CustomerPackageId IN (SELECT CustomerPackageId FROM CustomerPackages WHERE CustomerId IN (${cIdListStr}))`);
      await runSql('PackagePayments', `DELETE FROM PackagePayments WHERE CustomerPackageId IN (SELECT CustomerPackageId FROM CustomerPackages WHERE CustomerId IN (${cIdListStr}))`);
      await runSql('PackageFreezeRequests', `DELETE FROM PackageFreezeRequests WHERE CustomerPackageId IN (SELECT CustomerPackageId FROM CustomerPackages WHERE CustomerId IN (${cIdListStr}))`);
      await runSql('PackageExtensions', `DELETE FROM PackageExtensions WHERE CustomerPackageId IN (SELECT CustomerPackageId FROM CustomerPackages WHERE CustomerId IN (${cIdListStr}))`);
      await runSql('PackageMembers', `DELETE FROM PackageMembers WHERE FamilyCustomerId IN (${cIdListStr}) OR CustomerPackageId IN (SELECT CustomerPackageId FROM CustomerPackages WHERE CustomerId IN (${cIdListStr}))`);

      // 6. Delete Appointments & CustomerPackages
      await runSql('Appointments', `DELETE FROM Appointments WHERE CustomerId IN (${cIdListStr})`);
      await runSql('CustomerPackages', `DELETE FROM CustomerPackages WHERE CustomerId IN (${cIdListStr})`);

      // 7. Delete Customer AI & Loyalty & Social data
      await runSql('AIRecommendations', `DELETE FROM AIRecommendations WHERE CustomerId IN (${cIdListStr})`);
      await runSql('AISkinAnalysisHistory', `DELETE FROM AISkinAnalysisHistory WHERE CustomerId IN (${cIdListStr})`);
      await runSql('PackageTransferHistory', `DELETE FROM PackageTransferHistory WHERE FromCustomerId IN (${cIdListStr}) OR ToCustomerId IN (${cIdListStr})`);
      await runSql('LoyaltyPointTransactions', `DELETE FROM LoyaltyPointTransactions WHERE CustomerId IN (${cIdListStr})`);
      await runSql('Reviews', `DELETE FROM Reviews WHERE CustomerId IN (${cIdListStr})`);
      await runSql('Feedbacks', `DELETE FROM Feedbacks WHERE CustomerId IN (${cIdListStr})`);
      await runSql('CustomerVouchers', `DELETE FROM CustomerVouchers WHERE CustomerId IN (${cIdListStr})`);
      await runSql('WaitingList', `DELETE FROM WaitingList WHERE CustomerId IN (${cIdListStr})`);

      // 8. Delete User Preferences & Logs
      await runSql('CustomerFavoriteEmployees', `DELETE FROM CustomerFavoriteEmployees WHERE UserId IN (${uIdListStr})`);
      await runSql('CustomerFavoriteServices', `DELETE FROM CustomerFavoriteServices WHERE UserId IN (${uIdListStr})`);
      await runSql('AIChatLogs', `DELETE FROM AIChatLogs WHERE UserId IN (${uIdListStr})`);
      await runSql('AIAuditLogs', `DELETE FROM AIAuditLogs WHERE UserId IN (${uIdListStr})`);
      await runSql('Notifications', `DELETE FROM Notifications WHERE UserId IN (${uIdListStr})`);
      await runSql('SystemLogs', `DELETE FROM SystemLogs WHERE UserId IN (${uIdListStr})`);

      // 9. Delete Customers table records
      await runSql('Customers', `DELETE FROM Customers WHERE CustomerId IN (${cIdListStr})`);
    }

    // 10. Delete Users table records
    await runSql('Users', `DELETE FROM Users WHERE UserId IN (${uIdListStr})`);

    console.log('🎉 FINISHED CLEANING PROCESS!');

  } catch (err) {
    console.error('❌ Error during cleanup:', err);
  }

  process.exit(0);
}

cleanDummyCustomers().catch(err => { console.error(err); process.exit(1); });
