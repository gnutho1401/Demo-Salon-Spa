const { sql, connectDB } = require("../../config/db");
const bcrypt = require("bcryptjs");

function text(v) {
  return String(v || "").trim();
}

function nullable(v) {
  const x = text(v);
  return x || null;
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
        ml.MembershipLevelId,
        ml.LevelName AS MembershipLevelName,
        e.EmployeeId,
        e.Position,
        e.Specialization,
        e.BranchId,
        b.BranchName,
        e.Salary,
        e.HireDate,
        e.YearsOfExperience,
        e.Bio,
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
        ml.MembershipLevelId,
        ml.LevelName AS MembershipLevelName,
        e.EmployeeId,
        e.Position,
        e.Specialization,
        e.BranchId,
        b.BranchName,
        e.Salary,
        e.HireDate,
        e.YearsOfExperience,
        e.Bio,
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
        AND (CAST(@ExcludeId AS INT) IS NULL OR UserId <> CAST(@ExcludeId AS INT))
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
          AND (CAST(@ExcludeId AS INT) IS NULL OR UserId <> CAST(@ExcludeId AS INT))
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
  if (!emailRegex.test(email)) throw new Error("Email không đúng định dạng");
  if (phone && !phoneRegex.test(phone))
    throw new Error("Số điện thoại phải từ 9 đến 15 chữ số");
  if (!password || password.length < 6)
    throw new Error("Mật khẩu mới phải từ 6 ký tự");
  if (!roleId) throw new Error("Vui lòng chọn role");

  const pool = await connectDB();
  await ensureUnique(pool, email, phone);

  // Get RoleName
  const roleRes = await pool.request().input("RoleId", sql.Int, roleId).query(`
    SELECT RoleName FROM Roles WHERE RoleId = @RoleId
  `);
  const roleName = roleRes.recordset[0]?.RoleName;
  if (!roleName) throw new Error("Vai trò không hợp lệ");

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
      .input("AvatarUrl", sql.NVarChar, avatarUrl)
      .input("Status", sql.NVarChar, userStatus)
      .input("IsVerified", sql.Bit, isVerified).query(`
        INSERT INTO Users
          (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified)
        OUTPUT INSERTED.UserId
        VALUES
          (@FullName, @Email, @Phone, @PasswordHash, @RoleId, @AvatarUrl, @Status, @IsVerified)
      `);

    const userId = userResult.recordset[0].UserId;

    if (roleName === "CUSTOMER") {
      const gender = nullable(data.Gender ?? data.gender) || "Khác";
      const dateOfBirth = nullable(data.DateOfBirth ?? data.dateOfBirth);
      const address = nullable(data.Address ?? data.address);
      const loyaltyPoints = toInt(data.LoyaltyPoints ?? data.loyaltyPoints, 0);

      // Get default membership level if not provided
      const requestMlId = toInt(
        data.MembershipLevelId ?? data.membershipLevelId,
        null,
      );
      let mlId = requestMlId;
      if (mlId === null) {
        const mlRes = await new sql.Request(transaction).query(`
          SELECT TOP 1 MembershipLevelId FROM MembershipLevels ORDER BY MinPoints ASC
        `);
        mlId = mlRes.recordset[0]?.MembershipLevelId || null;
      }

      await new sql.Request(transaction)
        .input("UserId", sql.Int, userId)
        .input("Gender", sql.NVarChar, gender)
        .input("DateOfBirth", sql.Date, dateOfBirth)
        .input("Address", sql.NVarChar, address)
        .input("LoyaltyPoints", sql.Int, loyaltyPoints)
        .input("MembershipLevelId", sql.Int, mlId).query(`
          INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
          VALUES (@UserId, @Gender, @DateOfBirth, @Address, @LoyaltyPoints, @MembershipLevelId)
        `);
    } else {
      // Employee roles
      const branchId = toInt(data.BranchId ?? data.branchId);
      const position = nullable(data.Position ?? data.position) || roleName;
      const specialization = nullable(
        data.Specialization ?? data.specialization,
      );
      const salary =
        data.Salary !== undefined && data.Salary !== ""
          ? Number(data.Salary)
          : null;
      const hireDate = nullable(data.HireDate ?? data.hireDate) || new Date();
      const yearsOfExperience = toInt(
        data.YearsOfExperience ?? data.yearsOfExperience,
        0,
      );
      const bio = nullable(data.Bio ?? data.bio);

      await new sql.Request(transaction)
        .input("UserId", sql.Int, userId)
        .input("BranchId", sql.Int, branchId)
        .input("Position", sql.NVarChar, position)
        .input("Specialization", sql.NVarChar, specialization)
        .input("Salary", sql.Decimal(18, 2), salary)
        .input("HireDate", sql.Date, hireDate)
        .input("YearsOfExperience", sql.Int, yearsOfExperience)
        .input("Bio", sql.NVarChar, bio)
        .input("ImageUrl", sql.NVarChar, avatarUrl)
        .input("Status", sql.NVarChar, userStatus).query(`
          INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
          VALUES (@UserId, @BranchId, @Position, @Specialization, @Salary, @HireDate, @YearsOfExperience, @Bio, @ImageUrl, @Status)
        `);
    }

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
  if (!emailRegex.test(email)) throw new Error("Email không đúng định dạng");
  if (phone && !phoneRegex.test(phone))
    throw new Error("Số điện thoại phải từ 9 đến 15 chữ số");
  if (!roleId) throw new Error("Vui lòng chọn role");

  if (!["ACTIVE", "INACTIVE", "BANNED"].includes(userStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  await ensureUnique(pool, email, phone, Number(id));

  // Get RoleName of the updated RoleId
  const roleRes = await pool.request().input("RoleId", sql.Int, roleId).query(`
    SELECT RoleName FROM Roles WHERE RoleId = @RoleId
  `);
  const roleName = roleRes.recordset[0]?.RoleName;
  if (!roleName) throw new Error("Vai trò không hợp lệ");

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Update general User table
    await new sql.Request(transaction)
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

    // 2. Handle sub-tables (Customers or Employees)
    if (roleName === "CUSTOMER") {
      const gender =
        data.Gender !== undefined ? defNullable(data.Gender) : current.Gender;
      const dateOfBirth =
        data.DateOfBirth !== undefined
          ? defNullable(data.DateOfBirth)
          : current.DateOfBirth;
      const address =
        data.Address !== undefined
          ? defNullable(data.Address)
          : current.Address;
      const loyaltyPoints =
        data.LoyaltyPoints !== undefined
          ? toInt(data.LoyaltyPoints, 0)
          : toInt(current.LoyaltyPoints, 0);
      const membershipLevelId =
        data.MembershipLevelId !== undefined
          ? toInt(data.MembershipLevelId)
          : current.MembershipLevelId;

      // Clean up old Employee role if switching from Employee to Customer
      const empCheck = await new sql.Request(transaction)
        .input("UserId", sql.Int, Number(id))
        .query(`SELECT EmployeeId FROM Employees WHERE UserId = @UserId`);
      const empId = empCheck.recordset[0]
        ? empCheck.recordset[0].EmployeeId
        : null;
      if (empId) {
        const hasRecords = await new sql.Request(transaction).input(
          "EmpId",
          sql.Int,
          empId,
        ).query(`
            SELECT 1 AS HasData WHERE
              EXISTS (SELECT 1 FROM Appointments WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM Reviews WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM TreatmentNotes WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM TechnicianEarningGoals WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM TechnicianPayoutRequests WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM TechnicianPayoutLedger WHERE EmployeeId = @EmpId)
              OR EXISTS (SELECT 1 FROM EmployeePerformance WHERE EmployeeId = @EmpId)
          `);
        if (hasRecords.recordset[0]) {
          await new sql.Request(transaction)
            .input("EmpId", sql.Int, empId)
            .query(
              `UPDATE Employees SET Status = 'INACTIVE' WHERE EmployeeId = @EmpId`,
            );
        } else {
          await new sql.Request(transaction).input("EmpId", sql.Int, empId)
            .query(`
              DELETE FROM ShiftRegistrations WHERE TechnicianId = @EmpId;
              DELETE FROM EmployeeServices WHERE EmployeeId = @EmpId;
              DELETE FROM CustomerFavoriteEmployees WHERE EmployeeId = @EmpId;
              DELETE FROM Employees WHERE EmployeeId = @EmpId;
            `);
        }
      }

      // Check if Customer row exists
      const checkRes = await new sql.Request(transaction).input(
        "UserId",
        sql.Int,
        Number(id),
      ).query(`
        SELECT CustomerId FROM Customers WHERE UserId = @UserId
      `);

      if (checkRes.recordset[0]) {
        // Update Customer
        await new sql.Request(transaction)
          .input("UserId", sql.Int, Number(id))
          .input("Gender", sql.NVarChar, gender)
          .input("DateOfBirth", sql.Date, dateOfBirth)
          .input("Address", sql.NVarChar, address)
          .input("LoyaltyPoints", sql.Int, loyaltyPoints)
          .input("MembershipLevelId", sql.Int, membershipLevelId).query(`
            UPDATE Customers
            SET Gender = @Gender,
                DateOfBirth = @DateOfBirth,
                Address = @Address,
                LoyaltyPoints = @LoyaltyPoints,
                MembershipLevelId = @MembershipLevelId
            WHERE UserId = @UserId
          `);
      } else {
        // Insert Customer
        const mlRes = await new sql.Request(transaction).query(`
          SELECT TOP 1 MembershipLevelId FROM MembershipLevels ORDER BY MinPoints ASC
        `);
        const mlId = mlRes.recordset[0]?.MembershipLevelId || null;

        await new sql.Request(transaction)
          .input("UserId", sql.Int, Number(id))
          .input("Gender", sql.NVarChar, gender || "Khác")
          .input("DateOfBirth", sql.Date, dateOfBirth)
          .input("Address", sql.NVarChar, address)
          .input("LoyaltyPoints", sql.Int, loyaltyPoints)
          .input("MembershipLevelId", sql.Int, membershipLevelId || mlId)
          .query(`
            INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
            VALUES (@UserId, @Gender, @DateOfBirth, @Address, @LoyaltyPoints, @MembershipLevelId)
          `);
      }
    } else {
      // Employee role
      const branchId =
        data.BranchId !== undefined ? toInt(data.BranchId) : current.BranchId;
      const position =
        data.Position !== undefined
          ? defNullable(data.Position)
          : current.Position;
      const specialization =
        data.Specialization !== undefined
          ? defNullable(data.Specialization)
          : current.Specialization;
      const salary =
        data.Salary !== undefined
          ? data.Salary === ""
            ? null
            : Number(data.Salary)
          : current.Salary;
      const hireDate =
        data.HireDate !== undefined
          ? defNullable(data.HireDate)
          : current.HireDate;
      const yearsOfExperience =
        data.YearsOfExperience !== undefined
          ? toInt(data.YearsOfExperience, 0)
          : toInt(current.YearsOfExperience, 0);
      const bio = data.Bio !== undefined ? defNullable(data.Bio) : current.Bio;

      // Clean up Customer record if switching from Customer to Employee
      const custCheck = await new sql.Request(transaction)
        .input("UserId", sql.Int, Number(id))
        .query(`SELECT CustomerId FROM Customers WHERE UserId = @UserId`);
      const custId = custCheck.recordset[0]
        ? custCheck.recordset[0].CustomerId
        : null;
      if (custId) {
        const hasRecords = await new sql.Request(transaction).input(
          "CustId",
          sql.Int,
          custId,
        ).query(`
            SELECT 1 AS HasData WHERE
              EXISTS (SELECT 1 FROM Appointments WHERE CustomerId = @CustId)
              OR EXISTS (SELECT 1 FROM Reviews WHERE CustomerId = @CustId)
              OR EXISTS (SELECT 1 FROM Feedbacks WHERE CustomerId = @CustId)
              OR EXISTS (SELECT 1 FROM WaitingList WHERE CustomerId = @CustId)
              OR EXISTS (SELECT 1 FROM AIRecommendations WHERE CustomerId = @CustId)
              OR EXISTS (SELECT 1 FROM LoyaltyPointTransactions WHERE CustomerId = @CustId)
          `);
        if (hasRecords.recordset[0]) {
          await new sql.Request(transaction)
            .input("CustId", sql.Int, custId)
            .query(
              `UPDATE Customers SET LoyaltyPoints = 0 WHERE CustomerId = @CustId`,
            );
        } else {
          await new sql.Request(transaction).input("CustId", sql.Int, custId)
            .query(`
              DELETE FROM CustomerVouchers WHERE CustomerId = @CustId;
              DELETE FROM CustomerPackages WHERE CustomerId = @CustId;
              DELETE FROM Customers WHERE CustomerId = @CustId;
            `);
        }
      }

      // Check if Employee row exists
      const checkRes = await new sql.Request(transaction).input(
        "UserId",
        sql.Int,
        Number(id),
      ).query(`
        SELECT EmployeeId FROM Employees WHERE UserId = @UserId
      `);

      if (checkRes.recordset[0]) {
        // Update Employee
        await new sql.Request(transaction)
          .input("UserId", sql.Int, Number(id))
          .input("BranchId", sql.Int, branchId)
          .input("Position", sql.NVarChar, position || roleName)
          .input("Specialization", sql.NVarChar, specialization)
          .input("Salary", sql.Decimal(18, 2), salary)
          .input("HireDate", sql.Date, hireDate)
          .input("YearsOfExperience", sql.Int, yearsOfExperience)
          .input("Bio", sql.NVarChar, bio)
          .input("ImageUrl", sql.NVarChar, avatarUrl)
          .input("Status", sql.NVarChar, userStatus).query(`
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
            WHERE UserId = @UserId
          `);
      } else {
        // Insert Employee
        await new sql.Request(transaction)
          .input("UserId", sql.Int, Number(id))
          .input("BranchId", sql.Int, branchId)
          .input("Position", sql.NVarChar, position || roleName)
          .input("Specialization", sql.NVarChar, specialization)
          .input("Salary", sql.Decimal(18, 2), salary)
          .input("HireDate", sql.Date, hireDate || new Date())
          .input("YearsOfExperience", sql.Int, yearsOfExperience || 0)
          .input("Bio", sql.NVarChar, bio)
          .input("ImageUrl", sql.NVarChar, avatarUrl)
          .input("Status", sql.NVarChar, userStatus).query(`
            INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
            VALUES (@UserId, @BranchId, @Position, @Specialization, @Salary, @HireDate, @YearsOfExperience, @Bio, @ImageUrl, @Status)
          `);
      }
    }

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
