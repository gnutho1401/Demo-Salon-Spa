const { sql, connectDB } = require("../../config/db");

async function getTechnicianByUserId(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT 
      e.EmployeeId,
      e.Position,
      e.Specialization,
      e.ImageUrl,
      u.FullName,
      u.Email,
      u.AvatarUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.UserId = @UserId
  `);

  if (!result.recordset[0]) {
    throw new Error("Không tìm thấy hồ sơ kỹ thuật viên");
  }

  return result.recordset[0];
}

async function getEmployeeIdByUserId(userId) {
  const tech = await getTechnicianByUserId(userId);
  return tech.EmployeeId;
}

async function getDashboard(userId) {
  const pool = await connectDB();
  const tech = await getTechnicianByUserId(userId);
  const employeeId = tech.EmployeeId;

  const stats = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = @Today) AS todayAppointments,
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = @Today AND Status = 'IN_PROGRESS') AS inProgress,
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = @Today AND Status = 'COMPLETED') AS completed,

      (SELECT ISNULL(SUM(i.FinalAmount), 0)
       FROM Appointments a
       JOIN Invoices i ON a.AppointmentId = i.AppointmentId
       JOIN Payments p ON i.InvoiceId = p.InvoiceId
       WHERE a.EmployeeId = @EmployeeId
       AND a.AppointmentDate = @Today
       AND p.Status = 'PAID') AS todayRevenue,

      (SELECT ISNULL(AVG(CAST(r.Rating AS FLOAT)), 0)
       FROM Reviews r
       WHERE r.EmployeeId = @EmployeeId AND r.Status = 'APPROVED') AS averageRating,

      (SELECT COUNT(*)
       FROM Reviews r
       WHERE r.EmployeeId = @EmployeeId AND r.Status = 'APPROVED') AS reviewCount
  `);

  const todaySchedule = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
    SELECT 
      a.AppointmentId,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status,
      u.FullName AS CustomerName,
      STRING_AGG(s.ServiceName, ', ') AS ServiceName
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.EmployeeId = @EmployeeId
    AND a.AppointmentDate = CAST(GETDATE() AS DATE)
    GROUP BY a.AppointmentId, a.StartTime, a.EndTime, a.Status, u.FullName
    ORDER BY a.StartTime
  `);

  const appointmentStatus = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
    SELECT Status, COUNT(*) AS Total
    FROM Appointments
    WHERE EmployeeId = @EmployeeId
    AND AppointmentDate = CAST(GETDATE() AS DATE)
    GROUP BY Status
  `);

  const earnings = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
    SELECT 
      FORMAT(a.AppointmentDate, 'ddd') AS DayName,
      ISNULL(SUM(i.FinalAmount), 0) AS Revenue
    FROM Appointments a
    JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    JOIN Payments p ON i.InvoiceId = p.InvoiceId
    WHERE a.EmployeeId = @EmployeeId
    AND p.Status = 'PAID'
    AND a.AppointmentDate >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
    GROUP BY a.AppointmentDate
    ORDER BY a.AppointmentDate
  `);

  const popularServices = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
    SELECT TOP 5
      s.ServiceName,
      COUNT(*) AS Total
    FROM Appointments a
    JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.EmployeeId = @EmployeeId
    GROUP BY s.ServiceName
    ORDER BY Total DESC
  `);

  const recentReviews = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
    SELECT TOP 5
      r.Rating,
      r.Comment,
      r.CreatedAt,
      u.FullName AS CustomerName
    FROM Reviews r
    JOIN Customers c ON r.CustomerId = c.CustomerId
    JOIN Users u ON c.UserId = u.UserId
    WHERE r.EmployeeId = @EmployeeId
    AND r.Status = 'APPROVED'
    ORDER BY r.CreatedAt DESC
  `);

  const reminders = await pool.request().input("UserId", sql.Int, userId)
    .query(`
    SELECT TOP 3
      Title,
      Content,
      Type,
      CreatedAt
    FROM Notifications
    WHERE UserId = @UserId
    ORDER BY CreatedAt DESC
  `);

  return {
    technician: tech,
    stats: stats.recordset[0],
    todaySchedule: todaySchedule.recordset,
    appointmentStatus: appointmentStatus.recordset,
    earnings: earnings.recordset,
    popularServices: popularServices.recordset,
    recentReviews: recentReviews.recordset,
    reminders: reminders.recordset,
  };
}

async function getSchedule(userId, query) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const search = query.search ? `%${query.search.trim()}%` : "%%";
  const startDate = query.startDate || new Date().toISOString().slice(0, 10);
  const endDate = query.endDate || startDate;
  const status = query.status || "ALL";
  const serviceId = query.serviceId ? Number(query.serviceId) : null;

  const appointments = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate)
    .input("Status", sql.NVarChar, status)
    .input("ServiceId", sql.Int, serviceId)
    .input("Search", sql.NVarChar, search).query(`
      SELECT
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS DurationMinutes,
        a.Status,
        a.Notes,
        a.CheckedInAt,
        a.CompletedAt,

        c.CustomerId,
        u.FullName AS CustomerName,
        u.Phone AS CustomerPhone,
        u.Email AS CustomerEmail,
        u.AvatarUrl AS CustomerAvatar,

        STRING_AGG(s.ServiceName, ', ') AS ServiceName,
        SUM(ISNULL(aps.Price, 0)) AS TotalPrice,

        MAX(i.FinalAmount) AS FinalAmount,
        MAX(latestPayment.Status) AS PaymentStatus,

        ISNULL(r.ResourceName, N'Chưa có phòng') AS RoomName
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN ServiceResources r ON a.ResourceId = r.ResourceId
      OUTER APPLY (
        SELECT TOP 1 p2.Status
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
      ) latestPayment
      WHERE a.EmployeeId = @EmployeeId
        AND a.AppointmentDate BETWEEN @StartDate AND @EndDate
        AND (@Status = 'ALL' OR a.Status = @Status)
        AND (
          @ServiceId IS NULL
          OR EXISTS (
            SELECT 1
            FROM AppointmentServices aps2
            WHERE aps2.AppointmentId = a.AppointmentId
              AND aps2.ServiceId = @ServiceId
          )
        )
        AND (
          u.FullName LIKE @Search
          OR u.Phone LIKE @Search
          OR u.Email LIKE @Search
          OR EXISTS (
            SELECT 1
            FROM AppointmentServices aps3
            JOIN Services s3 ON aps3.ServiceId = s3.ServiceId
            WHERE aps3.AppointmentId = a.AppointmentId
              AND s3.ServiceName LIKE @Search
          )
          OR CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) LIKE @Search
        )
      GROUP BY
        a.AppointmentId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        a.Notes,
        a.CheckedInAt,
        a.CompletedAt,
        c.CustomerId,
        u.FullName,
        u.Phone,
        u.Email,
        u.AvatarUrl,
        r.ResourceName
      ORDER BY a.AppointmentDate, a.StartTime;
    `);

  const services = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT DISTINCT s.ServiceId, s.ServiceName
      FROM EmployeeServices es
      JOIN Services s ON es.ServiceId = s.ServiceId
      WHERE es.EmployeeId = @EmployeeId
      ORDER BY s.ServiceName;
    `);

  const shifts = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
      SELECT
        ShiftId,
        EmployeeId,
        ShiftDate,
        CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), EndTime, 108) AS EndTime,
        ShiftType,
        IsDayOff,
        Notes
      FROM WorkShifts
      WHERE EmployeeId = @EmployeeId
        AND ShiftDate BETWEEN @StartDate AND @EndDate
      ORDER BY ShiftDate, StartTime;
    `);

  const summary = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate)
    .input("Status", sql.NVarChar, status)
    .input("ServiceId", sql.Int, serviceId)
    .input("Search", sql.NVarChar, search).query(`
    SELECT
      COUNT(DISTINCT a.AppointmentId) AS totalAppointments,
      COUNT(DISTINCT CASE WHEN a.Status = 'CONFIRMED' THEN a.AppointmentId END) AS confirmed,
      COUNT(DISTINCT CASE WHEN a.Status = 'PAID' THEN a.AppointmentId END) AS paid,
      COUNT(DISTINCT CASE WHEN a.Status = 'IN_PROGRESS' THEN a.AppointmentId END) AS inProgress,
      COUNT(DISTINCT CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentId END) AS completed,
      COUNT(DISTINCT CASE WHEN a.Status = 'NO_SHOW' THEN a.AppointmentId END) AS noShow,
      ISNULL(SUM(CASE WHEN latestPayment.Status = 'PAID' THEN i.FinalAmount ELSE 0 END), 0) AS revenue
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    OUTER APPLY (
      SELECT TOP 1 p2.Status
      FROM Payments p2
      WHERE p2.InvoiceId = i.InvoiceId
      ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
    ) latestPayment
    WHERE a.EmployeeId = @EmployeeId
      AND a.AppointmentDate BETWEEN @StartDate AND @EndDate
      AND (@Status = 'ALL' OR a.Status = @Status)
      AND (
        @ServiceId IS NULL
        OR EXISTS (
          SELECT 1
          FROM AppointmentServices aps2
          WHERE aps2.AppointmentId = a.AppointmentId
            AND aps2.ServiceId = @ServiceId
        )
      )
      AND (
        u.FullName LIKE @Search
        OR u.Phone LIKE @Search
        OR u.Email LIKE @Search
        OR EXISTS (
          SELECT 1
          FROM AppointmentServices aps3
          JOIN Services s3 ON aps3.ServiceId = s3.ServiceId
          WHERE aps3.AppointmentId = a.AppointmentId
            AND s3.ServiceName LIKE @Search
        )
        OR CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) LIKE @Search
      );
  `);

  return {
    appointments: appointments.recordset,
    services: services.recordset,
    shifts: shifts.recordset,
    summary: summary.recordset[0] || {},
  };
}

async function startAppointment(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("UserId", sql.Int, userId).query(`
      DECLARE @OldStatus NVARCHAR(30);

      SELECT @OldStatus = Status
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;

      IF @OldStatus IS NULL
        THROW 50001, N'Không tìm thấy lịch hẹn của kỹ thuật viên này', 1;

      IF @OldStatus NOT IN ('CHECKED_IN', 'CONFIRMED', 'PAID')
        THROW 50002, N'Chỉ được bắt đầu lịch đã check-in hoặc đã xác nhận', 1;

      IF NOT EXISTS (
        SELECT 1
        FROM Appointments
        WHERE AppointmentId = @AppointmentId
          AND EmployeeId = @EmployeeId
          AND AppointmentDate = CAST(GETDATE() AS DATE)
          AND StartTime <= CAST(GETDATE() AS TIME)
      )
        THROW 50003, N'Chỉ được bắt đầu lịch trong ngày và đã đến giờ làm dịch vụ', 1;

      UPDATE Appointments
      SET Status = 'IN_PROGRESS',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
        AND Status IN ('CHECKED_IN', 'CONFIRMED', 'PAID')
      INSERT INTO AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
      VALUES
        (@AppointmentId, @OldStatus, 'IN_PROGRESS', @UserId, N'Technician bắt đầu dịch vụ', GETDATE());

      SELECT *
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;
    `);

  return result.recordset[0];
}

async function completeAppointment(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("UserId", sql.Int, userId).query(`
      DECLARE @OldStatus NVARCHAR(30);

      SELECT @OldStatus = Status
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;

      IF @OldStatus IS NULL
        THROW 50001, N'Không tìm thấy lịch hẹn của kỹ thuật viên này', 1;

      IF @OldStatus <> 'IN_PROGRESS'
        THROW 50002, N'Chỉ lịch đang thực hiện mới được hoàn thành', 1;

      UPDATE Appointments
      SET Status = 'COMPLETED',
          CompletedAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
        AND Status = 'IN_PROGRESS';

      INSERT INTO AppointmentStatusHistory
      (
        AppointmentId,
        OldStatus,
        NewStatus,
        ChangedBy,
        Reason,
        ChangedAt
      )
      VALUES
      (
        @AppointmentId,
        @OldStatus,
        'COMPLETED',
        @UserId,
        N'Technician hoàn thành dịch vụ',
        GETDATE()
      );

      SELECT *
