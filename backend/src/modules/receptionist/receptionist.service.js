const { sql, connectDB } = require("../../config/db");
const { getServiceById, deductComboSession } = require("../appointments/appointments.service");
const appointmentStateService = require("../appointments/appointment-state.service");
const eventBusService = require("../event-bus/eventBus.service");
const { addLoyaltyPoints, updateCustomerMembershipLevel, useLoyaltyPoints } = require("../../utils/membershipDiscount");

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
        SELECT CAST(value AS INT) FROM STRING_SPLIT(@ServiceIds, ',')
      )
      AND UPPER(COALESCE(Status, 'AVAILABLE')) IN ('AVAILABLE', 'ACTIVE')
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
    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE)) AS todayAppointmentsCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status IN ('PENDING', 'PENDING_PAYMENT')) AS pendingCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'CONFIRMED') AS confirmedCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'CHECKED_IN') AS checkedInCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'IN_PROGRESS') AS inProgressCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'NO_SHOW') AS noShowCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'COMPLETED') AS completedCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE) 
       AND Status = 'CANCELLED') AS cancelledCount,

      (SELECT COUNT(*) FROM Appointments 
       WHERE Status = 'REFUND_PENDING') AS refundPendingCount,

      COALESCE((
        SELECT SUM(p.Amount)
        FROM Payments p
        JOIN Invoices i ON p.InvoiceId = i.InvoiceId
        WHERE p.Status = 'PAID'
          AND CAST(COALESCE(p.PaidAt, p.CreatedAt) AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)
      ), 0) AS todayRevenue,

      (SELECT COUNT(*) FROM Invoices) AS invoiceCount,

      (SELECT COUNT(*) 
       FROM Invoices i
       WHERE i.Status = 'PAID'
          OR EXISTS (
            SELECT 1 
            FROM Payments p 
            WHERE p.InvoiceId = i.InvoiceId 
            AND p.Status = 'PAID'
          )) AS paidInvoiceCount,

      (SELECT COUNT(*) 
       FROM Invoices i
       WHERE COALESCE(i.Status, 'UNPAID') <> 'PAID'
         AND NOT EXISTS (
            SELECT 1 
            FROM Payments p 
            WHERE p.InvoiceId = i.InvoiceId 
            AND p.Status = 'PAID'
         )) AS unpaidInvoiceCount,

      (SELECT COUNT(*) FROM WaitingList WHERE Status = 'WAITING') AS waitingListCount,
      (SELECT COUNT(*) FROM WaitingList WHERE Status = 'WAITING' AND CAST(PreferredDate AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)) AS waitingTodayCount,
      (SELECT COUNT(*) FROM WaitingList WHERE Status = 'MATCHED' AND CAST(PreferredDate AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)) AS matchedTodayCount,
      (SELECT COUNT(*) FROM WaitingList WHERE Status = 'BOOKED' AND CAST(UpdatedAt AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)) AS bookedTodayCount,
      (SELECT COUNT(*) FROM WaitingList WHERE Status IN ('EXPIRED', 'SKIPPED') AND CAST(UpdatedAt AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)) AS expiredTodayCount
  `);

  const todayAppointments = await pool.request().query(`
    SELECT
      a.AppointmentId,
      a.CustomerId,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      cu.Email AS CustomerEmail,
      cu.AvatarUrl AS CustomerAvatarUrl,

      a.EmployeeId AS TechnicianId,
      eu.FullName AS TechnicianName,
      COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,

      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status,
      a.CreatedAt,
      a.UpdatedAt,

      COALESCE(i.FinalAmount, 0) AS FinalAmount,
      COALESCE(i.Status, 'UNPAID') AS InvoiceStatus,

      COALESCE(sv.ServiceNames, 'Chưa có dịch vụ') AS ServiceName,
      COALESCE(sv.TotalDuration, 0) AS TotalDuration
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    OUTER APPLY (

      SELECT
        STRING_AGG(s.ServiceName, ', ') AS ServiceNames,
        SUM(COALESCE(s.DurationMinutes, 0)) AS TotalDuration
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = a.AppointmentId
    
) sv
    WHERE a.AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE)
    ORDER BY a.StartTime ASC, a.AppointmentId DESC
      OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);

  const checkInQueue = await pool.request().query(`
    SELECT
      a.AppointmentId,
      a.CustomerId,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      cu.Email AS CustomerEmail,
      cu.AvatarUrl AS CustomerAvatarUrl,

      eu.FullName AS TechnicianName,
      COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,

      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status,

      COALESCE(sv.ServiceNames, 'Chưa có dịch vụ') AS ServiceName,
      COALESCE(sv.TotalDuration, 0) AS TotalDuration
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    OUTER APPLY (

      SELECT
        STRING_AGG(s.ServiceName, ', ') AS ServiceNames,
        SUM(COALESCE(s.DurationMinutes, 0)) AS TotalDuration
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = a.AppointmentId
    
) sv
    WHERE a.AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE)
      AND a.Status IN ('CONFIRMED', 'CHECKED_IN')
    ORDER BY a.StartTime ASC, a.AppointmentId ASC
      OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);

  const recentCheckIns = await pool.request().query(`
    SELECT
      a.AppointmentId,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      cu.AvatarUrl AS CustomerAvatarUrl,
      eu.FullName AS TechnicianName,
      COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
      a.UpdatedAt,
      a.Status,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      COALESCE(sv.ServiceNames, 'Chưa có dịch vụ') AS ServiceName
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    OUTER APPLY (

      SELECT STRING_AGG(s.ServiceName, ', ') AS ServiceNames
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = a.AppointmentId
    
) sv
    WHERE CAST(COALESCE(a.UpdatedAt, a.CreatedAt) AS DATE) = CAST(CURRENT_TIMESTAMP AS DATE)
      AND a.Status IN ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
    ORDER BY COALESCE(a.UpdatedAt, a.CreatedAt) DESC, a.AppointmentId DESC
      OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);

  const pendingRefunds = await pool.request().query(`
    SELECT
      r.RefundId,
      r.RefundAmount,
      r.Reason,
      r.Status AS RefundStatus,
      r.CreatedAt,
      cu.FullName AS CustomerName,
      cu.Phone AS CustomerPhone,
      cu.AvatarUrl AS CustomerAvatarUrl
    FROM Refunds r
    JOIN Payments p ON r.PaymentId = p.PaymentId
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    WHERE r.Status = 'PENDING'
    ORDER BY r.CreatedAt DESC, r.RefundId DESC
      OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);

  const popularServices = await pool.request().query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      COUNT(*) AS BookingCount
    FROM AppointmentServices aps
    JOIN Services s ON aps.ServiceId = s.ServiceId
    JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    WHERE a.AppointmentDate = CAST(CURRENT_TIMESTAMP AS DATE)
    GROUP BY s.ServiceId, s.ServiceName
    ORDER BY COUNT(*) DESC, s.ServiceName ASC
      OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`);

  const firstCustomer = await pool.request().query(`
    SELECT
      c.CustomerId,
      u.FullName,
      u.Phone,
      u.Email,
      u.AvatarUrl,
      u.CreatedAt AS MemberSince,
      COUNT(DISTINCT a.AppointmentId) AS TotalAppointments,
      COALESCE(SUM(CASE WHEN p.Status = 'PAID' THEN p.Amount ELSE 0 END), 0) AS TotalSpent
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN Appointments a ON c.CustomerId = a.CustomerId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN Payments p ON i.InvoiceId = p.InvoiceId
    GROUP BY c.CustomerId, u.FullName, u.Phone, u.Email, u.AvatarUrl, u.CreatedAt
    ORDER BY MAX(a.CreatedAt) DESC
      OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  return {
    ...(stats.recordset[0] || {}),
    todayAppointments: todayAppointments.recordset || [],
    upcomingAppointments: todayAppointments.recordset || [],
    checkInQueue: checkInQueue.recordset || [],
    recentCheckIns: recentCheckIns.recordset || [],
    pendingRefunds: pendingRefunds.recordset || [],
    popularServices: popularServices.recordset || [],
    highlightedCustomer: firstCustomer.recordset?.[0] || null,
  };
}

async function getAppointments(filters = {}) {
  const pool = await connectDB();

  const date = normalizeDateOnly(filters.date || filters.appointmentDate);
  const fromDate = normalizeDateOnly(filters.fromDate);
  const toDate = normalizeDateOnly(filters.toDate);
  const status = normalizeText(filters.status).toUpperCase();
  const customerKeyword = normalizeText(filters.customer || filters.keyword);
  const technicianId = filters.technicianId
    ? Number(filters.technicianId)
    : null;
  const serviceId = filters.serviceId ? Number(filters.serviceId) : null;
  const paymentStatus = normalizeText(filters.paymentStatus).toUpperCase();
  const branchId = filters.branchId ? Number(filters.branchId) : null;

  const result = await pool
    .request()
    .input("DateFilter", sql.Date, date)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("StatusFilter", sql.NVarChar, status || null)
    .input("CustomerKeyword", sql.NVarChar, customerKeyword || null)
    .input("TechnicianId", sql.Int, technicianId)
    .input("ServiceId", sql.Int, serviceId)
    .input("PaymentStatus", sql.NVarChar, paymentStatus || null)
    .input("BranchId", sql.Int, branchId).query(`
      SELECT
        a.AppointmentId,
        a.CustomerId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatarUrl,
        COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        s.ServiceName,
        s.ServiceId,
        a.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        COALESCE(p.Status, 'UNPAID') AS PaymentStatus,
        i.InvoiceId,
        COALESCE(i.FinalAmount, COALESCE(i.TotalAmount, 0)) AS FinalAmount,
        a.CreatedAt,
        a.CustomerPackageId,
        pkg.PackageName AS CustomerPackageName,
        COALESCE(a.BranchId, e.BranchId) AS BranchId,
        b.BranchName,
        (
          SELECT
            aps.AppointmentServiceId,
            aps.ServiceId,
            ss.ServiceName,
            ss.DurationMinutes,
            ISNULL(aps.Status, 'PENDING') AS Status,
            aps.EmployeeId,
            seu.FullName AS TechnicianName,
            COALESCE(se.ImageUrl, seu.AvatarUrl) AS TechnicianAvatar
          FROM AppointmentServices aps
          JOIN Services ss ON aps.ServiceId = ss.ServiceId
          LEFT JOIN Employees se ON aps.EmployeeId = se.EmployeeId
          LEFT JOIN Users seu ON se.UserId = seu.UserId
          WHERE aps.AppointmentId = a.AppointmentId
          ORDER BY aps.AppointmentServiceId ASC
          FOR JSON PATH
        ) AS ServicesJson
      FROM Appointments a

      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId
      LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId

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
            WHEN p2.Status = 'REFUND_PENDING' THEN 2
            WHEN p2.Status = 'REFUNDED' THEN 3
            WHEN p2.Status = 'PENDING' THEN 4
            WHEN p2.Status = 'FAILED' THEN 5
            ELSE 6
          END,
          p2.PaymentId DESC
      ) p

      WHERE
        (@DateFilter IS NULL OR a.AppointmentDate = @DateFilter)
        AND (@FromDate IS NULL OR a.AppointmentDate >= @FromDate)
        AND (@ToDate IS NULL OR a.AppointmentDate <= @ToDate)
        AND (@BranchId IS NULL OR COALESCE(a.BranchId, e.BranchId) = @BranchId)
        AND (@StatusFilter IS NULL OR UPPER(a.Status) = @StatusFilter)
        AND (@TechnicianId IS NULL OR a.EmployeeId = @TechnicianId)
        AND (@ServiceId IS NULL OR s.ServiceId = @ServiceId)
        AND (@PaymentStatus IS NULL OR COALESCE(p.Status, 'UNPAID') = @PaymentStatus)
        AND (
          @CustomerKeyword IS NULL
          OR cu.FullName LIKE '%' || @CustomerKeyword || '%'
          OR cu.Phone LIKE '%' || @CustomerKeyword || '%'
          OR cu.Email LIKE '%' || @CustomerKeyword || '%'
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
      a.CheckedOutAt,
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
      b.BranchName,
      b.Address AS BranchAddress,
      COALESCE(i.InvoiceId, NULL) AS InvoiceId,
      COALESCE(i.TotalAmount, 0) AS TotalAmount,
      COALESCE(i.DiscountAmount, 0) AS DiscountAmount,
      COALESCE(i.FinalAmount, 0) AS FinalAmount,
      COALESCE(p.Status, 'UNPAID') AS PaymentStatus,
      p.PaymentMethod,
      p.TransactionCode,
      p.PaidAt,
      STRING_AGG(s.ServiceName, ', ') AS ServiceNames,
      STRING_AGG(CAST(s.ServiceId AS VARCHAR(20)), ', ') AS ServiceIds,
      a.CustomerPackageId,
      pkg.PackageName AS CustomerPackageName
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
    LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    OUTER APPLY (
      SELECT TOP 1 p2.Status, p2.PaymentMethod, p2.TransactionCode, p2.PaidAt
      FROM Payments p2
      WHERE p2.InvoiceId = i.InvoiceId
      ORDER BY
        CASE WHEN p2.Status = 'PAID' THEN 1 WHEN p2.Status = 'REFUND_PENDING' THEN 2 WHEN p2.Status = 'REFUNDED' THEN 3 WHEN p2.Status = 'PENDING' THEN 4 WHEN p2.Status = 'FAILED' THEN 5 ELSE 6 END,
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
      a.CheckedOutAt,
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
      b.BranchName,
      b.Address,
      i.InvoiceId,
      i.TotalAmount,
      i.DiscountAmount,
      i.FinalAmount,
      p.Status,
      p.PaymentMethod,
      p.TransactionCode,
      p.PaidAt,
      a.CustomerPackageId,
      pkg.PackageName
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
      COALESCE(u.FullName, 'System') AS ChangedByName
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
          UpdatedAt = CURRENT_TIMESTAMP
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

  // Tự động finalize hồ sơ điều trị gốc liên kết với lịch tái khám này
  try {
    const treatmentNotesV2Service = require("../treatment-notes-v2/treatment-notes-v2.service");
    await treatmentNotesV2Service.finalizeByFollowUpAppointment(Number(id));
  } catch (finalizeErr) {
    console.warn("[receptionist confirm] Auto-finalize treatment note failed:", finalizeErr.message);
  }

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
  if (String(current.Status).toUpperCase() !== "CONFIRMED") {
    throw new Error("Chỉ được check-in lịch đã xác nhận");
  }
  const isComboAppt = !!(current.CustomerPackageId || current.CustomerPackageName);
  if (!isComboAppt && String(current.PaymentStatus).toUpperCase() !== "PAID" && Number(current.FinalAmount || 0) > 0) {
    throw new Error("Khách hàng chưa thanh toán. Vui lòng hoàn tất thanh toán trước khi check-in.");
  }



  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'CHECKED_IN',
          CheckedInAt = CURRENT_TIMESTAMP,
          UpdatedAt = CURRENT_TIMESTAMP
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

  // Validate state transition using state machine service
  appointmentStateService.validateTransition(current.Status, "IN_PROGRESS");

  await pool.request().input("AppointmentId", sql.Int, id).query(`
      UPDATE Appointments
      SET Status = 'IN_PROGRESS',
          UpdatedAt = CURRENT_TIMESTAMP
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
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const currentResult = await new sql.Request(transaction).input(
      "AppointmentId",
      sql.Int,
      id,
    ).query(`
        SELECT
          a.AppointmentId,
          a.Status,
          a.CustomerPackageId,
          a.EmployeeId,
          aps.ServiceId
        FROM Appointments a
        LEFT JOIN AppointmentServices aps
          ON a.AppointmentId = aps.AppointmentId
        WHERE a.AppointmentId = @AppointmentId
      `);

    const current = currentResult.recordset[0];
    if (!current) throw new Error("Không tìm thấy lịch hẹn");

    // Kiểm tra tất cả dịch vụ trong lịch hẹn đã hoàn thành chưa
    const servicesCheckResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .query(`
        SELECT 
          aps.AppointmentServiceId,
          s.ServiceName,
          ISNULL(aps.Status, 'PENDING') AS ServiceStatus
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
      `);

    const totalServices = servicesCheckResult.recordset.length;
    const incompleteServices = servicesCheckResult.recordset.filter(
      (s) => (s.ServiceStatus || 'PENDING') !== 'COMPLETED'
    );

    // Bắt buộc tất cả dịch vụ trong combo (hoặc lịch hẹn có nhiều dịch vụ) phải hoàn thành trước
    if ((current.CustomerPackageId || totalServices > 1) && incompleteServices.length > 0) {
      const incompleteNames = incompleteServices
        .map((s, i) => `${i + 1}. ${s.ServiceName}`)
        .join(", ");
      throw new Error(
        `Chưa thể hoàn thành lịch hẹn. Bạn phải hoàn thành tất cả các dịch vụ trong combo trước! Các dịch vụ chưa hoàn thành: ${incompleteNames}`
      );
    }

    // Validate state transition using state machine service
    appointmentStateService.validateTransition(current.Status, "COMPLETED");

    await new sql.Request(transaction).input("AppointmentId", sql.Int, id)
      .query(`
        UPDATE Appointments
        SET Status = 'COMPLETED',
            CompletedAt = CURRENT_TIMESTAMP,
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
          AND Status <> 'COMPLETED'
      `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("OldStatus", sql.NVarChar, current.Status)
      .input("UserId", sql.Int, userId).query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, 'COMPLETED', @UserId, 'Receptionist completed service', CURRENT_TIMESTAMP)
      `);

    // Calculate commission breakdown and total commission using ServiceCommissions rules
    const apptServicesResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(id))
      .query(`
        SELECT aps.ServiceId, aps.Price, COALESCE(sc.CommissionRate, 0.15) AS CommissionRate
        FROM AppointmentServices aps
        LEFT JOIN ServiceCommissions sc ON aps.ServiceId = sc.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
      `);

    const services = apptServicesResult.recordset;

    // Clear any existing earnings for this appointment to ensure idempotency
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(id))
      .query("DELETE FROM TechnicianServiceEarnings WHERE AppointmentId = @AppointmentId");

    let totalCommissionAmount = 0;

    for (const svc of services) {
      const price = Number(svc.Price || 0);
      const rate = Number(svc.CommissionRate || 0.15);
      const earningAmount = price * rate;
      totalCommissionAmount += earningAmount;

      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, Number(id))
        .input("EmployeeId", sql.Int, current.EmployeeId)
        .input("ServiceId", sql.Int, svc.ServiceId)
        .input("ServicePrice", sql.Decimal(18, 2), price)
        .input("CommissionRate", sql.Decimal(5, 2), rate)
        .input("EarningAmount", sql.Decimal(18, 2), earningAmount)
        .query(`
          INSERT INTO TechnicianServiceEarnings
          (AppointmentId, EmployeeId, ServiceId, ServicePrice, CommissionRate, EarningAmount, CreatedAt)
          VALUES
          (@AppointmentId, @EmployeeId, @ServiceId, @ServicePrice, @CommissionRate, @EarningAmount, CURRENT_TIMESTAMP)
        `);
    }

    // Update invoice & earnings if invoice exists
    const invoiceResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(id))
      .query(`
        SELECT InvoiceId
        FROM Invoices
        WHERE AppointmentId = @AppointmentId
      `);

    const invoice = invoiceResult.recordset[0];
    if (invoice) {
      // Update invoice status and aggregated commission amount
      // Invoice status is only set to PAID automatically if it is a package session booking
      await new sql.Request(transaction)
        .input("InvoiceId", sql.Int, invoice.InvoiceId)
        .input("CommissionAmount", sql.Decimal(18, 2), totalCommissionAmount)
        .input("IsPackage", sql.Int, current.CustomerPackageId ? 1 : 0)
        .query(`
          UPDATE Invoices
          SET Status = CASE 
                WHEN @IsPackage = 1 THEN 'PAID'
                ELSE Status 
              END,
              TechnicianCommissionAmount = @CommissionAmount,
              UpdatedAt = CURRENT_TIMESTAMP
          WHERE InvoiceId = @InvoiceId
        `);

      // Update or insert technician payout ledger record for earnings
      const ledgerCheck = await new sql.Request(transaction)
        .input("EmployeeId", sql.Int, current.EmployeeId)
        .input("AppointmentId", sql.Int, Number(id))
        .query(`
          SELECT LedgerId
          FROM TechnicianPayoutLedger
          WHERE EmployeeId = @EmployeeId
            AND ReferenceType = 'APPOINTMENT'
            AND ReferenceId = @AppointmentId
        `);

      if (ledgerCheck.recordset[0]) {
        await new sql.Request(transaction)
          .input("LedgerId", sql.Int, ledgerCheck.recordset[0].LedgerId)
          .input("Amount", sql.Decimal(18, 2), totalCommissionAmount)
          .query(`
            UPDATE TechnicianPayoutLedger
            SET Amount = @Amount,
                CreatedAt = CURRENT_TIMESTAMP
            WHERE LedgerId = @LedgerId
          `);
      } else {
        await new sql.Request(transaction)
          .input("EmployeeId", sql.Int, current.EmployeeId)
          .input("AppointmentId", sql.Int, Number(id))
          .input("Amount", sql.Decimal(18, 2), totalCommissionAmount)
          .query(`
            INSERT INTO TechnicianPayoutLedger
            (EmployeeId, ReferenceType, ReferenceId, Amount, EntryType, Description, CreatedAt)
            VALUES
            (@EmployeeId, 'APPOINTMENT', @AppointmentId, @Amount, 'EARNING', CONCAT(N'Hoa hồng hoàn thành lịch hẹn #', @AppointmentId), CURRENT_TIMESTAMP)
          `);
      }
    }

    if (current.CustomerPackageId) {
      const usageCheck = await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        id,
      ).query(`
          SELECT UsageId
          FROM CustomerPackageUsages
          WHERE AppointmentId = @AppointmentId
            AND Status = 'USED'
      `);

      if (usageCheck.recordset.length === 0) {
        const packageCheck = await new sql.Request(transaction)
          .input("CustomerPackageId", sql.Int, current.CustomerPackageId).query(`
            SELECT CustomerPackageId, RemainingSessions, UsedSessions, Status
            FROM CustomerPackages
            WHERE CustomerPackageId = @CustomerPackageId
          `);

        const cp = packageCheck.recordset[0];
        if (cp) {
          const mainSvcRes = await new sql.Request(transaction)
            .input("AppointmentId", sql.Int, id).query(`
              SELECT TOP 1 ServiceId FROM AppointmentServices WHERE AppointmentId = @AppointmentId
            `);
          const mainServiceId = mainSvcRes.recordset[0]?.ServiceId || null;

          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId)
            .input("AppointmentId", sql.Int, id)
            .input("ServiceId", sql.Int, mainServiceId).query(`
              INSERT INTO CustomerPackageUsages
                (CustomerPackageId, AppointmentId, ServiceId, SessionsUsed, Status, UsedAt, UsedBy)
              SELECT @CustomerPackageId, @AppointmentId, @ServiceId, 1, 'USED', CURRENT_TIMESTAMP, c.UserId
              FROM Appointments a
              JOIN Customers c ON a.CustomerId = c.CustomerId
              WHERE a.AppointmentId = @AppointmentId;
            `);

          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId).query(`
              UPDATE CustomerPackages
              SET
                RemainingSessions = CASE WHEN RemainingSessions > 0 THEN RemainingSessions - 1 ELSE 0 END,
                UsedSessions = ISNULL(UsedSessions, 0) + 1,
                Status = CASE WHEN (ISNULL(RemainingSessions, 1) - 1) <= 0 THEN 'COMPLETED' ELSE Status END,
                UpdatedAt = CURRENT_TIMESTAMP
              WHERE CustomerPackageId = @CustomerPackageId;
            `);
        }
      }
    }

    await transaction.commit();

    // Event-driven publish for completed appointment
    eventBusService.publish("APPOINTMENT_COMPLETED", {
      appointmentId: Number(id),
      userId
    });

    // Always finalize checkout and send email upon completion of service
    await finalizeCheckout(pool, id, userId);

    return await getAppointmentById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function cancelAppointment(id, data = {}, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");

  const reason = normalizeText(data.reason || data.cancelReason);
  if (!reason) throw new Error("Vui lòng nhập lý do hủy");

  const paymentStatus = String(current.PaymentStatus || "UNPAID").toUpperCase();
  const paymentMethod = String(current.PaymentMethod || "").toUpperCase();

  const hasPaid = paymentStatus === "PAID" && paymentMethod !== "PACKAGE";

  if (hasPaid) {
    const bankCode = data.bankCode || data.BankCode;
    const accountNumber = data.accountNumber || data.AccountNumber;
    const accountName = data.accountName || data.AccountName;
    if (!bankCode || !accountNumber || !accountName) {
      throw new Error("Vui lòng nhập đầy đủ thông tin ngân hàng nhận hoàn tiền");
    }
  }

  const newAppointmentStatus = hasPaid ? "REFUND_PENDING" : "CANCELLED";
  const refundStatus = hasPaid ? "PENDING" : null;

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("NewStatus", sql.NVarChar, newAppointmentStatus)
      .input("Reason", sql.NVarChar, reason || null).query(`
        UPDATE Appointments
        SET 
          Status = @NewStatus,
          CancelReason = @Reason,
          UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
      `);

    await addStatusHistory(
      transaction,
      Number(id),
      current.Status,
      newAppointmentStatus,
      userId,
      reason,
    );

    if (current.CustomerPackageId) {
      const usageResult = await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        id,
      ).query(`
          SELECT TOP 1 UsageId, CustomerPackageId, SessionsUsed
          FROM CustomerPackageUsages
          WHERE AppointmentId = @AppointmentId
        `);

      const usage = usageResult.recordset[0];

      if (usage) {
        await new sql.Request(transaction)
          .input("UsageId", sql.Int, usage.UsageId)
          .input("CustomerPackageId", sql.Int, usage.CustomerPackageId)
          .input("SessionsUsed", sql.Int, usage.SessionsUsed || 1).query(`
            UPDATE CustomerPackageUsages
            SET Status = 'CANCELLED', UpdatedAt = CURRENT_TIMESTAMP
            WHERE UsageId = @UsageId
              AND Status = 'USED';

            UPDATE CustomerPackages
            SET
              RemainingSessions = RemainingSessions + @SessionsUsed,
              UsedSessions = CASE
                WHEN UsedSessions >= @SessionsUsed THEN UsedSessions - @SessionsUsed
                ELSE 0
              END,
              Status = 'ACTIVE',
              UpdatedAt = CURRENT_TIMESTAMP
            WHERE CustomerPackageId = @CustomerPackageId;
          `);
      }
    }

    if (hasPaid) {
      const paidPayment = await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        id,
      ).query(`
          SELECT TOP 1 
            p.PaymentId, 
            p.Amount
          FROM Payments p
          JOIN Invoices i ON p.InvoiceId = i.InvoiceId
          WHERE i.AppointmentId = @AppointmentId
            AND p.Status = 'PAID'
          ORDER BY p.PaymentId DESC
        `);

      const payment = paidPayment.recordset[0];

      if (payment) {
        const existingRefund = await new sql.Request(transaction).input(
          "PaymentId",
          sql.Int,
          payment.PaymentId,
        ).query(`
            SELECT TOP 1 RefundId
            FROM Refunds
            WHERE PaymentId = @PaymentId
          `);

        if (existingRefund.recordset.length === 0) {
          const bankCode = data.bankCode || data.BankCode || null;
          const accountNumber = data.accountNumber || data.AccountNumber || null;
          const accountName = data.accountName || data.AccountName || null;

          await new sql.Request(transaction)
            .input("PaymentId", sql.Int, payment.PaymentId)
            .input("RefundAmount", sql.Decimal(18, 2), payment.Amount || 0)
            .input(
              "Reason",
              sql.NVarChar,
              reason || "Receptionist cancelled paid appointment",
            )
            .input("Status", sql.NVarChar, refundStatus)
            .input("BankCode", sql.NVarChar, bankCode)
            .input("AccountNumber", sql.NVarChar, accountNumber)
            .input("AccountName", sql.NVarChar, accountName)
            .query(`
              INSERT INTO Refunds
                (PaymentId, RefundAmount, Reason, Status, BankCode, AccountNumber, AccountName)
              VALUES
                (@PaymentId, @RefundAmount, @Reason, @Status, @BankCode, @AccountNumber, @AccountName)
            `);
        }
      }
    }

    // Hoàn lại voucher nếu lịch hẹn có sử dụng voucher
    const invoiceVoucher = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .query(`
        SELECT TOP 1 VoucherId
        FROM Invoices
        WHERE AppointmentId = @AppointmentId
        ORDER BY InvoiceId DESC
      `);
    const cancelledVoucherId = invoiceVoucher.recordset[0]?.VoucherId || null;

    if (cancelledVoucherId) {
      await new sql.Request(transaction)
        .input("VoucherId", sql.Int, cancelledVoucherId)
        .query(`
          UPDATE Vouchers
          SET Quantity = Quantity + 1
          WHERE VoucherId = @VoucherId
        `);

      await new sql.Request(transaction)
        .input("VoucherId", sql.Int, cancelledVoucherId)
        .input("CustomerId", sql.Int, current.CustomerId)
        .query(`
          UPDATE CustomerVouchers
          SET UsedStatus = 0, UsedAt = NULL
          WHERE VoucherId = @VoucherId AND CustomerId = @CustomerId
        `);
    }

    await createReceptionistNotification(
      transaction,
      "Appointment bị hủy",
      `Lịch hẹn #${id} đã bị hủy bởi lễ tân.`,
      "APPOINTMENT_CANCELLED",
    );

    await transaction.commit();

    try {
      const { runAutoMatch } = require("../waiting-list/waiting-list.service");
      runAutoMatch(current.AppointmentDate, {
        startTime: current.StartTime,
        endTime: current.EndTime,
        employeeId: current.EmployeeId,
        branchId: current.BranchId
      }).catch(err => console.error("Auto match failed:", err.message));
    } catch (err) {
      console.error("Auto match trigger failed:", err.message);
    }

    return await getAppointmentById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function noShowAppointment(id, userId) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);

  const allowed = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "BOOKED"];
  if (!current) throw new Error("Không tìm thấy lịch hẹn");
  if (!allowed.includes(String(current.Status).toUpperCase())) {
    throw new Error("Không thể đánh dấu No Show");
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction).input("AppointmentId", sql.Int, id).query(`
        UPDATE Appointments
        SET Status = 'NO_SHOW',
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
      `);

    await new sql.Request(transaction).input("AppointmentId", sql.Int, id).query(`
        DELETE FROM CustomerPackageUsages
        WHERE AppointmentId = @AppointmentId AND Status <> 'USED'
      `);

    await addStatusHistory(
      transaction,
      id,
      current.Status,
      "NO_SHOW",
      userId,
      "Receptionist marked customer as no-show",
    );

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

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
    WHERE UPPER(COALESCE(Status, 'AVAILABLE')) IN ('AVAILABLE', 'ACTIVE')
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
        COALESCE(ml.LevelName, 'Standard') AS MembershipLevel,
        COALESCE(ml.DiscountPercent, 0) AS DiscountPercent,
        c.CreatedAt,
        c.UpdatedAt,

        COUNT(DISTINCT a.AppointmentId) AS TotalAppointments,

        SUM(CASE WHEN a.Status = 'COMPLETED' THEN 1 ELSE 0 END)
          AS CompletedAppointments,

        COALESCE(SUM(CASE 
          WHEN p.Status = 'PAID' THEN p.Amount 
          ELSE 0 
        END), 0) AS TotalSpent,

        MAX(CASE 
          WHEN a.Status = 'COMPLETED' THEN a.AppointmentDate 
          ELSE NULL 
        END) AS LastVisitDate,

        MAX(a.AppointmentDate) AS LastAppointmentDate
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml 
        ON c.MembershipLevelId = ml.MembershipLevelId
      LEFT JOIN Appointments a 
        ON c.CustomerId = a.CustomerId
      LEFT JOIN Invoices i 
        ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Payments p 
        ON i.InvoiceId = p.InvoiceId 
       AND p.Status = 'PAID'
      WHERE
        @Keyword IS NULL
        OR u.FullName LIKE '%' || @Keyword || '%'
        OR u.Phone LIKE '%' || @Keyword || '%'
        OR u.Email LIKE '%' || @Keyword || '%'
      GROUP BY
        c.CustomerId,
        c.UserId,
        u.FullName,
        u.Phone,
        u.Email,
        u.AvatarUrl,
        u.Status,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.LevelName,
        ml.DiscountPercent,
        c.CreatedAt,
        c.UpdatedAt
      ORDER BY 
        COALESCE(c.UpdatedAt, c.CreatedAt) DESC,
        c.CustomerId DESC
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
      SELECT
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
        COALESCE(ml.LevelName, 'Standard') AS MembershipLevel,
        COALESCE(ml.DiscountPercent, 0) AS DiscountPercent,
        c.CreatedAt,
        c.UpdatedAt
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml 
        ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE c.CustomerId = @CustomerId
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  const profile = profileResult.recordset[0];
  if (!profile) return null;

  const appointments = await pool.request().input("CustomerId", sql.Int, id)
    .query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
        a.Status,
        a.Notes,
        a.CancelReason,
        a.CreatedAt,
        a.UpdatedAt,
        eu.FullName AS TechnicianName,
        COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        COALESCE(i.InvoiceId, 0) AS InvoiceId,
        COALESCE(i.FinalAmount, 0) AS FinalAmount,
        COALESCE(i.Status, 'UNPAID') AS InvoiceStatus,
        COALESCE(sv.ServiceNames, 'Chưa có dịch vụ') AS ServiceNames
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      OUTER APPLY (

        SELECT STRING_AGG(s.ServiceName, ', ') AS ServiceNames
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = a.AppointmentId
      
) sv
      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC, a.AppointmentId DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`);

  const invoices = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        i.InvoiceId,
        i.AppointmentId,
        i.TotalAmount,
        i.DiscountAmount,
        i.FinalAmount,
        i.Status AS InvoiceStatus,
        i.CreatedAt,
        i.UpdatedAt,
        a.AppointmentDate,
        a.Status AS AppointmentStatus,
        COALESCE(p.Status, i.Status) AS PaymentStatus,
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
          p2.TransactionCode,
          p2.CreatedAt,
          p2.PaymentId
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
          p2.CreatedAt DESC,
          p2.PaymentId DESC
) p
      WHERE a.CustomerId = @CustomerId
      ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
    `);

  const payments = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        p.PaymentId,
        p.InvoiceId,
        p.Amount,
        p.PaymentMethod,
        p.Status,
        p.TransactionCode,
        p.VnpTxnRef,
        p.VnpTransactionNo,
        p.VnpResponseCode,
        p.PaidAt,
        p.CreatedAt,
        a.AppointmentId,
        a.AppointmentDate
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
      ORDER BY p.CreatedAt DESC, p.PaymentId DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`);

  const reviews = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        r.ReviewId,
        r.AppointmentId,
        r.ServiceId,
        s.ServiceName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.AdminResponse,
        r.CreatedAt,
        r.UpdatedAt,
        eu.FullName AS TechnicianName
      FROM Reviews r
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE r.CustomerId = @CustomerId
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`);

  const feedbacks = await pool.request().input("CustomerId", sql.Int, id)
    .query(`
      SELECT
        FeedbackId,
        Subject,
        Content,
        Status,
        AdminResponse,
        CreatedAt,
        UpdatedAt
      FROM Feedbacks
      WHERE CustomerId = @CustomerId
      ORDER BY CreatedAt DESC, FeedbackId DESC
      OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`);

  const packages = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
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
        cp.UpdatedAt,
        pp.Status AS PaymentStatus,
        pp.Amount AS PaidAmount,
        pp.PaymentMethod,
        pp.PaidAt
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      OUTER APPLY (

        SELECT TOP 1 *
        FROM PackagePayments pp
        WHERE pp.CustomerPackageId = cp.CustomerPackageId
        ORDER BY pp.CreatedAt DESC, pp.PackagePaymentId DESC
) pp
      WHERE cp.CustomerId = @CustomerId
      ORDER BY cp.CreatedAt DESC, cp.CustomerPackageId DESC
    `);

  const summary = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT
        COUNT(DISTINCT a.AppointmentId) AS TotalAppointments,
        SUM(CASE WHEN a.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments,
        SUM(CASE WHEN a.Status = 'CANCELLED' THEN 1 ELSE 0 END) AS CancelledAppointments,
        SUM(CASE WHEN a.Status = 'NO_SHOW' THEN 1 ELSE 0 END) AS NoShowAppointments,
        COALESCE(SUM(CASE WHEN p.Status = 'PAID' THEN p.Amount ELSE 0 END), 0) AS TotalSpent,
        MAX(CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentDate ELSE NULL END) AS LastVisitDate,
        MAX(a.AppointmentDate) AS LastAppointmentDate
      FROM Appointments a
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Payments p ON i.InvoiceId = p.InvoiceId AND p.Status = 'PAID'
      WHERE a.CustomerId = @CustomerId
    `);

  return {
    Profile: profile,
    Membership: {
      MembershipLevel: profile.MembershipLevel || "Standard",
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

  const duplicated = await pool
    .request()
    .input("Phone", sql.NVarChar, phone)
    .input("Email", sql.NVarChar, email || null).query(`
      SELECT UserId, Phone, Email
      FROM Users
      WHERE Phone = @Phone
         OR (@Email IS NOT NULL AND Email = @Email)
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (duplicated.recordset.length > 0) {
    throw new Error("Số điện thoại hoặc email đã tồn tại");
  }

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const roleResult = await new sql.Request(tx).input(
      "RoleName",
      sql.NVarChar,
      "CUSTOMER",
    ).query(`
        SELECT RoleId
        FROM Roles
        WHERE UPPER(RoleName) = UPPER(@RoleName)
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

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
          (@FullName, @Phone, @Email, @PasswordHash, @RoleId, 'ACTIVE', CURRENT_TIMESTAMP)
      `);

    const userId = userResult.recordset[0].UserId;

    const customerResult = await new sql.Request(tx)
      .input("UserId", sql.Int, userId)
      .input("Gender", sql.NVarChar, gender || null)
      .input("DateOfBirth", sql.Date, dateOfBirth || null)
      .input("Address", sql.NVarChar, address || null).query(`
        INSERT INTO Customers
          (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, CreatedAt)
        OUTPUT INSERTED.CustomerId
        VALUES
          (@UserId, @Gender, @DateOfBirth, @Address, 0, CURRENT_TIMESTAMP)
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

  const fullName = normalizeText(data.FullName || data.fullName);
  const phone = normalizeText(data.Phone || data.phone);
  const email = normalizeText(data.Email || data.email);
  const gender = normalizeText(data.Gender || data.gender);
  const dateOfBirth = data.DateOfBirth || data.dateOfBirth || null;
  const address = normalizeText(data.Address || data.address);

  if (!fullName) throw new Error("Vui lòng nhập họ tên khách hàng");
  if (!phone) throw new Error("Vui lòng nhập số điện thoại");

  const existed = await pool.request().input("CustomerId", sql.Int, id).query(`
      SELECT c.CustomerId, c.UserId
      FROM Customers c
      WHERE c.CustomerId = @CustomerId
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (!existed.recordset[0]) {
    throw new Error("Không tìm thấy khách hàng");
  }

  const duplicated = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .input("Phone", sql.NVarChar, phone)
    .input("Email", sql.NVarChar, email || null).query(`
      SELECT c.CustomerId
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE c.CustomerId <> @CustomerId
        AND (
          u.Phone = @Phone
          OR (@Email IS NOT NULL AND u.Email = @Email)
        )
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (duplicated.recordset.length > 0) {
    throw new Error("Số điện thoại hoặc email đã thuộc khách hàng khác");
  }

  await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .input("FullName", sql.NVarChar, fullName)
    .input("Phone", sql.NVarChar, phone)
    .input("Email", sql.NVarChar, email || null)
    .input("Gender", sql.NVarChar, gender || null)
    .input("DateOfBirth", sql.Date, dateOfBirth || null)
    .input("Address", sql.NVarChar, address || null).query(`
      UPDATE u
      SET
        u.FullName = @FullName,
        u.Phone = @Phone,
        u.Email = @Email
      FROM Users u
      JOIN Customers c ON c.UserId = u.UserId
      WHERE c.CustomerId = @CustomerId;

      UPDATE Customers
      SET
        Gender = @Gender,
        DateOfBirth = @DateOfBirth,
        Address = @Address,
        UpdatedAt = CURRENT_TIMESTAMP
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
        COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
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
        COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
        u.AvatarUrl,
        e.Status AS TechnicianStatus
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE UPPER(COALESCE(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
        AND (
          SELECT COUNT(DISTINCT es.ServiceId)
          FROM EmployeeServices es
          WHERE es.EmployeeId = e.EmployeeId
            AND es.ServiceId IN (
              SELECT CAST(value AS INT) FROM STRING_SPLIT(@ServiceIds, ',')
            )
        ) = @ServiceCount
        AND NOT EXISTS (
          SELECT 1
          FROM Appointments a
          WHERE a.EmployeeId = e.EmployeeId
            AND a.AppointmentDate = @AppointmentDate
            AND UPPER(COALESCE(a.Status, '')) NOT IN (
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
        WHERE UPPER(COALESCE(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
          AND (
            SELECT COUNT(DISTINCT es.ServiceId)
            FROM EmployeeServices es
            WHERE es.EmployeeId = e.EmployeeId
              AND es.ServiceId IN (
                SELECT CAST(value AS INT) FROM STRING_SPLIT(@ServiceIds, ',')
              )
          ) = @ServiceCount
          AND NOT EXISTS (
            SELECT 1
            FROM Appointments a
            WHERE a.EmployeeId = e.EmployeeId
              AND a.AppointmentDate = @AppointmentDate
              AND UPPER(COALESCE(a.Status, '')) NOT IN (
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
          AND NOT EXISTS (
            SELECT 1
            FROM WaitingList w
            WHERE w.MatchedEmployeeId = e.EmployeeId
              AND w.MatchedDate = @AppointmentDate
              AND w.Status = 'MATCHED'
              AND w.HoldExpiresAt > GETUTCDATE()
              AND (
                @StartTime < CONVERT(VARCHAR(8), w.MatchedEndTime, 108)
                AND @EndTime > CONVERT(VARCHAR(8), w.MatchedStartTime, 108)
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

  const apptStatus = String(current.Status || "").toUpperCase();
  if (["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(apptStatus) || current.CheckedInAt) {
    throw new Error("Khách hàng đã check-in hoặc ca hẹn đang thực hiện, không thể đổi ca trực / đổi giờ");
  }

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
    SELECT AppointmentId
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
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (busy.recordset.length) {
    throw new Error("Kỹ thuật viên đã có lịch trong khung giờ này");
  }

  // 1. Check if there's already a pending request awaiting confirmation
  const existing = await pool.request()
    .input("AppointmentId", sql.Int, Number(id))
    .query(`
      SELECT RequestId, Status FROM AppointmentRescheduleRequests
      WHERE AppointmentId = @AppointmentId AND Status IN ('PENDING', 'AWAITING_CUSTOMER')
    `);
  if (existing.recordset.length > 0) {
    throw new Error("Lịch hẹn này đang có yêu cầu đổi lịch chờ khách hàng xác nhận.");
  }

  // 2. Insert into AppointmentRescheduleRequests with Status = 'AWAITING_CUSTOMER'
  await pool.request()
    .input("AppointmentId", sql.Int, Number(id))
    .input("RequesterId", sql.Int, userId || null)
    .input("RequestedDate", sql.Date, appointmentDate)
    .input("RequestedStartTime", sql.VarChar(8), `${startTime}:00`)
    .input("RequestedEndTime", sql.VarChar(8), endTime)
    .input("Reason", sql.NVarChar, data.reason || "Lễ tân đổi ca trực / đổi giờ hẹn")
    .query(`
      INSERT INTO AppointmentRescheduleRequests 
      (AppointmentId, RequesterId, RequestedDate, RequestedStartTime, RequestedEndTime, Reason, Status, CreatedAt, UpdatedAt)
      VALUES 
      (@AppointmentId, @RequesterId, @RequestedDate, @RequestedStartTime, @RequestedEndTime, @Reason, 'AWAITING_CUSTOMER', GETDATE(), GETDATE())
    `);

  // 3. Notify Customer
  try {
    const custUserRes = await pool.request()
      .input("CustomerId", sql.Int, current.CustomerId)
      .query("SELECT UserId FROM Customers WHERE CustomerId = @CustomerId");
    const custUserId = custUserRes.recordset[0]?.UserId;

    if (custUserId) {
      const dateTextStr = new Date(appointmentDate).toLocaleDateString("vi-VN");
      const timeRangeStr = `${startTime} - ${endTime.slice(0, 5)}`;
      const notificationsService = require("../notifications/notifications.service");
      await notificationsService.create({
        userId: custUserId,
        title: "📅 Lễ tân đề xuất đổi ca trực / giờ hẹn của bạn",
        content: `Lễ tân đề xuất đổi lịch hẹn #${id} sang ngày ${dateTextStr} lúc ${timeRangeStr}. Vui lòng vào Chi tiết lịch hẹn để xác nhận hoặc từ chối.`,
        type: "RESCHEDULE_AWAITING_CUSTOMER"
      });
    }
  } catch (errNotif) {
    console.error("Gửi thông báo đổi lịch cho khách thất bại:", errNotif.message);
  }

  return {
    message: "Đã tạo đề xuất đổi lịch thành công! Đã gửi yêu cầu đổi ca trực / đổi giờ tới khách hàng để xác nhận.",
    awaitingCustomer: true
  };
}

