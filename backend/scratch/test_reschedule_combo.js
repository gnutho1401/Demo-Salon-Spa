const { connectDB } = require('../src/config/db');
const { bookCustomerPackage, rescheduleCustomerPackageAppointment } = require('../src/modules/packages/packages.service');

async function testReschedule() {
  console.log('=== TESTING COMBO RESCHEDULING FLOW ===\n');

  const userId = 5; // Nguyễn Gia Kiên
  const pool = await connectDB();

  // Create a dummy customer package
  const pkgRes = await pool.request().query(`
    INSERT INTO CustomerPackages (CustomerId, PackageId, StartDate, EndDate, TotalSessions, UsedSessions, RemainingSessions, Status, CreatedAt)
    OUTPUT INSERTED.CustomerPackageId
    VALUES (1, 1, GETDATE(), DATEADD(day, 30, GETDATE()), 1, 0, 1, 'ACTIVE', GETDATE())
  `);
  const cpId = pkgRes.recordset[0].CustomerPackageId;
  console.log(`✅ Created test CustomerPackage ID: ${cpId}`);

  // Step 1: Book initial appointment
  const bookRes = await bookCustomerPackage(userId, cpId, {
    appointmentDate: '2026-07-25',
    startTime: '09:00',
    notes: 'Initial booking test'
  });
  console.log(`🎉 Initial Booking Created: ApptId #${bookRes.appointmentId} for Date 2026-07-25 at 09:00`);

  // Step 2: Reschedule appointment to a NEW date & time
  const rescheduleRes = await rescheduleCustomerPackageAppointment(userId, cpId, {
    appointmentDate: '2026-07-28',
    startTime: '14:00',
    notes: 'Rescheduled to 28/07 afternoon'
  });
  console.log(`🔄 Rescheduled Successfully!`);
  console.log(`   - New Date: ${rescheduleRes.appointmentDate}`);
  console.log(`   - New Time: ${rescheduleRes.startTime} -> ${rescheduleRes.endTime}`);
  console.log(`   - New Service Step Technicians:`);
  rescheduleRes.serviceAssignments.forEach((s, idx) => {
    console.log(`     Step ${idx + 1}: [${s.startTime.slice(0,5)} - ${s.endTime.slice(0,5)}] ${s.serviceName} -> KTV: ${s.technician.fullName}`);
  });

  // Step 3: Cleanup
  await pool.request().input("ApptId", bookRes.appointmentId).query("DELETE FROM AppointmentServices WHERE AppointmentId = @ApptId");
  await pool.request().input("ApptId", bookRes.appointmentId).query("DELETE FROM CustomerPackageUsages WHERE AppointmentId = @ApptId");
  await pool.request().input("ApptId", bookRes.appointmentId).query("DELETE FROM Appointments WHERE AppointmentId = @ApptId");
  await pool.request().input("CpId", cpId).query("DELETE FROM CustomerPackages WHERE CustomerPackageId = @CpId");
  console.log('\n🧹 Cleaned up test data successfully!');

  process.exit(0);
}

testReschedule().catch(err => { console.error('❌ Reschedule Test Failed:', err); process.exit(1); });
