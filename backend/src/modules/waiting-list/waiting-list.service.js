const { sql, connectDB } = require("../../config/db");

const VALID_STATUS = ["WAITING", "MATCHED", "SKIPPED", "EXPIRED", "NOTIFIED", "BOOKED", "CANCELLED"];
const ACTIVE_STATUS = ["WAITING", "MATCHED", "NOTIFIED"];
const VALID_PRIORITY = ["NORMAL", "HIGH", "URGENT"];
const VALID_CONTACT = ["PHONE", "EMAIL", "ZALO", "SMS"];
const VALID_SLOT = ["ANY", "MORNING", "AFTERNOON", "EVENING", "CUSTOM"];

function formatTimeOnly(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const hh = String(val.getUTCHours()).padStart(2, '0');
    const mm = String(val.getUTCMinutes()).padStart(2, '0');
    const ss = String(val.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  if (typeof val === "object") {
    const ms = val.ms !== undefined ? val.ms : val.milliseconds;
    if (typeof ms === "number") {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
  }
  const s = String(val);
  if (s.includes("T")) {
    return s.split("T")[1].slice(0, 8);
  }
  return s.slice(0, 8);
}

function text(value) {
  return String(value || "").trim();
}

function nullableText(value) {
  const v = text(value);
  return v || null;
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeDate(value) {
  const raw = text(value);
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Ngày mong muốn không hợp lệ.");
  }

  return raw;
}

function normalizeTime(value) {
  const raw = text(value);
  if (!raw) return null;

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    throw new Error("Giờ mong muốn không hợp lệ.");
  }

  return raw.length === 5 ? `${raw}:00` : raw;
}

function validateFutureDate(date) {
  if (!date) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = new Date(`${date}T00:00:00`);
  selected.setHours(0, 0, 0, 0);

  if (selected < today) {
    throw new Error("Ngày mong muốn không được nhỏ hơn hôm nay.");
  }

  if (selected.getTime() === today.getTime()) {
    const now = new Date();
    if (now.getHours() >= 21) {
      throw new Error("Thời gian hoạt động trong ngày đã kết thúc. Vui lòng chọn ngày khác.");
    }
  }
}

function validateTimeRange(from, to) {
  if (!from || !to) return;

  if (from >= to) {
    throw new Error("Giờ bắt đầu phải nhỏ hơn giờ kết thúc.");
  }
}

function estimateResponse(priorityLevel, position, preferredDate) {
  if (!preferredDate) return "Trong ngày hẹn (trước 21:00)";

  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStrNormalized = preferredDate instanceof Date
    ? preferredDate.toISOString().slice(0, 10)
    : String(preferredDate).slice(0, 10);

  if (dateStrNormalized === todayStr) {
    return "Trong ngày hôm nay (trước 21:00)";
  }

  // Format to DD/MM/YYYY
  const dateObj = new Date(preferredDate);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `Trong ngày ${day}/${month}/${year} (trước 21:00)`;
}

async function getCustomer(pool, userId) {
  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT TOP 1
      c.CustomerId,
      u.UserId,
      u.FullName,
      u.Email,
      u.Phone,
      u.AvatarUrl
    FROM Customers c
    INNER JOIN Users u ON u.UserId = c.UserId
    WHERE c.UserId = @UserId
  `);

  const customer = result.recordset[0];

  if (!customer) {
    throw new Error("Không tìm thấy hồ sơ khách hàng.");
  }

  return customer;
}

async function getOptions() {
  const pool = await connectDB();

  const services = await pool.request().query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      s.Description,
      s.DurationMinutes,
      s.Price,
      s.ImageUrl,
      s.Status,
      c.CategoryName,
      (
        SELECT COUNT(*)
        FROM EmployeeServices es
        INNER JOIN Employees e ON e.EmployeeId = es.EmployeeId
        WHERE es.ServiceId = s.ServiceId
          AND e.Status = 'ACTIVE'
      ) AS TechnicianCount
    FROM Services s
    LEFT JOIN ServiceCategories c ON c.CategoryId = s.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY s.ServiceName ASC
  `);

  const branches = await pool.request().query(`
    SELECT
      BranchId,
      BranchName,
      Address,
      Phone,
      Status
    FROM Branches
    WHERE Status = 'ACTIVE'
    ORDER BY BranchName ASC
  `);

  const employees = await pool.request().query(`
    SELECT
      e.EmployeeId,
      e.BranchId,
      u.FullName,
      u.Phone,
      e.Position,
      e.Specialization,
      e.YearsOfExperience,
      COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl,
      b.BranchName,
      ISNULL(r.ReviewCount, 0) AS ReviewCount,
      ISNULL(r.AverageRating, 0) AS AverageRating
    FROM Employees e
    INNER JOIN Users u ON u.UserId = e.UserId
    LEFT JOIN Branches b ON b.BranchId = e.BranchId
    OUTER APPLY (
      SELECT
        COUNT(*) AS ReviewCount,
        CAST(AVG(CAST(TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(4,2)) AS AverageRating
      FROM Reviews rv
      WHERE rv.EmployeeId = e.EmployeeId
        AND rv.Status = 'APPROVED'
    ) r
    WHERE e.Status = 'ACTIVE'
    ORDER BY ISNULL(r.AverageRating, 0) DESC, u.FullName ASC
  `);

  const employeeServices = await pool.request().query(`
    SELECT EmployeeId, ServiceId
    FROM EmployeeServices
  `);

  return {
    services: services.recordset,
    branches: branches.recordset,
    employees: employees.recordset,
    employeeServices: employeeServices.recordset,
    priorities: [
      { value: "NORMAL", label: "Bình thường" },
      { value: "HIGH", label: "Ưu tiên cao" },
      { value: "URGENT", label: "Rất gấp" },
    ],
    contactMethods: [
      { value: "PHONE", label: "Gọi điện" },
      { value: "ZALO", label: "Zalo" },
      { value: "SMS", label: "SMS" },
      { value: "EMAIL", label: "Email" },
    ],
    timeSlots: [
      { value: "ANY", label: "Linh hoạt cả ngày" },
      { value: "MORNING", label: "Buổi sáng 08:00 - 12:00" },
      { value: "AFTERNOON", label: "Buổi chiều 13:00 - 17:00" },
      { value: "EVENING", label: "Buổi tối 18:00 - 21:00" },
      { value: "CUSTOM", label: "Tự chọn khoảng giờ" },
    ],
  };
}

