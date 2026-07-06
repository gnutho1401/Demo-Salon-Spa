const { sql, connectDB } = require("../../config/db");
const bcrypt = require("bcryptjs");

function text(value) {
  return String(value || "").trim();
}

function nullable(value) {
  const v = text(value);
  return v ? v : null;
}

function status(value, fallback = "ACTIVE") {
  return String(value || fallback)
    .trim()
    .toUpperCase();
}

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMoney(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getRoles() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT RoleId, RoleName
    FROM Roles
    WHERE RoleName IN ('ADMIN', 'MANAGER', 'RECEPTIONIST', 'TECHNICIAN')
    ORDER BY RoleId
  `);
  return result.recordset;
}

async function getBranches() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT BranchId, BranchName, Address, Phone, Status
    FROM Branches
    ORDER BY BranchName
  `);
  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const roleId = toInt(filters.roleId);
  const branchId = toInt(filters.branchId);
  const employeeStatus = filters.status ? status(filters.status) : null;

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("RoleId", sql.Int, roleId)
    .input("BranchId", sql.Int, branchId)
    .input("Status", sql.NVarChar, employeeStatus).query(`
      SELECT
        e.EmployeeId,
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status AS UserStatus,
        u.IsVerified,
        r.RoleId,
        r.RoleName,
        e.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        e.Position,
        e.Specialization,
        e.Salary,
        e.HireDate,
        e.YearsOfExperience,
        e.Bio,
        e.ImageUrl,
        e.Status,
        ISNULL(ap.TotalAppointments, 0) AS TotalAppointments,
        ISNULL(ap.CompletedAppointments, 0) AS CompletedAppointments,
        ISNULL(rv.AvgRating, 0) AS AvgRating,
        ISNULL(rv.ReviewCount, 0) AS ReviewCount,
        ISNULL(es.ServiceCount, 0) AS ServiceCount
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT
          COUNT(*) AS TotalAppointments,
          SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments
        FROM Appointments a
        WHERE a.EmployeeId = e.EmployeeId
      ) ap
      OUTER APPLY (
        SELECT
          AVG(CAST(Rating AS DECIMAL(10,2))) AS AvgRating,
          COUNT(*) AS ReviewCount
        FROM Reviews rv
        WHERE rv.EmployeeId = e.EmployeeId
          AND rv.Status = 'APPROVED'
      ) rv
      OUTER APPLY (
        SELECT COUNT(*) AS ServiceCount
        FROM EmployeeServices es
        WHERE es.EmployeeId = e.EmployeeId
      ) es
      WHERE
        (@Keyword IS NULL OR u.FullName LIKE @Keyword OR u.Email LIKE @Keyword OR u.Phone LIKE @Keyword)
        AND (@RoleId IS NULL OR u.RoleId = @RoleId)
        AND (@BranchId IS NULL OR e.BranchId = @BranchId)
        AND (@Status IS NULL OR e.Status = @Status OR u.Status = @Status)
      ORDER BY e.EmployeeId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("EmployeeId", sql.Int, Number(id))
    .query(`
      SELECT
        e.EmployeeId,
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status AS UserStatus,
        u.IsVerified,
        r.RoleId,
        r.RoleName,
        e.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        e.Position,
        e.Specialization,
        e.Salary,
        e.HireDate,
        e.YearsOfExperience,
        e.Bio,
        e.ImageUrl,
        e.Status,
        ISNULL(ap.TotalAppointments, 0) AS TotalAppointments,
        ISNULL(ap.CompletedAppointments, 0) AS CompletedAppointments,
        ISNULL(rv.AvgRating, 0) AS AvgRating,
        ISNULL(rv.ReviewCount, 0) AS ReviewCount,
        ISNULL(es.ServiceCount, 0) AS ServiceCount
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT
          COUNT(*) AS TotalAppointments,
          SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments
        FROM Appointments a
        WHERE a.EmployeeId = e.EmployeeId
      ) ap
      OUTER APPLY (
        SELECT
          AVG(CAST(Rating AS DECIMAL(10,2))) AS AvgRating,
          COUNT(*) AS ReviewCount
        FROM Reviews rv
        WHERE rv.EmployeeId = e.EmployeeId
          AND rv.Status = 'APPROVED'
      ) rv
      OUTER APPLY (
        SELECT COUNT(*) AS ServiceCount
        FROM EmployeeServices es
        WHERE es.EmployeeId = e.EmployeeId
      ) es
      WHERE e.EmployeeId = @EmployeeId
    `);

  if (!result.recordset[0]) throw new Error("Không tìm thấy nhân viên");
  return result.recordset[0];
}

async function getByUserId(userId) {
  const pool = await connectDB();
  const result = await pool.request().input("UserId", sql.Int, Number(userId))
    .query(`
      SELECT TOP 1 EmployeeId
      FROM Employees
      WHERE UserId = @UserId
    `);

  if (!result.recordset[0]) return null;
  return getById(result.recordset[0].EmployeeId);
}

async function create(data) {
  const fullName = text(data.fullName);
  const email = text(data.email).toLowerCase();
  const phone = nullable(data.phone);
  const password = text(data.password);
  const roleId = toInt(data.roleId);
  const userStatus = status(data.userStatus || data.status);
  const employeeStatus = status(data.status);
  const avatarUrl = nullable(data.avatarUrl);
  const imageUrl = nullable(data.imageUrl || data.avatarUrl);
  const branchId = toInt(data.branchId);
  const position = nullable(data.position);
  const specialization = nullable(data.specialization);
  const salary = toMoney(data.salary);
  const hireDate = data.hireDate || null;
  const yearsOfExperience = toInt(data.yearsOfExperience, 0);
  const bio = nullable(data.bio);

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!roleId) throw new Error("Vui lòng chọn vai trò");
  if (!password) throw new Error("Mật khẩu không được để trống");

  const pool = await connectDB();

  const existed = await pool
    .request()
    .input("Email", sql.NVarChar, email)
    .query(`SELECT TOP 1 UserId FROM Users WHERE Email = @Email`);

  if (existed.recordset[0]) throw new Error("Email đã tồn tại");

  const passwordHash = await bcrypt.hash(password, 10);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const userResult = await new sql.Request(transaction)
      .input("FullName", sql.NVarChar, fullName)
      .input("Email", sql.NVarChar, email)
      .input("Phone", sql.NVarChar, phone)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("RoleId", sql.Int, roleId)
      .input("AvatarUrl", sql.NVarChar, avatarUrl)
      .input("Status", sql.NVarChar, userStatus).query(`
        INSERT INTO Users
          (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified)
        OUTPUT INSERTED.UserId
        VALUES
          (@FullName, @Email, @Phone, @PasswordHash, @RoleId, @AvatarUrl, @Status, 1)
      `);

    const userId = userResult.recordset[0].UserId;

    const empResult = await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("BranchId", sql.Int, branchId)
      .input("Position", sql.NVarChar, position)
      .input("Specialization", sql.NVarChar, specialization)
      .input("Salary", sql.Decimal(18, 2), salary)
      .input("HireDate", sql.Date, hireDate)
      .input("YearsOfExperience", sql.Int, yearsOfExperience)
      .input("Bio", sql.NVarChar, bio)
      .input("ImageUrl", sql.NVarChar, imageUrl)
      .input("Status", sql.NVarChar, employeeStatus).query(`
        INSERT INTO Employees
          (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
        OUTPUT INSERTED.EmployeeId
        VALUES
          (@UserId, @BranchId, @Position, @Specialization, @Salary, @HireDate, @YearsOfExperience, @Bio, @ImageUrl, @Status)
      `);

    await transaction.commit();
    return getById(empResult.recordset[0].EmployeeId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function update(id, data) {
  const current = await getById(id);

  const fullName =
    data.fullName !== undefined ? text(data.fullName) : current.FullName;
  const email =
    data.email !== undefined ? text(data.email).toLowerCase() : current.Email;
  const phone = data.phone !== undefined ? nullable(data.phone) : current.Phone;
  const roleId =
    data.roleId !== undefined ? toInt(data.roleId) : current.RoleId;
  const userStatus =
    data.userStatus !== undefined
      ? status(data.userStatus)
      : current.UserStatus;
  const employeeStatus =
    data.status !== undefined ? status(data.status) : current.Status;
  const avatarUrl =
    data.avatarUrl !== undefined ? nullable(data.avatarUrl) : current.AvatarUrl;
  const imageUrl =
    data.imageUrl !== undefined ? nullable(data.imageUrl) : current.ImageUrl;
  const branchId =
    data.branchId !== undefined ? toInt(data.branchId) : current.BranchId;
  const position =
    data.position !== undefined ? nullable(data.position) : current.Position;
  const specialization =
    data.specialization !== undefined
      ? nullable(data.specialization)
      : current.Specialization;
  const salary =
    data.salary !== undefined ? toMoney(data.salary) : current.Salary;
  const hireDate =
    data.hireDate !== undefined ? data.hireDate || null : current.HireDate;
  const yearsOfExperience =
    data.yearsOfExperience !== undefined
      ? toInt(data.yearsOfExperience, 0)
      : current.YearsOfExperience;
  const bio = data.bio !== undefined ? nullable(data.bio) : current.Bio;

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!roleId) throw new Error("Vui lòng chọn vai trò");

  const pool = await connectDB();

  const existed = await pool
    .request()
    .input("Email", sql.NVarChar, email)
    .input("UserId", sql.Int, current.UserId).query(`
      SELECT TOP 1 UserId
      FROM Users
      WHERE Email = @Email AND UserId <> @UserId
    `);

  if (existed.recordset[0]) throw new Error("Email đã tồn tại");

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("UserId", sql.Int, current.UserId)
      .input("FullName", sql.NVarChar, fullName)
      .input("Email", sql.NVarChar, email)
      .input("Phone", sql.NVarChar, phone)
      .input("RoleId", sql.Int, roleId)
      .input("AvatarUrl", sql.NVarChar, avatarUrl)
      .input("Status", sql.NVarChar, userStatus).query(`
        UPDATE Users
        SET FullName = @FullName,
            Email = @Email,
            Phone = @Phone,
            RoleId = @RoleId,
            AvatarUrl = @AvatarUrl,
            Status = @Status,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);

    await new sql.Request(transaction)
      .input("EmployeeId", sql.Int, Number(id))
      .input("BranchId", sql.Int, branchId)
      .input("Position", sql.NVarChar, position)
      .input("Specialization", sql.NVarChar, specialization)
      .input("Salary", sql.Decimal(18, 2), salary)
      .input("HireDate", sql.Date, hireDate)
      .input("YearsOfExperience", sql.Int, yearsOfExperience)
      .input("Bio", sql.NVarChar, bio)
      .input("ImageUrl", sql.NVarChar, imageUrl)
      .input("Status", sql.NVarChar, employeeStatus).query(`
        UPDATE Employees
        SET BranchId = @BranchId,
            Position = @Position,
            Specialization = @Specialization,
            Salary = @Salary,
            HireDate = @HireDate,
            YearsOfExperience = @YearsOfExperience,
            Bio = @Bio,
            ImageUrl = @ImageUrl,
            Status = @Status
        WHERE EmployeeId = @EmployeeId
      `);

    await transaction.commit();
    return getById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function changeStatus(id, data) {
  const nextStatus = status(data.status);
  if (!["ACTIVE", "INACTIVE", "BANNED"].includes(nextStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const current = await getById(id);
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("UserId", sql.Int, current.UserId)
      .input("Status", sql.NVarChar, nextStatus).query(`
        UPDATE Users
        SET Status = @Status,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);

    await new sql.Request(transaction)
      .input("EmployeeId", sql.Int, Number(id))
      .input("Status", sql.NVarChar, nextStatus).query(`
        UPDATE Employees
        SET Status = @Status
        WHERE EmployeeId = @EmployeeId
      `);

    await transaction.commit();
    return getById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function getAssignedServices(employeeId) {
  const pool = await connectDB();
  const result = await pool.request().input("EmployeeId", sql.Int, Number(employeeId)).query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      sc.CategoryName,
      CASE WHEN es.EmployeeId IS NOT NULL THEN 1 ELSE 0 END AS Assigned
    FROM Services s
    JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
    LEFT JOIN EmployeeServices es ON s.ServiceId = es.ServiceId AND es.EmployeeId = @EmployeeId
    WHERE s.Status = 'ACTIVE'
    ORDER BY sc.CategoryName, s.ServiceName
  `);
  return result.recordset;
}

async function updateAssignedServices(employeeId, serviceIds = []) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("EmployeeId", sql.Int, Number(employeeId))
      .query("DELETE FROM EmployeeServices WHERE EmployeeId = @EmployeeId");

    if (serviceIds && serviceIds.length > 0) {
      for (const serviceId of serviceIds) {
        await new sql.Request(transaction)
          .input("EmployeeId", sql.Int, Number(employeeId))
          .input("ServiceId", sql.Int, Number(serviceId))
          .query("INSERT INTO EmployeeServices (EmployeeId, ServiceId) VALUES (@EmployeeId, @ServiceId)");
      }
    }

    await transaction.commit();
    return await getAssignedServices(employeeId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

module.exports = {
  getRoles,
  getBranches,
  list,
  getById,
  getByUserId,
  create,
  update,
  changeStatus,
  getAssignedServices,
  updateAssignedServices,
};
