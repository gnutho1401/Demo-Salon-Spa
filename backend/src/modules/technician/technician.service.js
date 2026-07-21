const { sql, connectDB } = require("../../config/db");
const appointmentStateService = require("../appointments/appointment-state.service");
const receptionistService = require("../receptionist/receptionist.service");
const eventBusService = require("../event-bus/eventBus.service");
const { deductComboSession } = require("../appointments/appointments.service");

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
    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = CAST(GETDATE() AS DATE)) AS todayAppointments,
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = CAST(GETDATE() AS DATE) AND Status = 'IN_PROGRESS') AS inProgress,
      (SELECT COUNT(*) FROM Appointments WHERE EmployeeId = @EmployeeId AND AppointmentDate = CAST(GETDATE() AS DATE) AND Status = 'COMPLETED') AS completed,

      (SELECT ISNULL(SUM(x.FinalAmount), 0)
 FROM (
   SELECT DISTINCT i.InvoiceId, i.FinalAmount
   FROM Appointments a
   JOIN Invoices i ON a.AppointmentId = i.AppointmentId
   JOIN Payments p ON i.InvoiceId = p.InvoiceId
   WHERE a.EmployeeId = @EmployeeId
     AND a.AppointmentDate = CAST(GETDATE() AS DATE)
     AND p.Status = 'PAID'
 ) x) AS todayRevenue,

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
  u.AvatarUrl AS CustomerAvatar,
  STRING_AGG(s.ServiceName, ', ') AS ServiceName
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.EmployeeId = @EmployeeId
    AND a.AppointmentDate = CAST(GETDATE() AS DATE)
    GROUP BY a.AppointmentId, a.StartTime, a.EndTime, a.Status, u.FullName, u.AvatarUrl
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
      u.FullName AS CustomerName,
      u.AvatarUrl AS CustomerAvatar
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

  const todayShift = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId).query(`
      SELECT TOP 1
        ws.ShiftId,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        ws.ShiftName AS ShiftType,
        CAST(0 AS BIT) AS IsDayOff,
        NULL AS Notes
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @EmployeeId
        AND sr.Status = 'APPROVED'
        AND ws.ShiftDate = CAST(GETDATE() AS DATE)
    `);

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startOfWeekStr = monday.toISOString().slice(0, 10);
  const endOfWeekStr = sunday.toISOString().slice(0, 10);

  const weeklySchedule = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("StartOfWeek", sql.Date, startOfWeekStr)
    .input("EndOfWeek", sql.Date, endOfWeekStr)
    .query(`
      SELECT 
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        ws.ShiftName AS ShiftType
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
        AND ws.ShiftDate BETWEEN @StartOfWeek AND @EndOfWeek
      ORDER BY ws.ShiftDate ASC
    `);

  const todayAttendance = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT TOP 1
        AttendanceId,
        CONVERT(VARCHAR(5), CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), CheckOutTime, 108) AS CheckOutTime,
        Status,
        CheckInTime AS RawCheckInTime
      FROM Attendance
      WHERE TechnicianId = @EmployeeId
        AND CAST(CheckInTime AS DATE) = CAST(GETDATE() AS DATE)
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
    todayShift: todayShift.recordset[0] || null,
    weeklySchedule: weeklySchedule.recordset,
    todayAttendance: todayAttendance.recordset[0] || null,
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
      SELECT DISTINCT s.ServiceId, s.ServiceName, s.DurationMinutes AS Duration
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
        ws.ShiftId,
        sr.TechnicianId AS EmployeeId,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        NULL AS BreakTimeMinutes,
        ws.ShiftName AS ShiftType,
        CAST(0 AS BIT) AS IsDayOff,
        NULL AS Notes,
        a.AttendanceId,
        CONVERT(VARCHAR(5), a.CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), a.CheckOutTime, 108) AS CheckOutTime,
        a.Status AS AttendanceStatus,
        0 AS OvertimeMinutes,
        NULL AS ServiceNames
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      LEFT JOIN Attendance a ON ws.ShiftId = a.ShiftId AND a.TechnicianId = sr.TechnicianId
      WHERE sr.TechnicianId = @EmployeeId
        AND sr.Status = 'APPROVED'
        AND ws.ShiftDate BETWEEN @StartDate AND @EndDate
      ORDER BY ws.ShiftDate, ws.StartTime;
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

