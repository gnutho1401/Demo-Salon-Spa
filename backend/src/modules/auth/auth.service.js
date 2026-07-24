const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const { sql, connectDB } = require("../../config/db");
const { jwtSecret } = require("../../config/env");
const jwt = require("jsonwebtoken");
const {
  sendVerifyEmail,
  sendResetPasswordEmail,
} = require("../../utils/sendMail");

function createToken(user) {
  return jwt.sign(
    {
      userId: user.UserId,
      role: user.RoleName,
    },
    jwtSecret,
    { expiresIn: "1d" },
  );
}

function createVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email) {
  return email?.trim().toLowerCase();
}

function isBcryptHash(value) {
  return (
    value?.startsWith("$2a$") ||
    value?.startsWith("$2b$") ||
    value?.startsWith("$2y$")
  );
}

async function getUserByEmail(email) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input("Email", sql.NVarChar, normalizeEmail(email)).query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.PasswordHash,
        u.RoleId,
        u.Status,
        u.IsVerified,
        u.AvatarUrl,
        u.GoogleId,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON u.UserId = c.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE u.Email = @Email
    `);

  return result.recordset[0];
}

async function getUserByGoogleId(googleId) {
  if (!googleId) return null;

  const pool = await connectDB();
  const result = await pool.request().input("GoogleId", sql.NVarChar, googleId)
    .query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.PasswordHash,
        u.RoleId,
        u.Status,
        u.IsVerified,
        u.AvatarUrl,
        u.GoogleId,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON u.UserId = c.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE u.GoogleId = @GoogleId
    `);

  return result.recordset[0];
}

async function getUserByPhone(phone) {
  if (!phone) return null;

  const pool = await connectDB();
  const result = await pool.request().input("Phone", sql.NVarChar, phone)
    .query(`
      SELECT UserId, Phone
      FROM Users
      WHERE Phone = @Phone
    `);

  return result.recordset[0];
}

function publicUser(user) {
  const clone = { ...user };
  delete clone.PasswordHash;
  delete clone.GoogleId;
  return clone;
}

