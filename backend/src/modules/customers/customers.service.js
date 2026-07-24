const { sql, connectDB } = require("../../config/db");

async function getAll() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT
      c.CustomerId,
      u.UserId,
      u.FullName,
      u.Email,
      u.Phone,
      u.AvatarUrl,
      c.Gender,
      c.DateOfBirth,
      c.Address,
      c.LoyaltyPoints,
      COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    ORDER BY c.CustomerId DESC
  `);
  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        c.CustomerId,
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE c.CustomerId = @CustomerId
    `);

  if (result.recordset.length === 0)
    throw new Error("Không tìm thấy khách hàng");
  return result.recordset[0];
}

async function getMyProfile(userId) {
  const pool = await connectDB();

  // Expire temporary VIP status if it has exceeded its lifetime
  await pool.request().input("UserId", sql.Int, userId).query(`
      UPDATE c
      SET 
        c.MembershipLevelId = lv.MembershipLevelId,
        c.VIPExpiredAt = NULL
      FROM Customers c
      OUTER APPLY (
        SELECT TOP 1 MembershipLevelId
        FROM MembershipLevels
        WHERE MinPoints <= ISNULL(c.LoyaltyPoints, 0)
        ORDER BY MinPoints DESC
      ) lv
      WHERE c.UserId = @UserId
        AND c.VIPExpiredAt IS NOT NULL
        AND c.VIPExpiredAt < GETUTCDATE()
    `);

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.RoleId,
        u.Status,
        u.IsVerified,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel,
        COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON u.UserId = c.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE u.UserId = @UserId
    `);

  if (result.recordset.length === 0)
    throw new Error("Không tìm thấy hồ sơ người dùng");
  return result.recordset[0];
}

async function updateMyProfile(userId, data) {
  const pool = await connectDB();

  const fullName = data.fullName?.trim();
  const phone = data.phone?.trim() || null;
  const gender = data.gender?.trim() || null;
  const dateOfBirth = data.dateOfBirth || null;
  const address = data.address?.trim() || null;

  if (!fullName) throw new Error("Họ tên không được để trống");

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("FullName", sql.NVarChar, fullName)
      .input("Phone", sql.NVarChar, phone).query(`
        UPDATE Users
        SET FullName = @FullName,
            Phone = @Phone,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);

    const customerResult = await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");

    if (customerResult.recordset.length === 0) {
      await new sql.Request(transaction)
        .input("UserId", sql.Int, userId)
        .input("Gender", sql.NVarChar, gender)
        .input("DateOfBirth", sql.Date, dateOfBirth)
        .input("Address", sql.NVarChar, address).query(`
          INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
          VALUES (@UserId, @Gender, @DateOfBirth, @Address, 0, (SELECT TOP 1 MembershipLevelId FROM MembershipLevels WHERE LevelName = N'Normal'))
        `);
    } else {
      await new sql.Request(transaction)
        .input("UserId", sql.Int, userId)
        .input("Gender", sql.NVarChar, gender)
        .input("DateOfBirth", sql.Date, dateOfBirth)
        .input("Address", sql.NVarChar, address).query(`
          UPDATE Customers
          SET Gender = @Gender,
              DateOfBirth = @DateOfBirth,
              Address = @Address
          WHERE UserId = @UserId
        `);
    }

    await transaction.commit();
    return getMyProfile(userId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    if (err.message && err.message.includes("UNIQUE"))
      throw new Error("Số điện thoại đã tồn tại");
    throw err;
  }
}

async function updateMyAvatar(userId, avatarUrl) {
  const pool = await connectDB();
  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AvatarUrl", sql.NVarChar, avatarUrl).query(`
      UPDATE Users
      SET AvatarUrl = @AvatarUrl,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);
  return getMyProfile(userId);
}

