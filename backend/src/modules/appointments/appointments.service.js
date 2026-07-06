const { sql, connectDB } = require("../../config/db");
const { create: createNotification } = require("../notifications/notifications.service");
const availabilityService = require("./availability.service");
const appointmentStateService = require("./appointment-state.service");
const treatmentNotesV2Service = require("../treatment-notes-v2/treatment-notes-v2.service");

const AUTO_CANCEL_MINUTES = 15; // Tự hủy sau 15 phút chưa thanh toán

async function getCustomerIdByUserId(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT CustomerId
    FROM Customers
    WHERE UserId = @UserId
  `);

  if (!result.recordset[0]) {
    throw new Error("Không tìm thấy hồ sơ khách hàng");
  }

  return result.recordset[0].CustomerId;
}

async function getServiceById(serviceId) {
  const pool = await connectDB();

  const result = await pool.request().input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT ServiceId, ServiceName, DurationMinutes, Price
      FROM Services
      WHERE ServiceId = @ServiceId
        AND Status = 'AVAILABLE'
    `);

  if (!result.recordset[0]) {
    throw new Error("Dịch vụ không tồn tại hoặc đã ngừng hoạt động");
  }

  return result.recordset[0];
}

async function checkEmployeeCanDoService(employeeId, serviceId) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ServiceId", sql.Int, serviceId).query(`
      SELECT EmployeeId
      FROM EmployeeServices
      WHERE EmployeeId = @EmployeeId
        AND ServiceId = @ServiceId
    `);

  if (!result.recordset[0]) {
    throw new Error("Kỹ thuật viên này không thực hiện dịch vụ đã chọn");
  }
}

async function checkEmployeeBusy(
  employeeId,
  appointmentDate,
  startTime,
  endTime,
  excludeAppointmentId = null,
) {
  await availabilityService.validateAvailability(
    employeeId,
    `${normalizeDateOnly(appointmentDate)}T${normalizeTimeOnly(startTime)}`,
    `${normalizeDateOnly(appointmentDate)}T${normalizeTimeOnly(endTime)}`,
    excludeAppointmentId
  );
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeTimeOnly(value) {
  if (!value) return "00:00:00";

  const text = String(value);

  if (text.includes("T")) {
    return text.split("T")[1].slice(0, 8);
  }

  if (text.length === 5) {
    return text + ":00";
  }

  return text.slice(0, 8);
}

function ensureNotTooClose(appointmentDate, startTime, actionText) {
  const dateText = normalizeDateOnly(appointmentDate);
  const timeText = normalizeTimeOnly(startTime).slice(0, 5);

  const appointmentTime = new Date(`${dateText}T${timeText}:00`);
  const now = new Date();

  const diffMs = appointmentTime.getTime() - now.getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  if (diffMs < twoHours) {
    throw new Error(`Không được ${actionText} lịch trước giờ hẹn dưới 2 tiếng`);
  }
}

function isStaffUser(user) {
  const role = String(user?.role || "").toUpperCase();
  return ["ADMIN", "MANAGER", "RECEPTIONIST"].includes(role);
}

function isFinalAppointmentStatus(status) {
  return [
    "COMPLETED",
    "CANCELLED",
    "REFUND_PENDING",
    "REFUNDED",
    "NO_SHOW",
  ].includes(String(status || "").toUpperCase());
}

function ensureFutureAppointment(appointmentDate, startTime) {
  const dateText = normalizeDateOnly(appointmentDate);
  const timeText = String(startTime || "").slice(0, 5) || "00:00";
  const selected = new Date(`${dateText}T${timeText}:00`);

  if (Number.isNaN(selected.getTime())) {
    throw new Error("Ngày giờ hẹn không hợp lệ");
  }

  if (selected.getTime() < Date.now()) {
    throw new Error("Không được đặt hoặc đổi lịch về thời gian trong quá khứ");
  }
}

async function addStatusHistory(
  transaction,
  appointmentId,
  oldStatus,
  newStatus,
  changedBy = null,
  reason = null,
) {
  await new sql.Request(transaction)
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
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return date.toTimeString().slice(0, 8);
}

async function calculateSlotsInternal(args) {
  return await availabilityService.calculateSlotsInternal(args);
}

async function getSlotAlternatives(employeeId, serviceId, appointmentDate, limit = 6) {
  return await availabilityService.getSlotAlternatives(employeeId, serviceId, appointmentDate, limit);
}

async function getAvailableSlots(query) {
  return await availabilityService.getAvailableSlots(query);
}

async function ensureSlotAvailableForReschedule({
  appointmentId,
  employeeId,
  serviceId,
  appointmentDate,
  startTime,
}) {
  const slots = await getAvailableSlots({
    employeeId,
    serviceId,
    appointmentDate,
    excludeAppointmentId: appointmentId,
  });

  const normalizedStartTime = String(startTime || "").slice(0, 5);

  const found = slots.some(
    (slot) => String(slot.startTime).slice(0, 5) === normalizedStartTime,
  );

  if (!found) {
    throw new Error("Giờ hẹn mới không hợp lệ hoặc kỹ thuật viên đã có lịch");
  }
}

async function getRescheduleInfo(id, user = null) {
  const appointment = await getById(id, user);
  const currentStatus = String(appointment.Status || "").toUpperCase();

  if (!["PENDING_PAYMENT", "CONFIRMED", "PENDING"].includes(currentStatus)) {
    throw new Error(
      "Chỉ được đổi lịch khi lịch đang chờ thanh toán hoặc đã xác nhận",
    );
  }

  const isPendingFollowUp = currentStatus === "PENDING";

  ensureNotTooClose(appointment.AppointmentDate, appointment.StartTime, "đổi");

  const pool = await connectDB();

  const servicesResult = await pool
    .request()
    .input("AppointmentId", sql.Int, id).query(`
      SELECT
        s.ServiceId,
        s.ServiceName,
        s.DurationMinutes,
        aps.Price
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = @AppointmentId
      ORDER BY aps.AppointmentServiceId ASC
    `);

  const service = servicesResult.recordset[0];

  if (!service) {
    throw new Error("Không tìm thấy dịch vụ của lịch hẹn");
  }

  let availableEmployees;

  const employeesResult = await pool
    .request()
    .input("ServiceId", sql.Int, service.ServiceId).query(`
      SELECT
        e.EmployeeId,
        u.FullName AS EmployeeName,
        e.Position,
        e.Specialization,
        e.ImageUrl,
        e.BranchId,
        b.BranchName,
        b.Address AS BranchAddress,
        ISNULL(rv.AverageRating, 0) AS AverageRating,
        ISNULL(rv.ReviewCount, 0) AS ReviewCount
      FROM EmployeeServices es
      JOIN Employees e ON es.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT
          AVG(CAST(r.Rating AS FLOAT)) AS AverageRating,
          COUNT(*) AS ReviewCount
        FROM Reviews r
        JOIN Appointments a ON r.AppointmentId = a.AppointmentId
        WHERE a.EmployeeId = e.EmployeeId
      ) rv
      WHERE es.ServiceId = @ServiceId
        AND ISNULL(e.Status, 'ACTIVE') = 'ACTIVE'
      ORDER BY rv.AverageRating DESC, rv.ReviewCount DESC, u.FullName ASC
    `);
  availableEmployees = employeesResult.recordset;


  return {
    AppointmentId: appointment.AppointmentId,
    CustomerId: appointment.CustomerId,
    EmployeeId: appointment.EmployeeId,
    EmployeeName: appointment.EmployeeName,
    EmployeeImageUrl: appointment.EmployeeImageUrl,
    BranchName: appointment.BranchName,
    AppointmentDate: appointment.AppointmentDate,
    StartTime: appointment.StartTime,
    EndTime: appointment.EndTime,
    Status: appointment.Status,
    Notes: appointment.Notes,
    ServiceId: service.ServiceId,
    ServiceName: service.ServiceName,
    DurationMinutes: service.DurationMinutes,
    Price: service.Price,
    Services: servicesResult.recordset,
    AvailableEmployees: availableEmployees,
    isPendingFollowUp,
    suggestedDate: isPendingFollowUp && appointment.AppointmentDate ? (() => {
      const d = new Date(appointment.AppointmentDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })() : null,
    suggestedStartTime: isPendingFollowUp ? appointment.StartTime : null,
  };
}


async function reschedule(id, data = {}, user = null) {
  const appointment = await getById(id, user);

  if (!user || String(user.role).toUpperCase() !== "CUSTOMER") {
    throw new Error("Chỉ customer mới được đổi lịch");
  }

  const customerId = await getCustomerIdByUserId(user.userId);

  if (appointment.CustomerId !== customerId) {
    throw new Error("Bạn không được đổi lịch hẹn này");
  }

  const currentStatus = String(appointment.Status || "").toUpperCase();

  if (!["PENDING_PAYMENT", "CONFIRMED", "PENDING"].includes(currentStatus)) {
    throw new Error(
      "Chỉ được đổi lịch khi lịch đang chờ thanh toán hoặc đã xác nhận",
    );
  }

  const isPendingFollowUp = currentStatus === "PENDING";
  const targetStatus = isPendingFollowUp ? "CONFIRMED" : appointment.Status;

  ensureNotTooClose(appointment.AppointmentDate, appointment.StartTime, "đổi");

  const appointmentDate = data.appointmentDate || data.AppointmentDate;
  const employeeId = Number(data.employeeId || data.EmployeeId || appointment.EmployeeId);
  let startTime = data.startTime || data.StartTime;

  const reason =
    data.reason || data.Reason || "Customer rescheduled appointment";

  if (startTime && String(startTime).length === 5) {
    startTime += ":00";
  }

  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn mới");
  if (!employeeId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!startTime) throw new Error("Vui lòng chọn giờ hẹn mới");

  ensureFutureAppointment(appointmentDate, startTime);

  const pool = await connectDB();

  const serviceResult = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
      SELECT TOP 1
        s.ServiceId,
        s.DurationMinutes,
        s.ServiceName
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = @AppointmentId
      ORDER BY aps.AppointmentServiceId ASC
    `);

  const serviceInfo = serviceResult.recordset[0];

  if (!serviceInfo) {
    throw new Error("Không tìm thấy dịch vụ của lịch hẹn");
  }

  await checkEmployeeCanDoService(employeeId, serviceInfo.ServiceId);

  await ensureSlotAvailableForReschedule({
    appointmentId: Number(id),
    employeeId,
    serviceId: serviceInfo.ServiceId,
    appointmentDate,
    startTime,
  });

  const endTime = addMinutesToTime(startTime, serviceInfo.DurationMinutes);

  await checkEmployeeBusy(
    employeeId,
    appointmentDate,
    startTime,
    endTime,
    Number(id),
  );

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("AppointmentDate", sql.Date, appointmentDate)
      .input("StartTime", sql.VarChar, startTime)
      .input("EndTime", sql.VarChar, endTime)
      .input("EmployeeId", sql.Int, employeeId)
      .input("Status", sql.VarChar, targetStatus).query(`
        UPDATE Appointments
        SET AppointmentDate = @AppointmentDate,
            StartTime = @StartTime,
            EndTime = @EndTime,
            EmployeeId = @EmployeeId,
            Status = @Status,
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await addStatusHistory(
      transaction,
      Number(id),
      appointment.Status,
      targetStatus,
      user.userId,
      reason,
    );
    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

  try {
    const { runAutoMatch } = require("../waiting-list/waiting-list.service");
    runAutoMatch(appointment.AppointmentDate).catch(err => console.error("Auto match failed:", err.message));
  } catch (err) {
    console.error("Auto match trigger failed:", err.message);
  }

  return await getById(id, user);
}

async function create(userId, data) {
  const serviceId = Number(data.serviceId);
  const employeeId = Number(data.employeeId);
  const appointmentDate = data.appointmentDate;
  let startTime = data.startTime;
  const customerPackageId =
    data.customerPackageId || data.CustomerPackageId || null;

  if (startTime && startTime.length === 5) {
    startTime += ":00";
  }

  const notes = data.notes || null;

  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ");
  if (!employeeId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");
  if (!startTime) throw new Error("Vui lòng chọn giờ hẹn");

  ensureFutureAppointment(appointmentDate, startTime);

  const customerId = await getCustomerIdByUserId(userId);
  const selectedService = await getServiceById(serviceId);

  await checkEmployeeCanDoService(employeeId, serviceId);

  const availableSlots = await getAvailableSlots({
    employeeId,
    serviceId,
    appointmentDate,
  });

  const normalizedStartTime = String(startTime).slice(0, 5);

  const isValidSlot = availableSlots.some(
    (slot) => String(slot.startTime).slice(0, 5) === normalizedStartTime,
  );

  if (!isValidSlot) {
    throw new Error("Giờ hẹn không hợp lệ hoặc đã được người khác đặt");
  }

  const endTime = addMinutesToTime(startTime, selectedService.DurationMinutes);

  await checkEmployeeBusy(employeeId, appointmentDate, startTime, endTime);

  const pool = await connectDB();

  const heldResult = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, startTime)
    .input("EndTime", sql.VarChar, endTime)
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT TOP 1 1 AS Held
      FROM WaitingList
      WHERE MatchedEmployeeId = @EmployeeId
        AND MatchedDate = @AppointmentDate
        AND Status = 'MATCHED'
        AND HoldExpiresAt > GETUTCDATE()
        AND CustomerId <> @CustomerId
        AND (
          @StartTime < CONVERT(VARCHAR(8), MatchedEndTime, 108)
          AND @EndTime > CONVERT(VARCHAR(8), MatchedStartTime, 108)
        )
    `);

  if (heldResult.recordset[0]) {
    throw new Error("Khung giờ này đang được giữ chỗ cho một khách hàng khác từ hàng chờ.");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Tự động hủy các yêu cầu hàng chờ đang hoạt động của khách cho dịch vụ/ngày này
    await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customerId)
      .input("ServiceId", sql.Int, serviceId)
      .input("PreferredDate", sql.Date, appointmentDate)
      .query(`
        UPDATE WaitingList
        SET Status = 'CANCELLED',
            CancelReason = N'Đã tự đặt lịch hẹn trực tiếp',
            UpdatedAt = GETDATE()
        WHERE CustomerId = @CustomerId
          AND ServiceId = @ServiceId
          AND (PreferredDate = @PreferredDate OR PreferredDate IS NULL)
          AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED')
      `);

    // Fetch technician's BranchId to associate with the appointment
    const empBranchRes = await new sql.Request(transaction)
      .input("EmployeeId", sql.Int, employeeId)
      .query("SELECT BranchId FROM Employees WHERE EmployeeId = @EmployeeId");
    const branchId = empBranchRes.recordset[0]?.BranchId || null;

    let appointment;
    let invoiceId = null;

    if (customerPackageId) {
      const pkgCheck = await new sql.Request(transaction)
        .input("CustomerPackageId", sql.Int, customerPackageId)
        .input("CustomerId", sql.Int, customerId)
        .input("ServiceId", sql.Int, serviceId).query(`
          SELECT 
            cp.CustomerPackageId, 
            cp.RemainingSessions, 
            cp.Status,
            ps.SessionCount AS MaxSessions,
            (
              SELECT ISNULL(SUM(u.SessionsUsed), 0)
              FROM CustomerPackageUsages u
              WHERE u.CustomerPackageId = cp.CustomerPackageId
                AND u.ServiceId = ps.ServiceId
                AND u.Status <> 'CANCELLED'
            ) AS UsedSessions,
            (
              SELECT COUNT(*)
              FROM Appointments a
              JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
              WHERE a.CustomerPackageId = cp.CustomerPackageId
                AND aps.ServiceId = ps.ServiceId
                AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            ) AS ActiveBookings
          FROM CustomerPackages cp
          JOIN PackageServices ps ON cp.PackageId = ps.PackageId
          WHERE cp.CustomerPackageId = @CustomerPackageId
            AND (cp.CustomerId = @CustomerId OR EXISTS (
                  SELECT 1 FROM PackageMembers pm 
                  WHERE pm.CustomerPackageId = cp.CustomerPackageId 
                    AND pm.FamilyCustomerId = @CustomerId
                ))
            AND ps.ServiceId = @ServiceId
        `);

      const cpRecord = pkgCheck.recordset[0];

      if (!cpRecord) {
        throw new Error("Liệu trình không hợp lệ hoặc không chứa dịch vụ này");
      }

      if (cpRecord.Status !== "ACTIVE") {
        throw new Error("Liệu trình không ở trạng thái kích hoạt");
      }

      const max = Number(cpRecord.MaxSessions || 0);
      const used = Number(cpRecord.UsedSessions || 0);
      const active = Number(cpRecord.ActiveBookings || 0);
      const available = max - (used + active);

      if (available <= 0) {
        if (active > 0) {
          const activeCheck = await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, customerPackageId)
            .input("ServiceId", sql.Int, serviceId).query(`
              SELECT TOP 1 u.FullName
              FROM Appointments a
              JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
              JOIN Customers c ON a.CustomerId = c.CustomerId
              JOIN Users u ON c.UserId = u.UserId
              WHERE a.CustomerPackageId = @CustomerPackageId
                AND aps.ServiceId = @ServiceId
                AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            `);
          const activeUser = activeCheck.recordset[0]?.FullName || "một thành viên gia đình";
          throw new Error(
            `Dịch vụ này đã được thành viên "${activeUser}" đặt lịch hẹn trước đó trong combo này rồi.`,
          );
        } else {
          throw new Error(
            "Bạn đã sử dụng hoặc đặt hết số buổi cho dịch vụ này trong liệu trình (bao gồm cả các lịch sắp diễn ra)",
          );
        }
      }

      const appointmentResult = await new sql.Request(transaction)
        .input("CustomerId", sql.Int, customerId)
        .input("EmployeeId", sql.Int, employeeId)
        .input("BranchId", sql.Int, branchId)
        .input("AppointmentDate", sql.Date, appointmentDate)
        .input("StartTime", sql.VarChar, startTime)
        .input("EndTime", sql.VarChar, endTime)
        .input("Notes", sql.NVarChar, notes)
        .input("CustomerPackageId", sql.Int, customerPackageId).query(`
          INSERT INTO Appointments
          (CustomerId, EmployeeId, BranchId, AppointmentDate, StartTime, EndTime, Status, Notes, CustomerPackageId)
          OUTPUT INSERTED.*
          VALUES
          (@CustomerId, @EmployeeId, @BranchId, @AppointmentDate, @StartTime, @EndTime, 'CONFIRMED', @Notes, @CustomerPackageId)
        `);

      appointment = appointmentResult.recordset[0];

      /*
        Không trừ buổi ở bước đặt lịch.
        Buổi trong combo chỉ được trừ khi lịch hẹn đã phục vụ xong
        và chuyển sang COMPLETED. Nếu trừ ngay lúc booking, khách hủy lịch
        hoặc lịch chưa làm xong sẽ làm sai số buổi còn lại.
      */

      const invoiceResult = await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        appointment.AppointmentId,
      ).query(`
          INSERT INTO Invoices
          (AppointmentId, TotalAmount, DiscountAmount, FinalAmount)
          OUTPUT INSERTED.InvoiceId
          VALUES
          (@AppointmentId, 0, 0, 0)
        `);

      invoiceId = invoiceResult.recordset[0].InvoiceId;

      const transactionCode = `PKG_BOOK_${Date.now()}`;

      await new sql.Request(transaction)
        .input("InvoiceId", sql.Int, invoiceId)
        .input("TransactionCode", sql.NVarChar, transactionCode).query(`
          INSERT INTO Payments
          (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt)
          VALUES
          (@InvoiceId, 0, 'PACKAGE', 'PAID', @TransactionCode, GETDATE())
        `);
    } else {
      const appointmentResult = await new sql.Request(transaction)
        .input("CustomerId", sql.Int, customerId)
        .input("EmployeeId", sql.Int, employeeId)
        .input("BranchId", sql.Int, branchId)
        .input("AppointmentDate", sql.Date, appointmentDate)
        .input("StartTime", sql.VarChar, startTime)
        .input("EndTime", sql.VarChar, endTime)
        .input("Notes", sql.NVarChar, notes).query(`
          INSERT INTO Appointments
          (CustomerId, EmployeeId, BranchId, AppointmentDate, StartTime, EndTime, Status, Notes)
          OUTPUT INSERTED.*
          VALUES
          (@CustomerId, @EmployeeId, @BranchId, @AppointmentDate, @StartTime, @EndTime, 'PENDING_PAYMENT', @Notes)
        `);

      appointment = appointmentResult.recordset[0];

      const invoiceResult = await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, appointment.AppointmentId)
        .input("TotalAmount", sql.Decimal(18, 2), selectedService.Price)
        .input("DiscountAmount", sql.Decimal(18, 2), 0)
        .input("FinalAmount", sql.Decimal(18, 2), selectedService.Price).query(`
          INSERT INTO Invoices
          (AppointmentId, TotalAmount, DiscountAmount, FinalAmount)
          OUTPUT INSERTED.InvoiceId
          VALUES
          (@AppointmentId, @TotalAmount, @DiscountAmount, @FinalAmount)
        `);

      invoiceId = invoiceResult.recordset[0].InvoiceId;
    }

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, appointment.AppointmentId)
      .input("ServiceId", sql.Int, serviceId)
      .input("Price", sql.Decimal(18, 2), customerPackageId ? 0 : selectedService.Price).query(`
        INSERT INTO AppointmentServices
        (AppointmentId, ServiceId, Price)
        VALUES
        (@AppointmentId, @ServiceId, @Price)
      `);

    await addStatusHistory(
      transaction,
      appointment.AppointmentId,
      null,
      customerPackageId ? "CONFIRMED" : "PENDING_PAYMENT",
      userId,
      customerPackageId
        ? "Customer booked with package"
        : "Customer created appointment and waiting for payment",
    );

    await transaction.commit();

    return {
      appointmentId: appointment.AppointmentId,
      AppointmentId: appointment.AppointmentId,
      invoiceId,
      serviceName: selectedService.ServiceName,
      ServiceName: selectedService.ServiceName,
      appointmentDate,
      AppointmentDate: appointmentDate,
      startTime,
      StartTime: startTime,
      endTime,
      EndTime: endTime,
      totalAmount: customerPackageId ? 0 : selectedService.Price,
      TotalAmount: customerPackageId ? 0 : selectedService.Price,
      finalAmount: customerPackageId ? 0 : selectedService.Price,
      FinalAmount: customerPackageId ? 0 : selectedService.Price,
      paymentStatus: customerPackageId ? "PAID" : "PENDING",
      status: customerPackageId ? "CONFIRMED" : "PENDING_PAYMENT",
      Status: customerPackageId ? "CONFIRMED" : "PENDING_PAYMENT",
      customerPackageId: customerPackageId || null,
      CustomerPackageId: customerPackageId || null,
      // Trả về CreatedAt để frontend có thể dùng làm fallback khi không có sessionStorage
      CreatedAt: appointment.CreatedAt,
      createdAt: appointment.CreatedAt,
    };


  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function getMyAppointments(userId) {
  const customerId = await getCustomerIdByUserId(userId);
  const pool = await connectDB();

  const result = await pool.request().input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        a.Notes,
        a.CancelReason,
        a.CustomerPackageId,
        a.EmployeeId,
        pkg.PackageName AS CustomerPackageName,

        u.FullName AS EmployeeName,
        e.ImageUrl AS EmployeeImageUrl,
        b.BranchName,

        svc.ServiceNames,
        svc.ServiceIds,
        svc.ServiceCount,
        svc.TotalPrice,
        svc.PrimaryServiceId AS ServiceId,
        svc.PrimaryServiceName AS ServiceName,

        i.InvoiceId,
        ISNULL(i.TotalAmount, svc.TotalPrice) AS TotalAmount,
        ISNULL(i.DiscountAmount, 0) AS DiscountAmount,
        ISNULL(i.FinalAmount, svc.TotalPrice) AS FinalAmount,
        v.Code AS VoucherCode,

        p.PaymentId,
        p.PaymentMethod,
        p.TransactionCode,
        p.VnpTxnRef,
        p.VnpTransactionNo,
        p.PaidAt,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus,

        rf.RefundStatus,
        rf.RefundReason,
        rf.RefundAmount,
        rf.RefundedAt,

        ISNULL(rv.ReviewCount, 0) AS ReviewCount

      FROM Appointments a
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId
      LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId

      OUTER APPLY (
        SELECT
          STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
          STRING_AGG(CONVERT(VARCHAR(20), s.ServiceId), ',') AS ServiceIds,
          COUNT(*) AS ServiceCount,
          SUM(ISNULL(aps.Price, s.Price)) AS TotalPrice,
          MIN(s.ServiceId) AS PrimaryServiceId,
          MIN(s.ServiceName) AS PrimaryServiceName
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = a.AppointmentId
      ) svc

      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Vouchers v ON i.VoucherId = v.VoucherId

      OUTER APPLY (
        SELECT TOP 1
          p2.PaymentId,
          p2.PaymentMethod,
          p2.Status,
          p2.TransactionCode,
          p2.VnpTxnRef,
          p2.VnpTransactionNo,
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
          r2.Status AS RefundStatus,
          r2.Reason AS RefundReason,
          r2.RefundAmount,
          r2.RefundedAt
        FROM Refunds r2
        JOIN Payments p3 ON r2.PaymentId = p3.PaymentId
        WHERE p3.InvoiceId = i.InvoiceId
        ORDER BY r2.RefundId DESC
      ) rf

      OUTER APPLY (
        SELECT COUNT(*) AS ReviewCount
        FROM Reviews r
        WHERE r.AppointmentId = a.AppointmentId
      ) rv

      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC, a.AppointmentId DESC
    `);

  return result.recordset;
}

async function getAll() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT *
    FROM Appointments
    ORDER BY CreatedAt DESC
  `);

  return result.recordset;
}

