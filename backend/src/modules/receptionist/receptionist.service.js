const { sql, connectDB } = require("../../config/db");
const { getServiceById } = require("../appointments/appointments.service");

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function parseServiceIds(input = {}) {
  const raw =
    input.serviceIds ||
    input.ServiceIds ||
    input.serviceId ||
    input.ServiceId ||
    "";

  const arr = Array.isArray(raw) ? raw : String(raw).split(",");

  return arr
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function getSelectedServices(pool, serviceIds = []) {
  if (!serviceIds.length) {
    throw new Error("Vui lòng chọn ít nhất 1 dịch vụ");
  }

  const serviceIdsText = serviceIds.join(",");

  const result = await pool
    .request()
    .input("ServiceIds", sql.VarChar, serviceIdsText).query(`
      SELECT
        ServiceId,
        ServiceName,
        Price,
        DurationMinutes,
        Status
      FROM Services
      WHERE ServiceId IN (
        SELECT TRY_CAST(value AS INT)
        FROM STRING_SPLIT(@ServiceIds, ',')
      )
      AND UPPER(ISNULL(Status, 'AVAILABLE')) IN ('AVAILABLE', 'ACTIVE')
    `);

  const services = result.recordset || [];

  if (services.length !== serviceIds.length) {
    throw new Error(
      "Một hoặc nhiều dịch vụ không tồn tại hoặc đã ngừng hoạt động",
    );
  }

  const totalDuration = services.reduce(
    (sum, s) => sum + Number(s.DurationMinutes || 30),
    0,
  );

  const totalAmount = services.reduce(
    (sum, s) => sum + Number(s.Price || 0),
    0,
  );

  return {
    services,
    totalDuration,
    totalAmount,
  };
}

function addMinutesLocal(time, minutes) {
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + Number(minutes || 30);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function ensureFutureAppointmentLocal(appointmentDate, startTime) {
  const selected = new Date(
    `${appointmentDate}T${String(startTime).slice(0, 5)}:00`,
  );
  const now = new Date();

  if (Number.isNaN(selected.getTime())) {
    throw new Error("Ngày giờ hẹn không hợp lệ");
  }

  if (selected <= now) {
    throw new Error("Không được tạo lịch hẹn trong quá khứ");
  }
}

async function addStatusHistory(
  poolOrTransaction,
  appointmentId,
  oldStatus,
  newStatus,
  changedBy = null,
  reason = null,
) {
  try {
    await new sql.Request(poolOrTransaction)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("OldStatus", sql.NVarChar, oldStatus || null)
      .input("NewStatus", sql.NVarChar, newStatus)
      .input("ChangedBy", sql.Int, changedBy || null)
      .input("Reason", sql.NVarChar, reason || null).query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason)
        VALUES
          (@AppointmentId, @OldStatus, @NewStatus, @ChangedBy, @Reason)
      `);
  } catch (_) {}
}

async function getDashboard() {
  const pool = await connectDB();

  const stats = await pool.request().query(`
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today) AS todayAppointmentsCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status IN ('PENDING', 'PENDING_PAYMENT')) AS pendingCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status = 'CONFIRMED') AS confirmedCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status = 'IN_PROGRESS') AS inProgressCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status = 'NO_SHOW') AS noShowCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status = 'COMPLETED') AS completedCount,
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = @Today AND Status = 'CANCELLED') AS cancelledCount,
      (SELECT COUNT(*) FROM Appointments WHERE Status = 'REFUND_PENDING') AS refundPendingCount,
      ISNULL((
        SELECT SUM(p.Amount)
        FROM Payments p
        JOIN Invoices i ON p.InvoiceId = i.InvoiceId
        WHERE p.Status = 'PAID'
          AND CAST(ISNULL(p.PaidAt, p.CreatedAt) AS DATE) = @Today
      ), 0) AS todayRevenue,
      (SELECT COUNT(*) FROM Invoices) AS invoiceCount,
      (SELECT COUNT(*) FROM Payments WHERE Status = 'PAID') AS paidInvoiceCount,
      (SELECT COUNT(*) FROM Payments WHERE Status <> 'PAID') AS unpaidInvoiceCount,
      (SELECT COUNT(*) FROM WaitingList WHERE Status = 'WAITING') AS waitingListCount
  `);

  const todayAppointments = await pool.request().query(`
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT TOP 10
      a.AppointmentId,
      a.CustomerId,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      eu.FullName AS TechnicianName,
      cu.AvatarUrl AS CustomerAvatarUrl,
ISNULL(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
a.CreatedAt,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status,
      ISNULL(i.FinalAmount, 0) AS FinalAmount
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    WHERE a.AppointmentDate = @Today
    ORDER BY a.CreatedAt DESC, a.AppointmentId DESC
  `);

  const recentCheckIns = await pool.request().query(`
    SELECT TOP 10
      a.AppointmentId,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      eu.FullName AS TechnicianName,
      cu.AvatarUrl AS CustomerAvatarUrl,
ISNULL(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
a.UpdatedAt,
      a.Status,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    WHERE a.Status IN ('IN_PROGRESS', 'COMPLETED')
    ORDER BY a.UpdatedAt DESC, a.AppointmentId DESC
  `);

  const pendingRefunds = await pool.request().query(`
    SELECT TOP 10
      r.RefundId,
      r.RefundAmount,
      r.Reason,
      r.Status AS RefundStatus,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone
    FROM Refunds r
    JOIN Payments p ON r.PaymentId = p.PaymentId
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    WHERE r.Status = 'PENDING'
    ORDER BY r.CreatedAt DESC
  `);

  return {
    ...(stats.recordset[0] || {}),
    todayAppointments: todayAppointments.recordset || [],
    upcomingAppointments: todayAppointments.recordset || [],
    recentCheckIns: recentCheckIns.recordset || [],
    pendingRefunds: pendingRefunds.recordset || [],
  };
}

async function getAppointments(filters = {}) {
  const pool = await connectDB();

  const date = normalizeDateOnly(filters.date || filters.appointmentDate);
  const status = normalizeText(filters.status).toUpperCase();
  const customerKeyword = normalizeText(filters.customer || filters.keyword);
  const technicianId = filters.technicianId
    ? Number(filters.technicianId)
    : null;
  const serviceId = filters.serviceId ? Number(filters.serviceId) : null;
  const paymentStatus = normalizeText(filters.paymentStatus).toUpperCase();

  const result = await pool
    .request()
    .input("DateFilter", sql.Date, date)
    .input("StatusFilter", sql.NVarChar, status || null)
    .input("CustomerKeyword", sql.NVarChar, customerKeyword || null)
    .input("TechnicianId", sql.Int, technicianId)
    .input("ServiceId", sql.Int, serviceId)
    .input("PaymentStatus", sql.NVarChar, paymentStatus || null).query(`
      SELECT
        a.AppointmentId,
        a.CustomerId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatarUrl,
ISNULL(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        s.ServiceName,
        s.ServiceId,
        a.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
        ISNULL(i.FinalAmount, ISNULL(i.TotalAmount, 0)) AS FinalAmount,
        a.CreatedAt
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId

      OUTER APPLY (
        SELECT TOP 1
          aps.ServiceId,
          ss.ServiceName
        FROM AppointmentServices aps
        JOIN Services ss ON aps.ServiceId = ss.ServiceId
        WHERE aps.AppointmentId = a.AppointmentId
        ORDER BY aps.AppointmentServiceId ASC
      ) s

      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId

      OUTER APPLY (
        SELECT TOP 1
          p2.Status
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY
          CASE
            WHEN p2.Status = 'PAID' THEN 1
            WHEN p2.Status = 'PENDING' THEN 2
            WHEN p2.Status = 'REFUND_PENDING' THEN 3
            WHEN p2.Status = 'REFUNDED' THEN 4
            ELSE 5
          END,
          p2.PaymentId DESC
      ) p

      WHERE
        (@DateFilter IS NULL OR a.AppointmentDate = @DateFilter)
        AND (@StatusFilter IS NULL OR UPPER(a.Status) = @StatusFilter)
        AND (@TechnicianId IS NULL OR a.EmployeeId = @TechnicianId)
        AND (@ServiceId IS NULL OR s.ServiceId = @ServiceId)
        AND (@PaymentStatus IS NULL OR ISNULL(p.Status, 'UNPAID') = @PaymentStatus)
        AND (
          @CustomerKeyword IS NULL
          OR cu.FullName LIKE '%' + @CustomerKeyword + '%'
          OR cu.Phone LIKE '%' + @CustomerKeyword + '%'
          OR cu.Email LIKE '%' + @CustomerKeyword + '%'
        )
      ORDER BY a.CreatedAt DESC, a.AppointmentId DESC
    `);

  return result.recordset || [];
}

async function getAppointmentById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
    SELECT
      a.AppointmentId,
      a.CustomerId,
      a.EmployeeId AS TechnicianId,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status,
      a.Notes,
      a.CancelReason,
      a.CreatedAt,
      a.UpdatedAt,
      cu.FullName AS CustomerName,
      cu.Email AS CustomerEmail,
      cu.Phone AS CustomerPhone,
      cu.AvatarUrl AS CustomerAvatarUrl,
      eu.FullName AS TechnicianName,
      eu.Email AS TechnicianEmail,
      eu.Phone AS TechnicianPhone,
      e.Position,
      e.Specialization,
      e.ImageUrl AS TechnicianImageUrl,
      ISNULL(i.InvoiceId, NULL) AS InvoiceId,
      ISNULL(i.TotalAmount, 0) AS TotalAmount,
      ISNULL(i.DiscountAmount, 0) AS DiscountAmount,
      ISNULL(i.FinalAmount, 0) AS FinalAmount,
      ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
      p.PaymentMethod,
      p.TransactionCode,
      p.PaidAt,
      STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
      STRING_AGG(CAST(s.ServiceId AS NVARCHAR(20)), N',') AS ServiceIds
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    OUTER APPLY (
      SELECT TOP 1 p2.Status, p2.PaymentMethod, p2.TransactionCode, p2.PaidAt
      FROM Payments p2
      WHERE p2.InvoiceId = i.InvoiceId
      ORDER BY
        CASE WHEN p2.Status = 'PAID' THEN 1 WHEN p2.Status = 'PENDING' THEN 2 ELSE 3 END,
        p2.PaymentId DESC
    ) p
    WHERE a.AppointmentId = @AppointmentId
    GROUP BY
      a.AppointmentId,
      a.CustomerId,
      a.EmployeeId,
      a.AppointmentDate,
      a.StartTime,
      a.EndTime,
      a.Status,
      a.Notes,
      a.CancelReason,
      a.CreatedAt,
      a.UpdatedAt,
      cu.FullName,
      cu.Email,
      cu.Phone,
      cu.AvatarUrl,
      eu.FullName,
      eu.Email,
      eu.Phone,
      e.Position,
      e.Specialization,
      e.ImageUrl,
      i.InvoiceId,
      i.TotalAmount,
      i.DiscountAmount,
      i.FinalAmount,
      p.Status,
      p.PaymentMethod,
      p.TransactionCode,
      p.PaidAt
  `);

  const row = result.recordset[0] || null;
  if (!row) return null;

  const serviceRows = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
    SELECT
      aps.ServiceId,
      s.ServiceName,
      aps.Price
    FROM AppointmentServices aps
    JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE aps.AppointmentId = @AppointmentId
    ORDER BY aps.AppointmentServiceId DESC
  `);

  const statusHistory = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
    SELECT
      h.HistoryId,
      h.AppointmentId,
      h.OldStatus,
      h.NewStatus,
      h.Reason,
      h.ChangedAt,
      h.ChangedBy,
      ISNULL(u.FullName, N'System') AS ChangedByName
    FROM AppointmentStatusHistory h
    LEFT JOIN Users u ON h.ChangedBy = u.UserId
    WHERE h.AppointmentId = @AppointmentId
    ORDER BY h.ChangedAt DESC, h.HistoryId DESC
  `);

  return {
    ...row,
    Services: serviceRows.recordset || [],
    StatusHistory: statusHistory.recordset || [],
  };
}

