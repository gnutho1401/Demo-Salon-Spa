const { connectDB, sql } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    console.log("Connected to Database to migrate all entities to Branch 1 and delete other branches...");

    // 1. Update Appointments
    console.log("Updating Appointments to Branch 1...");
    await pool.query('UPDATE Appointments SET BranchId = 1 WHERE BranchId <> 1 OR BranchId IS NULL');

    // 2. Update Employees
    console.log("Updating Employees to Branch 1...");
    await pool.query('UPDATE Employees SET BranchId = 1 WHERE BranchId <> 1 OR BranchId IS NULL');

    // 3. Update WaitingList
    console.log("Updating WaitingList to Branch 1...");
    await pool.query('UPDATE WaitingList SET PreferredBranchId = 1 WHERE PreferredBranchId <> 1 OR PreferredBranchId IS NULL');

    // 4. Update ServiceResources
    console.log("Updating ServiceResources to Branch 1...");
    await pool.query('UPDATE ServiceResources SET BranchId = 1 WHERE BranchId <> 1 OR BranchId IS NULL');

    // 5. Delete other branches
    console.log("Deleting branches 2 and 3...");
    await pool.query('DELETE FROM Branches WHERE BranchId <> 1');

    console.log("Successfully migrated database to a single branch!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
})();
