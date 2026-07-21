const { getDashboard } = require("../src/modules/receptionist/receptionist.service");

async function test() {
  try {
    console.log("Testing getDashboard...");
    const stats = await getDashboard();
    console.log("Success! stats:", Object.keys(stats));
    console.log("todayAppointments:", stats.todayAppointments.length);
    console.log("checkInQueue:", stats.checkInQueue.length);
    console.log("recentCheckIns:", stats.recentCheckIns.length);
    console.log("pendingRefunds:", stats.pendingRefunds.length);
    console.log("popularServices:", stats.popularServices.length);
    console.log("highlightedCustomer:", stats.highlightedCustomer);
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

test();
