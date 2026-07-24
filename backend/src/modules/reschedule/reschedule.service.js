const { sql, connectDB } = require("../../config/db");
const notificationsService = require("../notifications/notifications.service");

// Helper to get employee ID from user ID
async function getEmployeeByUserId(pool, userId) {
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query(
      "SELECT EmployeeId, Position, Specialization FROM Employees WHERE UserId = @UserId",
    );
  return result.recordset[0];
}

// Helper: kiểm tra khung giờ đề xuất có bị trùng lịch hẹn khác không
async function checkSlotConflict(
  pool,
  employeeId,
  requestedDate,
  startTime,
  endTime,
  appointmentId,
) {
  const conflictRes = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("RequestedDate", sql.Date, requestedDate)
    .input("StartTime", sql.VarChar(8), startTime)
    .input("EndTime", sql.VarChar(8), endTime)
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT TOP 1 AppointmentId 
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND CAST(AppointmentDate AS DATE) = CAST(@RequestedDate AS DATE)
        AND AppointmentId <> @AppointmentId
        AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED')
        AND (
          (CAST(StartTime AS TIME) < CAST(@EndTime AS TIME))
          AND (CAST(EndTime AS TIME) > CAST(@StartTime AS TIME))
        )
    `);
  return conflictRes.recordset.length > 0;
}

async function createRequest(userId, appointmentId, body = {}) {
  const pool = await connectDB();
  const employee = await getEmployeeByUserId(pool, userId);
  if (!employee) {
    throw new Error("Tài khoản của bạn không phải là nhân viên kỹ thuật viên");
  }

  // 1. Fetch appointment
  const apptResult = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT AppointmentId, EmployeeId, AppointmentDate, Status, CustomerId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
    `);
  const appt = apptResult.recordset[0];
  if (!appt) {
    throw new Error("Không tìm thấy lịch hẹn");
  }

  // 2. Validate technician ownership
  if (Number(appt.EmployeeId) !== Number(employee.EmployeeId)) {
    throw new Error("Bạn không có quyền yêu cầu đổi lịch cho cuộc hẹn này");
  }

  // 3. Validate appointment status - chỉ được đổi lịch khi đã được xác nhận (CONFIRMED)
  const status = String(appt.Status).toUpperCase();
  if (status !== "CONFIRMED") {
    throw new Error(
      "Chỉ được đề xuất đổi lịch khi lịch hẹn đã được xác nhận (đang ở trạng thái Đã xác nhận)",
    );
  }

  // 4. Validate requested date is in future
  const requestedDate = body.requestedDate;
  const requestedStartTime = body.requestedStartTime;
  const requestedEndTime = body.requestedEndTime;
  const reason = String(body.reason || "").trim();

  if (!requestedDate || !requestedStartTime || !requestedEndTime) {
    throw new Error(
      "Vui lòng cung cấp đầy đủ Ngày, Giờ bắt đầu và Giờ kết thúc đề xuất",
    );
  }

  const propDateTime = new Date(`${requestedDate}T${requestedStartTime}`);
  if (propDateTime <= new Date()) {
    throw new Error("Thời gian đề xuất đổi lịch phải ở tương lai");
  }

  // Validate that end time is after start time
  const [startH, startM] = requestedStartTime.split(":").map(Number);
  const [endH, endM] = requestedEndTime.split(":").map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (endMinutes <= startMinutes) {
    throw new Error("Giờ kết thúc đề xuất phải sau giờ bắt đầu đề xuất");
  }

  // 5. Chống spam: kiểm tra nếu đã có request đang chờ (PENDING hoặc AWAITING_CUSTOMER)
  const existingResult = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId)).query(`
      SELECT RequestId, Status FROM AppointmentRescheduleRequests
      WHERE AppointmentId = @AppointmentId AND Status IN ('PENDING', 'AWAITING_CUSTOMER')
    `);
  if (existingResult.recordset.length > 0) {
    const existingStatus = existingResult.recordset[0].Status;
    if (existingStatus === "AWAITING_CUSTOMER") {
      throw new Error(
        "Lịch hẹn đã có yêu cầu đổi lịch đang chờ khách hàng xác nhận. Vui lòng đợi kết quả trước khi gửi mới.",
      );
    }
    throw new Error(
      "Lịch hẹn đã có yêu cầu đổi lịch đang chờ lễ tân duyệt. Vui lòng đợi kết quả trước khi gửi mới.",
    );
  }

  // 6. Insert request
  await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("RequesterId", sql.Int, userId)
    .input("RequestedDate", sql.Date, requestedDate)
    .input("RequestedStartTime", sql.VarChar(8), requestedStartTime)
    .input("RequestedEndTime", sql.VarChar(8), requestedEndTime)
    .input("Reason", sql.NVarChar(500), reason).query(`
      INSERT INTO AppointmentRescheduleRequests 
        (AppointmentId, RequesterId, RequestedDate, RequestedStartTime, RequestedEndTime, Reason, Status, CreatedAt)
      VALUES 
        (@AppointmentId, @RequesterId, @RequestedDate, @RequestedStartTime, @RequestedEndTime, @Reason, 'PENDING', GETDATE())
    `);

  // 7. Notify receptionist (we can get manager/receptionist users or send dynamic notification)
  try {
    const receptionistUsersRes = await pool.request().query(`
      SELECT u.UserId 
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      WHERE r.RoleName = 'RECEPTIONIST'
    `);
    const dateFormatted = new Date(requestedDate).toLocaleDateString("vi-VN");
    for (const rec of receptionistUsersRes.recordset) {
      await notificationsService.create({
        userId: rec.UserId,
        title: "Yêu cầu đổi lịch từ KTV",
        content: `KTV đề xuất đổi lịch hẹn #${appointmentId} sang ngày ${dateFormatted} lúc ${requestedStartTime}.`,
        type: "RESCHEDULE_REQUESTED",
      });
    }
  } catch (errNotif) {
    console.error(
      "Failed to notify receptionist of reschedule request:",
      errNotif,
    );
  }

  return { success: true, message: "Gửi yêu cầu đề xuất đổi lịch thành công!" };
}