async function createAppointment(data, userId = null) {
  const pool = await connectDB();

  const customerId = Number(data.customerId || data.CustomerId || 0);
  const serviceIds = parseServiceIds(data);
  const technicianId = Number(data.technicianId || data.TechnicianId || data.employeeId || data.EmployeeId || 0);

  const appointmentDate = normalizeDateOnly(
    data.appointmentDate || data.AppointmentDate,
  );

  const startTimeRaw = String(data.startTime || data.StartTime || "").slice(
    0,
    5,
  );

  const isWalkIn =
    data.isWalkIn === true ||
    data.walkIn === true ||
    String(data.type || "").toUpperCase() === "WALK_IN";

  let customerPackageId = data.customerPackageId || data.CustomerPackageId || null;
  const parentAppointmentId = data.parentAppointmentId || data.ParentAppointmentId || null;

  // 1. Nếu là lịch tái khám và chưa chỉ định gói, tự động kế thừa gói từ lịch cũ nếu còn buổi khả dụng
  if (parentAppointmentId && !customerPackageId) {
    const parentAppt = await pool.request()
      .input("ParentId", sql.Int, parentAppointmentId)
      .query(`
        SELECT 
          a.CustomerPackageId, 
          cp.RemainingSessions,
          aps.ServiceId,
          (
            SELECT COUNT(*)
            FROM Appointments a2
            JOIN AppointmentServices aps2 ON a2.AppointmentId = aps2.AppointmentId
            WHERE a2.CustomerPackageId = a.CustomerPackageId
              AND aps2.ServiceId = aps.ServiceId
              AND a2.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
          ) AS ActiveBookings
        FROM Appointments a
        LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
        LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
        WHERE a.AppointmentId = @ParentId
      `);
    const parent = parentAppt.recordset[0];
    if (parent && parent.CustomerPackageId) {
      const remaining = Number(parent.RemainingSessions || 0);
      const active = Number(parent.ActiveBookings || 0);
      const available = remaining - active;
      if (available > 0) {
        customerPackageId = parent.CustomerPackageId;
      }
    }

    // Tự động tìm kiếm các gói combo khác của khách hàng chứa dịch vụ này nếu gói cũ đã hết buổi
    if (!customerPackageId && customerId && serviceIds.length > 0) {
      const otherAppt = await pool.request()
        .input("CustomerId", sql.Int, customerId)
        .input("ServiceId", sql.Int, serviceIds[0])
        .query(`
          SELECT TOP 1 cp.CustomerPackageId
          FROM CustomerPackages cp
          JOIN PackageServices ps ON cp.PackageId = ps.PackageId
          WHERE cp.CustomerId = @CustomerId
            AND ps.ServiceId = @ServiceId
            AND cp.Status = 'ACTIVE'
            AND cp.EndDate >= CAST(GETDATE() AS DATE)
            AND (
              cp.RemainingSessions - (
                SELECT COUNT(*)
                FROM Appointments a2
                JOIN AppointmentServices aps2 ON a2.AppointmentId = aps2.AppointmentId
                WHERE a2.CustomerPackageId = cp.CustomerPackageId
                  AND aps2.ServiceId = @ServiceId
                  AND a2.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
              )
            ) > 0
          ORDER BY cp.EndDate ASC, cp.CustomerPackageId ASC
        `);
      const otherPkg = otherAppt.recordset[0];
      if (otherPkg) {
        customerPackageId = otherPkg.CustomerPackageId;
      }
    }
  }

  // 2. Nếu đã có gói (do kế thừa hoặc client truyền lên), xác minh lại hạn mức khả dụng
  if (customerPackageId) {
    const packageCheck = await pool.request()
      .input("CustomerPackageId", sql.Int, customerPackageId)
      .input("ServiceId", sql.Int, serviceIds[0] || 0)
      .query(`
        SELECT
          cp.CustomerPackageId,
          cp.RemainingSessions,
          cp.Status,
          cp.EndDate,
          COALESCE(ps.SessionCount, 1) AS MaxSessions,
          (
            SELECT COALESCE(SUM(SessionsUsed), 0)
            FROM CustomerPackageUsages
            WHERE CustomerPackageId = @CustomerPackageId
              AND ServiceId = @ServiceId
              AND Status <> 'CANCELLED'
          ) AS UsedSessions,
          (
            SELECT COUNT(*)
            FROM Appointments a
            JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
            WHERE a.CustomerPackageId = @CustomerPackageId
              AND aps.ServiceId = @ServiceId
              AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
          ) AS ActiveBookings
        FROM CustomerPackages cp
        JOIN PackageServices ps ON cp.PackageId = ps.PackageId
        WHERE cp.CustomerPackageId = @CustomerPackageId
          AND ps.ServiceId = @ServiceId
      `);

    const cp = packageCheck.recordset[0];
    if (cp) {
      const maxS = Number(cp.MaxSessions || 0);
      const usedS = Number(cp.UsedSessions || 0);
      const activeS = Number(cp.ActiveBookings || 0);
      const leftS = Math.max(0, maxS - usedS);
      const available = leftS - activeS;

      const isExpired = new Date(cp.EndDate) < new Date(new Date().toDateString());
      const isActive = String(cp.Status).toUpperCase() === "ACTIVE";

      if (available <= 0 || isExpired || !isActive) {
        // Combo không khả dụng nữa -> Tự động biến ca hẹn này thành trả phí bằng tiền thật!
        customerPackageId = null;
      }
    } else {
      customerPackageId = null;
    }
  }

  let defaultStatus = "CONFIRMED";
  if (!customerPackageId) {
    defaultStatus = "PENDING_PAYMENT";
  }

  const targetStatus = data.status || data.Status || defaultStatus;

  const rawNote = normalizeText(data.note || data.Notes || data.notes || "");
  const note = parentAppointmentId ? `[Tái khám từ lịch #${parentAppointmentId}] ${rawNote}` : rawNote;
  const paymentStatus = customerPackageId ? "PAID" : String(data.paymentStatus || "UNPAID").toUpperCase();
  const paymentMethod = customerPackageId ? "PACKAGE" : String(data.paymentMethod || "CASH").toUpperCase();

  if (!customerId) throw new Error("Vui lòng chọn khách hàng");
  if (serviceIds.length === 0)
    throw new Error("Vui lòng chọn ít nhất 1 dịch vụ");
  if (!technicianId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");
  if (!startTimeRaw) throw new Error("Vui lòng chọn giờ bắt đầu");

  const {
    services: selectedServices,
    totalDuration,
    totalAmount: originalTotalAmount,
  } = await getSelectedServices(pool, serviceIds);

  const isPackageUsage = !!customerPackageId;

  if (isPackageUsage) {
    // Validate package limits
    const packageCheck = await pool.request()
      .input("CustomerPackageId", sql.Int, customerPackageId)
      .input("ServiceId", sql.Int, serviceIds[0])
      .query(`
        SELECT
          cp.CustomerPackageId,
          cp.RemainingSessions,
          cp.Status,
          cp.EndDate,
          COALESCE(ps.SessionCount, 1) AS MaxSessions,
          (
            SELECT COALESCE(SUM(SessionsUsed), 0)
            FROM CustomerPackageUsages
            WHERE CustomerPackageId = @CustomerPackageId
              AND ServiceId = @ServiceId
              AND Status <> 'CANCELLED'
          ) AS UsedSessions,
          (
            SELECT COUNT(*)
            FROM Appointments a
            JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
            WHERE a.CustomerPackageId = @CustomerPackageId
              AND aps.ServiceId = @ServiceId
              AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
          ) AS ActiveBookings
        FROM CustomerPackages cp
        JOIN PackageServices ps ON cp.PackageId = ps.PackageId
        WHERE cp.CustomerPackageId = @CustomerPackageId
          AND ps.ServiceId = @ServiceId
      `);

    const cp = packageCheck.recordset[0];
    if (!cp) throw new Error("Gói combo không chứa dịch vụ này");
    if (String(cp.Status).toUpperCase() !== "ACTIVE") {
      throw new Error("Gói combo không còn ở trạng thái hoạt động (ACTIVE)");
    }
    if (new Date(cp.EndDate) < new Date(new Date().toDateString())) {
      throw new Error("Gói combo đã hết hạn sử dụng");
    }

    const maxS = Number(cp.MaxSessions || 0);
    const usedS = Number(cp.UsedSessions || 0);
    const activeS = Number(cp.ActiveBookings || 0);
    const leftS = Math.max(0, maxS - usedS);
    const available = leftS - activeS;

    if (available <= 0) {
      if (activeS > 0) {
        const activeNameResult = await pool.request()
          .input("CustomerPackageId", sql.Int, customerPackageId)
          .input("ServiceId", sql.Int, serviceIds[0])
          .query(`
            SELECT TOP 1 u.FullName
            FROM Appointments a
            JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
            JOIN Customers c ON a.CustomerId = c.CustomerId
            JOIN Users u ON c.UserId = u.UserId
            WHERE a.CustomerPackageId = @CustomerPackageId
              AND aps.ServiceId = @ServiceId
              AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
          `);
        const activeName = activeNameResult.recordset[0]?.FullName || "thành viên khác";
        throw new Error(`Dịch vụ này đã được ${activeName} đặt lịch hẹn trước đó rồi.`);
      } else {
        throw new Error("Dịch vụ này đã dùng hết số buổi quy định trong gói combo.");
      }
    }
  }

  const totalAmount = isPackageUsage ? 0 : originalTotalAmount;
  if (isPackageUsage) {
    selectedServices.forEach(s => { s.Price = 0; });
  }

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
          SELECT CAST(value AS INT) FROM STRING_SPLIT(@ServiceIds, ',')
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
        AND UPPER(COALESCE(Status, '')) NOT IN (
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

  const heldByOther = await pool
    .request()
    .input("TechnicianId", sql.Int, technicianId)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, startTime)
    .input("EndTime", sql.VarChar, endTime)
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT TOP 1 1 AS Held
      FROM WaitingList
      WHERE MatchedEmployeeId = @TechnicianId
        AND MatchedDate = @AppointmentDate
        AND Status = 'MATCHED'
        AND HoldExpiresAt > GETDATE()
        AND CustomerId <> @CustomerId
        AND (
          @StartTime < CONVERT(VARCHAR(8), MatchedEndTime, 108)
          AND @EndTime > CONVERT(VARCHAR(8), MatchedStartTime, 108)
        )
    `);

  if (heldByOther.recordset[0]) {
    throw new Error("Khung giờ này đang được giữ chỗ cho một khách hàng khác từ hàng chờ.");
  }

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // Tự động hủy các yêu cầu hàng chờ của khách cho các dịch vụ được đặt
    for (const serviceId of serviceIds) {
      await new sql.Request(tx)
        .input("CustomerId", sql.Int, customerId)
        .input("ServiceId", sql.Int, serviceId)
        .input("PreferredDate", sql.Date, appointmentDate)
        .query(`
          UPDATE WaitingList
          SET Status = 'CANCELLED',
              CancelReason = 'Đã được xếp lịch trực tiếp tại quầy',
              UpdatedAt = CURRENT_TIMESTAMP
          WHERE CustomerId = @CustomerId
            AND ServiceId = @ServiceId
            AND (PreferredDate = @PreferredDate OR PreferredDate IS NULL)
            AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED')
        `);
    }

    // Fetch technician's BranchId to associate with the appointment
    const empBranchRes = await new sql.Request(tx)
      .input("EmployeeId", sql.Int, technicianId)
      .query("SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId");
    const branchId = empBranchRes.recordset[0]?.BranchId || null;

    const appointmentResult = await new sql.Request(tx)
      .input("CustomerId", sql.Int, customerId)
      .input("EmployeeId", sql.Int, technicianId)
      .input("BranchId", sql.Int, branchId)
      .input("AppointmentDate", sql.Date, appointmentDate)
      .input("StartTime", sql.VarChar, startTime)
      .input("EndTime", sql.VarChar, endTime)
      .input("Status", sql.NVarChar, targetStatus)
      .input("Notes", sql.NVarChar, note || null)
      .input("CustomerPackageId", sql.Int, customerPackageId)
      .query(`
        INSERT INTO Appointments
          (
            CustomerId,
            EmployeeId,
            BranchId,
            AppointmentDate,
            StartTime,
            EndTime,
            Status,
            Notes,
            CheckedInAt,
            CustomerPackageId
          )
        OUTPUT INSERTED.*
        VALUES
          (
            @CustomerId,
            @EmployeeId,
            @BranchId,
            @AppointmentDate,
            @StartTime,
            @EndTime,
            @Status,
            @Notes,
            CASE WHEN CAST(@Status AS VARCHAR) = 'CHECKED_IN' THEN GETDATE() ELSE NULL END,
            @CustomerPackageId
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
            CASE WHEN CAST(@Status AS VARCHAR) = 'PAID' THEN CURRENT_TIMESTAMP ELSE NULL END
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
      targetStatus,
      userId,
      isWalkIn
        ? "Receptionist created walk-in appointment and checked in customer"
        : `Created appointment with status ${targetStatus}`,
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

    // Auto-create/register shift for this appointment
    try {
      await ensureShiftForAppointment(appointment.EmployeeId, appointment.AppointmentDate, appointment.StartTime, appointment.EndTime, serviceIds);
    } catch (e) {
      console.error("Auto shift registration failed:", e.message);
    }

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
        COALESCE(i.TotalAmount, 0) AS Total,
        COALESCE(i.DiscountAmount, 0) AS Discount,
        COALESCE(i.FinalAmount, 0) AS FinalAmount,
        COALESCE(i.Status, COALESCE(p.Status, 'UNPAID')) AS Status,
        i.CreatedAt,
        COALESCE(p.Status, 'UNPAID') AS PaymentStatus
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
        (@Status IS NULL OR COALESCE(i.Status, COALESCE(p.Status, 'UNPAID')) = @Status)
        AND (@DateFilter IS NULL OR CAST(i.CreatedAt AS DATE) = @DateFilter)
        AND (
          @CustomerKeyword IS NULL
          OR cu.FullName LIKE '%' || @CustomerKeyword || '%'
          OR cu.Phone LIKE '%' || @CustomerKeyword || '%'
          OR cu.Email LIKE '%' || @CustomerKeyword || '%'
        )
      ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
    `);

  return result.recordset;
}

async function getInvoiceById(id) {
  const pool = await connectDB();

  const invoice = await pool.request().input("InvoiceId", sql.Int, id).query(`
    SELECT
      i.InvoiceId,
      i.AppointmentId,
      i.VoucherId,
      i.RewardPointsUsed,
      i.RewardDiscountAmount,
      v.Code AS VoucherCode,
      COALESCE(i.TotalAmount, 0) AS Total,
      COALESCE(i.DiscountAmount, 0) AS Discount,
      COALESCE(i.FinalAmount, 0) AS FinalAmount,
      COALESCE(i.Status, 'UNPAID') AS Status,
      COALESCE(i.ManualDiscount, 0) AS ManualDiscount,
      COALESCE(i.Surcharge, 0) AS Surcharge,
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
    LEFT JOIN Vouchers v ON i.VoucherId = v.VoucherId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    WHERE i.InvoiceId = @InvoiceId
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

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

    const paymentResult = await new sql.Request(tx)
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
        OUTPUT INSERTED.PaymentId
        VALUES
          (@InvoiceId, @Amount, @PaymentMethod, 'PAID', @TransactionCode, CURRENT_TIMESTAMP)
      `);

    const paymentId = paymentResult.recordset[0]?.PaymentId;

    await new sql.Request(tx).input("InvoiceId", sql.Int, id).query(`
        UPDATE Invoices
        SET Status = 'PAID'
        WHERE InvoiceId = @InvoiceId
      `);

    if (Number(current.RewardPointsUsed || 0) > 0 && paymentId) {
      await useLoyaltyPoints(
        tx,
        current.CustomerId,
        paymentId,
        current.AppointmentId,
        Number(current.RewardPointsUsed),
        Number(current.RewardDiscountAmount)
      );
    }

    const paidAmount = current.FinalAmount || current.Total || 0;
    if (paidAmount > 0 && current.CustomerId && paymentId) {
      await addLoyaltyPoints(
        tx,
        current.CustomerId,
        paymentId,
        current.AppointmentId,
        paidAmount
      );
      await updateCustomerMembershipLevel(tx, current.CustomerId);
    }

    if (current.VoucherId) {
      const useCountResult = await new sql.Request(tx)
        .input("CustomerId", sql.Int, current.CustomerId)
        .input("VoucherId", sql.Int, current.VoucherId)
        .query(`
          SELECT COUNT(*) AS UseCount
          FROM Invoices i
          JOIN Payments p ON i.InvoiceId = p.InvoiceId
          JOIN Appointments a ON i.AppointmentId = a.AppointmentId
          WHERE a.CustomerId = @CustomerId
            AND i.VoucherId = @VoucherId
            AND p.Status = 'PAID'
        `);

      const useCount = useCountResult.recordset[0]?.UseCount || 0;

      if (useCount >= 1) {
        await new sql.Request(tx)
          .input("CustomerId", sql.Int, current.CustomerId)
          .input("VoucherId", sql.Int, current.VoucherId)
          .query(`
            UPDATE CustomerVouchers
            SET UsedStatus = 1, UsedAt = CURRENT_TIMESTAMP
            WHERE CustomerId = @CustomerId
              AND VoucherId = @VoucherId
          `);
      }
    }

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
        UpdatedAt = CURRENT_TIMESTAMP
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

    const appt = await getAppointmentById(current.AppointmentId);
    if (appt && appt.Status === 'COMPLETED') {
      await finalizeCheckout(pool, current.AppointmentId, userId);
    }

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

  if (String(current.AppointmentStatus || "").toUpperCase() === "COMPLETED") {
    throw new Error("Không thể hoàn trả lịch hẹn đã hoàn thành");
  }

  const reason = normalizeText(data.reason);
  if (!reason) throw new Error("Vui lòng nhập lý do hoàn tiền");

  if (
    !current.PaymentInfo ||
    String(current.PaymentInfo.Status).toUpperCase() !== "PAID"
  ) {
    throw new Error("Chỉ được hoàn tiền hóa đơn đã thanh toán");
  }

  const paymentMethod = String(current.PaymentInfo.PaymentMethod || "").toUpperCase();
  const isPackage = paymentMethod === "PACKAGE";

  const refundAmount = isPackage ? 0 : Number(
    data.refundAmount || current.FinalAmount || current.Total || 0,
  );

  if (!isPackage && refundAmount <= 0) {
    throw new Error("Số tiền hoàn phải lớn hơn 0");
  }

  if (!isPackage) {
    const bankCode = data.bankCode || data.BankCode;
    const accountNumber = data.accountNumber || data.AccountNumber;
    const accountName = data.accountName || data.AccountName;
    if (!bankCode || !accountNumber || !accountName) {
      throw new Error("Vui lòng nhập đầy đủ thông tin ngân hàng nhận hoàn tiền");
    }
  }

  if (refundAmount > Number(current.PaymentInfo.Amount || 0)) {
    throw new Error("Số tiền hoàn không được lớn hơn số tiền đã thanh toán");
  }

  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();
    let refundResult = null;

    if (isPackage) {
      // 1. Revert combo sessions
      const usageResult = await new sql.Request(tx).input(
        "AppointmentId",
        sql.Int,
        current.AppointmentId,
      ).query(`
          SELECT TOP 1 UsageId, CustomerPackageId, SessionsUsed
          FROM CustomerPackageUsages
          WHERE AppointmentId = @AppointmentId
        `);

      const usage = usageResult.recordset[0];

      if (usage) {
        await new sql.Request(tx)
          .input("UsageId", sql.Int, usage.UsageId)
          .input("CustomerPackageId", sql.Int, usage.CustomerPackageId)
          .input("SessionsUsed", sql.Int, usage.SessionsUsed || 1).query(`
            UPDATE CustomerPackageUsages
            SET Status = 'CANCELLED', UpdatedAt = CURRENT_TIMESTAMP
            WHERE UsageId = @UsageId
              AND Status = 'USED';

            UPDATE CustomerPackages
            SET
              RemainingSessions = RemainingSessions + @SessionsUsed,
              UsedSessions = CASE
                WHEN UsedSessions >= @SessionsUsed THEN UsedSessions - @SessionsUsed
                ELSE 0
              END,
              Status = 'ACTIVE',
              UpdatedAt = CURRENT_TIMESTAMP
            WHERE CustomerPackageId = @CustomerPackageId;
          `);
      }

      // 2. Mark Payment as REFUNDED
      await new sql.Request(tx).input(
        "PaymentId",
        sql.Int,
        current.PaymentInfo.PaymentId,
      ).query(`
          UPDATE Payments
          SET Status = 'REFUNDED'
          WHERE PaymentId = @PaymentId
        `);

      // 3. Mark Invoice as REFUNDED
      await new sql.Request(tx).input("InvoiceId", sql.Int, id).query(`
        UPDATE Invoices
        SET Status = 'REFUNDED'
        WHERE InvoiceId = @InvoiceId
      `);

      // 4. Mark Appointment as CANCELLED and log history
      await addStatusHistory(
        tx,
        Number(current.AppointmentId),
        current.AppointmentStatus,
        "CANCELLED",
        userId,
        reason || "Hoàn trả dịch vụ combo",
      );

      await new sql.Request(tx).input("AppointmentId", sql.Int, current.AppointmentId).query(`
        UPDATE Appointments
        SET Status = 'CANCELLED', UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
      `);

    } else {
      // Cash/Transfer refund flow
      const existed = await new sql.Request(tx).input(
        "PaymentId",
        sql.Int,
        current.PaymentInfo.PaymentId,
      ).query(`
          SELECT RefundId
          FROM Refunds
          WHERE PaymentId = @PaymentId
            AND Status IN ('PENDING', 'APPROVED', 'COMPLETED')
        `); // Removed LIMIT 1 since it's SQL Server and not supported without TOP or offset

      if (existed.recordset[0]) {
        throw new Error("Hóa đơn này đã có yêu cầu hoàn tiền");
      }

      const bankCode = data.bankCode || data.BankCode;
      const accountNumber = data.accountNumber || data.AccountNumber;
      const accountName = data.accountName || data.AccountName;

      refundResult = await new sql.Request(tx)
        .input("PaymentId", sql.Int, current.PaymentInfo.PaymentId)
        .input("RefundAmount", sql.Decimal(18, 2), refundAmount)
        .input("Reason", sql.NVarChar, reason)
        .input("Status", sql.NVarChar, "PENDING")
        .input("BankCode", sql.NVarChar, bankCode)
        .input("AccountNumber", sql.NVarChar, accountNumber)
        .input("AccountName", sql.NVarChar, accountName)
        .query(`
          INSERT INTO Refunds
            (PaymentId, RefundAmount, Reason, Status, BankCode, AccountNumber, AccountName)
          OUTPUT INSERTED.*
          VALUES
            (@PaymentId, @RefundAmount, @Reason, @Status, @BankCode, @AccountNumber, @AccountName)
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
    }

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
          UpdatedAt = CURRENT_TIMESTAMP
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

    if (current.AppointmentDate) {
      try {
        const { runAutoMatch } = require("../waiting-list/waiting-list.service");
        const dateStr = current.AppointmentDate instanceof Date
          ? current.AppointmentDate.toISOString().slice(0, 10)
          : String(current.AppointmentDate).slice(0, 10);
        runAutoMatch(dateStr, {
          startTime: current.StartTime,
          endTime: current.EndTime,
          employeeId: current.EmployeeId,
          branchId: current.BranchId
        }).catch(err => console.error("Auto match failed after receptionist refund request:", err.message));
      } catch (err) {
        console.error("Auto match trigger failed after receptionist refund request:", err.message);
      }
    }

    return {
      Refund: refundResult?.recordset?.[0] || null,
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
async function getWaitingAvailableSlots(id, query = {}) {
  const pool = await connectDB();
  const waitingId = Number(id);

  if (!waitingId) throw new Error("WaitingId không hợp lệ");

  const waitingResult = await pool
    .request()
    .input("WaitingId", sql.Int, waitingId).query(`
      SELECT
        w.*,
        s.DurationMinutes
      FROM WaitingList w
      JOIN Services s ON s.ServiceId = w.ServiceId
      WHERE w.WaitingId = @WaitingId
        AND w.Status IN ('WAITING', 'NOTIFIED', 'MATCHED')
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  const waiting = waitingResult.recordset[0];
  if (!waiting)
    throw new Error("Không tìm thấy yêu cầu hàng chờ đang hoạt động");

  const appointmentDate = normalizeDateOnly(
    query.appointmentDate || waiting.PreferredDate,
  );

  const technicianId = Number(
    query.technicianId || query.employeeId || waiting.PreferredEmployeeId || 0,
  );

  if (!appointmentDate) throw new Error("Vui lòng chọn ngày cần kiểm tra");

  const techsResult = await pool
    .request()
    .input("ServiceId", sql.Int, waiting.ServiceId)
    .input("TechnicianId", sql.Int, technicianId || null)
    .query(`
      SELECT
        e.EmployeeId,
        u.FullName AS TechnicianName
      FROM Employees e
      JOIN Users u ON u.UserId = e.UserId
      JOIN EmployeeServices es ON es.EmployeeId = e.EmployeeId
      WHERE es.ServiceId = @ServiceId
        AND UPPER(COALESCE(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
        AND (@TechnicianId IS NULL OR e.EmployeeId = @TechnicianId)
      ORDER BY u.FullName ASC
    `);

  const techs = techsResult.recordset;
  const slots = [];

  const availabilityService = require("../appointments/availability.service");

  for (const tech of techs) {
    try {
      const techSlots = await availabilityService.calculateSlotsInternal({
        employeeId: tech.EmployeeId,
        serviceId: waiting.ServiceId,
        appointmentDate,
        excludeWaitingId: waitingId,
      });

      for (const slot of techSlots) {
        if (slot.available !== false) {
          slots.push({
            startTime: String(slot.startTime).slice(0, 5),
            endTime: String(slot.endTime).slice(0, 5),
            employeeId: tech.EmployeeId,
            technicianId: tech.EmployeeId,
            technicianName: tech.TechnicianName,
          });
        }
      }
    } catch (err) {
      console.error(`Lỗi tính slot cho KTV ${tech.EmployeeId}:`, err);
    }
  }

  slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return slots;
}

async function getWaitingList(filters = {}) {
  const pool = await connectDB();

  // Proactively expire MATCHED/NOTIFIED holds that have timed out
  const expiredHoldsResult = await pool.request().query(`
    SELECT WaitingId, MatchedDate
    FROM WaitingList
    WHERE Status IN ('MATCHED', 'NOTIFIED')
      AND HoldExpiresAt <= GETUTCDATE()
  `);
  for (const row of expiredHoldsResult.recordset) {
    await pool.request()
      .input("WaitingId", sql.Int, row.WaitingId)
      .query(`
        UPDATE WaitingList
        SET Status = 'SKIPPED',
            HoldExpiresAt = NULL,
            MatchedEmployeeId = NULL,
            MatchedDate = NULL,
            MatchedStartTime = NULL,
            MatchedEndTime = NULL,
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE WaitingId = @WaitingId
      `);
    const dateStr = row.MatchedDate instanceof Date
      ? row.MatchedDate.toISOString().slice(0, 10)
      : String(row.MatchedDate).slice(0, 10);
    try {
      const { runAutoMatch } = require("../waiting-list/waiting-list.service");
      runAutoMatch(dateStr).catch(err => console.error("Auto match failed after proactive hold expiry:", err.message));
    } catch (e) {
      console.error("Failed to require waiting-list.service or run auto match:", e.message);
    }
  }

  // Proactively expire WAITING holds that have expired
  await pool.request().query(`
    UPDATE WaitingList
    SET Status = 'EXPIRED',
        UpdatedAt = CURRENT_TIMESTAMP
    WHERE Status = 'WAITING'
      AND ExpireAt <= GETUTCDATE()
  `);

  const customer = normalizeText(filters.customer);
  const status = normalizeText(filters.status).toUpperCase();
  const serviceId = filters.serviceId ? Number(filters.serviceId) : null;
  const date = normalizeDateOnly(filters.date);

  const result = await pool
    .request()
    .input("Customer", sql.NVarChar, customer || null)
    .input("Status", sql.NVarChar, status || null)
    .input("ServiceId", sql.Int, serviceId)
    .input("Date", sql.Date, date).query(`
      SELECT
        w.WaitingId,
        w.CustomerId,
        w.ServiceId,
        w.PreferredEmployeeId,
        w.PreferredBranchId,
        w.PreferredDate,
        CONVERT(VARCHAR(5), w.PreferredTime, 108) AS PreferredTime,
        CONVERT(VARCHAR(5), w.PreferredTimeFrom, 108) AS PreferredTimeFrom,
        CONVERT(VARCHAR(5), w.PreferredTimeTo, 108) AS PreferredTimeTo,
        COALESCE(w.FlexibleTimeSlot, 'ANY') AS FlexibleTimeSlot,
        COALESCE(w.PriorityLevel, 'NORMAL') AS PriorityLevel,
        COALESCE(w.ContactMethod, 'PHONE') AS ContactMethod,
        COALESCE(w.ContactPhone, '') AS ContactPhone,
        COALESCE(w.Reason, '') AS Reason,
        COALESCE(w.Note, '') AS Note,
        COALESCE(w.CancelReason, '') AS CancelReason,
        w.ConvertedAppointmentId,
        w.Status,
        w.CreatedAt,
        w.UpdatedAt,
        w.AcceptOtherTechnician,
        w.AcceptOtherTimeSlots,
        w.HoldExpiresAt,
        w.ExpireAt,
        w.MatchedEmployeeId,
        w.MatchedDate,
        CONVERT(VARCHAR(5), w.MatchedStartTime, 108) AS MatchedStartTime,
        CONVERT(VARCHAR(5), w.MatchedEndTime, 108) AS MatchedEndTime,
        meU.FullName AS MatchedEmployeeName,
        DATEDIFF(MINUTE, w.CreatedAt, CURRENT_TIMESTAMP) AS WaitingMinutes,

        u.FullName AS CustomerName,
        u.Phone AS CustomerPhone,
        u.Email AS CustomerEmail,
        u.AvatarUrl AS CustomerAvatarUrl,

        s.ServiceName,
        s.Price,
        s.DurationMinutes,
        s.ImageUrl AS ServiceImageUrl,

        eu.FullName AS PreferredEmployeeName,
        b.BranchName AS PreferredBranchName,

        ROW_NUMBER() OVER (
          PARTITION BY w.ServiceId, w.PreferredDate
          ORDER BY
            CASE COALESCE(w.PriorityLevel, 'NORMAL')
              WHEN 'URGENT' THEN 1
              WHEN 'HIGH' THEN 2
              ELSE 3
            END,
            w.CreatedAt ASC,
            w.WaitingId ASC
        ) AS WaitingPosition
      FROM WaitingList w
      JOIN Customers c ON c.CustomerId = w.CustomerId
      JOIN Users u ON u.UserId = c.UserId
      JOIN Services s ON s.ServiceId = w.ServiceId
      LEFT JOIN Employees e ON e.EmployeeId = w.PreferredEmployeeId
      LEFT JOIN Users eu ON eu.UserId = e.UserId
      LEFT JOIN Branches b ON b.BranchId = w.PreferredBranchId
      LEFT JOIN Employees me ON me.EmployeeId = w.MatchedEmployeeId
      LEFT JOIN Users meU ON meU.UserId = me.UserId
      WHERE
        (@Customer IS NULL
          OR u.FullName LIKE '%' || @Customer || '%'
          OR u.Phone LIKE '%' || @Customer || '%'
          OR u.Email LIKE '%' || @Customer || '%')
        AND (@Status IS NULL OR w.Status = @Status)
        AND (@ServiceId IS NULL OR w.ServiceId = @ServiceId)
        AND (@Date IS NULL OR w.PreferredDate = @Date)
      ORDER BY
        CASE w.Status
          WHEN 'WAITING' THEN 1
          WHEN 'MATCHED' THEN 2
          WHEN 'NOTIFIED' THEN 3
          WHEN 'BOOKED' THEN 4
          WHEN 'CANCELLED' THEN 5
          WHEN 'SKIPPED' THEN 6
          WHEN 'EXPIRED' THEN 7
          ELSE 8
        END,
        CASE COALESCE(w.PriorityLevel, 'NORMAL')
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          ELSE 3
        END,
        w.CreatedAt ASC
    `);

  return result.recordset;
}

async function createWaitingList(data = {}) {
  const pool = await connectDB();

  const customerId = Number(data.customerId || data.CustomerId || 0);
  const serviceId = Number(data.serviceId || data.ServiceId || 0);
  const preferredEmployeeId = Number(
    data.preferredEmployeeId ||
      data.employeeId ||
      data.PreferredEmployeeId ||
      0,
  );
  const preferredBranchId = Number(
    data.preferredBranchId || data.branchId || data.PreferredBranchId || 0,
  );

  const preferredDate = normalizeDateOnly(
    data.preferredDate || data.PreferredDate,
  );

  const preferredTime = normalizeText(data.preferredTime || data.PreferredTime);
  const priorityLevel = normalizeText(
    data.priorityLevel || "NORMAL",
  ).toUpperCase();
  const contactMethod = normalizeText(
    data.contactMethod || "PHONE",
  ).toUpperCase();
  const contactPhone = normalizeText(data.contactPhone || data.ContactPhone);
  const reason =
    normalizeText(data.reason || data.Reason) ||
    "Khách muốn chờ nếu có slot trống";
  const note = normalizeText(data.note || data.Note);

  if (!customerId) throw new Error("Vui lòng chọn khách hàng");
  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ");

  if (!["NORMAL", "HIGH", "URGENT"].includes(priorityLevel)) {
    throw new Error("Mức độ ưu tiên không hợp lệ");
  }

  if (!["PHONE", "EMAIL", "ZALO", "SMS"].includes(contactMethod)) {
    throw new Error("Phương thức liên hệ không hợp lệ");
  }

  const customer = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .query(
      `SELECT CustomerId FROM Customers WHERE CustomerId = @CustomerId ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`,
    );


  if (!customer.recordset[0]) throw new Error("Khách hàng không tồn tại");

  const service = await pool.request().input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT ServiceId
      FROM Services
      WHERE ServiceId = @ServiceId
        AND UPPER(COALESCE(Status, 'AVAILABLE')) IN ('AVAILABLE', 'ACTIVE')
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (!service.recordset[0]) {
    throw new Error("Dịch vụ không tồn tại hoặc đã ngừng hoạt động");
  }

  if (preferredEmployeeId) {
    const tech = await pool
      .request()
      .input("EmployeeId", sql.Int, preferredEmployeeId)
      .input("ServiceId", sql.Int, serviceId).query(`
        SELECT e.EmployeeId
        FROM Employees e
        JOIN EmployeeServices es ON es.EmployeeId = e.EmployeeId
        WHERE e.EmployeeId = @EmployeeId
          AND es.ServiceId = @ServiceId
          AND UPPER(COALESCE(e.Status, 'ACTIVE')) IN ('ACTIVE', 'AVAILABLE', 'WORKING')
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

    if (!tech.recordset[0]) {
      throw new Error("Kỹ thuật viên không phù hợp với dịch vụ đã chọn");
    }
  }

  const duplicated = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("ServiceId", sql.Int, serviceId)
    .input("PreferredDate", sql.VarChar, preferredDate || null).query(`
      SELECT WaitingId
      FROM WaitingList
      WHERE CustomerId = @CustomerId
        AND ServiceId = @ServiceId
        AND (
          (@PreferredDate IS NULL AND PreferredDate IS NULL)
          OR (CONVERT(VARCHAR(10), PreferredDate, 120) = @PreferredDate)
        )
        AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED')
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  if (duplicated.recordset[0]) {
    throw new Error("Khách hàng này đang có yêu cầu chờ cho dịch vụ này trong ngày đã chọn");
  }

  if (preferredDate) {
    const activeAppt = await pool
      .request()
      .input("CustomerId", sql.Int, customerId)
      .input("ServiceId", sql.Int, serviceId)
      .input("PreferredDate", sql.VarChar, preferredDate)
      .query(`
        SELECT a.AppointmentId
        FROM Appointments a
        INNER JOIN AppointmentServices asvc ON asvc.AppointmentId = a.AppointmentId
        WHERE a.CustomerId = @CustomerId
          AND asvc.ServiceId = @ServiceId
          AND CONVERT(VARCHAR(10), a.AppointmentDate, 120) = @PreferredDate
          AND a.Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

    if (activeAppt.recordset[0]) {
      throw new Error("Khách hàng này đã có lịch hẹn hoạt động cho dịch vụ này trong ngày đã chọn");
    }
  }

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("ServiceId", sql.Int, serviceId)
    .input("PreferredEmployeeId", sql.Int, preferredEmployeeId || null)
    .input("PreferredBranchId", sql.Int, preferredBranchId || null)
    .input("PreferredDate", sql.VarChar, preferredDate || null)
    .input("PreferredTime", sql.VarChar, preferredTime || null)
    .input("PriorityLevel", sql.NVarChar, priorityLevel)
    .input("ContactMethod", sql.NVarChar, contactMethod)
    .input("ContactPhone", sql.NVarChar, contactPhone || null)
    .input("Reason", sql.NVarChar, reason)
    .input("Note", sql.NVarChar, note || null).query(`
      INSERT INTO WaitingList
      (
        CustomerId,
        ServiceId,
        PreferredEmployeeId,
        PreferredBranchId,
        PreferredDate,
        PreferredTime,
        PreferredTimeFrom,
        FlexibleTimeSlot,
        PriorityLevel,
        ContactMethod,
        ContactPhone,
        Reason,
        Note,
        Status,
        CreatedAt,
        UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @CustomerId,
        @ServiceId,
        @PreferredEmployeeId,
        @PreferredBranchId,
        @PreferredDate,
        CASE WHEN @PreferredTime IS NULL OR @PreferredTime = ''
          THEN NULL ELSE CAST(@PreferredTime AS TIME) END,
        CASE WHEN @PreferredTime IS NULL OR @PreferredTime = ''
          THEN NULL ELSE CAST(@PreferredTime AS TIME) END,
        'ANY',
        @PriorityLevel,
        @ContactMethod,
        @ContactPhone,
        @Reason,
        @Note,
        'WAITING',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

  return result.recordset[0];
}

async function updateWaitingList(id, data = {}) {
  const pool = await connectDB();

  const waitingId = Number(id);
  const status = normalizeText(data.status || data.Status).toUpperCase();
  const cancelReason = normalizeText(data.cancelReason || data.CancelReason);

  if (!waitingId) throw new Error("WaitingId không hợp lệ");

  if (!["WAITING", "NOTIFIED", "BOOKED", "CANCELLED", "MATCHED", "SKIPPED", "EXPIRED"].includes(status)) {
    throw new Error("Trạng thái Waiting List không hợp lệ");
  }

  const existed = await pool.request()
    .input("WaitingId", sql.Int, waitingId)
    .query(`SELECT Status, MatchedDate FROM WaitingList WHERE WaitingId = @WaitingId`);
  const currentItem = existed.recordset[0];
  if (!currentItem) throw new Error("Không tìm thấy yêu cầu hàng chờ");

  await pool
    .request()
    .input("WaitingId", sql.Int, waitingId)
    .input("Status", sql.NVarChar, status)
    .input("CancelReason", sql.NVarChar, cancelReason || null).query(`
      UPDATE WaitingList
      SET
        Status = @Status,
        CancelReason = CASE
          WHEN @Status = 'CANCELLED' THEN @CancelReason
          ELSE CancelReason
        END,
        HoldExpiresAt = CASE WHEN @Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING') THEN NULL ELSE HoldExpiresAt END,
        MatchedEmployeeId = CASE WHEN @Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING') THEN NULL ELSE MatchedEmployeeId END,
        MatchedDate = CASE WHEN @Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING') THEN NULL ELSE MatchedDate END,
        MatchedStartTime = CASE WHEN @Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING') THEN NULL ELSE MatchedStartTime END,
        MatchedEndTime = CASE WHEN @Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING') THEN NULL ELSE MatchedEndTime END,
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE WaitingId = @WaitingId
        AND Status <> 'BOOKED'
    `);

  if (['MATCHED', 'NOTIFIED'].includes(currentItem.Status) && ['CANCELLED', 'SKIPPED', 'EXPIRED', 'WAITING'].includes(status) && currentItem.MatchedDate) {
    const dateStr = currentItem.MatchedDate instanceof Date
      ? currentItem.MatchedDate.toISOString().slice(0, 10)
      : String(currentItem.MatchedDate).slice(0, 10);
    try {
      const { runAutoMatch } = require("../waiting-list/waiting-list.service");
      runAutoMatch(dateStr, {
        startTime: currentItem.MatchedStartTime,
        endTime: currentItem.MatchedEndTime,
        employeeId: currentItem.MatchedEmployeeId,
        branchId: currentItem.PreferredBranchId
      }).catch(err => console.error("Auto match failed after receptionist update status:", err.message));
    } catch (e) {
      console.error("Failed to require waiting-list.service or run auto match:", e.message);
    }
  }

  return {
    WaitingId: waitingId,
    Status: status,
  };
}

async function deleteWaitingList(id, cancelReason = null) {
  const pool = await connectDB();
  const existed = await pool.request()
    .input("WaitingId", sql.Int, Number(id))
    .query(`SELECT Status FROM WaitingList WHERE WaitingId = @WaitingId`);
  const currentItem = existed.recordset[0];
  if (!currentItem) throw new Error("Không tìm thấy yêu cầu hàng chờ");
  if (!["WAITING", "NOTIFIED"].includes(currentItem.Status)) {
    throw new Error("Chỉ có thể hủy yêu cầu đang chờ hoặc đã thông báo.");
  }

  return updateWaitingList(id, {
    status: "CANCELLED",
    cancelReason: cancelReason || "Receptionist hủy yêu cầu hàng chờ",
  });
}

async function convertWaitingListToAppointment(id, data = {}, userId = null) {
  const pool = await connectDB();
  const waitingId = Number(id);

  if (!waitingId) throw new Error("WaitingId không hợp lệ");

  const waitingResult = await pool
    .request()
    .input("WaitingId", sql.Int, waitingId).query(`
      SELECT *
      FROM WaitingList
      WHERE WaitingId = @WaitingId
        AND Status IN ('WAITING', 'NOTIFIED', 'MATCHED')
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  const waiting = waitingResult.recordset[0];
  if (!waiting)
    throw new Error("Không tìm thấy yêu cầu hàng chờ đang hoạt động");

  const technicianId = Number(
    data.technicianId || data.employeeId || waiting.PreferredEmployeeId || 0,
  );

  const appointmentDate = normalizeDateOnly(
    data.appointmentDate || data.preferredDate || waiting.PreferredDate,
  );

  const startTime = String(
    data.startTime ||
      data.preferredTime ||
      waiting.PreferredTime ||
      waiting.PreferredTimeFrom ||
      "",
  ).slice(0, 5);

  if (!technicianId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");
  if (!startTime) throw new Error("Vui lòng chọn giờ hẹn");

  const availableSlots = await getWaitingAvailableSlots(waitingId, {
    appointmentDate,
    technicianId,
  });

  const matchedSlot = availableSlots.find(
    (slot) =>
      slot.startTime === startTime &&
      Number(slot.employeeId || slot.technicianId) === Number(technicianId),
  );

  if (!matchedSlot) {
    throw new Error("Slot này không còn trống, vui lòng chọn slot khác");
  }

  const appointment = await createAppointment(
    {
      customerId: waiting.CustomerId,
      serviceIds: [waiting.ServiceId],
      technicianId,
      appointmentDate,
      startTime,
      note: data.note || waiting.Note || "Tạo từ Waiting List",
      paymentStatus: data.paymentStatus || "UNPAID",
      paymentMethod: data.paymentMethod || "CASH",
    },
    userId,
  );

  await pool
    .request()
    .input("WaitingId", sql.Int, waitingId)
    .input("AppointmentId", sql.Int, appointment.AppointmentId).query(`
      UPDATE WaitingList
      SET
        Status = 'BOOKED',
        ConvertedAppointmentId = @AppointmentId,
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE WaitingId = @WaitingId
    `);

  return {
    ...appointment,
    WaitingId: waitingId,
  };
}

async function getReceptionistNotifications(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT
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
      OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY`);

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

async function markAllNotificationsRead(userId) {
  const pool = await connectDB();

  await pool
    .request()
    .input("UserId", sql.Int, userId).query(`
      UPDATE Notifications
      SET IsRead = 1
      WHERE UserId = @UserId AND IsRead = 0
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
        COALESCE(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating,
        COALESCE(AVG(CAST(r.TechnicianRating AS FLOAT)), 0) AS AverageTechnicianRating,
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
          OR cu.FullName LIKE '%' || @Keyword || '%'
          OR cu.Phone LIKE '%' || @Keyword || '%'
          OR cu.Email LIKE '%' || @Keyword || '%'
          OR s.ServiceName LIKE '%' || @Keyword || '%'
          OR r.Comment LIKE '%' || @Keyword || '%')
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
      SELECT
        r.ReviewId,
        r.CustomerId,
        cu.FullName AS CustomerName,
        cu.AvatarUrl AS CustomerAvatarUrl,
COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
        r.AppointmentId,
        r.ServiceId,
        s.ServiceName,
        r.EmployeeId AS TechnicianId,
        eu.FullName AS TechnicianName,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.CreatedAt,
        (
          SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
          FROM ReviewImages ri
          WHERE ri.ReviewId = r.ReviewId
          FOR JSON PATH
        ) AS ImagesJson
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE '%' || @Keyword || '%'
          OR cu.Phone LIKE '%' || @Keyword || '%'
          OR cu.Email LIKE '%' || @Keyword || '%'
          OR s.ServiceName LIKE '%' || @Keyword || '%'
          OR r.Comment LIKE '%' || @Keyword || '%')
        AND (@Status IS NULL OR UPPER(r.Status) = @Status)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@ServiceId IS NULL OR r.ServiceId = @ServiceId)
        AND (@TechnicianId IS NULL OR r.EmployeeId = @TechnicianId)
        AND (@DateFrom IS NULL OR CAST(r.CreatedAt AS DATE) >= @DateFrom)
        AND (@DateTo IS NULL OR CAST(r.CreatedAt AS DATE) <= @DateTo)
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
      OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

  const serviceStats = await pool.request().query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      COUNT(r.ReviewId) AS ReviewCount,
      COALESCE(AVG(CAST(r.Rating AS FLOAT)), 0) AS AverageRating
    FROM Services s
    LEFT JOIN Reviews r ON s.ServiceId = r.ServiceId
    GROUP BY s.ServiceId, s.ServiceName
    ORDER BY ReviewCount DESC, AverageRating DESC
      OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`);

  const reviews = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword || null)
    .input("Status", sql.NVarChar, status || null)
    .input("Rating", sql.Int, rating)
    .input("ServiceId", sql.Int, serviceId)
    .input("TechnicianId", sql.Int, technicianId)
    .input("DateFrom", sql.Date, dateFrom)
    .input("DateTo", sql.Date, dateTo).query(`
      SELECT
        r.ReviewId,
        r.CustomerId,
        cu.FullName AS CustomerName,
        cu.Phone AS CustomerPhone,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatarUrl,
COALESCE(e.ImageUrl, eu.AvatarUrl) AS TechnicianAvatarUrl,
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
        r.UpdatedAt,
        (
          SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
          FROM ReviewImages ri
          WHERE ri.ReviewId = r.ReviewId
          FOR JSON PATH
        ) AS ImagesJson
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE '%' || @Keyword || '%'
          OR cu.Phone LIKE '%' || @Keyword || '%'
          OR cu.Email LIKE '%' || @Keyword || '%'
          OR s.ServiceName LIKE '%' || @Keyword || '%'
          OR r.Comment LIKE '%' || @Keyword || '%')
        AND (@Status IS NULL OR UPPER(r.Status) = @Status)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@ServiceId IS NULL OR r.ServiceId = @ServiceId)
        AND (@TechnicianId IS NULL OR r.EmployeeId = @TechnicianId)
        AND (@DateFrom IS NULL OR CAST(r.CreatedAt AS DATE) >= @DateFrom)
        AND (@DateTo IS NULL OR CAST(r.CreatedAt AS DATE) <= @DateTo)
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
      OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY`);

  const parsedReviews = (reviews.recordset || []).map((row) => ({
    ...row,
    Images: Array.isArray(row.ImagesJson) ? row.ImagesJson
      : (row.ImagesJson ? (typeof row.ImagesJson === 'string' ? JSON.parse(row.ImagesJson) : row.ImagesJson) : []),
  }));

  const parsedLatest = latest.recordset[0]
    ? {
        ...latest.recordset[0],
        Images: (() => {
          const img = latest.recordset[0].ImagesJson;
          if (!img) return [];
          if (Array.isArray(img)) return img;
          if (typeof img === 'string') return JSON.parse(img);
          return img;
        })(),
      }
    : null;

  return {
    Summary: summary.recordset[0] || {},
    LatestReview: parsedLatest,
    ServiceStats: serviceStats.recordset || [],
    Reviews: parsedReviews,
  };
}

async function getReceptionistProfile(userId) {
  const pool = await connectDB();

  const profileResult = await pool.request().input("UserId", sql.Int, userId)
    .query(`
      SELECT
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
        e.Status AS EmployeeStatus,
        b.BranchName
      FROM Users u
      LEFT JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Employees e ON u.UserId = e.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      WHERE u.UserId = @UserId
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);

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
    SELECT
      a.AppointmentId,
      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      a.Status,
      cu.FullName AS CustomerName
    FROM Appointments a
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN Users cu ON c.UserId = cu.UserId
    ORDER BY a.CreatedAt DESC, a.AppointmentId DESC
      OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`);

  const recentInvoices = await pool.request().query(`
    SELECT
      i.InvoiceId,
      i.AppointmentId,
      i.Status,
      COALESCE(i.FinalAmount, i.TotalAmount) AS FinalAmount,
      cu.FullName AS CustomerName
    FROM Invoices i
    LEFT JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    LEFT JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN Users cu ON c.UserId = cu.UserId
    ORDER BY i.CreatedAt DESC, i.InvoiceId DESC
      OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`);

  const shiftsResult = await pool.request().input("EmployeeId", sql.Int, profile.EmployeeId || 0)
    .query(`
      SELECT 
        ws.ShiftId,
        ws.ShiftName,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        COALESCE(sr.Status, 'APPROVED') AS Status
      FROM WorkShifts ws
      LEFT JOIN ShiftRegistrations sr ON ws.ShiftId = sr.ShiftId AND sr.TechnicianId = @EmployeeId
      WHERE (
        (sr.TechnicianId = @EmployeeId AND sr.Status = 'APPROVED')
        OR (ws.ShiftName <> N'Cả Ngày' AND EXISTS (
          SELECT 1 FROM Appointments app
          WHERE app.EmployeeId = @EmployeeId
            AND app.AppointmentDate = ws.ShiftDate
            AND app.Status NOT IN ('CANCELLED', 'NO_SHOW')
            AND CONVERT(VARCHAR(5), app.StartTime, 108) >= CONVERT(VARCHAR(5), ws.StartTime, 108)
            AND CONVERT(VARCHAR(5), app.StartTime, 108) < CONVERT(VARCHAR(5), ws.EndTime, 108)
        ))
      )
      ORDER BY ws.ShiftDate ASC, ws.StartTime ASC
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
    shifts: shiftsResult.recordset || [],
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
          UpdatedAt = CURRENT_TIMESTAMP
      WHERE UserId = @UserId
    `);

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("Position", sql.NVarChar(100), position)
    .input("Bio", sql.NVarChar(sql.MAX), bio).query(`
      UPDATE Employees
      SET Position = @Position,
          Bio = @Bio
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
          UpdatedAt = CURRENT_TIMESTAMP
      WHERE UserId = @UserId
    `);

  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AvatarUrl", sql.NVarChar(255), avatarUrl).query(`
      UPDATE Employees
      SET ImageUrl = @AvatarUrl
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

async function checkoutAppointment(id, userId = null) {
  const pool = await connectDB();
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Không tìm thấy lịch hẹn");

  const status = String(current.Status).toUpperCase();
  const paymentStatus = String(current.PaymentStatus).toUpperCase();

  // Validate: Only allow checkout if current state is IN_PROGRESS or COMPLETED
  if (!["IN_PROGRESS", "COMPLETED"].includes(status)) {
    throw new Error(`Trạng thái lịch hẹn không hợp lệ để check-out (Hiện tại: ${statusLabel(current.Status)})`);
  }

  if (current.CheckedOutAt) {
    throw new Error("Khách hàng đã được check-out trước đó");
  }

  // 1. Kiểm tra còn dịch vụ chưa hoàn thành thông tin liệu trình (TreatmentNotesV2)
  const servicesResult = await pool.request()
    .input("AppointmentId", sql.Int, id)
    .query(`SELECT ServiceId, Price FROM AppointmentServices WHERE AppointmentId = @AppointmentId`);

  const apptServices = servicesResult.recordset || [];
  if (apptServices.length === 0) {
    throw new Error("Lịch hẹn không có dịch vụ nào đăng ký");
  }

  // Get all treatment notes for this appointment
  const notesResult = await pool.request()
    .input("AppointmentId", sql.Int, id)
    .query(`SELECT service_id, status FROM TreatmentNotesV2 WHERE appointment_id = @AppointmentId`);

  const treatmentNotes = notesResult.recordset || [];

  for (const s of apptServices) {
    const note = treatmentNotes.find(n => n.service_id === s.ServiceId);
    if (!note) {
      throw new Error(`Dịch vụ ${s.ServiceId} chưa được kỹ thuật viên điền hồ sơ trị liệu`);
    }
  }

  // 2. Kiểm tra hóa đơn đã thanh toán chưa
  if (paymentStatus !== "PAID") {
    throw new Error("Hóa đơn lịch hẹn chưa thanh toán. Vui lòng thanh toán trước khi check-out");
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 3. Cập nhật lịch hẹn: CheckedOutAt, CompletedAt, Status
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .query(`
        UPDATE Appointments
        SET Status = 'COMPLETED',
            CheckedOutAt = CURRENT_TIMESTAMP,
            CompletedAt = CURRENT_TIMESTAMP,
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
      `);

    // Log status history transition
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("OldStatus", sql.NVarChar, current.Status)
      .input("UserId", sql.Int, userId)
      .query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, 'COMPLETED', @UserId, 'Receptionist checked-out customer', CURRENT_TIMESTAMP)
      `);

    // 4. Cộng điểm thành viên & Cập nhật membership (dự phòng trường hợp chưa cộng ở các bước thanh toán trước)
    const pointsCheckResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .query(`
        SELECT COUNT(*) AS count 
        FROM LoyaltyPointTransactions 
        WHERE AppointmentId = @AppointmentId AND Type = 'EARN'
      `);

    const pointsEarnedCount = pointsCheckResult.recordset[0]?.count || 0;
    if (pointsEarnedCount === 0) {
      // Find the payment record to get amount
      const paymentResult = await new sql.Request(transaction)
        .input("InvoiceId", sql.Int, current.InvoiceId)
        .query(`
          SELECT TOP 1 PaymentId, Amount
          FROM Payments
          WHERE InvoiceId = @InvoiceId AND Status = 'PAID'
          ORDER BY PaymentId DESC
        `);

      const paidPayment = paymentResult.recordset[0];
      const paidAmount = paidPayment ? Number(paidPayment.Amount) : Number(current.FinalAmount);

      if (paidAmount > 0 && current.CustomerId && paidPayment?.PaymentId) {
        await addLoyaltyPoints(
          transaction,
          current.CustomerId,
          paidPayment.PaymentId,
          id,
          paidAmount
        );
        await updateCustomerMembershipLevel(transaction, current.CustomerId);
      }
    }

    await transaction.commit();

    // 5. Gửi email cảm ơn sau dịch vụ
    if (current.CustomerEmail) {
      try {
        const { sendMail } = require("../../utils/sendMail");
        
        let servicesListHtml = "";
        if (apptServices.length > 0) {
          servicesListHtml = apptServices.map(s => `<li>Dịch vụ giá: ${Number(s.Price).toLocaleString('vi-VN')}đ</li>`).join("");
        }

        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
            <h2 style="color: #d91f68; border-bottom: 2px solid #fce7f3; padding-bottom: 8px;">Cảm ơn quý khách đã đồng hành cùng BeautyMS!</h2>
            <p>Chào <strong>${current.CustomerName}</strong>,</p>
            <p>Chúng tôi xin gửi lời cảm ơn chân thành nhất vì quý khách đã tin tưởng và sử dụng dịch vụ tại salon của chúng tôi vào ngày <strong>${new Date(current.AppointmentDate).toLocaleDateString('vi-VN')}</strong>.</p>
            
            <div style="background: #fafafa; border: 1px solid #eaeaea; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Tóm tắt dịch vụ đã thực hiện:</h3>
              <ul>
                ${servicesListHtml || '<li>Dịch vụ chăm sóc sắc đẹp</li>'}
              </ul>
              <p style="margin-bottom: 0;">Tổng số tiền thanh toán: <strong>${Number(current.FinalAmount).toLocaleString('vi-VN')}đ</strong></p>
            </div>
            
            <p>Mọi góp ý hoặc phản hồi của quý khách về dịch vụ và tay nghề Kỹ thuật viên <strong>${current.TechnicianName || 'Chuyên viên'}</strong> sẽ giúp chúng tôi hoàn thiện chất lượng phục vụ ngày một tốt hơn.</p>
            <p>Quý khách có thể đánh giá dịch vụ trực tuyến tại đây: 
              <a href="http://localhost:3000/customer/reviews" style="display: inline-block; background: #d91f68; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin-top: 5px;">Viết Đánh Giá Ngay</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">Đây là email tự động gửi từ hệ thống chăm sóc khách hàng của BeautyMS. Vui lòng không trả lời trực tiếp email này.</p>
          </div>
        `;

        await sendMail({
          to: current.CustomerEmail,
          subject: "[BeautyMS] Cảm ơn quý khách đã sử dụng dịch vụ",
          html: emailHtml
        });
        console.log(`[Checkout] Thank-you email sent successfully to ${current.CustomerEmail}`);
      } catch (mailErr) {
        console.error(`[Checkout] Failed to send check-out email to ${current.CustomerEmail}:`, mailErr.message);
      }
    }

    // 6. Tự động gửi thông báo Hóa đơn dịch vụ tới tài khoản khách hàng trên ứng dụng
    if (current.CustomerId) {
      try {
        const { create: createNotification } = require("../notifications/notifications.service");
        const custUserRes = await pool.request()
          .input("CustomerId", sql.Int, current.CustomerId)
          .query(`SELECT UserId FROM Customers WHERE CustomerId = @CustomerId`);
        const custUserId = custUserRes.recordset[0]?.UserId;

        if (custUserId) {
          await createNotification({
            userId: custUserId,
            title: `🧾 Hóa đơn thanh toán dịch vụ #${current.InvoiceId || id}`,
            content: `Dịch vụ làm đẹp cho lịch hẹn #${id} đã hoàn tất check-out. Tổng tiền thanh toán: ${Number(current.FinalAmount || 0).toLocaleString('vi-VN')}đ. Hóa đơn chi tiết đã được gửi tới email ${current.CustomerEmail || ''}. Cảm ơn quý khách!`,
            type: "INVOICE"
          });
          console.log(`[Checkout] In-app invoice notification created for UserId ${custUserId}`);
        }
      } catch (notifErr) {
        console.error(`[Checkout] Failed to create in-app invoice notification:`, notifErr.message);
      }
    }

    // Publish event
    eventBusService.publish("APPOINTMENT_CHECKED_OUT", {
      appointmentId: Number(id),
      userId
    });

    return await getAppointmentById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function finalizeCheckout(pool, id, userId = null) {
  const current = await getAppointmentById(id);
  if (!current) return;
  if (current.CheckedOutAt) return; // Already checked out, skip sending email again

  await pool.request()
    .input("AppointmentId", sql.Int, id)
    .query(`
      UPDATE Appointments
      SET CheckedOutAt = COALESCE(CheckedOutAt, CURRENT_TIMESTAMP),
          CompletedAt = COALESCE(CompletedAt, CURRENT_TIMESTAMP),
          Status = 'COMPLETED',
          UpdatedAt = CURRENT_TIMESTAMP
      WHERE AppointmentId = @AppointmentId
    `);

  const servicesResult = await pool.request()
    .input("AppointmentId", sql.Int, id)
    .query(`
      SELECT aps.ServiceId, aps.Price, s.ServiceName, s.DurationMinutes 
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = @AppointmentId
    `);
  const apptServices = servicesResult.recordset || [];

  if (current.CustomerEmail) {
    try {
      const { sendMail } = require("../../utils/sendMail");
      
      let servicesListHtml = "";
      if (apptServices.length > 0) {
        servicesListHtml = apptServices.map(s => 
          `<li style="margin-bottom: 6px;"><strong>${s.ServiceName}</strong> (${s.DurationMinutes || 30} phút) - ${current.CustomerPackageId ? "Trọn gói Combo" : `${Number(s.Price || 0).toLocaleString('vi-VN')}đ`}</li>`
        ).join("");
      }

      const isCombo = !!current.CustomerPackageId;
      const paymentInfoHtml = isCombo
        ? `<p style="margin-bottom: 0; font-size: 0.95rem;">Hình thức thanh toán: <strong style="color: #059669;">📦 Trọn gói Combo (${current.CustomerPackageName || 'Gói Combo'})</strong></p>`
        : `<p style="margin-bottom: 0; font-size: 0.95rem;">Tổng số tiền thanh toán: <strong>${Number(current.FinalAmount || 0).toLocaleString('vi-VN')}đ</strong></p>`;

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2f593a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">Cảm ơn quý khách đã trải nghiệm dịch vụ!</h2>
          <p>Chào <strong>${current.CustomerName}</strong>,</p>
          <p>Chúng tôi xin gửi lời cảm ơn chân thành vì quý khách đã tin tưởng và sử dụng dịch vụ tại salon của chúng tôi vào ngày <strong>${new Date(current.AppointmentDate).toLocaleDateString('vi-VN')}</strong>.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2f593a; font-size: 1rem;">Tóm tắt dịch vụ đã thực hiện:</h3>
            <ul style="padding-left: 20px; margin-bottom: 12px;">
              ${servicesListHtml || '<li>Dịch vụ chăm sóc sắc đẹp</li>'}
            </ul>
            ${paymentInfoHtml}
          </div>
          
          <p>Mọi góp ý hoặc phản hồi của quý khách về dịch vụ và tay nghề Kỹ thuật viên <strong>${current.TechnicianName || 'Chuyên viên'}</strong> sẽ giúp salon không ngừng nâng cao chất lượng phục vụ.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000/customer/reviews" style="display: inline-block; background: #2f593a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">Viết Đánh Giá Ngay</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 25px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">Đây là email tự động gửi từ hệ thống chăm sóc khách hàng. Vui lòng không trả lời trực tiếp email này.</p>
        </div>
      `;

      await sendMail({
        to: current.CustomerEmail,
        subject: `[Salon & Spa] Cảm ơn quý khách đã hoàn thành ${isCombo ? `buổi hẹn Combo '${current.CustomerPackageName || 'Combo'}'` : 'dịch vụ'}`,
        html: emailHtml
      });
      console.log(`[Checkout] Thank-you email sent successfully to ${current.CustomerEmail}`);
    } catch (mailErr) {
      console.error(`[Checkout] Failed to send check-out email to ${current.CustomerEmail}:`, mailErr.message);
    }
  }


  if (current.CustomerId) {
    try {
      const { create: createNotification } = require("../notifications/notifications.service");
      const custUserRes = await pool.request()
        .input("CustomerId", sql.Int, current.CustomerId)
        .query(`SELECT UserId FROM Customers WHERE CustomerId = @CustomerId`);
      const custUserId = custUserRes.recordset[0]?.UserId;

      if (custUserId) {
        await createNotification({
          userId: custUserId,
          title: `🧾 Hóa đơn thanh toán dịch vụ #${current.InvoiceId || id}`,
          content: `Dịch vụ làm đẹp cho lịch hẹn #${id} đã hoàn tất check-out. Tổng tiền thanh toán: ${Number(current.FinalAmount || 0).toLocaleString('vi-VN')}đ. Hóa đơn chi tiết đã được gửi tới email ${current.CustomerEmail || ''}. Cảm ơn quý khách!`,
          type: "INVOICE"
        });
        console.log(`[Checkout] In-app invoice notification created for UserId ${custUserId}`);
      }
    } catch (notifErr) {
      console.error(`[Checkout] Failed to create in-app invoice notification:`, notifErr.message);
    }
  }

  eventBusService.publish("APPOINTMENT_CHECKED_OUT", {
    appointmentId: Number(id),
    userId
  });
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  const hours = Number(parts[0] || 0);
  const minutes = Number(parts[1] || 0);
  return hours * 60 + minutes;
}