async function getMyDashboard(userId) {
  const pool = await connectDB();

  // Expire temporary VIP status if it has exceeded its lifetime
  await pool.request().input("UserId", sql.Int, userId).query(`
      UPDATE c
      SET 
        c.MembershipLevelId = lv.MembershipLevelId,
        c.VIPExpiredAt = NULL
      FROM Customers c
      OUTER APPLY (
        SELECT TOP 1 MembershipLevelId
        FROM MembershipLevels
        WHERE MinPoints <= ISNULL(c.LoyaltyPoints, 0)
        ORDER BY MinPoints DESC
      ) lv
      WHERE c.UserId = @UserId
        AND c.VIPExpiredAt IS NOT NULL
        AND c.VIPExpiredAt < GETUTCDATE()
    `);

  const customerResult = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT
        c.CustomerId,
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel,
        COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent,
        ISNULL(nextLevel.LevelName, COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal')) AS NextMembershipLevel,
        ISNULL(nextLevel.MinPoints, c.LoyaltyPoints) AS NextLevelMinPoints,
        CASE
          WHEN nextLevel.MinPoints IS NULL THEN 0
          WHEN nextLevel.MinPoints - c.LoyaltyPoints < 0 THEN 0
          ELSE nextLevel.MinPoints - c.LoyaltyPoints
        END AS PointsToNextLevel
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 *
        FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      OUTER APPLY (
        SELECT TOP 1 *
        FROM MembershipLevels x
        WHERE x.MinPoints > c.LoyaltyPoints
        ORDER BY x.MinPoints ASC
      ) nextLevel
      WHERE c.UserId = @UserId
    `);

  const customer = customerResult.recordset[0];
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const summary = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("UserId", sql.Int, userId).query(`
      SELECT
        (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId) AS TotalAppointments,
        (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status IN ('PENDING_PAYMENT','PENDING','PAID','CONFIRMED','CHECKED_IN','IN_PROGRESS')) AS ActiveAppointments,
        (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status = 'COMPLETED') AS CompletedAppointments,
        (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status IN ('CANCELLED','NO_SHOW')) AS CancelledAppointments,
        (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status = 'REFUND_PENDING') AS RefundPendingAppointments,

        (SELECT COUNT(*) 
         FROM Invoices i 
         JOIN Appointments a ON i.AppointmentId = a.AppointmentId 
         WHERE a.CustomerId = @CustomerId AND i.Status = 'UNPAID') AS UnpaidInvoices,

        (SELECT ISNULL(SUM(i.FinalAmount), 0) 
         FROM Invoices i 
         JOIN Appointments a ON i.AppointmentId = a.AppointmentId 
         WHERE a.CustomerId = @CustomerId AND i.Status = 'UNPAID') AS UnpaidAmount,

        (SELECT ISNULL(SUM(p.Amount), 0) 
         FROM Payments p 
         JOIN Invoices i ON p.InvoiceId = i.InvoiceId 
         JOIN Appointments a ON i.AppointmentId = a.AppointmentId 
         WHERE a.CustomerId = @CustomerId AND p.Status = 'PAID') AS TotalPaidAmount,

        (SELECT COUNT(*) 
         FROM Payments p 
         JOIN Invoices i ON p.InvoiceId = i.InvoiceId 
         JOIN Appointments a ON i.AppointmentId = a.AppointmentId 
         WHERE a.CustomerId = @CustomerId AND p.Status = 'PAID') AS PaidPaymentCount,

        (SELECT COUNT(*) FROM CustomerPackages WHERE CustomerId = @CustomerId AND Status = 'ACTIVE') AS ActivePackages,
        (SELECT ISNULL(SUM(RemainingSessions), 0) FROM CustomerPackages WHERE CustomerId = @CustomerId AND Status = 'ACTIVE') AS RemainingPackageSessions,

        (SELECT COUNT(*) 
         FROM CustomerVouchers cv 
         JOIN Vouchers v ON cv.VoucherId = v.VoucherId 
         WHERE cv.CustomerId = @CustomerId 
           AND cv.UsedStatus = 0 
           AND v.Status = 'ACTIVE' 
           AND (v.EndDate IS NULL OR v.EndDate >= CAST(GETDATE() AS DATE))) AS AvailableVouchers,

        (SELECT COUNT(*) FROM Notifications WHERE UserId = @UserId AND IsRead = 0) AS UnreadNotifications,
        (SELECT COUNT(*) FROM Reviews WHERE CustomerId = @CustomerId) AS TotalReviews,
        (SELECT CAST(ISNULL(AVG(CAST(Rating AS DECIMAL(10,2))), 0) AS DECIMAL(10,2)) FROM Reviews WHERE CustomerId = @CustomerId) AS AverageServiceRating,
        (SELECT COUNT(*) FROM Feedbacks WHERE CustomerId = @CustomerId AND Status IN ('PENDING','PROCESSING')) AS OpenFeedbacks,
        (SELECT COUNT(*) FROM CustomerFavoriteServices WHERE UserId = @UserId) AS FavoriteServices,
        (SELECT COUNT(*) FROM CustomerFavoriteEmployees WHERE UserId = @UserId) AS FavoriteEmployees
    `);

  const upcoming = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 6
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        a.Notes,
        a.CustomerPackageId,
        b.BranchName,
        b.Address AS BranchAddress,
        e.EmployeeId,
        eu.FullName AS EmployeeName,
        COALESCE(e.ImageUrl, eu.AvatarUrl) AS EmployeeImageUrl,
        i.InvoiceId,
        i.TotalAmount,
        i.DiscountAmount,
        i.FinalAmount,
        i.Status AS InvoiceStatus,
        latestPay.Status AS PaymentStatus,
        latestPay.PaymentMethod,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
        SUM(ISNULL(s.DurationMinutes, 0)) AS TotalDurationMinutes
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 p.Status, p.PaymentMethod
        FROM Payments p
        WHERE p.InvoiceId = i.InvoiceId
        ORDER BY p.CreatedAt DESC, p.PaymentId DESC
      ) latestPay
      WHERE a.CustomerId = @CustomerId
        AND a.Status IN ('PENDING_PAYMENT','PENDING','PAID','CONFIRMED','CHECKED_IN','IN_PROGRESS')
      GROUP BY
        a.AppointmentId, a.AppointmentDate, a.StartTime, a.EndTime, a.Status, a.Notes, a.CustomerPackageId,
        b.BranchName, b.Address, e.EmployeeId, eu.FullName, e.ImageUrl, eu.AvatarUrl,
        i.InvoiceId, i.TotalAmount, i.DiscountAmount, i.FinalAmount, i.Status,
        latestPay.Status, latestPay.PaymentMethod
      ORDER BY a.AppointmentDate ASC, a.StartTime ASC
    `);

  const unpaidInvoices = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 5
        i.InvoiceId,
        i.AppointmentId,
        i.TotalAmount,
        i.DiscountAmount,
        i.FinalAmount,
        i.Status,
        i.CreatedAt,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId AND i.Status = 'UNPAID'
      GROUP BY i.InvoiceId, i.AppointmentId, i.TotalAmount, i.DiscountAmount, i.FinalAmount, i.Status, i.CreatedAt, a.AppointmentDate, a.StartTime
      ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
    `);

  const recentPayments = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 6
        p.PaymentId,
        p.InvoiceId,
        i.AppointmentId,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.TransactionCode,
        p.PaidAt,
        p.CreatedAt,
        a.AppointmentDate,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
      GROUP BY p.PaymentId, p.InvoiceId, i.AppointmentId, p.Amount, p.PaymentMethod, p.Status, p.TransactionCode, p.PaidAt, p.CreatedAt, a.AppointmentDate
      ORDER BY p.CreatedAt DESC, p.PaymentId DESC
    `);

  const activePackages = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 6
        cp.CustomerPackageId,
        cp.PackageId,
        p.PackageName,
        p.ImageUrl,
        cp.StartDate,
        cp.EndDate,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.Status,
        CASE 
          WHEN cp.TotalSessions = 0 THEN 0 
          ELSE CAST((cp.UsedSessions * 100.0 / cp.TotalSessions) AS DECIMAL(10,2)) 
        END AS UsedPercent
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerId = @CustomerId AND cp.Status = 'ACTIVE'
      ORDER BY cp.EndDate ASC, cp.CustomerPackageId DESC
    `);

  const vouchers = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 6
        v.VoucherId,
        v.Code,
        v.DiscountType,
        v.DiscountValue,
        v.MinOrderAmount,
        v.MaxDiscountAmount,
        v.StartDate,
        v.EndDate,
        cv.UsedStatus,
        cv.UsedAt
      FROM CustomerVouchers cv
      JOIN Vouchers v ON cv.VoucherId = v.VoucherId
      WHERE cv.CustomerId = @CustomerId
        AND cv.UsedStatus = 0
        AND v.Status = 'ACTIVE'
        AND (v.StartDate IS NULL OR v.StartDate <= CAST(GETDATE() AS DATE))
        AND (v.EndDate IS NULL OR v.EndDate >= CAST(GETDATE() AS DATE))
      ORDER BY v.EndDate ASC, v.VoucherId DESC
    `);

  const serviceHistory = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 6
        a.AppointmentId,
        a.AppointmentDate,
        a.Status,
        a.CompletedAt,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
        eu.FullName AS EmployeeName,
        i.FinalAmount
      FROM Appointments a
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      WHERE a.CustomerId = @CustomerId 
        AND a.Status IN ('COMPLETED','CANCELLED','NO_SHOW','REFUND_PENDING')
      GROUP BY a.AppointmentId, a.AppointmentDate, a.Status, a.CompletedAt, eu.FullName, i.FinalAmount
      ORDER BY a.AppointmentDate DESC, a.AppointmentId DESC
    `);

  const favoriteServices = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT TOP 5
        s.ServiceId,
        s.ServiceName,
        s.Price,
        s.DurationMinutes,
        s.ImageUrl,
        sc.CategoryName
      FROM CustomerFavoriteServices fs
      JOIN Services s ON fs.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
      WHERE fs.UserId = @UserId AND s.Status = 'AVAILABLE'
      ORDER BY fs.CreatedAt DESC
    `);

  const reviewable = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 5
        a.AppointmentId,
        a.AppointmentDate,
        s.ServiceId,
        s.ServiceName,
        eu.FullName AS EmployeeName
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Reviews r 
        ON r.CustomerId = a.CustomerId 
       AND r.AppointmentId = a.AppointmentId 
       AND r.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.Status = 'COMPLETED'
        AND r.ReviewId IS NULL
      ORDER BY a.AppointmentDate DESC, a.AppointmentId DESC
    `);

  const notifications = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT TOP 5 NotificationId, Title, Content, Type, IsRead, CreatedAt
      FROM Notifications
      WHERE UserId = @UserId
      ORDER BY CreatedAt DESC, NotificationId DESC
    `);

  const feedbacks = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 5 FeedbackId, Subject, Content, Status, AdminResponse, CreatedAt, UpdatedAt
      FROM Feedbacks
      WHERE CustomerId = @CustomerId
      ORDER BY CreatedAt DESC, FeedbackId DESC
    `);

  const favoriteEmployees = await pool
    .request()
    .input("UserId", sql.Int, userId).query(`
      SELECT TOP 4
        e.EmployeeId,
        u.FullName AS EmployeeName,
        COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
        e.Position,
        e.Specialization,
        e.YearsOfExperience
      FROM CustomerFavoriteEmployees fe
      JOIN Employees e ON fe.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE fe.UserId = @UserId AND e.Status = 'ACTIVE'
      ORDER BY fe.CreatedAt DESC
    `);

  return {
    Profile: customer,
    Summary: summary.recordset[0] || {},
    UpcomingAppointments: upcoming.recordset,
    UnpaidInvoices: unpaidInvoices.recordset,
    RecentPayments: recentPayments.recordset,
    ActivePackages: activePackages.recordset,
    AvailableVouchers: vouchers.recordset,
    ServiceHistory: serviceHistory.recordset,
    FavoriteServices: favoriteServices.recordset,
    FavoriteEmployees: favoriteEmployees.recordset,
    ReviewableServices: reviewable.recordset,
    Notifications: notifications.recordset,
    Feedbacks: feedbacks.recordset,

    CustomerId: customer.CustomerId,
    UserId: customer.UserId,
    FullName: customer.FullName,
    AvatarUrl: customer.AvatarUrl,
    LoyaltyPoints: customer.LoyaltyPoints,
    MembershipLevel: customer.MembershipLevel,
    DiscountPercent: customer.DiscountPercent,
    ActiveAppointments: summary.recordset[0]?.ActiveAppointments || 0,
    CompletedAppointments: summary.recordset[0]?.CompletedAppointments || 0,
    ActivePackageCount: summary.recordset[0]?.ActivePackages || 0,
    UnreadNotifications: summary.recordset[0]?.UnreadNotifications || 0,
  };
}

async function createMyFeedback(userId, data) {
  const pool = await connectDB();
  const customer = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  if (!customer.recordset[0])
    throw new Error("Không tìm thấy hồ sơ khách hàng");
  const subject = String(data.subject || "").trim();
  const content = String(data.content || "").trim();
  if (!subject || !content)
    throw new Error("Vui lòng nhập tiêu đề và nội dung phản hồi");
  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customer.recordset[0].CustomerId)
    .input("Subject", sql.NVarChar, subject)
    .input("Content", sql.NVarChar, content).query(`
      INSERT INTO Feedbacks (CustomerId, Subject, Content)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @Subject, @Content)
    `);
  return result.recordset[0];
}

async function getMyFeedbacks(userId) {
  const pool = await connectDB();
  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT f.*
    FROM Feedbacks f
    JOIN Customers c ON f.CustomerId = c.CustomerId
    WHERE c.UserId = @UserId
    ORDER BY f.CreatedAt DESC
  `);
  return result.recordset;
}

