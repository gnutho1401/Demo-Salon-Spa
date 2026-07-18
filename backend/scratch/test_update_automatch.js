const { connectDB, sql } = require('../src/config/db');
const { update, getMine } = require('../src/modules/waiting-list/waiting-list.service');
const { getAvailableSlots } = require('../src/modules/appointments/availability.service');

async function testAutoMatchOnUpdate() {
  const pool = await connectDB();
  console.log("Testing immediate autoMatch on update...");

  // Find a WAITING item
  const res = await pool.request().query("SELECT TOP 1 w.WaitingId, w.CustomerId, c.UserId, w.ServiceId, w.PreferredEmployeeId FROM WaitingList w JOIN Customers c ON c.CustomerId = w.CustomerId WHERE w.Status = 'WAITING'");
  const item = res.recordset[0];
  if (!item) {
    console.log("No WAITING items in DB.");
    process.exit(0);
  }

  const testDate = "2026-08-25";

  console.log(`Updating WaitingId #${item.WaitingId} to date ${testDate}...`);
  const updated = await update(item.UserId, item.WaitingId, {
    preferredDate: testDate,
    flexibleTimeSlot: "ANY",
    acceptOtherTechnician: true,
    acceptOtherTimeSlots: true
  });

  // Wait 1.5s for async autoMatch
  await new Promise(r => setTimeout(r, 1500));

  const check = await pool.request()
    .input("WaitingId", sql.Int, item.WaitingId)
    .query("SELECT Status, MatchedDate, MatchedStartTime, HoldExpiresAt FROM WaitingList WHERE WaitingId = @WaitingId");
  
  console.log("Status after update:", check.recordset[0]);
  process.exit(0);
}

testAutoMatchOnUpdate().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
