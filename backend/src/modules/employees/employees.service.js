const { sql, connectDB } = require("../../config/db");

async function getAll() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT 
      e.EmployeeId,
      e.UserId,
      u.FullName,
      u.Email,
      u.Phone,
      COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
      e.Position,
      e.Specialization,
      e.YearsOfExperience,
      e.Bio,
      e.Status,
      b.BranchName,
      ISNULL(r.ReviewCount, 0) AS ReviewCount,
      ISNULL(r.AverageRating, 0) AS AverageRating
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    OUTER APPLY (
      SELECT 
        COUNT(*) AS ReviewCount,
        CAST(AVG(CAST(TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
      FROM Reviews rv
      WHERE rv.EmployeeId = e.EmployeeId
        AND rv.Status = 'APPROVED'
    ) r
    WHERE e.Status = 'ACTIVE'
      AND u.RoleId = 4
    ORDER BY e.EmployeeId ASC
  `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const employeeResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(id)).query(`
      SELECT 
        e.EmployeeId,
        e.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
        e.Position,
        e.Specialization,
        e.Salary,
        e.HireDate,
        e.YearsOfExperience,
        e.Bio,
        e.Status,
        b.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        ISNULL(r.ReviewCount, 0) AS ReviewCount,
        ISNULL(r.AverageRating, 0) AS AverageRating,
        ISNULL(a.TotalAppointments, 0) AS TotalAppointments,
        ISNULL(a.CompletedAppointments, 0) AS CompletedAppointments
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT 
          COUNT(*) AS ReviewCount,
          CAST(AVG(CAST(TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
        FROM Reviews rv
        WHERE rv.EmployeeId = e.EmployeeId
          AND rv.Status = 'APPROVED'
      ) r
      OUTER APPLY (
        SELECT 
          COUNT(*) AS TotalAppointments,
          SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments
        FROM Appointments ap
        WHERE ap.EmployeeId = e.EmployeeId
      ) a
      WHERE e.EmployeeId = @EmployeeId
        AND e.Status = 'ACTIVE'
    `);

  const employee = employeeResult.recordset[0];
  if (!employee) return null;

  const servicesResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(id)).query(`
      SELECT 
        s.ServiceId,
        s.ServiceName,
        s.Description,
        s.DurationMinutes,
        s.Price,
        s.ImageUrl,
        c.CategoryName
      FROM EmployeeServices es
      JOIN Services s ON es.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      WHERE es.EmployeeId = @EmployeeId
        AND s.Status = 'AVAILABLE'
      ORDER BY s.ServiceName
    `);

  const reviewsResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(id)).query(`
      SELECT TOP 8
        r.ReviewId,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.CreatedAt,
        u.FullName AS CustomerName
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE r.EmployeeId = @EmployeeId
        AND r.Status = 'APPROVED'
      ORDER BY r.CreatedAt DESC
    `);

  const shiftsResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(id)).query(`
      SELECT TOP 7
        ws.ShiftId,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        ws.ShiftName AS ShiftType,
        CAST(0 AS BIT) AS IsDayOff,
        NULL AS Notes
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @EmployeeId
        AND sr.Status = 'APPROVED'
        AND ws.ShiftDate >= CAST(GETDATE() AS DATE)
      ORDER BY ws.ShiftDate ASC
    `);

  return {
    ...employee,
    Services: servicesResult.recordset,
    Reviews: reviewsResult.recordset,
    WorkShifts: shiftsResult.recordset,
  };
}

async function getByService(serviceId) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("ServiceId", sql.Int, Number(serviceId)).query(`
      SELECT 
        e.EmployeeId,
        e.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
        e.Position,
        e.Specialization,
        e.YearsOfExperience,
        e.Bio,
        e.Status,
        e.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        ISNULL(r.ReviewCount, 0) AS ReviewCount,
        ISNULL(r.AverageRating, 0) AS AverageRating
      FROM EmployeeServices es
      JOIN Employees e ON es.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT 
          COUNT(*) AS ReviewCount,
          CAST(AVG(CAST(TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
        FROM Reviews rv
        WHERE rv.EmployeeId = e.EmployeeId
          AND rv.Status = 'APPROVED'
      ) r
      WHERE es.ServiceId = @ServiceId
        AND e.Status = 'ACTIVE'
      ORDER BY AverageRating DESC, u.FullName ASC
    `);

  return result.recordset;
}

async function getBranches() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT BranchId, BranchName, Address, Phone, Status
    FROM Branches
    WHERE Status = 'ACTIVE'
    ORDER BY BranchName ASC
  `);
  return result.recordset;
}

module.exports = { getAll, getById, getByService, getBranches };