async function getAvailableSlotsForTechnician(userId, query = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const date = query.date || new Date().toISOString().slice(0, 10);
  const duration = Number(query.duration || 60);

  // 1. Get working hours for the technician
  const shiftResult = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentDate", sql.Date, date).query(`
      SELECT TOP 1
        CONVERT(VARCHAR(8), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), ws.EndTime, 108) AS EndTime,
        CAST(0 AS BIT) AS IsDayOff
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @EmployeeId
        AND ws.ShiftDate = @AppointmentDate
        AND sr.Status = 'APPROVED'
      ORDER BY ws.ShiftId DESC
    `);

  let shiftStart = "08:00:00";
  let shiftEnd = "20:00:00"; // Default to full salon hours

  if (shiftResult.recordset[0] && !shiftResult.recordset[0].IsDayOff) {
    shiftStart = shiftResult.recordset[0].StartTime;
    shiftEnd = shiftResult.recordset[0].EndTime;
  }

  // 2. Fetch existing non-cancelled appointments and waiting list holds
  const bookedResult = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentDate", sql.Date, date).query(`
      SELECT
        CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), EndTime, 108) AS EndTime
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @AppointmentDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED', 'REFUND_PENDING')
      UNION ALL
      SELECT
        CONVERT(VARCHAR(8), MatchedStartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), MatchedEndTime, 108) AS EndTime
      FROM WaitingList
      WHERE MatchedEmployeeId = @EmployeeId
        AND MatchedDate = @AppointmentDate
        AND Status = 'MATCHED'
        AND HoldExpiresAt > GETUTCDATE()
    `);

  const booked = bookedResult.recordset.map((item) => ({
    start: item.StartTime,
    end: item.EndTime,
  }));

  // 3. Helper to add minutes
  const addMinutes = (timeStr, mins) => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    d.setMinutes(d.getMinutes() + mins);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const slots = [];
  let current = shiftStart.slice(0, 5);

  // 4. Generate slots stepping by 30 mins
  while (current < shiftEnd.slice(0, 5)) {
    const slotStart = current + ":00";
    const slotEnd = addMinutes(slotStart, duration);

    if (slotEnd <= shiftEnd) {
      const isBusy = booked.some((b) => slotStart < b.end && slotEnd > b.start);
      const slotDateTime = new Date(`${date}T${slotStart.slice(0, 5)}:00`);
      const isPast = slotDateTime.getTime() <= Date.now();

      if (!isBusy && !isPast) {
        slots.push({
          startTime: slotStart.slice(0, 5),
          endTime: slotEnd.slice(0, 5),
        });
      }
    }
    current = addMinutes(slotStart, 30).slice(0, 5);
  }

  return {
    date,
    technicianId: employeeId,
    durationMinutes: duration,
    isDayOff: false,
    slots,
  };
}

async function startAppointment(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const currentResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT Status, AppointmentDate, StartTime
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
    `);

  const current = currentResult.recordset[0];
  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn của kỹ thuật viên này");
  }

  // Validate state transition
  appointmentStateService.validateTransition(current.Status, "IN_PROGRESS");

  const result = await pool
    .request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("UserId", sql.Int, userId)
    .input("OldStatus", sql.NVarChar, current.Status).query(`
      UPDATE Appointments
      SET Status = 'IN_PROGRESS',
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId;

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

async function getAppointmentByIdInternal(pool, id) {
  const result = await pool.request().input("AppointmentId", sql.Int, id)
    .query(`
    SELECT
      a.AppointmentId,
      a.CustomerId,
      a.EmployeeId AS TechnicianId,
      a.AppointmentDate,
      a.Status,
      cu.FullName AS CustomerName,
      cu.Email AS CustomerEmail,
      cu.Phone AS CustomerPhone,
      eu.FullName AS TechnicianName,
      COALESCE(i.InvoiceId, NULL) AS InvoiceId,
      COALESCE(i.FinalAmount, 0) AS FinalAmount,
      a.CustomerPackageId
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Users cu ON c.UserId = cu.UserId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    WHERE a.AppointmentId = @AppointmentId
    `);
  return result.recordset[0];
}

async function finalizeCheckoutInternal(pool, id, userId = null) {
  const current = await getAppointmentByIdInternal(pool, id);
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
    .query(`SELECT ServiceId, Price FROM AppointmentServices WHERE AppointmentId = @AppointmentId`);
  const apptServices = servicesResult.recordset || [];

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

async function completeAppointment(userId, appointmentId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const currentResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("EmployeeId", sql.Int, employeeId).query(`
        SELECT
          a.AppointmentId,
          a.EmployeeId,
          a.Status,
          a.CustomerPackageId,
          aps.ServiceId
        FROM Appointments a
        LEFT JOIN AppointmentServices aps
          ON a.AppointmentId = aps.AppointmentId
        WHERE a.AppointmentId = @AppointmentId
          AND a.EmployeeId = @EmployeeId
      `);

    const current = currentResult.recordset[0];

    if (!current) {
      throw new Error("Không tìm thấy lịch hẹn của kỹ thuật viên này");
    }

    // Validate state transition using state machine service
    appointmentStateService.validateTransition(current.Status, "COMPLETED");

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("EmployeeId", sql.Int, employeeId).query(`
        UPDATE Appointments
        SET Status = 'COMPLETED',
            CompletedAt = GETDATE(),
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
          AND EmployeeId = @EmployeeId
          AND Status = 'IN_PROGRESS'
      `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("OldStatus", sql.NVarChar, current.Status)
      .input("UserId", sql.Int, userId).query(`
        INSERT INTO AppointmentStatusHistory
          (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES
          (@AppointmentId, @OldStatus, 'COMPLETED', @UserId, N'Technician hoàn thành dịch vụ', GETDATE())
      `);

    // Calculate commission breakdown and total commission using ServiceCommissions rules
    const apptServicesResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .query(`
        SELECT aps.ServiceId, aps.Price, COALESCE(sc.CommissionRate, 0.15) AS CommissionRate
        FROM AppointmentServices aps
        LEFT JOIN ServiceCommissions sc ON aps.ServiceId = sc.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
      `);

    const services = apptServicesResult.recordset;

    // Clear any existing earnings for this appointment to ensure idempotency
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .query("DELETE FROM TechnicianServiceEarnings WHERE AppointmentId = @AppointmentId");

    let totalCommissionAmount = 0;

    for (const svc of services) {
      const price = Number(svc.Price || 0);
      const rate = Number(svc.CommissionRate || 0.15);
      const earningAmount = price * rate;
      totalCommissionAmount += earningAmount;

      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, Number(appointmentId))
        .input("EmployeeId", sql.Int, employeeId)
        .input("ServiceId", sql.Int, svc.ServiceId)
        .input("ServicePrice", sql.Decimal(18, 2), price)
        .input("CommissionRate", sql.Decimal(5, 2), rate)
        .input("EarningAmount", sql.Decimal(18, 2), earningAmount)
        .query(`
          INSERT INTO TechnicianServiceEarnings
          (AppointmentId, EmployeeId, ServiceId, ServicePrice, CommissionRate, EarningAmount, CreatedAt)
          VALUES
          (@AppointmentId, @EmployeeId, @ServiceId, @ServicePrice, @CommissionRate, @EarningAmount, GETDATE())
        `);
    }

    // Update invoice & earnings if invoice exists
    const invoiceResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .query(`
        SELECT InvoiceId
        FROM Invoices
        WHERE AppointmentId = @AppointmentId
      `);

    const invoice = invoiceResult.recordset[0];
    if (invoice) {
      // Update invoice status, commission rate (set to default 0.15 for compatibility) and aggregated commission amount
      await new sql.Request(transaction)
        .input("InvoiceId", sql.Int, invoice.InvoiceId)
        .input("CommissionAmount", sql.Decimal(18, 2), totalCommissionAmount)
        .query(`
          UPDATE Invoices
          SET Status = 'PAID',
              TechnicianCommissionAmount = @CommissionAmount,
              UpdatedAt = GETDATE()
          WHERE InvoiceId = @InvoiceId
        `);

      // Update or insert technician payout ledger record for earnings
      const ledgerCheck = await new sql.Request(transaction)
        .input("EmployeeId", sql.Int, employeeId)
        .input("AppointmentId", sql.Int, Number(appointmentId))
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
                CreatedAt = GETDATE()
            WHERE LedgerId = @LedgerId
          `);
      } else {
        await new sql.Request(transaction)
          .input("EmployeeId", sql.Int, employeeId)
          .input("AppointmentId", sql.Int, Number(appointmentId))
          .input("Amount", sql.Decimal(18, 2), totalCommissionAmount)
          .query(`
            INSERT INTO TechnicianPayoutLedger
            (EmployeeId, ReferenceType, ReferenceId, Amount, EntryType, Description, CreatedAt)
            VALUES
            (@EmployeeId, 'APPOINTMENT', @AppointmentId, @Amount, 'EARNING', N'Hoa hồng hoàn thành lịch hẹn #' + CAST(@AppointmentId AS NVARCHAR), GETDATE())
          `);
      }
    }

    if (current.CustomerPackageId) {
      const usageCheck = await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        Number(appointmentId),
      ).query(`
          SELECT TOP 1 UsageId
          FROM CustomerPackageUsages
          WHERE AppointmentId = @AppointmentId
            AND Status = 'USED'
        `);

      if (usageCheck.recordset.length === 0) {
        const packageCheck = await new sql.Request(transaction)
          .input("CustomerPackageId", sql.Int, current.CustomerPackageId)
          .input("ServiceId", sql.Int, current.ServiceId).query(`
            SELECT
              cp.CustomerPackageId,
              cp.RemainingSessions,
              cp.UsedSessions,
              cp.Status,
              cp.EndDate,
              ISNULL(ps.SessionCount, 1) AS MaxSessions,
              (
                SELECT ISNULL(SUM(SessionsUsed), 0)
                FROM CustomerPackageUsages
                WHERE CustomerPackageId = @CustomerPackageId
                  AND ServiceId = @ServiceId
                  AND Status <> 'CANCELLED'
              ) AS UsedCount
            FROM CustomerPackages cp
            JOIN PackageServices ps
              ON cp.PackageId = ps.PackageId
            WHERE cp.CustomerPackageId = @CustomerPackageId
              AND ps.ServiceId = @ServiceId
          `);

        const cp = packageCheck.recordset[0];
        if (!cp) throw new Error("Combo không chứa dịch vụ của lịch hẹn này");
        if (String(cp.Status).toUpperCase() !== "ACTIVE") {
          throw new Error("Combo không còn ở trạng thái ACTIVE");
        }
        if (new Date(cp.EndDate) < new Date(new Date().toDateString())) {
          throw new Error("Combo đã hết hạn, không thể trừ buổi");
        }
        if (Number(cp.RemainingSessions || 0) < 1) {
          throw new Error("Combo không còn đủ số buổi để hoàn thành lịch này");
        }
        if (cp.UsedCount >= cp.MaxSessions) {
          throw new Error(`Dịch vụ này đã dùng hết số buổi quy định trong combo (Tối đa ${cp.MaxSessions} buổi)`);
        }

        await new sql.Request(transaction)
          .input("CustomerPackageId", sql.Int, current.CustomerPackageId)
          .input("AppointmentId", sql.Int, Number(appointmentId))
          .input("ServiceId", sql.Int, current.ServiceId).query(`
            INSERT INTO CustomerPackageUsages
              (CustomerPackageId, AppointmentId, ServiceId, SessionsUsed, Status, UsedAt, UsedBy)
            SELECT @CustomerPackageId, @AppointmentId, @ServiceId, 1, 'USED', GETDATE(), c.UserId
            FROM Appointments a
            JOIN Customers c ON a.CustomerId = c.CustomerId
            WHERE a.AppointmentId = @AppointmentId;

            UPDATE CustomerPackages
            SET
              RemainingSessions = CASE WHEN RemainingSessions > 0 THEN RemainingSessions - 1 ELSE 0 END,
              UsedSessions = UsedSessions + 1,
              Status = CASE
                WHEN RemainingSessions - 1 <= 0 THEN 'USED_UP'
                ELSE 'ACTIVE'
              END,
              UpdatedAt = GETDATE()
            WHERE CustomerPackageId = @CustomerPackageId;
          `);
      }
    }

    const finalResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("EmployeeId", sql.Int, employeeId).query(`
        SELECT *
        FROM Appointments
        WHERE AppointmentId = @AppointmentId
          AND EmployeeId = @EmployeeId
      `);

    await transaction.commit();

    // Event-driven publish for completed appointment
    eventBusService.publish("APPOINTMENT_COMPLETED", {
      appointmentId: Number(appointmentId),
      userId
    });

    // Always finalize checkout and send email upon completion of service
    await finalizeCheckoutInternal(pool, appointmentId, userId);

    return finalResult.recordset[0];
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) { }
    throw err;
  }
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
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Branches b ON COALESCE(a.BranchId, e.BranchId) = b.BranchId
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

  // Lấy thông tin lịch hẹn hiện tại để validate
  const currentResult = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT Status, AppointmentDate, EndTime, CustomerPackageId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
    `);

  const current = currentResult.recordset[0];
  if (!current) {
    throw new Error("Không tìm thấy lịch hẹn của kỹ thuật viên này");
  }

  if (!['CONFIRMED', 'PAID', 'CHECKED_IN'].includes(current.Status)) {
    throw new Error("Chỉ lịch đã xác nhận hoặc đã thanh toán mới được đánh dấu No Show");
  }

  // Kiểm tra lịch đã quá giờ kết thúc
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const apptDate = current.AppointmentDate instanceof Date
    ? current.AppointmentDate.toISOString().slice(0, 10)
    : String(current.AppointmentDate).slice(0, 10);
  const nowTimeStr = now.toTimeString().slice(0, 8);
  const endTimeStr = String(current.EndTime).slice(0, 8);
  const isPast = apptDate < todayStr || (apptDate === todayStr && nowTimeStr > endTimeStr);
  if (!isPast) {
    throw new Error("Chỉ được đánh dấu No-show khi lịch đã quá giờ kết thúc");
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .input("EmployeeId", sql.Int, employeeId)
      .input("UserId", sql.Int, userId)
      .input("OldStatus", sql.NVarChar, current.Status)
      .query(`
        UPDATE Appointments
        SET Status = 'NO_SHOW',
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
          AND EmployeeId = @EmployeeId
          AND Status IN ('CONFIRMED', 'PAID', 'CHECKED_IN');

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

    if (current.CustomerPackageId) {
      await deductComboSession(transaction, appointmentId);
    }

    await transaction.commit();
    return result.recordset[0];
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function upsertTreatmentNote(userId, appointmentId, body) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const finalAppointmentId = Number(appointmentId || body.appointmentId);
  if (!finalAppointmentId) {
    throw new Error("Thiếu AppointmentId");
  }

  const content = String(body.content || "").trim();
  if (!content) {
    throw new Error("Nội dung ghi chú không được để trống");
  }

  // Validate appointment exists, is assigned to this employee, and status is CONFIRMED, CHECKED_IN, IN_PROGRESS or COMPLETED
  const check = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("AppointmentId", sql.Int, finalAppointmentId).query(`
      SELECT AppointmentId
      FROM Appointments
      WHERE AppointmentId = @AppointmentId
        AND EmployeeId = @EmployeeId
        AND Status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
    `);

  if (!check.recordset[0]) {
    throw new Error("Bạn không có quyền ghi chú lịch hẹn này hoặc trạng thái lịch không hợp lệ");
  }

  // Check if a treatment note already exists for this appointment
  const noteCheck = await pool
    .request()
    .input("AppointmentId", sql.Int, finalAppointmentId)
    .query(`
      SELECT NoteId
      FROM TreatmentNotes
      WHERE AppointmentId = @AppointmentId
    `);

  const existingNote = noteCheck.recordset[0];
  let noteId = existingNote ? existingNote.NoteId : null;

  const title = String(body.title || "Treatment Note").trim();
  const noteType = body.noteType || "General Notes";

  const request = pool.request()
    .input("AppointmentId", sql.Int, finalAppointmentId)
    .input("EmployeeId", sql.Int, employeeId)
    .input("Title", sql.NVarChar(150), title)
    .input("Content", sql.NVarChar(sql.MAX), content)
    .input("NoteType", sql.NVarChar(50), noteType)
    .input("ProductsUsed", sql.NVarChar(sql.MAX), body.productsUsed || null)
    .input("SkinCondition", sql.NVarChar(sql.MAX), body.skinCondition || null)
    .input("Technique", sql.NVarChar(sql.MAX), body.technique || null)
    .input("CustomerFeedback", sql.NVarChar(sql.MAX), body.customerFeedback || null)
    .input("Recommendation", sql.NVarChar(sql.MAX), body.recommendation || null)
    .input("FollowUpDate", sql.Date, body.followUpDate || null)
    .input("ProgressStatus", sql.NVarChar(30), body.progressStatus || "IN_PROGRESS")
    .input("PersonalNotes", sql.NVarChar(sql.MAX), body.personalNotes || null)
    .input("SpecialNotice", sql.NVarChar(sql.MAX), body.specialNotice || null);

  let noteResult;
  if (noteId) {
    // Note exists, UPDATE it
    noteResult = await request.input("NoteId", sql.Int, noteId).query(`
      UPDATE TreatmentNotes
      SET Title = @Title,
          Content = @Content,
          NoteType = @NoteType,
          ProductsUsed = @ProductsUsed,
          SkinCondition = @SkinCondition,
          Technique = @Technique,
          CustomerFeedback = @CustomerFeedback,
          Recommendation = @Recommendation,
          FollowUpDate = @FollowUpDate,
          ProgressStatus = @ProgressStatus,
          PersonalNotes = @PersonalNotes,
          SpecialNotice = @SpecialNotice,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE NoteId = @NoteId;
    `);
  } else {
    // Note does not exist, INSERT it
    noteResult = await request.query(`
      INSERT INTO TreatmentNotes
      (
        AppointmentId, EmployeeId, Title, Content, NoteType,
        ProductsUsed, SkinCondition, Technique, CustomerFeedback,
        Recommendation, FollowUpDate, ProgressStatus, PersonalNotes, SpecialNotice, CreatedAt, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @AppointmentId, @EmployeeId, @Title, @Content, @NoteType,
        @ProductsUsed, @SkinCondition, @Technique, @CustomerFeedback,
        @Recommendation, @FollowUpDate, @ProgressStatus, @PersonalNotes, @SpecialNotice, GETDATE(), GETDATE()
      );
    `);
  }

  return noteResult.recordset[0];
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

  // Query latest V2 note to get real skinCondition and recommendations
  const latestV2Result = await pool.request()
    .input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 1 before_condition, products_used, recommendations
      FROM TreatmentNotesV2
      WHERE customer_id = @CustomerId
      ORDER BY service_date_time DESC, created_at DESC
    `);
  const latestV2Note = latestV2Result.recordset[0] || null;

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

  const pkgsResult = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .query(`
      SELECT 
        cp.CustomerPackageId,
        cp.PackageId,
        p.PackageName,
        cp.RemainingSessions,
        cp.Status,
        (
          SELECT STRING_AGG(CAST(ps2.ServiceId AS VARCHAR(20)), ',')
          FROM PackageServices ps2
          WHERE ps2.PackageId = cp.PackageId
            AND (
              COALESCE(ps2.SessionCount, 0) - (
                SELECT COALESCE(SUM(SessionsUsed), 0)
                FROM CustomerPackageUsages
                WHERE CustomerPackageId = cp.CustomerPackageId
                  AND ServiceId = ps2.ServiceId
                  AND Status <> 'CANCELLED'
              ) - (
                SELECT COUNT(*)
                FROM Appointments a2
                JOIN AppointmentServices aps2 ON a2.AppointmentId = aps2.AppointmentId
                WHERE a2.CustomerPackageId = cp.CustomerPackageId
                  AND aps2.ServiceId = ps2.ServiceId
                  AND a2.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
              ) > 0
            )
        ) AS ServiceIds
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerId = @CustomerId AND cp.Status IN ('ACTIVE', 'PENDING_PAYMENT') AND cp.RemainingSessions > 0
    `);

  return {
    customer: customer.recordset[0],
    visits: visits.recordset,
    notes: notesWithAttachments,
    preferences: preferences.recordset,
    reviews: reviews.recordset,
    upcoming: upcoming.recordset,
    beautyProfile: {
      skinCondition: latestV2Note?.before_condition || latestNote?.SkinCondition || null,
      productsUsed: latestV2Note?.products_used || latestNote?.ProductsUsed || null,
      technique: latestNote?.Technique || null,
      recommendation: latestV2Note?.recommendations || latestNote?.Recommendation || null,
      followUpDate: latestNote?.FollowUpDate || null,
      customerFeedback: latestNote?.CustomerFeedback || null,
    },
    timeline,
    packages: pkgsResult.recordset,
  };
}

async function getCustomerInsights(userId, customerId) {
  const pool = await connectDB();
  const id = Number(customerId);

  // 1. Fetch customer profile and salon-wide stats
  const profileResult = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .query(`
      SELECT 
        c.CustomerId,
        CONCAT('#CUST-', FORMAT(c.CustomerId, '000')) AS CustomerCode,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ISNULL(ml.LevelName, 'Normal') AS MembershipLevel,
        (
          SELECT COUNT(DISTINCT a.AppointmentId)
          FROM Appointments a
          WHERE a.CustomerId = c.CustomerId AND a.Status = 'COMPLETED'
        ) AS TotalVisits,
        (
          SELECT ISNULL(SUM(i.FinalAmount), 0)
          FROM Appointments a
          JOIN Invoices i ON a.AppointmentId = i.AppointmentId
          WHERE a.CustomerId = c.CustomerId AND a.Status = 'COMPLETED'
        ) AS TotalSpent,
        (
          SELECT MAX(a.AppointmentDate)
          FROM Appointments a
          WHERE a.CustomerId = c.CustomerId AND a.Status = 'COMPLETED'
        ) AS LastVisit
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE c.CustomerId = @CustomerId
    `);

  const customer = profileResult.recordset[0];
  if (!customer) {
    throw new Error("Không tìm thấy thông tin khách hàng");
  }

  // 2. Classify customer
  const visits = Number(customer.TotalVisits || 0);
  const spent = Number(customer.TotalSpent || 0);

  let type = "New";
  let label = "Khách hàng Mới";
  let color = "#10B981"; // emerald/green

  if (spent >= 5000000 || visits >= 10) {
    type = "VIP";
    label = "Khách hàng VIP";
    color = "#F59E0B"; // amber/gold
  } else if (visits >= 3) {
    type = "Regular";
    label = "Khách hàng Thân thiết";
    color = "#3B82F6"; // blue
  }

  // 3. Fetch top 3 booked services
  const topServicesResult = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 3 
        s.ServiceName, 
        COUNT(aps.AppointmentServiceId) AS BookedCount,
        SUM(aps.Price) AS TotalValue
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.CustomerId = @CustomerId AND a.Status = 'COMPLETED'
      GROUP BY s.ServiceName
      ORDER BY BookedCount DESC, TotalValue DESC
    `);

  // 4. Fetch recent treatment notes (last 3)
  const notesResult = await pool
    .request()
    .input("CustomerId", sql.Int, id)
    .query(`
      SELECT TOP 3 
        tn.NoteId,
        tn.Title,
        tn.Content,
        tn.ProgressStatus,
        tn.CreatedAt,
        u.FullName AS TechnicianName
      FROM TreatmentNotes tn
      JOIN Appointments a ON tn.AppointmentId = a.AppointmentId
      JOIN Employees e ON tn.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE a.CustomerId = @CustomerId
      ORDER BY tn.CreatedAt DESC
    `);

  return {
    customerId: customer.CustomerId,
    fullName: customer.FullName,
    customerCode: customer.CustomerCode,
    email: customer.Email,
    phone: customer.Phone,
    avatarUrl: customer.AvatarUrl,
    gender: customer.Gender,
    membershipLevel: customer.MembershipLevel,
    loyaltyPoints: customer.LoyaltyPoints,
    analytics: {
      totalVisits: visits,
      totalSpent: spent,
      lastVisit: customer.LastVisit ? customer.LastVisit.toISOString().slice(0, 10) : null,
    },
    segmentation: {
      type,
      label,
      color,
    },
    topServices: topServicesResult.recordset,
    recentNotes: notesResult.recordset,
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
        eu.FullName AS EmployeeName,
        eu.AvatarUrl AS EmployeeAvatar,
        tn.NoteId AS NoteId,
        tn.Title AS NoteTitle,
        tn.Content AS CurrentNote,
        tn.NoteType AS NoteType,
        tn.ProductsUsed AS ProductsUsed,
        tn.SkinCondition AS SkinCondition,
        tn.Technique AS Technique,
        tn.CustomerFeedback AS CustomerFeedback,
        tn.Recommendation AS Recommendation,
        tn.PersonalNotes AS PersonalNotes,
        tn.SpecialNotice AS SpecialNotice,
        tn.FollowUpDate AS FollowUpDate,
        tn.ProgressStatus AS ProgressStatus,
        tn.UpdatedAt AS UpdatedAt,
        tn.CreatedAt AS NoteCreatedAt
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
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
        eu.FullName, eu.AvatarUrl,
        tn.NoteId, tn.Title, tn.Content, tn.NoteType, tn.ProductsUsed,
        tn.SkinCondition, tn.Technique, tn.CustomerFeedback, tn.Recommendation,
        tn.PersonalNotes, tn.SpecialNotice,
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

  // 1. Fetch Customer Stats
  const statsResult = await pool
    .request()
    .input("CustomerId", sql.Int, appointment.CustomerId)
    .query(`
      SELECT 
        (
          SELECT COUNT(DISTINCT a.AppointmentId)
          FROM Appointments a
          WHERE a.CustomerId = c.CustomerId AND a.Status = 'COMPLETED'
        ) AS TotalVisits,
        (
          SELECT ISNULL(SUM(i.FinalAmount), 0)
          FROM Appointments a
          JOIN Invoices i ON a.AppointmentId = i.AppointmentId
          JOIN Payments p ON i.InvoiceId = p.InvoiceId
          WHERE a.CustomerId = c.CustomerId AND p.Status = 'PAID'
        ) AS TotalSpent,
        c.LoyaltyPoints,
        (
          SELECT ISNULL(AVG(CAST(r.Rating AS FLOAT)), 5.0)
          FROM Reviews r
          WHERE r.CustomerId = c.CustomerId AND r.Status = 'APPROVED'
        ) AS AverageRating,
        (
          SELECT TOP 1 s2.ServiceName
          FROM Appointments a2
          JOIN AppointmentServices aps2 ON a2.AppointmentId = aps2.AppointmentId
          JOIN Services s2 ON aps2.ServiceId = s2.ServiceId
          WHERE a2.CustomerId = c.CustomerId AND a2.Status = 'COMPLETED'
          GROUP BY s2.ServiceName
          ORDER BY COUNT(*) DESC
        ) AS FavoriteService
      FROM Customers c
      WHERE c.CustomerId = @CustomerId
    `);
  const customerStats = statsResult.recordset[0] || {
    TotalVisits: 0,
    TotalSpent: 0,
    LoyaltyPoints: 0,
    AverageRating: 5.0,
    FavoriteService: null
  };

  // 2. Fetch Active Treatment Plan (Package)
  const packageResult = await pool
    .request()
    .input("CustomerId", sql.Int, appointment.CustomerId)
    .query(`
      SELECT TOP 1
        cp.CustomerPackageId,
        p.PackageName,
        pc.CategoryName,
        p.Description AS PackageDescription,
        cp.StartDate,
        cp.EndDate,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.Status
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      LEFT JOIN PackageCategories pc ON p.PackageCategoryId = pc.PackageCategoryId
      WHERE cp.CustomerId = @CustomerId
      ORDER BY 
        CASE WHEN cp.Status = 'ACTIVE' THEN 1 ELSE 2 END,
        cp.CreatedAt DESC
    `);
  const activePackage = packageResult.recordset[0] || null;

  // 3. Fetch Treatment Plan History (Timeline sessions)
  let treatmentHistory = [];
  if (activePackage) {
    const historyResult = await pool
      .request()
      .input("CustomerPackageId", sql.Int, activePackage.CustomerPackageId)
      .query(`
        SELECT 
          a.AppointmentId,
          a.AppointmentDate,
          CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
          a.Status,
          STRING_AGG(s.ServiceName, ', ') AS ServiceName
        FROM Appointments a
        LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
        LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE a.CustomerPackageId = @CustomerPackageId
        GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.Status
        ORDER BY a.AppointmentDate ASC, a.StartTime ASC
      `);
    treatmentHistory = historyResult.recordset;
  } else {
    // If no package, return recent appointment list
    const historyResult = await pool
      .request()
      .input("CustomerId", sql.Int, appointment.CustomerId)
      .query(`
        SELECT TOP 10
          a.AppointmentId,
          a.AppointmentDate,
          CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
          a.Status,
          STRING_AGG(s.ServiceName, ', ') AS ServiceName
        FROM Appointments a
        LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
        LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE a.CustomerId = @CustomerId
        GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.Status
        ORDER BY a.AppointmentDate DESC, a.StartTime DESC
      `);
    treatmentHistory = historyResult.recordset;
  }

  // 4. Fetch Products Used previously
  const productsResult = await pool
    .request()
    .input("CustomerId", sql.Int, appointment.CustomerId)
    .query(`
      SELECT ProductsUsed
      FROM TreatmentNotes
      WHERE AppointmentId IN (SELECT AppointmentId FROM Appointments WHERE CustomerId = @CustomerId)
        AND ProductsUsed IS NOT NULL
        AND ProductsUsed <> ''
    `);
  
  const productsSet = new Set();
  productsResult.recordset.forEach(row => {
    if (row.ProductsUsed) {
      row.ProductsUsed.split(",").forEach(p => {
        const cleaned = p.trim();
        if (cleaned) productsSet.add(cleaned);
      });
    }
  });
  const productsUsedList = Array.from(productsSet);

  return {
    appointment,
    previousNotes: previousNotes.recordset,
    categories: categories.recordset,
    summary: summary.recordset[0],
    attachments,
    customerStats,
    activePackage,
    treatmentHistory,
    productsUsedList,
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

  const allowed = ["IN_PROGRESS", "COMPLETED", "FOLLOW_UP_REQUIRED"];

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

  const historyResult = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
      SELECT 
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        cu.FullName AS CustomerName,
        s.ServiceName,
        COALESCE(tse.ServicePrice, aps.Price) AS ServicePrice,
        COALESCE(tse.CommissionRate, COALESCE(sc.CommissionRate, 0.15)) AS CommissionRate,
        COALESCE(tse.EarningAmount, aps.Price * COALESCE(sc.CommissionRate, 0.15)) AS CommissionAmount
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      LEFT JOIN ServiceCommissions sc ON s.ServiceId = sc.ServiceId
      LEFT JOIN TechnicianServiceEarnings tse ON a.AppointmentId = tse.AppointmentId AND aps.ServiceId = tse.ServiceId
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN Users cu ON c.UserId = cu.UserId
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
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC;
    `);

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
    totalEarnings: Number(ov.TotalEarnings || 0),
    serviceBreakdown: topServices.recordset,
    earningsHistory: historyResult.recordset,
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
        ) AS "percent",
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
        FORMAT(ws.ShiftDate, 'dddd') AS day,
        CONCAT(
          CONVERT(VARCHAR(5), ws.StartTime, 108),
          ' - ',
          CONVERT(VARCHAR(5), ws.EndTime, 108)
        ) AS time,
        ws.ShiftDate
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @EmployeeId
        AND sr.Status = 'APPROVED'
      ORDER BY ws.ShiftDate DESC
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

  // 1. Validate minimum payout amount (e.g. 50,000 VND)
  const MIN_PAYOUT_AMOUNT = 50000;
  if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
    throw new Error(`Số tiền yêu cầu payout tối thiểu phải là ${MIN_PAYOUT_AMOUNT.toLocaleString()} VND`);
  }

  // 2. Prevent creating request if there is already a PENDING payout request
  const pendingCheck = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT TOP 1 PayoutRequestId
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId AND Status = 'PENDING'
    `);

  if (pendingCheck.recordset[0]) {
    throw new Error("Bạn hiện có một yêu cầu rút tiền đang chờ xử lý");
  }

  // 3. Block duplicate requests in a short window (rate limit logic: 60 seconds)
  const lastRequestCheck = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT TOP 1 RequestedAt
      FROM TechnicianPayoutRequests
      WHERE EmployeeId = @EmployeeId
      ORDER BY RequestedAt DESC, PayoutRequestId DESC
    `);

  if (lastRequestCheck.recordset[0]) {
    const lastTime = new Date(lastRequestCheck.recordset[0].RequestedAt);
    const diffSeconds = (new Date() - lastTime) / 1000;
    if (diffSeconds < 60) {
      throw new Error("Yêu cầu rút tiền quá nhanh. Vui lòng đợi 1 phút trước khi thử lại");
    }
  }

  // 4. Verify available balance
  const earningData = await getEarnings(userId, { range: "year" });
  const availableBalance = Number(earningData.payout?.availableBalance || 0);

  if (amount > availableBalance) {
    throw new Error("Số tiền payout vượt quá số dư khả dụng");
  }

  // 5. Create payout request in DB
  const created = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Amount", sql.Decimal(18, 2), amount)
    .input("Note", sql.NVarChar(sql.MAX), note).query(`
      INSERT INTO TechnicianPayoutRequests (EmployeeId, Amount, Note, Status, RequestedAt)
      OUTPUT
        INSERTED.PayoutRequestId,
        INSERTED.Amount,
        INSERTED.Status,
        INSERTED.Note,
        INSERTED.RequestedAt
      VALUES (@EmployeeId, @Amount, @Note, 'PENDING', GETDATE());
    `);

  const newRequest = created.recordset[0];

  // 6. Audit Logging
  const auditMsg = `[AUDIT] [${new Date().toISOString()}] User/Tech ID: ${userId}/${employeeId} requested payout of ${amount} VND. Note: "${note || ''}". PayoutRequestId: ${newRequest.PayoutRequestId}\n`;
  console.log(auditMsg.trim());
  try {
    const fs = require('fs');
    const path = require('path');
    fs.appendFileSync(path.join(__dirname, '../../../payout_audit.log'), auditMsg);
  } catch (err) {
    console.error("Failed to write to payout audit log file:", err.message);
  }

  return newRequest;
}

async function createShift(userId, body = {}) {
  // Bypassed for admin use via this helper
  throw new Error("Vui lòng sử dụng module admin để quản lý ca làm");
}

async function getAvailableShifts(userId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);

  // --- Auto-create default shifts for dates with no shifts in next 30 days ---
  const DEFAULT_SHIFTS = [
    { name: "Cả Ngày",  start: "08:00:00", end: "20:00:00", max: 10 },
    { name: "Ca Sáng",  start: "08:00:00", end: "12:00:00", max: 5  },
    { name: "Ca Chiều", start: "12:00:00", end: "18:00:00", max: 5  },
    { name: "Ca Tối",   start: "18:00:00", end: "20:00:00", max: 5  },
  ];

  // Get all dates in the next 30 days that already have at least 1 WorkShift
  const existingDatesRes = await pool.request().query(`
    SELECT DISTINCT CONVERT(VARCHAR(10), ShiftDate, 23) AS ShiftDate
    FROM WorkShifts
    WHERE ShiftDate >= CAST(GETDATE() AS DATE)
      AND ShiftDate <= CAST(DATEADD(DAY, 30, GETDATE()) AS DATE)
  `);
  const existingDates = new Set(existingDatesRes.recordset.map(r => r.ShiftDate));

  // Build list of dates missing shifts using local date (avoid UTC offset issues)
  const toLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const today = new Date();
  const missingDates = [];
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = toLocalDateStr(d);
    if (!existingDates.has(dateStr)) missingDates.push(dateStr);
  }

  // Auto-insert default shifts for missing dates
  if (missingDates.length > 0) {
    console.log(`[getAvailableShifts] Auto-creating default shifts for ${missingDates.length} dates...`);
    for (const dateStr of missingDates) {
      for (const s of DEFAULT_SHIFTS) {
        try {
          await pool.request()
            .input("ShiftName",      sql.NVarChar(100), s.name)
            .input("ShiftDate",      sql.Date,          dateStr)
            .input("StartTime",      sql.VarChar(15),   s.start)
            .input("EndTime",        sql.VarChar(15),   s.end)
            .input("MaxTechnicians", sql.Int,            s.max)
            .query(`
              INSERT INTO WorkShifts (ShiftName, ShiftDate, StartTime, EndTime, MaxTechnicians, Status, CreatedAt)
              VALUES (@ShiftName, @ShiftDate, @StartTime, @EndTime, @MaxTechnicians, 'OPEN', GETDATE())
            `);
        } catch (insertErr) {
          console.error(`[getAvailableShifts] Failed to insert shift "${s.name}" for ${dateStr}:`, insertErr.message);
        }
      }
    }
    console.log(`[getAvailableShifts] Done auto-creating default shifts.`);
  }
  // -------------------------------------------------------------------------


  const result = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        ws.ShiftId,
        ws.ShiftName,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        ws.MaxTechnicians,
        ws.Status,
        (SELECT COUNT(*) FROM ShiftRegistrations sr WHERE sr.ShiftId = ws.ShiftId AND sr.Status = 'APPROVED') AS RegisteredCount,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM ShiftRegistrations sr 
          WHERE sr.ShiftId = ws.ShiftId AND sr.TechnicianId = @TechnicianId AND sr.Status = 'APPROVED'
        ) OR (ws.ShiftName <> N'Cả Ngày' AND EXISTS (
          SELECT 1 FROM Appointments a
          WHERE a.EmployeeId = @TechnicianId
            AND a.AppointmentDate = ws.ShiftDate
            AND a.Status NOT IN ('CANCELLED', 'NO_SHOW')
            AND CONVERT(VARCHAR(5), a.StartTime, 108) >= CONVERT(VARCHAR(5), ws.StartTime, 108)
            AND CONVERT(VARCHAR(5), a.StartTime, 108) < CONVERT(VARCHAR(5), ws.EndTime, 108)
        )) THEN 1 ELSE 0 END AS BIT) AS IsRegistered
      FROM WorkShifts ws
      WHERE ws.ShiftDate >= CAST(GETDATE() AS DATE)
      ORDER BY ws.ShiftDate ASC, ws.StartTime ASC
    `);

  const capableServicesRes = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT s.ServiceId, s.ServiceName
      FROM EmployeeServices es
      JOIN Services s ON es.ServiceId = s.ServiceId
      WHERE es.EmployeeId = @TechnicianId
      ORDER BY s.ServiceName
    `);

  return {
    shifts: result.recordset,
    capableServices: capableServicesRes.recordset
  };
}


async function registerShift(userId, shiftId, serviceIds = []) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);

  // 1. Get shift details
  const shiftRes = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .query("SELECT * FROM WorkShifts WHERE ShiftId = @ShiftId");
  
  const shift = shiftRes.recordset[0];
  if (!shift) throw new Error("Ca làm không tồn tại");
  if (shift.Status === 'CLOSED') throw new Error("Ca làm đã đóng, không thể đăng ký");

  // 2. Check if shift date has passed
  const now = new Date();
  const shiftDateStr = shift.ShiftDate.toISOString().slice(0, 10);
  const startStr = shift.StartTime.toISOString ? shift.StartTime.toISOString().slice(11, 19) : String(shift.StartTime);
  const shiftDateTime = new Date(`${shiftDateStr}T${startStr}`);
  if (shiftDateTime < now) {
    throw new Error("Không thể đăng ký ca làm trong quá khứ");
  }

  // 3. Check current registered count (Bypassed per request)

  // 4. Check overlapping shift registrations
  const overlapRes = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .input("ShiftDate", sql.Date, shift.ShiftDate)
    .input("StartTime", sql.Time, shift.StartTime)
    .input("EndTime", sql.Time, shift.EndTime)
    .query(`
      SELECT sr.RegistrationId 
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @TechnicianId
        AND ws.ShiftDate = @ShiftDate
        AND sr.Status = 'APPROVED'
        AND (@StartTime < ws.EndTime AND @EndTime > ws.StartTime)
    `);
  
  if (overlapRes.recordset[0]) {
    throw new Error("Bạn đã đăng ký một ca trực khác trùng thời gian trong ngày này");
  }

  // 5. Update or insert approved registration
  await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      MERGE INTO ShiftRegistrations AS target
      USING (SELECT @ShiftId AS ShiftId, @TechnicianId AS TechnicianId) AS source
      ON (target.ShiftId = source.ShiftId AND target.TechnicianId = source.TechnicianId)
      WHEN MATCHED THEN
        UPDATE SET Status = 'APPROVED'
      WHEN NOT MATCHED THEN
        INSERT (ShiftId, TechnicianId, Status) VALUES (@ShiftId, @TechnicianId, 'APPROVED');
    `);

  const regResult = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT RegistrationId 
      FROM ShiftRegistrations 
      WHERE ShiftId = @ShiftId AND TechnicianId = @TechnicianId;
    `);

  const registrationId = regResult.recordset[0].RegistrationId;

  // Clear and save selected services
  await pool.request()
    .input("RegistrationId", sql.Int, registrationId)
    .query("DELETE FROM ShiftRegistrationServices WHERE RegistrationId = @RegistrationId");

  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    for (const sId of serviceIds) {
      await pool.request()
        .input("RegistrationId", sql.Int, registrationId)
        .input("ServiceId", sql.Int, Number(sId))
        .query("INSERT INTO ShiftRegistrationServices (RegistrationId, ServiceId) VALUES (@RegistrationId, @ServiceId)");
    }
  }

  return { message: "Đăng ký ca trực thành công" };
}

async function cancelRegistration(userId, shiftId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);

  // Check if there are any booked appointments during this shift
  const shiftRes = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .query("SELECT * FROM WorkShifts WHERE ShiftId = @ShiftId");
  const shift = shiftRes.recordset[0];
  if (shift) {
    const shiftDateStr = shift.ShiftDate.toISOString().slice(0, 10);
    const startStr = shift.StartTime.toISOString ? shift.StartTime.toISOString().slice(11, 19) : String(shift.StartTime);
    const endStr = shift.EndTime.toISOString ? shift.EndTime.toISOString().slice(11, 19) : String(shift.EndTime);

    const apptsRes = await pool.request()
      .input("TechnicianId", sql.Int, technicianId)
      .input("ShiftDate", sql.Date, shiftDateStr)
      .input("StartTime", sql.VarChar, startStr)
      .input("EndTime", sql.VarChar, endStr)
      .query(`
        SELECT TOP 1 AppointmentId
        FROM Appointments
        WHERE EmployeeId = @TechnicianId
          AND AppointmentDate = @ShiftDate
          AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED', 'REFUND_PENDING')
          AND (
            (CONVERT(VARCHAR(8), StartTime, 108) >= CONVERT(VARCHAR(8), @StartTime, 108) AND CONVERT(VARCHAR(8), StartTime, 108) < CONVERT(VARCHAR(8), @EndTime, 108))
            OR
            (CONVERT(VARCHAR(8), EndTime, 108) > CONVERT(VARCHAR(8), @StartTime, 108) AND CONVERT(VARCHAR(8), EndTime, 108) <= CONVERT(VARCHAR(8), @EndTime, 108))
          )
      `);
    
    if (apptsRes.recordset[0]) {
      throw new Error("Không thể huỷ ca trực này vì đã có lịch hẹn của khách hàng đặt trước. Vui lòng liên hệ Lễ tân để điều phối lịch hẹn trước khi huỷ ca.");
    }
  }

  const result = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      UPDATE ShiftRegistrations 
      SET Status = 'CANCELLED' 
      WHERE ShiftId = @ShiftId AND TechnicianId = @TechnicianId AND Status = 'APPROVED'
    `);

  if (result.rowsAffected[0] === 0) {
    throw new Error("Không tìm thấy ca đã đăng ký hoặc ca trực đã bị huỷ trước đó");
  }

  // Set shift status back to OPEN
  await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .query(`
      UPDATE WorkShifts 
      SET Status = 'OPEN' 
      WHERE ShiftId = @ShiftId AND Status = 'FULL'
    `);

  return { message: "Huỷ đăng ký ca trực thành công" };
}

