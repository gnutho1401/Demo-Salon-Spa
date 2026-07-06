const { list, getById, markChecked } = require("../../src/modules/admin/adminAIMonitoring.service");

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
      Bit: "Bit",
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin AI Monitoring Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("list", () => {
    it("should return logs list, stats metrics and daily trend successfully", async () => {
      // 1. Logs list mock
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            ItemType: "chat",
            ItemId: "1",
            UserId: 10,
            UserName: "Nguyễn Văn A",
            Title: "Chat Log",
            Content: "Hỏi đáp",
            Detail: "Trả lời",
            IsChecked: false,
            CreatedAt: "2026-06-25",
            LatencyMs: 1500,
            IsError: false,
            Tokens: 1200,
          },
        ],
      });

      // 2. Metrics mock
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            RequestCount: 1,
            TokenUsage: 1200,
            ErrorRate: 0.0,
            AvgLatencyMs: 1500,
          },
        ],
      });

      // 3. Daily trend mock
      mockQuery.mockResolvedValueOnce({
        recordset: [
          {
            LogDate: "2026-06-25",
            RequestCount: 1,
            ErrorCount: 0,
            TokenUsage: 1200,
            AvgLatencyMs: 1500,
          },
        ],
      });

      const result = await list({});

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].ItemType).toBe("chat");
      expect(result.metrics).toEqual({
        requestCount: 1,
        tokenUsage: 1200,
        errorRate: "0.0",
        avgLatency: 1500,
      });
      expect(result.dailyTrend).toHaveLength(1);

      // Verify parameter default binds
      expect(mockInput).toHaveBeenCalledWith("Type", "NVarChar", null);
      expect(mockInput).toHaveBeenCalledWith("Checked", "Bit", null);
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", null);
      expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", null);
      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", null);
      expect(mockInput).toHaveBeenCalledWith("Feature", "NVarChar", null);
      expect(mockInput).toHaveBeenCalledWith("ErrorOnly", "Bit", 0);
    });

    it("should map custom query filters correctly", async () => {
      // Mock the 3 DB calls
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await list({
        type: "audit",
        checked: "1",
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
        keyword: "spam",
        feature: "moderation",
        errorOnly: "1",
      });

      expect(mockInput).toHaveBeenCalledWith("Type", "NVarChar", "audit");
      expect(mockInput).toHaveBeenCalledWith("Checked", "Bit", 1);
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", "2026-06-01");
      expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", "2026-06-30");
      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%spam%");
      expect(mockInput).toHaveBeenCalledWith("Feature", "NVarChar", "%moderation%");
      expect(mockInput).toHaveBeenCalledWith("ErrorOnly", "Bit", 1);
    });
  });

  describe("getById", () => {
    it("should retrieve recommendation logs detail", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ItemId: 10, ItemType: "recommendation", RecommendationType: "Service" }],
      });
      const result = await getById("recommendation", 10);
      expect(result).toEqual({ ItemId: 10, ItemType: "recommendation", RecommendationType: "Service" });
    });

    it("should retrieve prediction logs detail", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ItemId: 20, ItemType: "prediction", PredictionType: "Loyalty" }],
      });
      const result = await getById("prediction", 20);
      expect(result).toEqual({ ItemId: 20, ItemType: "prediction", PredictionType: "Loyalty" });
    });

    it("should retrieve chat logs detail", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ChatId: 30, ItemType: "chat", Question: "Hi" }],
      });
      const result = await getById("chat", 30);
      expect(result).toBeDefined();
    });

    it("should retrieve audit logs detail", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ItemId: 40, ItemType: "audit", FeatureName: "Audit" }],
      });
      const result = await getById("audit", 40);
      expect(result).toBeDefined();
    });

    it("should throw error for unsupported type or empty ID", async () => {
      await expect(getById("recommendation", null)).rejects.toThrow("Thiếu dữ liệu cần xem");
      await expect(getById("invalid", 10)).rejects.toThrow("Loại dữ liệu không hợp lệ");
    });
  });

  describe("markChecked", () => {
    it("should update audit log status and return details", async () => {
      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // UPDATE statement
        .mockResolvedValueOnce({
          recordset: [{ ItemId: 15, ItemType: "audit", IsChecked: true, CheckResult: "Approved" }],
        }); // getById retrieve

      const result = await markChecked("audit", 15, { checked: true, checkResult: "Approved" });

      expect(result).toEqual({ ItemId: 15, ItemType: "audit", IsChecked: true, CheckResult: "Approved" });
      expect(mockInput).toHaveBeenCalledWith("Id", "Int", 15);
      expect(mockInput).toHaveBeenCalledWith("IsChecked", "Bit", 1);
      expect(mockInput).toHaveBeenCalledWith("CheckResult", "NVarChar", "Approved");
    });

    it("should fall back for non-audit type without updating", async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ItemId: 5, ItemType: "recommendation" }],
      });

      const result = await markChecked("recommendation", 5, { checked: true });
      expect(result).toEqual({ ItemId: 5, ItemType: "recommendation" });
    });
  });
});
