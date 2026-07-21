const { runAutoMatch } = require('../src/modules/waiting-list/waiting-list.service');

async function test() {
  console.log("Testing runAutoMatch slot matching...");
  try {
    // Run auto match test for date 2026-07-14 with canceled slot 14:00
    await runAutoMatch("2026-07-14", {
      startTime: "14:00:00",
      endTime: "15:00:00",
      employeeId: 1
    });
    console.log("AutoMatch test executed successfully.");
  } catch (err) {
    console.error("AutoMatch test error:", err);
  }
  process.exit(0);
}

test();
