const { connectDB } = require("../src/config/db");

async function main() {
  try {
    const pool = await connectDB();
    console.log("Setting DEFAULT CURRENT_TIMESTAMP for shiftregistrations.createdat...");
    await pool.request().query(`
      ALTER TABLE ShiftRegistrations ALTER COLUMN CreatedAt SET DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log("Database schema updated successfully!");
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    process.exit(0);
  }
}

main();
