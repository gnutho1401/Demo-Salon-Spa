const {
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
} = require("../../src/modules/admin/adminEmployees.service");

// Mock DB with transaction and safe hoisting
jest.mock("../../src/config/db", () => {
  const mockInput = jest.fn().mockReturnThis();
  const mockQuery = jest.fn();
  const mockRequest = {
    input: mockInput,
    query: mockQuery,
  };
  const mockTransaction = {
    begin: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
  };
  const mockPool = {
    request: jest.fn().mockReturnValue(mockRequest),
    query: jest.fn(),
  };
  const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

  // SQL package mocks
  const sql = {
    NVarChar: "NVarChar",
    Int: "Int",
    Date: "Date",
    Decimal: () => "Decimal",
    Bit: "Bit",
    Transaction: jest.fn().mockImplementation(() => mockTransaction),
    Request: jest.fn().mockImplementation(() => mockRequest),
  };

  return {
    sql,
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockPoolQuery: mockPool.query,
    _mockInput: mockInput,
    _mockTransaction: mockTransaction,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockPoolQuery = dbMock._mockPoolQuery;
const mockInput = dbMock._mockInput;
const mockTransaction = dbMock._mockTransaction;

describe("Admin Employees Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockPoolQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
    mockTransaction.begin.mockClear();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  describe("getRoles", () => {
    it("should retrieve allowed admin and technician roles", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ RoleId: 4, RoleName: "TECHNICIAN" }],
      });
      const res = await getRoles();
      expect(res).toEqual([{ RoleId: 4, RoleName: "TECHNICIAN" }]);
    });
  });

  describe("getBranches", () => {
    it("should retrieve branches list", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ BranchId: 1, BranchName: "Luxury Spa Center" }],
      });
      const res = await getBranches();
      expect(res).toEqual([{ BranchId: 1, BranchName: "Luxury Spa Center" }]);
    });
  });

  describe("list", () => {
    it("should return employees records list", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, FullName: "Kỹ Thuật Viên A" }],
      });
      const res = await list({ keyword: "Thuật", roleId: 4 });
      expect(res).toHaveLength(1);
      expect(res[0].EmployeeId).toBe(5);
      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%Thuật%");
      expect(mockInput).toHaveBeenCalledWith("RoleId", "Int", 4);
    });
  });

  describe("getById", () => {
    it("should return single employee details if found", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, FullName: "Kỹ Thuật Viên A" }],
      });
      const res = await getById(5);
      expect(res.EmployeeId).toBe(5);
    });

    it("should throw error if employee does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      await expect(getById(99)).rejects.toThrow("Không tìm thấy nhân viên");
    });
  });

  describe("getByUserId", () => {
    it("should return employee matching UserId", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [{ EmployeeId: 5 }] }) // getByUserId query
        .mockResolvedValueOnce({
          recordset: [{ EmployeeId: 5, FullName: "Kỹ Thuật Viên A" }],
        }); // getById retrieve

      const res = await getByUserId(2);
      expect(res.EmployeeId).toBe(5);
    });

    it("should return null if User is not linked to an Employee record", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      const res = await getByUserId(2);
      expect(res).toBeNull();
    });
  });

  describe("create", () => {
    it("should insert user and employee within transaction and return detail", async () => {
      // 1. existed query (email exists?) -> recordset empty
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      // 2. Insert User query -> UserId 10
      mockQuery.mockResolvedValueOnce({ recordset: [{ UserId: 10 }] });
      // 3. Insert Employee query -> EmployeeId 6
      mockQuery.mockResolvedValueOnce({ recordset: [{ EmployeeId: 6 }] });
      // 4. getById query -> return employee detail
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 6, FullName: "Nhân viên Mới" }],
      });

      const res = await create({
        fullName: "Nhân viên Mới",
        email: "new.emp@spa.com",
        password: "secure123Password",
        roleId: "4",
      });

      expect(res.EmployeeId).toBe(6);
      expect(mockTransaction.begin).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should throw error if email already exists", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ UserId: 1 }] });
      await expect(
        create({
          fullName: "Mới",
          email: "existed@spa.com",
          password: "pw",
          roleId: "4",
        }),
      ).rejects.toThrow("Email đã tồn tại");
    });
  });

  describe("update", () => {
    it("should update user and employee details", async () => {
      // 1. getById (before update)
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, UserId: 10, FullName: "Tên Cũ", Email: "old@spa.com", RoleId: 4 }],
      });
      // 2. existed query (email check) -> recordset empty
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      // 3. Update User statement -> success
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 4. Update Employee statement -> success
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 5. getById (after update return)
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, FullName: "Tên Mới", Email: "old@spa.com" }],
      });

      const res = await update(5, { fullName: "Tên Mới" });
      expect(res.FullName).toBe("Tên Mới");
    });
  });

  describe("changeStatus", () => {
    it("should toggle status of both user and employee", async () => {
      // 1. getById (before)
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, UserId: 10, Status: "ACTIVE", UserStatus: "ACTIVE" }],
      });
      // 2. Update User status
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 3. Update Employee status
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 4. getById (after status change)
      mockQuery.mockResolvedValueOnce({
        recordset: [{ EmployeeId: 5, Status: "INACTIVE", UserStatus: "INACTIVE" }],
      });

      const res = await changeStatus(5, { status: "INACTIVE" });
      expect(res.Status).toBe("INACTIVE");
    });
  });

  describe("getAssignedServices", () => {
    it("should retrieve service list with assigned flag status", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [
          { ServiceId: 1, ServiceName: "Gội đầu thảo dược", Assigned: 1 },
          { ServiceId: 2, ServiceName: "Massage body", Assigned: 0 },
        ],
      });

      const res = await getAssignedServices(5);
      expect(res).toHaveLength(2);
      expect(res[0].Assigned).toBe(1);
      expect(res[1].Assigned).toBe(0);
    });
  });

  describe("updateAssignedServices", () => {
    it("should delete existing and bulk insert assigned services", async () => {
      // 1. DELETE query
      mockQuery.mockResolvedValueOnce({ rowsAffected: [2] });
      // 2. INSERT query for service 1
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 3. INSERT query for service 2
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });
      // 4. getAssignedServices query -> return results
      mockQuery.mockResolvedValueOnce({
        recordset: [
          { ServiceId: 1, ServiceName: "Gội đầu thảo dược", Assigned: 1 },
          { ServiceId: 2, ServiceName: "Massage body", Assigned: 1 },
        ],
      });

      const res = await updateAssignedServices(5, [1, 2]);
      expect(res).toHaveLength(2);
      expect(res[0].Assigned).toBe(1);
      expect(res[1].Assigned).toBe(1);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });
});