async function getService(pool, serviceId) {
  const result = await pool.request().input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT TOP 1
        ServiceId,
        ServiceName,
        Description,
        DurationMinutes,
        Price,
        ImageUrl,
        Status
      FROM Services
      WHERE ServiceId = @ServiceId
    `);

  return result.recordset[0];
}

async function validateEmployeeForService(pool, employeeId, serviceId) {
  if (!employeeId) return;

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ServiceId", sql.Int, serviceId).query(`
      SELECT TOP 1 es.EmployeeId
      FROM EmployeeServices es
      INNER JOIN Employees e ON e.EmployeeId = es.EmployeeId
      WHERE es.EmployeeId = @EmployeeId
        AND es.ServiceId = @ServiceId
        AND e.Status = 'ACTIVE'
    `);

  if (!result.recordset[0]) {
    throw new Error("Kỹ thuật viên đã chọn không phù hợp với dịch vụ này.");
  }
}

async function validateBranch(pool, branchId) {
  if (!branchId) return;

  const result = await pool.request().input("BranchId", sql.Int, branchId)
    .query(`
      SELECT TOP 1 BranchId
      FROM Branches
      WHERE BranchId = @BranchId
        AND Status = 'ACTIVE'
    `);

  if (!result.recordset[0]) {
    throw new Error("Chi nhánh đã chọn không hợp lệ.");
  }
}

function parsePayload(data = {}, existed = {}) {
  const serviceId = toInt(
    data.serviceId || data.ServiceId || existed.ServiceId,
  );
  const preferredEmployeeId = toInt(
    data.preferredEmployeeId ||
      data.PreferredEmployeeId ||
      existed.PreferredEmployeeId,
  );
  const preferredBranchId = toInt(
    data.preferredBranchId ||
      data.PreferredBranchId ||
      existed.PreferredBranchId,
  );

  const preferredDate = normalizeDate(
    data.preferredDate || data.PreferredDate || existed.PreferredDate || "",
  );

  const flexibleTimeSlot = text(
    data.flexibleTimeSlot ||
      data.FlexibleTimeSlot ||
      existed.FlexibleTimeSlot ||
      "ANY",
  ).toUpperCase();

  let preferredTimeFrom = normalizeTime(
    data.preferredTimeFrom ||
      data.PreferredTimeFrom ||
      data.preferredTime ||
      data.PreferredTime ||
      existed.PreferredTimeFrom ||
      existed.PreferredTime ||
      "",
  );

  let preferredTimeTo = normalizeTime(
    data.preferredTimeTo ||
      data.PreferredTimeTo ||
      existed.PreferredTimeTo ||
      "",
  );

  if (!VALID_SLOT.includes(flexibleTimeSlot)) {
    throw new Error("Khung giờ mong muốn không hợp lệ.");
  }

  if (flexibleTimeSlot === "MORNING") {
    preferredTimeFrom = "08:00:00";
    preferredTimeTo = "12:00:00";
  }

  if (flexibleTimeSlot === "AFTERNOON") {
    preferredTimeFrom = "13:00:00";
    preferredTimeTo = "17:00:00";
  }

  if (flexibleTimeSlot === "EVENING") {
    preferredTimeFrom = "18:00:00";
    preferredTimeTo = "21:00:00";
  }

  if (flexibleTimeSlot === "ANY") {
    preferredTimeFrom = null;
    preferredTimeTo = null;
  }

  const priorityLevel = text(
    data.priorityLevel ||
      data.PriorityLevel ||
      existed.PriorityLevel ||
      "NORMAL",
  ).toUpperCase();

  const contactMethod = text(
    data.contactMethod ||
      data.ContactMethod ||
      existed.ContactMethod ||
      "EMAIL",
  ).toUpperCase();

  const contactPhone = nullableText(
    data.contactPhone || data.ContactPhone || existed.ContactPhone,
  );

  const reason = nullableText(data.reason || data.Reason || existed.Reason);
  const note = nullableText(data.note || data.Note || existed.Note);

  const acceptOtherTechnician = data.acceptOtherTechnician !== undefined
    ? (data.acceptOtherTechnician ? 1 : 0)
    : (existed.AcceptOtherTechnician ? 1 : 0);

  const acceptOtherTimeSlots = data.acceptOtherTimeSlots !== undefined
    ? (data.acceptOtherTimeSlots ? 1 : 0)
    : (existed.AcceptOtherTimeSlots ? 1 : 0);

  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ.");
  if (!VALID_PRIORITY.includes(priorityLevel)) {
    throw new Error("Mức độ ưu tiên không hợp lệ.");
  }
  if (!VALID_CONTACT.includes(contactMethod)) {
    throw new Error("Phương thức liên hệ không hợp lệ.");
  }
  if (note && note.length > 500) {
    throw new Error("Ghi chú không được vượt quá 500 ký tự.");
  }
  if (reason && reason.length > 255) {
    throw new Error("Lý do vào hàng chờ không được vượt quá 255 ký tự.");
  }

  validateFutureDate(preferredDate);
  validateTimeRange(preferredTimeFrom, preferredTimeTo);

  return {
    serviceId,
    preferredEmployeeId,
    preferredBranchId,
    preferredDate,
    flexibleTimeSlot,
    preferredTimeFrom,
    preferredTimeTo,
    priorityLevel,
    contactMethod,
    contactPhone,
    reason,
    note,
    acceptOtherTechnician,
    acceptOtherTimeSlots,
  };
}

function enrichItem(item) {
  if (!item) return item;

  const position = Number(item.WaitingPosition || 1);

  return {
    ...item,
    EstimatedResponseTime: estimateResponse(item.PriorityLevel, position, item.PreferredDate),
  };
}

async function getMine(userId, filters = {}) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);

  const status = text(filters.status || "ALL").toUpperCase();
  const keyword = text(filters.keyword);
  const serviceId = toInt(filters.serviceId);
  const branchId = toInt(filters.branchId);
  const employeeId = toInt(filters.employeeId);
  const priorityLevel = text(filters.priorityLevel || "ALL").toUpperCase();
  const fromDate = normalizeDate(filters.fromDate || "");
  const toDate = normalizeDate(filters.toDate || "");

  if (status !== "ALL" && !VALID_STATUS.includes(status)) {
    throw new Error("Trạng thái hàng chờ không hợp lệ.");
  }

  if (priorityLevel !== "ALL" && !VALID_PRIORITY.includes(priorityLevel)) {
    throw new Error("Mức độ ưu tiên không hợp lệ.");
  }

  const items = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("Status", sql.NVarChar, status)
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("ServiceId", sql.Int, serviceId)
    .input("BranchId", sql.Int, branchId)
    .input("EmployeeId", sql.Int, employeeId)
    .input("PriorityLevel", sql.NVarChar, priorityLevel)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
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
        ISNULL(w.FlexibleTimeSlot, 'ANY') AS FlexibleTimeSlot,
        ISNULL(w.PriorityLevel, 'NORMAL') AS PriorityLevel,
        ISNULL(w.ContactMethod, 'PHONE') AS ContactMethod,
        ISNULL(w.ContactPhone, '') AS ContactPhone,
        ISNULL(w.Reason, '') AS Reason,
        ISNULL(w.Note, '') AS Note,
        ISNULL(w.CancelReason, '') AS CancelReason,
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
        DATEDIFF(MINUTE, w.CreatedAt, GETDATE()) AS WaitingMinutes,

        s.ServiceName,
        s.Description AS ServiceDescription,
        s.DurationMinutes,
        s.Price,
        s.ImageUrl AS ServiceImageUrl,
        c.CategoryName,

        peU.FullName AS PreferredEmployeeName,
        COALESCE(pe.ImageUrl, peU.AvatarUrl) AS PreferredEmployeeImage,
        pe.Specialization AS PreferredEmployeeSpecialization,
        pe.YearsOfExperience AS PreferredEmployeeExperience,

        b.BranchName AS PreferredBranchName,
        b.Address AS PreferredBranchAddress,
        b.Phone AS PreferredBranchPhone,

        (
          SELECT COUNT(*)
          FROM EmployeeServices es
          INNER JOIN Employees e ON e.EmployeeId = es.EmployeeId
          WHERE es.ServiceId = w.ServiceId
            AND e.Status = 'ACTIVE'
        ) AS AvailableTechnicianCount,

        (
          SELECT COUNT(*)
          FROM WaitingList wx
          WHERE wx.ServiceId = w.ServiceId
            AND wx.Status IN ('WAITING', 'NOTIFIED')
            AND (wx.PreferredDate = w.PreferredDate OR (wx.PreferredDate IS NULL AND w.PreferredDate IS NULL))
            AND (
              wx.CreatedAt < w.CreatedAt
              OR (
                wx.CreatedAt = w.CreatedAt
                AND wx.WaitingId <= w.WaitingId
              )
            )
        ) AS WaitingPosition
      FROM WaitingList w
      INNER JOIN Services s ON s.ServiceId = w.ServiceId
      LEFT JOIN ServiceCategories c ON c.CategoryId = s.CategoryId
      LEFT JOIN Employees pe ON pe.EmployeeId = w.PreferredEmployeeId
      LEFT JOIN Users peU ON peU.UserId = pe.UserId
      LEFT JOIN Branches b ON b.BranchId = w.PreferredBranchId
      LEFT JOIN Employees me ON me.EmployeeId = w.MatchedEmployeeId
      LEFT JOIN Users meU ON meU.UserId = me.UserId
      WHERE w.CustomerId = @CustomerId
        AND (@Status = 'ALL' OR w.Status = @Status)
        AND (@PriorityLevel = 'ALL' OR ISNULL(w.PriorityLevel, 'NORMAL') = @PriorityLevel)
        AND (@ServiceId IS NULL OR w.ServiceId = @ServiceId)
        AND (@BranchId IS NULL OR w.PreferredBranchId = @BranchId)
        AND (@EmployeeId IS NULL OR w.PreferredEmployeeId = @EmployeeId)
        AND (@FromDate IS NULL OR w.PreferredDate >= @FromDate)
        AND (@ToDate IS NULL OR w.PreferredDate <= @ToDate)
        AND (
          @Keyword IS NULL
          OR s.ServiceName LIKE @Keyword
          OR ISNULL(s.Description, '') LIKE @Keyword
          OR ISNULL(w.Note, '') LIKE @Keyword
          OR ISNULL(w.Reason, '') LIKE @Keyword
          OR ISNULL(c.CategoryName, '') LIKE @Keyword
          OR ISNULL(peU.FullName, '') LIKE @Keyword
          OR ISNULL(b.BranchName, '') LIKE @Keyword
        )
      ORDER BY
        CASE w.Status
          WHEN 'NOTIFIED' THEN 0
          WHEN 'WAITING' THEN 1
          WHEN 'BOOKED' THEN 2
          ELSE 3
        END,
        CASE ISNULL(w.PriorityLevel, 'NORMAL')
          WHEN 'URGENT' THEN 0
          WHEN 'HIGH' THEN 1
          ELSE 2
        END,
        ISNULL(w.UpdatedAt, w.CreatedAt) DESC,
        w.WaitingId DESC
    `);

  const summary = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT
        COUNT(*) AS Total,
        SUM(CASE WHEN Status = 'WAITING' THEN 1 ELSE 0 END) AS Waiting,
        SUM(CASE WHEN Status = 'MATCHED' THEN 1 ELSE 0 END) AS Matched,
        SUM(CASE WHEN Status = 'NOTIFIED' THEN 1 ELSE 0 END) AS Notified,
        SUM(CASE WHEN Status = 'BOOKED' THEN 1 ELSE 0 END) AS Booked,
        SUM(CASE WHEN Status IN ('CANCELLED', 'SKIPPED', 'EXPIRED') THEN 1 ELSE 0 END) AS Cancelled,
        SUM(CASE WHEN Status IN ('WAITING', 'MATCHED', 'NOTIFIED') THEN 1 ELSE 0 END) AS Active,
        SUM(CASE WHEN PriorityLevel = 'URGENT' AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED') THEN 1 ELSE 0 END) AS UrgentActive
      FROM WaitingList
      WHERE CustomerId = @CustomerId

    `);

  return {
    customer,
    summary: summary.recordset[0] || {},
    items: items.recordset.map(enrichItem),
  };
}

async function getById(userId, waitingId) {
  const data = await getMine(userId, {});
  const id = toInt(waitingId);

  if (!id) throw new Error("Mã hàng chờ không hợp lệ.");

  const item = data.items.find((x) => Number(x.WaitingId) === id);

  if (!item) {
    throw new Error("Không tìm thấy yêu cầu hàng chờ.");
  }

  return item;
}

async function create(userId, data = {}) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  const payload = parsePayload(data);

  const service = await getService(pool, payload.serviceId);

  if (!service || service.Status !== "AVAILABLE") {
    throw new Error("Dịch vụ không tồn tại hoặc đã ngừng bán.");
  }

  await validateBranch(pool, payload.preferredBranchId);
  await validateEmployeeForService(
    pool,
    payload.preferredEmployeeId,
    payload.serviceId,
  );

  const duplicate = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("ServiceId", sql.Int, payload.serviceId)
    .input("PreferredDate", sql.VarChar, payload.preferredDate || null).query(`
      SELECT TOP 1 WaitingId
      FROM WaitingList
      WHERE CustomerId = @CustomerId
        AND ServiceId = @ServiceId
        AND (
          (@PreferredDate IS NULL AND PreferredDate IS NULL)
          OR (CONVERT(VARCHAR(10), PreferredDate, 120) = @PreferredDate)
        )
        AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED')
    `);

  if (duplicate.recordset[0]) {
    throw new Error(
      "Bạn đã có yêu cầu hàng chờ đang hoạt động cho dịch vụ này trong ngày đã chọn.",
    );
  }

  if (payload.preferredDate) {
    const activeAppt = await pool
      .request()
      .input("CustomerId", sql.Int, customer.CustomerId)
      .input("ServiceId", sql.Int, payload.serviceId)
      .input("PreferredDate", sql.VarChar, payload.preferredDate)
      .query(`
        SELECT TOP 1 a.AppointmentId
        FROM Appointments a
        INNER JOIN AppointmentServices asvc ON asvc.AppointmentId = a.AppointmentId
        WHERE a.CustomerId = @CustomerId
          AND asvc.ServiceId = @ServiceId
          AND CONVERT(VARCHAR(10), a.AppointmentDate, 120) = @PreferredDate
          AND a.Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
      `);

    if (activeAppt.recordset[0]) {
      throw new Error(
        "Bạn đã có lịch hẹn hoạt động cho dịch vụ này trong ngày đã chọn.",
      );
    }
  }

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("ServiceId", sql.Int, payload.serviceId)
    .input("PreferredEmployeeId", sql.Int, payload.preferredEmployeeId)
    .input("PreferredBranchId", sql.Int, payload.preferredBranchId)
    .input("PreferredDate", sql.VarChar, payload.preferredDate)
    .input("PreferredTime", sql.VarChar, payload.preferredTimeFrom)
    .input("PreferredTimeFrom", sql.VarChar, payload.preferredTimeFrom)
    .input("PreferredTimeTo", sql.VarChar, payload.preferredTimeTo)
    .input("FlexibleTimeSlot", sql.NVarChar, payload.flexibleTimeSlot)
    .input("PriorityLevel", sql.NVarChar, payload.priorityLevel)
    .input("ContactMethod", sql.NVarChar, payload.contactMethod)
    .input("ContactPhone", sql.NVarChar, payload.contactPhone)
    .input("Reason", sql.NVarChar, payload.reason)
    .input("Note", sql.NVarChar, payload.note)
    .input("AcceptOtherTechnician", sql.Bit, payload.acceptOtherTechnician)
    .input("AcceptOtherTimeSlots", sql.Bit, payload.acceptOtherTimeSlots)
    .input("ExpireAt", sql.DateTime, payload.preferredDate ? `${payload.preferredDate} 21:00:00` : null)
    .query(`
      INSERT INTO WaitingList
      (
        CustomerId,
        ServiceId,
        PreferredEmployeeId,
        PreferredBranchId,
        PreferredDate,
        PreferredTime,
        PreferredTimeFrom,
        PreferredTimeTo,
        FlexibleTimeSlot,
        PriorityLevel,
        ContactMethod,
        ContactPhone,
        Reason,
        Note,
        AcceptOtherTechnician,
        AcceptOtherTimeSlots,
        ExpireAt,
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
        CASE WHEN @PreferredTime IS NULL THEN NULL ELSE CAST(@PreferredTime AS TIME) END,
        CASE WHEN @PreferredTimeFrom IS NULL THEN NULL ELSE CAST(@PreferredTimeFrom AS TIME) END,
        CASE WHEN @PreferredTimeTo IS NULL THEN NULL ELSE CAST(@PreferredTimeTo AS TIME) END,
        @FlexibleTimeSlot,
        @PriorityLevel,
        @ContactMethod,
        @ContactPhone,
        @Reason,
        @Note,
        @AcceptOtherTechnician,
        @AcceptOtherTimeSlots,
        @ExpireAt,
        'WAITING',
        GETDATE(),
        GETDATE()
      )
    `);

  const inserted = result.recordset[0];
  return inserted;
}

async function update(userId, waitingId, data = {}) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  const id = toInt(waitingId);

  if (!id) throw new Error("Mã hàng chờ không hợp lệ.");

  const existed = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 1 *
      FROM WaitingList
      WHERE WaitingId = @WaitingId
        AND CustomerId = @CustomerId
    `);

  const item = existed.recordset[0];

  if (!item) throw new Error("Không tìm thấy yêu cầu hàng chờ.");

  if (!ACTIVE_STATUS.includes(item.Status)) {
    throw new Error("Chỉ có thể chỉnh sửa yêu cầu đang chờ hoặc đã thông báo.");
  }

  const payload = parsePayload(data, item);

  const service = await getService(pool, payload.serviceId);

  if (!service || service.Status !== "AVAILABLE") {
    throw new Error("Dịch vụ không tồn tại hoặc đã ngừng bán.");
  }

  await validateBranch(pool, payload.preferredBranchId);
  await validateEmployeeForService(
    pool,
    payload.preferredEmployeeId,
    payload.serviceId,
  );

  const duplicate = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("ServiceId", sql.Int, payload.serviceId)
    .input("PreferredDate", sql.VarChar, payload.preferredDate || null).query(`
      SELECT TOP 1 WaitingId
      FROM WaitingList
      WHERE WaitingId <> @WaitingId
        AND CustomerId = @CustomerId
        AND ServiceId = @ServiceId
        AND (
          (@PreferredDate IS NULL AND PreferredDate IS NULL)
          OR (CONVERT(VARCHAR(10), PreferredDate, 120) = @PreferredDate)
        )
        AND Status IN ('WAITING', 'MATCHED', 'NOTIFIED')
    `);

  if (duplicate.recordset[0]) {
    throw new Error(
      "Bạn đã có yêu cầu hàng chờ đang hoạt động cho dịch vụ này trong ngày đã chọn.",
    );
  }

  if (payload.preferredDate) {
    const activeAppt = await pool
      .request()
      .input("CustomerId", sql.Int, customer.CustomerId)
      .input("ServiceId", sql.Int, payload.serviceId)
      .input("PreferredDate", sql.VarChar, payload.preferredDate)
      .query(`
        SELECT TOP 1 a.AppointmentId
        FROM Appointments a
        INNER JOIN AppointmentServices asvc ON asvc.AppointmentId = a.AppointmentId
        WHERE a.CustomerId = @CustomerId
          AND asvc.ServiceId = @ServiceId
          AND CONVERT(VARCHAR(10), a.AppointmentDate, 120) = @PreferredDate
          AND a.Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
      `);

    if (activeAppt.recordset[0]) {
      throw new Error(
        "Bạn đã có lịch hẹn hoạt động cho dịch vụ này trong ngày đã chọn.",
      );
    }
  }

  const result = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("ServiceId", sql.Int, payload.serviceId)
    .input("PreferredEmployeeId", sql.Int, payload.preferredEmployeeId)
    .input("PreferredBranchId", sql.Int, payload.preferredBranchId)
    .input("PreferredDate", sql.VarChar, payload.preferredDate)
    .input("PreferredTime", sql.VarChar, payload.preferredTimeFrom)
    .input("PreferredTimeFrom", sql.VarChar, payload.preferredTimeFrom)
    .input("PreferredTimeTo", sql.VarChar, payload.preferredTimeTo)
    .input("FlexibleTimeSlot", sql.NVarChar, payload.flexibleTimeSlot)
    .input("PriorityLevel", sql.NVarChar, payload.priorityLevel)
    .input("ContactMethod", sql.NVarChar, payload.contactMethod)
    .input("ContactPhone", sql.NVarChar, payload.contactPhone)
    .input("Reason", sql.NVarChar, payload.reason)
    .input("Note", sql.NVarChar, payload.note)
    .input("AcceptOtherTechnician", sql.Bit, payload.acceptOtherTechnician)
    .input("AcceptOtherTimeSlots", sql.Bit, payload.acceptOtherTimeSlots)
    .input("ExpireAt", sql.DateTime, payload.preferredDate ? `${payload.preferredDate} 21:00:00` : null)
    .query(`
      UPDATE WaitingList
      SET
        ServiceId = @ServiceId,
        PreferredEmployeeId = @PreferredEmployeeId,
        PreferredBranchId = @PreferredBranchId,
        PreferredDate = @PreferredDate,
        PreferredTime = CASE WHEN @PreferredTime IS NULL THEN NULL ELSE CAST(@PreferredTime AS TIME) END,
        PreferredTimeFrom = CASE WHEN @PreferredTimeFrom IS NULL THEN NULL ELSE CAST(@PreferredTimeFrom AS TIME) END,
        PreferredTimeTo = CASE WHEN @PreferredTimeTo IS NULL THEN NULL ELSE CAST(@PreferredTimeTo AS TIME) END,
        FlexibleTimeSlot = @FlexibleTimeSlot,
        PriorityLevel = @PriorityLevel,
        ContactMethod = @ContactMethod,
        ContactPhone = @ContactPhone,
        Reason = @Reason,
        Note = @Note,
        AcceptOtherTechnician = @AcceptOtherTechnician,
        AcceptOtherTimeSlots = @AcceptOtherTimeSlots,
        ExpireAt = @ExpireAt,
        Status = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN 'WAITING' ELSE Status END,
        MatchedEmployeeId = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN NULL ELSE MatchedEmployeeId END,
        MatchedDate = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN NULL ELSE MatchedDate END,
        MatchedStartTime = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN NULL ELSE MatchedStartTime END,
        MatchedEndTime = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN NULL ELSE MatchedEndTime END,
        HoldExpiresAt = CASE WHEN Status IN ('NOTIFIED', 'MATCHED') THEN NULL ELSE HoldExpiresAt END,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE WaitingId = @WaitingId
        AND CustomerId = @CustomerId
    `);

  const oldMatchedDate = item.MatchedDate;
  const oldStatus = item.Status;

  const updated = result.recordset[0];

  if (oldMatchedDate && (oldStatus === 'MATCHED' || oldStatus === 'NOTIFIED')) {
    const oldDateStr = oldMatchedDate instanceof Date
      ? oldMatchedDate.toISOString().slice(0, 10)
      : String(oldMatchedDate).slice(0, 10);
    runAutoMatch(oldDateStr).catch(err => console.error("Auto match failed on old date after update:", err.message));
  }

  return updated;
}