async function confirmAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");

  const currentStatus = String(current.Status || "").toUpperCase();
  if (!["PENDING_PAYMENT", "PENDING"].includes(currentStatus)) {
    throw new Error("Chỉ được xác nhận lịch đang PENDING_PAYMENT hoặc PENDING");
  }

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'CONFIRMED',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    "CONFIRMED",
    userId,
    "Receptionist confirmed appointment",
  );

  await createReceptionistNotification(
    pool,
    "Appointment confirmed",
    `Lịch hẹn #${id} đã được xác nhận.`,
    "APPOINTMENT_CONFIRMED",
  );

  return await getAppointmentById(id);
}

async function checkInAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");
  if (String(current.Status).toUpperCase() !== "CONFIRMED") {
    throw new Error("Chỉ được check-in lịch đã xác nhận");
  }

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'CHECKED_IN',
          CheckedInAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    "CHECKED_IN",
    userId,
    "Receptionist checked in customer",
  );

  return await getAppointmentById(id);
}

async function startAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");
  if (String(current.Status).toUpperCase() !== "CHECKED_IN") {
    throw new Error("Chỉ được bắt đầu sau check-in");
  }

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'IN_PROGRESS',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    "IN_PROGRESS",
    userId,
    "Receptionist started service",
  );

  return await getAppointmentById(id);
}

async function completeAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");
  if (String(current.Status).toUpperCase() !== "IN_PROGRESS") {
    throw new Error("Chỉ được hoàn thành khi đang thực hiện");
  }

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'COMPLETED',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    "COMPLETED",
    userId,
    "Receptionist completed service",
  );

  return await getAppointmentById(id);
}

async function cancelAppointment(id, data = {}, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");

  const reason = normalizeText(data.reason);
  if (!reason) throw new Error("Vui lòng nhập lý do hủy");

  const isPaid = String(current.PaymentStatus || "").toUpperCase() === "PAID";
  const newStatus = isPaid ? "REFUND_PENDING" : "CANCELLED";

  await pool
    .request()
    .input("AppointmentId", sql.Int, id)
    .input("Status", sql.NVarChar, newStatus)
    .input("CancelReason", sql.NVarChar, reason).query(`
      UPDATE Appointments
      SET Status = @Status,
          CancelReason = @CancelReason,
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(pool, id, current.Status, newStatus, userId, reason);
  await createReceptionistNotification(
    pool,
    "Appointment bị hủy",
    `Lịch hẹn #${id} đã bị hủy.`,
    "APPOINTMENT_CANCELLED",
  );
  return await getAppointmentById(id);
}

async function noShowAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);

  const allowed = ["PENDING", "PENDING_PAYMENT", "CONFIRMED"];
  if (!current) throw new Error("Không tìm thấy lịch hẹn");
  if (!allowed.includes(String(current.Status).toUpperCase())) {
    throw new Error("Không thể đánh dấu No Show");
  }

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'NO_SHOW',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    "NO_SHOW",
    userId,
    "Receptionist marked customer as no-show",
  );

  return await getAppointmentById(id);
}

async function getServices() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      ServiceId,
      ServiceName,
      Price,
      DurationMinutes,
      ImageUrl,
      Status
    FROM Services
    WHERE UPPER(ISNULL(Status, 'AVAILABLE')) IN ('AVAILABLE', 'ACTIVE')
    ORDER BY ServiceName ASC
  `);

  return result.recordset;
}

async function getCustomers(keyword = "") {
  const pool = await connectDB();
  const kw = normalizeText(keyword);

  const result = await pool.request().input("Keyword", sql.NVarChar, kw || null)
    .query(`
      SELECT
      u.AvatarUrl,
