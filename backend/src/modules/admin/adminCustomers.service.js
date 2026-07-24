const { sql, connectDB } = require("../../config/db");
const bcrypt = require("bcryptjs");
const {
  updateCustomerMembershipLevel,
} = require("../../utils/membershipDiscount");

function text(v) {
  return String(v || "").trim();
}

const defNullable = (v) => {
  const x = text(v);
  return x || null;
};

function toInt(v, fallback = null) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : fallback;
}

function toBit(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function status(v, fallback = "ACTIVE") {
  return String(v || fallback)
    .trim()
    .toUpperCase();
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9+\-\s]{9,15}$/;

async function getMembershipLevels() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT MembershipLevelId, LevelName, MinPoints, DiscountPercent
    FROM MembershipLevels
    ORDER BY MinPoints ASC
  `);
  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const membershipLevelId = toInt(filters.membershipLevelId);
  const gender = text(filters.gender);
  const userStatus = filters.status ? status(filters.status) : null;

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("MembershipLevelId", sql.Int, membershipLevelId)
    .input("Gender", sql.NVarChar, gender || null)
    .input("Status", sql.NVarChar, userStatus).query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        u.IsVerified,
        u.CreatedAt,
        u.UpdatedAt,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.MembershipLevelId,
        ml.LevelName AS MembershipLevelName,
        ISNULL(ap.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(pay.TotalPaid, 0) AS TotalPaid
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      JOIN Customers c ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT COUNT(*) AS AppointmentCount
        FROM Appointments a
        WHERE a.CustomerId = c.CustomerId
      ) ap
      OUTER APPLY (
        SELECT SUM(ISNULL(p.Amount, 0)) AS TotalPaid
        FROM Appointments a
        JOIN Invoices i ON i.AppointmentId = a.AppointmentId
        JOIN Payments p ON p.InvoiceId = i.InvoiceId
        WHERE a.CustomerId = c.CustomerId
          AND p.Status = 'PAID'
      ) pay
      WHERE r.RoleName = 'CUSTOMER'
        AND (@Keyword IS NULL OR u.FullName LIKE @Keyword OR u.Email LIKE @Keyword OR u.Phone LIKE @Keyword)
        AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
        AND (@Gender IS NULL OR c.Gender = @Gender)
        AND (@Status IS NULL OR u.Status = @Status)
      ORDER BY u.UserId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const detailsResult = await pool
    .request()
    .input("UserId", sql.Int, Number(id)).query(`
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
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.MembershipLevelId,
        ml.LevelName AS MembershipLevelName,
        ISNULL(pay.TotalPaid, 0) AS TotalPaid
      FROM Users u
      JOIN Customers c ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
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

  const customer = detailsResult.recordset[0];
  if (!customer) throw new Error("Không tìm thấy khách hàng");

  // Load appointments
  const appointmentsResult = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        i.FinalAmount,
        p.Status AS PaymentStatus,
        eu.FullName AS EmployeeName
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON i.AppointmentId = a.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 Status
        FROM Payments p
        WHERE p.InvoiceId = i.InvoiceId
        ORDER BY p.CreatedAt DESC
      ) p
      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);

  // Load packages
  const packagesResult = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT
        cp.CustomerPackageId,
        p.PackageName,
        cp.TotalSessions,
        cp.RemainingSessions AS SessionsLeft,
        cp.EndDate AS ExpiryDate,
        cp.Status,
        cp.CreatedAt AS BoughtAt,
        pp.Amount AS PaidAmount,
        pp.Status AS PaymentStatus
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      LEFT JOIN PackagePayments pp ON cp.CustomerPackageId = pp.CustomerPackageId
      WHERE cp.CustomerId = @CustomerId
      ORDER BY cp.CreatedAt DESC
    `);

  // Load feedbacks & reviews
  const feedsResult = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT
        'review' AS ItemType,
        r.ReviewId AS Id,
        CAST(r.Rating AS DECIMAL(10,1)) AS Score,
        r.Comment,
        r.Status,
        r.CreatedAt,
        s.ServiceName AS TargetName
      FROM Reviews r
      JOIN Services s ON r.ServiceId = s.ServiceId
      WHERE r.CustomerId = @CustomerId

      UNION ALL

      SELECT
        'feedback' AS ItemType,
        f.FeedbackId AS Id,
        NULL AS Score,
        f.Content AS Comment,
        f.Status,
        f.CreatedAt,
        f.Subject AS TargetName
      FROM Feedbacks f
      WHERE f.CustomerId = @CustomerId
      ORDER BY CreatedAt DESC
    `);

  return {
    profile: customer,
    appointments: appointmentsResult.recordset,
    packages: packagesResult.recordset,
    history: feedsResult.recordset,
  };
}

