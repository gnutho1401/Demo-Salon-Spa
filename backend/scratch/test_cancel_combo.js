const { connectDB, sql } = require("../src/config/db");
const packagesService = require("../src/modules/packages/packages.service");

async function testCancel() {
  try {
    const res = await packagesService.cancelCustomerPackageAppointment(123, 98, "Hủy lịch test");
    console.log("Cancel result:", res);
  } catch (err) {
    console.error("Cancel error:", err);
  }
  process.exit(0);
}

testCancel();