c.CreatedAt,
c.UpdatedAt,
        c.CustomerId,
        u.FullName,
        u.Phone,
        u.Email,
        'Standard' AS MembershipLevel,
        0 AS Points
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE
        @Keyword IS NULL
        OR u.FullName LIKE '%' + @Keyword + '%'
        OR u.Phone LIKE '%' + @Keyword + '%'
        OR u.Email LIKE '%' + @Keyword + '%'
      ORDER BY ISNULL(c.UpdatedAt, c.CreatedAt) DESC, c.CustomerId DESC
    `);

  return result.recordset;
}

async function getCustomersSearch(keyword = "") {
  return getCustomers(keyword);
}

async function getCustomerById(id) {
  const pool = await connectDB();

  const profileResult = await pool.request().input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 1
        c.CustomerId,
        c.UserId,
        u.FullName,
        u.Phone,
        u.Email,
        u.AvatarUrl,
        u.Status AS UserStatus,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints AS Points,
        ISNULL(ml.LevelName, 'Standard') AS MembershipLevel,
        ISNULL(ml.DiscountPercent, 0) AS DiscountPercent,
        c.CreatedAt,
        c.UpdatedAt
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE c.CustomerId = @CustomerId
    `);

  const profile = profileResult.recordset[0];
  if (!profile) return null;

  const appointments = await pool.request().input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 50
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        a.Notes,
        a.CancelReason,
        eu.FullName AS TechnicianName,
        ISNULL(i.FinalAmount, 0) AS FinalAmount,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId
      GROUP BY
        a.AppointmentId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        a.Notes,
        a.CancelReason,
        eu.FullName,
        i.FinalAmount
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);

  const invoices = await pool.request().input("CustomerId", sql.Int, id).query(`
  SELECT TOP 50
    i.InvoiceId,
    i.AppointmentId,
    i.TotalAmount,
    i.DiscountAmount,
    i.FinalAmount,
    i.CreatedAt,
    a.AppointmentDate,
    a.Status AS AppointmentStatus,
    ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
    p.PaymentMethod,
    p.PaidAt,
    p.TransactionCode
  FROM Invoices i
  JOIN Appointments a ON i.AppointmentId = a.AppointmentId
  OUTER APPLY (
    SELECT TOP 1
      p2.Status,
      p2.PaymentMethod,
      p2.PaidAt,
      p2.TransactionCode
    FROM Payments p2
    WHERE p2.InvoiceId = i.InvoiceId
    ORDER BY
      CASE
        WHEN p2.Status = 'PAID' THEN 1
        WHEN p2.Status = 'PENDING' THEN 2
        ELSE 3
      END,
      p2.CreatedAt DESC,
      p2.PaymentId DESC
  ) p
  WHERE a.CustomerId = @CustomerId
  ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
`);

  const payments = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT TOP 50
        p.PaymentId,
        p.InvoiceId,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.TransactionCode,
        p.PaidAt,
        p.CreatedAt,
        a.AppointmentId,
        a.AppointmentDate
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
      ORDER BY p.CreatedAt DESC, p.PaymentId DESC
    `);

  const reviews = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT TOP 50
        r.ReviewId,
        r.AppointmentId,
        r.ServiceId,
        s.ServiceName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.CreatedAt,
        eu.FullName AS TechnicianName
      FROM Reviews r
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE r.CustomerId = @CustomerId
      ORDER BY r.CreatedAt DESC
    `);

  const feedbacks = await pool.request().input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 50
        FeedbackId,
        Subject,
        Content,
        Status,
        AdminResponse,
        CreatedAt,
        UpdatedAt
      FROM Feedbacks
      WHERE CustomerId = @CustomerId
      ORDER BY CreatedAt DESC
    `);

  const packages = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT TOP 50
        cp.CustomerPackageId,
        cp.PackageId,
        p.PackageName,
        p.SalePrice,
        cp.StartDate,
        cp.EndDate,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.Status,
        cp.CreatedAt,
        pp.Status AS PaymentStatus,
        pp.Amount AS PaidAmount
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      OUTER APPLY (
        SELECT TOP 1 *
        FROM PackagePayments pp
        WHERE pp.CustomerPackageId = cp.CustomerPackageId
        ORDER BY pp.CreatedAt DESC
      ) pp
      WHERE cp.CustomerId = @CustomerId
      ORDER BY cp.CreatedAt DESC
    `);

  const summary = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        COUNT(DISTINCT a.AppointmentId) AS TotalAppointments,
        SUM(CASE WHEN a.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments,
        SUM(ISNULL(i.FinalAmount, 0)) AS TotalSpent,
        MAX(a.AppointmentDate) AS LastVisitDate
      FROM Appointments a
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      WHERE a.CustomerId = @CustomerId
    `);

  return {
    Profile: profile,
    Membership: {
      MembershipLevel: profile.MembershipLevel,
      Points: profile.Points || 0,
      DiscountPercent: profile.DiscountPercent || 0,
    },
    Summary: summary.recordset[0] || {},
    Appointments: appointments.recordset || [],
    Invoices: invoices.recordset || [],
    Payments: payments.recordset || [],
    Reviews: reviews.recordset || [],
    Feedbacks: feedbacks.recordset || [],
    Packages: packages.recordset || [],
  };
}

async function createCustomer(data = {}) {
  const pool = await connectDB();

  const fullName = normalizeText(data.FullName || data.fullName);
  const phone = normalizeText(data.Phone || data.phone);
  const email = normalizeText(data.Email || data.email);
  const gender = normalizeText(data.Gender || data.gender);
  const dateOfBirth = data.DateOfBirth || data.dateOfBirth || null;
  const address = normalizeText(data.Address || data.address);

  if (!fullName) throw new Error("Vui lòng nhập họ tên khách hàng");
  if (!phone) throw new Error("Vui lòng nhập số điện thoại");

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const roleResult = await new sql.Request(tx).input(
      "RoleName",
      sql.NVarChar,
      "CUSTOMER",
    ).query(`
        SELECT TOP 1 RoleId
        FROM Roles
        WHERE UPPER(RoleName) = UPPER(@RoleName)
      `);

    const roleId = roleResult.recordset[0]?.RoleId;
    if (!roleId) throw new Error("Không tìm thấy role CUSTOMER");

    const userResult = await new sql.Request(tx)
      .input("FullName", sql.NVarChar, fullName)
      .input("Phone", sql.NVarChar, phone)
      .input("Email", sql.NVarChar, email || null)
      .input("PasswordHash", sql.NVarChar, "receptionist-created-account")
      .input("RoleId", sql.Int, roleId).query(`
        INSERT INTO Users
          (FullName, Phone, Email, PasswordHash, RoleId, Status, CreatedAt)
        OUTPUT INSERTED.UserId
        VALUES
          (@FullName, @Phone, @Email, @PasswordHash, @RoleId, 'ACTIVE', GETDATE())
      `);

    const userId = userResult.recordset[0].UserId;

    const customerResult = await new sql.Request(tx)
      .input("UserId", sql.Int, userId)
      .input("Gender", sql.NVarChar, gender || null)
      .input("DateOfBirth", sql.Date, dateOfBirth || null)
      .input("Address", sql.NVarChar, address || null).query(`
        INSERT INTO Customers
          (UserId, Gender, DateOfBirth, Address)
        OUTPUT INSERTED.CustomerId
        VALUES
          (@UserId, @Gender, @DateOfBirth, @Address)
      `);

    await tx.commit();

    return await getCustomerById(customerResult.recordset[0].CustomerId);
  } catch (err) {
    try {
      await tx.rollback();
    } catch (_) {}
    throw err;
  }
}

async function updateCustomer(id, data = {}) {
  const pool = await connectDB();

  await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .input("FullName", sql.NVarChar, data.FullName || data.fullName || null)
    .input("Phone", sql.NVarChar, data.Phone || data.phone || null)
    .input("Email", sql.NVarChar, data.Email || data.email || null)
    .input("Gender", sql.NVarChar, data.Gender || data.gender || null)
    .input(
      "DateOfBirth",
      sql.Date,
      data.DateOfBirth || data.dateOfBirth || null,
    )
    .input("Address", sql.NVarChar, data.Address || data.address || null)
    .query(`
      UPDATE u
      SET
        u.FullName = COALESCE(@FullName, u.FullName),
        u.Phone = COALESCE(@Phone, u.Phone),
        u.Email = COALESCE(@Email, u.Email)
      FROM Users u
      JOIN Customers c ON c.UserId = u.UserId
      WHERE c.CustomerId = @CustomerId;

      UPDATE Customers
      SET
        Gender = COALESCE(@Gender, Gender),
        DateOfBirth = COALESCE(@DateOfBirth, DateOfBirth),
        Address = COALESCE(@Address, Address)
      WHERE CustomerId = @CustomerId;
    `);

  return await getCustomerById(id);
}

async function getTechniciansForService(serviceId) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("ServiceId", sql.Int, serviceId ? Number(serviceId) : null).query(`
      SELECT DISTINCT
        e.EmployeeId AS TechnicianId,
        u.FullName,
        u.Phone,
        e.Specialization,
        ISNULL(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
u.AvatarUrl
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE e.Status = 'ACTIVE'
        AND (
          @ServiceId IS NULL
          OR EXISTS (
            SELECT 1
            FROM EmployeeServices es
            WHERE es.EmployeeId = e.EmployeeId
              AND es.ServiceId = @ServiceId
          )
        )
      ORDER BY u.FullName ASC
    `);

  return result.recordset;
}

async function getAvailableTechnicians({
  serviceId,
  serviceIds,
  ServiceId,
  ServiceIds,
  appointmentDate,
  startTime,
}) {
  const parsedServiceIds = parseServiceIds({
    serviceIds,
    ServiceIds,
    serviceId,
    ServiceId,
  });

  if (parsedServiceIds.length === 0) {
    throw new Error("serviceIds là bắt buộc");
  }

  if (!appointmentDate) {
    throw new Error("appointmentDate là bắt buộc");
  }

  if (!startTime) {
    throw new Error("startTime là bắt buộc");
  }

  const pool = await connectDB();

  const { totalDuration } = await getSelectedServices(pool, parsedServiceIds);

  const startTimeSql =
    String(startTime).length === 5 ? `${startTime}:00` : String(startTime);

  const endTime = addMinutesLocal(startTimeSql, totalDuration);
  const serviceCount = parsedServiceIds.length;

  const result = await pool
    .request()
    .input("ServiceIds", sql.VarChar, parsedServiceIds.join(","))
    .input("ServiceCount", sql.Int, serviceCount)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, startTimeSql)
    .input("EndTime", sql.VarChar, endTime).query(`
      SELECT
        e.EmployeeId,
        e.EmployeeId AS TechnicianId,
        u.FullName AS TechnicianName,
        u.FullName,
        u.Email AS TechnicianEmail,
        u.Phone AS TechnicianPhone,
        e.Position,
        e.Specialization,
        ISNULL(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
        u.AvatarUrl,
        e.Status AS TechnicianStatus
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE UPPER(ISNULL(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
        AND (
          SELECT COUNT(DISTINCT es.ServiceId)
          FROM EmployeeServices es
          WHERE es.EmployeeId = e.EmployeeId
            AND es.ServiceId IN (
              SELECT TRY_CAST(value AS INT)
              FROM STRING_SPLIT(@ServiceIds, ',')
            )
        ) = @ServiceCount
        AND NOT EXISTS (
          SELECT 1
          FROM Appointments a
          WHERE a.EmployeeId = e.EmployeeId
            AND a.AppointmentDate = @AppointmentDate
            AND UPPER(ISNULL(a.Status, '')) NOT IN (
              'CANCELLED',
              'REFUND_PENDING',
              'REFUNDED',
              'NO_SHOW'
            )
            AND (
              @StartTime < CONVERT(VARCHAR(8), a.EndTime, 108)
              AND @EndTime > CONVERT(VARCHAR(8), a.StartTime, 108)
            )
        )
      ORDER BY u.FullName ASC
    `);

  return result.recordset || [];
}

async function getAvailableSlots({
  serviceId,
  serviceIds,
  ServiceId,
  ServiceIds,
  appointmentDate,
}) {
  const parsedServiceIds = parseServiceIds({
    serviceIds,
    ServiceIds,
    serviceId,
    ServiceId,
  });

  if (parsedServiceIds.length === 0) {
    throw new Error("serviceIds là bắt buộc");
  }

  if (!appointmentDate) {
    throw new Error("appointmentDate là bắt buộc");
  }

  const pool = await connectDB();

  const { totalDuration } = await getSelectedServices(pool, parsedServiceIds);
  const serviceCount = parsedServiceIds.length;
  const slots = [];

  for (let minute = 8 * 60; minute + totalDuration <= 20 * 60; minute += 30) {
    const hh = Math.floor(minute / 60);
    const mm = minute % 60;

    const startTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(
      2,
      "0",
    )}:00`;

    const endTime = addMinutesLocal(startTime, totalDuration);

    const available = await pool
      .request()
      .input("ServiceIds", sql.VarChar, parsedServiceIds.join(","))
      .input("ServiceCount", sql.Int, serviceCount)
      .input("AppointmentDate", sql.Date, appointmentDate)
      .input("StartTime", sql.VarChar, startTime)
      .input("EndTime", sql.VarChar, endTime).query(`
        SELECT COUNT(*) AS AvailableTechnicianCount
        FROM Employees e
        WHERE UPPER(ISNULL(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
          AND (
            SELECT COUNT(DISTINCT es.ServiceId)
            FROM EmployeeServices es
            WHERE es.EmployeeId = e.EmployeeId
              AND es.ServiceId IN (
                SELECT TRY_CAST(value AS INT)
                FROM STRING_SPLIT(@ServiceIds, ',')
              )
          ) = @ServiceCount
          AND NOT EXISTS (
            SELECT 1
            FROM Appointments a
            WHERE a.EmployeeId = e.EmployeeId
              AND a.AppointmentDate = @AppointmentDate
              AND UPPER(ISNULL(a.Status, '')) NOT IN (
                'CANCELLED',
                'REFUND_PENDING',
                'REFUNDED',
                'NO_SHOW'
              )
              AND (
                @StartTime < CONVERT(VARCHAR(8), a.EndTime, 108)
                AND @EndTime > CONVERT(VARCHAR(8), a.StartTime, 108)
              )
          )
      `);

    const count = Number(available.recordset[0]?.AvailableTechnicianCount || 0);

    slots.push({
      startTime: startTime.slice(0, 5),
      endTime: endTime.slice(0, 5),
      availableTechnicianCount: count,
      available: count > 0,
    });
  }

  return slots;
}

async function rescheduleAppointment(id, data = {}, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");

  const appointmentDate = normalizeDateOnly(data.appointmentDate);
  const startTime = String(data.startTime || "").slice(0, 5);
  const technicianId = Number(data.technicianId || data.TechnicianId || 0);

  if (!appointmentDate) throw new Error("Vui lòng chọn ngày mới");
  if (!startTime) throw new Error("Vui lòng chọn giờ mới");
  if (!technicianId) throw new Error("Vui lòng chọn kỹ thuật viên");

  ensureFutureAppointmentLocal(appointmentDate, `${startTime}:00`);
  const serviceIds = (current.Services || [])
    .map((s) => Number(s.ServiceId))
    .filter((id) => Number.isInteger(id) && id > 0);

  const { totalDuration } = await getSelectedServices(pool, serviceIds);

  const endTime = addMinutesLocal(`${startTime}:00`, totalDuration);
  const busy = await pool
    .request()
    .input("AppointmentId", sql.Int, id)
    .input("EmployeeId", sql.Int, technicianId)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, `${startTime}:00`)
    .input("EndTime", sql.VarChar, endTime).query(`
    SELECT TOP 1 AppointmentId
    FROM Appointments
    WHERE EmployeeId = @EmployeeId
      AND AppointmentId <> @AppointmentId
      AND AppointmentDate = @AppointmentDate
      AND Status NOT IN
(
  'CANCELLED',
  'NO_SHOW',
  'REFUND_PENDING',
  'REFUNDED'
)
      AND StartTime < @EndTime
      AND EndTime > @StartTime
  `);

  if (busy.recordset.length) {
    throw new Error("Kỹ thuật viên đã có lịch trong khung giờ này");
  }
  await pool
    .request()
    .input("AppointmentId", sql.Int, id)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, `${startTime}:00`)
    .input("EndTime", sql.VarChar, endTime)
    .input("EmployeeId", sql.Int, technicianId).query(`
      UPDATE Appointments
      SET AppointmentDate = @AppointmentDate,
          StartTime = @StartTime,
          EndTime = @EndTime,
          EmployeeId = @EmployeeId,
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

  await addStatusHistory(
    pool,
    id,
    current.Status,
    current.Status,
    userId,
    "Receptionist rescheduled appointment",
  );

  await createReceptionistNotification(
    pool,
    "Appointment đổi lịch",
    `Lịch hẹn #${id} đã được đổi lịch.`,
    "APPOINTMENT_RESCHEDULED",
  );

  return await getAppointmentById(id);
}

async function createAppointment(data, userId = null) {
  const pool = await connectDB();

  const customerId = Number(data.customerId || data.CustomerId || 0);
  const serviceIds = parseServiceIds(data);
  const technicianId = Number(data.technicianId || data.TechnicianId || 0);

  const appointmentDate = normalizeDateOnly(
    data.appointmentDate || data.AppointmentDate,
  );

  const startTimeRaw = String(data.startTime || data.StartTime || "").slice(
    0,
    5,
  );

  const note = normalizeText(data.note || data.Notes || "");
  const paymentStatus = String(data.paymentStatus || "UNPAID").toUpperCase();
  const paymentMethod = String(data.paymentMethod || "CASH").toUpperCase();

  const isWalkIn =
    data.isWalkIn === true ||
    data.walkIn === true ||
    String(data.type || "").toUpperCase() === "WALK_IN";

  if (!customerId) throw new Error("Vui lòng chọn khách hàng");
  if (serviceIds.length === 0)
    throw new Error("Vui lòng chọn ít nhất 1 dịch vụ");
  if (!technicianId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");
  if (!startTimeRaw) throw new Error("Vui lòng chọn giờ bắt đầu");

  const {
    services: selectedServices,
    totalDuration,
    totalAmount,
  } = await getSelectedServices(pool, serviceIds);

  const startTime = `${startTimeRaw}:00`;
  const endTime = addMinutesLocal(startTime, totalDuration);

  ensureFutureAppointmentLocal(appointmentDate, startTime);

  const canDoAllServices = await pool
    .request()
    .input("TechnicianId", sql.Int, technicianId)
    .input("ServiceIds", sql.VarChar, serviceIds.join(","))
    .input("ServiceCount", sql.Int, serviceIds.length).query(`
      SELECT COUNT(DISTINCT es.ServiceId) AS MatchedServiceCount
      FROM EmployeeServices es
      WHERE es.EmployeeId = @TechnicianId
        AND es.ServiceId IN (
          SELECT TRY_CAST(value AS INT)
          FROM STRING_SPLIT(@ServiceIds, ',')
        )
    `);

  if (
    Number(canDoAllServices.recordset[0]?.MatchedServiceCount || 0) !==
    serviceIds.length
  ) {
    throw new Error("Kỹ thuật viên không làm được tất cả dịch vụ đã chọn");
  }

  const busy = await pool
    .request()
    .input("TechnicianId", sql.Int, technicianId)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, startTime)
    .input("EndTime", sql.VarChar, endTime).query(`
      SELECT TOP 1 1 AS Busy
      FROM Appointments
      WHERE EmployeeId = @TechnicianId
        AND AppointmentDate = @AppointmentDate
        AND UPPER(ISNULL(Status, '')) NOT IN (
          'CANCELLED',
          'REFUND_PENDING',
          'REFUNDED',
          'NO_SHOW'
        )
        AND (
          @StartTime < CONVERT(VARCHAR(8), EndTime, 108)
          AND @EndTime > CONVERT(VARCHAR(8), StartTime, 108)
        )
    `);

  if (busy.recordset[0]) {
    throw new Error("Kỹ thuật viên đã bận trong khung giờ này");
  }

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const appointmentResult = await new sql.Request(tx)
      .input("CustomerId", sql.Int, customerId)
      .input("EmployeeId", sql.Int, technicianId)
      .input("AppointmentDate", sql.Date, appointmentDate)
      .input("StartTime", sql.VarChar, startTime)
      .input("EndTime", sql.VarChar, endTime)
      .input("Status", sql.NVarChar, isWalkIn ? "CHECKED_IN" : "CONFIRMED")
      .input("Notes", sql.NVarChar, note || null).query(`
        INSERT INTO Appointments
          (
            CustomerId,
            EmployeeId,
            AppointmentDate,
            StartTime,
            EndTime,
            Status,
            Notes,
            CheckedInAt
          )
        OUTPUT INSERTED.*
        VALUES
          (
            @CustomerId,
            @EmployeeId,
            @AppointmentDate,
            @StartTime,
            @EndTime,
            @Status,
            @Notes,
            CASE WHEN @Status = 'CHECKED_IN' THEN GETDATE() ELSE NULL END
          )
      `);

    const appointment = appointmentResult.recordset[0];

    for (const service of selectedServices) {
      await new sql.Request(tx)
        .input("AppointmentId", sql.Int, appointment.AppointmentId)
        .input("ServiceId", sql.Int, service.ServiceId)
        .input("Price", sql.Decimal(18, 2), Number(service.Price || 0)).query(`
          INSERT INTO AppointmentServices
            (AppointmentId, ServiceId, Price)
          VALUES
            (@AppointmentId, @ServiceId, @Price)
        `);
    }

    const invoiceResult = await new sql.Request(tx)
      .input("AppointmentId", sql.Int, appointment.AppointmentId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("DiscountAmount", sql.Decimal(18, 2), 0)
      .input("FinalAmount", sql.Decimal(18, 2), totalAmount).query(`
        INSERT INTO Invoices
          (AppointmentId, TotalAmount, DiscountAmount, FinalAmount, Status)
        OUTPUT INSERTED.InvoiceId
        VALUES
          (
            @AppointmentId,
            @TotalAmount,
            @DiscountAmount,
            @FinalAmount,
            CASE WHEN @FinalAmount <= 0 THEN 'PAID' ELSE 'UNPAID' END
          )
      `);

    const invoiceId = invoiceResult.recordset[0].InvoiceId;

    await new sql.Request(tx)
      .input("InvoiceId", sql.Int, invoiceId)
      .input("Amount", sql.Decimal(18, 2), totalAmount)
      .input("PaymentMethod", sql.NVarChar, paymentMethod)
      .input(
        "Status",
        sql.NVarChar,
        paymentStatus === "PAID" ? "PAID" : "PENDING",
      )
      .input(
        "TransactionCode",
        sql.NVarChar,
        paymentStatus === "PAID" ? `COUNTER-${Date.now()}` : null,
      ).query(`
        INSERT INTO Payments
          (
            InvoiceId,
            Amount,
            PaymentMethod,
            Status,
            TransactionCode,
            PaidAt
          )
        VALUES
          (
            @InvoiceId,
            @Amount,
            @PaymentMethod,
            @Status,
            @TransactionCode,
            CASE WHEN @Status = 'PAID' THEN GETDATE() ELSE NULL END
          )
      `);

    if (paymentStatus === "PAID") {
      await new sql.Request(tx).input("InvoiceId", sql.Int, invoiceId).query(`
        UPDATE Invoices
        SET Status = 'PAID'
        WHERE InvoiceId = @InvoiceId
      `);
    }

    await addStatusHistory(
      tx,
      appointment.AppointmentId,
      null,
      isWalkIn ? "CHECKED_IN" : "CONFIRMED",
      userId,
      isWalkIn
        ? "Receptionist created walk-in appointment and checked in customer"
        : "Receptionist created appointment",
    );

    await createReceptionistNotification(
      tx,
      isWalkIn ? "Walk-in mới" : "Appointment mới",
      isWalkIn
        ? `Walk-in #${appointment.AppointmentId} đã được tạo và check-in.`
        : `Lịch hẹn #${appointment.AppointmentId} đã được tạo.`,
      isWalkIn ? "WALK_IN_CREATED" : "APPOINTMENT_CREATED",
    );

    await tx.commit();

    return await getAppointmentById(appointment.AppointmentId);
  } catch (err) {
    try {
      await tx.rollback();
    } catch (_) {}
    throw err;
  }
}

async function getInvoices(filters = {}) {
  const pool = await connectDB();
  const status = normalizeText(filters.status).toUpperCase();
  const date = normalizeDateOnly(filters.date);
  const customer = normalizeText(filters.customer);

  const result = await pool
    .request()
    .input("Status", sql.NVarChar, status || null)
    .input("DateFilter", sql.Date, date)
    .input("CustomerKeyword", sql.NVarChar, customer || null).query(`
      SELECT
        i.InvoiceId,
        i.AppointmentId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.AvatarUrl AS CustomerAvatarUrl,
        ISNULL(i.TotalAmount, 0) AS Total,
        ISNULL(i.DiscountAmount, 0) AS Discount,
        ISNULL(i.FinalAmount, 0) AS FinalAmount,
        ISNULL(i.Status, ISNULL(p.Status, 'UNPAID')) AS Status,
        i.CreatedAt,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      OUTER APPLY (
        SELECT TOP 1 p2.Status
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY p2.PaymentId DESC
      ) p
      WHERE
        (@Status IS NULL OR ISNULL(i.Status, ISNULL(p.Status, 'UNPAID')) = @Status)
        AND (@DateFilter IS NULL OR CAST(i.CreatedAt AS DATE) = @DateFilter)
        AND (
          @CustomerKeyword IS NULL
          OR cu.FullName LIKE '%' + @CustomerKeyword + '%'
          OR cu.Phone LIKE '%' + @CustomerKeyword + '%'
          OR cu.Email LIKE '%' + @CustomerKeyword + '%'
        )
      ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
    `);

  return result.recordset;
}

async function getInvoiceById(id) {
  const pool = await connectDB();

  const invoice = await pool.request().input("InvoiceId", sql.Int, id).query(`
    SELECT TOP 1
      i.InvoiceId,
      i.AppointmentId,
      ISNULL(i.TotalAmount, 0) AS Total,
      ISNULL(i.DiscountAmount, 0) AS Discount,
      ISNULL(i.FinalAmount, 0) AS FinalAmount,
      ISNULL(i.Status, 'UNPAID') AS Status,
      i.CreatedAt,

      a.CustomerId,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status AS AppointmentStatus,

      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      cu.Email AS CustomerEmail,

      eu.FullName AS TechnicianName
    FROM Invoices i
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    WHERE i.InvoiceId = @InvoiceId
  `);

  const row = invoice.recordset[0];
  if (!row) return null;

  const services = await pool
    .request()
    .input("AppointmentId", sql.Int, row.AppointmentId).query(`
    SELECT
      aps.ServiceId,
      s.ServiceName,
      aps.Price
    FROM AppointmentServices aps
    JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE aps.AppointmentId = @AppointmentId
    ORDER BY aps.AppointmentServiceId ASC
  `);

  const payments = await pool.request().input("InvoiceId", sql.Int, id).query(`
    SELECT
      PaymentId,
      InvoiceId,
      Amount,
      PaymentMethod,
      Status,
      TransactionCode,
      VnpTxnRef,
      VnpTransactionNo,
      VnpResponseCode,
      PaidAt,
      CreatedAt
    FROM Payments
    WHERE InvoiceId = @InvoiceId
    ORDER BY CreatedAt DESC, PaymentId DESC
  `);

  const refunds = await pool.request().input("InvoiceId", sql.Int, id).query(`
    SELECT
      r.RefundId,
      r.PaymentId,
      r.RefundAmount,
      r.Reason AS RefundReason,
      r.Status AS RefundStatus,
      r.CreatedAt,
      r.RefundedAt,
      p.PaymentMethod,
      p.TransactionCode
    FROM Refunds r
    JOIN Payments p ON r.PaymentId = p.PaymentId
    WHERE p.InvoiceId = @InvoiceId
    ORDER BY r.CreatedAt DESC, r.RefundId DESC
  `);

  const latestPayment = payments.recordset[0] || null;
  const latestRefund = refunds.recordset[0] || null;

  return {
    ...row,
    PaymentStatus: latestPayment?.Status || row.Status || "UNPAID",
    Services: services.recordset || [],

    PaymentInfo: latestPayment,
    RefundInfo: latestRefund,

    Payments: payments.recordset || [],
    Refunds: refunds.recordset || [],
  };
}

async function markInvoicePaid(id, method = "CASH", userId = null) {
  const pool = await connectDB();
  const current = await getInvoiceById(id);

  if (!current) throw new Error("Không tìm thấy hóa đơn");

  const status = String(current.PaymentStatus || "UNPAID").toUpperCase();
  if (status === "PAID") throw new Error("Hóa đơn đã được thanh toán");

  const paymentMethod = String(method || "CASH").toUpperCase();

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    await new sql.Request(tx)
      .input("InvoiceId", sql.Int, id)
      .input(
        "Amount",
        sql.Decimal(18, 2),
        current.FinalAmount || current.Total || 0,
      )
      .input("PaymentMethod", sql.NVarChar, paymentMethod)
      .input("TransactionCode", sql.NVarChar, `INV${id}_${Date.now()}`).query(`
        INSERT INTO Payments
          (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt)
        VALUES
          (@InvoiceId, @Amount, @PaymentMethod, 'PAID', @TransactionCode, GETDATE())
      `);

    await new sql.Request(tx).input("InvoiceId", sql.Int, id).query(`
        UPDATE Invoices
        SET Status = 'PAID'
        WHERE InvoiceId = @InvoiceId
      `);

    await new sql.Request(tx).input(
      "AppointmentId",
      sql.Int,
      current.AppointmentId,
    ).query(`
        UPDATE Appointments
        SET Status = CASE
          WHEN Status IN ('PENDING', 'PENDING_PAYMENT')
          THEN 'CONFIRMED'
          ELSE Status
        END,
        UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    if (["PENDING", "PENDING_PAYMENT"].includes(current.AppointmentStatus)) {
      await addStatusHistory(
        tx,
        current.AppointmentId,
        current.AppointmentStatus,
        "CONFIRMED",
        userId,
        "Invoice marked paid by receptionist",
      );
    }

    await createReceptionistNotification(
      tx,
      "Payment thành công",
      `Hóa đơn #${id} đã thanh toán thành công.`,
      "PAYMENT_SUCCESS",
    );

    await tx.commit();
    return await getInvoiceById(id);
  } catch (err) {
    try {
      await tx.rollback();
    } catch (_) {}
    throw err;
  }
}

