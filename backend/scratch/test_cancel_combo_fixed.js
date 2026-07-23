const { connectDB, sql } = require("../src/config/db");

async function testCancelLogic() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT a.AppointmentId, a.CustomerPackageId, a.CustomerId, c.UserId, a.Status
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE a.CustomerPackageId IS NOT NULL
  `);

  console.log("All Combo Appointments in DB:", res.recordset);
  process.exit(0);
}

testCancelLogic();
