const { sql, connectDB } = require("../../config/db");

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
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input("StartTime", sql.VarChar, startTime)
    .input("EndTime", sql.VarChar, endTime)
    .input("ExcludeAppointmentId", sql.Int, excludeAppointmentId).query(`
      SELECT AppointmentId
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @AppointmentDate
        AND Status NOT IN ('CANCELLED')
        AND (@StartTime < EndTime AND @EndTime > StartTime)
        AND (@ExcludeAppointmentId IS NULL OR AppointmentId <> @ExcludeAppointmentId)
    `);

  if (result.recordset.length > 0) {
    throw new Error("Kỹ thuật viên đã có lịch trong khung giờ này");
  }
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

async function getAvailableSlots({ employeeId, serviceId, appointmentDate }) {
  if (!employeeId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");

  const selectedService = await getServiceById(Number(serviceId));
  await checkEmployeeCanDoService(Number(employeeId), Number(serviceId));

  const pool = await connectDB();

  const shiftResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("AppointmentDate", sql.Date, appointmentDate).query(`
      SELECT TOP 1 StartTime, EndTime, IsDayOff
      FROM WorkShifts
      WHERE EmployeeId = @EmployeeId
        AND ShiftDate = @AppointmentDate
      ORDER BY ShiftId DESC
    `);

  let shiftStart = "08:00:00";
  let shiftEnd = "18:00:00";

  if (shiftResult.recordset[0]) {
    if (shiftResult.recordset[0].IsDayOff) {
      return [];
    }

    shiftStart = String(shiftResult.recordset[0].StartTime).slice(0, 8);
    shiftEnd = String(shiftResult.recordset[0].EndTime).slice(0, 8);
  }

  const bookedResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("AppointmentDate", sql.Date, appointmentDate).query(`
      SELECT StartTime, EndTime
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @AppointmentDate
        AND Status NOT IN ('CANCELLED')
    `);

  const booked = bookedResult.recordset.map((item) => ({
    start: String(item.StartTime).slice(0, 8),
    end: String(item.EndTime).slice(0, 8),
  }));

  const slots = [];
  let current = shiftStart.slice(0, 5);

  while (current < shiftEnd.slice(0, 5)) {
    const slotStart = current + ":00";
    const slotEnd = addMinutesToTime(
      slotStart,
      selectedService.DurationMinutes,
    );

    if (slotEnd <= shiftEnd) {
      const isBusy = booked.some((b) => slotStart < b.end && slotEnd > b.start);

      if (!isBusy) {
        slots.push({
          startTime: current,
          endTime: slotEnd.slice(0, 5),
        });
      }
    }

    current = addMinutesToTime(slotStart, 30).slice(0, 5);
  }

  return slots;
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

  const endTime = addMinutesToTime(startTime, selectedService.DurationMinutes);

  await checkEmployeeBusy(employeeId, appointmentDate, startTime, endTime);

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    let appointment;
    let invoiceId = null;

    if (customerPackageId) {
      const pkgCheck = await new sql.Request(transaction)
        .input("CustomerPackageId", sql.Int, customerPackageId)
        .input("CustomerId", sql.Int, customerId)
        .input("ServiceId", sql.Int, serviceId).query(`
          SELECT cp.CustomerPackageId, cp.RemainingSessions, cp.Status
          FROM CustomerPackages cp
          JOIN PackageServices ps ON cp.PackageId = ps.PackageId
          WHERE cp.CustomerPackageId = @CustomerPackageId
            AND cp.CustomerId = @CustomerId
            AND ps.ServiceId = @ServiceId
        `);

      const cpRecord = pkgCheck.recordset[0];

      if (!cpRecord) {
        throw new Error("Liệu trình không hợp lệ hoặc không chứa dịch vụ này");
      }

      if (cpRecord.Status !== "ACTIVE" || cpRecord.RemainingSessions <= 0) {
        throw new Error(
          "Liệu trình đã hết buổi hoặc không ở trạng thái kích hoạt",
        );
      }

      const appointmentResult = await new sql.Request(transaction)
        .input("CustomerId", sql.Int, customerId)
        .input("EmployeeId", sql.Int, employeeId)
        .input("AppointmentDate", sql.Date, appointmentDate)
        .input("StartTime", sql.VarChar, startTime)
        .input("EndTime", sql.VarChar, endTime)
        .input("Notes", sql.NVarChar, notes)
        .input("CustomerPackageId", sql.Int, customerPackageId).query(`
          INSERT INTO Appointments
          (CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime, Status, Notes, CustomerPackageId)
          OUTPUT INSERTED.*
          VALUES
(@CustomerId, @EmployeeId, @AppointmentDate, @StartTime, @EndTime, 'CONFIRMED', @Notes, @CustomerPackageId)
        `);

      appointment = appointmentResult.recordset[0];

      await new sql.Request(transaction).input(
        "CustomerPackageId",
        sql.Int,
        customerPackageId,
      ).query(`
          UPDATE CustomerPackages
          SET RemainingSessions = RemainingSessions - 1,
              UsedSessions = UsedSessions + 1,
              Status = CASE
                WHEN RemainingSessions - 1 = 0 THEN 'COMPLETED'
                ELSE Status
              END,
              UpdatedAt = GETDATE()
          WHERE CustomerPackageId = @CustomerPackageId
        `);

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
        .input("AppointmentDate", sql.Date, appointmentDate)
        .input("StartTime", sql.VarChar, startTime)
        .input("EndTime", sql.VarChar, endTime)
        .input("Notes", sql.NVarChar, notes).query(`
          INSERT INTO Appointments
          (CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime, Status, Notes)
          OUTPUT INSERTED.*
          VALUES
(@CustomerId, @EmployeeId, @AppointmentDate, @StartTime, @EndTime, 'PENDING_PAYMENT', @Notes)
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
      .input("Price", sql.Decimal(18, 2), selectedService.Price).query(`
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
      invoiceId,
      serviceName: selectedService.ServiceName,
      appointmentDate,
      startTime,
      endTime,
      totalAmount: selectedService.Price,
      finalAmount: customerPackageId ? 0 : selectedService.Price,
      paymentStatus: customerPackageId ? "PAID" : "PENDING",
      status: customerPackageId ? "CONFIRMED" : "PENDING_PAYMENT",
      customerPackageId: customerPackageId || null,
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
        a.CustomerPackageId,
        aps.ServiceId,
        a.EmployeeId,
        s.ServiceName,
        aps.Price,
        ISNULL(i.TotalAmount, aps.Price) AS TotalAmount,
        ISNULL(i.DiscountAmount, 0) AS DiscountAmount,
        ISNULL(i.FinalAmount, aps.Price) AS FinalAmount,
        u.FullName AS EmployeeName,
        p.PaymentMethod,
        ISNULL(p.Status, 'UNPAID') AS PaymentStatus
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Payments p ON i.InvoiceId = p.InvoiceId
      WHERE a.CustomerId = @CustomerId
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
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
        svc.ServiceId,
        a.CustomerPackageId,
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
        e.Position,
        e.Specialization,
        e.ImageUrl AS EmployeeImageUrl,

        b.BranchName,

        svc.ServiceNames,
        ISNULL(svc.TotalAmount, 0) AS TotalAmount,

        i.InvoiceId,
        i.VoucherId,
        v.Code AS VoucherCode,
        ISNULL(i.DiscountAmount, 0) AS DiscountAmount,
        ISNULL(i.FinalAmount, ISNULL(svc.TotalAmount, 0)) AS FinalAmount,
        i.CreatedAt AS InvoiceCreatedAt,

        ISNULL(p.Status, 'UNPAID') AS PaymentStatus,
        p.PaymentMethod,
        p.TransactionCode,
        p.VnpTxnRef,
        p.VnpTransactionNo,
        p.VnpResponseCode,
        p.PaidAt,

        ISNULL(rv.ReviewCount, 0) AS ReviewCount,
        ISNULL(svc.ServiceCount, 0) AS ServiceCount
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON a.BranchId = b.BranchId

      OUTER APPLY (
        SELECT
          MIN(aps.ServiceId) AS ServiceId,
          COUNT(*) AS ServiceCount,
          STRING_AGG(s.ServiceName, N', ') AS ServiceNames,
          SUM(aps.Price) AS TotalAmount
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = a.AppointmentId
      ) svc

      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN Vouchers v ON i.VoucherId = v.VoucherId

      OUTER APPLY (
        SELECT TOP 1
          p2.PaymentId,
          p2.Status,
          p2.PaymentMethod,
          p2.TransactionCode,
          p2.VnpTxnRef,
          p2.VnpTransactionNo,
          p2.VnpResponseCode,
          p2.PaidAt,
          p2.CreatedAt
        FROM Payments p2
        WHERE p2.InvoiceId = i.InvoiceId
        ORDER BY
          CASE 
            WHEN p2.Status = 'PAID' THEN 1
            WHEN p2.Status = 'PENDING' THEN 2
            WHEN p2.Status = 'FAILED' THEN 3
            ELSE 4
          END,
          p2.PaymentId DESC
      ) p

      OUTER APPLY (
        SELECT COUNT(*) AS ReviewCount
        FROM Reviews r
        WHERE r.AppointmentId = a.AppointmentId
      ) rv

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
  const current = await getById(id);

  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  if (user && String(user.role).toUpperCase() === "CUSTOMER") {
    const customerId = await getCustomerIdByUserId(user.userId);

    if (current.CustomerId !== customerId) {
      throw new Error("Bạn không được sửa lịch hẹn này");
    }

    if (
      !["PENDING_PAYMENT", "CONFIRMED"].includes(
        String(current.Status).toUpperCase(),
      )
    ) {
      throw new Error("Chỉ được đổi lịch khi lịch đang chờ hoặc đã xác nhận");
    }
    ensureNotTooClose(current.AppointmentDate, current.StartTime, "đổi");
  }

  const status = data.status || data.Status || current.Status;
  const appointmentDate =
    data.appointmentDate || data.AppointmentDate || current.AppointmentDate;

  let startTime = data.startTime || data.StartTime || current.StartTime;
  if (startTime && String(startTime).length === 5) startTime += ":00";

  const notes = data.notes !== undefined ? data.notes : current.Notes;

  let endTime = current.EndTime;

  if (data.appointmentDate || data.startTime || data.StartTime) {
    const serviceInfo = await pool.request().input("AppointmentId", sql.Int, id)
      .query(`
        SELECT TOP 1 s.DurationMinutes
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
      `);

    const minutes = serviceInfo.recordset[0]?.DurationMinutes || 60;
    endTime = addMinutesToTime(String(startTime).slice(0, 5), minutes);

    ensureFutureAppointment(appointmentDate, startTime);

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
    } else if (data.appointmentDate || data.startTime || data.StartTime) {
      await addStatusHistory(
        transaction,
        Number(id),
        current.Status,
        current.Status,
        user?.userId,
        "Customer rescheduled appointment",
      );
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

async function remove(id, data = {}, user = null) {
  const pool = await connectDB();
  const current = await getById(id);

  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  if (user && String(user.role).toUpperCase() === "CUSTOMER") {
    const customerId = await getCustomerIdByUserId(user.userId);

    if (current.CustomerId !== customerId) {
      throw new Error("Bạn không được hủy lịch hẹn này");
    }

    ensureNotTooClose(current.AppointmentDate, current.StartTime, "hủy");
  }

  const currentStatus = String(current.Status || "").toUpperCase();

  if (!["PENDING_PAYMENT", "CONFIRMED"].includes(currentStatus)) {
    throw new Error(
      "Chỉ được hủy lịch khi lịch đang chờ thanh toán hoặc đã xác nhận",
    );
  }

  const reason = String(data.reason || data.cancelReason || "").trim();

  if (!reason && user && String(user.role).toUpperCase() === "CUSTOMER") {
    throw new Error("Vui lòng nhập lý do hủy lịch");
  }

  const paymentStatus = String(current.PaymentStatus || "UNPAID").toUpperCase();
  const paymentMethod = String(current.PaymentMethod || "").toUpperCase();

  const hasPaid = paymentStatus === "PAID" && paymentMethod !== "PACKAGE";

  const newAppointmentStatus = hasPaid ? "REFUND_PENDING" : "CANCELLED";

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
          Notes = CASE
            WHEN @Reason IS NULL THEN Notes
            WHEN Notes IS NULL OR LTRIM(RTRIM(Notes)) = '' THEN N'Lý do hủy: ' + @Reason
            ELSE Notes + CHAR(13) + CHAR(10) + N'Lý do hủy: ' + @Reason
          END,
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
      await new sql.Request(transaction).input(
        "CustomerPackageId",
        sql.Int,
        current.CustomerPackageId,
      ).query(`
          UPDATE CustomerPackages
          SET 
            RemainingSessions = RemainingSessions + 1,
            UsedSessions = CASE
              WHEN UsedSessions > 0 THEN UsedSessions - 1
              ELSE 0
            END,
            Status = 'ACTIVE',
            UpdatedAt = GETDATE()
          WHERE CustomerPackageId = @CustomerPackageId
        `);
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
        await new sql.Request(transaction)
          .input("PaymentId", sql.Int, payment.PaymentId)
          .input("RefundAmount", sql.Decimal(18, 2), payment.Amount || 0)
          .input(
            "Reason",
            sql.NVarChar,
            reason || "Customer cancelled paid appointment",
          ).query(`
            INSERT INTO Refunds
              (PaymentId, RefundAmount, Reason, Status)
            VALUES
              (@PaymentId, @RefundAmount, @Reason, 'PENDING')
          `);
      }
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }

  return await getById(id, user);
}

module.exports = {
  getAll,
  getById,
  getMyAppointments,
  getAvailableSlots,
  create,
  update,
  remove,
};