async function requestRefund(id, data = {}, userId = null) {
  const pool = await connectDB();
  const current = await getInvoiceById(id);

  if (!current) throw new Error("Không tìm thấy hóa đơn");

  const reason = normalizeText(data.reason);
  const refundAmount = Number(
    data.refundAmount || current.FinalAmount || current.Total || 0,
  );

  if (!reason) throw new Error("Vui lòng nhập lý do hoàn tiền");
  if (refundAmount <= 0) throw new Error("Số tiền hoàn phải lớn hơn 0");

  if (
    !current.PaymentInfo ||
    String(current.PaymentInfo.Status).toUpperCase() !== "PAID"
  ) {
    throw new Error("Chỉ được hoàn tiền hóa đơn đã thanh toán");
  }

  if (refundAmount > Number(current.PaymentInfo.Amount || 0)) {
    throw new Error("Số tiền hoàn không được lớn hơn số tiền đã thanh toán");
  }

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const existed = await new sql.Request(tx).input(
      "PaymentId",
      sql.Int,
      current.PaymentInfo.PaymentId,
    ).query(`
        SELECT TOP 1 RefundId
        FROM Refunds
        WHERE PaymentId = @PaymentId
          AND Status IN ('PENDING', 'APPROVED', 'COMPLETED')
      `);

    if (existed.recordset[0]) {
      throw new Error("Hóa đơn này đã có yêu cầu hoàn tiền");
    }

    const refundResult = await new sql.Request(tx)
      .input("PaymentId", sql.Int, current.PaymentInfo.PaymentId)
      .input("RefundAmount", sql.Decimal(18, 2), refundAmount)
      .input("Reason", sql.NVarChar, reason)
      .input("Status", sql.NVarChar, "PENDING").query(`
        INSERT INTO Refunds
          (PaymentId, RefundAmount, Reason, Status)
        OUTPUT INSERTED.*
        VALUES
          (@PaymentId, @RefundAmount, @Reason, @Status)
      `);

    await new sql.Request(tx).input(
      "PaymentId",
      sql.Int,
      current.PaymentInfo.PaymentId,
    ).query(`
        UPDATE Payments
        SET Status = 'REFUND_PENDING'
        WHERE PaymentId = @PaymentId
      `);

    await new sql.Request(tx).input("InvoiceId", sql.Int, id).query(`
      UPDATE Invoices
      SET Status = 'REFUND_PENDING'
      WHERE InvoiceId = @InvoiceId
    `);

    await new sql.Request(tx).input(
      "AppointmentId",
      sql.Int,
      current.AppointmentId,
    ).query(`
        UPDATE Appointments
        SET
          Status = CASE
            WHEN Status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW')
            THEN Status
            ELSE 'REFUND_PENDING'
          END,
          UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await addStatusHistory(
      tx,
      current.AppointmentId,
      current.AppointmentStatus,
      "REFUND_PENDING",
      userId,
      `Receptionist requested refund: ${reason}`,
    );

    await tx.commit();

    return {
      Refund: refundResult.recordset[0],
      Invoice: await getInvoiceById(id),
    };
  } catch (err) {
    try {
      await tx.rollback();
    } catch (_) {}
    throw err;
  }
}

/* =========================
   WAITING LIST
========================= */

async function getWaitingList(filters = {}) {
  const pool = await connectDB();

  const status = normalizeText(filters.status).toUpperCase();
  const customer = normalizeText(filters.customer || filters.keyword);
  const serviceId = filters.serviceId ? Number(filters.serviceId) : null;
  const date = normalizeDateOnly(filters.date || filters.preferredDate);

  const result = await pool
    .request()
    .input("Status", sql.NVarChar, status || null)
    .input("CustomerKeyword", sql.NVarChar, customer || null)
    .input("ServiceId", sql.Int, serviceId)
    .input("PreferredDate", sql.Date, date).query(`
      SELECT
        w.WaitingId,
        w.CustomerId,
        u.FullName AS CustomerName,
        u.Phone AS CustomerPhone,
        u.Email AS CustomerEmail,
        u.AvatarUrl AS CustomerAvatarUrl,
        w.ServiceId,
        s.ServiceName,
        s.Price,
        s.DurationMinutes,
        w.PreferredDate,
        CONVERT(VARCHAR(5), w.PreferredTime, 108) AS PreferredTime,
        w.Status,
        w.CreatedAt,
        w.UpdatedAt,
        DATEDIFF(MINUTE, w.CreatedAt, GETDATE()) AS WaitingMinutes
      FROM WaitingList w
      JOIN Customers c ON w.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      JOIN Services s ON w.ServiceId = s.ServiceId
      WHERE
        (@Status IS NULL OR UPPER(w.Status) = @Status)
        AND (@ServiceId IS NULL OR w.ServiceId = @ServiceId)
        AND (@PreferredDate IS NULL OR w.PreferredDate = @PreferredDate)
        AND (
          @CustomerKeyword IS NULL
          OR u.FullName LIKE '%' + @CustomerKeyword + '%'
          OR u.Phone LIKE '%' + @CustomerKeyword + '%'
          OR u.Email LIKE '%' + @CustomerKeyword + '%'
        )
      ORDER BY w.CreatedAt DESC
    `);

  return result.recordset;
}

async function createWaitingList(data = {}) {
  const pool = await connectDB();

  const customerId = Number(data.customerId || data.CustomerId || 0);
  const serviceId = Number(data.serviceId || data.ServiceId || 0);
  const preferredDate = normalizeDateOnly(
    data.preferredDate || data.PreferredDate,
  );
  const rawTime = normalizeText(data.preferredTime || data.PreferredTime);
  const preferredTime = rawTime
    ? rawTime.length === 5
      ? `${rawTime}:00`
      : rawTime
    : null;

  if (!customerId) throw new Error("Vui lòng chọn khách hàng");
  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ");

  const duplicated = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("ServiceId", sql.Int, serviceId).query(`
      SELECT TOP 1 WaitingId
      FROM WaitingList
      WHERE CustomerId = @CustomerId
        AND ServiceId = @ServiceId
        AND Status IN ('WAITING', 'NOTIFIED')
    `);

  if (duplicated.recordset[0]) {
    throw new Error("Khách hàng này đang có yêu cầu chờ cho dịch vụ này");
  }

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("ServiceId", sql.Int, serviceId)
    .input("PreferredDate", sql.Date, preferredDate)
    .input("PreferredTime", sql.VarChar, preferredTime).query(`
      INSERT INTO WaitingList
        (CustomerId, ServiceId, PreferredDate, PreferredTime, Status)
      OUTPUT INSERTED.*
      VALUES (
        @CustomerId,
        @ServiceId,
        @PreferredDate,
        CASE
          WHEN @PreferredTime IS NULL OR @PreferredTime = ''
          THEN NULL
          ELSE CAST(@PreferredTime AS TIME)
        END,
        'WAITING'
      )
    `);

  return result.recordset[0];
}

async function updateWaitingList(id, data = {}) {
  const pool = await connectDB();

  const waitingId = Number(id);
  const status = normalizeText(data.status || data.Status).toUpperCase();

  if (!waitingId) throw new Error("WaitingId không hợp lệ");

  if (!["WAITING", "NOTIFIED", "BOOKED", "CANCELLED"].includes(status)) {
    throw new Error("Trạng thái waiting list không hợp lệ");
  }

  await pool
    .request()
    .input("WaitingId", sql.Int, waitingId)
    .input("Status", sql.NVarChar, status).query(`
      UPDATE WaitingList
      SET Status = @Status,
          UpdatedAt = GETDATE()
      WHERE WaitingId = @WaitingId
    `);

  return {
    WaitingId: waitingId,
    Status: status,
  };
}

async function deleteWaitingList(id) {
  return updateWaitingList(id, { status: "CANCELLED" });
}

async function getReceptionistNotifications(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT TOP 30
      NotificationId,
      UserId,
      Title,
      Content,
      Type,
      IsRead,
      CreatedAt
    FROM Notifications
    WHERE UserId = @UserId
    ORDER BY CreatedAt DESC, NotificationId DESC
  `);

  const unread = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT COUNT(*) AS UnreadCount
    FROM Notifications
    WHERE UserId = @UserId AND IsRead = 0
  `);

  return {
    UnreadCount: unread.recordset[0]?.UnreadCount || 0,
    Items: result.recordset || [],
  };
}

async function markNotificationRead(notificationId, userId) {
  const pool = await connectDB();

  await pool
    .request()
    .input("NotificationId", sql.Int, notificationId)
    .input("UserId", sql.Int, userId).query(`
      UPDATE Notifications
      SET IsRead = 1
      WHERE NotificationId = @NotificationId
        AND UserId = @UserId
    `);

  return { success: true };
}

async function createReceptionistNotification(
  poolOrTransaction,
  title,
  content,
  type = "RECEPTIONIST",
) {
  try {
    await new sql.Request(poolOrTransaction)
      .input("Title", sql.NVarChar, title)
      .input("Content", sql.NVarChar, content || null)
      .input("Type", sql.NVarChar, type).query(`
        INSERT INTO Notifications (UserId, Title, Content, Type)
        SELECT u.UserId, @Title, @Content, @Type
        FROM Users u
        JOIN Roles r ON u.RoleId = r.RoleId
        WHERE UPPER(r.RoleName) = 'RECEPTIONIST'
      `);
  } catch (_) {}
}

async function getReceptionistReviews(filters = {}) {
  const pool = await connectDB();

  const keyword = normalizeText(filters.keyword || filters.customer);
  const status = normalizeText(filters.status).toUpperCase();
  const rating = filters.rating ? Number(filters.rating) : null;
  const serviceId = filters.serviceId ? Number(filters.serviceId) : null;
  const technicianId = filters.technicianId
    ? Number(filters.technicianId)
    : null;
  const dateFrom = normalizeDateOnly(filters.dateFrom);
  const dateTo = normalizeDateOnly(filters.dateTo);

  const summary = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword || null)
    .input("Status", sql.NVarChar, status || null)
    .input("Rating", sql.Int, rating)
    .input("ServiceId", sql.Int, serviceId)
    .input("TechnicianId", sql.Int, technicianId)
    .input("DateFrom", sql.Date, dateFrom)
    .input("DateTo", sql.Date, dateTo).query(`
      SELECT
        COUNT(*) AS TotalReviews,
        ISNULL(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating,
        ISNULL(AVG(CAST(r.TechnicianRating AS FLOAT)), 0) AS AverageTechnicianRating,
        SUM(CASE WHEN r.Rating >= 4 THEN 1 ELSE 0 END) AS PositiveReviews,
        SUM(CASE WHEN r.Rating <= 2 THEN 1 ELSE 0 END) AS LowReviews
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE '%' + @Keyword + '%'
          OR cu.Phone LIKE '%' + @Keyword + '%'
          OR cu.Email LIKE '%' + @Keyword + '%'
          OR s.ServiceName LIKE '%' + @Keyword + '%'
          OR r.Comment LIKE '%' + @Keyword + '%')
        AND (@Status IS NULL OR UPPER(r.Status) = @Status)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@ServiceId IS NULL OR r.ServiceId = @ServiceId)
        AND (@TechnicianId IS NULL OR r.EmployeeId = @TechnicianId)
        AND (@DateFrom IS NULL OR CAST(r.CreatedAt AS DATE) >= @DateFrom)
        AND (@DateTo IS NULL OR CAST(r.CreatedAt AS DATE) <= @DateTo)
    `);

  const latest = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword || null)
    .input("Status", sql.NVarChar, status || null)
    .input("Rating", sql.Int, rating)
    .input("ServiceId", sql.Int, serviceId)
    .input("TechnicianId", sql.Int, technicianId)
    .input("DateFrom", sql.Date, dateFrom)
    .input("DateTo", sql.Date, dateTo).query(`
      SELECT TOP 1
        r.ReviewId,
        r.CustomerId,
        cu.FullName AS CustomerName,
        cu.AvatarUrl AS CustomerAvatarUrl,