async function register(data) {
  const pool = await connectDB();

  const fullName = data.fullName?.trim();
  const email = normalizeEmail(data.email);
  const phone = data.phone?.trim() || null;
  const password = data.password;
  const gender = data.gender?.trim() || null;
  const dateOfBirth = data.dateOfBirth || null;
  const address = data.address?.trim() || null;

  if (!fullName) {
    throw new Error("Vui lòng nhập họ tên");
  }

  if (!email) {
    throw new Error("Vui lòng nhập email");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email không hợp lệ");
  }

  if (!password) {
    throw new Error("Vui lòng nhập mật khẩu");
  }

  if (password.length < 6) {
    throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
  }

  if (phone && !/^[0-9]{9,11}$/.test(phone)) {
    throw new Error("Số điện thoại không hợp lệ");
  }

  const existed = await getUserByEmail(email);
  if (existed) {
    throw new Error("Email đã tồn tại");
  }

  if (phone) {
    const existedPhone = await getUserByPhone(phone);
    if (existedPhone) {
      throw new Error("Số điện thoại đã tồn tại");
    }
  }

  if (phone) {
    const pendingPhoneResult = await pool
      .request()
      .input("Phone", sql.NVarChar, phone).query(`
        SELECT PendingUserId
        FROM PendingUsers
        WHERE Phone = @Phone
      `);

    if (pendingPhoneResult.recordset[0]) {
      throw new Error("Số điện thoại đang chờ xác thực");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verifyCode = createVerifyCode();
  const verifyCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

  await pool
    .request()
    .input("Email", sql.NVarChar, email)
    .query(`DELETE FROM PendingUsers WHERE Email = @Email`);

  await pool
    .request()
    .input("FullName", sql.NVarChar, fullName)
    .input("Email", sql.NVarChar, email)
    .input("Phone", sql.NVarChar, phone)
    .input("PasswordHash", sql.NVarChar, hashedPassword)
    .input("Gender", sql.NVarChar, gender)
    .input("DateOfBirth", sql.Date, dateOfBirth)
    .input("Address", sql.NVarChar, address)
    .input("VerifyCode", sql.NVarChar, verifyCode)
    .input("VerifyCodeExpires", sql.DateTime, verifyCodeExpires).query(`
      INSERT INTO PendingUsers
      (FullName, Email, Phone, PasswordHash, Gender, DateOfBirth, Address, VerifyCode, VerifyCodeExpires)
      VALUES
      (@FullName, @Email, @Phone, @PasswordHash, @Gender, @DateOfBirth, @Address, @VerifyCode, @VerifyCodeExpires)
    `);

  await sendVerifyEmail(email, verifyCode);

  return {
    message: "Vui lòng kiểm tra Gmail để lấy mã xác thực",
  };
}

async function verifyEmail(email, code) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("Email", sql.NVarChar, normalizeEmail(email)).query(`
      SELECT *
      FROM PendingUsers
      WHERE Email = @Email
    `);

  const pendingUser = result.recordset[0];

  if (!pendingUser) {
    throw new Error("Email không tồn tại");
  }

  if (pendingUser.VerifyCode !== code?.trim()) {
    throw new Error("Mã xác thực không đúng");
  }

  const expireTime = new Date(pendingUser.VerifyCodeExpires);
  const now = new Date();

  if (expireTime.getTime() < now.getTime()) {
    throw new Error("Mã xác thực đã hết hạn");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const userResult = await new sql.Request(transaction)
      .input("FullName", sql.NVarChar, pendingUser.FullName)
      .input("Email", sql.NVarChar, pendingUser.Email)
      .input("Phone", sql.NVarChar, pendingUser.Phone)
      .input("PasswordHash", sql.NVarChar, pendingUser.PasswordHash).query(`
        INSERT INTO Users
        (FullName, Email, Phone, PasswordHash, RoleId, Status, IsVerified)
        OUTPUT INSERTED.UserId
        VALUES
        (@FullName, @Email, @Phone, @PasswordHash, (SELECT RoleId FROM Roles WHERE RoleName = 'CUSTOMER'), 'ACTIVE', 1)
      `);

    const userId = userResult.recordset[0].UserId;

    await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("Gender", sql.NVarChar, pendingUser.Gender)
      .input("DateOfBirth", sql.Date, pendingUser.DateOfBirth)
      .input("Address", sql.NVarChar, pendingUser.Address).query(`
        INSERT INTO Customers
        (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
        VALUES
        (@UserId, @Gender, @DateOfBirth, @Address, 0, (SELECT TOP 1 MembershipLevelId FROM MembershipLevels WHERE LevelName = N'Normal'))
      `);

    await new sql.Request(transaction).input(
      "Email",
      sql.NVarChar,
      pendingUser.Email,
    ).query(`
        DELETE FROM PendingUsers
        WHERE Email = @Email
      `);

    await transaction.commit();

    return {
      message: "Xác thực email thành công. Tài khoản đã được tạo",
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }
}

async function resendVerifyCode(email) {
  const pool = await connectDB();
  const normalizedEmail = normalizeEmail(email);

  const result = await pool
    .request()
    .input("Email", sql.NVarChar, normalizedEmail).query(`
      SELECT *
      FROM PendingUsers
      WHERE Email = @Email
    `);

  const pendingUser = result.recordset[0];

  if (!pendingUser) {
    throw new Error("Email không tồn tại hoặc tài khoản đã được xác thực");
  }

  const verifyCode = createVerifyCode();
  const verifyCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

  await pool
    .request()
    .input("Email", sql.NVarChar, normalizedEmail)
    .input("VerifyCode", sql.NVarChar, verifyCode)
    .input("VerifyCodeExpires", sql.DateTime, verifyCodeExpires).query(`
      UPDATE PendingUsers
      SET 
        VerifyCode = @VerifyCode,
        VerifyCodeExpires = @VerifyCodeExpires
      WHERE Email = @Email
    `);

  const mailResult = await sendVerifyEmail(normalizedEmail, verifyCode);

  const exposeDevCode =
    mailResult.skipped &&
    process.env.NODE_ENV !== "production" &&
    process.env.EXPOSE_DEV_AUTH_TOKENS === "true";
  return {
    message: exposeDevCode
      ? `Đã tạo mã xác thực DEV: ${verifyCode}`
      : "Đã gửi lại mã xác thực email",
    devVerifyCode: exposeDevCode ? verifyCode : undefined,
  };
}

async function login(email, password) {
  const user = await getUserByEmail(email);

  if (!user) throw new Error("Email không tồn tại");
  if (user.Status && user.Status !== "ACTIVE")
    throw new Error("Tài khoản đã bị khóa hoặc không hoạt động");
  if (!user.IsVerified) throw new Error("Tài khoản chưa xác thực email");

  let isMatch = false;
  if (isBcryptHash(user.PasswordHash)) {
    isMatch = await bcrypt.compare(password, user.PasswordHash);
  } else {
    const allowLegacyPassword =
      process.env.ALLOW_LEGACY_PLAINTEXT_PASSWORDS === "true" &&
      process.env.NODE_ENV !== "production";
    isMatch = allowLegacyPassword && password === user.PasswordHash;
  }

  if (!isMatch) throw new Error("Sai mật khẩu");

  const token = createToken(user);
  return { message: "Đăng nhập thành công", token, user: publicUser(user) };
}

async function googleLogin(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Backend chưa cấu hình GOOGLE_CLIENT_ID");
  }
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Thiếu Google ID token");
  }

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (_) {
    throw new Error("Google ID token không hợp lệ hoặc đã hết hạn");
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    throw new Error("Tài khoản Google chưa có email đã xác minh");
  }

  const email = normalizeEmail(payload.email);
  const fullName = payload.name || email;
  const avatarUrl = payload.picture || null;
  const googleId = payload.sub;
  const pool = await connectDB();

  let user = await getUserByGoogleId(googleId);
  if (!user) user = await getUserByEmail(email);

  if (!user) {
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const randomPasswordHash = await bcrypt.hash(
        crypto.randomBytes(24).toString("hex"),
        10,
      );

      const userResult = await new sql.Request(transaction)
        .input("FullName", sql.NVarChar, fullName)
        .input("Email", sql.NVarChar, email)
        .input("PasswordHash", sql.NVarChar, randomPasswordHash)
        .input("GoogleId", sql.NVarChar, googleId)
        .input("AvatarUrl", sql.NVarChar, avatarUrl).query(`
          INSERT INTO Users
          (FullName, Email, PasswordHash, RoleId, Status, IsVerified, GoogleId, AvatarUrl)
          OUTPUT INSERTED.UserId
          VALUES (@FullName, @Email, @PasswordHash, (SELECT RoleId FROM Roles WHERE RoleName = 'CUSTOMER'), 'ACTIVE', 1, @GoogleId, @AvatarUrl)
        `);

      await new sql.Request(transaction).input(
        "UserId",
        sql.Int,
        userResult.recordset[0].UserId,
      ).query(`
          INSERT INTO Customers (UserId, LoyaltyPoints, MembershipLevelId)
          VALUES (@UserId, 0, (SELECT TOP 1 MembershipLevelId FROM MembershipLevels WHERE LevelName = N'Normal'))
        `);

      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (_) {}
      throw err;
    }
  } else {
    if (user.Status && user.Status !== "ACTIVE") {
      throw new Error("Tài khoản đã bị khóa hoặc không hoạt động");
    }
    if (user.GoogleId && user.GoogleId !== googleId) {
      throw new Error("Email này đã liên kết với một tài khoản Google khác");
    }
    if (!user.GoogleId && user.RoleName !== "CUSTOMER") {
      throw new Error(
        "Tài khoản nhân viên phải đăng nhập bằng mật khẩu trước khi liên kết Google",
      );
    }

    await pool
      .request()
      .input("UserId", sql.Int, user.UserId)
      .input("GoogleId", sql.NVarChar, googleId)
      .input("AvatarUrl", sql.NVarChar, avatarUrl).query(`
        UPDATE Users
        SET IsVerified = 1,
            GoogleId = @GoogleId,
            AvatarUrl = COALESCE(@AvatarUrl, AvatarUrl),
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);
  }

  user = await getUserByGoogleId(googleId);
  if (!user)
    throw new Error("Không thể tải tài khoản sau khi đăng nhập Google");

  const token = createToken(user);
  return {
    message: "Đăng nhập Google thành công",
    token,
    user: publicUser(user),
  };
}

async function changePassword(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword)
    throw new Error("Vui lòng nhập đầy đủ mật khẩu");
  if (newPassword.length < 6)
    throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");

  const pool = await connectDB();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT UserId, PasswordHash FROM Users WHERE UserId = @UserId");

  const user = result.recordset[0];
  if (!user) throw new Error("Không tìm thấy tài khoản");

  const isMatch = isBcryptHash(user.PasswordHash)
    ? await bcrypt.compare(oldPassword, user.PasswordHash)
    : oldPassword === user.PasswordHash;

  if (!isMatch) throw new Error("Mật khẩu hiện tại không đúng");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("PasswordHash", sql.NVarChar, hashedPassword).query(`
      UPDATE Users
      SET PasswordHash = @PasswordHash,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return { message: "Đổi mật khẩu thành công" };
}

async function forgotPassword(email) {
  const pool = await connectDB();
  const user = await getUserByEmail(email);

  if (!user) {
    return {
      message: "Nếu email tồn tại, hệ thống sẽ gửi link đặt lại mật khẩu",
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await pool
    .request()
    .input("UserId", sql.Int, user.UserId)
    .input("ResetPasswordToken", sql.NVarChar, tokenHash)
    .input("ResetPasswordExpires", sql.DateTime, resetExpires).query(`
    UPDATE Users
    SET ResetPasswordToken = @ResetPasswordToken,
        ResetPasswordExpires = @ResetPasswordExpires,
        UpdatedAt = GETDATE()
    WHERE UserId = @UserId
  `);

  const mailResult = await sendResetPasswordEmail(user.Email, resetToken);
  const exposeDevToken =
    mailResult.skipped &&
    process.env.NODE_ENV !== "production" &&
    process.env.EXPOSE_DEV_AUTH_TOKENS === "true";
  return {
    message: exposeDevToken
      ? `Link DEV: ${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`
      : "Nếu email tồn tại, hệ thống sẽ gửi link đặt lại mật khẩu",
    devResetToken: exposeDevToken ? resetToken : undefined,
  };
}

async function resetPassword(token, newPassword) {
  if (!token || !newPassword) throw new Error("Thiếu token hoặc mật khẩu mới");
  if (newPassword.length < 6)
    throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const pool = await connectDB();

  const now = new Date();

  const result = await pool
    .request()
    .input("ResetPasswordToken", sql.NVarChar, tokenHash)
    .input("Now", sql.DateTime, now).query(`
      SELECT UserId
      FROM Users
      WHERE ResetPasswordToken = @ResetPasswordToken
        AND ResetPasswordExpires > @Now
    `);

  const user = result.recordset[0];
  if (!user)
    throw new Error("Link đặt lại mật khẩu không đúng hoặc đã hết hạn");

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool
    .request()
    .input("UserId", sql.Int, user.UserId)
    .input("PasswordHash", sql.NVarChar, hashedPassword).query(`
      UPDATE Users
      SET PasswordHash = @PasswordHash,
          ResetPasswordToken = NULL,
          ResetPasswordExpires = NULL,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return { message: "Đặt lại mật khẩu thành công" };
}

module.exports = {
  register,
  verifyEmail,
  resendVerifyCode,
  login,
  googleLogin,
  changePassword,
  forgotPassword,
  resetPassword,
};
