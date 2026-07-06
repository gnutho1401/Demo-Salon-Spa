const { sql, connectDB } = require("../../config/db");
const notificationsService = require("../notifications/notifications.service");

// Helper to get employee ID from user ID
async function getEmployeeByUserId(pool, userId) {
  const result = await pool.request()
    .input("UserId", sql.Int, userId)
    .query("SELECT EmployeeId, Position, Specialization FROM Employees WHERE UserId = @UserId");
  return result.recordset[0];
}

async function createRequest(userId, appointmentId, body = {}) {
  const pool = await connectDB();
  const employee = await getEmployeeByUserId(pool, userId);
  if (!employee) {
    throw new Error("Tài khoản của bạn không phải là nhân viên kỹ thuật viên");
  }

  // 1. Fetch appointment
  const apptResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .query(`
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

  // 3. Validate appointment status is active
  const status = String(appt.Status).toUpperCase();
  if (!["PENDING", "CONFIRMED", "PAID"].includes(status)) {
    throw new Error("Chỉ được đổi lịch cho cuộc hẹn có trạng thái Đang chờ hoặc Đã xác nhận");
  }

  // 4. Validate requested date is in future
  const requestedDate = body.requestedDate;
  const requestedStartTime = body.requestedStartTime;
  const requestedEndTime = body.requestedEndTime;
  const reason = String(body.reason || "").trim();

  if (!requestedDate || !requestedStartTime || !requestedEndTime) {
    throw new Error("Vui lòng cung cấp đầy đủ Ngày, Giờ bắt đầu và Giờ kết thúc đề xuất");
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

  // 5. Check if a PENDING request already exists
  const existingResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .query(`
      SELECT RequestId FROM AppointmentRescheduleRequests
      WHERE AppointmentId = @AppointmentId AND Status = 'PENDING'
    `);
  if (existingResult.recordset.length > 0) {
    throw new Error("Lịch hẹn này đã có yêu cầu đổi lịch đang chờ duyệt");
  }

  // 6. Insert request
  await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("RequesterId", sql.Int, userId)
    .input("RequestedDate", sql.Date, requestedDate)
    .input("RequestedStartTime", sql.VarChar(8), requestedStartTime)
    .input("RequestedEndTime", sql.VarChar(8), requestedEndTime)
    .input("Reason", sql.NVarChar(500), reason)
    .query(`
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
        type: "RESCHEDULE_REQUESTED"
      });
    }
  } catch (errNotif) {
    console.error("Failed to notify receptionist of reschedule request:", errNotif);
  }

  return { success: true, message: "Gửi yêu cầu đề xuất đổi lịch thành công!" };
}

