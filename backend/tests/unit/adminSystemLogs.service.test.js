const { list, getById, writeLog, getLogFilters } = require("../../src/modules/admin/adminSystemLogs.service");

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
    query: jest.fn(),
  };
  const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

  return {
    sql: {
      NVarChar: "NVarChar",
      Int: "Int",
      Date: "Date",
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockPoolQuery: mockPool.query,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockPoolQuery = dbMock._mockPoolQuery;
const mockInput = dbMock._mockInput;

describe("Admin System Logs Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockPoolQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("getLogFilters", () => {
    it("should retrieve list of users and action types", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          recordset: [{ UserId: 1, UserName: "Nguyễn Văn A" }],
        })
        .mockResolvedValueOnce({
          recordset: [{ ActionType: "CREATE" }, { ActionType: "UPDATE" }],
        });

      const result = await getLogFilters();
      expect(result).toBeDefined();
      expect(result.users).toHaveLength(1);
      expect(result.users[0].UserName).toBe("Nguyễn Văn A");
      expect(result.actionTypes).toEqual(["CREATE", "UPDATE"]);
    });
  });

  describe("list", () => {
    it("should return list of logs with totalCount and delete TotalCount from logs", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            LogId: 10,
            UserId: 1,
            UserName: "Nguyễn Văn A",
            ActionType: "CREATE",
            ActionName: "Tạo dịch vụ",
            TotalCount: 50,
          },
        ],
      });

      const result = await list({ page: 2, limit: 10 });
      expect(result).toBeDefined();
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].LogId).toBe(10);
      expect(result.logs[0].TotalCount).toBeUndefined(); // ensure TotalCount is stripped
      expect(result.totalCount).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);

      // Verify parameter bindings
      expect(mockInput).toHaveBeenCalledWith("Offset", "Int", 10);
      expect(mockInput).toHaveBeenCalledWith("Limit", "Int", 10);
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", null);
    });

    it("should handle custom filters", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await list({
        keyword: "test",
        actionType: "UPDATE",
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
        userId: "5",
        module: "Facial",
      });

      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%test%");
      expect(mockInput).toHaveBeenCalledWith("ActionType", "NVarChar", "UPDATE");
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", "2026-06-01");
      expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", "2026-06-30");
      expect(mockInput).toHaveBeenCalledWith("UserId", "Int", 5);
      expect(mockInput).toHaveBeenCalledWith("Module", "NVarChar", "%Facial%");
    });
  });

  describe("getById", () => {
    it("should retrieve single log successfully", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            LogId: 1,
            UserId: 2,
            ActionType: "DELETE",
            Description: "Xóa nhân viên",
          },
        ],
      });

      const result = await getById(1);
      expect(result).toBeDefined();
      expect(result.LogId).toBe(1);
      expect(result.ActionType).toBe("DELETE");
    });

    it("should throw error if log not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      await expect(getById(999)).rejects.toThrow("Không tìm thấy log");
    });
  });

  describe("writeLog", () => {
    it("should insert a log record successfully", async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });

      await writeLog({
        userId: 1,
        roleName: "ADMIN",
        actionName: "Cập nhật dịch vụ",
        actionType: "UPDATE",
        description: "Thay đổi giá dịch vụ cắt tóc",
        ipAddress: "127.0.0.1",
        oldValue: '{"Price": 100000}',
        newValue: '{"Price": 120000}',
      });

      expect(mockInput).toHaveBeenCalledWith("UserId", "Int", 1);
      expect(mockInput).toHaveBeenCalledWith("RoleName", "NVarChar", "ADMIN");
      expect(mockInput).toHaveBeenCalledWith("ActionName", "NVarChar", "Cập nhật dịch vụ");
      expect(mockInput).toHaveBeenCalledWith("ActionType", "NVarChar", "UPDATE");
      expect(mockInput).toHaveBeenCalledWith("Description", "NVarChar", "Thay đổi giá dịch vụ cắt tóc");
      expect(mockInput).toHaveBeenCalledWith("IpAddress", "NVarChar", "127.0.0.1");
      expect(mockInput).toHaveBeenCalledWith("OldValue", "NVarChar", '{"Price": 100000}');
      expect(mockInput).toHaveBeenCalledWith("NewValue", "NVarChar", '{"Price": 120000}');
    });
  });
});