async function cancel(userId, waitingId, data = {}) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  const id = toInt(waitingId);
  const cancelReason = nullableText(data.cancelReason || data.CancelReason);

  if (!id) throw new Error("Mã hàng chờ không hợp lệ.");

  const existed = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 1 WaitingId, Status
      FROM WaitingList
      WHERE WaitingId = @WaitingId
        AND CustomerId = @CustomerId
    `);

  const item = existed.recordset[0];

  if (!item) throw new Error("Không tìm thấy yêu cầu hàng chờ.");

  if (!ACTIVE_STATUS.includes(item.Status)) {
    throw new Error("Chỉ có thể hủy yêu cầu đang chờ hoặc đã thông báo.");
  }

  const result = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("CancelReason", sql.NVarChar, cancelReason).query(`
      UPDATE WaitingList
      SET
        Status = 'CANCELLED',
        CancelReason = @CancelReason,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE WaitingId = @WaitingId
        AND CustomerId = @CustomerId
    `);

  return result.recordset[0];
}

async function runAutoMatch(dateStr) {
  const normalizeDateOnly = (val) => {
    if (!val) return new Date().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    const s = String(val);
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch (e) {}
    return s.slice(0, 10);
  };
  const date = normalizeDateOnly(dateStr);
  console.log(`[AutoMatch] Starting auto-match engine for date: ${date}`);
  const pool = await connectDB();

  const candidatesResult = await pool.request()
    .input("PreferredDate", sql.VarChar, date)
    .query(`
      SELECT w.*, s.ServiceName, s.DurationMinutes, u.UserId, u.FullName AS CustomerName, u.Email
      FROM WaitingList w
      INNER JOIN Services s ON s.ServiceId = w.ServiceId
      INNER JOIN Customers c ON c.CustomerId = w.CustomerId
      INNER JOIN Users u ON u.UserId = c.UserId
      WHERE CONVERT(VARCHAR(10), w.PreferredDate, 120) = @PreferredDate
        AND w.Status = 'WAITING'
    `);
  const candidates = candidatesResult.recordset;
  if (candidates.length === 0) {
    console.log(`[AutoMatch] No WAITING candidates for date: ${date}`);
    return;
  }

  const empServicesResult = await pool.request().query(`
    SELECT EmployeeId, ServiceId FROM EmployeeServices
  `);
  const qualifications = empServicesResult.recordset;

  const employeesResult = await pool.request().query(`
    SELECT e.EmployeeId, e.BranchId, u.FullName, COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl
    FROM Employees e
    INNER JOIN Users u ON u.UserId = e.UserId
    WHERE e.Status = 'ACTIVE'
  `);
  const employees = employeesResult.recordset;

  const canDoService = (empId, svcId) => {
    return qualifications.some(q => q.EmployeeId === empId && q.ServiceId === svcId);
  };

  const appointmentsService = require("../appointments/appointments.service");
  const serviceIds = [...new Set(candidates.map(c => c.ServiceId))];

  for (const svcId of serviceIds) {
    const serviceCandidates = candidates.filter(c => c.ServiceId === svcId);
    const qualifiedEmps = employees.filter(e => canDoService(e.EmployeeId, svcId));

    const potentialMatches = [];

    for (const emp of qualifiedEmps) {
      let freeSlots = [];
      try {
        const res = await appointmentsService.getAvailableSlots({
          employeeId: emp.EmployeeId,
          serviceId: svcId,
          appointmentDate: date,
          includeAlternatives: false
        });
        freeSlots = Array.isArray(res) ? res : (res.slots || []);
      } catch (err) {
        continue;
      }

      for (const slot of freeSlots) {
        const startTime = `${slot.startTime}:00`;
        const endTime = `${slot.endTime}:00`;

        for (const cand of serviceCandidates) {
          if (cand.Status !== 'WAITING') continue;

          const isPreferredTech = cand.PreferredEmployeeId === emp.EmployeeId;
          const techOk = !cand.PreferredEmployeeId || isPreferredTech || cand.AcceptOtherTechnician;

          if (!techOk) continue;

          // Branch validation: Employee's branch must match the candidate's preferred branch (if set)
          const branchOk = !cand.PreferredBranchId || String(emp.BranchId) === String(cand.PreferredBranchId);
          if (!branchOk) continue;

          let isExactTime = false;
          let timeOk = false;

          if (cand.PreferredTimeFrom && cand.PreferredTimeTo) {
            const prefFrom = formatTimeOnly(cand.PreferredTimeFrom);
            const prefTo = formatTimeOnly(cand.PreferredTimeTo);
            if (startTime >= prefFrom && endTime <= prefTo) {
              isExactTime = true;
              timeOk = true;
            }
          } else {
            isExactTime = true;
            timeOk = true;
          }

          if (!timeOk && cand.AcceptOtherTimeSlots) {
            timeOk = true;
          }

          if (techOk && timeOk) {
            potentialMatches.push({
              cand,
              emp,
              slot,
              startTime,
              endTime,
              isExactTime: isExactTime ? 1 : 0,
              isExactTech: isPreferredTech ? 1 : 0,
              priorityWeight: cand.PriorityLevel === 'URGENT' ? 3 : (cand.PriorityLevel === 'HIGH' ? 2 : 1)
            });
          }
        }
      }
    }

    // Sort matching pairs by priority:
    // 1. Exact time range match
    // 2. Exact technician match
    // 3. Priority level weight
    // 4. Oldest request first (FIFO)
    potentialMatches.sort((a, b) => {
      if (a.isExactTime !== b.isExactTime) {
        return b.isExactTime - a.isExactTime;
      }
      if (a.isExactTech !== b.isExactTech) {
        return b.isExactTech - a.isExactTech;
      }
      if (a.priorityWeight !== b.priorityWeight) {
        return b.priorityWeight - a.priorityWeight;
      }
      return new Date(a.cand.CreatedAt) - new Date(b.cand.CreatedAt);
    });

    const assignedCandidateIds = new Set();
    const assignedSlots = new Set();

    for (const match of potentialMatches) {
      if (match.cand.Status !== 'WAITING') continue;
      if (assignedCandidateIds.has(match.cand.WaitingId)) continue;

      const slotKey = `${match.emp.EmployeeId}_${match.slot.startTime}`;
      if (assignedSlots.has(slotKey)) continue;

      const best = match.cand;
      const emp = match.emp;
      const slot = match.slot;
      const startTime = match.startTime;
      const endTime = match.endTime;

      console.log(`[AutoMatch] Matching candidate ${best.CustomerName} (WaitingId: ${best.WaitingId}) to KTV ${emp.FullName} at ${slot.startTime} on ${date} (Exact Time: ${match.isExactTime}, Exact Tech: ${match.isExactTech})`);

      const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      try {
        await pool.request()
          .input("WaitingId", sql.Int, best.WaitingId)
          .input("MatchedEmployeeId", sql.Int, emp.EmployeeId)
          .input("MatchedDate", sql.Date, date)
          .input("MatchedStartTime", sql.VarChar, startTime)
          .input("MatchedEndTime", sql.VarChar, endTime)
          .input("HoldExpiresAt", sql.DateTime, holdExpiresAt)
          .query(`
            UPDATE WaitingList
            SET Status = 'MATCHED',
                MatchedEmployeeId = @MatchedEmployeeId,
                MatchedDate = @MatchedDate,
                MatchedStartTime = CAST(@MatchedStartTime AS TIME),
                MatchedEndTime = CAST(@MatchedEndTime AS TIME),
                HoldExpiresAt = @HoldExpiresAt,
                UpdatedAt = GETDATE()
            WHERE WaitingId = @WaitingId
          `);

        best.Status = 'MATCHED';
        assignedCandidateIds.add(best.WaitingId);
        assignedSlots.add(slotKey);

        const notificationsService = require("../notifications/notifications.service");
        const dateText = new Date(date).toLocaleDateString("vi-VN");
        const timeRangeText = `${slot.startTime} - ${slot.endTime}`;
        const content = `Đã tìm thấy lịch phù hợp cho dịch vụ ${best.ServiceName}. Kỹ thuật viên: ${emp.FullName}. Ngày: ${dateText}. Giờ: ${timeRangeText}. Bạn có 15 phút để Xác nhận hoặc Từ chối lịch hẹn này.`;

        await notificationsService.create({
          userId: best.UserId,
          title: "Đã tìm thấy lịch phù hợp từ hàng chờ",
          content: content,
          type: "WAITING_LIST_MATCH"
        });

        if (best.Email) {
          try {
            const { sendMail } = require("../../utils/sendMail");
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const confirmUrl = `${frontendUrl}/customer/waiting-list`;
            await sendMail({
              to: best.Email,
              subject: "Đã tìm thấy lịch phù hợp từ hàng chờ - Beauty Salon",
              html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
                  <h2 style="color:#ef4f83;">Tìm thấy lịch phù hợp từ hàng chờ!</h2>
                  <p>Xin chào <strong>${best.CustomerName}</strong>,</p>
                  <p>Hệ thống Beauty Salon đã tìm thấy khung giờ trống phù hợp với yêu cầu hàng chờ của bạn:</p>
                  <ul>
                    <li><strong>Dịch vụ:</strong> ${best.ServiceName}</li>
                    <li><strong>Kỹ thuật viên:</strong> ${emp.FullName}</li>
                    <li><strong>Ngày:</strong> ${dateText}</li>
                    <li><strong>Khung giờ:</strong> ${timeRangeText}</li>
                  </ul>
                  <p>Bạn vui lòng truy cập vào hệ thống để <strong>Xác nhận</strong> hoặc <strong>Từ chối</strong> lịch hẹn này. Lưu ý khung giờ này sẽ chỉ được giữ chỗ trong vòng <strong>15 phút</strong>.</p>
                  <p style="margin-top:20px;">
                    <a href="${confirmUrl}" style="background-color:#ef4f83;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">
                      Xác nhận lịch hẹn ngay
                    </a>
                  </p>
                  <p style="color:#777;font-size:12px;margin-top:30px;">Nếu bạn không xác nhận trong vòng 15 phút, yêu cầu hàng chờ sẽ tự động quay trở lại danh sách chờ ghép.</p>
                </div>
              `
            });
            console.log(`[AutoMatch] Notification email sent to ${best.Email} for WaitingId ${best.WaitingId}`);
          } catch (mailErr) {
            console.error(`[AutoMatch] Failed to send notification email to ${best.Email}:`, mailErr.message);
          }
        }
      } catch (err) {
        console.error(`[AutoMatch] Failed to save match for WaitingId ${best.WaitingId}:`, err.message);
      }
    }
  }
}

