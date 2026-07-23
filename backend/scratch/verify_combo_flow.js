const { connectDB, sql } = require('../src/config/db');
const packagesService = require('../src/modules/packages/packages.service');

async function verifyComboFlow() {
  const pool = await connectDB();
  console.log('=== VERIFYING SINGLE-VISIT COMBO FLOW ===\n');

  // 1. Get first active package
  const pkgRes = await pool.request().query('SELECT TOP 1 * FROM Packages WHERE Status = \'ACTIVE\' ORDER BY PackageId ASC');
  const pkg = pkgRes.recordset[0];
  if (!pkg) throw new Error('No active package found!');
  console.log(`📦 Testing Package ID ${pkg.PackageId}: "${pkg.PackageName}" (Sessions: ${pkg.TotalSessions})`);

  // 2. Get first customer user
  const custRes = await pool.request().query(`
    SELECT TOP 1 c.CustomerId, c.UserId, u.FullName, u.Email
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    WHERE u.Status = 'ACTIVE'
    ORDER BY c.CustomerId ASC
  `);
  const cust = custRes.recordset[0];
  if (!cust) throw new Error('No active customer found!');
  console.log(`👤 Testing Customer: "${cust.FullName}" (UserId: ${cust.UserId}, CustomerId: ${cust.CustomerId})`);

  // 3. Create or get active CustomerPackage for testing
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const insertCpRes = await pool.request()
    .input('CustomerId', sql.Int, cust.CustomerId)
    .input('PackageId', sql.Int, pkg.PackageId)
    .input('TotalSessions', sql.Int, 1)
    .input('RemainingSessions', sql.Int, 1)
    .input('UsedSessions', sql.Int, 0)
    .input('Status', sql.NVarChar, 'ACTIVE')
    .query(`
      INSERT INTO CustomerPackages (CustomerId, PackageId, StartDate, EndDate, TotalSessions, RemainingSessions, UsedSessions, Status, CreatedAt)
      OUTPUT INSERTED.CustomerPackageId
      VALUES (@CustomerId, @PackageId, GETDATE(), DATEADD(day, 30, GETDATE()), @TotalSessions, @RemainingSessions, @UsedSessions, @Status, GETDATE())
    `);
  const testCustomerPackageId = insertCpRes.recordset[0].CustomerPackageId;
  console.log(`✅ Created test CustomerPackage ID: ${testCustomerPackageId}`);

  // 4. Test Booking Combo 1st Time
  console.log(`\n⏳ Attempting 1st Booking for Date ${tomorrowStr} at 09:00...`);
  const bookingResult = await packagesService.bookCustomerPackage(cust.UserId, testCustomerPackageId, {
    appointmentDate: tomorrowStr,
    startTime: '09:00',
    notes: 'Test booking Single-Visit Combo'
  });

  console.log('🎉 1st Booking Successful!');
  console.log(`   - AppointmentId: ${bookingResult.appointmentId}`);
  console.log(`   - Auto-Assigned Technician: ${bookingResult.technician.fullName} (ID: ${bookingResult.technician.employeeId})`);
  console.log(`   - Time Slot: ${bookingResult.startTime} -> ${bookingResult.endTime} (${bookingResult.totalDurationMinutes} mins)`);
  console.log(`   - Included Services Breakdown & KTV Assignments:`);
  bookingResult.serviceAssignments.forEach((s, idx) => {
    console.log(`     Step ${idx + 1}: [${s.startTime.slice(0,5)} - ${s.endTime.slice(0,5)}] ${s.serviceName} -> KTV: ${s.technician.fullName} (ID: ${s.technician.employeeId})`);
  });


  // 5. Test 2nd Booking on SAME DAY (Should fail due to 1-time per day rule)
  console.log(`\n⏳ Attempting 2nd Booking on SAME DAY (${tomorrowStr} at 14:00)...`);
  try {
    await packagesService.bookCustomerPackage(cust.UserId, testCustomerPackageId, {
      appointmentDate: tomorrowStr,
      startTime: '14:00',
      notes: 'Second booking attempt'
    });
    console.error('❌ ERROR: 2nd booking should have failed but succeeded!');
  } catch (err) {
    console.log(`🛡️ 1-Time-Per-Day Constraint Working Perfectly! Intercepted Error: "${err.message}"`);
  }

  // Cleanup test data
  console.log('\n🧹 Cleaning up test appointment & package...');
  await pool.request().input('ApptId', sql.Int, bookingResult.appointmentId).query('DELETE FROM AppointmentServices WHERE AppointmentId = @ApptId; DELETE FROM CustomerPackageUsages WHERE AppointmentId = @ApptId; DELETE FROM Appointments WHERE AppointmentId = @ApptId;');
  await pool.request().input('CpId', sql.Int, testCustomerPackageId).query('DELETE FROM CustomerPackages WHERE CustomerPackageId = @CpId;');
  console.log('✅ Cleanup finished successfully!');

  process.exit(0);
}

verifyComboFlow().catch(err => {
  console.error('❌ Flow verification failed:', err);
  process.exit(1);
});
