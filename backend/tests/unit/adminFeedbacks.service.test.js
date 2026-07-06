const { list, getById, changeStatus, respond, removeResponse } = require("../../src/modules/admin/adminFeedbacks.service");

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
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin Feedbacks Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("list", () => {
    it("should retrieve feedbacks with custom filters", async () => {
      const mockResult = [
        { FeedbackId: 1, Subject: "Compliment", Content: "Great service", Status: "RESOLVED" },
        { FeedbackId: 2, Subject: "Complaint", Content: "Slow checkin", Status: "PENDING" }
      ];

      mockQuery.mockResolvedValueOnce({ recordset: mockResult });

      const result = await list({ keyword: "service", status: "RESOLVED", fromDate: "2026-06-01", toDate: "2026-06-30" });

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].Subject).toBe("Compliment");

      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%service%");
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "RESOLVED");
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", "2026-06-01");
      expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", "2026-06-30");
    });
  });

  describe("getById", () => {
    it("should return single feedback if found", async () => {
      const mockRow = { FeedbackId: 1, Subject: "Compliment", Content: "Great", Status: "RESOLVED" };
      mockQuery.mockResolvedValueOnce({ recordset: [mockRow] });

      const result = await getById(1);
      expect(result).toBeDefined();
      expect(result.FeedbackId).toBe(1);
      expect(mockInput).toHaveBeenCalledWith("FeedbackId", "Int", 1);
    });

    it("should throw error if feedback not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      await expect(getById(99)).rejects.toThrow("Không tìm thấy feedback");
    });
  });

  describe("changeStatus", () => {
    it("should update status successfully", async () => {
      const mockAfter = { FeedbackId: 1, Status: "RESOLVED" };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await changeStatus(1, { Status: "RESOLVED" });
      expect(result.Status).toBe("RESOLVED");
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "RESOLVED");
    });

    it("should throw if status constraint is violated", async () => {
      await expect(changeStatus(1, { Status: "INVALID_STATUS" })).rejects.toThrow("Trạng thái feedback không hợp lệ");
    });
  });

  describe("respond", () => {
    it("should save admin response successfully", async () => {
      const mockAfter = { FeedbackId: 1, AdminResponse: "Thank you for letting us know", Status: "RESOLVED" };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await respond(1, { AdminResponse: "Thank you for letting us know", Status: "RESOLVED" });
      expect(result.AdminResponse).toBe("Thank you for letting us know");
      expect(result.Status).toBe("RESOLVED");
      expect(mockInput).toHaveBeenCalledWith("AdminResponse", "NVarChar", "Thank you for letting us know");
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "RESOLVED");
    });

    it("should throw if AdminResponse is empty", async () => {
      await expect(respond(1, { AdminResponse: "" })).rejects.toThrow("Nội dung phản hồi không được để trống");
    });
  });

  describe("removeResponse", () => {
    it("should set response to NULL", async () => {
      const mockAfter = { FeedbackId: 1, AdminResponse: null };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await removeResponse(1);
      expect(result.AdminResponse).toBeNull();
    });
  });
});