FROM Appointments
WHERE AppointmentId = @AppointmentId
  AND EmployeeId = @EmployeeId;
    `);

  return result.recordset[0];
}

async function getAppointmentDetail(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const appointment = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS DurationMinutes,
        a.Status,
        a.Notes,
        a.CheckedInAt,
        a.CompletedAt,
        a.CreatedAt,
        a.UpdatedAt,
        a.BranchId,

        b.BranchName,

        c.CustomerId,
        c.Gender AS CustomerGender,
        c.DateOfBirth AS CustomerDateOfBirth,
        c.Address AS CustomerAddress,
        c.LoyaltyPoints,

        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatar,

        ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,

        e.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,

        i.InvoiceId,
        i.TotalAmount,
        i.DiscountAmount,
        i.FinalAmount,
        i.Status AS InvoiceStatus,
        i.CreatedAt AS InvoiceCreatedAt,

        p.PaymentId,
        p.PaymentMethod,
        p.Status AS PaymentStatus,
        p.TransactionCode,
        p.PaidAt
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN Branches b ON a.BranchId = b.BranchId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 *
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
      ) p
      WHERE a.AppointmentId = @AppointmentId
        AND a.EmployeeId = @EmployeeId
    `);

  if (!appointment.recordset[0]) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  const services = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT
        s.ServiceId,
        s.ServiceName,
        s.Description,
        s.DurationMinutes,
        s.ImageUrl,
        aps.Price,
        sc.CategoryName
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
      WHERE aps.AppointmentId = @AppointmentId
      ORDER BY s.ServiceName
    `);

  const history = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT
        h.HistoryId,
        h.OldStatus,
        h.NewStatus,
        h.Reason,
        h.ChangedAt,
        u.FullName AS ChangedByName
      FROM AppointmentStatusHistory h
      LEFT JOIN Users u ON h.ChangedBy = u.UserId
      WHERE h.AppointmentId = @AppointmentId
      ORDER BY h.ChangedAt DESC, h.HistoryId DESC
    `);

  const notes = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT
        tn.NoteId,
        tn.Title,
        tn.Content,
        tn.NoteType,
        tn.ProductsUsed,
        tn.SkinCondition,
        tn.Technique,
        tn.CustomerFeedback,
        tn.Recommendation,
        tn.FollowUpDate,
        tn.ProgressStatus,
        tn.CreatedAt,
        tn.UpdatedAt,
        u.FullName AS AuthorName
      FROM TreatmentNotes tn
      JOIN Employees e ON tn.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE tn.AppointmentId = @AppointmentId
      ORDER BY tn.CreatedAt DESC, tn.NoteId DESC
    `);

  const noteIds = notes.recordset.map((note) => note.NoteId);

  let attachments = [];

  if (noteIds.length > 0) {
    const attachResult = await pool.request().query(`
    SELECT AttachmentId, NoteId, FileName, FileUrl, FileType, AttachmentType, UploadedAt
    FROM TreatmentNoteAttachments
    WHERE NoteId IN (${noteIds.map((id) => Number(id)).join(",")})
    ORDER BY UploadedAt DESC
  `);

    attachments = attachResult.recordset;
  }

  const notesWithAttachments = notes.recordset.map((note) => ({
    ...note,
    Attachments: attachments.filter((file) => file.NoteId === note.NoteId),
  }));
  return {
    appointment: appointment.recordset[0],
    services: services.recordset,
    statusHistory: history.recordset,
    treatmentNotes: notesWithAttachments,
  };
}

async function markNoShow(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("UserId", sql.Int, userId).query(`
      DECLARE @OldStatus NVARCHAR(30);

      SELECT @OldStatus = Status
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;

      IF @OldStatus IS NULL
        THROW 50001, N'Không tìm thấy lịch hẹn của kỹ thuật viên này', 1;

      IF @OldStatus NOT IN ('CONFIRMED', 'PAID', 'CHECKED_IN')
        THROW 50002, N'Chỉ lịch đã xác nhận hoặc đã thanh toán mới được đánh dấu No Show', 1;