async function ensureUnique(pool, email, phone, excludeUserId = null) {
  const emailCheck = await pool
    .request()
    .input("Email", sql.NVarChar, email)
    .input("ExcludeId", sql.Int, excludeUserId).query(`
      SELECT TOP 1 UserId FROM Users
      WHERE LOWER(Email) = LOWER(@Email)
        AND (CAST(@ExcludeId AS INT) IS NULL OR UserId <> CAST(@ExcludeId AS INT))
    `);
  if (emailCheck.recordset[0]) throw new Error("Email đã tồn tại");

  if (phone) {
    const phoneCheck = await pool
      .request()
      .input("Phone", sql.NVarChar, phone)
      .input("ExcludeId", sql.Int, excludeUserId).query(`
        SELECT TOP 1 UserId FROM Users
        WHERE Phone = @Phone
          AND (CAST(@ExcludeId AS INT) IS NULL OR UserId <> CAST(@ExcludeId AS INT))
      `);
    if (phoneCheck.recordset[0]) throw new Error("Số điện thoại đã tồn tại");
  }
}

async function create(data) {
  const fullName = text(data.FullName || data.fullName);
  const email = text(data.Email || data.email).toLowerCase();
  const phone = defNullable(data.Phone || data.phone);
  const password = text(data.Password || data.password);
  const gender = defNullable(data.Gender || data.gender);
  const dateOfBirth = defNullable(data.DateOfBirth || data.dateOfBirth);
  const address = defNullable(data.Address || data.address);
  const userStatus = status(data.Status || data.status);
  const isVerified = toBit(data.IsVerified ?? data.isVerified ?? 1);

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!emailRegex.test(email)) throw new Error("Email không đúng định dạng");
  if (phone && !phoneRegex.test(phone))
    throw new Error("Số điện thoại phải từ 9 đến 15 chữ số");
  if (!password || password.length < 6)
    throw new Error("Mật khẩu mới phải từ 6 ký tự");

  const pool = await connectDB();
  await ensureUnique(pool, email, phone);

  // Get Customer role
  const roleRes = await pool
    .request()
    .query("SELECT RoleId FROM Roles WHERE RoleName = 'CUSTOMER'");
  const roleId = roleRes.recordset[0]?.RoleId;
  if (!roleId) throw new Error("Không tìm thấy vai trò CUSTOMER trên hệ thống");

  const hash = await bcrypt.hash(password, 10);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const userResult = await new sql.Request(transaction)
      .input("FullName", sql.NVarChar, fullName)
      .input("Email", sql.NVarChar, email)
      .input("Phone", sql.NVarChar, phone)
      .input("PasswordHash", sql.NVarChar, hash)
      .input("RoleId", sql.Int, roleId)
      .input("Status", sql.NVarChar, userStatus)
      .input("IsVerified", sql.Bit, isVerified).query(`
        INSERT INTO Users
          (FullName, Email, Phone, PasswordHash, RoleId, Status, IsVerified)
        OUTPUT INSERTED.UserId
        VALUES
          (@FullName, @Email, @Phone, @PasswordHash, @RoleId, @Status, @IsVerified)
      `);

    const userId = userResult.recordset[0].UserId;

    // Get default membership level
    const defaultLevelRes = await new sql.Request(transaction).query(`
      SELECT TOP 1 MembershipLevelId FROM MembershipLevels ORDER BY MinPoints ASC
    `);
    const defaultLevelId =
      defaultLevelRes.recordset[0]?.MembershipLevelId || null;

    const customerResult = await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("Gender", sql.NVarChar, gender)
      .input("DateOfBirth", sql.Date, dateOfBirth)
      .input("Address", sql.NVarChar, address)
      .input("MembershipLevelId", sql.Int, defaultLevelId).query(`
        INSERT INTO Customers
          (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
        OUTPUT INSERTED.CustomerId
        VALUES
          (@UserId, @Gender, @DateOfBirth, @Address, 0, @MembershipLevelId)
      `);

    await transaction.commit();
    return getById(userId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function update(id, data) {
  const current = await getById(id);
  const pool = await connectDB();

  const fullName =
    data.FullName !== undefined
      ? text(data.FullName)
      : current.profile.FullName;
  const email =
    data.Email !== undefined
      ? text(data.Email).toLowerCase()
      : current.profile.Email;
  const phone =
    data.Phone !== undefined ? defNullable(data.Phone) : current.profile.Phone;
  const gender =
    data.Gender !== undefined
      ? defNullable(data.Gender)
      : current.profile.Gender;
  const dateOfBirth =
    data.DateOfBirth !== undefined
      ? defNullable(data.DateOfBirth)
      : current.profile.DateOfBirth;
  const address =
    data.Address !== undefined
      ? defNullable(data.Address)
      : current.profile.Address;
  const userStatus =
    data.Status !== undefined ? status(data.Status) : current.profile.Status;
  const isVerified =
    data.IsVerified !== undefined
      ? toBit(data.IsVerified)
      : current.profile.IsVerified;
  const membershipLevelId =
    data.MembershipLevelId !== undefined
      ? toInt(data.MembershipLevelId)
      : current.profile.MembershipLevelId;

  if (!fullName) throw new Error("Họ tên không được để trống");
  if (!email) throw new Error("Email không được để trống");
  if (!emailRegex.test(email)) throw new Error("Email không đúng định dạng");
  if (phone && !phoneRegex.test(phone))
    throw new Error("Số điện thoại phải từ 9 đến 15 chữ số");

  await ensureUnique(pool, email, phone, Number(id));

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("UserId", sql.Int, Number(id))
      .input("FullName", sql.NVarChar, fullName)
      .input("Email", sql.NVarChar, email)
      .input("Phone", sql.NVarChar, phone)
      .input("Status", sql.NVarChar, userStatus)
      .input("IsVerified", sql.Bit, isVerified).query(`
        UPDATE Users
        SET FullName = @FullName,
            Email = @Email,
            Phone = @Phone,
            Status = @Status,
            IsVerified = @IsVerified,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);

    await new sql.Request(transaction)
      .input("UserId", sql.Int, Number(id))
      .input("Gender", sql.NVarChar, gender)
      .input("DateOfBirth", sql.Date, dateOfBirth)
      .input("Address", sql.NVarChar, address)
      .input("MembershipLevelId", sql.Int, membershipLevelId).query(`
        UPDATE Customers
        SET Gender = @Gender,
            DateOfBirth = @DateOfBirth,
            Address = @Address,
            MembershipLevelId = @MembershipLevelId
        WHERE UserId = @UserId
      `);

    await updateCustomerMembershipLevel(
      transaction,
      current.profile.CustomerId,
    );

    await transaction.commit();
    return getById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function adjustPoints(id, data = {}) {
  const pointsDelta = toInt(data.Points ?? data.points, 0);
  const note =
    text(data.Note ?? data.note) || "Điều chỉnh điểm bởi quản trị viên";

  if (pointsDelta === 0) throw new Error("Số điểm điều chỉnh phải khác 0");

  const current = await getById(id);
  const currentPoints = toInt(current.profile.LoyaltyPoints, 0);
  const nextPoints = currentPoints + pointsDelta;

  if (nextPoints < 0)
    throw new Error("Tổng điểm tích lũy sau điều chỉnh không được nhỏ hơn 0");

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("CustomerId", sql.Int, current.profile.CustomerId)
      .input("Points", sql.Int, nextPoints).query(`
        UPDATE Customers
        SET LoyaltyPoints = @Points
        WHERE CustomerId = @CustomerId
      `);

    await new sql.Request(transaction)
      .input("CustomerId", sql.Int, current.profile.CustomerId)
      .input("Points", sql.Int, Math.abs(pointsDelta))
      .input("Type", sql.NVarChar, pointsDelta > 0 ? "EARN" : "SPEND")
      .input("Note", sql.NVarChar, note).query(`
        INSERT INTO LoyaltyPointTransactions
          (CustomerId, Type, Points, Note)
        VALUES
          (@CustomerId, @Type, @Points, @Note)
      `);

    await updateCustomerMembershipLevel(
      transaction,
      current.profile.CustomerId,
    );

    await transaction.commit();
    return getById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function changeStatus(id, data = {}) {
  const nextStatus = status(data.status || data.Status);
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

async function resetPassword(id, data = {}) {
  const password = text(data.Password || data.password);
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
  getMembershipLevels,
  list,
  getById,
  create,
  update,
  adjustPoints,
  changeStatus,
  resetPassword,
};
