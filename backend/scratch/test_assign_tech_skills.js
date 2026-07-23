const { connectDB, sql } = require("../src/config/db");
const { findAvailableTechnician } = require("../src/modules/appointments/availability.service");

async function testTechSkills() {
  const pool = await connectDB();

  // Pick 3 different services: Hair (7), Nail (24), Eyelash (40)
  const services = [7, 24, 40];
  const date = "2026-07-25";

  for (const svcId of services) {
    const svcRes = await pool.request().input("ServiceId", sql.Int, svcId).query(`SELECT ServiceName FROM Services WHERE ServiceId = @ServiceId`);
    const tech = await findAvailableTechnician(date, "09:00:00", "10:00:00", svcId);
    console.log(`Service: ${svcRes.recordset[0]?.ServiceName} (ID ${svcId}) -> Assigned Tech: ${tech.FullName} (ID ${tech.EmployeeId})`);
  }

  process.exit(0);
}

testTechSkills().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