IF NOT EXISTS (
  SELECT 1
  FROM Appointments
  WHERE AppointmentId = @AppointmentId
    AND EmployeeId = @EmployeeId
    AND (
      AppointmentDate < CAST(GETDATE() AS DATE)
      OR (
        AppointmentDate = CAST(GETDATE() AS DATE)
        AND EndTime < CAST(GETDATE() AS TIME)
      )
    )
)
  THROW 50003, N'Chỉ được đánh dấu No-show khi lịch đã quá giờ kết thúc', 1;
      UPDATE Appointments
      SET Status = 'NO_SHOW',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
        AND Status IN ('CONFIRMED', 'PAID', 'CHECKED_IN')

      INSERT INTO AppointmentStatusHistory
      (
        AppointmentId,
        OldStatus,
        NewStatus,
        ChangedBy,
        Reason,
        ChangedAt
      )
      VALUES
      (
        @AppointmentId,
        @OldStatus,
        'NO_SHOW',
        @UserId,
        N'Technician đánh dấu khách không đến',
        GETDATE()
      );

      SELECT *
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;
    `);

  return result.recordset[0];
}

async function addTreatmentNote(userId, appointmentId, body) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const content = String(body.content || "").trim();

  if (!content) {
    throw new Error("Nội dung ghi chú không được để trống");
  }

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("Title", sql.NVarChar(150), body.title || null)
    .input("Content", sql.NVarChar(sql.MAX), content)
    .input("NoteType", sql.NVarChar(50), body.noteType || "GENERAL")
    .input("ProductsUsed", sql.NVarChar(sql.MAX), body.productsUsed || null)
    .input("SkinCondition", sql.NVarChar(sql.MAX), body.skinCondition || null)
    .input("Technique", sql.NVarChar(sql.MAX), body.technique || null)
    .input(
      "CustomerFeedback",
      sql.NVarChar(sql.MAX),
      body.customerFeedback || null,
    )
    .input("Recommendation", sql.NVarChar(sql.MAX), body.recommendation || null)
    .input("FollowUpDate", sql.Date, body.followUpDate || null)
    .input(
      "ProgressStatus",
      sql.NVarChar(30),
      body.progressStatus || "IN_PROGRESS",
    ).query(`
      IF NOT EXISTS (
        SELECT 1
        FROM Appointments
        WHERE AppointmentId = @AppointmentId
          AND EmployeeId = @EmployeeId
          AND Status IN ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
      )
        THROW 50004, N'Bạn chỉ được thêm ghi chú khi lịch đã check-in, đang làm hoặc đã hoàn thành', 1;

      INSERT INTO TreatmentNotes
      (
        AppointmentId,
        EmployeeId,
        Title,
        Content,
        NoteType,
        ProductsUsed,
        SkinCondition,
        Technique,
        CustomerFeedback,
        Recommendation,
        FollowUpDate,
        ProgressStatus,
        CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @AppointmentId,
        @EmployeeId,
        @Title,
        @Content,
        @NoteType,
        @ProductsUsed,
        @SkinCondition,
        @Technique,
        @CustomerFeedback,
        @Recommendation,
        @FollowUpDate,
        @ProgressStatus,
        GETDATE()
      );
    `);

  return result.recordset[0];
}

async function getAppointments(userId, query) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 8), 1), 50);
  const offset = (page - 1) * limit;

  const allowedStatuses = [
    "ALL",
    "PENDING_PAYMENT",
    "PENDING",
    "PAID",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "REFUND_PENDING",
    "NO_SHOW",
  ];

  const status = allowedStatuses.includes(query.status) ? query.status : "ALL";

  const serviceId = query.serviceId ? Number(query.serviceId) : null;
  const search = query.search ? `%${query.search.trim()}%` : "%%";
  const startDate = query.startDate || null;
  const endDate = query.endDate || null;

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Status", sql.NVarChar, status)
    .input("ServiceId", sql.Int, serviceId)
    .input("Search", sql.NVarChar, search)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate)
    .input("Offset", sql.Int, offset)
    .input("Limit", sql.Int, limit).query(`
      SELECT
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS DurationMinutes,
        a.Status,
        c.CustomerId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.AvatarUrl AS CustomerAvatar,
        ml.LevelName AS MembershipLevel,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName,
        COUNT(*) OVER() AS TotalRows
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.EmployeeId = @EmployeeId
      AND (@Status = 'ALL' OR a.Status = @Status)
AND (
  @ServiceId IS NULL
  OR EXISTS (
    SELECT 1
    FROM AppointmentServices aps2
    WHERE aps2.AppointmentId = a.AppointmentId
    AND aps2.ServiceId = @ServiceId
  )
)

      AND (@StartDate IS NULL OR a.AppointmentDate >= @StartDate)
      AND (@EndDate IS NULL OR a.AppointmentDate <= @EndDate)
      AND (
        cu.FullName LIKE @Search
        OR cu.Phone LIKE @Search
        OR s.ServiceName LIKE @Search
        OR CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) LIKE @Search
      )
      GROUP BY
        a.AppointmentId, a.AppointmentDate, a.StartTime, a.EndTime,
        a.Status, c.CustomerId, cu.FullName, cu.Phone, cu.AvatarUrl, ml.LevelName
      ORDER BY 
  a.AppointmentDate DESC,
  a.StartTime DESC,
  a.AppointmentId DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
    `);

  const total = result.recordset[0]?.TotalRows || 0;

  return {
    appointments: result.recordset,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getAppointmentsSummary(userId, query) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const startDate = query.startDate || null;
  const endDate = query.endDate || null;

  const summary = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
      SELECT
  COUNT(*) AS totalAppointments,
  SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgress,
  SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN Status = 'NO_SHOW' THEN 1 ELSE 0 END) AS noShow
FROM Appointments
      WHERE EmployeeId = @EmployeeId
      AND (@StartDate IS NULL OR AppointmentDate >= @StartDate)
      AND (@EndDate IS NULL OR AppointmentDate <= @EndDate)
    `);

  const statusChart = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
      SELECT Status, COUNT(*) AS Total
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
      AND (@StartDate IS NULL OR AppointmentDate >= @StartDate)
      AND (@EndDate IS NULL OR AppointmentDate <= @EndDate)
      GROUP BY Status
    `);

  const popularServices = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
    SELECT TOP 5 s.ServiceName, COUNT(*) AS Total
    FROM Appointments a
    JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.EmployeeId = @EmployeeId
      AND (@StartDate IS NULL OR a.AppointmentDate >= @StartDate)
      AND (@EndDate IS NULL OR a.AppointmentDate <= @EndDate)
    GROUP BY s.ServiceName
    ORDER BY Total DESC
  `);

  return {
    summary: summary.recordset[0],
    statusChart: statusChart.recordset,
    popularServices: popularServices.recordset,
  };
}