async function getTechnicianRequests(userId) {
  const pool = await connectDB();
  const employee = await getEmployeeByUserId(pool, userId);
  if (!employee) return [];

  const result = await pool.request()
    .input("EmployeeId", sql.Int, employee.EmployeeId)
    .query(`
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
  const reqRes = await pool.request()
    .input("RequestId", sql.Int, Number(requestId))
    .query(`
      SELECT r.RequestId, r.AppointmentId, r.RequesterId, r.RequestedDate, 
             CONVERT(VARCHAR(8), r.RequestedStartTime, 108) AS RequestedStartTime, 
             CONVERT(VARCHAR(8), r.RequestedEndTime, 108) AS RequestedEndTime, 
             r.Reason, r.Status, r.Notes, r.CreatedAt, r.UpdatedAt,
             a.Status AS AppointmentStatus, a.CustomerId, e.UserId AS TechUserId
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

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // 2. Update Request Status to APPROVED
    await new sql.Request(transaction)
      .input("RequestId", sql.Int, Number(requestId))
      .query("UPDATE AppointmentRescheduleRequests SET Status = 'APPROVED', UpdatedAt = GETDATE() WHERE RequestId = @RequestId");

    // 3. Reschedule the Appointment
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, rescheduleReq.AppointmentId)
      .input("RequestedDate", sql.Date, rescheduleReq.RequestedDate)
      .input("RequestedStartTime", sql.VarChar(8), rescheduleReq.RequestedStartTime)
      .input("RequestedEndTime", sql.VarChar(8), rescheduleReq.RequestedEndTime)
      .query(`
        UPDATE Appointments
        SET AppointmentDate = @RequestedDate,
            StartTime = @RequestedStartTime,
            EndTime = @RequestedEndTime,
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    // 4. Log in Status History
    const logReason = `Đồng ý yêu cầu đổi lịch từ kỹ thuật viên. Ngày cũ sang ngày mới: ${rescheduleReq.RequestedDate}`;
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, rescheduleReq.AppointmentId)
      .input("OldStatus", sql.NVarChar, rescheduleReq.AppointmentStatus)
      .input("UserId", sql.Int, actionUserId)
      .input("Reason", sql.NVarChar, logReason)
      .query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, @OldStatus, @UserId, @Reason, GETDATE())
      `);

    await transaction.commit();

    // 5. Async notifications
    try {
      const dateTextStr = new Date(rescheduleReq.RequestedDate).toLocaleDateString("vi-VN");
      const timeRangeStr = `${String(rescheduleReq.RequestedStartTime).slice(0, 5)} - ${String(rescheduleReq.RequestedEndTime).slice(0, 5)}`;

      // Notify Technician
      if (rescheduleReq.TechUserId) {
        await notificationsService.create({
          userId: rescheduleReq.TechUserId,
          title: "Yêu cầu đổi lịch được duyệt",
          content: `Lịch hẹn #${rescheduleReq.AppointmentId} đã được đổi sang ngày ${dateTextStr} lúc ${timeRangeStr} theo yêu cầu của bạn.`,
          type: "RESCHEDULE_APPROVED"
        });
      }

      // Notify Customer
      const custUserRes = await pool.request()
        .input("CustomerId", sql.Int, rescheduleReq.CustomerId)
        .query("SELECT UserId FROM Customers WHERE CustomerId = @CustomerId");
      const custUserId = custUserRes.recordset[0]?.UserId;

      if (custUserId) {
        await notificationsService.create({
          userId: custUserId,
          title: "Thay đổi thời gian lịch hẹn",
          content: `Lịch hẹn #${rescheduleReq.AppointmentId} của bạn đã được thay đổi sang ngày ${dateTextStr} lúc ${timeRangeStr}.`,
          type: "RESCHEDULE_APPROVED"
        });
      }
    } catch (errNotif) {
      console.error("Failed to send approval notifications:", errNotif);
    }

    return { success: true, message: "Phê duyệt yêu cầu đổi lịch thành công!" };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function rejectRequest(requestId, notes, actionUserId) {
  const pool = await connectDB();

  // 1. Fetch Request Details
  const reqRes = await pool.request()
    .input("RequestId", sql.Int, Number(requestId))
    .query(`
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
  await pool.request()
    .input("RequestId", sql.Int, Number(requestId))
    .input("Notes", sql.NVarChar(500), feedbackNotes)
    .query("UPDATE AppointmentRescheduleRequests SET Status = 'REJECTED', Notes = @Notes, UpdatedAt = GETDATE() WHERE RequestId = @RequestId");

  // 3. Notify Technician
  try {
    if (rescheduleReq.TechUserId) {
      await notificationsService.create({
        userId: rescheduleReq.TechUserId,
        title: "Yêu cầu đổi lịch bị từ chối",
        content: `Yêu cầu đổi lịch hẹn #${rescheduleReq.AppointmentId} của bạn đã bị từ chối. Lý do: ${feedbackNotes}`,
        type: "RESCHEDULE_REJECTED"
      });
    }
  } catch (errNotif) {
    console.error("Failed to send rejection notification:", errNotif);
  }

  return { success: true, message: "Từ chối yêu cầu đổi lịch thành công!" };
}

module.exports = {
  createRequest,
  getTechnicianRequests,
  getReceptionistRequests,
  approveRequest,
  rejectRequest,
};
