const { connectDB, sql } = require("../src/config/db");

async function fixCompletedCombos() {
  const pool = await connectDB();
  
  // 1. Sync CustomerPackages status for completed appointments
  const res1 = await pool.request().query(`
    UPDATE cp
    SET cp.Status = 'COMPLETED',
        cp.RemainingSessions = 0,
        cp.UsedSessions = 1,
        cp.UpdatedAt = GETDATE()
    FROM CustomerPackages cp
    WHERE EXISTS (
      SELECT 1 FROM Appointments a
      WHERE a.CustomerPackageId = cp.CustomerPackageId
        AND a.Status = 'COMPLETED'
    )
  `);
  console.log("Updated CustomerPackages count:", res1.rowsAffected[0]);

  // 2. Insert missing CustomerPackageUsages for completed combo appointments
  const res2 = await pool.request().query(`
    INSERT INTO CustomerPackageUsages (CustomerPackageId, AppointmentId, ServiceId, SessionsUsed, Status, UsedAt, UsedBy)
    SELECT 
      a.CustomerPackageId, 
      a.AppointmentId, 
      (SELECT TOP 1 ServiceId FROM AppointmentServices WHERE AppointmentId = a.AppointmentId),
      1, 
      'USED', 
      GETDATE(), 
      c.UserId
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE a.CustomerPackageId IS NOT NULL 
      AND a.Status = 'COMPLETED'
      AND NOT EXISTS (
        SELECT 1 FROM CustomerPackageUsages u 
        WHERE u.AppointmentId = a.AppointmentId AND u.Status = 'USED'
      )
  `);
  console.log("Inserted CustomerPackageUsages count:", res2.rowsAffected[0]);

  process.exit(0);
}

fixCompletedCombos().catch((err) => {
  console.error(err);
  process.exit(1);
});