async function createMyReview(userId, data, files = []) {
  const pool = await connectDB();

  const customer = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT CustomerId
    FROM Customers
    WHERE UserId = @UserId
  `);

  if (!customer.recordset[0]) {
    throw new Error("Không tìm thấy hồ sơ khách hàng");
  }

  const customerId = customer.recordset[0].CustomerId;
  const appointmentId = Number(data.appointmentId || data.AppointmentId);
  const serviceId = Number(data.serviceId || data.ServiceId);

  const serviceRating = Number(
    data.serviceRating || data.ServiceRating || data.rating || data.Rating,
  );

  const technicianRating = Number(
    data.technicianRating ||
      data.TechnicianRating ||
      data.serviceRating ||
      data.rating ||
      5,
  );

  const comment = String(data.comment || data.Comment || "").trim();

  if (!appointmentId) {
    throw new Error("Vui lòng chọn lịch hẹn cần đánh giá");
  }

  if (!serviceId) {
    throw new Error("Vui lòng chọn dịch vụ cần đánh giá");
  }

  if (!serviceRating || serviceRating < 1 || serviceRating > 5) {
    throw new Error("Vui lòng đánh giá dịch vụ từ 1 đến 5 sao");
  }

  if (!technicianRating || technicianRating < 1 || technicianRating > 5) {
    throw new Error("Vui lòng đánh giá kỹ thuật viên từ 1 đến 5 sao");
  }

  if (!comment || comment.length < 5) {
    throw new Error("Vui lòng nhập nội dung đánh giá ít nhất 5 ký tự");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const serviceCheck = await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customerId)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("ServiceId", sql.Int, serviceId).query(`
        SELECT TOP 1
          a.AppointmentId,
          a.Status,
          a.EmployeeId,
          aps.ServiceId,
          s.ServiceName
        FROM Appointments a
        JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE a.AppointmentId = @AppointmentId
          AND a.CustomerId = @CustomerId
          AND aps.ServiceId = @ServiceId
      `);

    const item = serviceCheck.recordset[0];

    if (!item) {
      throw new Error("Dịch vụ này không thuộc lịch hẹn của bạn");
    }

    if (String(item.Status || "").toUpperCase() !== "COMPLETED") {
      throw new Error("Chỉ được đánh giá sau khi lịch hẹn đã hoàn thành");
    }

    const existed = await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customerId)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("ServiceId", sql.Int, serviceId).query(`
        SELECT TOP 1 ReviewId
        FROM Reviews
        WHERE CustomerId = @CustomerId
          AND AppointmentId = @AppointmentId
          AND ServiceId = @ServiceId
      `);

    if (existed.recordset[0]) {
      throw new Error("Bạn đã đánh giá dịch vụ này rồi");
    }

    const result = await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customerId)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("ServiceId", sql.Int, serviceId)
      .input("EmployeeId", sql.Int, item.EmployeeId || null)
      .input("Rating", sql.Int, serviceRating)
      .input("TechnicianRating", sql.Int, technicianRating)
      .input("Comment", sql.NVarChar(sql.MAX), comment).query(`
        INSERT INTO Reviews
          (CustomerId, AppointmentId, ServiceId, EmployeeId, Rating, TechnicianRating, Comment, Status)
        OUTPUT INSERTED.*
        VALUES
          (@CustomerId, @AppointmentId, @ServiceId, @EmployeeId, @Rating, @TechnicianRating, @Comment, 'APPROVED')
      `);

    const review = result.recordset[0];
    const validImages = (files || [])
      .filter((file) => file && file.filename)
      .slice(0, 6);

    for (const file of validImages) {
      await new sql.Request(transaction)
        .input("ReviewId", sql.Int, review.ReviewId)
        .input(
          "ImageUrl",
          sql.NVarChar(255),
          `/uploads/reviews/${file.filename}`,
        ).query(`
          INSERT INTO ReviewImages (ReviewId, ImageUrl)
          VALUES (@ReviewId, @ImageUrl)
        `);
    }

    await transaction.commit();

    return {
      ...review,
      Images: validImages.map((file) => ({
        ImageUrl: `/uploads/reviews/${file.filename}`,
      })),
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }
}

async function getMyReviews(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT
      r.ReviewId,
      r.CustomerId,
      r.AppointmentId,
      r.ServiceId,
      r.EmployeeId,
      r.Rating,
      r.TechnicianRating,
      r.Comment,
      r.Status,
      r.AdminResponse,
      r.CreatedAt,
      r.UpdatedAt,

      s.ServiceName,
      s.Description AS ServiceDescription,
      s.DurationMinutes,
      s.Price,
      s.ImageUrl AS ServiceImageUrl,

      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,

      cp.CustomerPackageId,
      pkg.PackageName,
      pkg.ImageUrl AS PackageImageUrl,

      eu.FullName AS EmployeeName,
      e.Position AS EmployeePosition,
      e.Specialization AS EmployeeSpecialization,
      COALESCE(e.ImageUrl, eu.AvatarUrl) AS EmployeeImageUrl,

      (
        SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
        FROM ReviewImages ri
        WHERE ri.ReviewId = r.ReviewId
        ORDER BY ri.ReviewImageId ASC
        FOR JSON PATH
      ) AS ImagesJson
    FROM Reviews r
    JOIN Customers c ON r.CustomerId = c.CustomerId
    LEFT JOIN Services s ON r.ServiceId = s.ServiceId
    LEFT JOIN Appointments a ON r.AppointmentId = a.AppointmentId
    LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
    LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId
    LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
    LEFT JOIN Users eu ON e.UserId = eu.UserId
    WHERE c.UserId = @UserId
    ORDER BY r.CreatedAt DESC
  `);

  return result.recordset.map((row) => ({
    ...row,
    Images: row.ImagesJson ? JSON.parse(row.ImagesJson) : [],
  }));
}

