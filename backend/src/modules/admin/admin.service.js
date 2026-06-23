const { sql, connectDB } = require("../../config/db");

async function getDashboard() {
  const pool = await connectDB();

  const [
    summary,
    appointmentStatus,
    paymentStatus,
    topServices,
    topTechnicians,
    latestReviews,
    latestAppointments,
    recentFeedbacks,
    revenueByDay,
  ] = await Promise.all([
    pool.request().query(`
      SELECT
        ISNULL((
          SELECT SUM(p.Amount)
          FROM Payments p
          WHERE p.Status = 'PAID'
            AND CAST(p.PaidAt AS DATE) = CAST(GETDATE() AS DATE)
        ), 0) AS RevenueToday,

        ISNULL((
          SELECT SUM(p.Amount)
          FROM Payments p
          WHERE p.Status = 'PAID'
            AND MONTH(p.PaidAt) = MONTH(GETDATE())
            AND YEAR(p.PaidAt) = YEAR(GETDATE())
        ), 0) AS RevenueThisMonth,

        ISNULL((SELECT COUNT(*) FROM Customers), 0) AS TotalCustomers,
        ISNULL((SELECT COUNT(*) FROM Employees), 0) AS TotalEmployees,
        ISNULL((SELECT COUNT(*) FROM Services WHERE Status = 'AVAILABLE'), 0) AS ActiveServices,
        ISNULL((SELECT COUNT(*) FROM Services WHERE Status <> 'AVAILABLE'), 0) AS InactiveServices,

        ISNULL((
          SELECT COUNT(*)
          FROM Appointments
          WHERE CAST(AppointmentDate AS DATE) = CAST(GETDATE() AS DATE)
        ), 0) AS AppointmentsToday,

        ISNULL((SELECT COUNT(*) FROM Appointments), 0) AS TotalAppointments,
        ISNULL((SELECT COUNT(*) FROM Appointments WHERE Status = 'PENDING'), 0) AS PendingAppointments,
        ISNULL((SELECT COUNT(*) FROM Appointments WHERE Status = 'CONFIRMED'), 0) AS ConfirmedAppointments,
        ISNULL((SELECT COUNT(*) FROM Appointments WHERE Status = 'COMPLETED'), 0) AS CompletedAppointments,
        ISNULL((SELECT COUNT(*) FROM Appointments WHERE Status = 'CANCELLED'), 0) AS CancelledAppointments,

        ISNULL((SELECT COUNT(*) FROM Payments WHERE Status = 'PENDING'), 0) AS PendingPayments,
        ISNULL((SELECT COUNT(*) FROM Payments WHERE Status = 'FAILED'), 0) AS FailedPayments,

        ISNULL((SELECT COUNT(*) FROM Reviews WHERE Status = 'PENDING'), 0) AS PendingReviews,
        ISNULL((SELECT COUNT(*) FROM Feedbacks WHERE Status = 'PENDING'), 0) AS PendingFeedbacks,

        ISNULL((SELECT COUNT(*) FROM Users WHERE Status = 'ACTIVE'), 0) AS ActiveUsers,
        ISNULL((SELECT COUNT(*) FROM Users WHERE Status = 'INACTIVE'), 0) AS InactiveUsers,
        ISNULL((SELECT COUNT(*) FROM Users WHERE Status = 'BANNED'), 0) AS BannedUsers,
        ISNULL((SELECT COUNT(*) FROM WaitingList), 0) AS TotalWaitingCount,
        ISNULL((SELECT COUNT(*) FROM WaitingList WHERE Status IN ('MATCHED', 'BOOKED', 'SKIPPED')), 0) AS MatchedWaitingCount,
        ISNULL((SELECT COUNT(*) FROM WaitingList WHERE Status = 'BOOKED'), 0) AS BookedWaitingCount,
        ISNULL((SELECT COUNT(*) FROM WaitingList WHERE Status IN ('EXPIRED', 'SKIPPED')), 0) AS ExpiredWaitingCount
    `),

    pool.request().query(`
      SELECT Status, COUNT(*) AS Count
      FROM Appointments
      GROUP BY Status
      ORDER BY Count DESC
    `),

    pool.request().query(`
      SELECT Status, COUNT(*) AS Count
      FROM Payments
      GROUP BY Status
      ORDER BY Count DESC
    `),

    pool.request().query(`
      SELECT TOP 6
        s.ServiceId,
        s.ServiceName,
        sc.CategoryName,
        COUNT(DISTINCT aps.AppointmentId) AS AppointmentCount,
        SUM(ISNULL(aps.Price, 0)) AS Revenue
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
      GROUP BY s.ServiceId, s.ServiceName, sc.CategoryName
      ORDER BY AppointmentCount DESC, Revenue DESC
    `),

    pool.request().query(`
      WITH TechnicianAppointments AS (
        SELECT
          e.EmployeeId,
          COUNT(DISTINCT a.AppointmentId) AS AppointmentCount
        FROM Employees e
        LEFT JOIN Appointments a ON a.EmployeeId = e.EmployeeId
        GROUP BY e.EmployeeId
      ),
      TechnicianRevenue AS (
        SELECT
          e.EmployeeId,
          SUM(ISNULL(p.Amount, 0)) AS Revenue
        FROM Employees e
        LEFT JOIN Appointments a ON a.EmployeeId = e.EmployeeId
        LEFT JOIN Invoices i ON i.AppointmentId = a.AppointmentId
        LEFT JOIN Payments p ON p.InvoiceId = i.InvoiceId AND p.Status = 'PAID'
        GROUP BY e.EmployeeId
      ),
      TechnicianRating AS (
        SELECT
          EmployeeId,
          AVG(CAST(Rating AS DECIMAL(10,2))) AS AvgRating,
          COUNT(*) AS ReviewCount
        FROM Reviews
        WHERE EmployeeId IS NOT NULL
          AND Status = 'APPROVED'
        GROUP BY EmployeeId
      )
      SELECT TOP 6
        e.EmployeeId,
        u.FullName,
        u.AvatarUrl,
        e.ImageUrl,
        e.Position,
        e.Specialization,
        ISNULL(ta.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(tr.Revenue, 0) AS Revenue,
        rt.AvgRating,
        ISNULL(rt.ReviewCount, 0) AS ReviewCount
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN TechnicianAppointments ta ON e.EmployeeId = ta.EmployeeId
      LEFT JOIN TechnicianRevenue tr ON e.EmployeeId = tr.EmployeeId
      LEFT JOIN TechnicianRating rt ON e.EmployeeId = rt.EmployeeId
      ORDER BY ta.AppointmentCount DESC, tr.Revenue DESC, rt.AvgRating DESC
    `),

    pool.request().query(`
      SELECT TOP 6
        rv.ReviewId,
        rv.Rating,
        rv.TechnicianRating,
        rv.Comment,
        rv.Status,
        rv.CreatedAt,
        cu.FullName AS CustomerName,
        s.ServiceName,
        eu.FullName AS EmployeeName
      FROM Reviews rv
      JOIN Customers c ON rv.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON rv.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON rv.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      ORDER BY rv.CreatedAt DESC, rv.ReviewId DESC
    `),

    pool.request().query(`
      SELECT TOP 8
        a.AppointmentId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        cu.FullName AS CustomerName,
        eu.FullName AS EmployeeName,
        ISNULL(i.FinalAmount, 0) AS FinalAmount,
        p.Status AS PaymentStatus
      FROM Appointments a
      LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
      LEFT JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON i.AppointmentId = a.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 Status
        FROM Payments p
        WHERE p.InvoiceId = i.InvoiceId
        ORDER BY p.CreatedAt DESC, p.PaymentId DESC
      ) p
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC, a.AppointmentId DESC
    `),

    pool.request().query(`
      SELECT TOP 6
        f.FeedbackId,
        f.Subject,
        f.Content,
        f.Status,
        f.CreatedAt,
        u.FullName AS CustomerName
      FROM Feedbacks f
      LEFT JOIN Customers c ON f.CustomerId = c.CustomerId
      LEFT JOIN Users u ON c.UserId = u.UserId
      ORDER BY f.CreatedAt DESC, f.FeedbackId DESC
    `),

    pool.request().query(`
      SELECT
        CONVERT(VARCHAR(10), d.PayDate, 120) AS Date,
        ISNULL(SUM(p.Amount), 0) AS Revenue
      FROM (
        SELECT CAST(DATEADD(DAY, -6, CAST(GETDATE() AS DATE)) AS DATE) AS PayDate
        UNION ALL SELECT CAST(DATEADD(DAY, -5, CAST(GETDATE() AS DATE)) AS DATE)
        UNION ALL SELECT CAST(DATEADD(DAY, -4, CAST(GETDATE() AS DATE)) AS DATE)
        UNION ALL SELECT CAST(DATEADD(DAY, -3, CAST(GETDATE() AS DATE)) AS DATE)
        UNION ALL SELECT CAST(DATEADD(DAY, -2, CAST(GETDATE() AS DATE)) AS DATE)
        UNION ALL SELECT CAST(DATEADD(DAY, -1, CAST(GETDATE() AS DATE)) AS DATE)
        UNION ALL SELECT CAST(GETDATE() AS DATE)
      ) d
      LEFT JOIN Payments p
        ON CAST(p.PaidAt AS DATE) = d.PayDate
        AND p.Status = 'PAID'
      GROUP BY d.PayDate
      ORDER BY d.PayDate
    `),
  ]);

  const s = summary.recordset[0] || {};

  return {
    summary: {
      revenueToday: Number(s.RevenueToday || 0),
      revenueThisMonth: Number(s.RevenueThisMonth || 0),
      totalCustomers: Number(s.TotalCustomers || 0),
      totalEmployees: Number(s.TotalEmployees || 0),
      activeServices: Number(s.ActiveServices || 0),
      inactiveServices: Number(s.InactiveServices || 0),
      appointmentsToday: Number(s.AppointmentsToday || 0),
      totalAppointments: Number(s.TotalAppointments || 0),
      pendingAppointments: Number(s.PendingAppointments || 0),
      confirmedAppointments: Number(s.ConfirmedAppointments || 0),
      completedAppointments: Number(s.CompletedAppointments || 0),
      cancelledAppointments: Number(s.CancelledAppointments || 0),
      pendingPayments: Number(s.PendingPayments || 0),
      failedPayments: Number(s.FailedPayments || 0),
      pendingReviews: Number(s.PendingReviews || 0),
      pendingFeedbacks: Number(s.PendingFeedbacks || 0),
      activeUsers: Number(s.ActiveUsers || 0),
      inactiveUsers: Number(s.InactiveUsers || 0),
      bannedUsers: Number(s.BannedUsers || 0),
      totalWaitingCount: Number(s.TotalWaitingCount || 0),
      matchedWaitingCount: Number(s.MatchedWaitingCount || 0),
      bookedWaitingCount: Number(s.BookedWaitingCount || 0),
      expiredWaitingCount: Number(s.ExpiredWaitingCount || 0),
    },

    appointmentStatus: appointmentStatus.recordset.map((row) => ({
      status: row.Status,
      count: Number(row.Count || 0),
    })),

    paymentStatus: paymentStatus.recordset.map((row) => ({
      status: row.Status,
      count: Number(row.Count || 0),
    })),

    topServices: topServices.recordset.map((row) => ({
      serviceId: row.ServiceId,
      serviceName: row.ServiceName,
      categoryName: row.CategoryName,
      appointmentCount: Number(row.AppointmentCount || 0),
      revenue: Number(row.Revenue || 0),
    })),

    topTechnicians: topTechnicians.recordset.map((row) => ({
      employeeId: row.EmployeeId,
      fullName: row.FullName,
      avatarUrl: row.AvatarUrl || row.ImageUrl,
      position: row.Position,
      specialization: row.Specialization,
      appointmentCount: Number(row.AppointmentCount || 0),
      revenue: Number(row.Revenue || 0),
      avgRating: row.AvgRating !== null ? Number(row.AvgRating) : null,
      reviewCount: Number(row.ReviewCount || 0),
    })),

    latestReviews: latestReviews.recordset.map((row) => ({
      reviewId: row.ReviewId,
      rating: Number(row.Rating || 0),
      technicianRating: Number(row.TechnicianRating || 0),
      comment: row.Comment,
      status: row.Status,
      createdAt: row.CreatedAt,
      customerName: row.CustomerName,
      serviceName: row.ServiceName,
      employeeName: row.EmployeeName,
    })),

    latestAppointments: latestAppointments.recordset.map((row) => ({
      appointmentId: row.AppointmentId,
      appointmentDate: row.AppointmentDate,
      startTime: row.StartTime,
      endTime: row.EndTime,
      status: row.Status,
      customerName: row.CustomerName,
      employeeName: row.EmployeeName,
      finalAmount: Number(row.FinalAmount || 0),
      paymentStatus: row.PaymentStatus || "PENDING",
    })),

    recentFeedbacks: recentFeedbacks.recordset.map((row) => ({
      feedbackId: row.FeedbackId,
      subject: row.Subject,
      content: row.Content,
      status: row.Status,
      createdAt: row.CreatedAt,
      customerName: row.CustomerName,
    })),

    revenueByDay: revenueByDay.recordset.map((row) => ({
      date: row.Date,
      revenue: Number(row.Revenue || 0),
    })),
  };
}

module.exports = { getDashboard };