async function getMyShifts(userId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);
  const result = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        ws.ShiftId,
        ws.ShiftName,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        ws.MaxTechnicians,
        ws.Status AS ShiftStatus,
        COALESCE(sr.Status, 'APPROVED') AS RegistrationStatus,
        sr.RegistrationId,
        a.AttendanceId,
        CONVERT(VARCHAR(5), a.CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), a.CheckOutTime, 108) AS CheckOutTime,
        a.Status AS AttendanceStatus
      FROM WorkShifts ws
      LEFT JOIN ShiftRegistrations sr ON ws.ShiftId = sr.ShiftId AND sr.TechnicianId = @TechnicianId
      LEFT JOIN Attendance a ON ws.ShiftId = a.ShiftId AND a.TechnicianId = @TechnicianId
      WHERE (sr.TechnicianId = @TechnicianId AND sr.Status = 'APPROVED')
         OR (ws.ShiftName <> N'Cả Ngày' AND EXISTS (
          SELECT 1 FROM Appointments app
          WHERE app.EmployeeId = @TechnicianId
            AND app.AppointmentDate = ws.ShiftDate
            AND app.Status NOT IN ('CANCELLED', 'NO_SHOW')
            AND CONVERT(VARCHAR(5), app.StartTime, 108) >= CONVERT(VARCHAR(5), ws.StartTime, 108)
            AND CONVERT(VARCHAR(5), app.StartTime, 108) < CONVERT(VARCHAR(5), ws.EndTime, 108)
        ))
      ORDER BY ws.ShiftDate DESC, ws.StartTime ASC
    `);
  return result.recordset;
}

async function getOrCreateTodayShiftForTechnician(pool, technicianId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Find or create default today shift in WorkShifts
  let shiftRes = await pool.request()
    .input("ShiftDate", sql.Date, todayStr)
    .query("SELECT TOP 1 ShiftId FROM WorkShifts WHERE ShiftDate = @ShiftDate AND Status = 'OPEN'");

  let shiftId;
  if (shiftRes.recordset.length > 0) {
    shiftId = shiftRes.recordset[0].ShiftId;
  } else {
    const newShiftRes = await pool.request()
      .input("ShiftName", sql.NVarChar, "Ca Ngày (08:00 - 20:00)")
      .input("ShiftDate", sql.Date, todayStr)
      .input("StartTime", sql.NVarChar, "08:00:00")
      .input("EndTime", sql.NVarChar, "20:00:00")
      .query(`
        INSERT INTO WorkShifts (ShiftName, ShiftDate, StartTime, EndTime, MaxTechnicians, Status, CreatedAt)
        OUTPUT INSERTED.ShiftId
        VALUES (@ShiftName, @ShiftDate, @StartTime, @EndTime, 50, 'OPEN', GETDATE())
      `);
    shiftId = newShiftRes.recordset[0].ShiftId;
  }

  // Ensure technician is registered for this shift
  await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM ShiftRegistrations WHERE ShiftId = @ShiftId AND TechnicianId = @TechnicianId)
      BEGIN
        INSERT INTO ShiftRegistrations (ShiftId, TechnicianId, Status, CreatedAt)
        VALUES (@ShiftId, @TechnicianId, 'APPROVED', GETDATE())
      END
    `);

  return shiftId;
}