async function getTechnicianWorkload(employeeId, date) {
  if (!employeeId || !date) {
    throw new Error("Mã kỹ thuật viên và ngày là bắt buộc");
  }

  const pool = await connectDB();

  // Check if technician is on leave on this date (has no approved shift registrations)
  const leaveResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("Date", sql.Date, date)
    .query(`
      SELECT ws.ShiftId 
      FROM WorkShifts ws
      LEFT JOIN ShiftRegistrations sr ON ws.ShiftId = sr.ShiftId AND sr.TechnicianId = @EmployeeId
      WHERE ws.ShiftDate = @Date
        AND (
          (sr.TechnicianId = @EmployeeId AND sr.Status = 'APPROVED')
          OR (ws.ShiftName <> N'Cả Ngày' AND EXISTS (
            SELECT 1 FROM Appointments a
            WHERE a.EmployeeId = @EmployeeId
              AND a.AppointmentDate = ws.ShiftDate
              AND a.Status NOT IN ('CANCELLED', 'NO_SHOW')
              AND CONVERT(VARCHAR(5), a.StartTime, 108) >= CONVERT(VARCHAR(5), ws.StartTime, 108)
              AND CONVERT(VARCHAR(5), a.StartTime, 108) < CONVERT(VARCHAR(5), ws.EndTime, 108)
          ))
        )
    `);
  
  const isDayOff = leaveResult.recordset.length === 0;

  // Get all active appointments for this technician on this date
  const apptsResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("Date", sql.Date, date)
    .query(`
      SELECT AppointmentId, 
             CONVERT(VARCHAR(5), StartTime, 108) AS StartTime, 
             CONVERT(VARCHAR(5), EndTime, 108) AS EndTime, 
             Status
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @Date
        AND Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
      ORDER BY StartTime ASC
    `);

  const list = apptsResult.recordset || [];
  const totalAppointments = list.length;
  const isOverloaded = totalAppointments >= 5;

  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastEndTime = null;

  for (const app of list) {
    const start = app.StartTime;
    const end = app.EndTime;

    if (lastEndTime === null) {
      currentConsecutive = 1;
    } else {
      const endMins = parseTimeToMinutes(lastEndTime);
      const startMins = parseTimeToMinutes(start);
      if (startMins - endMins <= 15) {
        currentConsecutive += 1;
      } else {
        currentConsecutive = 1;
      }
    }
    lastEndTime = end;
    if (currentConsecutive > maxConsecutive) {
      maxConsecutive = currentConsecutive;
    }
  }

  const isConsecutiveOverloaded = maxConsecutive >= 3;

  return {
    employeeId: Number(employeeId),
    date,
    totalAppointments,
    isOverloaded,
    maxConsecutive,
    isConsecutiveOverloaded,
    isDayOff,
    appointments: list
  };
}