async function getTechnicianRequests(userId) {
  const pool = await connectDB();
  const employee = await getEmployeeByUserId(pool, userId);
  if (!employee) return [];

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employee.EmployeeId).query(`
      SELECT 
        r.RequestId, r.AppointmentId, r.RequestedDate,
        CONVERT(VARCHAR(5), r.RequestedStartTime, 108) AS RequestedStartTime,
        CONVERT(VARCHAR(5), r.RequestedEndTime, 108) AS RequestedEndTime,
        r.Reason, r.Status, r.Notes, r.CreatedAt,
        cust.FullName AS CustomerName,
        appt.AppointmentDate AS OriginalDate,
        CONVERT(VARCHAR(5), appt.StartTime, 108) AS OriginalStartTime
      FROM AppointmentRescheduleRequests r
      JOIN Appointments appt ON r.AppointmentId = appt.AppointmentId
      JOIN Customers c ON appt.CustomerId = c.CustomerId
      JOIN Users cust ON c.UserId = cust.UserId
      WHERE appt.EmployeeId = @EmployeeId
      ORDER BY r.CreatedAt DESC
    `);
  return result.recordset || [];
}

async function getReceptionistRequests() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT 
      r.RequestId, r.AppointmentId, r.RequestedDate,
      CONVERT(VARCHAR(5), r.RequestedStartTime, 108) AS RequestedStartTime,
      CONVERT(VARCHAR(5), r.RequestedEndTime, 108) AS RequestedEndTime,
      r.Reason, r.Status, r.Notes, r.CreatedAt,
      cust.FullName AS CustomerName,
      tech.FullName AS TechName,
      appt.AppointmentDate AS OriginalDate,
      CONVERT(VARCHAR(5), appt.StartTime, 108) AS OriginalStartTime
    FROM AppointmentRescheduleRequests r
    JOIN Appointments appt ON r.AppointmentId = appt.AppointmentId
    JOIN Customers c ON appt.CustomerId = c.CustomerId
    JOIN Users cust ON c.UserId = cust.UserId
    JOIN Employees e ON appt.EmployeeId = e.EmployeeId
    JOIN Users tech ON e.UserId = tech.UserId
    ORDER BY r.Status ASC, r.CreatedAt DESC
  `);
  return result.recordset || [];
}

async function approveRequest(requestId, actionUserId) {
  const pool = await connectDB();

  // 1. Fetch Request Details
  const reqRes = await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId)).query(`
      SELECT r.RequestId, r.AppointmentId, r.RequesterId, r.RequestedDate, 
             CONVERT(VARCHAR(8), r.RequestedStartTime, 108) AS RequestedStartTime, 
             CONVERT(VARCHAR(8), r.RequestedEndTime, 108) AS RequestedEndTime, 
             r.Reason, r.Status, r.Notes, r.CreatedAt, r.UpdatedAt,
             a.Status AS AppointmentStatus, a.CustomerId, a.EmployeeId, e.UserId AS TechUserId
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      WHERE r.RequestId = @RequestId
    `);
  const rescheduleReq = reqRes.recordset[0];
  if (!rescheduleReq) {
    throw new Error("Không tìm thấy yêu cầu đổi lịch");
  }

  if (rescheduleReq.Status !== "PENDING") {
    throw new Error("Yêu cầu này đã được xử lý từ trước");
  }

  // Kiểm tra trùng lịch
  const isConflicted = await checkSlotConflict(
    pool,
    rescheduleReq.EmployeeId,
    rescheduleReq.RequestedDate,
    rescheduleReq.RequestedStartTime,
    rescheduleReq.RequestedEndTime,
    rescheduleReq.AppointmentId,
  );

  if (isConflicted) {
    await pool
      .request()
      .input("RequestId", sql.Int, Number(requestId))
      .query(
        "UPDATE AppointmentRescheduleRequests SET Status = 'SYSTEM_CANCELLED', Notes = N'Tự động hủy do khung giờ đã bị trùng khách đặt trước', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
      );
    throw new Error(
      "Khung giờ đề xuất này đã có khách hàng khác đặt trước. Yêu cầu đổi lịch đã tự động bị hủy.",
    );
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 2. Update Request Status to AWAITING_CUSTOMER (chờ khách hàng xác nhận)
    await new sql.Request(transaction)
      .input("RequestId", sql.Int, Number(requestId))
      .query(
        "UPDATE AppointmentRescheduleRequests SET Status = 'AWAITING_CUSTOMER', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
      );

    // 3. KHÔNG update Appointment người dùng - chờ khách xác nhận mới update

    await transaction.commit();

    // 4. Notify Technician
    try {
      const dateTextStr = new Date(
        rescheduleReq.RequestedDate,
      ).toLocaleDateString("vi-VN");
      const timeRangeStr = `${String(rescheduleReq.RequestedStartTime).slice(0, 5)} - ${String(rescheduleReq.RequestedEndTime).slice(0, 5)}`;

      if (rescheduleReq.TechUserId) {
        await notificationsService.create({
          userId: rescheduleReq.TechUserId,
          title: "Yêu cầu đổi lịch được lễ tân duyệt - Chờ khách xác nhận",
          content: `Yêu cầu đổi lịch hẹn #${rescheduleReq.AppointmentId} sang ngày ${dateTextStr} lúc ${timeRangeStr} đã được lễ tân phê duyệt. Đang chờ khách hàng xác nhận.`,
          type: "RESCHEDULE_AWAITING_CUSTOMER",
        });
      }

      // Notify Customer
      const custUserRes = await pool
        .request()
        .input("CustomerId", sql.Int, rescheduleReq.CustomerId)
        .query("SELECT UserId FROM Customers WHERE CustomerId = @CustomerId");
      const custUserId = custUserRes.recordset[0]?.UserId;

      if (custUserId) {
        await notificationsService.create({
          userId: custUserId,
          title: "📅 Kỹ thuật viên đề xuất đổi lịch hẹn của bạn",
          content: `Kỹ thuật viên đề xuất dời lịch hẹn #${rescheduleReq.AppointmentId} sang ngày ${dateTextStr} lúc ${timeRangeStr}. Vui lòng vào chi tiết lịch hẹn để xác nhận hoặc từ chối.`,
          type: "RESCHEDULE_AWAITING_CUSTOMER",
        });
      }
    } catch (errNotif) {
      console.error("Failed to send approval notifications:", errNotif);
    }

    return {
      success: true,
      message: "Phê duyệt thành công! Đang chờ khách hàng xác nhận.",
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

// Khách hàng xác nhận đổi lịch
async function customerConfirm(requestId, userId) {
  const pool = await connectDB();

  // Lấy thông tin request
  const reqRes = await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId)).query(`
      SELECT r.RequestId, r.AppointmentId, r.RequestedDate,
             CONVERT(VARCHAR(8), r.RequestedStartTime, 108) AS RequestedStartTime,
             CONVERT(VARCHAR(8), r.RequestedEndTime, 108) AS RequestedEndTime,
             r.Reason, r.Status,
             a.Status AS AppointmentStatus, a.CustomerId, a.EmployeeId,
             e.UserId AS TechUserId
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      WHERE r.RequestId = @RequestId
    `);
  const req = reqRes.recordset[0];
  if (!req) throw new Error("Không tìm thấy yêu cầu đổi lịch");
  if (req.Status !== "AWAITING_CUSTOMER")
    throw new Error("Yêu cầu này không ở trạng thái chờ xác nhận");

  // Kiểm tra customer sở hữu
  const custRes = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  const customerId = custRes.recordset[0]?.CustomerId;
  if (!customerId || customerId !== req.CustomerId)
    throw new Error("Bạn không có quyền xác nhận yêu cầu này");

  // Kiểm tra trùng lịch khi khách hàng bấm xác nhận
  const isConflicted = await checkSlotConflict(
    pool,
    req.EmployeeId,
    req.RequestedDate,
    req.RequestedStartTime,
    req.RequestedEndTime,
    req.AppointmentId,
  );

  if (isConflicted) {
    await pool
      .request()
      .input("RequestId", sql.Int, Number(requestId))
      .query(
        "UPDATE AppointmentRescheduleRequests SET Status = 'SYSTEM_CANCELLED', Notes = N'Tự động hủy do khung giờ đề xuất đã bị khách khác đặt trước', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
      );
    throw new Error(
      "Rất tiếc, khung giờ này đã bị khách hàng khác đặt trước. Yêu cầu đổi lịch đã tự động bị hủy.",
    );
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 1. Cập nhật trạng thái request sang APPROVED
    await new sql.Request(transaction)
      .input("RequestId", sql.Int, Number(requestId))
      .query(
        "UPDATE AppointmentRescheduleRequests SET Status = 'APPROVED', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
      );

    // 2. Cập nhật lịch hẹn sang ngày giờ mới
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, req.AppointmentId)
      .input("RequestedDate", sql.Date, req.RequestedDate)
      .input("RequestedStartTime", sql.VarChar(8), req.RequestedStartTime)
      .input("RequestedEndTime", sql.VarChar(8), req.RequestedEndTime).query(`
        UPDATE Appointments
        SET AppointmentDate = @RequestedDate,
            StartTime = @RequestedStartTime,
            EndTime = @RequestedEndTime,
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    // 3. Ghi lịch sử trạng thái
    const logReason = `Đồng ý yêu cầu đổi lịch từ kỹ thuật viên. Lịch hẹn được dời sang ngày: ${req.RequestedDate}`;
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, req.AppointmentId)
      .input("OldStatus", sql.NVarChar, req.AppointmentStatus)
      .input("UserId", sql.Int, userId)
      .input("Reason", sql.NVarChar, logReason).query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, @OldStatus, @UserId, @Reason, GETDATE())
      `);

    await transaction.commit();

    // Notify technician
    try {
      const dateStr = new Date(req.RequestedDate).toLocaleDateString("vi-VN");
      const timeStr = `${String(req.RequestedStartTime).slice(0, 5)} - ${String(req.RequestedEndTime).slice(0, 5)}`;
      if (req.TechUserId) {
        await notificationsService.create({
          userId: req.TechUserId,
          title: "✅ Khách hàng đã xác nhận đổi lịch",
          content: `Khách hàng đã xác nhận đổi lịch hẹn #${req.AppointmentId} sang ngày ${dateStr} lúc ${timeStr}.`,
          type: "RESCHEDULE_APPROVED",
        });
      }
    } catch (e) {
      console.error("Notify failed:", e.message);
    }

    return { success: true, message: "Xác nhận đổi lịch thành công!" };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