async function getCustomers(userId, query) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 8), 1), 50);
  const offset = (page - 1) * limit;

  const search = query.search ? `%${query.search.trim()}%` : "%%";
  const membership = query.membership || "ALL";
  const status = query.status || "ALL";
  const gender = query.gender || "ALL";

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Search", sql.NVarChar, search)
    .input("Membership", sql.NVarChar, membership)
    .input("Status", sql.NVarChar, status)
    .input("Gender", sql.NVarChar, gender)
    .input("Offset", sql.Int, offset)
    .input("Limit", sql.Int, limit).query(`
      ;WITH CustomerBase AS (
        SELECT DISTINCT c.CustomerId
        FROM Customers c
        JOIN Users u ON c.UserId = u.UserId
        LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
        JOIN Appointments a ON c.CustomerId = a.CustomerId
        WHERE a.EmployeeId = @EmployeeId
          AND (
            u.FullName LIKE @Search
            OR u.Email LIKE @Search
            OR u.Phone LIKE @Search
            OR CONCAT('#CUST-', FORMAT(c.CustomerId, '000')) LIKE @Search
            OR CONCAT('CUST-', FORMAT(c.CustomerId, '000')) LIKE @Search
          )
          AND (@Membership = 'ALL' OR ISNULL(ml.LevelName, 'Normal') = @Membership)
          AND (@Status = 'ALL' OR u.Status = @Status)
          AND (@Gender = 'ALL' OR c.Gender = @Gender)
      ), CustomerStats AS (
        SELECT
          cb.CustomerId,
          COUNT(DISTINCT a.AppointmentId) AS TotalVisits,
          MAX(a.AppointmentDate) AS LastVisit,
          ISNULL(SUM(CASE WHEN p.Status = 'PAID' THEN i.FinalAmount ELSE 0 END), 0) AS TotalSpent
        FROM CustomerBase cb
        JOIN Appointments a ON cb.CustomerId = a.CustomerId AND a.EmployeeId = @EmployeeId
        LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
        OUTER APPLY (
          SELECT TOP 1 p2.Status
          FROM Payments p2
          WHERE p2.InvoiceId = i.InvoiceId
          ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
        ) p
        GROUP BY cb.CustomerId
      )
      SELECT
        c.CustomerId,
        CONCAT('#CUST-', FORMAT(c.CustomerId, '000')) AS CustomerCode,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,
        ISNULL(cs.TotalVisits, 0) AS TotalVisits,
        cs.LastVisit,
        ISNULL(cs.TotalSpent, 0) AS TotalSpent,
        COUNT(*) OVER() AS TotalRows
      FROM CustomerBase cb
      JOIN Customers c ON cb.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN CustomerStats cs ON c.CustomerId = cs.CustomerId
      ORDER BY cs.LastVisit DESC, c.CustomerId DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
    `);

  const total = result.recordset[0]?.TotalRows || 0;

  return {
    customers: result.recordset,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

async function getCustomersSummary(userId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const result = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      ;WITH AssignedCustomers AS (
        SELECT
          c.CustomerId,
          u.Status,
          ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,
          MIN(a.CreatedAt) AS FirstAppointmentCreatedAt
        FROM Customers c
        JOIN Users u ON c.UserId = u.UserId
        LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
        JOIN Appointments a ON c.CustomerId = a.CustomerId
        WHERE a.EmployeeId = @EmployeeId
        GROUP BY c.CustomerId, u.Status, ml.LevelName
      )
      SELECT
        COUNT(*) AS totalCustomers,
        SUM(CASE WHEN Status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeCustomers,
        SUM(CASE
          WHEN MONTH(FirstAppointmentCreatedAt) = MONTH(GETDATE())
           AND YEAR(FirstAppointmentCreatedAt) = YEAR(GETDATE())
          THEN 1 ELSE 0 END) AS newThisMonth,
        SUM(CASE WHEN MembershipLevel IN ('Gold', 'Diamond', 'Platinum') THEN 1 ELSE 0 END) AS vipCustomers
      FROM AssignedCustomers;
    `);

  return (
    result.recordset[0] || {
      totalCustomers: 0,
      activeCustomers: 0,
      newThisMonth: 0,
      vipCustomers: 0,
    }
  );
}

async function getCustomerDetail(userId, customerId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);
  const id = Number(customerId);

  const customer = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      ;WITH CustomerStats AS (
        SELECT
          a.CustomerId,
          COUNT(DISTINCT a.AppointmentId) AS TotalVisits,
          MAX(a.AppointmentDate) AS LastVisit,
          SUM(CASE WHEN a.Status = 'NO_SHOW' THEN 1 ELSE 0 END) AS NoShowCount,
          SUM(CASE WHEN a.Status = 'CANCELLED' THEN 1 ELSE 0 END) AS CancelledCount,
          ISNULL(SUM(CASE WHEN p.Status = 'PAID' THEN i.FinalAmount ELSE 0 END), 0) AS TotalSpent,
          ISNULL(AVG(CASE WHEN p.Status = 'PAID' THEN i.FinalAmount END), 0) AS AverageTicket
        FROM Appointments a
        LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
        OUTER APPLY (
          SELECT TOP 1 p2.Status
          FROM Payments p2
          WHERE p2.InvoiceId = i.InvoiceId
          ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
        ) p
        WHERE a.EmployeeId = @EmployeeId
          AND a.CustomerId = @CustomerId
        GROUP BY a.CustomerId
      ),
      ReviewStats AS (
        SELECT
          r.CustomerId,
          ISNULL(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating,
          COUNT(*) AS ReviewCount
        FROM Reviews r
        WHERE r.EmployeeId = @EmployeeId
          AND r.CustomerId = @CustomerId
          AND r.Status = 'APPROVED'
        GROUP BY r.CustomerId
      )
      SELECT
        c.CustomerId,
        CONCAT('#CUST-', FORMAT(c.CustomerId, '000')) AS CustomerCode,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        c.CreatedAt AS MemberSince,
        ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,
        ISNULL(ml.DiscountPercent, 0) AS DiscountPercent,
        ISNULL(cs.TotalVisits, 0) AS TotalVisits,
        ISNULL(cs.NoShowCount, 0) AS NoShowCount,
        ISNULL(cs.CancelledCount, 0) AS CancelledCount,
        cs.LastVisit,
        ISNULL(cs.TotalSpent, 0) AS TotalSpent,
        ISNULL(cs.AverageTicket, 0) AS AverageTicket,
        ISNULL(rs.AverageRating, 0) AS AverageRating,
        ISNULL(rs.ReviewCount, 0) AS ReviewCount
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN CustomerStats cs ON c.CustomerId = cs.CustomerId
      LEFT JOIN ReviewStats rs ON c.CustomerId = rs.CustomerId
      WHERE c.CustomerId = @CustomerId
        AND EXISTS (
          SELECT 1
          FROM Appointments a
          WHERE a.CustomerId = c.CustomerId
            AND a.EmployeeId = @EmployeeId
        );
    `);

  if (!customer.recordset[0]) {
    throw new Error("Không tìm thấy khách hàng của kỹ thuật viên này");
  }

  const visits = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      SELECT TOP 50
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName,
        MAX(i.FinalAmount) AS FinalAmount,
        MAX(p.Status) AS PaymentStatus
      FROM Appointments a
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 p2.Status
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
      ) p
      WHERE a.CustomerId = @CustomerId
        AND a.EmployeeId = @EmployeeId
      GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.EndTime, a.Status
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC;
    `);

  const notes = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      SELECT TOP 20
        tn.NoteId,
        tn.Title,
        tn.Content,
        tn.NoteType,
        tn.ProductsUsed,
        tn.SkinCondition,
        tn.Technique,
        tn.CustomerFeedback,
        tn.Recommendation,
        tn.FollowUpDate,
        tn.ProgressStatus,
        tn.CreatedAt,
        tn.UpdatedAt,
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode
      FROM TreatmentNotes tn
      JOIN Appointments a ON tn.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
        AND tn.EmployeeId = @EmployeeId
        AND a.EmployeeId = @EmployeeId
      ORDER BY tn.CreatedAt DESC, tn.NoteId DESC;
    `);

  const noteIds = notes.recordset.map((n) => Number(n.NoteId)).filter(Boolean);
  let attachments = [];

  if (noteIds.length > 0) {
    const attachResult = await pool.request().query(`
      SELECT
        AttachmentId,
        NoteId,
        FileName,
        FileUrl,
        FileType,
        AttachmentType,
        UploadedAt
      FROM TreatmentNoteAttachments
      WHERE NoteId IN (${noteIds.join(",")})
      ORDER BY UploadedAt DESC, AttachmentId DESC;
    `);

    attachments = attachResult.recordset;
  }

  const notesWithAttachments = notes.recordset.map((note) => ({
    ...note,
    Attachments: attachments.filter((file) => file.NoteId === note.NoteId),
  }));

  const preferences = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      SELECT TOP 5
        s.ServiceName,
        COUNT(*) AS UsedCount,
        MAX(a.AppointmentDate) AS LastUsedAt
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.EmployeeId = @EmployeeId
      GROUP BY s.ServiceName
      ORDER BY UsedCount DESC, LastUsedAt DESC;
    `);

  const reviews = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      SELECT TOP 20
        r.ReviewId,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.CreatedAt,
        s.ServiceName
      FROM Reviews r
      LEFT JOIN Services s ON r.ServiceId = s.ServiceId
      WHERE r.CustomerId = @CustomerId
        AND r.EmployeeId = @EmployeeId
        AND r.Status = 'APPROVED'
      ORDER BY r.CreatedAt DESC;
    `);

  const upcoming = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, id).query(`
      SELECT TOP 5
        a.AppointmentId,
        CONCAT('APT-', FORMAT(a.AppointmentDate, 'yyyyMMdd'), '-', a.AppointmentId) AS AppointmentCode,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName
      FROM Appointments a
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.EmployeeId = @EmployeeId
        AND a.AppointmentDate >= CAST(GETDATE() AS DATE)
        AND a.Status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
      GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.EndTime, a.Status
      ORDER BY a.AppointmentDate ASC, a.StartTime ASC;
    `);

  const latestNote = notesWithAttachments[0] || null;

  const timeline = [
    ...visits.recordset.map((v) => ({
      type: "APPOINTMENT",
      title: v.ServiceName || "Appointment",
      subtitle: v.AppointmentCode,
      date: v.AppointmentDate,
      status: v.Status,
      appointmentId: v.AppointmentId,
    })),
    ...notesWithAttachments.map((n) => ({
      type: "NOTE",
      title: n.Title || n.NoteType || "Treatment note",
      subtitle: n.Content,
      date: n.CreatedAt,
      status: n.ProgressStatus,
      appointmentId: n.AppointmentId,
    })),
    ...reviews.recordset.map((r) => ({
      type: "REVIEW",
      title: `Review ${r.Rating || 0} sao`,
      subtitle: r.Comment,
      date: r.CreatedAt,
      status: r.ServiceName,
    })),
  ]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 30);

  return {
    customer: customer.recordset[0],
    visits: visits.recordset,
    notes: notesWithAttachments,
    preferences: preferences.recordset,
    reviews: reviews.recordset,
    upcoming: upcoming.recordset,
    beautyProfile: {
      skinCondition: latestNote?.SkinCondition || null,
      productsUsed: latestNote?.ProductsUsed || null,
      technique: latestNote?.Technique || null,
      recommendation: latestNote?.Recommendation || null,
      followUpDate: latestNote?.FollowUpDate || null,
      customerFeedback: latestNote?.CustomerFeedback || null,
    },
    timeline,
  };
}