async function checkIn(userId, shiftId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);

  if (!shiftId) {
    shiftId = await getOrCreateTodayShiftForTechnician(pool, technicianId);
  } else {
    await pool.request()
      .input("ShiftId", sql.Int, shiftId)
      .input("TechnicianId", sql.Int, technicianId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ShiftRegistrations WHERE ShiftId = @ShiftId AND TechnicianId = @TechnicianId)
        BEGIN
          INSERT INTO ShiftRegistrations (ShiftId, TechnicianId, Status, CreatedAt)
          VALUES (@ShiftId, @TechnicianId, 'APPROVED', GETDATE())
        END
      `);
  }

  // Prevent duplicate active checkin
  const attRes = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query("SELECT TOP 1 * FROM Attendance WHERE TechnicianId = @TechnicianId AND Status = 'ACTIVE' ORDER BY AttendanceId DESC");

  if (attRes.recordset[0]) {
    throw new Error("Bạn đang trong ca trực rồi. Vui lòng check-out trước khi check-in ca mới!");
  }

  // Perform checkin
  const insertRes = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .input("ShiftId", sql.Int, shiftId)
    .query(`
      INSERT INTO Attendance (TechnicianId, ShiftId, CheckInTime, Status)
      OUTPUT 
        INSERTED.AttendanceId,
        CONVERT(VARCHAR(5), INSERTED.CheckInTime, 108) AS CheckInTime,
        INSERTED.Status
      VALUES (@TechnicianId, @ShiftId, GETDATE(), 'ACTIVE')
    `);

  return {
    message: "Check-in ca trực thành công!",
    attendance: insertRes.recordset[0]
  };
}

async function checkOut(userId, shiftId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);

  let query = "SELECT TOP 1 * FROM Attendance WHERE TechnicianId = @TechnicianId AND Status = 'ACTIVE'";
  const req = pool.request().input("TechnicianId", sql.Int, technicianId);
  if (shiftId) {
    query += " AND ShiftId = @ShiftId";
    req.input("ShiftId", sql.Int, shiftId);
  }
  query += " ORDER BY AttendanceId DESC";

  const attRes = await req.query(query);
  const att = attRes.recordset[0];

  if (!att) {
    throw new Error("Bạn chưa check-in hoặc ca trực hôm nay đã kết thúc.");
  }

  // Perform checkout & calculate hours
  const checkOutTime = new Date();
  const checkInTime = new Date(att.CheckInTime);
  const diffMs = checkOutTime - checkInTime;
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const totalHours = Number((diffMins / 60).toFixed(2));

  const updateRes = await pool.request()
    .input("AttendanceId", sql.Int, att.AttendanceId)
    .input("TotalHours", sql.Decimal(5, 2), totalHours)
    .query(`
      UPDATE Attendance
      SET CheckOutTime = GETDATE(),
          TotalHours = @TotalHours,
          Status = 'COMPLETED'
      OUTPUT 
        INSERTED.AttendanceId,
        CONVERT(VARCHAR(5), INSERTED.CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), INSERTED.CheckOutTime, 108) AS CheckOutTime,
        INSERTED.TotalHours,
        INSERTED.Status
      WHERE AttendanceId = @AttendanceId
    `);

  return {
    message: "Check-out ca trực thành công!",
    attendance: updateRes.recordset[0]
  };
}

async function getMyAttendance(userId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);
  const result = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        a.AttendanceId,
        a.ShiftId,
        ws.ShiftName,
        ws.ShiftDate,
        CONVERT(VARCHAR(5), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ws.EndTime, 108) AS EndTime,
        CONVERT(VARCHAR(5), a.CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), a.CheckOutTime, 108) AS CheckOutTime,
        a.TotalHours,
        a.Status
      FROM Attendance a
      JOIN WorkShifts ws ON a.ShiftId = ws.ShiftId
      WHERE a.TechnicianId = @TechnicianId
      ORDER BY ws.ShiftDate DESC, a.CheckInTime DESC
    `);
  return result.recordset;
}

