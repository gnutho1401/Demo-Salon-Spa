const { sql, connectDB } = require("../../config/db");

async function getAssignedTechnicians(serviceId) {
  const pool = await connectDB();

  const result = await pool.request().input("ServiceId", sql.Int, serviceId).query(`
    SELECT
      e.EmployeeId,
      u.FullName,
      u.Email,
      u.Phone,
      e.Position,
      e.Specialization,
      e.ImageUrl,
      e.Status,
      b.BranchName,
      CASE WHEN es.ServiceId IS NULL THEN 0 ELSE 1 END AS IsAssigned
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    LEFT JOIN EmployeeServices es
      ON es.EmployeeId = e.EmployeeId
     AND es.ServiceId = @ServiceId
    WHERE u.RoleId = (SELECT RoleId FROM Roles WHERE RoleName = 'TECHNICIAN')
      AND e.Status = 'ACTIVE'
      AND u.Status = 'ACTIVE'
    ORDER BY IsAssigned DESC, u.FullName ASC
  `);

  return result.recordset.map((row) => ({
    ...row,
    IsAssigned: Number(row.IsAssigned) === 1,
  }));
}

async function updateAssignedTechnicians(serviceId, employeeIds = []) {
  const pool = await connectDB();
  const ids = Array.from(new Set((employeeIds || []).map(Number).filter(Boolean)));

  const serviceCheck = await pool.request().input("ServiceId", sql.Int, serviceId).query(`
    SELECT ServiceId FROM Services WHERE ServiceId = @ServiceId
  `);
  if (!serviceCheck.recordset[0]) throw new Error("Không tìm thấy dịch vụ");

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction).input("ServiceId", sql.Int, serviceId).query(`
      DELETE FROM EmployeeServices WHERE ServiceId = @ServiceId
    `);

    for (const employeeId of ids) {
      const check = await new sql.Request(transaction)
        .input("EmployeeId", sql.Int, employeeId)
        .input("ServiceId", sql.Int, serviceId).query(`
          SELECT 1
          FROM Employees e
          JOIN Users u ON e.UserId = u.UserId
          WHERE e.EmployeeId = @EmployeeId
            AND u.Status = 'ACTIVE'
            AND e.Status = 'ACTIVE'
            AND u.RoleId = (SELECT RoleId FROM Roles WHERE RoleName = 'TECHNICIAN')
        `);

      if (!check.recordset[0]) {
        throw new Error(`Nhân viên ${employeeId} không phải technician hợp lệ`);
      }

      await new sql.Request(transaction)
        .input("EmployeeId", sql.Int, employeeId)
        .input("ServiceId", sql.Int, serviceId).query(`
          INSERT INTO EmployeeServices (EmployeeId, ServiceId)
          VALUES (@EmployeeId, @ServiceId)
        `);
    }

    await transaction.commit();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    throw err;
  }

  return await getAssignedTechnicians(serviceId);
}

module.exports = { getAssignedTechnicians, updateAssignedTechnicians };