async function getById(id, user = null) {
  const pool = await connectDB();

  const result = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
      SELECT
        a.AppointmentId,
        a.CustomerId,
        a.EmployeeId,
        a.BranchId,
        a.CustomerPackageId,
        pkg.PackageName AS CustomerPackageName,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status,
        a.Notes,
        a.CancelReason,
        a.CreatedAt,
        a.UpdatedAt,

        cu.FullName AS CustomerName,
        cu.Email AS CustomerEmail,
        cu.Phone AS CustomerPhone,

        eu.FullName AS EmployeeName,
        eu.Email AS EmployeeEmail,
        eu.Phone AS EmployeePhone,
        e.Position,
        e.Specialization,
        e.ImageUrl AS EmployeeImageUrl,

        b.BranchName,
        b.Address AS BranchAddress,
        b.Phone AS BranchPhone,

        svcSummary.PrimaryServiceId AS ServiceId,
        svcSummary.PrimaryServiceName AS ServiceName,
        svcSummary.ServiceNames,
        svcSummary.ServiceCount,
        svcSummary.TotalDuration,
        svcSummary.TotalServiceAmount,

        i.InvoiceId,
        i.VoucherId,
        v.Code AS VoucherCode,
        ISNULL(i.TotalAmount, svcSummary.TotalServiceAmount) AS TotalAmount,
        ISNULL(i.DiscountAmount, 0) AS DiscountAmount,
        ISNULL(i.FinalAmount, svcSummary.TotalServiceAmount) AS FinalAmount,
        i.Status AS InvoiceStatus,
        i.CreatedAt AS InvoiceCreatedAt,

        p.PaymentId,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
        p.PaymentMethod,
        p.TransactionCode,
        p.VnpTxnRef,
        p.VnpTransactionNo,
        p.VnpResponseCode,
        p.PaidAt,

        rf.RefundStatus,
        rf.RefundReason,
        rf.RefundAmount,
        rf.RefundedAt AS RefundDate,

        ISNULL(rv.ReviewCount, 0) AS ReviewCount,

        jsonData.ServicesJson,
        jsonData.PaymentsJson,
        jsonData.RefundsJson,
        jsonData.ReviewsJson,
        jsonData.StatusHistoryJson

      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId
      LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      LEFT JOIN Packages pkg ON cp.PackageId = pkg.PackageId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Vouchers v ON i.VoucherId = v.VoucherId

      OUTER APPLY (
        SELECT
          MIN(s.ServiceId) AS PrimaryServiceId,
          MIN(s.ServiceName) AS PrimaryServiceName,
          STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
          COUNT(*) AS ServiceCount,
          SUM(ISNULL(s.DurationMinutes, 0)) AS TotalDuration,
          SUM(ISNULL(aps.Price, s.Price)) AS TotalServiceAmount
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = a.AppointmentId
      ) svcSummary

      OUTER APPLY (
        SELECT TOP 1
          p2.PaymentId,
          p2.Status,
          p2.PaymentMethod,
          p2.TransactionCode,
          p2.VnpTxnRef,
          p2.VnpTransactionNo,
          p2.VnpResponseCode,
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
          r2.Status AS RefundStatus,
          r2.Reason AS RefundReason,
          r2.RefundAmount,
          r2.RefundedAt
        FROM Refunds r2
        JOIN Payments p3 ON r2.PaymentId = p3.PaymentId
        WHERE p3.InvoiceId = i.InvoiceId
        ORDER BY r2.RefundId DESC
      ) rf

      OUTER APPLY (
        SELECT COUNT(*) AS ReviewCount
        FROM Reviews r
        WHERE r.AppointmentId = a.AppointmentId
      ) rv

      OUTER APPLY (
        SELECT
          (
            SELECT
              aps.AppointmentServiceId,
              s.ServiceId,
              s.ServiceName,
              s.Description,
              s.DurationMinutes,
              aps.Price,
              s.ImageUrl,
              sc.CategoryName,
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM Reviews r
                  WHERE r.AppointmentId = a.AppointmentId
                    AND r.ServiceId = s.ServiceId
                )
                THEN 1 ELSE 0
              END AS HasReviewed
            FROM AppointmentServices aps
            JOIN Services s ON aps.ServiceId = s.ServiceId
            LEFT JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
            WHERE aps.AppointmentId = a.AppointmentId
            ORDER BY aps.AppointmentServiceId ASC
            FOR JSON PATH
          ) AS ServicesJson,

          (
            SELECT
              p4.PaymentId,
              p4.Amount,
              p4.PaymentMethod,
              p4.Status,
              p4.TransactionCode,
              p4.VnpTxnRef,
              p4.VnpTransactionNo,
              p4.VnpResponseCode,
              p4.PaidAt,
              p4.CreatedAt
            FROM Payments p4
            WHERE p4.InvoiceId = i.InvoiceId
            ORDER BY p4.CreatedAt DESC, p4.PaymentId DESC
            FOR JSON PATH
          ) AS PaymentsJson,

          (
            SELECT
              rf2.RefundId,
              rf2.RefundAmount,
              rf2.Reason,
              rf2.Status,
              rf2.RefundedAt,
              rf2.CreatedAt
            FROM Refunds rf2
            JOIN Payments p5 ON rf2.PaymentId = p5.PaymentId
            WHERE p5.InvoiceId = i.InvoiceId
            ORDER BY rf2.CreatedAt DESC, rf2.RefundId DESC
            FOR JSON PATH
          ) AS RefundsJson,

          (
            SELECT
              r3.ReviewId,
              r3.ServiceId,
              s3.ServiceName,
              r3.Rating,
              r3.TechnicianRating,
              r3.Comment,
              r3.Status,
              r3.AdminResponse,
              r3.CreatedAt
            FROM Reviews r3
            JOIN Services s3 ON r3.ServiceId = s3.ServiceId
            WHERE r3.AppointmentId = a.AppointmentId
            ORDER BY r3.CreatedAt DESC
            FOR JSON PATH
          ) AS ReviewsJson,

          (
            SELECT
              h.HistoryId,
              h.OldStatus,
              h.NewStatus,
              h.Reason,
              h.ChangedAt,
              u2.FullName AS ChangedByName
            FROM AppointmentStatusHistory h
            LEFT JOIN Users u2 ON h.ChangedBy = u2.UserId
            WHERE h.AppointmentId = a.AppointmentId
            ORDER BY h.ChangedAt ASC, h.HistoryId ASC
            FOR JSON PATH
          ) AS StatusHistoryJson
      ) jsonData

      WHERE a.AppointmentId = @AppointmentId
    `);

  const appointment = result.recordset[0];

  if (!appointment) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  if (user && String(user.role).toUpperCase() === "CUSTOMER") {
    const customerId = await getCustomerIdByUserId(user.userId);

    if (appointment.CustomerId !== customerId) {
      throw new Error("Bạn không được xem lịch hẹn này");
    }
  }

  return appointment;
}

async function update(id, data, user = null) {
  const pool = await connectDB();
  const current = await getById(id, user);

  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  if (user && String(user.role).toUpperCase() === "CUSTOMER") {
    const customerId = await getCustomerIdByUserId(user.userId);

    if (current.CustomerId !== customerId) {
      throw new Error("Bạn không được sửa lịch hẹn này");
    }

    const currentStatus = String(current.Status || "").toUpperCase();
    if (
      [
        "COMPLETED",
        "CANCELLED",
        "REFUND_PENDING",
        "REFUNDED",
        "NO_SHOW",
      ].includes(currentStatus)
    ) {
      throw new Error("Lịch hẹn này không thể đổi lịch");
    }

    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(currentStatus)) {
      throw new Error(
        "Chỉ được đổi lịch khi lịch đang chờ thanh toán hoặc đã xác nhận",
      );
    }
    ensureNotTooClose(current.AppointmentDate, current.StartTime, "đổi");
  }

  const isCustomer = user && String(user.role).toUpperCase() === "CUSTOMER";

  if (isCustomer && (data.status !== undefined || data.Status !== undefined)) {
    throw new Error("Customer không được tự thay đổi trạng thái lịch hẹn");
  }

  const requestedStatus = data.status || data.Status || current.Status;
  const status = isCustomer ? current.Status : requestedStatus;
  const normalizedStatus = String(status || "").toUpperCase();

  const allowedStatuses = new Set([
    "PENDING_PAYMENT",
    "PENDING",
    "PAID",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "REFUND_PENDING",
    "NO_SHOW",
  ]);

  if (!allowedStatuses.has(normalizedStatus)) {
    throw new Error("Trạng thái lịch hẹn không hợp lệ");
  }

  if (!isCustomer && normalizedStatus === "NO_SHOW" && !isStaffUser(user)) {
    throw new Error("Chỉ admin, manager hoặc lễ tân mới được chuyển NO_SHOW");
  }

  if (isCustomer && normalizedStatus === "NO_SHOW") {
    throw new Error("Customer không được chuyển lịch hẹn sang NO_SHOW");
  }
  const appointmentDate =
    data.appointmentDate || data.AppointmentDate || current.AppointmentDate;

  let startTime = data.startTime || data.StartTime || current.StartTime;
  if (startTime && String(startTime).length === 5) startTime += ":00";

  const notes = data.notes !== undefined ? data.notes : current.Notes;

  let endTime = current.EndTime;

  const hasRescheduleData =
    data.appointmentDate !== undefined ||
    data.AppointmentDate !== undefined ||
    data.startTime !== undefined ||
    data.StartTime !== undefined;

  if (hasRescheduleData) {
    const serviceInfo = await pool.request().input("AppointmentId", sql.Int, id)
      .query(`
      SELECT TOP 1 
        s.ServiceId,
        s.DurationMinutes
      FROM AppointmentServices aps
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE aps.AppointmentId = @AppointmentId
    `);

    const serviceId = serviceInfo.recordset[0]?.ServiceId;
    const minutes = serviceInfo.recordset[0]?.DurationMinutes || 60;

    if (!serviceId) {
      throw new Error("Không tìm thấy dịch vụ của lịch hẹn");
    }

    endTime = addMinutesToTime(String(startTime).slice(0, 5), minutes);

    ensureFutureAppointment(appointmentDate, startTime);

    await ensureSlotAvailableForReschedule({
      appointmentId: Number(id),
      employeeId: current.EmployeeId,
      serviceId,
      appointmentDate,
      startTime,
    });

    await checkEmployeeBusy(
      current.EmployeeId,
      appointmentDate,
      startTime,
      endTime,
      Number(id),
    );
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("AppointmentDate", sql.Date, appointmentDate)
      .input("StartTime", sql.VarChar, startTime)
      .input("EndTime", sql.VarChar, endTime)
      .input("Status", sql.VarChar, status)
      .input("Notes", sql.NVarChar, notes || null).query(`
        UPDATE Appointments
        SET AppointmentDate = @AppointmentDate,
            StartTime = @StartTime,
            EndTime = @EndTime,
            Status = @Status,
            Notes = @Notes,
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    if (String(current.Status).toUpperCase() !== String(status).toUpperCase()) {
      await addStatusHistory(
        transaction,
        Number(id),
        current.Status,
        status,
        user?.userId,
        "Update appointment status",
      );
    } else if (hasRescheduleData) {
      await addStatusHistory(
        transaction,
        Number(id),
        current.Status,
        current.Status,
        user?.userId,
        "Customer rescheduled appointment",
      );
    }

    /* ===========================================================
       TỰ ĐỘNG TRỪ BUỔI COMBO KHI APPOINTMENT CHUYỂN SANG COMPLETED
       - Chỉ trừ khi lịch hẹn có liên kết CustomerPackageId
       - Chống trừ trùng bằng Unique Index trên CustomerPackageUsages(AppointmentId)
       - Khi RemainingSessions về 0, chuyển gói sang USED_UP
       =========================================================== */
    const oldStatusUpper = String(current.Status || "").toUpperCase();
    const newStatusUpper = String(status || "").toUpperCase();

    if (
      newStatusUpper === "COMPLETED" &&
      oldStatusUpper !== "COMPLETED" &&
      current.CustomerPackageId
    ) {
      // Kiểm tra chưa từng trừ buổi cho appointment này
      const usageCheck = await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, Number(id)).query(`
          SELECT UsageId FROM CustomerPackageUsages
          WHERE AppointmentId = @AppointmentId AND Status = 'COMPLETED'
        `);

      if (usageCheck.recordset.length === 0) {
        // Lấy ServiceId từ AppointmentServices
        const svcResult = await new sql.Request(transaction)
          .input("AppointmentId", sql.Int, Number(id)).query(`
            SELECT TOP 1 ServiceId FROM AppointmentServices
            WHERE AppointmentId = @AppointmentId
          `);

        const serviceId = svcResult.recordset[0]?.ServiceId;

        if (serviceId) {
          // Kiểm tra giới hạn số buổi của dịch vụ trong combo
          const checkLimit = await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId)
            .input("ServiceId", sql.Int, serviceId).query(`
              SELECT
                ISNULL(ps.SessionCount, 1) AS MaxSessions,
                (
                  SELECT ISNULL(SUM(SessionsUsed), 0)
                  FROM CustomerPackageUsages
                  WHERE CustomerPackageId = @CustomerPackageId
                    AND ServiceId = @ServiceId
                    AND Status <> 'CANCELLED'
                ) AS UsedCount
              FROM CustomerPackages cp
              JOIN PackageServices ps ON cp.PackageId = ps.PackageId
              WHERE cp.CustomerPackageId = @CustomerPackageId
                AND ps.ServiceId = @ServiceId
            `);

          const limitInfo = checkLimit.recordset[0];
          if (limitInfo && limitInfo.UsedCount >= limitInfo.MaxSessions) {
            throw new Error(`Dịch vụ này đã dùng hết số buổi quy định trong combo (Tối đa ${limitInfo.MaxSessions} buổi)`);
          }

          // Tạo bản ghi sử dụng
          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId)
            .input("AppointmentId", sql.Int, Number(id))
            .input("ServiceId", sql.Int, serviceId).query(`
              INSERT INTO CustomerPackageUsages
              (CustomerPackageId, AppointmentId, ServiceId, SessionsUsed, UsedBy, Status)
              SELECT @CustomerPackageId, @AppointmentId, @ServiceId, 1, c.UserId, 'COMPLETED'
              FROM Appointments a
              JOIN Customers c ON a.CustomerId = c.CustomerId
              WHERE a.AppointmentId = @AppointmentId
            `);

          // Trừ buổi: UsedSessions +1, RemainingSessions -1
          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId).query(`
              UPDATE CustomerPackages
              SET UsedSessions = UsedSessions + 1,
                  RemainingSessions = CASE WHEN RemainingSessions > 0 THEN RemainingSessions - 1 ELSE 0 END,
                  UpdatedAt = GETDATE()
              WHERE CustomerPackageId = @CustomerPackageId
            `);

          // Kiểm tra nếu hết buổi -> chuyển gói sang USED_UP
          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, current.CustomerPackageId).query(`
              UPDATE CustomerPackages
              SET Status = 'USED_UP', UpdatedAt = GETDATE()
              WHERE CustomerPackageId = @CustomerPackageId
                AND RemainingSessions <= 0
                AND Status = 'ACTIVE'
            `);
        }
      }
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

  return await getById(id);
}