async function getAttendanceByShift(userId, shiftId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);
  const result = await pool.request()
    .input("ShiftId", sql.Int, shiftId)
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        a.AttendanceId,
        a.ShiftId,
        CONVERT(VARCHAR(5), a.CheckInTime, 108) AS CheckInTime,
        CONVERT(VARCHAR(5), a.CheckOutTime, 108) AS CheckOutTime,
        a.TotalHours,
        a.Status
      FROM Attendance a
      WHERE a.ShiftId = @ShiftId AND a.TechnicianId = @TechnicianId
    `);
  return result.recordset[0] || null;
}

async function getWeeklyTimesheet(userId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);
  
  const result = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        ws.ShiftDate,
        SUM(ISNULL(a.TotalHours, 0)) AS TotalHours,
        COUNT(a.AttendanceId) AS ShiftsCompleted
      FROM Attendance a
      JOIN WorkShifts ws ON a.ShiftId = ws.ShiftId
      WHERE a.TechnicianId = @TechnicianId
        AND a.Status = 'COMPLETED'
        AND ws.ShiftDate BETWEEN DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))
                             AND DATEADD(DAY, 7 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))
      GROUP BY ws.ShiftDate
      ORDER BY ws.ShiftDate ASC
    `);
  return result.recordset;
}

