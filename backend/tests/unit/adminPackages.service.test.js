const {
  getCategories,
  getServices,
  list,
  getById,
  getAssignedServices,
  create,
  update,
  changeStatus,
  remove,
} = require("../../src/modules/admin/adminPackages.service");

// Mock DB with safe hoisting
jest.mock("../../src/config/db", () => {
  const mockInput = jest.fn().mockReturnThis();
  const mockQuery = jest.fn();
  const mockRequest = jest.fn().mockImplementation(() => ({
    input: mockInput,
    query: mockQuery,
  }));
  const mockTransaction = jest.fn().mockImplementation(() => ({
    begin: jest.fn().mockResolvedValue(true),
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
  }));
  const mockPool = {
    request: jest.fn().mockImplementation(() => mockRequest()),
  };
  const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

  const sqlObj = {
    NVarChar: "NVarChar",
    Int: "Int",
    Date: "Date",
    Decimal: () => "Decimal",
    Bit: "Bit",
    Transaction: mockTransaction,
    Request: mockRequest,
  };

  return {
    sql: sqlObj,
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin Packages Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("getCategories", () => {
    it("should retrieve active package categories", async () => {
      const mockCats = [{ PackageCategoryId: 1, CategoryName: "Acne Combo" }];
      mockQuery.mockResolvedValueOnce({ recordset: mockCats });

      const result = await getCategories();

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].CategoryName).toBe("Acne Combo");
    });
  });

  describe("getServices", () => {
    it("should retrieve available services", async () => {
      const mockSvcs = [{ ServiceId: 1, ServiceName: "Facial Wash", Price: 100000 }];
      mockQuery.mockResolvedValueOnce({ recordset: mockSvcs });

      const result = await getServices();

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].ServiceName).toBe("Facial Wash");
    });
  });

  describe("list", () => {
    it("should retrieve a list of packages", async () => {
      const mockList = [
        { PackageId: 1, PackageName: "Gold Skin Care", OriginalPrice: 500000, SalePrice: 400000 },
      ];
      mockQuery.mockResolvedValueOnce({ recordset: mockList });

      const result = await list({ keyword: "gold" });

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].PackageName).toBe("Gold Skin Care");
    });
  });

  describe("getById", () => {
    it("should retrieve package by ID", async () => {
      const mockPkg = { PackageId: 1, PackageName: "Gold Skin Care" };
      mockQuery.mockResolvedValueOnce({ recordset: [mockPkg] });

      const result = await getById(1);

      expect(result).toBeDefined();
      expect(result.PackageName).toBe("Gold Skin Care");
    });

    it("should throw error if not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await expect(getById(99)).rejects.toThrow("Không tìm thấy package");
    });
  });

  describe("getAssignedServices", () => {
    it("should retrieve services assigned to package", async () => {
      const mockAssigned = [
        { ServiceId: 1, ServiceName: "Facial Wash", IsAssigned: 1 },
      ];
      mockQuery.mockResolvedValueOnce({ recordset: mockAssigned });

      const result = await getAssignedServices(1);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].IsAssigned).toBe(true);
    });
  });

  describe("create", () => {
    it("should create a new package inside a transaction and return it", async () => {
      const payload = {
        PackageName: "Mega Acne Combo",
        OriginalPrice: 800000,
        SalePrice: 600000,
        TotalSessions: 5,
        ValidityDays: 45,
        services: [{ serviceId: 1, sessionCount: 5 }],
      };

      const mockCreated = {
        PackageId: 10,
        PackageName: "Mega Acne Combo",
      };

      // Query mocks:
      // 1. check unique name
      // 2. insert package returning PackageId
      // 3. delete existing package services (within savePackageServices)
      // 4. insert package service (within savePackageServices)
      // 5. getById to return the package
      mockQuery
        .mockResolvedValueOnce({ recordset: [] }) // unique check
        .mockResolvedValueOnce({ recordset: [{ PackageId: 10 }] }) // insert package
        .mockResolvedValueOnce({ rowsAffected: [0] }) // delete services
        .mockResolvedValueOnce({ rowsAffected: [1] }) // insert service
        .mockResolvedValueOnce({ recordset: [mockCreated] }); // getById after insert

      const result = await create(payload);

      expect(result).toBeDefined();
      expect(result.PackageName).toBe("Mega Acne Combo");
    });
  });

  describe("update", () => {
    it("should update package details and services", async () => {
      const current = {
        PackageId: 10,
        PackageName: "Mega Acne Combo",
        OriginalPrice: 800000,
        SalePrice: 600000,
        TotalSessions: 5,
        ValidityDays: 45,
      };

      const updated = {
        PackageId: 10,
        PackageName: "Ultra Acne Combo",
        OriginalPrice: 900000,
        SalePrice: 700000,
      };

      // Query mocks:
      // 1. getById initial
      // 2. check unique name (exclude current ID)
      // 3. update query
      // 4. delete existing services (savePackageServices)
      // 5. insert service (savePackageServices)
      // 6. getById final
      mockQuery
        .mockResolvedValueOnce({ recordset: [current] }) // getById initial
        .mockResolvedValueOnce({ recordset: [] }) // unique name check
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update package
        .mockResolvedValueOnce({ rowsAffected: [1] }) // delete services
        .mockResolvedValueOnce({ rowsAffected: [1] }) // insert service
        .mockResolvedValueOnce({ recordset: [updated] }); // getById final

      const result = await update(10, {
        PackageName: "Ultra Acne Combo",
        OriginalPrice: 900000,
        SalePrice: 700000,
        services: [{ serviceId: 1, sessionCount: 5 }],
      });

      expect(result).toBeDefined();
      expect(result.PackageName).toBe("Ultra Acne Combo");
    });
  });

  describe("changeStatus", () => {
    it("should update package status", async () => {
      const current = { PackageId: 10, PackageName: "Combo", Status: "ACTIVE" };
      const updated = { PackageId: 10, PackageName: "Combo", Status: "INACTIVE" };

      mockQuery
        .mockResolvedValueOnce({ recordset: [current] }) // getById initial
        .mockResolvedValueOnce({ rowsAffected: [1] }) // update status
        .mockResolvedValueOnce({ recordset: [updated] }); // getById final

      const result = await changeStatus(10, { status: "INACTIVE" });

      expect(result).toBeDefined();
      expect(result.Status).toBe("INACTIVE");
    });
  });

  describe("remove", () => {
    it("should soft delete package by setting status to INACTIVE", async () => {
      const current = { PackageId: 10, PackageName: "Combo", Status: "ACTIVE" };
      const updated = { PackageId: 10, PackageName: "Combo", Status: "INACTIVE" };

      mockQuery
        .mockResolvedValueOnce({ recordset: [current] }) // getById initial
        .mockResolvedValueOnce({ rowsAffected: [1] }) // soft delete status
        .mockResolvedValueOnce({ recordset: [updated] }); // getById final

      const result = await remove(10);

      expect(result).toBeDefined();
      expect(result.Status).toBe("INACTIVE");
    });
  });
});