async function getMyServiceHistory(userId) {
  const pool = await connectDB();

  const customerResult = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT CustomerId
      FROM Customers
      WHERE UserId = @UserId
    `);

  const customer = customerResult.recordset[0];

  if (!customer) {
    throw new Error("Không tìm thấy hồ sơ khách hàng");
  }

  const customerId = customer.CustomerId;

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("UserId", sql.Int, userId).query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        a.Notes,
        a.CompletedAt,
        a.CreatedAt,

        aps.AppointmentServiceId,
        aps.ServiceId,
        aps.Price AS Price,
        s.Price AS ServicePrice,

        s.ServiceName,
        s.Description AS ServiceDescription,
        CONVERT(VARCHAR(5), aps.StartTime, 108) AS StepStartTime,
        CONVERT(VARCHAR(5), aps.EndTime, 108) AS StepEndTime,
        aps.EmployeeId AS StepEmployeeId,
        COALESCE(eu_step.FullName, eu.FullName) AS StepTechnicianName,
        COALESCE(e_step.ImageUrl, e.ImageUrl) AS StepTechnicianAvatar,

        s.DurationMinutes,
        s.ImageUrl AS ServiceImageUrl,
        sc.CategoryId,
        sc.CategoryName,

        a.EmployeeId,
        eu.FullName AS EmployeeName,
        e.Position,
        e.Specialization,
        e.ImageUrl AS EmployeeImageUrl,

        b.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        b.Phone AS BranchPhone,

        i.InvoiceId,
        i.TotalAmount,
        i.DiscountAmount,
        i.FinalAmount,
        i.Status AS InvoiceStatus,

        v.VoucherId,
        v.Code AS VoucherCode,

        cp.CustomerPackageId,
        pkg.PackageName,
        pkg.ImageUrl AS PackageImageUrl,

        p.PaymentId,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
        p.PaymentMethod,
        p.TransactionCode,
        p.PaidAt,

        rv.ReviewId,
        rv.Rating,
        rv.TechnicianRating,
        rv.Comment AS ReviewComment,
        rv.Status AS ReviewStatus,
        rv.AdminResponse,
        rv.CreatedAt AS ReviewedAt,
        rv.ImagesJson,

        CASE
          WHEN fs.ServiceId IS NULL THEN 0
          ELSE 1
        END AS IsFavoriteService,

        CASE
          WHEN fe.EmployeeId IS NULL THEN 0
          ELSE 1
        END AS IsFavoriteEmployee

      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId

      LEFT JOIN Employees e_step ON aps.EmployeeId = e_step.EmployeeId
      LEFT JOIN Users eu_step ON e_step.UserId = eu_step.UserId

      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId

      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Vouchers v ON i.VoucherId = v.VoucherId
      LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId

      LEFT JOIN CustomerFavoriteServices fs
        ON fs.UserId = @UserId
       AND fs.ServiceId = aps.ServiceId

      LEFT JOIN CustomerFavoriteEmployees fe
        ON fe.UserId = @UserId
       AND fe.EmployeeId = a.EmployeeId

      OUTER APPLY (
        SELECT TOP 1
          p2.PaymentId,
          p2.Status,
          p2.PaymentMethod,
          p2.TransactionCode,
          p2.PaidAt
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY
          CASE
            WHEN p2.Status = 'PAID' THEN 1
            WHEN p2.Status = 'REFUND_PENDING' THEN 2
            WHEN p2.Status = 'REFUNDED' THEN 3
            WHEN p2.Status = 'PENDING' THEN 4
            WHEN p2.Status = 'FAILED' THEN 5
            ELSE 6
          END,
          p2.PaymentId DESC
      ) p

      OUTER APPLY (
        SELECT TOP 1
          r.ReviewId,
          r.Rating,
          r.TechnicianRating,
          r.Comment,
          r.Status,
          r.AdminResponse,
          r.CreatedAt,
          (
            SELECT
              ri.ReviewImageId,
              ri.ImageUrl,
              ri.CreatedAt
            FROM ReviewImages ri
            WHERE ri.ReviewId = r.ReviewId
            ORDER BY ri.ReviewImageId ASC
            FOR JSON PATH
          ) AS ImagesJson
        FROM Reviews r
        WHERE r.CustomerId = @CustomerId
          AND r.AppointmentId = a.AppointmentId
          AND r.ServiceId = aps.ServiceId
        ORDER BY r.CreatedAt DESC
      ) rv

      WHERE a.CustomerId = @CustomerId
        AND a.Status = 'COMPLETED'

      ORDER BY a.AppointmentDate DESC, a.StartTime DESC, a.AppointmentId DESC
    `);

  const items = result.recordset.map((row) => ({
    ...row,
    Images: row.ImagesJson ? JSON.parse(row.ImagesJson) : [],
  }));

  const serviceMap = new Map();
  const technicianMap = new Map();
  const categoryMap = new Map();
  const monthMap = new Map();

  const appointmentSpentRes = await pool
    .request()
    .input("CustomerId", sql.Int, customerId).query(`
      SELECT SUM(i.FinalAmount) AS AppointmentSpent
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId AND i.Status = 'PAID'
    `);

  const packageSpentRes = await pool
    .request()
    .input("CustomerId", sql.Int, customerId).query(`
      SELECT SUM(pp.Amount) AS PackageSpent
      FROM PackagePayments pp
      JOIN CustomerPackages cp ON pp.CustomerPackageId = cp.CustomerPackageId
      WHERE cp.CustomerId = @CustomerId AND pp.Status = 'PAID'
    `);

  const appSum = appointmentSpentRes.recordset[0]?.AppointmentSpent || 0;
  const pkgSum = packageSpentRes.recordset[0]?.PackageSpent || 0;
  const totalSpent = appSum + pkgSum;

  let reviewedCount = 0;
  let totalRating = 0;
  let totalDuration = 0;

  for (const item of items) {
    const amount = Number(item.Price || 0);
    totalDuration += Number(item.DurationMinutes || 0);

    if (item.ReviewId) {
      reviewedCount += 1;
      totalRating += Number(item.Rating || 0);
    }

    const serviceKey = String(item.ServiceId);
    const serviceValue = serviceMap.get(serviceKey) || {
      ServiceId: item.ServiceId,
      ServiceName: item.ServiceName,
      CategoryName: item.CategoryName,
      ImageUrl: item.ServiceImageUrl,
      usageCount: 0,
      totalSpent: 0,
      lastUsedAt: item.AppointmentDate,
    };

    serviceValue.usageCount += 1;
    serviceValue.totalSpent += amount;
    serviceMap.set(serviceKey, serviceValue);

    const techKey = String(item.EmployeeId);
    const techValue = technicianMap.get(techKey) || {
      EmployeeId: item.EmployeeId,
      EmployeeName: item.EmployeeName,
      ImageUrl: item.EmployeeImageUrl,
      Specialization: item.Specialization,
      usageCount: 0,
    };

    techValue.usageCount += 1;
    technicianMap.set(techKey, techValue);

    const categoryKey = item.CategoryName || "Khác";
    const categoryValue = categoryMap.get(categoryKey) || {
      CategoryName: categoryKey,
      usageCount: 0,
      totalSpent: 0,
    };

    categoryValue.usageCount += 1;
    categoryValue.totalSpent += amount;
    categoryMap.set(categoryKey, categoryValue);

    const monthKey = String(item.AppointmentDate || "").slice(0, 7);
    const monthValue = monthMap.get(monthKey) || {
      month: monthKey,
      usageCount: 0,
      totalSpent: 0,
    };

    monthValue.usageCount += 1;
    monthValue.totalSpent += amount;
    monthMap.set(monthKey, monthValue);
  }

  const favoriteService =
    Array.from(serviceMap.values()).sort(
      (a, b) => b.usageCount - a.usageCount || b.totalSpent - a.totalSpent,
    )[0] || null;

  const favoriteTechnician =
    Array.from(technicianMap.values()).sort(
      (a, b) => b.usageCount - a.usageCount,
    )[0] || null;

  return {
    items,
    stats: {
      totalServicesUsed: items.length,
      totalSpent,
      reviewedCount,
      notReviewedCount: items.length - reviewedCount,
      averageRating: reviewedCount
        ? Number((totalRating / reviewedCount).toFixed(1))
        : 0,
      totalDuration,
      favoriteService,
      favoriteTechnician,
    },
    summary: Array.from(serviceMap.values()).sort(
      (a, b) => b.usageCount - a.usageCount,
    ),
    technicianSummary: Array.from(technicianMap.values()).sort(
      (a, b) => b.usageCount - a.usageCount,
    ),
    categorySummary: Array.from(categoryMap.values()).sort(
      (a, b) => b.usageCount - a.usageCount,
    ),
    monthlySummary: Array.from(monthMap.values()).sort((a, b) =>
      b.month.localeCompare(a.month),
    ),
  };
}

