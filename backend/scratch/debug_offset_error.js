const mssql = require("mssql");

const config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "sa",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "BeautySalonSystem1",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function main() {
  try {
    const pool = await mssql.connect(config);
    console.log("Connected.");

    // Query that fails in receptionist.service.js
    const testQuery = `
      SELECT
        r.ReviewId,
        r.AppointmentId,
        r.ServiceId,
        s.ServiceName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.AdminResponse,
        r.CreatedAt,
        r.UpdatedAt,
        eu.FullName AS TechnicianName
      FROM Reviews r
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE r.CustomerId = @CustomerId
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY
    `;
    const res = await pool.request().input("CustomerId", 1).query(testQuery);
    console.log("SUCCESS! Rows:", res.recordset.length);

  } catch (err) {
    console.error("FAILED!");
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
