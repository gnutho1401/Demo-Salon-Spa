const { connectDB } = require("../src/config/db");

async function main() {
  try {
    const pool = await connectDB();
    console.log("Cleaning up merge test data...");
    const result = await pool.request().query(`
      DELETE FROM ShiftRegistrations WHERE ShiftId = 1 AND TechnicianId = 1;
    `);
    console.log("Deleted rows:", result.rowsAffected);
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    process.exit(0);
  }
}

main();