async function getMyFavoriteServices(userId) {
  const pool = await connectDB();
  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT fs.UserId, fs.ServiceId, fs.CreatedAt, s.ServiceName, s.Description, s.Price, s.DurationMinutes, s.ImageUrl, c.CategoryName
    FROM CustomerFavoriteServices fs
    JOIN Services s ON fs.ServiceId = s.ServiceId
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE fs.UserId = @UserId
    ORDER BY fs.CreatedAt DESC
  `);
  return result.recordset;
}

async function getMyFavorites(userId) {
  const [services, employees] = await Promise.all([
    getMyFavoriteServices(userId),
    getMyFavoriteEmployees(userId),
  ]);
  return { services, employees };
}

async function getMyFavoriteEmployees(userId) {
  const pool = await connectDB();
  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT fe.UserId, fe.EmployeeId, fe.CreatedAt, e.Position, e.Specialization, e.ImageUrl, u.FullName, b.BranchName
    FROM CustomerFavoriteEmployees fe
    JOIN Employees e ON fe.EmployeeId = e.EmployeeId
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    WHERE fe.UserId = @UserId
    ORDER BY fe.CreatedAt DESC
  `);
  return result.recordset;
}

async function toggleFavoriteService(userId, serviceId) {
  const pool = await connectDB();
  const existing = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("ServiceId", sql.Int, serviceId).query(`
    SELECT TOP 1 1 AS ExistsFlag FROM CustomerFavoriteServices WHERE UserId = @UserId AND ServiceId = @ServiceId
  `);

  if (existing.recordset[0]) {
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ServiceId", sql.Int, serviceId).query(`
      DELETE FROM CustomerFavoriteServices WHERE UserId = @UserId AND ServiceId = @ServiceId
    `);
    return { favorited: false };
  }

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("ServiceId", sql.Int, serviceId).query(`
    INSERT INTO CustomerFavoriteServices (UserId, ServiceId)
    VALUES (@UserId, @ServiceId)
  `);
  return { favorited: true };
}

async function toggleFavoriteEmployee(userId, employeeId) {
  const pool = await connectDB();
  const existing = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("EmployeeId", sql.Int, employeeId).query(`
    SELECT TOP 1 1 AS ExistsFlag FROM CustomerFavoriteEmployees WHERE UserId = @UserId AND EmployeeId = @EmployeeId
  `);

  if (existing.recordset[0]) {
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("EmployeeId", sql.Int, employeeId).query(`
      DELETE FROM CustomerFavoriteEmployees WHERE UserId = @UserId AND EmployeeId = @EmployeeId
    `);
    return { favorited: false };
  }

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("EmployeeId", sql.Int, employeeId).query(`
    INSERT INTO CustomerFavoriteEmployees (UserId, EmployeeId)
    VALUES (@UserId, @EmployeeId)
  `);
  return { favorited: true };
}

async function getMyReviewableServices(userId) {
  const pool = await connectDB();

  const customer = await pool.request().input("UserId", sql.Int, userId).query(`
      SELECT CustomerId
      FROM Customers
      WHERE UserId = @UserId
    `);

  if (!customer.recordset[0]) {
    throw new Error("Không tìm thấy hồ sơ khách hàng");
  }

  const customerId = customer.recordset[0].CustomerId;

  const result = await pool.request().input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        aps.ServiceId,
        s.ServiceName,
        s.Description AS ServiceDescription,
        s.ImageUrl AS ServiceImageUrl,
        aps.Price,
        a.EmployeeId,
        eu.FullName AS EmployeeName,
        cp.CustomerPackageId,
        pkg.PackageName,
        pkg.ImageUrl AS PackageImageUrl
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId
      LEFT JOIN Reviews r
        ON r.CustomerId = a.CustomerId
       AND r.AppointmentId = a.AppointmentId
       AND r.ServiceId = aps.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.Status = 'COMPLETED'
        AND r.ReviewId IS NULL
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);

  return result.recordset;
}

async function createGuestContact(data) {
  const pool = await connectDB();
  const fullName = String(data.fullName || data.name || "").trim();
  const email = String(data.email || "").trim();
  const phone = String(data.phone || "").trim();
  const subject = String(data.subject || "Liên hệ từ khách").trim();
  const content = String(data.content || data.message || "").trim();

  if (!fullName || !content)
    throw new Error("Vui lòng nhập họ tên và nội dung liên hệ");

  const detail = [
    fullName ? `Họ tên: ${fullName}` : "",
    email ? `Email: ${email}` : "",
    phone ? `SĐT: ${phone}` : "",
    "",
    content,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await pool
    .request()
    .input("Subject", sql.NVarChar, subject)
    .input("Content", sql.NVarChar, detail).query(`
      INSERT INTO Feedbacks (CustomerId, Subject, Content)
      OUTPUT INSERTED.*
      VALUES (NULL, @Subject, @Content)
    `);
  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input("UserId", sql.Int, data.userId)
    .input("Gender", sql.NVarChar, data.gender || null)
    .input("DateOfBirth", sql.Date, data.dateOfBirth || null)
    .input("Address", sql.NVarChar, data.address || null).query(`
      INSERT INTO Customers (UserId, Gender, DateOfBirth, Address)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Gender, @DateOfBirth, @Address)
    `);
  return result.recordset[0];
}

async function update(id, data) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .input("Gender", sql.NVarChar, data.gender || null)
    .input("DateOfBirth", sql.Date, data.dateOfBirth || null)
    .input("Address", sql.NVarChar, data.address || null).query(`
      UPDATE Customers
      SET Gender = @Gender,
          DateOfBirth = @DateOfBirth,
          Address = @Address
      OUTPUT INSERTED.*
      WHERE CustomerId = @CustomerId
    `);

  if (result.recordset.length === 0)
    throw new Error("Không tìm thấy khách hàng");
  return result.recordset[0];
}

async function remove(id) {
  const pool = await connectDB();
  await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .query("DELETE FROM Customers WHERE CustomerId = @CustomerId");
  return { id };
}

async function getPublicReviews() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT TOP 10
      r.ReviewId,
      r.Rating,
      r.Comment,
      r.CreatedAt,
      COALESCE(cu.FullName, N'Khách hàng ẩn danh') AS CustomerName,
      COALESCE(s.ServiceName, N'Dịch vụ tổng hợp') AS ServiceName
    FROM Reviews r
    LEFT JOIN Customers c ON r.CustomerId = c.CustomerId
    LEFT JOIN Users cu ON c.UserId = cu.UserId
    LEFT JOIN Services s ON r.ServiceId = s.ServiceId
    WHERE r.Rating = 5 
      AND r.Comment IS NOT NULL 
      AND LEN(LTRIM(RTRIM(r.Comment))) > 0
    ORDER BY r.CreatedAt DESC
  `);
  return result.recordset;
}

module.exports = {
  getPublicReviews,
  getAll,
  getById,
  getMyProfile,
  getMyDashboard,
  createMyFeedback,
  getMyFeedbacks,
  createMyReview,
  getMyReviews,
  getMyReviewableServices,
  getMyServiceHistory, // thêm dòng này
  getMyFavorites,
  getMyFavoriteServices,
  getMyFavoriteEmployees,
  toggleFavoriteService,
  toggleFavoriteEmployee,
  updateMyProfile,
  updateMyAvatar,
  createGuestContact,
  create,
  update,
  remove,
};
