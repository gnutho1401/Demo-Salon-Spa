const { sql, connectDB } = require("../../config/db");

async function getAll() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT 
      e.EmployeeId,
      u.FullName,
      e.Position,
      e.Specialization,
      e.ImageUrl,
      e.Status,
      b.BranchName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    WHERE e.Status = 'ACTIVE'
    ORDER BY e.EmployeeId ASC
  `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("EmployeeId", sql.Int, id).query(`
      SELECT 
        e.EmployeeId,
        u.FullName,
        e.Position,
        e.Specialization,
        e.ImageUrl,
        e.Status,
        b.BranchName
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      WHERE e.EmployeeId = @EmployeeId
    `);

  return result.recordset[0];
}

async function getByService(serviceId) {
  const pool = await connectDB();

  const result = await pool.request().input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT 
        e.EmployeeId,
        e.UserId,
        u.FullName,
        e.Position,
        e.Specialization,
        e.ImageUrl,
        e.Status,
        b.BranchName
      FROM EmployeeServices es
      JOIN Employees e ON es.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      WHERE es.ServiceId = @ServiceId
        AND e.Status = 'ACTIVE'
      ORDER BY u.FullName
    `);

  return result.recordset;
}

module.exports = { getAll, getById, getByService };