async function confirmMatch(userId, waitingId) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  const id = toInt(waitingId);

  if (!id) throw new Error("Mã hàng chờ không hợp lệ.");

  const existed = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT 
        w.WaitingId,
        w.CustomerId,
        w.ServiceId,
        w.PreferredEmployeeId,
        w.PreferredBranchId,
        w.PreferredDate,
        CONVERT(VARCHAR(8), w.MatchedStartTime, 108) AS MatchedStartTime,
        CONVERT(VARCHAR(8), w.MatchedEndTime, 108) AS MatchedEndTime,
        w.MatchedEmployeeId,
        w.MatchedDate,
        w.HoldExpiresAt,
        w.Status,
        w.Note,
        s.Price,
        s.ServiceName,
        s.DurationMinutes
      FROM WaitingList w
      INNER JOIN Services s ON s.ServiceId = w.ServiceId
      WHERE w.WaitingId = @WaitingId
        AND w.CustomerId = @CustomerId
    `);

  const item = existed.recordset[0];
  if (!item) throw new Error("Không tìm thấy yêu cầu hàng chờ.");

  if (item.Status !== "MATCHED") {
    throw new Error("Yêu cầu hàng chờ không ở trạng thái được ghép lịch.");
  }

  if (new Date(item.HoldExpiresAt) <= new Date()) {
    throw new Error("Khung giờ giữ chỗ đã hết hạn 15 phút.");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Check if slot is already booked in Appointments
    const busyCheck = await new sql.Request(transaction)
      .input("EmployeeId", sql.Int, item.MatchedEmployeeId)
      .input("AppointmentDate", sql.Date, item.MatchedDate)
      .input("StartTime", sql.VarChar, formatTimeOnly(item.MatchedStartTime))
      .input("EndTime", sql.VarChar, formatTimeOnly(item.MatchedEndTime))
      .query(`
        SELECT TOP 1 AppointmentId
        FROM Appointments
        WHERE EmployeeId = @EmployeeId
          AND AppointmentDate = @AppointmentDate
          AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED', 'REFUND_PENDING')
          AND (@StartTime < EndTime AND @EndTime > StartTime)
      `);

    if (busyCheck.recordset[0]) {
      throw new Error("Khung giờ này đã được người khác đặt trước.");
    }

    const appointmentResult = await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customer.CustomerId)
      .input("EmployeeId", sql.Int, item.MatchedEmployeeId)
      .input("BranchId", sql.Int, item.PreferredBranchId || 1)
      .input("AppointmentDate", sql.Date, item.MatchedDate)
      .input("StartTime", sql.VarChar, formatTimeOnly(item.MatchedStartTime))
      .input("EndTime", sql.VarChar, formatTimeOnly(item.MatchedEndTime))
      .input("Notes", sql.NVarChar, `Được đặt tự động từ hàng chờ. Ghi chú: ${item.Note || ""}`)
      .query(`
        INSERT INTO Appointments (CustomerId, EmployeeId, BranchId, AppointmentDate, StartTime, EndTime, Status, Notes)
        OUTPUT INSERTED.AppointmentId, INSERTED.Status
        VALUES (@CustomerId, @EmployeeId, @BranchId, @AppointmentDate, @StartTime, @EndTime, 'PENDING_PAYMENT', @Notes)
      `);

    const appointment = appointmentResult.recordset[0];
    const newAppointmentId = appointment.AppointmentId;

    const invoiceResult = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, newAppointmentId)
      .input("TotalAmount", sql.Decimal(18, 2), item.Price)
      .input("DiscountAmount", sql.Decimal(18, 2), 0)
      .input("FinalAmount", sql.Decimal(18, 2), item.Price)
      .query(`
        INSERT INTO Invoices (AppointmentId, TotalAmount, DiscountAmount, FinalAmount, Status)
        OUTPUT INSERTED.InvoiceId
        VALUES (@AppointmentId, @TotalAmount, @DiscountAmount, @FinalAmount, 'UNPAID')
      `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, newAppointmentId)
      .input("ServiceId", sql.Int, item.ServiceId)
      .input("Price", sql.Decimal(18, 2), item.Price)
      .query(`
        INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price)
        VALUES (@AppointmentId, @ServiceId, @Price)
      `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, newAppointmentId)
      .input("OldStatus", sql.NVarChar, null)
      .input("NewStatus", sql.NVarChar, "PENDING_PAYMENT")
      .input("ChangedBy", sql.Int, userId)
      .input("Reason", sql.NVarChar, "Đặt lịch tự động từ hàng chờ")
      .query(`
        INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason)
        VALUES (@AppointmentId, @OldStatus, @NewStatus, @ChangedBy, @Reason)
      `);

    await new sql.Request(transaction)
      .input("WaitingId", sql.Int, id)
      .input("ConvertedAppointmentId", sql.Int, newAppointmentId)
      .query(`
        UPDATE WaitingList
        SET Status = 'BOOKED',
            ConvertedAppointmentId = @ConvertedAppointmentId,
            UpdatedAt = GETDATE()
        WHERE WaitingId = @WaitingId
      `);

    await transaction.commit();
    return { appointmentId: newAppointmentId };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function rejectMatch(userId, waitingId) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  const id = toInt(waitingId);

  if (!id) throw new Error("Mã hàng chờ không hợp lệ.");

  const existed = await pool
    .request()
    .input("WaitingId", sql.Int, id)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT TOP 1 *
      FROM WaitingList
      WHERE WaitingId = @WaitingId
        AND CustomerId = @CustomerId
    `);

  const item = existed.recordset[0];
  if (!item) throw new Error("Không tìm thấy yêu cầu hàng chờ.");

  if (item.Status !== "MATCHED") {
    throw new Error("Yêu cầu hàng chờ không ở trạng thái được ghép lịch.");
  }

  await pool.request()
    .input("WaitingId", sql.Int, id)
    .query(`
      UPDATE WaitingList
      SET Status = 'CANCELLED',
          CancelReason = N'Khách từ chối lịch đã ghép',
          HoldExpiresAt = NULL,
          UpdatedAt = GETDATE()
      WHERE WaitingId = @WaitingId
    `);

  const dateStr = item.MatchedDate ? item.MatchedDate.toISOString().slice(0, 10) : null;
  if (dateStr) {
    runAutoMatch(dateStr).catch(err => console.error("Auto match failed after rejection:", err.message));
  }

  return { success: true };
}