ISNULL(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        r.AppointmentId,
        r.ServiceId,
        s.ServiceName,
        r.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.CreatedAt
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE '%' + @Keyword + '%'
          OR cu.Phone LIKE '%' + @Keyword + '%'
          OR cu.Email LIKE '%' + @Keyword + '%'
          OR s.ServiceName LIKE '%' + @Keyword + '%'
          OR r.Comment LIKE '%' + @Keyword + '%')
        AND (@Status IS NULL OR UPPER(r.Status) = @Status)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@ServiceId IS NULL OR r.ServiceId = @ServiceId)
        AND (@TechnicianId IS NULL OR r.EmployeeId = @TechnicianId)
        AND (@DateFrom IS NULL OR CAST(r.CreatedAt AS DATE) >= @DateFrom)
        AND (@DateTo IS NULL OR CAST(r.CreatedAt AS DATE) <= @DateTo)
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
    `);

  const serviceStats = await pool.request().query(`
    SELECT TOP 10
      s.ServiceId,
      s.ServiceName,
      COUNT(r.ReviewId) AS ReviewCount,
      ISNULL(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating
    FROM Services s
    LEFT JOIN Reviews r ON s.ServiceId = r.ServiceId
    GROUP BY s.ServiceId, s.ServiceName
    ORDER BY ReviewCount DESC, AverageRating DESC
  `);

  const reviews = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword || null)
    .input("Status", sql.NVarChar, status || null)
    .input("Rating", sql.Int, rating)
    .input("ServiceId", sql.Int, serviceId)
    .input("TechnicianId", sql.Int, technicianId)
    .input("DateFrom", sql.Date, dateFrom)
    .input("DateTo", sql.Date, dateTo).query(`
      SELECT TOP 200
        r.ReviewId,
        r.CustomerId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatarUrl,
ISNULL(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        r.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        r.ServiceId,
        s.ServiceName,
        r.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.AdminResponse,
        r.CreatedAt,
        r.UpdatedAt
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE '%' + @Keyword + '%'
          OR cu.Phone LIKE '%' + @Keyword + '%'
          OR cu.Email LIKE '%' + @Keyword + '%'
          OR s.ServiceName LIKE '%' + @Keyword + '%'
          OR r.Comment LIKE '%' + @Keyword + '%')
        AND (@Status IS NULL OR UPPER(r.Status) = @Status)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@ServiceId IS NULL OR r.ServiceId = @ServiceId)
        AND (@TechnicianId IS NULL OR r.EmployeeId = @TechnicianId)
        AND (@DateFrom IS NULL OR CAST(r.CreatedAt AS DATE) >= @DateFrom)
        AND (@DateTo IS NULL OR CAST(r.CreatedAt AS DATE) <= @DateTo)
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
    `);

  return {
    Summary: summary.recordset[0] || {},
    LatestReview: latest.recordset[0] || null,
    ServiceStats: serviceStats.recordset || [],
    Reviews: reviews.recordset || [],
  };
}

async function getReceptionistProfile(userId) {
  const pool = await connectDB();

  const profileResult = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT TOP 1
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.Status,
        u.IsVerified,
        u.CreatedAt,
        r.RoleName,
        e.EmployeeId,
        e.ImageUrl,
        e.Position,
        e.Bio,
        e.HireDate,
        e.Status AS EmployeeStatus
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Employees e ON u.UserId = e.UserId
      WHERE u.UserId = @UserId
    `);

  const profile = profileResult.recordset[0];
  if (!profile) throw new Error("Không tìm thấy hồ sơ receptionist");

  const today = new Date().toISOString().slice(0, 10);

  const statsResult = await pool.request().input("Today", sql.Date, today)
    .query(`
      SELECT
        (SELECT COUNT(*) FROM Appointments WHERE CAST(AppointmentDate AS DATE) = @Today) AS TodayAppointments,
        (SELECT COUNT(*) FROM Appointments WHERE CAST(AppointmentDate AS DATE) = @Today AND Status IN ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')) AS CheckedInToday,
        (SELECT COUNT(*) FROM Customers WHERE CAST(CreatedAt AS DATE) = @Today) AS CustomersCreated,
        (SELECT COUNT(*) FROM Invoices WHERE CAST(CreatedAt AS DATE) = @Today AND Status IN ('PAID', 'COMPLETED')) AS PaidInvoicesToday
    `);

  const recentAppointments = await pool.request().query(`
    SELECT TOP 6
      a.AppointmentId,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      a.Status,
      cu.FullName AS CustomerName
    FROM Appointments a
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN Users cu ON c.UserId = cu.UserId
    ORDER BY a.CreatedAt DESC, a.AppointmentId DESC
  `);

  const recentInvoices = await pool.request().query(`
    SELECT TOP 6
      i.InvoiceId,
      i.AppointmentId,
      i.Status,
      ISNULL(i.FinalAmount, i.TotalAmount) AS FinalAmount,
      cu.FullName AS CustomerName
    FROM Invoices i
    LEFT JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN Users cu ON c.UserId = cu.UserId
    ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
  `);

  return {
    profile: {
      ...profile,
      AvatarUrl: profile.ImageUrl || profile.AvatarUrl,
      Position: profile.Position || "Receptionist",
      Department: "Front Desk",
    },
    stats: statsResult.recordset[0] || {},
    recentAppointments: recentAppointments.recordset || [],
    recentInvoices: recentInvoices.recordset || [],
  };
}