async function getTreatmentNotesPage(userId, query = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const appointmentId = query.appointmentId
    ? Number(query.appointmentId)
    : null;

  const current = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT TOP 1
        a.AppointmentId,
        a.CustomerId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        u.FullName AS CustomerName,
        u.Phone,
        u.Email,
        u.AvatarUrl,
        ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName,
SUM(ISNULL(s.DurationMinutes, 0)) AS DurationMinutes,
ISNULL(r.ResourceName, N'Chưa có phòng') AS RoomName,
tn.NoteId AS NoteId,
tn.Title AS NoteTitle,
tn.Content AS CurrentNote,
tn.NoteType AS NoteType,
tn.ProductsUsed AS ProductsUsed,
tn.SkinCondition AS SkinCondition,
tn.Technique AS Technique,
tn.CustomerFeedback AS CustomerFeedback,
tn.Recommendation AS Recommendation,
tn.FollowUpDate AS FollowUpDate,
tn.ProgressStatus AS ProgressStatus,
tn.UpdatedAt AS UpdatedAt,
tn.CreatedAt AS NoteCreatedAt
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN ServiceResources r ON a.ResourceId = r.ResourceId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      OUTER APPLY (
  SELECT TOP 1 *
  FROM TreatmentNotes tn
  WHERE tn.AppointmentId = a.AppointmentId
    AND tn.EmployeeId = @EmployeeId
  ORDER BY tn.CreatedAt DESC, tn.NoteId DESC
) tn
      WHERE a.EmployeeId = @EmployeeId
        AND (@AppointmentId IS NULL OR a.AppointmentId = @AppointmentId)
        AND a.Status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
      GROUP BY
        a.AppointmentId, a.CustomerId, a.AppointmentDate,
        a.StartTime, a.EndTime, a.Status,
        u.FullName, u.Phone, u.Email, u.AvatarUrl, ml.LevelName, r.ResourceName,
tn.NoteId, tn.Title, tn.Content, tn.NoteType, tn.ProductsUsed,
tn.SkinCondition, tn.Technique, tn.CustomerFeedback, tn.Recommendation,
tn.FollowUpDate, tn.ProgressStatus, tn.UpdatedAt, tn.CreatedAt
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);

  const appointment = current.recordset[0];

  if (!appointment) {
    return {
      appointment: null,
      previousNotes: [],
      categories: [],
      summary: {},
    };
  }

  const previousNotes = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, appointment.CustomerId)
    .input("AppointmentId", sql.Int, appointment.AppointmentId).query(`
      SELECT TOP 10
        tn.NoteId,
        tn.AppointmentId,
        tn.Content,
        tn.NoteType,
        tn.CreatedAt,
        tn.UpdatedAt,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName
      FROM TreatmentNotes tn
      JOIN Appointments a ON tn.AppointmentId = a.AppointmentId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.EmployeeId = @EmployeeId
        AND tn.EmployeeId = @EmployeeId
        AND tn.AppointmentId <> @AppointmentId
      GROUP BY
        tn.NoteId, tn.AppointmentId, tn.Content, tn.NoteType,
        tn.CreatedAt, tn.UpdatedAt, a.AppointmentDate, a.StartTime
      ORDER BY tn.CreatedAt DESC
    `);

  const categories = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT
        ISNULL(NoteType, 'General Notes') AS NoteType,
        COUNT(*) AS Total
      FROM TreatmentNotes
      WHERE EmployeeId = @EmployeeId
      GROUP BY NoteType
    `);

  const summary = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        COUNT(*) AS TotalNotes,
        SUM(CASE WHEN MONTH(CreatedAt) = MONTH(GETDATE())
          AND YEAR(CreatedAt) = YEAR(GETDATE()) THEN 1 ELSE 0 END) AS NotesThisMonth,
        MAX(CreatedAt) AS LastNote
      FROM TreatmentNotes
      WHERE EmployeeId = @EmployeeId
    `);
  let attachments = [];

  if (appointment.NoteId) {
    const attachResult = await pool
      .request()
      .input("NoteId", sql.Int, appointment.NoteId).query(`
      SELECT AttachmentId, NoteId, FileName, FileUrl, FileType, AttachmentType, UploadedAt
      FROM TreatmentNoteAttachments
      WHERE NoteId = @NoteId
      ORDER BY UploadedAt DESC
    `);

    attachments = attachResult.recordset;
  }
  return {
    appointment,
    previousNotes: previousNotes.recordset,
    categories: categories.recordset,
    summary: summary.recordset[0],
    attachments,
  };
}