async function assignTechnician(appointmentId, technicianId, overrideOverload = false, userId = null) {
  const pool = await connectDB();

  // 1. Fetch appointment details
  const apptResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .query(`
      SELECT AppointmentId, EmployeeId, BranchId, AppointmentDate,
             CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
             CONVERT(VARCHAR(8), EndTime, 108) AS EndTime,
             Status, CustomerId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
    `);

  const appt = apptResult.recordset[0];
  if (!appt) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  const status = String(appt.Status).toUpperCase();
  if (["COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status)) {
    throw new Error(`Không thể thay đổi kỹ thuật viên cho lịch hẹn có trạng thái ${statusLabel(appt.Status)}`);
  }

  if (Number(appt.EmployeeId) === Number(technicianId)) {
    return appt; // Already assigned
  }

  const date = appt.AppointmentDate;
  const startTime = appt.StartTime;
  const endTime = appt.EndTime;

  // 2. Verify target technician branch matches appointment branch
  const techBranchResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(technicianId))
    .query(`SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId`);
  const techBranchId = techBranchResult.recordset[0]?.BranchId;

  let apptBranchId = appt.BranchId;
  if (!apptBranchId) {
    const currentEmpBranchResult = await pool.request()
      .input("EmployeeId", sql.Int, Number(appt.EmployeeId))
      .query(`SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId`);
    apptBranchId = currentEmpBranchResult.recordset[0]?.BranchId || null;
  }

  if (apptBranchId && techBranchId && Number(apptBranchId) !== Number(techBranchId)) {
    throw new Error("Không thể gán kỹ thuật viên từ chi nhánh khác cho lịch hẹn này");
  }

  // 3. Fetch all services for this appointment
  const servicesResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .query(`SELECT ServiceId FROM AppointmentServices WHERE AppointmentId = @AppointmentId`);

  const services = servicesResult.recordset || [];
  if (services.length === 0) {
    throw new Error("Lịch hẹn không có dịch vụ nào");
  }

  // Note: Shift registration is for attendance management only (Hướng B).
  // Technicians can be reassigned appointments regardless of shift registration status.

  // 4. Verify technician supports all services in this appointment
  const techServicesResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(technicianId))
    .query(`SELECT ServiceId FROM EmployeeServices WHERE EmployeeId = @EmployeeId`);

  const techServiceIds = (techServicesResult.recordset || []).map(ts => ts.ServiceId);

  for (const s of services) {
    if (!techServiceIds.includes(s.ServiceId)) {
      throw new Error(`Kỹ thuật viên không có chuyên môn hỗ trợ dịch vụ mã #${s.ServiceId}`);
    }
  }

  // 5. Verify Target Technician has no schedule conflicts
  const conflictResult = await pool.request()
    .input("EmployeeId",    sql.Int,        Number(technicianId))
    .input("Date",          sql.Date,        date)
    .input("AppointmentId", sql.Int,         Number(appointmentId))
    .input("StartTime",     sql.VarChar(8),  startTime)
    .input("EndTime",       sql.VarChar(8),  endTime)
    .query(`
      SELECT AppointmentId,
             CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
             CONVERT(VARCHAR(5), EndTime, 108) AS EndTime
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @Date
        AND AppointmentId <> @AppointmentId
        AND Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
        AND (
          @StartTime < CONVERT(VARCHAR(8), EndTime, 108)
          AND @EndTime > CONVERT(VARCHAR(8), StartTime, 108)
        )
    `);

  if (conflictResult.recordset.length > 0) {
    const conflict = conflictResult.recordset[0];
    throw new Error(`Kỹ thuật viên bị trùng lịch làm việc khác từ ${conflict.StartTime} đến ${conflict.EndTime}`);
  }

  const workload = await getTechnicianWorkload(technicianId, date);

  // 6. Overload detection warning
  if ((workload.isOverloaded || workload.isConsecutiveOverloaded) && !overrideOverload) {
    throw new Error(`OVERLOAD_WARNING: Kỹ thuật viên bị quá tải vào ngày này (${workload.totalAppointments} ca đã gán). Bạn có muốn tiếp tục ghi đè không?`);
  }

  // 6b. Fetch details for logging and notifications
  const oldTechNameRes = await pool.request()
    .input("EmployeeId", sql.Int, Number(appt.EmployeeId))
    .query(`
      SELECT e.UserId, u.FullName 
      FROM Employees e 
      JOIN Users u ON e.UserId = u.UserId 
      WHERE e.EmployeeId = @EmployeeId
    `);
  const oldTech = oldTechNameRes.recordset[0] || {};
  const oldTechName = oldTech.FullName || `KTV #${appt.EmployeeId}`;
  const oldTechUserId = oldTech.UserId;

  const newTechNameRes = await pool.request()
    .input("EmployeeId", sql.Int, Number(technicianId))
    .query(`
      SELECT e.UserId, u.FullName 
      FROM Employees e 
      JOIN Users u ON e.UserId = u.UserId 
      WHERE e.EmployeeId = @EmployeeId
    `);
  const newTech = newTechNameRes.recordset[0] || {};
  const newTechName = newTech.FullName || `KTV #${technicianId}`;
  const newTechUserId = newTech.UserId;

  const logReason = `Đổi kỹ thuật viên từ ${oldTechName} (ID: ${appt.EmployeeId}) sang ${newTechName} (ID: ${technicianId})`;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 7. Update technician
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("EmployeeId", sql.Int, Number(technicianId))
      .query(`
        UPDATE Appointments
        SET EmployeeId = @EmployeeId,
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE AppointmentId = @AppointmentId
      `);

    // Log status history transition
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("OldStatus", sql.NVarChar, appt.Status)
      .input("NewStatus", sql.NVarChar, appt.Status)
      .input("UserId", sql.Int, userId)
      .input("Reason", sql.NVarChar, logReason)
      .query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, @NewStatus, @UserId, @Reason, GETDATE())
      `);

    await transaction.commit();

    // Notify technicians
    try {
      const notificationsService = require("../notifications/notifications.service");
      const dateTextFormatted = new Date(date).toLocaleDateString("vi-VN");
      const timeTextFormatted = `${String(startTime).slice(0, 5)} - ${String(endTime).slice(0, 5)}`;

      if (newTechUserId) {
        await notificationsService.create({
          userId: newTechUserId,
          title: "Lịch hẹn mới được điều phối",
          content: `Bạn được gán phụ trách lịch hẹn #${appointmentId} vào ngày ${dateTextFormatted} lúc ${timeTextFormatted}.`,
          type: "APPOINTMENT_ASSIGNED"
        });
      }

      if (oldTechUserId && Number(appt.EmployeeId) !== Number(technicianId)) {
        await notificationsService.create({
          userId: oldTechUserId,
          title: "Lịch hẹn đã chuyển giao",
          content: `Lịch hẹn #${appointmentId} vào ngày ${dateTextFormatted} lúc ${timeTextFormatted} của bạn đã được chuyển giao cho KTV khác.`,
          type: "APPOINTMENT_UNASSIGNED"
        });
      }
    } catch (errNotif) {
      console.error("Failed to send assignment notification:", errNotif);
    }

    return await getAppointmentById(appointmentId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function transferAppointments(fromTechnicianId, toTechnicianId, date, overrideConflict = false, userId = null) {
  if (Number(fromTechnicianId) === Number(toTechnicianId)) {
    throw new Error("Không thể chuyển giao cho chính kỹ thuật viên đó");
  }

  const pool = await connectDB();

  // Validate technicians belong to the same branch
  const fromBranchResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(fromTechnicianId))
    .query(`SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId`);
  const fromBranchId = fromBranchResult.recordset[0]?.BranchId;

  const toBranchResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(toTechnicianId))
    .query(`SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId`);
  const toBranchId = toBranchResult.recordset[0]?.BranchId;

  if (fromBranchId && toBranchId && Number(fromBranchId) !== Number(toBranchId)) {
    throw new Error("Không thể chuyển giao lịch hẹn giữa các kỹ thuật viên thuộc chi nhánh khác nhau");
  }

  // Find all active appointments of fromTechnicianId on date
  const apptsResult = await pool.request()
    .input("FromId", sql.Int, Number(fromTechnicianId))
    .input("Date", sql.Date, date)
    .query(`
      SELECT AppointmentId,
             CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
             CONVERT(VARCHAR(8), EndTime, 108) AS EndTime,
             Status
      FROM Appointments
      WHERE EmployeeId = @FromId
        AND AppointmentDate = @Date
        AND Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW', 'COMPLETED')
      ORDER BY StartTime ASC
    `);

  const appointments = apptsResult.recordset || [];
  if (appointments.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      failures: []
    };
  }

  // Note: Shift registration is for attendance management only (Hướng B).
  // Technicians can receive transferred appointments regardless of shift status.

  const targetServicesResult = await pool.request()
    .input("EmployeeId", sql.Int, Number(toTechnicianId))
    .query(`SELECT ServiceId FROM EmployeeServices WHERE EmployeeId = @EmployeeId`);

  const targetServiceIds = (targetServicesResult.recordset || []).map(ts => ts.ServiceId);

  // Fetch technician names and user IDs before loop for logging and notifications
  const oldTechNameRes = await pool.request()
    .input("EmployeeId", sql.Int, Number(fromTechnicianId))
    .query(`
      SELECT e.UserId, u.FullName 
      FROM Employees e 
      JOIN Users u ON e.UserId = u.UserId 
      WHERE e.EmployeeId = @EmployeeId
    `);
  const oldTech = oldTechNameRes.recordset[0] || {};
  const oldTechName = oldTech.FullName || `KTV #${fromTechnicianId}`;
  const oldTechUserId = oldTech.UserId;

  const newTechNameRes = await pool.request()
    .input("EmployeeId", sql.Int, Number(toTechnicianId))
    .query(`
      SELECT e.UserId, u.FullName 
      FROM Employees e 
      JOIN Users u ON e.UserId = u.UserId 
      WHERE e.EmployeeId = @EmployeeId
    `);
  const newTech = newTechNameRes.recordset[0] || {};
  const newTechName = newTech.FullName || `KTV #${toTechnicianId}`;
  const newTechUserId = newTech.UserId;

  const failures = [];
  let successCount = 0;

  for (const app of appointments) {
    try {
      // Check services capability
      const appServicesRes = await pool.request()
        .input("AppointmentId", sql.Int, app.AppointmentId)
        .query(`SELECT ServiceId FROM AppointmentServices WHERE AppointmentId = @AppointmentId`);

      const services = appServicesRes.recordset || [];
      for (const s of services) {
        if (!targetServiceIds.includes(s.ServiceId)) {
          throw new Error("Không có chuyên môn hỗ trợ dịch vụ");
        }
      }

      // Check conflict using pre-formatted time strings from source query
      const conflictRes = await pool.request()
        .input("EmployeeId",    sql.Int,        Number(toTechnicianId))
        .input("Date",          sql.Date,        date)
        .input("AppointmentId", sql.Int,         app.AppointmentId)
        .input("StartTime",     sql.VarChar(8),  app.StartTime)
        .input("EndTime",       sql.VarChar(8),  app.EndTime)
        .query(`
          SELECT AppointmentId,
                 CONVERT(VARCHAR(5), StartTime, 108) AS StartTime,
                 CONVERT(VARCHAR(5), EndTime, 108) AS EndTime
          FROM Appointments
          WHERE EmployeeId = @EmployeeId
            AND AppointmentDate = @Date
            AND AppointmentId <> @AppointmentId
            AND Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
            AND (
              @StartTime < CONVERT(VARCHAR(8), EndTime, 108)
              AND @EndTime > CONVERT(VARCHAR(8), StartTime, 108)
            )
        `);

      if (conflictRes.recordset.length > 0) {
        const c = conflictRes.recordset[0];
        throw new Error(`Trùng lịch làm việc khác (${c.StartTime} - ${c.EndTime})`);
      }

      // Perform single assign
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, app.AppointmentId)
        .input("EmployeeId", sql.Int, Number(toTechnicianId))
        .query(`
          UPDATE Appointments
          SET EmployeeId = @EmployeeId,
              UpdatedAt = GETDATE()
          WHERE AppointmentId = @AppointmentId
        `);

      const logReason = `Chuyển giao lịch hẹn hàng loạt từ ${oldTechName} (ID: ${fromTechnicianId}) sang ${newTechName} (ID: ${toTechnicianId})`;

      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, app.AppointmentId)
        .input("OldStatus", sql.NVarChar, app.Status)
        .input("UserId", sql.Int, userId)
        .input("Reason", sql.NVarChar, logReason)
        .query(`
          INSERT INTO AppointmentStatusHistory
            (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
          VALUES
            (@AppointmentId, @OldStatus, @OldStatus, @UserId, @Reason, GETDATE())
        `);
      await transaction.commit();
      successCount++;

      // Trigger notifications async after successful commit
      try {
        const notificationsService = require("../notifications/notifications.service");
        const dateTextFormatted = new Date(date).toLocaleDateString("vi-VN");
        const timeTextFormatted = `${String(app.StartTime).slice(0, 5)} - ${String(app.EndTime).slice(0, 5)}`;

        if (newTechUserId) {
          await notificationsService.create({
            userId: newTechUserId,
            title: "Lịch hẹn mới được chuyển giao",
            content: `Bạn nhận được lịch hẹn chuyển giao #${app.AppointmentId} vào ngày ${dateTextFormatted} lúc ${timeTextFormatted}.`,
            type: "APPOINTMENT_ASSIGNED"
          });
        }

        if (oldTechUserId) {
          await notificationsService.create({
            userId: oldTechUserId,
            title: "Lịch hẹn đã chuyển giao",
            content: `Lịch hẹn #${app.AppointmentId} vào ngày ${dateTextFormatted} lúc ${timeTextFormatted} của bạn đã được chuyển giao cho KTV khác.`,
            type: "APPOINTMENT_UNASSIGNED"
          });
        }
      } catch (errNotif) {
        console.error("Failed to send transfer notification:", errNotif);
      }
    } catch (e) {
      failures.push({
        appointmentId: app.AppointmentId,
        startTime: String(app.StartTime).slice(0, 5),
        reason: e.message
      });
    }
  }

  return {
    successCount,
    failedCount: failures.length,
    failures
  };
}

