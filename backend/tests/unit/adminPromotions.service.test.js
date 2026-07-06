const { remove, getById } = require("../../src/modules/admin/adminPromotions.service");

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
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin Promotions Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("remove", () => {
    it("should set status to INACTIVE and not crash", async () => {
      const mockPromoBefore = {
        PromotionId: 1,
        Title: "Summer Sale",
        Status: "ACTIVE",
      };

      const mockPromoAfter = {
        PromotionId: 1,
        Title: "Summer Sale",
        Status: "INACTIVE",
      };

      // Mock returns:
      // 1. getById (before delete verification)
      // 2. update query
      // 3. getById (after delete return)
      mockQuery
        .mockResolvedValueOnce({ recordset: [mockPromoBefore] }) // getById before
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockPromoAfter] }); // getById after

      const result = await remove(1);

      expect(result).toBeDefined();
      expect(result.Status).toBe("INACTIVE");

      // Verify UPDATE query contents
      const updateCallQuery = mockQuery.mock.calls[1][0];
      expect(updateCallQuery).toContain("UPDATE Promotions");
      expect(updateCallQuery).toContain("SET Status = 'INACTIVE'");
      expect(updateCallQuery).not.toContain("UpdatedAt = GETDATE()");
    });
  });
});