async function updateReceptionistProfile(userId, body = {}) {
  const pool = await connectDB();

  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const position = String(body.position || "Receptionist").trim();
  const bio = String(body.bio || "").trim() || null;

  if (!fullName) throw new Error("Họ tên không được để trống");

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("FullName", sql.NVarChar(100), fullName)
    .input("Phone", sql.NVarChar(20), phone).query(`
      UPDATE Users
      SET FullName = @FullName,
          Phone = @Phone,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("Position", sql.NVarChar(100), position)
    .input("Bio", sql.NVarChar(sql.MAX), bio).query(`
      UPDATE Employees
      SET Position = @Position,
          Bio = @Bio,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return getReceptionistProfile(userId);
}

async function updateReceptionistAvatar(userId, file) {
  if (!file) throw new Error("Vui lòng chọn ảnh đại diện");

  const pool = await connectDB();
  const avatarUrl = `/uploads/receptionist-avatars/${file.filename}`;

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AvatarUrl", sql.NVarChar(255), avatarUrl).query(`
      UPDATE Users
      SET AvatarUrl = @AvatarUrl,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AvatarUrl", sql.NVarChar(255), avatarUrl).query(`
      UPDATE Employees
      SET ImageUrl = @AvatarUrl,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);

  return getReceptionistProfile(userId);
}

async function createWalkInAppointment(data, userId = null) {
  return createAppointment(
    {
      ...data,
      isWalkIn: true,
      walkIn: true,
      type: "WALK_IN",
    },
    userId,
  );
}

module.exports = {
  getDashboard,

  getAppointments,
  getAppointmentById,
  createAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  noShowAppointment,

  getAvailableTechnicians,
  getAvailableSlots,

  getCustomersSearch,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,

  getServices,
  getTechniciansForService,

  getInvoices,
  getInvoiceById,
  markInvoicePaid,
  requestRefund,

  getWaitingList,
  createWaitingList,
  updateWaitingList,
  deleteWaitingList,
  getReceptionistNotifications,
  markNotificationRead,
  createReceptionistNotification,
  getReceptionistReviews,
  getReceptionistProfile,
  updateReceptionistProfile,
  updateReceptionistAvatar,
  createWalkInAppointment,
};
