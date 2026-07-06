const {
  register,
  login,
  verifyEmail,
  changePassword,
  forgotPassword,
  resetPassword,
  googleLogin,
  resendVerifyCode,
} = require("../../src/modules/auth/auth.service");

// Mock Config & DB with safe hoisting
//Phần này dùng để tạo database giả. 
// Lý do cần mock database là vì Unit Test không nên phụ thuộc vào SQL Server thật. 
// Nhờ mock, nhóm có thể tự quyết định database giả trả về dữ liệu gì trong từng test case.
jest.mock("../../src/config/db", () => {
  const mockInput = jest.fn().mockReturnThis();
  const mockQuery = jest.fn();
  const mockRequest = {
    input: mockInput,
    query: mockQuery,
  };
  const mockPool = {
    request: jest.fn().mockReturnValue(mockRequest),
  };

  const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

  return {
    sql: {
      NVarChar: "NVarChar",
      DateTime: "DateTime",
      Date: "Date",
      Int: "Int",
      Transaction: class {
        constructor() {}
        begin = jest.fn();
        commit = jest.fn();
        rollback = jest.fn();
      },
      Request: class {
        constructor() {
          return mockRequest;
        }
      },
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

// Mock Env
jest.mock("../../src/config/env", () => ({
  jwtSecret: "test-secret",
}));

// Mock email utils
//Phần này dùng để giả lập việc gửi email xác thực hoặc email reset mật khẩu. 
//Khi chạy test, hệ thống sẽ không gửi email thật.
jest.mock("../../src/utils/sendMail", () => ({
  sendVerifyEmail: jest.fn().mockResolvedValue({ skipped: true }),
  sendResetPasswordEmail: jest.fn().mockResolvedValue({ skipped: true }),
}));

// Mock bcrypt
//Phần này dùng để giả lập việc tạo JWT token. 
// Khi test login thành công, nhóm không cần tạo token thật mà trả về token giả là fake-jwt-token.
jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue("hashed"),
}));

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("fake-jwt-token"),
}));