async function saveTreatmentNote(userId, body) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const appointmentId = Number(body.appointmentId);
  const title = String(body.title || "Treatment Note").trim();
  const content = String(body.content || "").trim();
  const noteType = body.noteType || "General Notes";

  if (!appointmentId) throw new Error("Thiếu AppointmentId");
  if (!content) throw new Error("Nội dung ghi chú không được trống");

  const check = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT AppointmentId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
        AND Status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
    `);

  if (!check.recordset[0]) {
    throw new Error("Bạn không có quyền ghi chú lịch hẹn này");
  }

  const inserted = await pool
    .request()
    .input("AppointmentId", sql.Int, appointmentId)
    .input("EmployeeId", sql.Int, employeeId)
    .input("Title", sql.NVarChar(150), title)
    .input("Content", sql.NVarChar(sql.MAX), content)
    .input("NoteType", sql.NVarChar(50), noteType)
    .input("ProductsUsed", sql.NVarChar(sql.MAX), body.productsUsed || null)
    .input("SkinCondition", sql.NVarChar(sql.MAX), body.skinCondition || null)
    .input("Technique", sql.NVarChar(sql.MAX), body.technique || null)
    .input(
      "CustomerFeedback",
      sql.NVarChar(sql.MAX),
      body.customerFeedback || null,
    )
    .input("Recommendation", sql.NVarChar(sql.MAX), body.recommendation || null)
    .input("FollowUpDate", sql.Date, body.followUpDate || null)
    .input(
      "ProgressStatus",
      sql.NVarChar(30),
      body.progressStatus || "IN_PROGRESS",
    ).query(`
      INSERT INTO TreatmentNotes
      (
        AppointmentId, EmployeeId, Title, Content, NoteType,
        ProductsUsed, SkinCondition, Technique, CustomerFeedback,
        Recommendation, FollowUpDate, ProgressStatus, CreatedAt
      )
      OUTPUT INSERTED.NoteId
      VALUES
      (
        @AppointmentId, @EmployeeId, @Title, @Content, @NoteType,
        @ProductsUsed, @SkinCondition, @Technique, @CustomerFeedback,
        @Recommendation, @FollowUpDate, @ProgressStatus, GETDATE()
      )
    `);

  return {
    message: "Tạo ghi chú điều trị thành công",
    noteId: inserted.recordset[0].NoteId,
  };
}

async function getCustomerNoteHistory(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const current = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT CustomerId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
    `);

  if (!current.recordset[0]) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  const customerId = current.recordset[0].CustomerId;

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CustomerId", sql.Int, customerId).query(`
      SELECT
        tn.NoteId,
        tn.AppointmentId,
        tn.Content,
        tn.NoteType,
        tn.CreatedAt,
        tn.UpdatedAt,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        STRING_AGG(s.ServiceName, ', ') AS ServiceName
      FROM TreatmentNotes tn
      JOIN Appointments a ON tn.AppointmentId = a.AppointmentId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.EmployeeId = @EmployeeId
        AND tn.EmployeeId = @EmployeeId
      GROUP BY
        tn.NoteId, tn.AppointmentId, tn.Content, tn.NoteType,
        tn.CreatedAt, tn.UpdatedAt, a.AppointmentDate, a.StartTime
      ORDER BY tn.CreatedAt DESC
    `);

  return result.recordset;
}

async function deleteTreatmentNote(userId, noteId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("NoteId", sql.Int, Number(noteId)).query(`
      DELETE FROM TreatmentNotes
      WHERE NoteId = @NoteId
        AND EmployeeId = @EmployeeId
    `);

  if (result.rowsAffected[0] === 0) {
    throw new Error("Không tìm thấy ghi chú hoặc không có quyền xóa");
  }

  return { message: "Xóa ghi chú thành công" };
}

async function uploadTreatmentAttachments(
  userId,
  noteId,
  files,
  attachmentType,
) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const note = await pool
    .request()
    .input("NoteId", sql.Int, Number(noteId))
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT NoteId
      FROM TreatmentNotes
      WHERE NoteId = @NoteId
        AND EmployeeId = @EmployeeId
    `);

  if (!note.recordset[0]) {
    throw new Error("Không tìm thấy ghi chú hoặc không có quyền upload");
  }

  if (!files.length) {
    throw new Error("Chưa chọn file upload");
  }

  const uploaded = [];

  for (const file of files) {
    const fileUrl = `/uploads/treatment-notes/${file.filename}`;

    const result = await pool
      .request()
      .input("NoteId", sql.Int, Number(noteId))
      .input("FileName", sql.NVarChar(255), file.originalname)
      .input("FileUrl", sql.NVarChar(500), fileUrl)
      .input("FileType", sql.NVarChar(50), file.mimetype)
      .input("AttachmentType", sql.NVarChar(30), attachmentType || "GENERAL")
      .query(`
        INSERT INTO TreatmentNoteAttachments
        (NoteId, FileName, FileUrl, FileType, AttachmentType)
        OUTPUT INSERTED.*
        VALUES
        (@NoteId, @FileName, @FileUrl, @FileType, @AttachmentType)
      `);

    uploaded.push(result.recordset[0]);
  }

  return {
    message: "Upload file thành công",
    attachments: uploaded,
  };
}

