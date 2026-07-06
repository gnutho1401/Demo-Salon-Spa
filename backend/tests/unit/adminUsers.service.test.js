const { create, update, getById } = require("../../src/modules/admin/adminUsers.service");

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
      Int: "Int",
      Date: "Date",
      Decimal: () => "Decimal",
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

describe("Admin Users Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("create", () => {
    it("should honor MembershipLevelId if provided in payload when creating a CUSTOMER", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // Email check
        .mockResolvedValueOnce({ recordset: [] }) // Phone check
        .mockResolvedValueOnce({ recordset: [{ RoleName: "CUSTOMER" }] }) // Role check
        .mockResolvedValueOnce({ recordset: [{ UserId: 10 }] }) // Create user
        .mockResolvedValueOnce({ recordset: [] }) // Create customer insert query
        .mockResolvedValueOnce({ recordset: [{ UserId: 10, RoleId: 1, RoleName: "CUSTOMER", MembershipLevelId: 99 }] }); // getById details

      const inputData = {
        fullName: "Jane Customer",
        email: "jane@example.com",
        phone: "0987654321",
        password: "password123",
        roleId: 1,
        membershipLevelId: 99,
      };

      const result = await create(inputData);

      expect(result).toBeDefined();
      expect(result.MembershipLevelId).toBe(99);

      // Verify that MembershipLevelId query binding received 99, not a default query
      expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", 99);
      
      // Should not call default membership level query since it was provided
      const allQueryTexts = mockQuery.mock.calls.map(call => call[0]);
      const defaultMLQueryCalled = allQueryTexts.some(q => q && q.includes("SELECT TOP 1 MembershipLevelId FROM MembershipLevels"));
      expect(defaultMLQueryCalled).toBe(false);
    });

    it("should fallback to default membership level if MembershipLevelId is not provided", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // Email check
        .mockResolvedValueOnce({ recordset: [] }) // Phone check
        .mockResolvedValueOnce({ recordset: [{ RoleName: "CUSTOMER" }] }) // Role check
        .mockResolvedValueOnce({ recordset: [{ UserId: 10 }] }) // Create user
        .mockResolvedValueOnce({ recordset: [{ MembershipLevelId: 5 }] }) // Default ML select
        .mockResolvedValueOnce({ recordset: [] }) // Create customer insert query
        .mockResolvedValueOnce({ recordset: [{ UserId: 10, RoleId: 1, RoleName: "CUSTOMER", MembershipLevelId: 5 }] }); // getById details

      const inputData = {
        fullName: "Jane Customer",
        email: "jane@example.com",
        phone: "0987654321",
        password: "password123",
        roleId: 1,
      };

      const result = await create(inputData);

      expect(result).toBeDefined();
      expect(result.MembershipLevelId).toBe(5);

      // Verify default level query was executed
      const allQueryTexts = mockQuery.mock.calls.map(call => call[0]);
      const defaultMLQueryCalled = allQueryTexts.some(q => q && q.includes("SELECT TOP 1 MembershipLevelId FROM MembershipLevels"));
      expect(defaultMLQueryCalled).toBe(true);

      expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", 5);
    });
  });

  describe("update role switcher logic", () => {
    it("should run Employee cleanup logic when role changes to CUSTOMER", async () => {
      const mockUserBefore = {
        UserId: 10,
        RoleId: 2,
        RoleName: "EMPLOYEE",
        FullName: "John Switcher",
        Email: "john@example.com",
        Status: "ACTIVE",
      };

      const mockUserAfter = {
        UserId: 10,
        RoleId: 1,
        RoleName: "CUSTOMER",
        FullName: "John Switcher",
        Email: "john@example.com",
        Status: "ACTIVE",
      };

      mockQuery
        .mockResolvedValueOnce({ recordset: [mockUserBefore] }) // getById in update setup
        .mockResolvedValueOnce({ recordset: [] }) // unique check (email, phone)
        .mockResolvedValueOnce({ recordset: [{ RoleName: "CUSTOMER" }] }) // role check
        .mockResolvedValueOnce({ recordset: [] }) // Update general user
        .mockResolvedValueOnce({ recordset: [] }) // empCheck - no employee found
        .mockResolvedValueOnce({ recordset: [{ CustomerId: 1 }] }) // Customer row check checkRes
        .mockResolvedValueOnce({ recordset: [] }) // Update Customers table query
        .mockResolvedValueOnce({ recordset: [mockUserAfter] }); // getById after return

      const updateData = {
        roleId: 1, // Switching to Customer
      };

      const result = await update(10, updateData);

      expect(result).toBeDefined();
      expect(result.RoleName).toBe("CUSTOMER");

      // Verify cleanup logic ran (check for SELECT EmployeeId FROM Employees query)
      const allQueries = mockQuery.mock.calls.map(call => call[0]);
      const employeeCheckQuery = allQueries.find(q => q && q.includes("SELECT EmployeeId FROM Employees"));
      expect(employeeCheckQuery).toBeDefined();
    });

    it("should run Customer cleanup logic when role changes to EMPLOYEE", async () => {
      const mockUserBefore = {
        UserId: 10,
        RoleId: 1,
        RoleName: "CUSTOMER",
        FullName: "John Switcher",
        Email: "john@example.com",
        Status: "ACTIVE",
      };

      const mockUserAfter = {
        UserId: 10,
        RoleId: 2,
        RoleName: "EMPLOYEE",
        FullName: "John Switcher",
        Email: "john@example.com",
        Status: "ACTIVE",
      };

      mockQuery
        .mockResolvedValueOnce({ recordset: [mockUserBefore] }) // getById in update setup
        .mockResolvedValueOnce({ recordset: [] }) // unique check (email, phone)
        .mockResolvedValueOnce({ recordset: [{ RoleName: "EMPLOYEE" }] }) // role check
        .mockResolvedValueOnce({ recordset: [] }) // Update general user
        .mockResolvedValueOnce({ recordset: [] }) // custCheck - no customer found
        .mockResolvedValueOnce({ recordset: [{ EmployeeId: 1 }] }) // Employee row check checkRes
        .mockResolvedValueOnce({ recordset: [] }) // Update Employees table query
        .mockResolvedValueOnce({ recordset: [mockUserAfter] }); // getById after return

      const updateData = {
        roleId: 2, // Switching to Employee
      };

      const result = await update(10, updateData);

      expect(result).toBeDefined();
      expect(result.RoleName).toBe("EMPLOYEE");

      // Verify Customer cleanup logic ran (check for SELECT CustomerId FROM Customers query)
      const allQueries = mockQuery.mock.calls.map(call => call[0]);
      const customerCheckQuery = allQueries.find(q => q && q.includes("SELECT CustomerId FROM Customers"));
      expect(customerCheckQuery).toBeDefined();
    });
  });
});
