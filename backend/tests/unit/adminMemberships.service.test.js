const {
  list,
  getById,
  getCustomersByLevel,
  create,
  update,
  remove,
} = require("../../src/modules/admin/adminMemberships.service");

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

describe("Admin Memberships Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("list", () => {
    it("should retrieve a list of membership levels", async () => {
      const mockList = [
        { MembershipLevelId: 1, LevelName: "Bronze", MinPoints: 0, DiscountPercent: 0 },
        { MembershipLevelId: 2, LevelName: "Gold", MinPoints: 1000, DiscountPercent: 10 },
      ];
      mockQuery.mockResolvedValueOnce({ recordset: mockList });

      const result = await list({ keyword: "gold" });

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[1].LevelName).toBe("Gold");
      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%gold%");
    });
  });

  describe("getById", () => {
    it("should retrieve a single membership level by ID", async () => {
      const mockLevel = { MembershipLevelId: 2, LevelName: "Gold", MinPoints: 1000 };
      mockQuery.mockResolvedValueOnce({ recordset: [mockLevel] });

      const result = await getById(2);

      expect(result).toBeDefined();
      expect(result.LevelName).toBe("Gold");
      expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", 2);
    });

    it("should throw error if not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await expect(getById(99)).rejects.toThrow("Không tìm thấy hạng membership");
    });
  });

  describe("getCustomersByLevel", () => {
    it("should retrieve customers belonging to a level", async () => {
      const mockCustomers = [
        { CustomerId: 1, FullName: "John Doe", LoyaltyPoints: 1200 },
      ];
      mockQuery.mockResolvedValueOnce({ recordset: mockCustomers });

      const result = await getCustomersByLevel(2);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].FullName).toBe("John Doe");
      expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", 2);
    });
  });

  describe("create", () => {
    it("should create a new membership level and return it", async () => {
      const newLevelPayload = {
        LevelName: "Platinum",
        MinPoints: 5000,
        DiscountPercent: 15,
        Description: "Premium VIP tier",
      };

      const createdLevel = {
        MembershipLevelId: 3,
        LevelName: "Platinum",
        MinPoints: 5000,
        DiscountPercent: 15,
        Description: "Premium VIP tier",
      };

      // 1. mock unique name check (no existing record)
      // 2. mock INSERT query returning created ID
      // 3. mock getById query returning full record
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // unique check
        .mockResolvedValueOnce({ recordset: [{ MembershipLevelId: 3 }] }) // insert
        .mockResolvedValueOnce({ recordset: [createdLevel] }); // getById after insert

      const result = await create(newLevelPayload);

      expect(result).toBeDefined();
      expect(result.LevelName).toBe("Platinum");
      expect(result.MinPoints).toBe(5000);
      expect(mockInput).toHaveBeenCalledWith("LevelName", "NVarChar", "Platinum");
    });

    it("should throw error if level name is already taken", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ MembershipLevelId: 2 }] });

      await expect(
        create({ LevelName: "Gold", MinPoints: 1000, DiscountPercent: 10 }),
      ).rejects.toThrow("Tên hạng membership đã tồn tại");
    });
  });

  describe("update", () => {
    it("should update an existing membership level and return it", async () => {
      const currentLevel = {
        MembershipLevelId: 2,
        LevelName: "Gold",
        MinPoints: 1000,
        DiscountPercent: 10,
      };

      const updatedLevel = {
        MembershipLevelId: 2,
        LevelName: "Golden",
        MinPoints: 1200,
        DiscountPercent: 12,
      };

      // 1. getById in update initialization
      // 2. unique check (no existing record with name Golden)
      // 3. UPDATE query execution
      // 4. getById returning updated record
      mockQuery
        .mockResolvedValueOnce({ recordset: [currentLevel] }) // current getById
        .mockResolvedValueOnce({ recordset: [] }) // unique name check
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update query
        .mockResolvedValueOnce({ recordset: [updatedLevel] }); // getById after update

      const result = await update(2, { LevelName: "Golden", MinPoints: 1200, DiscountPercent: 12 });

      expect(result).toBeDefined();
      expect(result.LevelName).toBe("Golden");
      expect(result.MinPoints).toBe(1200);
    });
  });

  describe("remove", () => {
    it("should throw error if level has active customers", async () => {
      const mockLevel = {
        MembershipLevelId: 2,
        LevelName: "Gold",
        CustomerCount: 5,
      };
      mockLevel.CustomerCount = 5;
      mockQuery.mockResolvedValueOnce({ recordset: [mockLevel] });

      await expect(remove(2)).rejects.toThrow("Không thể xóa hạng membership đang có customer sử dụng");
    });

    it("should delete level if there are no active customers", async () => {
      const mockLevel = {
        MembershipLevelId: 2,
        LevelName: "Gold",
        CustomerCount: 0,
      };

      // 1. getById initial check
      // 2. DELETE query execution
      mockQuery
        .mockResolvedValueOnce({ recordset: [mockLevel] }) // getById
        .mockResolvedValueOnce({ rowsAffected: [1] }); // delete

      const result = await remove(2);

      expect(result).toBeDefined();
      expect(result.MembershipLevelId).toBe(2);
    });
  });
});