async function updateTreatmentProgress(userId, noteId, progressStatus) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const allowed = ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED"];

  if (!allowed.includes(progressStatus)) {
    throw new Error("Trạng thái treatment không hợp lệ");
  }

  const result = await pool
    .request()
    .input("NoteId", sql.Int, Number(noteId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("ProgressStatus", sql.NVarChar(30), progressStatus).query(`
      UPDATE TreatmentNotes
      SET ProgressStatus = @ProgressStatus,
          UpdatedAt = GETDATE()
      WHERE NoteId = @NoteId
        AND EmployeeId = @EmployeeId
    `);

  if (result.rowsAffected[0] === 0) {
    throw new Error("Không tìm thấy ghi chú hoặc không có quyền cập nhật");
  }

  return { message: "Cập nhật tiến trình thành công" };
}

async function getEarnings(userId, query = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const range = String(query.range || "month").toLowerCase();
  const now = new Date();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const fromDate =
    query.fromDate ||
    (range === "week"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
          .toISOString()
          .slice(0, 10)
      : range === "lastmonth"
        ? lastMonthStart.toISOString().slice(0, 10)
        : range === "year"
          ? startOfYear.toISOString().slice(0, 10)
          : startOfMonth.toISOString().slice(0, 10));

  const toDate =
    query.toDate ||
    (range === "lastmonth"
      ? lastMonthEnd.toISOString().slice(0, 10)
      : now.toISOString().slice(0, 10));

  const commissionRate = 0.15;

  const overview = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
      ;WITH PaidAppointments AS (
        SELECT
          a.AppointmentId,
          a.AppointmentDate,
          DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS DurationMinutes,
          i.FinalAmount,
          ISNULL(i.TechnicianCommissionAmount, i.FinalAmount * @CommissionRate) AS Commission,
          ISNULL(i.TechnicianTipAmount, 0) AS Tips
        FROM Appointments a
        JOIN Invoices i ON a.AppointmentId = i.AppointmentId
        OUTER APPLY (
          SELECT TOP 1 p.Status
          FROM Payments p
          WHERE p.InvoiceId = i.InvoiceId
          ORDER BY p.CreatedAt DESC, p.PaymentId DESC
        ) latestPayment
        WHERE a.EmployeeId = @EmployeeId
          AND a.Status = 'COMPLETED'
          AND latestPayment.Status = 'PAID'
          AND a.AppointmentDate BETWEEN @FromDate AND @ToDate
      )
      SELECT
        ISNULL(SUM(FinalAmount), 0) AS TotalEarnings,
        ISNULL(SUM(Commission), 0) AS Commission,
        ISNULL(SUM(Tips), 0) AS Tips,
        COUNT(DISTINCT AppointmentId) AS ServicesCompleted,
        ISNULL(AVG(FinalAmount), 0) AS AvgOrderValue,
        ISNULL(SUM(DurationMinutes), 0) AS WorkingMinutes
      FROM PaidAppointments;
    `);

  const daily = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
      ;WITH PaidAppointments AS (
        SELECT
          a.AppointmentId,
          a.AppointmentDate,
          i.FinalAmount,
          ISNULL(i.TechnicianCommissionAmount, i.FinalAmount * @CommissionRate) AS Commission,
          ISNULL(i.TechnicianTipAmount, 0) AS Tips
        FROM Appointments a
        JOIN Invoices i ON a.AppointmentId = i.AppointmentId
        OUTER APPLY (
          SELECT TOP 1 p.Status
          FROM Payments p
          WHERE p.InvoiceId = i.InvoiceId
          ORDER BY p.CreatedAt DESC, p.PaymentId DESC
        ) latestPayment
        WHERE a.EmployeeId = @EmployeeId
          AND a.Status = 'COMPLETED'
          AND latestPayment.Status = 'PAID'
          AND a.AppointmentDate BETWEEN @FromDate AND @ToDate
      )
      SELECT
        pa.AppointmentDate,
        COUNT(DISTINCT pa.AppointmentId) AS Appointments,
        ISNULL(SUM(svc.ServiceCount), 0) AS Services,
        ISNULL(SUM(pa.FinalAmount), 0) AS TotalEarnings,
ISNULL(SUM(pa.Commission), 0) AS Commission,
ISNULL(SUM(pa.Tips), 0) AS Tips
FROM PaidAppointments pa
OUTER APPLY (
  SELECT COUNT(*) AS ServiceCount
  FROM AppointmentServices aps
  WHERE aps.AppointmentId = pa.AppointmentId
) svc
GROUP BY pa.AppointmentDate
      ORDER BY pa.AppointmentDate DESC;
    `);

  const serviceCategory = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
      SELECT TOP 5
        ISNULL(cat.CategoryName, N'Other Services') AS CategoryName,
        ISNULL(SUM(aps.Price), 0) AS Amount,
        ISNULL(SUM(aps.Price * @CommissionRate), 0) AS Commission,
        COUNT(aps.AppointmentServiceId) AS Total
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN ServiceCategories cat ON s.CategoryId = cat.CategoryId
      JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 p.Status
        FROM Payments p
        WHERE p.InvoiceId = i.InvoiceId
        ORDER BY p.CreatedAt DESC, p.PaymentId DESC
      ) latestPayment
      WHERE a.EmployeeId = @EmployeeId
        AND a.Status = 'COMPLETED'
        AND latestPayment.Status = 'PAID'
        AND a.AppointmentDate BETWEEN @FromDate AND @ToDate
      GROUP BY cat.CategoryName
      ORDER BY Amount DESC;
    `);

  const topServices = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
      SELECT TOP 5
        s.ServiceName,
        COUNT(aps.AppointmentServiceId) AS TotalUsed,
        ISNULL(SUM(aps.Price), 0) AS Amount,
        ISNULL(SUM(aps.Price * @CommissionRate), 0) AS Commission
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (
        SELECT TOP 1 p.Status
        FROM Payments p
        WHERE p.InvoiceId = i.InvoiceId
        ORDER BY p.CreatedAt DESC, p.PaymentId DESC
      ) latestPayment
      WHERE a.EmployeeId = @EmployeeId
        AND a.Status = 'COMPLETED'
        AND latestPayment.Status = 'PAID'
        AND a.AppointmentDate BETWEEN @FromDate AND @ToDate
      GROUP BY s.ServiceName
      ORDER BY Amount DESC;
    `);

  const yearSummary = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
      ;WITH Monthly AS (
        SELECT
          MONTH(a.AppointmentDate) AS MonthNo,
          SUM(i.FinalAmount) AS MonthlyEarnings,
          SUM(ISNULL(i.TechnicianCommissionAmount, i.FinalAmount * @CommissionRate)) AS MonthlyCommission,
          SUM(ISNULL(i.TechnicianTipAmount, 0)) AS MonthlyTips,
          COUNT(DISTINCT a.AppointmentId) AS MonthlyServices
        FROM Appointments a
        JOIN Invoices i ON a.AppointmentId = i.AppointmentId
        OUTER APPLY (
          SELECT TOP 1 p.Status
          FROM Payments p
          WHERE p.InvoiceId = i.InvoiceId
          ORDER BY p.CreatedAt DESC, p.PaymentId DESC
        ) latestPayment
        WHERE a.EmployeeId = @EmployeeId
          AND a.Status = 'COMPLETED'
          AND latestPayment.Status = 'PAID'
          AND YEAR(a.AppointmentDate) = YEAR(GETDATE())
        GROUP BY MONTH(a.AppointmentDate)
      )
      SELECT
        ISNULL(SUM(MonthlyEarnings), 0) AS TotalEarnings,
        ISNULL(SUM(MonthlyCommission), 0) AS TotalCommission,
        ISNULL(SUM(MonthlyTips), 0) AS TotalTips,
        ISNULL(SUM(MonthlyServices), 0) AS TotalServices,
        ISNULL(AVG(MonthlyEarnings), 0) AS AvgMonthlyEarnings,
        YEAR(GETDATE()) AS YearNumber
      FROM Monthly;
    `);

  const goal = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT TOP 1 MonthlyGoal
      FROM TechnicianEarningGoals
      WHERE EmployeeId = @EmployeeId AND Active = 1
    `);

  const payoutSummary = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT
        ISNULL(SUM(CASE WHEN Status IN ('PENDING', 'APPROVED') THEN Amount ELSE 0 END), 0) AS PendingAmount,
        ISNULL(SUM(CASE WHEN Status = 'PAID' THEN Amount ELSE 0 END), 0) AS PaidAmount
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId;
    `);

  const lastPayout = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT TOP 1 Amount, ProcessedAt
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId AND Status = 'PAID'
      ORDER BY ProcessedAt DESC, PayoutRequestId DESC;
    `);

  const lifetimeEarning = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("CommissionRate", sql.Decimal(5, 2), commissionRate).query(`
    SELECT
      ISNULL(SUM(ISNULL(i.TechnicianCommissionAmount, i.FinalAmount * @CommissionRate)), 0) AS LifetimeCommission,
      ISNULL(SUM(ISNULL(i.TechnicianTipAmount, 0)), 0) AS LifetimeTips
    FROM Appointments a
    JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    OUTER APPLY (
      SELECT TOP 1 p.Status
      FROM Payments p
      WHERE p.InvoiceId = i.InvoiceId
      ORDER BY p.CreatedAt DESC, p.PaymentId DESC
    ) latestPayment
    WHERE a.EmployeeId = @EmployeeId
      AND a.Status = 'COMPLETED'
      AND latestPayment.Status = 'PAID';
  `);

  const ov = overview.recordset[0] || {};
  const pendingAmount = Number(payoutSummary.recordset[0]?.PendingAmount || 0);
  const paidAmount = Number(payoutSummary.recordset[0]?.PaidAmount || 0);
  const monthlyGoal = Number(goal.recordset[0]?.MonthlyGoal || 8000000);

  const lifetimeCommission = Number(
    lifetimeEarning.recordset[0]?.LifetimeCommission || 0,
  );
  const lifetimeTips = Number(lifetimeEarning.recordset[0]?.LifetimeTips || 0);

  const availableBalance = Math.max(
    0,
    lifetimeCommission + lifetimeTips - pendingAmount - paidAmount,
  );

  return {
    range,
    fromDate,
    toDate,
    overview: ov,
    daily: daily.recordset,
    serviceCategory: serviceCategory.recordset,
    topServices: topServices.recordset,
    yearSummary: yearSummary.recordset[0] || {},
    payout: {
      availableBalance,
      pendingPayout: pendingAmount,
      paidPayout: paidAmount,
      lastPayout: Number(lastPayout.recordset[0]?.Amount || 0),
      monthlyGoal,
      lastProcessedAt: lastPayout.recordset[0]?.ProcessedAt || null,
    },
  };
}

