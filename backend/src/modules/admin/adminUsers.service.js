const { sql, connectDB } = require("../../config/db");
const bcrypt = require("bcryptjs");

function text(v) {
  return String(v || "").trim();
}

function nullable(v) {
  const x = text(v);
  return x || null;
}

function toInt(v, fallback = null) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBit(v) {
  return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
}

function status(v, fallback = "ACTIVE") {
  return String(v || fallback)
    .trim()
    .toUpperCase();
}

async function getRoles() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT RoleId, RoleName
    FROM Roles
    ORDER BY RoleId ASC
  `);

  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const roleId = toInt(filters.roleId);
  const userStatus = filters.status ? status(filters.status) : null;
  const isVerified =
    filters.isVerified === undefined || filters.isVerified === ""
      ? null
      : toBit(filters.isVerified);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("RoleId", sql.Int, roleId)
    .input("Status", sql.NVarChar, userStatus)
    .input("IsVerified", sql.Bit, isVerified).query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        u.IsVerified,
        u.GoogleId,
        u.CreatedAt,
        u.UpdatedAt,
        r.RoleId,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.LevelName AS MembershipLevelName,
        e.EmployeeId,
        e.Position,
        e.Specialization,
        e.BranchId,
        b.BranchName,
        ISNULL(ap.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(pay.TotalPaid, 0) AS TotalPaid
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN Employees e ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT COUNT(*) AS AppointmentCount
        FROM Appointments a
        WHERE a.CustomerId = c.CustomerId OR a.EmployeeId = e.EmployeeId
      ) ap
      OUTER APPLY (
        SELECT SUM(ISNULL(p.Amount, 0)) AS TotalPaid
        FROM Appointments a
        JOIN Invoices i ON i.AppointmentId = a.AppointmentId
        JOIN Payments p ON p.InvoiceId = i.InvoiceId
        WHERE a.CustomerId = c.CustomerId
          AND p.Status = 'PAID'
      ) pay
      WHERE
        (@Keyword IS NULL OR u.FullName LIKE @Keyword OR u.Email LIKE @Keyword OR u.Phone LIKE @Keyword)
        AND (@RoleId IS NULL OR u.RoleId = @RoleId)
        AND (@Status IS NULL OR u.Status = @Status)
        AND (@IsVerified IS NULL OR u.IsVerified = @IsVerified)
      ORDER BY u.UserId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, Number(id))
    .query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        u.IsVerified,
        u.GoogleId,
        u.CreatedAt,
        u.UpdatedAt,
        r.RoleId,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.LevelName AS MembershipLevelName,
        e.EmployeeId,
        e.Position,
        e.Specialization,
        e.BranchId,
        b.BranchName,
        ISNULL(ap.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(pay.TotalPaid, 0) AS TotalPaid
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN Employees e ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT COUNT(*) AS AppointmentCount
        FROM Appointments a
        WHERE a.CustomerId = c.CustomerId OR a.EmployeeId = e.EmployeeId
      ) ap
      OUTER APPLY (
        SELECT SUM(ISNULL(p.Amount, 0)) AS TotalPaid
        FROM Appointments a
        JOIN Invoices i ON i.AppointmentId = a.AppointmentId
        JOIN Payments p ON p.InvoiceId = i.InvoiceId
        WHERE a.CustomerId = c.CustomerId
          AND p.Status = 'PAID'
      ) pay
      WHERE u.UserId = @UserId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy người dùng");
  return row;
}

async function ensureUnique(pool, email, phone, excludeId = null) {
  const emailCheck = await pool
    .request()
    .input("Email", sql.NVarChar, email)
    .input("ExcludeId", sql.Int, excludeId).query(`
      SELECT TOP 1 UserId
      FROM Users
      WHERE LOWER(Email) = LOWER(@Email)
        AND (@ExcludeId IS NULL OR UserId <> @ExcludeId)
    `);

  if (emailCheck.recordset[0]) throw new Error("Email đã tồn tại");

  if (phone) {
    const phoneCheck = await pool
      .request()
      .input("Phone", sql.NVarChar, phone)
      .input("ExcludeId", sql.Int, excludeId).query(`
        SELECT TOP 1 UserId
        FROM Users
        WHERE Phone = @Phone
          AND (@ExcludeId IS NULL OR UserId <> @ExcludeId)
      `);

    if (phoneCheck.recordset[0]) throw new Error("Số điện thoại đã tồn tại");
  }
}

async function create(data) {
  const fullName = text(data.FullName ?? data.fullName);
  const email = text(data.Email ?? data.email).toLowerCase();
  const phone = nullable(data.Phone ?? data.phone);
  const password = text(data.Password ?? data.password);
  const roleId = toInt(data.RoleId ?? data.roleId);
  const avatarUrl = nullable(data.AvatarUrl ?? data.avatarUrl);
  const userStatus = status(data.Status ?? data.status);
  const isVerified = toBit(data.IsVerified ?? data.isVerified ?? 1);

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!password) throw new Error("Mật khẩu không được để trống");
  if (!roleId) throw new Error("Vui lòng chọn role");

  const pool = await connectDB();

  await ensureUnique(pool, email, phone);

  const hash = await bcrypt.hash(password, 10);

  const result = await pool
    .request()
    .input("FullName", sql.NVarChar, fullName)
    .input("Email", sql.NVarChar, email)
    .input("Phone", sql.NVarChar, phone)
    .input("PasswordHash", sql.NVarChar, hash)
    .input("RoleId", sql.Int, roleId)
    .input("AvatarUrl", sql.NVarChar, avatarUrl)
    .input("Status", sql.NVarChar, userStatus)
    .input("IsVerified", sql.Bit, isVerified).query(`
      INSERT INTO Users
        (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified)
      OUTPUT INSERTED.UserId
      VALUES
        (@FullName, @Email, @Phone, @PasswordHash, @RoleId, @AvatarUrl, @Status, @IsVerified)
    `);

  return getById(result.recordset[0].UserId);
}

async function update(id, data) {
  const current = await getById(id);
  const pool = await connectDB();

  const fullName =
    data.FullName !== undefined || data.fullName !== undefined
      ? text(data.FullName ?? data.fullName)
      : current.FullName;

  const email =
    data.Email !== undefined || data.email !== undefined
      ? text(data.Email ?? data.email).toLowerCase()
      : current.Email;

  const phone =
    data.Phone !== undefined || data.phone !== undefined
      ? nullable(data.Phone ?? data.phone)
      : current.Phone;

  const roleId =
    data.RoleId !== undefined || data.roleId !== undefined
      ? toInt(data.RoleId ?? data.roleId)
      : current.RoleId;

  const avatarUrl =
    data.AvatarUrl !== undefined || data.avatarUrl !== undefined
      ? nullable(data.AvatarUrl ?? data.avatarUrl)
      : current.AvatarUrl;

  const userStatus =
    data.Status !== undefined || data.status !== undefined
      ? status(data.Status ?? data.status)
      : current.Status;

  const isVerified =
    data.IsVerified !== undefined || data.isVerified !== undefined
      ? toBit(data.IsVerified ?? data.isVerified)
      : current.IsVerified;

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!roleId) throw new Error("Vui lòng chọn role");

  if (!["ACTIVE", "INACTIVE", "BANNED"].includes(userStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  await ensureUnique(pool, email, phone, Number(id));

  await pool
    .request()
    .input("UserId", sql.Int, Number(id))
    .input("FullName", sql.NVarChar, fullName)
    .input("Email", sql.NVarChar, email)
    .input("Phone", sql.NVarChar, phone)
    .input("RoleId", sql.Int, roleId)
    .input("AvatarUrl", sql.NVarChar, avatarUrl)
    .input("Status", sql.NVarChar, userStatus)
    .input("IsVerified", sql.Bit, isVerified).query(`
      UPDATE Users
      SET FullName = @FullName,
          Email = @Email,
          Phone = @Phone,
          RoleId = @RoleId,
          AvatarUrl = @AvatarUrl,
          Status = @Status,
          IsVerified = @IsVerified,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return getById(id);
}

async function changeStatus(id, data = {}) {
  const nextStatus = status(data.Status ?? data.status);

  if (!["ACTIVE", "INACTIVE", "BANNED"].includes(nextStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("UserId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Users
      SET Status = @Status,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return getById(id);
}

async function updateRole(id, data = {}) {
  return update(id, { RoleId: data.RoleId ?? data.roleId });
}

async function resetPassword(id, data = {}) {
  const password = text(data.Password ?? data.password);

  if (!password || password.length < 6) {
    throw new Error("Mật khẩu mới phải từ 6 ký tự");
  }

  await getById(id);

  const hash = await bcrypt.hash(password, 10);
  const pool = await connectDB();

  await pool
    .request()
    .input("UserId", sql.Int, Number(id))
    .input("PasswordHash", sql.NVarChar, hash).query(`
      UPDATE Users
      SET PasswordHash = @PasswordHash,
          ResetPasswordToken = NULL,
          ResetPasswordExpires = NULL,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return getById(id);
}

module.exports = {
  getRoles,
  list,
  getById,
  create,
  update,
  updateRole,
  changeStatus,
  resetPassword,
};