async function getMonthlyTimesheet(userId) {
  const pool = await connectDB();
  const technicianId = await getEmployeeIdByUserId(userId);
  
  const result = await pool.request()
    .input("TechnicianId", sql.Int, technicianId)
    .query(`
      SELECT 
        ws.ShiftDate,
        SUM(ISNULL(a.TotalHours, 0)) AS TotalHours,
        COUNT(a.AttendanceId) AS ShiftsCompleted
      FROM Attendance a
      JOIN WorkShifts ws ON a.ShiftId = ws.ShiftId
      WHERE a.TechnicianId = @TechnicianId
        AND a.Status = 'COMPLETED'
        AND MONTH(ws.ShiftDate) = MONTH(GETDATE())
        AND YEAR(ws.ShiftDate) = YEAR(GETDATE())
      GROUP BY ws.ShiftDate
      ORDER BY ws.ShiftDate ASC
    `);
  return result.recordset;
}

// Kept for booking modal
async function createAppointment(userId, body) {
  const employeeId = await getEmployeeIdByUserId(userId);
  const payload = {
    ...body,
    technicianId: employeeId
  };
  return receptionistService.createAppointment(payload, userId);
}

// Bypassed for clean schedule display
async function getShiftQuotas(date) {
  return {
    MORNING: { registered: 0, limit: 6 },
    AFTERNOON: { registered: 0, limit: 6 },
    EVENING: { registered: 0, limit: 6 }
  };
}

