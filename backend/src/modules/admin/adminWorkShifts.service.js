const { sql, connectDB } = require("../../config/db");

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function text(value) {
  const v = String(value || "").trim();
  return v || null;
}

function normalizeTime(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (v.length === 5) return `${v}:00`;
  return v.slice(0, 8);
}

function isPastDate(value) {
  if (!value) return true;
  const d = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

async function getTechnicians() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      e.EmployeeId,
      u.FullName,
      u.Email,
      u.Phone,
      u.AvatarUrl,
      e.ImageUrl,
      e.Position,
      e.Specialization,
      e.Status
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE UPPER(u.Status) = 'ACTIVE'
      AND UPPER(e.Status) = 'ACTIVE'
      AND UPPER(r.RoleName) = 'TECHNICIAN'
    ORDER BY u.FullName ASC
  `);

  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const employeeId = toInt(filters.employeeId || filters.technicianId);
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);
  const shiftDate = dateOnly(filters.shiftDate);
  const status = text(filters.status)?.toUpperCase();
  const keyword = text(filters.keyword);

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate)
    .input("ShiftDate", sql.Date, shiftDate)
    .input("Status", sql.NVarChar, status)
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null).query(`
      SELECT
        ws.ShiftId,
        ws.EmployeeId,
        u.FullName AS EmployeeName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        e.ImageUrl,
        e.Position,
        e.Specialization,
        e.Status AS EmployeeStatus,
        b.BranchName,
        ws.ShiftDate,
        ws.StartTime,
        ws.EndTime,
        ws.ShiftType,
        ws.IsDayOff,
        ws.Notes,
        ISNULL(ap.AppointmentCount, 0) AS AppointmentCount
      FROM WorkShifts ws
      JOIN Employees e ON ws.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      OUTER APPLY (
        SELECT COUNT(*) AS AppointmentCount
        FROM Appointments a
        WHERE a.EmployeeId = ws.EmployeeId
          AND a.AppointmentDate = ws.ShiftDate
          AND a.Status NOT IN ('CANCELLED', 'NO_SHOW')
      ) ap
      WHERE
        (@EmployeeId IS NULL OR ws.EmployeeId = @EmployeeId)
        AND (@ShiftDate IS NULL OR ws.ShiftDate = @ShiftDate)
        AND (@FromDate IS NULL OR ws.ShiftDate >= @FromDate)
        AND (@ToDate IS NULL OR ws.ShiftDate <= @ToDate)
        AND (
          @Status IS NULL
          OR (@Status = 'DAY_OFF' AND ws.IsDayOff = 1)
          OR (@Status = 'WORKING' AND ws.IsDayOff = 0)
        )
        AND (
          @Keyword IS NULL
          OR u.FullName LIKE @Keyword
          OR u.Email LIKE @Keyword
          OR e.Specialization LIKE @Keyword
          OR e.Position LIKE @Keyword
        )
      ORDER BY ws.ShiftDate DESC, ws.StartTime ASC, ws.ShiftId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("ShiftId", sql.Int, Number(id))
    .query(`
      SELECT
        ws.ShiftId,
        ws.EmployeeId,
        u.FullName AS EmployeeName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        e.ImageUrl,
        e.Position,
        e.Specialization,
        e.Status AS EmployeeStatus,
        b.BranchName,
        ws.ShiftDate,
        ws.StartTime,
        ws.EndTime,
        ws.ShiftType,
        ws.IsDayOff,
        ws.Notes
      FROM WorkShifts ws
      JOIN Employees e ON ws.EmployeeId = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      LEFT JOIN Branches b ON e.BranchId = b.BranchId
      WHERE ws.ShiftId = @ShiftId
    `);

  if (!result.recordset[0]) throw new Error("Không tìm thấy ca làm");
  return result.recordset[0];
}

async function ensureEmployeeActive(employeeId) {
  const pool = await connectDB();

  const result = await pool.request().input("EmployeeId", sql.Int, employeeId)
    .query(`
      SELECT TOP 1 e.EmployeeId
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE e.EmployeeId = @EmployeeId
        AND e.Status = 'ACTIVE'
        AND u.Status = 'ACTIVE'
    `);

  if (!result.recordset[0]) {
    throw new Error("Nhân viên không tồn tại hoặc không hoạt động");
  }
}