async function markNoShow(id, data = {}, user = null) {
  if (!isStaffUser(user)) {
    throw new Error(
      "Chỉ admin, manager hoặc lễ tân mới được đánh dấu vắng mặt",
    );
  }

  const pool = await connectDB();
  const current = await getById(id, user);

  // Validate state transition using state machine service
  appointmentStateService.validateTransition(current.Status, "NO_SHOW");

  const reason = String(
    data.reason || data.cancelReason || data.note || "Khách không đến",
  ).trim();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, id)
      .input("NewStatus", sql.NVarChar, "NO_SHOW")
      .input("Reason", sql.NVarChar, reason).query(`
        UPDATE Appointments
        SET Status = @NewStatus,
            CancelReason = COALESCE(CancelReason, @Reason),
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await addStatusHistory(
      transaction,
      Number(id),
      current.Status,
      "NO_SHOW",
      user?.userId,
      reason,
    );

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

  return await getById(id, user);
}

async function cancelAppointment(id, data = {}, user = null) {
  const pool = await connectDB();
  const current = await getById(id, user);

  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  // Validate state transition using state machine service
  appointmentStateService.validateTransition(current.Status, "CANCELLED");

  if (user && String(user.role).toUpperCase() === "CUSTOMER") {
    const customerId = await getCustomerIdByUserId(user.userId);

    if (current.CustomerId !== customerId) {
      throw new Error("Bạn không được hủy lịch hẹn này");
    }

    ensureNotTooClose(current.AppointmentDate, current.StartTime, "hủy");
  }

  const reason = String(data.reason || data.cancelReason || "").trim();

  if (user && String(user.role).toUpperCase() === "CUSTOMER" && !reason) {
    throw new Error("Vui lòng nhập lý do hủy lịch");
  }

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
          UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await addStatusHistory(
      transaction,
      Number(id),
      current.Status,
      newAppointmentStatus,
      user?.userId,
      reason || "Customer cancelled appointment",
    );

    if (current.CustomerPackageId) {
      /*
        Với luồng mới, đặt lịch bằng combo chưa trừ buổi.
        Vì vậy hủy lịch không được cộng trả buổi bừa bãi.
        Chỉ cộng trả khi lịch này thật sự đã có bản ghi sử dụng combo.
      */
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
            SET Status = 'CANCELLED', UpdatedAt = GETDATE()
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
              UpdatedAt = GETDATE()
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
              reason || "Customer cancelled paid appointment",
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
      // 1. Hoàn lại số lượng voucher trong bảng Vouchers
      await new sql.Request(transaction)
        .input("VoucherId", sql.Int, cancelledVoucherId)
        .query(`
          UPDATE Vouchers
          SET Quantity = Quantity + 1
          WHERE VoucherId = @VoucherId
        `);

      // 2. Chuyển trạng thái UsedStatus = 0 để khách hàng có thể dùng tiếp
      await new sql.Request(transaction)
        .input("CustomerId", sql.Int, current.CustomerId)
        .input("VoucherId", sql.Int, cancelledVoucherId)
        .query(`
          UPDATE CustomerVouchers
          SET UsedStatus = 0
          WHERE CustomerId = @CustomerId
            AND VoucherId = @VoucherId
        `);
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }

  try {
    const { runAutoMatch } = require("../waiting-list/waiting-list.service");
    runAutoMatch(current.AppointmentDate).catch(err => console.error("Auto match failed:", err.message));
  } catch (err) {
    console.error("Auto match trigger failed:", err.message);
  }

  return await getById(id, user);
}

async function remove(id, data = {}, user = null) {
  return await cancelAppointment(id, data, user);
}

/**
 * Job tự động hủy các lịch hẹn PENDING_PAYMENT đã quá 15 phút mà chưa thanh toán.
 * Gửi thông báo trong hệ thống cho khách hàng.
 */
async function autoExpirePendingPayments() {
  const pool = await connectDB();

  // Tìm tất cả lịch PENDING_PAYMENT quá AUTO_CANCEL_MINUTES phút
  const expiredResult = await pool.request()
    .input("MinutesLimit", sql.Int, AUTO_CANCEL_MINUTES)
    .query(`
      SELECT
        a.AppointmentId,
        a.Status,
        a.CreatedAt,
        a.CustomerId,
        c.UserId,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
        CONVERT(VARCHAR(10), a.AppointmentDate, 120) AS AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.Status = 'PENDING_PAYMENT'
        AND a.CreatedAt IS NOT NULL
        AND DATEDIFF(MINUTE, a.CreatedAt, GETDATE()) >= @MinutesLimit
      GROUP BY
        a.AppointmentId, a.Status, a.CreatedAt, a.CustomerId,
        c.UserId, a.AppointmentDate, a.StartTime
    `);

  const expired = expiredResult.recordset || [];
  const cancelled = [];

  for (const row of expired) {
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      // Cập nhật trạng thái sang CANCELLED
      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, row.AppointmentId)
        .input("Reason", sql.NVarChar, `Tự động hủy do chưa thanh toán sau ${AUTO_CANCEL_MINUTES} phút`)
        .query(`
          UPDATE Appointments
          SET
            Status = 'CANCELLED',
            CancelReason = @Reason,
            UpdatedAt = GETDATE()
          WHERE AppointmentId = @AppointmentId
            AND Status = 'PENDING_PAYMENT'
        `);

      // Hoàn lại voucher nếu lịch hẹn có sử dụng voucher
      const invoiceVoucher = await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, row.AppointmentId)
        .query(`
          SELECT TOP 1 VoucherId
          FROM Invoices
          WHERE AppointmentId = @AppointmentId
          ORDER BY InvoiceId DESC
        `);
      const cancelledVoucherId = invoiceVoucher.recordset[0]?.VoucherId || null;

      if (cancelledVoucherId) {
        // 1. Hoàn lại số lượng voucher trong bảng Vouchers
        await new sql.Request(transaction)
          .input("VoucherId", sql.Int, cancelledVoucherId)
          .query(`
            UPDATE Vouchers
            SET Quantity = Quantity + 1
            WHERE VoucherId = @VoucherId
          `);

        // 2. Chuyển trạng thái UsedStatus = 0 để khách hàng có thể dùng tiếp
        await new sql.Request(transaction)
          .input("CustomerId", sql.Int, row.CustomerId)
          .input("VoucherId", sql.Int, cancelledVoucherId)
          .query(`
            UPDATE CustomerVouchers
            SET UsedStatus = 0
            WHERE CustomerId = @CustomerId
              AND VoucherId = @VoucherId
          `);
      }
      // Ghi lịch sử trạng thái
      await addStatusHistory(
        transaction,
        row.AppointmentId,
        "PENDING_PAYMENT",
        "CANCELLED",
        null,
        `Tự động hủy do chưa thanh toán sau ${AUTO_CANCEL_MINUTES} phút`,
      );

      await transaction.commit();

      // Gửi thông báo cho khách hàng (ngoài transaction để không ảnh hưởng nếu lỗi)
      try {
        if (row.UserId) {
          const apCode = `AP${String(row.AppointmentId).padStart(5, "0")}`;
          const svcText = row.ServiceNames || "dịch vụ";
          const dateText = String(row.AppointmentDate || "").slice(0, 10);
          const timeText = String(row.StartTime || "").slice(0, 5);

          await createNotification({
            userId: row.UserId,
            title: `⏰ Lịch hẹn ${apCode} đã bị hủy tự động`,
            content: `Lịch hẹn ${apCode} cho dịch vụ "${svcText}" vào ${dateText} lúc ${timeText} đã bị hủy tự động vì chưa thanh toán trong ${AUTO_CANCEL_MINUTES} phút. Bạn có thể đặt lịch lại bất cứ lúc nào.`,
            type: "APPOINTMENT_AUTO_CANCELLED",
          });
        }
      } catch (notifErr) {
        console.error(`[auto-expire] Failed to send notification for AP${row.AppointmentId}:`, notifErr.message);
      }

      cancelled.push(row.AppointmentId);
      console.log(`[auto-expire] Cancelled appointment AP${String(row.AppointmentId).padStart(5, "0")} (created ${row.CreatedAt})`);
    } catch (err) {
      try { await transaction.rollback(); } catch (_) {}
      console.error(`[auto-expire] Failed to cancel appointment ${row.AppointmentId}:`, err.message);
    }
  }

  if (cancelled.length > 0) {
    try {
      const uniqueDates = [...new Set(expired
        .filter(r => cancelled.includes(r.AppointmentId))
        .map(r => r.AppointmentDate)
        .filter(Boolean)
      )];
      
      const { runAutoMatch } = require("../waiting-list/waiting-list.service");
      for (const d of uniqueDates) {
        runAutoMatch(d).catch(err => console.error(`[auto-expire] Auto match failed for date ${d}:`, err.message));
      }
    } catch (err) {
      console.error("[auto-expire] Auto match trigger failed:", err.message);
    }
  }

  return { cancelled: cancelled.length, ids: cancelled };
}

/**
 * Khởi chạy scheduler tự động hủy lịch chưa thanh toán.
 * Chạy mỗi 2 phút để đảm bảo độ chính xác.
 */
function startAutoExpireScheduler(intervalMs = 2 * 60 * 1000) {
  const run = async () => {
    try {
      const result = await autoExpirePendingPayments();
      if (result.cancelled > 0) {
        console.log(`[auto-expire] Cancelled ${result.cancelled} pending-payment appointment(s): [${result.ids.join(", ")}]`);
      }
    } catch (err) {
      console.error("[auto-expire] Scheduler error:", err.message);
    }
  };

  // Chạy ngay khi khởi động
  run();
  const timer = setInterval(run, intervalMs);
  return timer;
}

async function confirmAppointment(id, user) {
  const pool = await connectDB();
  const current = await getById(id, user);

  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  const customerId = await getCustomerIdByUserId(user.userId);
  if (current.CustomerId !== customerId) {
    throw new Error("Bạn không có quyền xác nhận lịch hẹn này");
  }

  const currentStatus = String(current.Status || "").toUpperCase();
  if (currentStatus !== "PENDING") {
    throw new Error("Chỉ có thể xác nhận lịch hẹn ở trạng thái Chờ xác nhận (PENDING)");
  }

  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    
    await new sql.Request(tx)
      .input("AppointmentId", sql.Int, id)
      .query(`
        UPDATE Appointments
        SET Status = 'CONFIRMED', UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);
      
    await addStatusHistory(
      tx,
      id,
      null,
      "CONFIRMED",
      user.userId,
      "Khách hàng xác nhận lịch hẹn tái khám"
    );

    await tx.commit();

    // Tự động finalize hồ sơ điều trị gốc liên kết với lịch tái khám này
    try {
      await treatmentNotesV2Service.finalizeByFollowUpAppointment(Number(id));
    } catch (finalizeErr) {
      console.warn("[confirmAppointment] Auto-finalize treatment note failed (non-critical):", finalizeErr.message);
    }

    return { appointmentId: id, status: "CONFIRMED" };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

module.exports = {
  getAll,
  getById,
  getMyAppointments,
  getAvailableSlots,
  getRescheduleInfo,
  reschedule,
  create,
  update,
  markNoShow,
  cancelAppointment,
  remove,
  getSlotAlternatives,
  autoExpirePendingPayments,
  startAutoExpireScheduler,
  confirmAppointment,
};