async function getAttendanceWeeklyStats(userId) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const now = new Date();
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startOfWeek = monday.toISOString().slice(0, 10);
  const endOfWeek = sunday.toISOString().slice(0, 10);

  // Shifts count registered this week
  const regRes = await pool.request()
    .input("TechnicianId", sql.Int, employeeId)
    .input("Start", sql.Date, startOfWeek)
    .input("End", sql.Date, endOfWeek)
    .query(`
      SELECT COUNT(*) AS RegCount 
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @TechnicianId AND sr.Status = 'APPROVED'
        AND ws.ShiftDate BETWEEN @Start AND @End
    `);
  const registeredCount = regRes.recordset[0]?.RegCount || 0;

  // Completed shifts having attendance
  const attRes = await pool.request()
    .input("TechnicianId", sql.Int, employeeId)
    .input("Start", sql.Date, startOfWeek)
    .input("End", sql.Date, endOfWeek)
    .query(`
      SELECT COUNT(*) AS CompletedCount, SUM(ISNULL(a.TotalHours, 0)) AS TotalHours
      FROM Attendance a
      JOIN WorkShifts ws ON a.ShiftId = ws.ShiftId
      WHERE a.TechnicianId = @TechnicianId AND a.Status = 'COMPLETED'
        AND ws.ShiftDate BETWEEN @Start AND @End
    `);
  const completedCount = attRes.recordset[0]?.CompletedCount || 0;
  const totalHours = attRes.recordset[0]?.TotalHours || 0;

  // Monthly earnings
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const earningsRes = await pool.request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("Start", sql.Date, startOfMonth)
    .input("End", sql.Date, endOfMonth)
    .query(`
      SELECT SUM(ISNULL(i.FinalAmount, sub.TotalPrice) * 0.1) AS Commission
      FROM Appointments a
      LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
      LEFT JOIN (
        SELECT AppointmentId, SUM(Price) AS TotalPrice
        FROM AppointmentServices
        GROUP BY AppointmentId
      ) sub ON a.AppointmentId = sub.AppointmentId
      WHERE a.EmployeeId = @EmployeeId
        AND a.AppointmentDate BETWEEN @Start AND @End
        AND a.Status = 'COMPLETED'
    `);
  const estimatedCommission = earningsRes.recordset[0]?.Commission || 0;
  const baseSalary = 5000000;
  const estimatedEarnings = baseSalary + estimatedCommission;

  return {
    registeredCount,
    completedCount,
    completedPercent: registeredCount > 0 ? Math.round((completedCount / registeredCount) * 100) : 0,
    totalHours: Number(totalHours.toFixed(1)),
    overtimeHours: 0,
    estimatedEarnings
  };
}