// Khách hàng từ chối đổi lịch
async function customerReject(requestId, userId) {
  const pool = await connectDB();

  const reqRes = await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId)).query(`
      SELECT r.RequestId, r.AppointmentId, r.Status, a.CustomerId, e.UserId AS TechUserId
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      WHERE r.RequestId = @RequestId
    `);
  const req = reqRes.recordset[0];
  if (!req) throw new Error("Không tìm thấy yêu cầu đổi lịch");
  if (req.Status !== "AWAITING_CUSTOMER")
    throw new Error("Yêu cầu này không ở trạng thái chờ xác nhận");

  const custRes = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  const customerId = custRes.recordset[0]?.CustomerId;
  if (!customerId || customerId !== req.CustomerId)
    throw new Error("Bạn không có quyền từ chối yêu cầu này");

  await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId))
    .query(
      "UPDATE AppointmentRescheduleRequests SET Status = 'CUSTOMER_REJECTED', Notes = N'Khách hàng từ chối thay đổi lịch', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
    );

  // Notify technician
  try {
    if (req.TechUserId) {
      await notificationsService.create({
        userId: req.TechUserId,
        title: "❌ Khách hàng từ chối đổi lịch",
        content: `Khách hàng đã từ chối yêu cầu đổi lịch hẹn #${req.AppointmentId}. Lịch hẹn giữ nguyên.`,
        type: "RESCHEDULE_CUSTOMER_REJECTED",
      });
    }
  } catch (e) {
    console.error("Notify failed:", e.message);
  }

  return {
    success: true,
    message: "Từ chối đổi lịch thành công. Lịch hẹn giữ nguyên.",
  };
}

