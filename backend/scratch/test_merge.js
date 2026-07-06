const { connectDB } = require("../src/config/db");

async function main() {
  try {
    const pool = await connectDB();
    console.log("Testing MERGE INTO support on PostgreSQL/Supabase...");
    
    // We will test MERGE INTO on ShiftRegistrations or a dummy table
    const result = await pool.request().query(`
      MERGE INTO ShiftRegistrations AS target
      USING (SELECT 1 AS ShiftId, 1 AS TechnicianId) AS source
      ON (target.ShiftId = source.ShiftId AND target.TechnicianId = source.TechnicianId)
      WHEN MATCHED THEN
        UPDATE SET Status = 'APPROVED'
      WHEN NOT MATCHED THEN
        INSERT (ShiftId, TechnicianId, Status) VALUES (1, 1, 'APPROVED');
    `);
    console.log("MERGE INTO executed successfully!");
    console.log(result);
  } catch (error) {
    console.error("MERGE INTO failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
