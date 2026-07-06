const { getTechnicians, list, getById, create, update, remove } = require("../../src/modules/admin/adminWorkShifts.service");

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

  const mockSqlType = (name) => {
    const fn = () => name;
    fn.toString = () => name;
    return fn;
  };

  return {
    sql: {
      Int: "Int",
      Date: "Date",
      VarChar: mockSqlType("VarChar"),
      NVarChar: mockSqlType("NVarChar"),
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockPoolQuery: mockPool.query,
    _mockInput: mockInput,
  };
});

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Admin Work Shifts Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  describe("getTechnicians", () => {
    it("should fetch all active technicians from DB", async () => {
      const records = [{ EmployeeId: 1, FullName: "Technician A" }];
      mockQuery.mockResolvedValueOnce({ recordset: records });

      const res = await getTechnicians();
      expect(res).toEqual(records);
    });
  });

  describe("list", () => {
    it("should retrieve workshifts list with default params", async () => {
      const mockShifts = [{ ShiftId: 5, ShiftName: "Ca sáng" }];
      mockQuery.mockResolvedValueOnce({ recordset: mockShifts });

      const res = await list();
      expect(res).toEqual(mockShifts);
      expect(mockInput).toHaveBeenCalledWith("ShiftDate", "Date", null);
      expect(mockInput).toHaveBeenCalledWith("Status", "VarChar", null);
    });

    it("should retrieve workshifts with active filters", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await list({
        shiftDate: "2026-07-01",
        status: "OPEN",
      });

      expect(mockInput).toHaveBeenCalledWith("ShiftDate", "Date", "2026-07-01");
      expect(mockInput).toHaveBeenCalledWith("Status", "VarChar", "OPEN");
    });
  });

  describe("getById", () => {
    it("should return a workshift if found", async () => {
      const shift = { ShiftId: 10, ShiftName: "Ca sáng" };
      mockQuery.mockResolvedValueOnce({ recordset: [shift] });

      const res = await getById(10);
      expect(res).toEqual(shift);
      expect(mockInput).toHaveBeenCalledWith("ShiftId", "Int", 10);
    });

    it("should throw error if workshift not found", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await expect(getById(99)).rejects.toThrow("Không tìm thấy ca làm");
    });
  });

  describe("create", () => {
    const futureDate = "2026-12-31";

    it("should throw if shiftName is missing", async () => {
      await expect(create({ shiftDate: futureDate })).rejects.toThrow("Vui lòng nhập tên ca làm");
    });

    it("should throw if shiftDate is missing", async () => {
      await expect(create({ shiftName: "Ca sáng" })).rejects.toThrow("Vui lòng chọn ngày làm");
    });

    it("should throw if startTime or endTime is missing", async () => {
      await expect(create({ shiftName: "Ca sáng", shiftDate: futureDate })).rejects.toThrow("Vui lòng nhập giờ bắt đầu và kết thúc");
    });

    it("should throw if startTime >= endTime", async () => {
      await expect(
        create({ shiftName: "Ca sáng", shiftDate: futureDate, startTime: "17:00", endTime: "08:00" })
      ).rejects.toThrow("Giờ kết thúc phải lớn hơn giờ bắt đầu");
    });

    it("should insert and return details on success", async () => {
      const newShift = { ShiftId: 15, ShiftName: "Ca sáng", ShiftDate: futureDate };
      mockQuery.mockResolvedValueOnce({ recordset: [newShift] });

      const res = await create({
        shiftName: "Ca sáng",
        shiftDate: futureDate,
        startTime: "08:00",
        endTime: "17:00",
        maxTechnicians: 6,
        status: "OPEN",
      });

      expect(res).toEqual(newShift);
      expect(mockInput).toHaveBeenCalledWith("ShiftName", "NVarChar", "Ca sáng");
      expect(mockInput).toHaveBeenCalledWith("ShiftDate", "Date", futureDate);
    });
  });

  describe("update", () => {
    const futureDate = "2026-12-31";
    const currentShift = { ShiftId: 15, ShiftName: "Ca sáng", ShiftDate: futureDate, StartTime: "08:00:00", EndTime: "17:00:00", Status: "OPEN" };

    it("should update shift correctly when fields are valid", async () => {
      mockQuery
        .mockResolvedValueOnce({ recordset: [currentShift] }) // getById fetch current
        .mockResolvedValueOnce({ recordset: [] }) // update query output
        .mockResolvedValueOnce({ recordset: [{ ...currentShift, ShiftName: "Ca sáng mới" }] }); // final getById

      const res = await update(15, { shiftName: "Ca sáng mới" });
      expect(res.ShiftName).toBe("Ca sáng mới");
    });
  });

  describe("remove", () => {
    it("should delete shift from db", async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const res = await remove(15);
      expect(res).toEqual({ ShiftId: 15 });
      expect(mockInput).toHaveBeenCalledWith("ShiftId", "Int", 15);
    });
  });
});