describe("Member 1 - Auth Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  //kiểm tra trường hợp người dùng đăng ký nhưng không nhập họ tên
  it("register_ShouldThrowValidationError_WhenFullNameIsMissing", async () => {
    // Arrange
    const inputData = { email: "test@example.com", password: "password123" };

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Vui lòng nhập họ tên");
  });

  //kiểm tra trường hợp người dùng đăng ký nhưng không nhập email
  it("register_ShouldThrowValidationError_WhenEmailIsMissing", async () => {
    // Arrange
    const inputData = { fullName: "John Doe", password: "password123" };

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Vui lòng nhập email");
  });

  //kiểm tra trường hợp người dùng đăng ký nhưng email không hợp lệ
  it("register_ShouldThrowValidationError_WhenEmailIsInvalid", async () => {
    // Arrange
    const inputData = { fullName: "John Doe", email: "invalid-email", password: "password123" };

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Email không hợp lệ");
  });

  it("register_ShouldThrowValidationError_WhenPasswordIsTooShort", async () => {
    // Arrange
    const inputData = { fullName: "John Doe", email: "test@example.com", password: "123" };

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Mật khẩu phải có ít nhất 6 ký tự");
  });

  it("register_ShouldThrowValidationError_WhenPhoneIsInvalid", async () => {
    // Arrange
    const inputData = {
      fullName: "John Doe",
      email: "test@example.com",
      password: "password123",
      phone: "abc123",
    };

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Số điện thoại không hợp lệ");
  }); 

  //kiểm tra đăng nhập thành công
  it("login_ShouldReturnToken_WhenCredentialsAreValid", async () => {
    // Arrange
    const email = "test@example.com";
    const password = "password123";
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          UserId: 1,
          FullName: "John Doe",
          Email: email,
          PasswordHash: "$2a$10$hash",
          Status: "ACTIVE",
          IsVerified: true,
          RoleName: "CUSTOMER",
        },
      ],
    });

    // Act
    const result = await login(email, password);

    // Assert
    expect(result).toEqual({
      message: "Đăng nhập thành công",
      token: "fake-jwt-token",
      user: {
        UserId: 1,
        FullName: "John Doe",
        Email: email,
        Status: "ACTIVE",
        IsVerified: true,
        RoleName: "CUSTOMER",
      },
    });
  });

  //kiểm tra đăng nhập thất bại khi email không tồn tại
  it("login_ShouldThrowNotFound_WhenEmailDoesNotExist", async () => {
    // Arrange
    const email = "notfound@example.com";
    const password = "password123";

    //mock database trả về rỗng, không tìm thấy user nào có email đó 
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act & Assert
    await expect(login(email, password)).rejects.toThrow("Email không tồn tại");
  });

  it("register_ShouldSuccessfullyRegisterUser_WhenDataIsValid", async () => {
    // Arrange
    const inputData = {
      fullName: "John Doe",
      email: "test@example.com",
      password: "password123",
      phone: "0987654321",
    };
    mockQuery.mockResolvedValueOnce({ recordset: [] }); // 1. email check
    mockQuery.mockResolvedValueOnce({ recordset: [] }); // 2. phone check
    mockQuery.mockResolvedValueOnce({ recordset: [] }); // 3. pending phone check
    mockQuery.mockResolvedValueOnce({ rowsAffected: [1] }); // 4. delete and insert query

    // Act
    const result = await register(inputData);

    // Assert
    expect(result).toEqual({ message: "Vui lòng kiểm tra Gmail để lấy mã xác thực" });
  });

  it("register_ShouldThrowError_WhenEmailAlreadyExists", async () => {
    // Arrange
    const inputData = {
      fullName: "John Doe",
      email: "test@example.com",
      password: "password123",
    };
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: 1, Email: "test@example.com" }],
    });

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Email đã tồn tại");
  });

  it("register_ShouldThrowError_WhenPhoneAlreadyExists", async () => {
    // Arrange
    const inputData = {
      fullName: "John Doe",
      email: "test@example.com",
      password: "password123",
      phone: "0987654321",
    };
    mockQuery.mockResolvedValueOnce({ recordset: [] }); // email check
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: 1, Phone: "0987654321" }],
    }); // phone check

    // Act & Assert
    await expect(register(inputData)).rejects.toThrow("Số điện thoại đã tồn tại");
  });

  it("verifyEmail_ShouldSuccessfullyVerifyPendingUserAndCreateCustomer_WhenCodeIsValid", async () => {
    // Arrange
    const email = "pending@example.com";
    const code = "123456";
    mockQuery.mockResolvedValueOnce({
      recordset: [{
        PendingUserId: 1,
        FullName: "John Doe",
        Email: email,
        PasswordHash: "hashed",
        VerifyCode: code,
        VerifyCodeExpires: new Date(Date.now() + 1000000).toISOString(),
        CreatedAt: new Date(),
      }],
    }); // 1. Select pending user
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: 1 }],
    }); // 2. Insert into Users
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 3. Insert into Customers
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 4. Delete pending user

    // Act
    const result = await verifyEmail(email, code);

    // Assert
    expect(result).toEqual({ message: "Xác thực email thành công. Tài khoản đã được tạo" });
  });

  it("verifyEmail_ShouldThrowError_WhenCodeIsInvalid", async () => {
    // Arrange
    const email = "pending@example.com";
    const code = "invalidcode";
    mockQuery.mockResolvedValueOnce({
      recordset: [{
        PendingUserId: 1,
        FullName: "John Doe",
        Email: email,
        PasswordHash: "hashed",
        VerifyCode: "123456",
        VerifyCodeExpires: new Date(Date.now() + 1000000).toISOString(),
        CreatedAt: new Date(),
      }],
    });

    // Act & Assert
    await expect(verifyEmail(email, code)).rejects.toThrow("Mã xác thực không đúng");
  });

  it("verifyEmail_ShouldThrowError_WhenEmailDoesNotExist", async () => {
    // Arrange
    const email = "notfound@example.com";
    const code = "123456";
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act & Assert
    await expect(verifyEmail(email, code)).rejects.toThrow("Email không tồn tại");
  });

  it("resendVerifyCode_ShouldResendCode_WhenEmailIsValid", async () => {
    // Arrange
    const email = "pending@example.com";
    mockQuery.mockResolvedValueOnce({
      recordset: [{ Email: email, VerificationCode: "111111" }],
    }); // 1. Find pending user
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 2. Update code

    // Act
    const result = await resendVerifyCode(email);

    // Assert
    expect(result.message).toContain("xác thực");
  });

  it("resendVerifyCode_ShouldThrowError_WhenEmailDoesNotExist", async () => {
    // Arrange
    const email = "notfound@example.com";
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act & Assert
    await expect(resendVerifyCode(email)).rejects.toThrow("Email không tồn tại hoặc tài khoản đã được xác thực");
  });

  it("changePassword_ShouldSuccessfullyChangePassword_WhenCurrentPasswordMatches", async () => {
    // Arrange
    const userId = 1;
    const oldPassword = "oldpassword";
    const newPassword = "newpassword123";
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: userId, PasswordHash: "$2a$10$oldpasswordhash" }],
    }); // 1. Select User
    const bcryptCompare = require("bcryptjs").compare;
    bcryptCompare.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 2. Update Password

    // Act
    const result = await changePassword(userId, oldPassword, newPassword);

    // Assert
    expect(result).toEqual({ message: "Đổi mật khẩu thành công" });
  });

  it("changePassword_ShouldThrowError_WhenUserNotFound", async () => {
    // Arrange
    const userId = 1;
    const oldPassword = "oldpassword";
    const newPassword = "newpassword123";
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act & Assert
    await expect(changePassword(userId, oldPassword, newPassword)).rejects.toThrow("Không tìm thấy tài khoản");
  });

  it("changePassword_ShouldThrowError_WhenCurrentPasswordIsIncorrect", async () => {
    // Arrange
    const userId = 1;
    const oldPassword = "wrongoldpassword";
    const newPassword = "newpassword123";
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: userId, PasswordHash: "hashed" }],
    });
    const bcryptCompare = require("bcryptjs").compare;
    bcryptCompare.mockResolvedValueOnce(false);

    // Act & Assert
    await expect(changePassword(userId, oldPassword, newPassword)).rejects.toThrow("Mật khẩu hiện tại không đúng");
  });

  it("forgotPassword_ShouldCreateTokenAndSendEmail_WhenEmailMatches", async () => {
    // Arrange
    const email = "test@example.com";
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: 1, Email: email }],
    }); // 1. Select User
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 2. Update Reset Token

    // Act
    const result = await forgotPassword(email);

    // Assert
    expect(result.message).toContain("reset-password");
  });

  it("forgotPassword_ShouldReturnResetMessage_WhenEmailDoesNotExist", async () => {
    // Arrange
    const email = "notfound@example.com";
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act
    const result = await forgotPassword(email);

    // Assert
    expect(result.message).toContain("hệ thống sẽ gửi link đặt lại mật khẩu");
  });

  it("resetPassword_ShouldResetPassword_WhenTokenIsValid", async () => {
    // Arrange
    const token = "reset-token";
    const newPassword = "newpassword123";
    mockQuery.mockResolvedValueOnce({
      recordset: [{ UserId: 1 }],
    }); // 1. Select Reset Token
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 2. Update Password

    // Act
    const result = await resetPassword(token, newPassword);

    // Assert
    expect(result).toEqual({ message: "Đặt lại mật khẩu thành công" });
  });

  it("resetPassword_ShouldThrowError_WhenTokenIsInvalidOrExpired", async () => {
    // Arrange
    const token = "invalid-token";
    const newPassword = "newpassword123";
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    // Act & Assert
    await expect(resetPassword(token, newPassword)).rejects.toThrow("Link đặt lại mật khẩu không đúng hoặc đã hết hạn");
  });

  it("googleLogin_ShouldLoginOrRegisterUser_WhenTokenIsValid", async () => {
    // Arrange
    const googleToken = "valid-google-token";
    process.env.GOOGLE_CLIENT_ID = "mock-client-id";
    const { OAuth2Client } = require("google-auth-library");
    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub-id",
        email: "google@example.com",
        name: "Google User",
      }),
    });
    mockQuery.mockResolvedValueOnce({
      recordset: [{
        UserId: 1,
        FullName: "Google User",
        Email: "google@example.com",
        Status: "ACTIVE",
        IsVerified: true,
        RoleName: "CUSTOMER",
      }],
    }); // 1. getUserByEmail
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    }); // 2. UPDATE Users
    mockQuery.mockResolvedValueOnce({
      recordset: [{
        UserId: 1,
        FullName: "Google User",
        Email: "google@example.com",
        Status: "ACTIVE",
        IsVerified: true,
        RoleName: "CUSTOMER",
      }],
    }); // 3. getUserByEmail again

    // Act
    const result = await googleLogin(googleToken);

    // Assert
    expect(result.message).toBe("Đăng nhập Google thành công");
    expect(result.token).toBe("fake-jwt-token");
  });

  it("googleLogin_ShouldThrowError_WhenGoogleClientIdIsMissing", async () => {
    // Arrange
    const googleToken = "some-token";
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    // Act & Assert
    await expect(googleLogin(googleToken)).rejects.toThrow("Backend chưa cấu hình GOOGLE_CLIENT_ID");

    // Cleanup
    process.env.GOOGLE_CLIENT_ID = originalClientId;
  });
});