// Lấy reschedule request đang chờ xác nhận của khách hàng theo appointment
async function getCustomerPendingRequest(appointmentId, userId) {
  const pool = await connectDB();

  const custRes = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  const customerId = custRes.recordset[0]?.CustomerId;
  if (!customerId) return null;

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("CustomerId", sql.Int, customerId).query(`
      SELECT TOP 1
        r.RequestId, r.AppointmentId, a.EmployeeId, r.RequestedDate,
        CONVERT(VARCHAR(5), r.RequestedStartTime, 108) AS RequestedStartTime,
        CONVERT(VARCHAR(5), r.RequestedEndTime, 108) AS RequestedEndTime,
        r.Reason, r.Status, r.Notes, r.CreatedAt
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      WHERE r.AppointmentId = @AppointmentId
        AND a.CustomerId = @CustomerId
        AND r.Status = 'AWAITING_CUSTOMER'
      ORDER BY r.CreatedAt DESC
    `);
  const pending = result.recordset[0];
  if (!pending) return null;

  // Kiểm tra xem khung giờ có bị trùng lịch do ai đó mới đặt không
  const isConflicted = await checkSlotConflict(
    pool,
    pending.EmployeeId,
    pending.RequestedDate,
    pending.RequestedStartTime,
    pending.RequestedEndTime,
    pending.AppointmentId,
  );

  if (isConflicted) {
    // Tự động hủy yêu cầu và không hiển thị banner cho khách hàng nữa
    await pool
      .request()
      .input("RequestId", sql.Int, pending.RequestId)
      .query(
        "UPDATE AppointmentRescheduleRequests SET Status = 'SYSTEM_CANCELLED', Notes = N'Tự động hủy do khung giờ đã có người đặt trước', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
      );
    return null;
  }

  return pending;
}

