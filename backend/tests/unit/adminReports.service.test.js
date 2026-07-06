const { getSummary } = require("../../src/modules/admin/adminReports.service");

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

describe("Admin Reports Service Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  it("should retrieve summary reports successfully with correct return structure", async () => {
    // 1. General Metrics
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          TotalRevenue: 1500000,
          TotalTransactions: 3,
          TotalAppointments: 4,
          CompletedAppointments: 3,
          CancelledAppointments: 1,
        },
      ],
    });

    // 2. New Customers
    mockQuery.mockResolvedValueOnce({
      recordset: [{ NewCustomersCount: 10 }],
    });

    // 3. Refunds
    mockQuery.mockResolvedValueOnce({
      recordset: [{ RefundCount: 1, TotalRefunded: 200000 }],
    });

    // 4. Daily Trend
    mockQuery.mockResolvedValueOnce({
      recordset: [
        { RevenueDate: "2026-06-25", Revenue: 1500000, TransactionCount: 3 },
      ],
    });

    // 5. Service Distribution
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          CategoryId: 1,
          CategoryName: "Chăm sóc tóc",
          AppointmentCount: 4,
          Revenue: 1500000,
        },
      ],
    });

    // 6. Top Services
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          ServiceId: 1,
          ServiceName: "Cắt tóc nam",
          AppointmentCount: 4,
          ServiceRevenue: 600000,
          AverageRating: 4.8,
          ReviewCount: 2,
        },
      ],
    });

    // 7. Top Employees
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          EmployeeId: 1,
          EmployeeName: "Lê Văn A",
          AppointmentCount: 4,
          AverageRating: 4.9,
          ReviewCount: 3,
        },
      ],
    });

    // 8. Detailed Appointments
    mockQuery.mockResolvedValueOnce({
      recordset: [
        {
          AppointmentId: 1,
          CustomerId: 2,
          CustomerName: "Trần Thị B",
          EmployeeName: "Lê Văn A",
          AppointmentDate: "2026-06-25",
          StartTime: "09:00:00",
          EndTime: "10:00:00",
          AppointmentStatus: "COMPLETED",
          InvoiceId: 10,
          FinalAmount: 200000,
          PaymentStatus: "PAID",
          PaymentMethod: "MOMO",
          RefundStatus: null,
        },
      ],
    });

    const result = await getSummary({});

    // Verify response structure
    expect(result).toBeDefined();
    expect(result.revenue).toEqual({
      TotalRevenue: 1500000,
      TotalInvoices: 3,
      TotalTransactions: 3,
      NewCustomersCount: 10,
      RefundCount: 1,
      TotalRefunded: 200000,
    });
    expect(result.appointments).toEqual({
      TotalAppointments: 4,
      CompletedAppointments: 3,
      CancelledAppointments: 1,
    });
    expect(result.dailyTrend).toHaveLength(1);
    expect(result.serviceDistribution).toHaveLength(1);
    expect(result.topServices).toHaveLength(1);
    expect(result.topEmployees).toHaveLength(1);
    expect(result.customerAppointments).toHaveLength(1);

    // Verify default parameters are null
    expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", null);
    expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", null);
    expect(mockInput).toHaveBeenCalledWith("CategoryId", "Int", null);
    expect(mockInput).toHaveBeenCalledWith("EmployeeId", "Int", null);
    expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", null);
  });

  it("should bind query filters when they are provided", async () => {
    // Mock the 8 database calls
    for (let i = 0; i < 8; i++) {
      mockQuery.mockResolvedValueOnce({ recordset: [] });
    }

    const filters = {
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      categoryId: "2",
      employeeId: "5",
      membershipLevelId: "1",
    };

    await getSummary(filters);

    expect(mockInput).toHaveBeenCalledWith("FromDate", "Date", "2026-06-01");
    expect(mockInput).toHaveBeenCalledWith("ToDate", "Date", "2026-06-30");
    expect(mockInput).toHaveBeenCalledWith("CategoryId", "Int", 2);
    expect(mockInput).toHaveBeenCalledWith("EmployeeId", "Int", 5);
    expect(mockInput).toHaveBeenCalledWith("MembershipLevelId", "Int", 1);
  });
});
