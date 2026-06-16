const { sql, connectDB } = require("../../config/db");

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function getSummary(filters = {}) {
  const pool = await connectDB();
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);

  const request = pool.request();
  if (fromDate) request.input("FromDate", sql.Date, fromDate);
  if (toDate) request.input("ToDate", sql.Date, toDate);

  const revenueResult = await request.query(`
    SELECT
      COALESCE(SUM(CASE WHEN (@FromDate IS NULL OR CAST(i.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(i.CreatedAt AS DATE) <= @ToDate) THEN i.FinalAmount ELSE 0 END), 0) AS TotalRevenue,
      COUNT(CASE WHEN (@FromDate IS NULL OR CAST(i.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(i.CreatedAt AS DATE) <= @ToDate) THEN i.InvoiceId ELSE NULL END) AS TotalInvoices
    FROM Invoices i
  `);

  const appointmentResult = await request.query(`
    SELECT
      COUNT(CASE WHEN (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate) THEN a.AppointmentId ELSE NULL END) AS TotalAppointments,
      COUNT(CASE WHEN (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate) AND a.Status = 'COMPLETED' THEN a.AppointmentId ELSE NULL END) AS CompletedAppointments,
      COUNT(CASE WHEN (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate) AND a.Status = 'CANCELLED' THEN a.AppointmentId ELSE NULL END) AS CancelledAppointments
    FROM Appointments a
  `);

  const monthlyRevenue = await request.query(`
    SELECT *
    FROM vw_MonthlyRevenue
    WHERE (@FromDate IS NULL OR DATEFROMPARTS(RevenueYear, RevenueMonth, 1) >= DATEFROMPARTS(YEAR(@FromDate), MONTH(@FromDate), 1))
      AND (@ToDate IS NULL OR DATEFROMPARTS(RevenueYear, RevenueMonth, 1) <= DATEFROMPARTS(YEAR(@ToDate), MONTH(@ToDate), 1))
    ORDER BY RevenueYear DESC, RevenueMonth DESC
  `);

  const topServices = await request.query(`
    SELECT TOP 10
      s.ServiceId,
      s.ServiceName,
      COUNT(aps.AppointmentServiceId) AS AppointmentCount,
      CAST(ISNULL(vr.AverageRating, 0) AS DECIMAL(3,2)) AS AverageRating,
      ISNULL(vr.ReviewCount, 0) AS ReviewCount
    FROM Services s
    LEFT JOIN AppointmentServices aps ON s.ServiceId = aps.ServiceId
    LEFT JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    LEFT JOIN vw_ServiceRatings vr ON s.ServiceId = vr.ServiceId
    WHERE (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate)
    GROUP BY s.ServiceId, s.ServiceName, vr.AverageRating, vr.ReviewCount
    ORDER BY AppointmentCount DESC, ReviewCount DESC, s.ServiceName ASC
  `);

  const topEmployees = await request.query(`
    SELECT TOP 10
      e.EmployeeId,
      u.FullName AS EmployeeName,
      COUNT(a.AppointmentId) AS AppointmentCount,
      CAST(ISNULL(er.AverageRating, 0) AS DECIMAL(3,2)) AS AverageRating,
      ISNULL(er.ReviewCount, 0) AS ReviewCount
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Appointments a ON e.EmployeeId = a.EmployeeId
    LEFT JOIN vw_EmployeeRatings er ON e.EmployeeId = er.EmployeeId
    WHERE (@FromDate IS NULL OR CAST(a.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(a.CreatedAt AS DATE) <= @ToDate)
    GROUP BY e.EmployeeId, u.FullName, er.AverageRating, er.ReviewCount
    ORDER BY AppointmentCount DESC, ReviewCount DESC, u.FullName ASC
  `);

  const customerAppointments = await request.query(`
    SELECT TOP 20
      AppointmentId,
      CustomerId,
      EmployeeName,
      AppointmentDate,
      StartTime,
      EndTime,
      AppointmentStatus,
      InvoiceId,
      FinalAmount,
      PaymentId,
      PaymentStatus,
      PaymentMethod,
      RefundId,
      RefundStatus
    FROM vw_CustomerAppointments
    WHERE (@FromDate IS NULL OR AppointmentDate >= @FromDate)
      AND (@ToDate IS NULL OR AppointmentDate <= @ToDate)
    ORDER BY AppointmentDate DESC, StartTime DESC, AppointmentId DESC
  `);

  return {
    filters: { fromDate, toDate },
    revenue: revenueResult.recordset[0],
    appointments: appointmentResult.recordset[0],
    monthlyRevenue: monthlyRevenue.recordset,
    topServices: topServices.recordset,
    topEmployees: topEmployees.recordset,
    customerAppointments: customerAppointments.recordset,
  };
}

module.exports = { getSummary };