async function rejectRequest(requestId, notes, actionUserId) {
  const pool = await connectDB();

  // 1. Fetch Request Details
  const reqRes = await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId)).query(`
      SELECT r.*, e.UserId AS TechUserId
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      WHERE r.RequestId = @RequestId
    `);
  const rescheduleReq = reqRes.recordset[0];
  if (!rescheduleReq) {
    throw new Error("Không tìm thấy yêu cầu đổi lịch");
  }

  if (rescheduleReq.Status !== "PENDING") {
    throw new Error("Yêu cầu này đã được xử lý từ trước");
  }

  const feedbackNotes = String(notes || "Yêu cầu bị từ chối bởi lễ tân").trim();

  // 2. Update Request Status to REJECTED
  await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId))
    .input("Notes", sql.NVarChar(500), feedbackNotes)
    .query(
      "UPDATE AppointmentRescheduleRequests SET Status = 'REJECTED', Notes = @Notes, UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
    );

  // 3. Notify Technician
  try {
    if (rescheduleReq.TechUserId) {
      await notificationsService.create({
        userId: rescheduleReq.TechUserId,
        title: "Yêu cầu đổi lịch bị từ chối",
        content: `Yêu cầu đổi lịch hẹn #${rescheduleReq.AppointmentId} của bạn đã bị từ chối. Lý do: ${feedbackNotes}`,
        type: "RESCHEDULE_REJECTED",
      });
    }
  } catch (errNotif) {
    console.error("Failed to send rejection notification:", errNotif);
  }

  return { success: true, message: "Từ chối yêu cầu đổi lịch thành công!" };
}