async function createInvoiceManually(appointmentId) {
  const pool = await connectDB();

  // Check if invoice already exists
  const existing = await pool.request()
    .input("AppointmentId", sql.Int, appointmentId)
    .query("SELECT InvoiceId FROM Invoices WHERE AppointmentId = @AppointmentId");
  if (existing.recordset[0]) {
    throw new Error("Lịch hẹn này đã có hóa đơn rồi");
  }

  // Get appointment details to calculate total amount
  const appointment = await pool.request()
    .input("AppointmentId", sql.Int, appointmentId)
    .query(`
      SELECT AppointmentId, CustomerPackageId 
      FROM Appointments 
      WHERE AppointmentId = @AppointmentId
    `);
  if (!appointment.recordset[0]) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  // Get selected services of the appointment
  const servicesRes = await pool.request()
    .input("AppointmentId", sql.Int, appointmentId)
    .query(`
      SELECT ServiceId, Price FROM AppointmentServices WHERE AppointmentId = @AppointmentId
    `);
  const services = servicesRes.recordset || [];
  if (services.length === 0) {
    throw new Error("Lịch hẹn chưa được chọn dịch vụ");
  }

  const isPackageUsage = !!appointment.recordset[0].CustomerPackageId;
  const totalAmount = isPackageUsage ? 0 : services.reduce((sum, s) => sum + Number(s.Price || 0), 0);

  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    const invoiceResult = await new sql.Request(tx)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("DiscountAmount", sql.Decimal(18, 2), 0)
      .input("FinalAmount", sql.Decimal(18, 2), totalAmount)
      .query(`
        INSERT INTO Invoices
          (AppointmentId, TotalAmount, DiscountAmount, FinalAmount, Status, ManualDiscount, Surcharge)
        OUTPUT INSERTED.InvoiceId
        VALUES
          (
            @AppointmentId,
            @TotalAmount,
            @DiscountAmount,
            @FinalAmount,
            CASE WHEN @FinalAmount <= 0 THEN 'PAID' ELSE 'UNPAID' END,
            0,
            0
          )
      `);

    const invoiceId = invoiceResult.recordset[0].InvoiceId;
    await tx.commit();

    return await getInvoiceById(invoiceId);
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    throw err;
  }
}

