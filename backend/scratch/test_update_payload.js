const { update } = require('../src/modules/waiting-list/waiting-list.service');
const { connectDB, sql } = require('../src/config/db');

async function testUpdate() {
  const pool = await connectDB();
  console.log("Testing WaitingList update payload parsing...");
  
  // Find a waiting list item in DB
  const res = await pool.request().query("SELECT TOP 1 w.WaitingId, w.CustomerId, c.UserId FROM WaitingList w JOIN Customers c ON c.CustomerId = w.CustomerId WHERE w.Status = 'WAITING'");
  const item = res.recordset[0];
  if (!item) {
    console.log("No WAITING items in DB to test update.");
    process.exit(0);
  }
  
  console.log(`Found WAITING item #${item.WaitingId} for UserId #${item.UserId}`);
  try {
    const updated = await update(item.UserId, item.WaitingId, {
      note: `Updated note at ${new Date().toLocaleTimeString()}`
    });
    console.log("SUCCESS! WaitingList item updated cleanly:", updated.WaitingId, updated.Note);
  } catch (err) {
    console.error("FAILED to update WaitingList item:", err.message);
  }
  
  process.exit(0);
}

testUpdate();
