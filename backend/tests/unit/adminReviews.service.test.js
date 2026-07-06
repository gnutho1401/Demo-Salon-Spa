const { list, getById, changeStatus, respond, removeResponse } = require("../../src/modules/admin/adminReviews.service");

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

describe("Admin Reviews Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("list", () => {
    it("should retrieve reviews with custom filters", async () => {
      const mockResult = [
        { ReviewId: 1, Rating: 5, Comment: "Excellent", Status: "APPROVED" },
        { ReviewId: 2, Rating: 2, Comment: "Bad", Status: "PENDING" }
      ];

      mockQuery.mockResolvedValueOnce({ recordset: mockResult });

      const result = await list({ keyword: "spa", rating: 5, status: "APPROVED", fromDate: "2026-06-01", toDate: "2026-06-30" });

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].Comment).toBe("Excellent");

      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%spa%");
      expect(mockInput).toHaveBeenCalledWith("Rating", "Int", 5);
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "APPROVED");
      expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", "2026-06-01");
      expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", "2026-06-30");
    });
  });

  describe("getById", () => {
    it("should return single review if found", async () => {
      const mockRow = { ReviewId: 1, Rating: 5, Comment: "Great", Status: "APPROVED" };
      mockQuery.mockResolvedValueOnce({ recordset: [mockRow] });

      const result = await getById(1);
      expect(result).toBeDefined();
      expect(result.ReviewId).toBe(1);
      expect(mockInput).toHaveBeenCalledWith("ReviewId", "Int", 1);
    });

    it("should throw error if review not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      await expect(getById(99)).rejects.toThrow("Không tìm thấy review");
    });
  });

  describe("changeStatus", () => {
    it("should update status successfully", async () => {
      const mockAfter = { ReviewId: 1, Status: "APPROVED" };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await changeStatus(1, { Status: "APPROVED" });
      expect(result.Status).toBe("APPROVED");
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "APPROVED");
    });

    it("should throw if status constraint is violated", async () => {
      await expect(changeStatus(1, { Status: "INVALID_STATUS" })).rejects.toThrow("Trạng thái review không hợp lệ");
    });
  });

  describe("respond", () => {
    it("should save admin response successfully", async () => {
      const mockAfter = { ReviewId: 1, AdminResponse: "Thank you!" };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await respond(1, { AdminResponse: "Thank you!" });
      expect(result.AdminResponse).toBe("Thank you!");
      expect(mockInput).toHaveBeenCalledWith("AdminResponse", "NVarChar", "Thank you!");
    });

    it("should throw if AdminResponse is empty", async () => {
      await expect(respond(1, { AdminResponse: "" })).rejects.toThrow("Nội dung phản hồi không được để trống");
    });
  });

  describe("removeResponse", () => {
    it("should set response to NULL", async () => {
      const mockAfter = { ReviewId: 1, AdminResponse: null };

      mockQuery
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockAfter] }); // getById

      const result = await removeResponse(1);
      expect(result.AdminResponse).toBeNull();
    });
  });
});
