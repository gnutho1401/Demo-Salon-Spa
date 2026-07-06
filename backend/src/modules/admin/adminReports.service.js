const { sql, connectDB } = require("../../config/db");

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : fallback;
}

async function getSummary(filters = {}) {
  const pool = await connectDB();
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);
  const categoryId = toInt(filters.categoryId);
  const employeeId = toInt(filters.employeeId);
  const membershipLevelId = toInt(filters.membershipLevelId);

  const request = pool.request();
  request.input("FromDate", sql.Date, fromDate || null);
  request.input("ToDate", sql.Date, toDate || null);
  request.input("CategoryId", sql.Int, categoryId || null);
  request.input("EmployeeId", sql.Int, employeeId || null);
  request.input("MembershipLevelId", sql.Int, membershipLevelId || null);

  // 1. General Metrics (Revenue, Transactions, Appointments)
  const metricsResult = await request.query(`
    SELECT
      COALESCE(SUM(CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN i.FinalAmount ELSE 0 END), 0) AS TotalRevenue,
      COUNT(DISTINCT CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN i.InvoiceId END) AS TotalTransactions,
      COUNT(DISTINCT a.AppointmentId) AS TotalAppointments,
      COUNT(DISTINCT CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentId END) AS CompletedAppointments,
      COUNT(DISTINCT CASE WHEN a.Status = 'CANCELLED' THEN a.AppointmentId END) AS CancelledAppointments
    FROM Invoices i
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE (@FromDate IS NULL OR CAST(i.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(i.CreatedAt AS DATE) <= @ToDate)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
      AND (@CategoryId IS NULL OR EXISTS (
          SELECT 1 FROM AppointmentServices aps
          JOIN Services s ON aps.ServiceId = s.ServiceId
          WHERE aps.AppointmentId = a.AppointmentId AND s.CategoryId = @CategoryId
      ))
  `);

  // 2. New Customers
  const newCustomersResult = await request.query(`
    SELECT COUNT(*) AS NewCustomersCount
    FROM Customers c
    WHERE (@FromDate IS NULL OR CAST(c.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(c.CreatedAt AS DATE) <= @ToDate)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
  `);

  // 3. Refunds
  const refundsResult = await request.query(`
    SELECT
      COUNT(DISTINCT r.RefundId) AS RefundCount,
      COALESCE(SUM(r.RefundAmount), 0) AS TotalRefunded
    FROM Refunds r
    JOIN Payments p ON r.PaymentId = p.PaymentId
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE (@FromDate IS NULL OR CAST(r.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(r.CreatedAt AS DATE) <= @ToDate)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
      AND (@CategoryId IS NULL OR EXISTS (
          SELECT 1 FROM AppointmentServices aps
          JOIN Services s ON aps.ServiceId = s.ServiceId
          WHERE aps.AppointmentId = a.AppointmentId AND s.CategoryId = @CategoryId
      ))
  `);

  // 4. Daily Trend
  const dailyTrend = await request.query(`
    SELECT
      CAST(i.CreatedAt AS DATE) AS RevenueDate,
      COALESCE(SUM(CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN i.FinalAmount ELSE 0 END), 0) AS Revenue,
      COUNT(DISTINCT CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN i.InvoiceId END) AS TransactionCount
    FROM Invoices i
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE (@FromDate IS NULL OR CAST(i.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(i.CreatedAt AS DATE) <= @ToDate)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
      AND (@CategoryId IS NULL OR EXISTS (
          SELECT 1 FROM AppointmentServices aps
          JOIN Services s ON aps.ServiceId = s.ServiceId
          WHERE aps.AppointmentId = a.AppointmentId AND s.CategoryId = @CategoryId
      ))
    GROUP BY CAST(i.CreatedAt AS DATE)
    ORDER BY RevenueDate ASC
  `);

  // 5. Service Distribution
  const serviceDistribution = await request.query(`
    SELECT
      sc.CategoryId,
      sc.CategoryName,
      COUNT(DISTINCT aps.AppointmentServiceId) AS AppointmentCount,
      COALESCE(SUM(CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN aps.Price ELSE 0 END), 0) AS Revenue
    FROM ServiceCategories sc
    JOIN Services s ON sc.CategoryId = s.CategoryId
    LEFT JOIN AppointmentServices aps ON s.ServiceId = aps.ServiceId
    LEFT JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate)
      AND (@CategoryId IS NULL OR sc.CategoryId = @CategoryId)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
    GROUP BY sc.CategoryId, sc.CategoryName
    ORDER BY Revenue DESC, AppointmentCount DESC
  `);

  // 6. Top Services
  const topServices = await request.query(`
    SELECT TOP 10
      s.ServiceId,
      s.ServiceName,
      COUNT(DISTINCT aps.AppointmentServiceId) AS AppointmentCount,
      COALESCE(SUM(CASE WHEN i.Status IN ('PAID', 'REFUND_PENDING') THEN aps.Price ELSE 0 END), 0) AS ServiceRevenue,
      CAST(ISNULL(vr.AverageRating, 0) AS DECIMAL(3,2)) AS AverageRating,
      ISNULL(vr.ReviewCount, 0) AS ReviewCount
    FROM Services s
    LEFT JOIN AppointmentServices aps ON s.ServiceId = aps.ServiceId
    LEFT JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN vw_ServiceRatings vr ON s.ServiceId = vr.ServiceId
    WHERE (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate)
      AND (@CategoryId IS NULL OR s.CategoryId = @CategoryId)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
    GROUP BY s.ServiceId, s.ServiceName, vr.AverageRating, vr.ReviewCount
    ORDER BY AppointmentCount DESC, vr.ReviewCount DESC, s.ServiceName ASC
  `);

  // 7. Top Employees
  const topEmployees = await request.query(`
    SELECT TOP 10
      e.EmployeeId,
      u.FullName AS EmployeeName,
      COUNT(DISTINCT a.AppointmentId) AS AppointmentCount,
      CAST(ISNULL(er.AverageRating, 0) AS DECIMAL(3,2)) AS AverageRating,
      ISNULL(er.ReviewCount, 0) AS ReviewCount
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Appointments a ON e.EmployeeId = a.EmployeeId
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN vw_EmployeeRatings er ON e.EmployeeId = er.EmployeeId
    WHERE (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate)
      AND (@EmployeeId IS NULL OR e.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
      AND (@CategoryId IS NULL OR EXISTS (
          SELECT 1 FROM AppointmentServices aps
          JOIN Services s ON aps.ServiceId = s.ServiceId
          WHERE aps.AppointmentId = a.AppointmentId AND s.CategoryId = @CategoryId
      ))
    GROUP BY e.EmployeeId, u.FullName, er.AverageRating, er.ReviewCount
    ORDER BY AppointmentCount DESC, u.FullName ASC
  `);

  // 8. Detailed Appointments list
  const customerAppointments = await request.query(`
    SELECT
      va.AppointmentId,
      va.CustomerId,
      va.CustomerName,
      va.EmployeeName,
      va.AppointmentDate,
      va.StartTime,
      va.EndTime,
      va.AppointmentStatus,
      va.InvoiceId,
      va.FinalAmount,
      va.PaymentStatus,
      va.PaymentMethod,
      va.RefundStatus
    FROM vw_CustomerAppointments va
    JOIN Appointments a ON va.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    WHERE va.AppointmentStatus <> 'PENDING_PAYMENT'
      AND (@FromDate IS NULL OR va.AppointmentDate >= @FromDate)
      AND (@ToDate IS NULL OR va.AppointmentDate <= @ToDate)
      AND (@EmployeeId IS NULL OR a.EmployeeId = @EmployeeId)
      AND (@MembershipLevelId IS NULL OR c.MembershipLevelId = @MembershipLevelId)
      AND (@CategoryId IS NULL OR EXISTS (
          SELECT 1 FROM AppointmentServices aps
          JOIN Services s ON aps.ServiceId = s.ServiceId
          WHERE aps.AppointmentId = a.AppointmentId AND s.CategoryId = @CategoryId
      ))
    ORDER BY va.AppointmentDate DESC, va.StartTime DESC
  `);

  const metrics = metricsResult.recordset[0] || {};
  const newCust = newCustomersResult.recordset[0] || {};
  const refunds = refundsResult.recordset[0] || {};

  return {
    filters: { fromDate, toDate, categoryId, employeeId, membershipLevelId },
    revenue: {
      TotalRevenue: metrics.TotalRevenue || 0,
      TotalInvoices: metrics.TotalTransactions || 0,
      TotalTransactions: metrics.TotalTransactions || 0,
      NewCustomersCount: newCust.NewCustomersCount || 0,
      RefundCount: refunds.RefundCount || 0,
      TotalRefunded: refunds.TotalRefunded || 0,
    },
    appointments: {
      TotalAppointments: metrics.TotalAppointments || 0,
      CompletedAppointments: metrics.CompletedAppointments || 0,
      CancelledAppointments: metrics.CancelledAppointments || 0,
    },
    dailyTrend: dailyTrend.recordset,
    serviceDistribution: serviceDistribution.recordset,
    topServices: topServices.recordset,
    topEmployees: topEmployees.recordset,
    customerAppointments: customerAppointments.recordset,
  };
}

module.exports = { getSummary };
