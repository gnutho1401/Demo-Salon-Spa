const { list, getById, create, update, remove, toggleActive } = require("../../src/modules/admin/adminCategories.service");

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
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin Categories Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("list", () => {
    it("should retrieve categories with filters", async () => {
      const mockResult = [
        { CategoryId: 1, CategoryName: "Facial Care", Description: "Skin care", Status: "ACTIVE", ServiceCount: 3 },
        { CategoryId: 2, CategoryName: "Body Massage", Description: "Relaxing massage", Status: "INACTIVE", ServiceCount: 0 }
      ];

      mockQuery.mockResolvedValueOnce({ recordset: mockResult });

      const result = await list({ keyword: "Care", status: "ACTIVE" });

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].CategoryName).toBe("Facial Care");
      expect(result[0].IsActive).toBe(true);
      expect(result[1].IsActive).toBe(false);

      expect(mockInput).toHaveBeenCalledWith("Keyword", "NVarChar", "%Care%");
      expect(mockInput).toHaveBeenCalledWith("Status", "NVarChar", "ACTIVE");
    });
  });

  describe("getById", () => {
    it("should return single category if found", async () => {
      const mockRow = { CategoryId: 1, CategoryName: "Facial Care", Status: "ACTIVE", ServiceCount: 3 };
      mockQuery.mockResolvedValueOnce({ recordset: [mockRow] });

      const result = await getById(1);
      expect(result).toBeDefined();
      expect(result.CategoryId).toBe(1);
      expect(result.IsActive).toBe(true);
      expect(mockInput).toHaveBeenCalledWith("CategoryId", "Int", 1);
    });

    it("should throw if category not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
      await expect(getById(99)).rejects.toThrow("Không tìm thấy category");
    });
  });

  describe("create", () => {
    it("should create successfully if name is unique", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // ensureUniqueName check
        .mockResolvedValueOnce({ recordset: [{ CategoryId: 5 }] }) // insert output
        .mockResolvedValueOnce({ recordset: [{ CategoryId: 5, CategoryName: "Hair Care", Status: "ACTIVE", ServiceCount: 0 }] }); // getById

      const result = await create({ CategoryName: "Hair Care", Description: "Hair treatment", Status: "ACTIVE" });
      expect(result).toBeDefined();
      expect(result.CategoryId).toBe(5);
      expect(result.CategoryName).toBe("Hair Care");
      expect(mockInput).toHaveBeenCalledWith("CategoryName", "NVarChar", "Hair Care");
    });

    it("should throw if CategoryName is empty", async () => {
      await expect(create({ CategoryName: "" })).rejects.toThrow("CategoryName không được để trống");
    });

    it("should throw if CategoryName is duplicate", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [{ CategoryId: 1 }] });
      await expect(create({ CategoryName: "Facial Care" })).rejects.toThrow("Tên category đã tồn tại");
    });
  });

  describe("update", () => {
    it("should update successfully", async () => {
      const mockCurrent = { CategoryId: 1, CategoryName: "Facial Care", Status: "ACTIVE", ServiceCount: 3 };
      const mockUpdated = { CategoryId: 1, CategoryName: "Facial Luxury", Status: "ACTIVE", ServiceCount: 3 };

      mockQuery
        .mockResolvedValueOnce({ recordset: [mockCurrent] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] })
        .mockResolvedValueOnce({ recordset: [mockUpdated] });

      const result = await update(1, { CategoryName: "Facial Luxury" });
      expect(result.CategoryName).toBe("Facial Luxury");
      expect(mockInput).toHaveBeenCalledWith("CategoryId", "Int", 1);
    });

    it("should throw if update name duplicates another category", async () => {
      const mockCurrent = { CategoryId: 1, CategoryName: "Facial Care", Status: "ACTIVE", ServiceCount: 3 };

      mockQuery
        .mockResolvedValueOnce({ recordset: [mockCurrent] })
        .mockResolvedValueOnce({ recordset: [{ CategoryId: 2 }] });

      await expect(update(1, { CategoryName: "Body Massage" })).rejects.toThrow("Tên category đã tồn tại");
    });
  });

  describe("remove", () => {
    it("should delete successfully if ServiceCount is 0", async () => {
      const mockCurrent = { CategoryId: 2, CategoryName: "Nail Care", Status: "ACTIVE", ServiceCount: 0 };
      mockQuery
        .mockResolvedValueOnce({ recordset: [mockCurrent] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const result = await remove(2);
      expect(result.CategoryId).toBe(2);
    });

    it("should throw if category has associated services", async () => {
      const mockCurrent = { CategoryId: 1, CategoryName: "Facial Care", Status: "ACTIVE", ServiceCount: 3 };
      mockQuery.mockResolvedValueOnce({ recordset: [mockCurrent] });

      await expect(remove(1)).rejects.toThrow("Không thể xóa category đang được sử dụng bởi dịch vụ");
    });
  });

  describe("toggleActive", () => {
    it("should toggle status correctly", async () => {
      const mockCurrent = { CategoryId: 1, CategoryName: "Facial Care", Status: "ACTIVE", IsActive: true, ServiceCount: 3 };
      const mockToggled = { CategoryId: 1, CategoryName: "Facial Care", Status: "INACTIVE", IsActive: false, ServiceCount: 3 };
      mockQuery
        .mockResolvedValueOnce({ recordset: [mockCurrent] })
        .mockResolvedValueOnce({ rowsAffected: [1] })
        .mockResolvedValueOnce({ recordset: [mockToggled] });

      const result = await toggleActive(1);
      expect(result.IsActive).toBe(false);
      expect(result.Status).toBe("INACTIVE");
    });
  });
});
