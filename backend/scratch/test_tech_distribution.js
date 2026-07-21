const { connectDB } = require('../src/config/db');
const { findAvailableTechnician } = require('../src/modules/appointments/availability.service');

async function testDistribution() {
  console.log('=== TESTING TECHNICIAN AUTO-ASSIGNMENT DISTRIBUTION ===\n');

  for (let i = 1; i <= 5; i++) {
    const tech = await findAvailableTechnician('2026-08-15', '09:00', '11:00');
    console.log(`Booking #${i} assigned to: [ID: ${tech.EmployeeId}] ${tech.FullName} (TodayCount: ${tech.TodayCount})`);
  }

  process.exit(0);
}

testDistribution().catch(err => { console.error(err); process.exit(1); });