// Technician tự hủy yêu cầu đổi lịch của mình
async function technicianCancelRequest(requestId, userId) {
  const pool = await connectDB();
  const employee = await getEmployeeByUserId(pool, userId);
  if (!employee) throw new Error("Bạn không có quyền thực hiện thao tác này");

  const reqRes = await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId)).query(`
      SELECT r.RequestId, r.AppointmentId, r.Status, a.EmployeeId
      FROM AppointmentRescheduleRequests r
      JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      WHERE r.RequestId = @RequestId
    `);
  const req = reqRes.recordset[0];
  if (!req) throw new Error("Không tìm thấy yêu cầu đổi lịch");

  if (Number(req.EmployeeId) !== Number(employee.EmployeeId)) {
    throw new Error("Bạn không có quyền hủy yêu cầu này");
  }

  if (!["PENDING", "AWAITING_CUSTOMER"].includes(req.Status)) {
    throw new Error(
      "Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt hoặc chờ khách xác nhận",
    );
  }

  await pool
    .request()
    .input("RequestId", sql.Int, Number(requestId))
    .query(
      "UPDATE AppointmentRescheduleRequests SET Status = 'CANCELLED', Notes = N'Kỹ thuật viên đã tự hủy yêu cầu đổi lịch', UpdatedAt = GETDATE() WHERE RequestId = @RequestId",
    );

  return { success: true, message: "Hủy đề xuất đổi lịch thành công!" };
}

module.exports = {
  createRequest,
  getTechnicianRequests,
  getReceptionistRequests,
  approveRequest,
  rejectRequest,
  customerConfirm,
  customerReject,
  getCustomerPendingRequest,
  technicianCancelRequest,
};