async function getReviews(userId, query = {}) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const ratingFilter = query.rating ? Number(query.rating) : null;
  const serviceFilter = query.serviceId ? Number(query.serviceId) : null;

  let conditions = "WHERE r.EmployeeId = @EmployeeId AND r.Status = 'APPROVED'";
  const request = pool.request().input("EmployeeId", sql.Int, employeeId);

  if (ratingFilter) {
    conditions += " AND r.Rating = @Rating";
    request.input("Rating", sql.Int, ratingFilter);
  }

  if (serviceFilter) {
    conditions += " AND r.ServiceId = @ServiceId";
    request.input("ServiceId", sql.Int, serviceFilter);
  }

  const reviewsResult = await request.query(`
    SELECT
      r.ReviewId,
      r.Rating,
      r.TechnicianRating,
      r.Comment,
      r.CreatedAt,
      u.FullName AS CustomerName,
      u.AvatarUrl AS CustomerAvatar,
      s.ServiceName,
      s.ServiceId
    FROM Reviews r
    JOIN Customers c ON r.CustomerId = c.CustomerId
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN Services s ON r.ServiceId = s.ServiceId
    ${conditions}
    ORDER BY r.CreatedAt DESC
  `);

  const reviews = reviewsResult.recordset || [];
  if (reviews.length > 0) {
    const reviewIds = reviews.map(r => r.ReviewId);
    const imagesResult = await pool.request().query(`
      SELECT ReviewImageId, ReviewId, ImageUrl, CreatedAt
      FROM ReviewImages
      WHERE ReviewId IN (${reviewIds.join(",")})
    `);
    
    const imagesMap = {};
    (imagesResult.recordset || []).forEach(img => {
      if (!imagesMap[img.ReviewId]) {
        imagesMap[img.ReviewId] = [];
      }
      imagesMap[img.ReviewId].push(img);
    });

    reviews.forEach(r => {
      r.Images = imagesMap[r.ReviewId] || [];
    });
  }

  const servicesResult = await pool.request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT DISTINCT s.ServiceId, s.ServiceName
      FROM Reviews r
      JOIN Services s ON r.ServiceId = s.ServiceId
      WHERE r.EmployeeId = @EmployeeId AND r.Status = 'APPROVED'
    `);

  const statsResult = await pool.request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT
        COUNT(*) AS TotalCount,
        AVG(CAST(r.Rating AS FLOAT)) AS AvgRating,
        SUM(CASE WHEN r.Rating = 5 THEN 1 ELSE 0 END) AS Stars5,
        SUM(CASE WHEN r.Rating = 4 THEN 1 ELSE 0 END) AS Stars4,
        SUM(CASE WHEN r.Rating = 3 THEN 1 ELSE 0 END) AS Stars3,
        SUM(CASE WHEN r.Rating = 2 THEN 1 ELSE 0 END) AS Stars2,
        SUM(CASE WHEN r.Rating = 1 THEN 1 ELSE 0 END) AS Stars1
      FROM Reviews r
      WHERE r.EmployeeId = @EmployeeId AND r.Status = 'APPROVED'
    `);

  const monthlyStatsResult = await pool.request()
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT 
        YEAR(r.CreatedAt) AS YearVal,
        MONTH(r.CreatedAt) AS MonthVal,
        AVG(CAST(r.Rating AS FLOAT)) AS AvgRating,
        COUNT(*) AS ReviewCount
      FROM Reviews r
      WHERE r.EmployeeId = @EmployeeId 
        AND r.Status = 'APPROVED'
        AND r.CreatedAt >= DATEADD(MONTH, -5, DATEADD(DAY, 1 - DAY(GETDATE()), CAST(GETDATE() AS DATE)))
      GROUP BY YEAR(r.CreatedAt), MONTH(r.CreatedAt)
      ORDER BY YearVal ASC, MonthVal ASC
    `);

  return {
    reviews: reviews,
    services: servicesResult.recordset || [],
    summary: statsResult.recordset[0] || { TotalCount: 0, AvgRating: 0, Stars5: 0, Stars4: 0, Stars3: 0, Stars2: 0, Stars1: 0 },
    monthlyStats: monthlyStatsResult.recordset || [],
  };
}

async function updateAppointmentDuration(userId, appointmentId, durationMinutes) {
  const pool = await connectDB();
  const employeeId = await getEmployeeIdByUserId(userId);

  const duration = Number(durationMinutes);
  if (isNaN(duration) || duration <= 0) {
    throw new Error("Thời lượng dịch vụ phải là số lớn hơn 0");
  }

  const apptRes = await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT StartTime, Status
      FROM Appointments
      WHERE AppointmentId = @AppointmentId AND EmployeeId = @EmployeeId
    `);

  const current = apptRes.recordset[0];
  if (!current) throw new Error("Không tìm thấy lịch hẹn của kỹ thuật viên này");

  const startTimeStr = String(current.StartTime).slice(0, 8);
  const [h, m] = startTimeStr.split(":").map(Number);
  const startDate = new Date(2000, 0, 1, h, m, 0);
  startDate.setMinutes(startDate.getMinutes() + duration);
  const pad = n => String(n).padStart(2, "0");
  const newEndTimeStr = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:00`;

  await pool.request()
    .input("AppointmentId", sql.Int, Number(appointmentId))
    .input("EmployeeId", sql.Int, employeeId)
    .input("EndTime", sql.VarChar, newEndTimeStr)
    .query(`
      UPDATE Appointments
      SET EndTime = @EndTime, UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId AND EmployeeId = @EmployeeId
    `);

  return { message: "Đã cập nhật thời lượng dịch vụ thành công!", durationMinutes: duration, endTime: newEndTimeStr };
}

module.exports = {
  getDashboard,
  getSchedule,
  getAvailableSlotsForTechnician,
  getReviews,
  getCustomersSummary,
  getCustomers,
  getAppointmentsSummary,
  getCustomerDetail,
  getCustomerInsights,
  startAppointment,
  completeAppointment,
  getAppointmentDetail,
  markNoShow,
  upsertTreatmentNote,
  getAppointments,
  getTreatmentNotesPage,
  getCustomerNoteHistory,
  deleteTreatmentNote,
  getEarnings,
  getEarningPayoutHistory,
  createPayoutRequest,
  getProfile,
  updateProfile,
  updateAvatar,
  uploadTreatmentAttachments,
  updateTreatmentProgress,
  createShift,
  getAvailableShifts,
  registerShift,
  cancelRegistration,
  getMyShifts,
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendanceByShift,
  getWeeklyTimesheet,
  getMonthlyTimesheet,
  createAppointment,
  getShiftQuotas,
  getAttendanceWeeklyStats,
  updateAppointmentDuration,
};
