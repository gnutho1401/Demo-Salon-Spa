const { create, getById } = require("../../src/modules/admin/adminCustomers.service");

// Mock DB with safe hoisting
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
      Bit: "Bit",
      Transaction: class {
        constructor() {
          this.begin = jest.fn().mockResolvedValue();
          this.commit = jest.fn().mockResolvedValue();
          this.rollback = jest.fn().mockResolvedValue();
        }
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

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password_123"),
}));

// Mock membership utils
jest.mock("../../src/utils/membershipDiscount", () => ({
  updateCustomerMembershipLevel: jest.fn().mockResolvedValue(),
}));

describe("Admin Customers Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("create", () => {
    it("should successfully create a customer and not crash", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // Email check
        .mockResolvedValueOnce({ recordset: [] }) // Phone check
        .mockResolvedValueOnce({ recordset: [{ RoleId: 3 }] }) // Get Role
        .mockResolvedValueOnce({ recordset: [{ UserId: 100 }] }) // Create User
        .mockResolvedValueOnce({ recordset: [{ MembershipLevelId: 1 }] }) // Default ML
        .mockResolvedValueOnce({ recordset: [{ CustomerId: 50 }] }) // Create Customer
        .mockResolvedValueOnce({
          recordset: [
            {
              UserId: 100,
              FullName: "Test User",
              Email: "test@example.com",
              Phone: "0987654321",
              CustomerId: 50,
            },
          ],
        }) // getById details
        .mockResolvedValueOnce({ recordset: [] }) // getById appointments
        .mockResolvedValueOnce({ recordset: [] }) // getById packages
        .mockResolvedValueOnce({ recordset: [] }); // getById feeds

      const inputData = {
        fullName: "Test User",
        email: "test@example.com",
        phone: "0987654321",
        password: "password123",
        gender: "MALE",
        dateOfBirth: "1990-01-01",
        address: "123 Main St",
      };

      const result = await create(inputData);

      expect(result).toBeDefined();
      expect(result.profile.UserId).toBe(100);
      expect(result.profile.FullName).toBe("Test User");

      // Verify that PasswordHash was bound with the hashed password ("hashed_password_123"), NOT undefined.
      expect(mockInput).toHaveBeenCalledWith("PasswordHash", "NVarChar", "hashed_password_123");
    });
  });

  describe("getById", () => {
    it("should fetch customer profile, packages, appointments, and feeds correctly", async () => {
      const mockCustomer = {
        UserId: 100,
        FullName: "Test User",
        Email: "test@example.com",
        Phone: "0987654321",
        CustomerId: 50,
      };

      const mockPackages = [
        {
          CustomerPackageId: 1,
          PackageName: "Super Glow",
          TotalSessions: 10,
          SessionsLeft: 8,
          ExpiryDate: "2026-12-31",
          Status: "ACTIVE",
          BoughtAt: "2026-06-01",
          PaidAmount: 500,
          PaymentStatus: "PAID",
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ recordset: [mockCustomer] }) // profile
        .mockResolvedValueOnce({ recordset: [] }) // appointments
        .mockResolvedValueOnce({ recordset: mockPackages }) // packages
        .mockResolvedValueOnce({ recordset: [] }); // history / feeds

      const result = await getById(100);

      expect(result).toBeDefined();
      expect(result.profile).toEqual(mockCustomer);
      expect(result.packages).toEqual(mockPackages);

      // Verify the query contents for packages loads correctly
      const packagesQueryCall = mockQuery.mock.calls[2][0];
      expect(packagesQueryCall).toContain("cp.RemainingSessions AS SessionsLeft");
      expect(packagesQueryCall).toContain("cp.EndDate AS ExpiryDate");
      expect(packagesQueryCall).toContain("cp.CreatedAt AS BoughtAt");
      expect(packagesQueryCall).toContain("ORDER BY cp.CreatedAt DESC");
    });
  });
});
