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
  const customerResult = await pool.request().input("UserId", sql.Int, userId)
    .query(`
    SELECT
      c.CustomerId,
      c.LoyaltyPoints,
      COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel,
      COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent
    FROM Customers c
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    WHERE c.UserId = @UserId
  `);
  const customer = customerResult.recordset[0];
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const counts = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("UserId", sql.Int, userId).query(`
    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'IN_PROGRESS')) AS ActiveAppointments,
      (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status = 'COMPLETED') AS CompletedAppointments,
      (SELECT COUNT(*) FROM CustomerPackages WHERE CustomerId = @CustomerId AND Status = 'ACTIVE') AS ActivePackages,
      (SELECT COUNT(*) FROM Notifications n JOIN Users u ON n.UserId = u.UserId WHERE u.UserId = @UserId AND n.IsRead = 0) AS UnreadNotifications
  `);

  const upcoming = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
    SELECT TOP 3
      a.AppointmentId, a.AppointmentDate, CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      a.Status, eu.FullName AS EmployeeName, STRING_AGG(s.ServiceName, N', ') AS ServiceNames
    FROM Appointments a
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.CustomerId = @CustomerId AND a.Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'IN_PROGRESS')
    GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.Status, eu.FullName
    ORDER BY a.AppointmentDate ASC, a.StartTime ASC
  `);

  return {
    ...customer,
    ...counts.recordset[0],
    UpcomingAppointments: upcoming.recordset,
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
        FROM Reviews WITH (UPDLOCK, HOLDLOCK)
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
    SELECT r.*, s.ServiceName,
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
      a.StartTime,
      a.EndTime,
      a.Status,
      a.EmployeeId,
      a.CancelReason,
      aps.ServiceId,
      s.ServiceName,
      aps.Price,
      ISNULL(i.FinalAmount, aps.Price) AS FinalAmount,
      eu.FullName AS EmployeeName,
      ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
      ISNULL(rv.ReviewCount, 0) AS ReviewCount,
      ISNULL(rv.Rating, 0) AS Rating,
      ISNULL(rv.Comment, '') AS ReviewComment,
      ISNULL(rv.ReviewId, 0) AS ReviewId,
      rv.ReviewedAt,
      rv.ImagesJson
    FROM Appointments a
    JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    JOIN Services s ON aps.ServiceId = s.ServiceId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    OUTER APPLY (
      SELECT TOP 1
        p2.Status,
        p2.PaidAt
      FROM Payments p2
      WHERE p2.InvoiceId = i.InvoiceId
      ORDER BY CASE WHEN p2.Status = 'PAID' THEN 1 ELSE 2 END, p2.PaymentId DESC
    ) p
    OUTER APPLY (
      SELECT TOP 1
        r.ReviewId,
        r.Rating,
        r.Comment,
        r.CreatedAt AS ReviewedAt,
        COUNT(*) OVER() AS ReviewCount,
        (
          SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
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
    ORDER BY a.AppointmentDate DESC, a.StartTime DESC
  `);

  const rows = result.recordset;
  const summaryMap = new Map();
  for (const row of rows) {
    const key = String(row.ServiceId);
    const current = summaryMap.get(key) || {
      ServiceId: row.ServiceId,
      ServiceName: row.ServiceName,
      usageCount: 0,
      totalSpent: 0,
    };
    current.usageCount += 1;
    current.totalSpent += Number(row.FinalAmount || row.Price || 0);
    summaryMap.set(key, current);
  }

  return {
    items: rows.map((row) => ({
      ...row,
      Images: row.ImagesJson ? JSON.parse(row.ImagesJson) : [],
    })),
    summary: Array.from(summaryMap.values()),
    totalSpent: rows.reduce(
      (sum, row) => sum + Number(row.FinalAmount || row.Price || 0),
      0,
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
        aps.Price,
        a.EmployeeId,
        eu.FullName AS EmployeeName
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
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

module.exports = {
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
