const { remove, getById } = require("../../src/modules/admin/adminServices.service");

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

describe("Admin Services Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("remove", () => {
    it("should set status to INACTIVE and not crash", async () => {
      const mockServiceBefore = {
        ServiceId: 1,
        ServiceName: "Test Facial",
        Status: "AVAILABLE",
      };

      const mockServiceAfter = {
        ServiceId: 1,
        ServiceName: "Test Facial",
        Status: "INACTIVE",
      };

      // Mock returns:
      // 1. getById (before delete verification)
      // 2. update query
      // 3. getById (after delete return)
      mockQuery
        .mockResolvedValueOnce({ recordset: [mockServiceBefore] }) // getById before
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [mockServiceAfter] }); // getById after

      const result = await remove(1);

      expect(result).toBeDefined();
      expect(result.Status).toBe("INACTIVE");

      // Verify UPDATE query contents
      const updateCallQuery = mockQuery.mock.calls[1][0];
      expect(updateCallQuery).toContain("UPDATE Services");
      expect(updateCallQuery).toContain("SET Status = 'INACTIVE'");
      expect(updateCallQuery).not.toContain("UpdatedAt = GETDATE()");
    });
  });
});