async function getProfile(userId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const profile = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        e.EmployeeId,
        CONCAT('#TEC-', FORMAT(e.EmployeeId, '0000')) AS TechnicianCode,
        u.FullName,
        u.Email,
        u.Phone,
        ISNULL(e.ImageUrl, u.AvatarUrl) AS AvatarUrl,
        u.Status,
        u.IsVerified,
        u.CreatedAt,
        u.UpdatedAt,
        e.Position,
        e.Specialization,
        e.YearsOfExperience AS ExperienceYears,
        e.Bio,
        e.HireDate,
        e.Status AS EmployeeStatus
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE e.EmployeeId = @EmployeeId
    `);

  const profileRow = profile.recordset[0];

  if (!profileRow) {
    throw new Error("Không tìm thấy hồ sơ kỹ thuật viên");
  }

  const stats = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        COUNT(*) AS TotalAppointments,
        SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments,
        COUNT(DISTINCT CustomerId) AS HappyClients
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
    `);

  const rating = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        ISNULL(AVG(CAST(ISNULL(TechnicianRating, Rating) AS FLOAT)), 0) AS AverageRating,
        COUNT(*) AS ReviewCount
      FROM Reviews
      WHERE EmployeeId = @EmployeeId
        AND Status = 'APPROVED'
    `);

  const skills = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        s.ServiceName AS name,
        CAST(
          CASE 
            WHEN COUNT(a.AppointmentId) >= 20 THEN 95
            WHEN COUNT(a.AppointmentId) >= 10 THEN 90
            WHEN COUNT(a.AppointmentId) >= 5 THEN 85
            WHEN COUNT(a.AppointmentId) >= 1 THEN 75
            ELSE 60
          END AS INT
        ) AS [percent],
        COUNT(a.AppointmentId) AS totalAppointments
      FROM EmployeeServices es
      JOIN Services s ON es.ServiceId = s.ServiceId
      LEFT JOIN AppointmentServices aps ON s.ServiceId = aps.ServiceId
      LEFT JOIN Appointments a 
        ON aps.AppointmentId = a.AppointmentId
        AND a.EmployeeId = @EmployeeId
        AND a.Status = 'COMPLETED'
      WHERE es.EmployeeId = @EmployeeId
      GROUP BY s.ServiceName
      ORDER BY totalAppointments DESC, s.ServiceName
    `);

  const workingHours = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT TOP 7
        FORMAT(ShiftDate, 'dddd') AS day,
        CASE 
          WHEN IsDayOff = 1 THEN 'Day off'
          ELSE CONCAT(
            FORMAT(CAST(StartTime AS DATETIME), 'h:mm tt'),
            ' - ',
            FORMAT(CAST(EndTime AS DATETIME), 'h:mm tt')
          )
        END AS time,
        ShiftDate
      FROM WorkShifts
      WHERE EmployeeId = @EmployeeId
      ORDER BY ShiftDate DESC
    `);

  const attachments = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT TOP 4
        tna.AttachmentId AS DocumentId,
        tna.FileName AS name,
        tna.FileType AS type,
        tna.FileUrl,
        tna.UploadedAt AS createdAt
      FROM TreatmentNoteAttachments tna
      JOIN TreatmentNotes tn ON tna.NoteId = tn.NoteId
      JOIN Appointments a ON tn.AppointmentId = a.AppointmentId
      WHERE a.EmployeeId = @EmployeeId
      ORDER BY tna.UploadedAt DESC
    `);

  const ratingRow = rating.recordset[0] || {};
  const statsRow = stats.recordset[0] || {};

  const satisfaction =
    Number(ratingRow.ReviewCount || 0) > 0
      ? Math.round((Number(ratingRow.AverageRating || 0) / 5) * 100)
      : 0;

  return {
    profile: profileRow,
    stats: {
      ...statsRow,
      ClientSatisfaction: satisfaction,
    },
    rating: ratingRow,
    skills: skills.recordset,
    workingHours: workingHours.recordset,
    documents: attachments.recordset,
  };
}

async function updateAvatar(userId, file) {
  if (!file) {
    throw new Error("Vui lòng chọn ảnh đại diện");
  }

  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    throw new Error("Chỉ được upload file ảnh");
  }

  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const avatarUrl = `/uploads/technician-avatars/${file.filename}`;

  await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AvatarUrl", sql.NVarChar(255), avatarUrl).query(`
      UPDATE Employees
      SET ImageUrl = @AvatarUrl
      WHERE EmployeeId = @EmployeeId;
    `);

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AvatarUrl", sql.NVarChar(255), avatarUrl).query(`
      UPDATE Users
      SET AvatarUrl = @AvatarUrl,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId;
    `);

  return getProfile(userId);
}

async function updateProfile(userId, body) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const specialization = String(body.specialization || "").trim() || null;
  const bio = String(body.bio || "").trim() || null;

  if (!fullName) {
    throw new Error("Họ tên không được để trống");
  }

  if (fullName.length > 100) {
    throw new Error("Họ tên tối đa 100 ký tự");
  }

  if (phone && phone.length > 20) {
    throw new Error("Số điện thoại không hợp lệ");
  }

  if (specialization && specialization.length > 255) {
    throw new Error("Chuyên môn tối đa 255 ký tự");
  }

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("FullName", sql.NVarChar(100), fullName)
    .input("Phone", sql.NVarChar(20), phone).query(`
      UPDATE Users
      SET FullName = @FullName,
          Phone = @Phone,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId;
    `);

  await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Specialization", sql.NVarChar(255), specialization)
    .input("Bio", sql.NVarChar(sql.MAX), bio).query(`
      UPDATE Employees
      SET Specialization = @Specialization,
          Bio = @Bio,
          UpdatedAt = GETDATE()
      WHERE EmployeeId = @EmployeeId;
    `);

  return getProfile(userId);
}

async function getEarningPayoutHistory(userId, query = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const offset = (page - 1) * limit;

  const count = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT COUNT(1) AS Total
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId;
    `);

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Offset", sql.Int, offset)
    .input("Limit", sql.Int, limit).query(`
      SELECT
        PayoutRequestId,
        Amount,
        Status,
        Note,
        RequestedAt,
        ProcessedAt,
        UpdatedAt
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId
      ORDER BY RequestedAt DESC, PayoutRequestId DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
    `);

  const total = Number(count.recordset[0]?.Total || 0);

  return {
    items: result.recordset,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function updateEarningGoal(userId, body = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const monthlyGoal = Number(body.monthlyGoal);

  if (!Number.isFinite(monthlyGoal) || monthlyGoal < 0) {
    throw new Error("Mục tiêu tháng không hợp lệ");
  }

  await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("MonthlyGoal", sql.Decimal(18, 2), monthlyGoal).query(`
      IF EXISTS (
        SELECT 1
        FROM TechnicianEarningGoals
        WHERE EmployeeId = @EmployeeId
      )
      BEGIN
        UPDATE TechnicianEarningGoals
        SET MonthlyGoal = @MonthlyGoal,
            Active = 1,
            UpdatedAt = GETDATE()
        WHERE EmployeeId = @EmployeeId;
      END
      ELSE
      BEGIN
        INSERT INTO TechnicianEarningGoals (EmployeeId, MonthlyGoal, Active)
        VALUES (@EmployeeId, @MonthlyGoal, 1);
      END
    `);

  return {
    message: "Cập nhật mục tiêu earning thành công",
    monthlyGoal,
  };
}

async function createPayoutRequest(userId, body = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const amount = Number(body.amount || 0);
  const note = String(body.note || "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Số tiền yêu cầu payout không hợp lệ");
  }

  const earningData = await getEarnings(userId, { range: "year" });
  const availableBalance = Number(earningData.payout?.availableBalance || 0);

  if (amount > availableBalance) {
    throw new Error("Số tiền payout vượt quá số dư khả dụng");
  }

  const created = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Amount", sql.Decimal(18, 2), amount)
    .input("Note", sql.NVarChar(sql.MAX), note).query(`
      INSERT INTO TechnicianPayoutRequests (EmployeeId, Amount, Note)
      OUTPUT
        INSERTED.PayoutRequestId,
        INSERTED.Amount,
        INSERTED.Status,
        INSERTED.Note,
        INSERTED.RequestedAt
      VALUES (@EmployeeId, @Amount, @Note);
    `);

  return created.recordset[0];
}

module.exports = {
  getDashboard,
  getSchedule,
  startAppointment,
  completeAppointment,
  getAppointmentDetail,
  markNoShow,
  addTreatmentNote,
  getAppointments,
  getAppointmentsSummary,
  getCustomers,
  getCustomersSummary,
  getCustomerDetail,
  getTreatmentNotesPage,
  saveTreatmentNote,
  getCustomerNoteHistory,
  deleteTreatmentNote,
  getEarnings,
  getEarningPayoutHistory,
  updateEarningGoal,
  createPayoutRequest,
  getProfile,
  updateProfile,
  updateAvatar,
  uploadTreatmentAttachments,
  updateTreatmentProgress,
};