async function updateInvoiceDetails(invoiceId, { serviceIds, voucherCode, manualDiscount, surcharge }) {
  const pool = await connectDB();

  // 1. Fetch current invoice & appointment details
  const invoice = await pool.request()
    .input("InvoiceId", sql.Int, invoiceId)
    .query(`
      SELECT i.InvoiceId, i.AppointmentId, i.VoucherId, i.Status, i.RewardDiscountAmount, a.CustomerId, a.CustomerPackageId
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE i.InvoiceId = @InvoiceId
    `);
  const invoiceRow = invoice.recordset[0];
  if (!invoiceRow) {
    throw new Error("Không tìm thấy hóa đơn");
  }

  if (invoiceRow.Status === "PAID" || invoiceRow.Status === "REFUNDED") {
    throw new Error("Hóa đơn đã được thanh toán hoặc đã hoàn tiền, không thể chỉnh sửa");
  }

  const appointmentId = invoiceRow.AppointmentId;
  const customerId = invoiceRow.CustomerId;
  const isPackageUsage = !!invoiceRow.CustomerPackageId;

  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    // 2. If serviceIds is passed, update services
    let services = [];
    if (Array.isArray(serviceIds)) {
      // Clear current services of the appointment
      await new sql.Request(tx)
        .input("AppointmentId", sql.Int, appointmentId)
        .query("DELETE FROM AppointmentServices WHERE AppointmentId = @AppointmentId");

      if (serviceIds.length === 0) {
        throw new Error("Lịch hẹn phải có ít nhất 1 dịch vụ");
      }

      // Fetch service details for the new serviceIds
      const serviceIdsText = serviceIds.join(",");
      const sResult = await new sql.Request(tx)
        .input("ServiceIds", sql.VarChar, serviceIdsText)
        .query(`
          SELECT ServiceId, Price FROM Services
          WHERE ServiceId IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ServiceIds, ','))
        `);
      services = sResult.recordset || [];
      if (services.length !== serviceIds.length) {
        throw new Error("Một hoặc nhiều dịch vụ không tồn tại");
      }

      // Insert new services
      for (const service of services) {
        await new sql.Request(tx)
          .input("AppointmentId", sql.Int, appointmentId)
          .input("ServiceId", sql.Int, service.ServiceId)
          .input("Price", sql.Decimal(18, 2), isPackageUsage ? 0 : Number(service.Price || 0))
          .query(`
            INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price)
            VALUES (@AppointmentId, @ServiceId, @Price)
          `);
      }
    } else {
      // Fetch existing services from AppointmentServices
      const existingServices = await new sql.Request(tx)
        .input("AppointmentId", sql.Int, appointmentId)
        .query("SELECT ServiceId, Price FROM AppointmentServices WHERE AppointmentId = @AppointmentId");
      services = existingServices.recordset || [];
    }

    // Calculate TotalAmount
    const totalAmount = isPackageUsage ? 0 : services.reduce((sum, s) => sum + Number(s.Price || 0), 0);

    // 3. Resolve voucher if voucherCode is passed
    let voucherIdToSave = invoiceRow.VoucherId;
    let voucherDiscount = 0;

    if (voucherCode !== undefined) {
      if (voucherCode === null || voucherCode.trim() === "") {
        // Clear voucher
        voucherIdToSave = null;
        voucherDiscount = 0;
      } else {
        const code = voucherCode.trim().toUpperCase();
        const vResult = await new sql.Request(tx)
          .input("Code", sql.NVarChar, code)
          .query(`
            SELECT TOP 1 VoucherId, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount, Status
            FROM Vouchers
            WHERE UPPER(Code) = @Code
              AND Status = 'ACTIVE'
              AND (StartDate IS NULL OR StartDate <= CAST(GETDATE() AS DATE))
              AND (EndDate IS NULL OR EndDate >= CAST(GETDATE() AS DATE))
          `);
        const voucher = vResult.recordset[0];
        if (!voucher) {
          throw new Error("Mã voucher không hợp lệ hoặc đã hết hạn");
        }

        const minOrder = Number(voucher.MinOrderAmount || 0);
        if (minOrder > 0 && totalAmount < minOrder) {
          throw new Error(`Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để sử dụng voucher này`);
        }

        // Auto-save the voucher for the customer in CustomerVouchers if not already saved
        const useCheck = await new sql.Request(tx)
          .input("CustomerId", sql.Int, customerId)
          .input("VoucherId", sql.Int, voucher.VoucherId)
          .query("SELECT UsedStatus FROM CustomerVouchers WHERE CustomerId = @CustomerId AND VoucherId = @VoucherId");
        
        if (!useCheck.recordset[0]) {
          await new sql.Request(tx)
            .input("CustomerId", sql.Int, customerId)
            .input("VoucherId", sql.Int, voucher.VoucherId)
            .query("INSERT INTO CustomerVouchers (CustomerId, VoucherId, UsedStatus) VALUES (@CustomerId, @VoucherId, 0)");
        }

        // Calculate discount
        if (String(voucher.DiscountType).toUpperCase() === "PERCENT") {
          voucherDiscount = (totalAmount * Number(voucher.DiscountValue || 0)) / 100;
          const maxDiscount = Number(voucher.MaxDiscountAmount || 0);
          if (maxDiscount > 0) {
            voucherDiscount = Math.min(voucherDiscount, maxDiscount);
          }
        } else {
          voucherDiscount = Number(voucher.DiscountValue || 0);
        }
        voucherDiscount = Math.min(voucherDiscount, totalAmount);
        voucherIdToSave = voucher.VoucherId;
      }
    } else if (voucherIdToSave) {
      // Calculate discount for current voucher on potentially updated TotalAmount
      const vResult = await new sql.Request(tx)
        .input("VoucherId", sql.Int, voucherIdToSave)
        .query("SELECT Code, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount FROM Vouchers WHERE VoucherId = @VoucherId");
      const voucher = vResult.recordset[0];
      if (voucher) {
        const codeUpper = String(voucher.Code || "").toUpperCase();
        const isFree = codeUpper.startsWith("FREE");
        
        const minOrder = Number(voucher.MinOrderAmount || 0) / 10;
        if (totalAmount >= minOrder) {
          if (String(voucher.DiscountType).toUpperCase() === "PERCENT") {
            voucherDiscount = (totalAmount * Number(voucher.DiscountValue || 0)) / 100;
            const maxDiscount = Number(voucher.MaxDiscountAmount || 0) / 10;
            if (maxDiscount > 0) {
              voucherDiscount = Math.min(voucherDiscount, maxDiscount);
            }
          } else {
            const discountVal = Number(voucher.DiscountValue || 0);
            voucherDiscount = isFree ? discountVal : discountVal / 10;
          }
          voucherDiscount = Math.min(voucherDiscount, totalAmount);
        } else {
          // TotalAmount fell below MinOrderAmount, auto-clear voucher from this calculation
          voucherDiscount = 0;
          voucherIdToSave = null;
        }
      }
    }

    // 4. Resolve manual discount & surcharge
    const manualDiscountToSave = manualDiscount !== undefined ? Number(manualDiscount) : Number(invoiceRow.ManualDiscount || 0);
    const surchargeToSave = surcharge !== undefined ? Number(surcharge) : Number(invoiceRow.Surcharge || 0);

    const rewardDiscount = Number(invoiceRow.RewardDiscountAmount || 0);

    // Calculate final amount: FinalAmount = TotalAmount - VoucherDiscount - ManualDiscount - RewardDiscount + Surcharge
    const totalDiscounts = voucherDiscount + manualDiscountToSave + rewardDiscount;
    let finalAmount = totalAmount - totalDiscounts + surchargeToSave;
    if (finalAmount < 0) finalAmount = 0;

    // 5. Update Invoice in DB
    await new sql.Request(tx)
      .input("InvoiceId", sql.Int, invoiceId)
      .input("VoucherId", sql.Int, voucherIdToSave)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("DiscountAmount", sql.Decimal(18, 2), voucherDiscount + manualDiscountToSave)
      .input("FinalAmount", sql.Decimal(18, 2), finalAmount)
      .input("ManualDiscount", sql.Decimal(18, 2), manualDiscountToSave)
      .input("Surcharge", sql.Decimal(18, 2), surchargeToSave)
      .query(`
        UPDATE Invoices
        SET VoucherId = @VoucherId,
            TotalAmount = @TotalAmount,
            DiscountAmount = @DiscountAmount,
            FinalAmount = @FinalAmount,
            ManualDiscount = @ManualDiscount,
            Surcharge = @Surcharge,
            UpdatedAt = CURRENT_TIMESTAMP
        WHERE InvoiceId = @InvoiceId
      `);

    await tx.commit();
    return await getInvoiceById(invoiceId);
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    throw err;
  }
}