async function checkShiftOverlap(
  employeeId,
  shiftDate,
  startTime,
  endTime,
  excludeShiftId = null,
) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ShiftDate", sql.Date, shiftDate)
    .input("StartTime", sql.Time, startTime)
    .input("EndTime", sql.Time, endTime)
    .input("ExcludeShiftId", sql.Int, excludeShiftId).query(`
      SELECT TOP 1 ShiftId
      FROM WorkShifts
      WHERE EmployeeId = @EmployeeId
        AND ShiftDate = @ShiftDate
        AND (@ExcludeShiftId IS NULL OR ShiftId <> @ExcludeShiftId)
        AND (@StartTime < EndTime AND @EndTime > StartTime)
    `);

  if (result.recordset[0]) {
    throw new Error("Ca làm bị trùng với ca đã tồn tại");
  }
}

async function checkAppointmentConflict(employeeId, shiftDate, isDayOff) {
  if (!isDayOff) return;

  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ShiftDate", sql.Date, shiftDate).query(`
      SELECT TOP 1 AppointmentId
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @ShiftDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW')
    `);

  if (result.recordset[0]) {
    throw new Error(
      "Không thể đặt ngày nghỉ vì nhân viên đã có lịch hẹn trong ngày này",
    );
  }
}

async function checkAppointmentConflictForShift(
  employeeId,
  shiftDate,
  startTime,
  endTime,
) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ShiftDate", sql.Date, shiftDate)
    .input("StartTime", sql.Time, startTime)
    .input("EndTime", sql.Time, endTime).query(`
      SELECT TOP 1 AppointmentId
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @ShiftDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW')
        AND (
          (@StartTime > AppointmentTime)
          OR (@EndTime < AppointmentTime)
        )
    `);

  if (result.recordset[0]) {
    throw new Error(
      "Không thể cập nhật ca vì đã có lịch hẹn nằm ngoài thời gian ca mới",
    );
  }
}

async function create(data) {
  const employeeId = toInt(data.employeeId || data.EmployeeId);
  const shiftDate = dateOnly(data.shiftDate || data.ShiftDate);
  const isDayOff = Number(data.isDayOff ?? data.IsDayOff ?? 0) ? 1 : 0;

  let startTime = normalizeTime(data.startTime || data.StartTime);
  let endTime = normalizeTime(data.endTime || data.EndTime);

  const shiftType =
    text(data.shiftType || data.ShiftType) || (isDayOff ? "DAY_OFF" : "NORMAL");
  const notes = text(data.notes || data.Notes);

  if (!employeeId) throw new Error("Vui lòng chọn nhân viên");
  if (!shiftDate) throw new Error("Vui lòng chọn ngày làm");
  if (isPastDate(shiftDate)) throw new Error("Không được tạo ca trong quá khứ");

  await ensureEmployeeActive(employeeId);

  if (isDayOff) {
    startTime = "00:00:00";
    endTime = "23:59:59";
    await checkAppointmentConflict(employeeId, shiftDate, true);
  } else {
    if (!startTime || !endTime)
      throw new Error("Vui lòng nhập giờ bắt đầu và kết thúc");
    if (startTime >= endTime)
      throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  await checkShiftOverlap(employeeId, shiftDate, startTime, endTime);

  const pool = await connectDB();

  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ShiftDate", sql.Date, shiftDate)
    .input("StartTime", sql.Time, startTime)
    .input("EndTime", sql.Time, endTime)
    .input("ShiftType", sql.NVarChar, shiftType)
    .input("IsDayOff", sql.Bit, isDayOff)
    .input("Notes", sql.NVarChar, notes).query(`
      INSERT INTO WorkShifts
        (EmployeeId, ShiftDate, StartTime, EndTime, ShiftType, IsDayOff, Notes)
      OUTPUT INSERTED.ShiftId
      VALUES
        (@EmployeeId, @ShiftDate, @StartTime, @EndTime, @ShiftType, @IsDayOff, @Notes)
    `);

  return getById(result.recordset[0].ShiftId);
}

async function update(id, data) {
  const current = await getById(id);

  const employeeId =
    data.employeeId !== undefined || data.EmployeeId !== undefined
      ? toInt(data.employeeId || data.EmployeeId)
      : current.EmployeeId;

  const shiftDate =
    data.shiftDate !== undefined || data.ShiftDate !== undefined
      ? dateOnly(data.shiftDate || data.ShiftDate)
      : dateOnly(current.ShiftDate);

  const isDayOff =
    data.isDayOff !== undefined || data.IsDayOff !== undefined
      ? Number(data.isDayOff ?? data.IsDayOff ?? 0)
        ? 1
        : 0
      : Number(current.IsDayOff ? 1 : 0);

  let startTime =
    data.startTime !== undefined || data.StartTime !== undefined
      ? normalizeTime(data.startTime || data.StartTime)
      : normalizeTime(current.StartTime);

  let endTime =
    data.endTime !== undefined || data.EndTime !== undefined
      ? normalizeTime(data.endTime || data.EndTime)
      : normalizeTime(current.EndTime);

  const shiftType =
    data.shiftType !== undefined || data.ShiftType !== undefined
      ? text(data.shiftType || data.ShiftType)
      : current.ShiftType;

  const notes =
    data.notes !== undefined || data.Notes !== undefined
      ? text(data.notes || data.Notes)
      : current.Notes;

  if (!employeeId) throw new Error("Vui lòng chọn nhân viên");
  if (!shiftDate) throw new Error("Vui lòng chọn ngày làm");
  if (isPastDate(shiftDate))
    throw new Error("Không được cập nhật ca trong quá khứ");

  await ensureEmployeeActive(employeeId);

  if (isDayOff) {
    startTime = "00:00:00";
    endTime = "23:59:59";
    await checkAppointmentConflict(employeeId, shiftDate, true);
  } else {
    if (!startTime || !endTime)
      throw new Error("Vui lòng nhập giờ bắt đầu và kết thúc");
    if (startTime >= endTime)
      throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  if (!isDayOff) {
    await checkAppointmentConflictForShift(
      employeeId,
      shiftDate,
      startTime,
      endTime,
    );
  }

  await checkShiftOverlap(
    employeeId,
    shiftDate,
    startTime,
    endTime,
    Number(id),
  );

  const pool = await connectDB();

  await pool
    .request()
    .input("ShiftId", sql.Int, Number(id))
    .input("EmployeeId", sql.Int, employeeId)
    .input("ShiftDate", sql.Date, shiftDate)
    .input("StartTime", sql.Time, startTime)
    .input("EndTime", sql.Time, endTime)
    .input(
      "ShiftType",
      sql.NVarChar,
      shiftType || (isDayOff ? "DAY_OFF" : "NORMAL"),
    )
    .input("IsDayOff", sql.Bit, isDayOff)
    .input("Notes", sql.NVarChar, notes).query(`
      UPDATE WorkShifts
      SET EmployeeId = @EmployeeId,
          ShiftDate = @ShiftDate,
          StartTime = @StartTime,
          EndTime = @EndTime,
          ShiftType = @ShiftType,
          IsDayOff = @IsDayOff,
          Notes = @Notes
      WHERE ShiftId = @ShiftId
    `);

  return getById(id);
}

async function remove(id) {
  const current = await getById(id);

  const pool = await connectDB();

  const ap = await pool
    .request()
    .input("EmployeeId", sql.Int, current.EmployeeId)
    .input("ShiftDate", sql.Date, dateOnly(current.ShiftDate)).query(`
      SELECT TOP 1 AppointmentId
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @ShiftDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW')
    `);

  if (ap.recordset[0]) {
    throw new Error(
      "Không thể xóa ca vì nhân viên đã có lịch hẹn trong ngày này",
    );
  }

  await pool
    .request()
    .input("ShiftId", sql.Int, Number(id))
    .query(`DELETE FROM WorkShifts WHERE ShiftId = @ShiftId`);

  return { ShiftId: Number(id) };
}

module.exports = {
  getTechnicians,
  list,
  getById,
  create,
  update,
  remove,
};