function startWaitingListHoldScheduler(intervalMs = 60 * 1000) {
  const run = async () => {
    try {
      const pool = await connectDB();

      const expiredHoldsResult = await pool.request().query(`
        SELECT WaitingId, MatchedDate
        FROM WaitingList
        WHERE Status IN ('MATCHED', 'NOTIFIED')
          AND HoldExpiresAt <= GETUTCDATE()
      `);

      for (const row of expiredHoldsResult.recordset) {
        console.log(`[Scheduler] Hold expired for WaitingId: ${row.WaitingId}`);
        await pool.request()
          .input("WaitingId", sql.Int, row.WaitingId)
          .query(`
            UPDATE WaitingList
            SET Status = 'SKIPPED',
                HoldExpiresAt = NULL,
                UpdatedAt = GETDATE()
            WHERE WaitingId = @WaitingId
          `);

        const dateStr = row.MatchedDate instanceof Date
          ? row.MatchedDate.toISOString().slice(0, 10)
          : String(row.MatchedDate).slice(0, 10);

        runAutoMatch(dateStr).catch(err => console.error("Auto match failed after hold expiry:", err.message));
      }

      await pool.request().query(`
        UPDATE WaitingList
        SET Status = 'EXPIRED',
            UpdatedAt = GETDATE()
        WHERE Status = 'WAITING'
          AND ExpireAt <= GETUTCDATE()
      `);

    } catch (err) {
      console.error("[Scheduler] Waiting list hold job failed:", err.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  return timer;
}

module.exports = {
  getOptions,
  getMine,
  getById,
  create,
  update,
  cancel,
  runAutoMatch,
  confirmMatch,
  rejectMatch,
  startWaitingListHoldScheduler
};