async function sendInvoiceEmail(invoiceId) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error("Không tìm thấy hóa đơn");
  }

  const { sendMail } = require("../../utils/sendMail");

  if (!invoice.CustomerEmail) {
    throw new Error("Khách hàng không có địa chỉ email");
  }

  const formatVND = (amount) => {
    return Number(amount || 0).toLocaleString("vi-VN") + " đ";
  };

  const servicesRows = invoice.Services.map((s, idx) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left; font-size: 14px; color: #333;">${idx + 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: left; font-size: 14px; color: #333; font-weight: bold;">${s.ServiceName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; color: #333;">${formatVND(s.Price)}</td>
    </tr>
  `).join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Hóa đơn thanh toán - Beauty Salon</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; margin: 0; padding: 20px; }
        .invoice-card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: linear-gradient(135deg, #d4a373, #faedcd); padding: 30px; text-align: center; color: #4a3728; }
        .header h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px; }
        .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 30px; }
        .section-title { font-size: 16px; font-weight: bold; color: #d4a373; margin-bottom: 15px; border-bottom: 2px solid #faedcd; padding-bottom: 5px; text-transform: uppercase; }
        .info-grid { display: table; width: 100%; margin-bottom: 25px; }
        .info-row { display: table-row; }
        .info-cell { display: table-cell; padding: 6px 0; font-size: 14px; color: #555; }
        .info-cell.label { font-weight: bold; width: 140px; color: #333; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .table th { background-color: #fcf8f2; padding: 12px; text-align: left; font-size: 14px; color: #4a3728; font-weight: bold; border-bottom: 2px solid #faedcd; }
        .totals-table { width: 100%; max-width: 300px; margin-left: auto; margin-bottom: 25px; }
        .totals-table td { padding: 8px 0; font-size: 14px; color: #555; }
        .totals-table tr.grand-total td { font-size: 18px; font-weight: bold; color: #d4a373; border-top: 2px dashed #faedcd; padding-top: 12px; }
        .footer { background-color: #fdfaf6; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #faedcd; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <h1>BEAUTY SALON</h1>
          <p>Hóa Đơn Thanh Toán Dịch Vụ</p>
        </div>
        <div class="content">
          <div class="section-title">Thông tin khách hàng</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-cell label">Khách hàng:</div>
              <div class="info-cell">${invoice.CustomerName}</div>
            </div>
            <div class="info-row">
              <div class="info-cell label">Số điện thoại:</div>
              <div class="info-cell">${invoice.CustomerPhone || "Chưa cập nhật"}</div>
            </div>
            <div class="info-row">
              <div class="info-cell label">Mã lịch hẹn:</div>
              <div class="info-cell">#${invoice.AppointmentId}</div>
            </div>
            <div class="info-row">
              <div class="info-cell label">Ngày thực hiện:</div>
              <div class="info-cell">${new Date(invoice.AppointmentDate).toLocaleDateString("vi-VN")} (${invoice.StartTime} - ${invoice.EndTime})</div>
            </div>
            <div class="info-row">
              <div class="info-cell label">Kỹ thuật viên:</div>
              <div class="info-cell">${invoice.TechnicianName}</div>
            </div>
          </div>

          <div class="section-title">Dịch vụ sử dụng</div>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th>Tên dịch vụ</th>
                <th style="text-align: right; width: 120px;">Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              ${servicesRows}
            </tbody>
          </table>

          <div class="section-title">Chi tiết thanh toán</div>
          <table class="totals-table">
            <tr>
              <td>Tổng cộng:</td>
              <td style="text-align: right; font-weight: bold;">${formatVND(invoice.Total)}</td>
            </tr>
            ${invoice.VoucherCode ? `
            <tr>
              <td>Voucher giảm giá (${invoice.VoucherCode}):</td>
              <td style="text-align: right; color: #d9534f;">- ${formatVND(Number(invoice.Discount) - Number(invoice.ManualDiscount))}</td>
            </tr>` : ""}
            ${Number(invoice.ManualDiscount) > 0 ? `
            <tr>
              <td>Giảm giá thủ công:</td>
              <td style="text-align: right; color: #d9534f;">- ${formatVND(invoice.ManualDiscount)}</td>
            </tr>` : ""}
            ${Number(invoice.Surcharge) > 0 ? `
            <tr>
              <td>Phụ phí / Tip:</td>
              <td style="text-align: right; color: #28a745;">+ ${formatVND(invoice.Surcharge)}</td>
            </tr>` : ""}
            <tr class="grand-total">
              <td>Thực nhận:</td>
              <td style="text-align: right;">${formatVND(invoice.FinalAmount)}</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          <p>Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ tại Beauty Salon!</p>
          <p>Mọi thắc mắc vui lòng liên hệ hotline: 1900-XXXX hoặc email support@beautysalon.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendMail({
    to: invoice.CustomerEmail,
    subject: `[Beauty Salon] Hóa đơn thanh toán lịch hẹn #${invoice.AppointmentId}`,
    html: htmlContent,
  });

  return { message: "Gửi hóa đơn email thành công" };
}

module.exports = {
  getDashboard,
  createInvoiceManually,
  updateInvoiceDetails,
  sendInvoiceEmail,

  getAppointments,
  getAppointmentById,
  createAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  checkoutAppointment,
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
  markAllNotificationsRead,
  createReceptionistNotification,
  getReceptionistReviews,
  getReceptionistProfile,
  updateReceptionistProfile,
  updateReceptionistAvatar,
  createWalkInAppointment,
  getWaitingAvailableSlots,
  convertWaitingListToAppointment,

  getTechnicianWorkload,
  assignTechnician,
  transferAppointments,
  getSmartBookingSuggestions,
  updateAppointmentServiceStatus,
};


async function ensureShiftForAppointment(technicianId, appointmentDate, startTime, endTime, serviceIds = []) {
  const pool = await connectDB();
  
  const formatDateOnly = (dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  };

  const formatTimeOnly = (timeInput) => {
    if (!timeInput) return "00:00:00";
    if (timeInput instanceof Date) {
      const h = String(timeInput.getUTCHours()).padStart(2, '0');
      const m = String(timeInput.getUTCMinutes()).padStart(2, '0');
      const s = String(timeInput.getUTCSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    const str = String(timeInput).trim();
    if (str.length === 5) return `${str}:00`;
    return str.slice(0, 8);
  };

  const dateStr = formatDateOnly(appointmentDate);
  const startStr = formatTimeOnly(startTime);
  const endStr = formatTimeOnly(endTime);

  const existingRes = await pool.request()
    .input("TechnicianId", sql.Int, Number(technicianId))
    .input("ShiftDate", sql.Date, dateStr)
    .input("StartTime", sql.VarChar, startStr)
    .input("EndTime", sql.VarChar, endStr)
    .query(`
      SELECT sr.RegistrationId
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @TechnicianId
        AND sr.Status = 'APPROVED'
        AND ws.ShiftDate = @ShiftDate
        AND (@StartTime >= CONVERT(VARCHAR(8), ws.StartTime, 108) AND @EndTime <= CONVERT(VARCHAR(8), ws.EndTime, 108))
    `);
  
  if (existingRes.recordset[0]) {
    return;
  }

  const coverRes = await pool.request()
    .input("ShiftDate", sql.Date, dateStr)
    .input("StartTime", sql.VarChar, startStr)
    .input("EndTime", sql.VarChar, endStr)
    .query(`
      SELECT ShiftId
      FROM WorkShifts
      WHERE ShiftDate = @ShiftDate
        AND (@StartTime >= CONVERT(VARCHAR(8), StartTime, 108) AND @EndTime <= CONVERT(VARCHAR(8), EndTime, 108))
      ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);
  
  let shiftId;
  if (coverRes.recordset[0]) {
    shiftId = coverRes.recordset[0].ShiftId;
  } else {
    const newShiftRes = await pool.request()
      .input("ShiftName", sql.NVarChar, "Cả ngày")
      .input("ShiftDate", sql.Date, dateStr)
      .input("StartTime", sql.VarChar, "08:00:00")
      .input("EndTime", sql.VarChar, "20:00:00")
      .query(`
        INSERT INTO WorkShifts (ShiftName, ShiftDate, StartTime, EndTime, MaxTechnicians, Status)
        OUTPUT INSERTED.ShiftId
        VALUES (@ShiftName, @ShiftDate, @StartTime, @EndTime, 6, 'OPEN')
      `);
    shiftId = newShiftRes.recordset[0].ShiftId;
  }

  const regRes = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, Number(technicianId))
    .query(`
      MERGE INTO ShiftRegistrations AS target
      USING (SELECT @ShiftId AS ShiftId, @TechnicianId AS TechnicianId) AS source
      ON (target.ShiftId = source.ShiftId AND target.TechnicianId = source.TechnicianId)
      WHEN MATCHED THEN
        UPDATE SET Status = 'APPROVED'
      WHEN NOT MATCHED THEN
        INSERT (ShiftId, TechnicianId, Status) VALUES (@ShiftId, @TechnicianId, 'APPROVED');
      
      SELECT RegistrationId 
      FROM ShiftRegistrations 
      WHERE ShiftId = @ShiftId AND TechnicianId = @TechnicianId;
    `);
  
  const registrationId = regRes.recordset[0].RegistrationId;

  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    for (const sId of serviceIds) {
      await pool.request()
        .input("RegistrationId", sql.Int, registrationId)
        .input("ServiceId", sql.Int, Number(sId))
        .query(`
          MERGE INTO ShiftRegistrationServices AS target
          USING (SELECT @RegistrationId AS RegistrationId, @ServiceId AS ServiceId) AS source
          ON (target.RegistrationId = source.RegistrationId AND target.ServiceId = source.ServiceId)
          WHEN NOT MATCHED THEN
            INSERT (RegistrationId, ServiceId) VALUES (@RegistrationId, @ServiceId);
        `);
    }
  }
}

async function getSmartBookingSuggestions({ customerId, serviceId, branchId, appointmentDate, preferredStartTime }) {
  const pool = await connectDB();
  const availabilityService = require("../appointments/availability.service");

  // 1. Get all active technicians at the selected branch who perform the requested service
  const techniciansRes = await pool.request()
    .input("BranchId", sql.Int, branchId)
    .input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT DISTINCT e.EmployeeId, u.FullName, u.AvatarUrl, e.ImageUrl, e.Specialization, e.Position
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      JOIN EmployeeServices es ON e.EmployeeId = es.EmployeeId
      WHERE e.BranchId = @BranchId
        AND es.ServiceId = @ServiceId
        AND e.Status = 'ACTIVE'
    `);

  const technicians = techniciansRes.recordset;
  if (technicians.length === 0) {
    return [];
  }

  // 2. Fetch rating, workload, shifts, and customer affinity in parallel using batch queries
  const [shiftsRes, ratingsRes, affinityRes, workloadRes] = await Promise.all([
    pool.request()
      .input("BranchId", sql.Int, branchId)
      .input("ShiftDate", sql.Date, appointmentDate)
      .query(`
        SELECT sr.TechnicianId AS EmployeeId,
               CONVERT(VARCHAR(8), ws.StartTime, 108) AS StartTime,
               CONVERT(VARCHAR(8), ws.EndTime, 108) AS EndTime
        FROM ShiftRegistrations sr
        JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
        WHERE sr.Status = 'APPROVED'
          AND ws.ShiftDate = @ShiftDate
          AND sr.TechnicianId IN (SELECT EmployeeId FROM Employees WHERE BranchId = @BranchId)
      `),
    pool.request()
      .input("BranchId", sql.Int, branchId)
      .query(`
        SELECT a.EmployeeId, AVG(CAST(r.Rating AS DECIMAL(3,2))) AS AvgRating
        FROM Reviews r
        JOIN Appointments a ON r.AppointmentId = a.AppointmentId
        WHERE a.EmployeeId IN (SELECT EmployeeId FROM Employees WHERE BranchId = @BranchId)
        GROUP BY a.EmployeeId
      `),
    customerId ? pool.request()
      .input("BranchId", sql.Int, branchId)
      .input("CustomerId", sql.Int, customerId)
      .query(`
        SELECT EmployeeId, COUNT(*) AS CompletedCount
        FROM Appointments
        WHERE CustomerId = @CustomerId
          AND Status = 'COMPLETED'
          AND EmployeeId IN (SELECT EmployeeId FROM Employees WHERE BranchId = @BranchId)
        GROUP BY EmployeeId
      `) : Promise.resolve({ recordset: [] }),
    pool.request()
      .input("BranchId", sql.Int, branchId)
      .input("ShiftDate", sql.Date, appointmentDate)
      .query(`
        SELECT EmployeeId, COUNT(*) AS BookedCount
        FROM Appointments
        WHERE AppointmentDate = @ShiftDate
          AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED')
          AND EmployeeId IN (SELECT EmployeeId FROM Employees WHERE BranchId = @BranchId)
        GROUP BY EmployeeId
      `)
  ]);

  // Construct in-memory lookup maps for quick constant O(1) lookup
  const shiftsMap = new Map();
  shiftsRes.recordset.forEach(row => {
    if (!shiftsMap.has(row.EmployeeId)) shiftsMap.set(row.EmployeeId, []);
    shiftsMap.get(row.EmployeeId).push(row);
  });

  const ratingsMap = new Map(ratingsRes.recordset.map(row => [row.EmployeeId, Number(row.AvgRating || 4.5)]));
  const affinityMap = new Map(affinityRes.recordset.map(row => [row.EmployeeId, Number(row.CompletedCount || 0)]));
  const workloadMap = new Map(workloadRes.recordset.map(row => [row.EmployeeId, Number(row.BookedCount || 0)]));

  // Filter technicians who have active shifts on the date
  const scheduledTechs = technicians.filter(tech => shiftsMap.has(tech.EmployeeId));

  // 3. Query slots in parallel for all scheduled technicians
  const slotsPromises = scheduledTechs.map(async (tech) => {
    try {
      const slots = await availabilityService.getAvailableSlots({
        employeeId: tech.EmployeeId,
        serviceId: serviceId,
        appointmentDate: appointmentDate,
        includeAllSlots: true
      });
      return { tech, slots };
    } catch (err) {
      console.error(`Error loading slots for employee ${tech.EmployeeId}:`, err);
      return { tech, slots: [] };
    }
  });

  const allSlotsResults = await Promise.all(slotsPromises);

  // 4. Calculate scores and populate recommendations list
  const suggestions = [];

  for (const { tech, slots } of allSlotsResults) {
    if (!slots || slots.length === 0) continue;

    const avgRating = ratingsMap.get(tech.EmployeeId) ?? 4.5;
    const ratingScore = avgRating * 10; // Max 50 points

    const completedCount = affinityMap.get(tech.EmployeeId) ?? 0;
    const affinityScore = Math.min(completedCount * 10, 30); // Max 30 points

    const bookedCount = workloadMap.get(tech.EmployeeId) ?? 0;
    const workloadScore = Math.max(0, 20 - (bookedCount * 4)); // Max 20 points

    const reasons = [
      `Đánh giá năng lực: ${avgRating.toFixed(1)}/5.0★`,
      completedCount > 0 
        ? `Đã phục vụ khách hàng này ${completedCount} lần trước đây` 
        : `KTV có phong cách phục vụ chu đáo`,
      bookedCount === 0 
        ? `Chưa có lịch hẹn nào hôm nay (rảnh rỗi)` 
        : `Đang có ${bookedCount} lịch hẹn hôm nay (khối lượng vừa phải)`
    ];

    const baseScore = ratingScore + affinityScore + workloadScore;

    for (const slot of slots) {
      const isSlotAvailable = slot.available !== false;
      if (!isSlotAvailable) continue; // Only suggest available slots

      let timeBonus = 0;
      if (preferredStartTime) {
        const [prefH, prefM] = preferredStartTime.split(":").map(Number);
        const [slotH, slotM] = slot.startTime.split(":").map(Number);
        
        const prefMinutes = prefH * 60 + (prefM || 0);
        const slotMinutes = slotH * 60 + (slotM || 0);
        const diff = Math.abs(prefMinutes - slotMinutes);

        if (diff <= 15) {
          timeBonus = 20;
        } else if (diff <= 60) {
          timeBonus = 10;
        }
      }

      const totalScore = baseScore + timeBonus;

      suggestions.push({
        employeeId: tech.EmployeeId,
        fullName: tech.FullName,
        avatarUrl: tech.ImageUrl || tech.AvatarUrl,
        specialization: tech.Specialization || tech.Position || "Kỹ thuật viên",
        startTime: slot.startTime,
        endTime: slot.endTime,
        score: Math.min(Math.round(totalScore), 100),
        reasons: [...reasons, timeBonus > 0 ? `Khung giờ gần với giờ mong muốn (+${timeBonus}đ)` : `Khung giờ làm việc khả dụng`]
      });
    }
  }

  // Sort by score descending and return top 5
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function updateAppointmentServiceStatus(appointmentServiceId, status) {
  const pool = await connectDB();
  
  // 1. Fetch all steps for this appointment ordered by AppointmentServiceId ASC
  const stepsRes = await pool.request()
    .input("AppointmentServiceId", sql.Int, appointmentServiceId)
    .query(`
      SELECT 
        aps.AppointmentServiceId,
        aps.AppointmentId,
        aps.ServiceId,
        aps.Status,
        s.ServiceName,
        a.CustomerPackageId
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
      WHERE aps.AppointmentId = (
        SELECT AppointmentId FROM AppointmentServices WHERE AppointmentServiceId = @AppointmentServiceId
      )
      ORDER BY aps.AppointmentServiceId ASC
    `);

  const allSteps = stepsRes.recordset || [];
  const targetIndex = allSteps.findIndex(s => Number(s.AppointmentServiceId) === Number(appointmentServiceId));

  // Requirement 1: Step sequential ordering check
  if (targetIndex > 0 && (status === 'IN_PROGRESS' || status === 'COMPLETED')) {
    const prevStep = allSteps[targetIndex - 1];
    if (prevStep && prevStep.Status !== 'COMPLETED') {
      throw new Error(`Chưa thể bắt đầu làm bước '${allSteps[targetIndex].ServiceName}'! Bước dịch vụ trước đó ('${prevStep.ServiceName}') trong gói Combo chưa hoàn thành.`);
    }
  }

  await pool.request()
    .input("AppointmentServiceId", sql.Int, appointmentServiceId)
    .input("Status", sql.NVarChar, status)
    .query(`
      UPDATE AppointmentServices
      SET Status = @Status
      WHERE AppointmentServiceId = @AppointmentServiceId
    `);

  const checkRes = await pool.request()
    .input("AppointmentServiceId", sql.Int, appointmentServiceId)
    .query(`
      SELECT 
        aps.AppointmentId,
        (SELECT COUNT(*) FROM AppointmentServices WHERE AppointmentId = aps.AppointmentId) AS TotalServices,
        (SELECT COUNT(*) FROM AppointmentServices WHERE AppointmentId = aps.AppointmentId AND ISNULL(Status,'PENDING') = 'COMPLETED') AS CompletedServices
      FROM AppointmentServices aps
      WHERE aps.AppointmentServiceId = @AppointmentServiceId
    `);

  const info = checkRes.recordset[0];
  let allCompleted = false;

  // Requirement 2: Only complete appointment & send email when the FINAL service step is completed
  if (info && info.TotalServices > 0 && info.TotalServices === info.CompletedServices) {
    allCompleted = true;
    try {
      await completeAppointment(info.AppointmentId);
    } catch (err) {
      console.log("[updateAppointmentServiceStatus] completeAppointment error:", err.message);
      await pool.request()
        .input("AppointmentId", sql.Int, info.AppointmentId)
        .query(`
          UPDATE Appointments
          SET Status = 'COMPLETED', CompletedAt = CURRENT_TIMESTAMP
          WHERE AppointmentId = @AppointmentId AND Status <> 'COMPLETED'
        `);
    }
  }

  return { success: true, allCompleted, appointmentId: info?.AppointmentId };
}


