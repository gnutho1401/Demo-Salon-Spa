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
  const shiftDate = dateOnly(filters.shiftDate || filters.date);
  const status = text(filters.status); // 'OPEN', 'FULL', 'CLOSED'

  const result = await pool.request()
    .input("ShiftDate", sql.Date, shiftDate)
    .input("Status", sql.VarChar(20), status)
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
        ws.CreatedAt
      FROM WorkShifts ws
      WHERE (@ShiftDate IS NULL OR ws.ShiftDate = @ShiftDate)
        AND (@Status IS NULL OR ws.Status = @Status)
      ORDER BY ws.ShiftDate DESC, ws.StartTime ASC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input("ShiftId", sql.Int, Number(id))
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
        ws.CreatedAt
      FROM WorkShifts ws
      WHERE ws.ShiftId = @ShiftId
    `);
  if (!result.recordset[0]) throw new Error("Không tìm thấy ca làm");
  return result.recordset[0];
}

async function create(data) {
  const name = text(data.shiftName || data.ShiftName || data.name);
  const dateStr = dateOnly(data.shiftDate || data.ShiftDate || data.date);
  const startTime = normalizeTime(data.startTime || data.StartTime || data.start_time);
  const endTime = normalizeTime(data.endTime || data.EndTime || data.end_time);
  const maxTech = toInt(data.maxTechnicians || data.MaxTechnicians || data.max_technicians, 6);
  const status = text(data.status || data.Status || 'OPEN');

  if (!name) throw new Error("Vui lòng nhập tên ca làm");
  if (!dateStr) throw new Error("Vui lòng chọn ngày làm");
  if (!startTime || !endTime) throw new Error("Vui lòng nhập giờ bắt đầu và kết thúc");
  if (startTime >= endTime) throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");

  const pool = await connectDB();
  const result = await pool.request()
    .input("ShiftName", sql.NVarChar(100), name)
    .input("ShiftDate", sql.Date, dateStr)
    .input("StartTime", sql.VarChar(15), startTime)
    .input("EndTime", sql.VarChar(15), endTime)
    .input("MaxTechnicians", sql.Int, maxTech)
    .input("Status", sql.NVarChar(20), status)
    .query(`
      INSERT INTO WorkShifts (ShiftName, ShiftDate, StartTime, EndTime, MaxTechnicians, Status)
      OUTPUT 
        INSERTED.ShiftId,
        INSERTED.ShiftName,
        INSERTED.ShiftDate,
        CONVERT(VARCHAR(5), INSERTED.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), INSERTED.EndTime, 108) AS EndTime,
        INSERTED.MaxTechnicians,
        INSERTED.Status,
        INSERTED.CreatedAt
      VALUES (@ShiftName, @ShiftDate, @StartTime, @EndTime, @MaxTechnicians, @Status)
    `);

  return result.recordset[0];
}

async function update(id, data) {
  const current = await getById(id);

  const name = text(data.shiftName || data.name || current.ShiftName);
  const dateStr = dateOnly(data.shiftDate || data.date || current.ShiftDate);
  const startTime = normalizeTime(data.startTime || data.start_time || current.StartTime);
  const endTime = normalizeTime(data.endTime || data.end_time || current.EndTime);
  const maxTech = toInt(data.maxTechnicians || data.max_technicians, current.MaxTechnicians);
  const status = text(data.status || current.Status);

  if (startTime >= endTime) throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");

  const pool = await connectDB();
  await pool.request()
    .input("ShiftId", sql.Int, Number(id))
    .input("ShiftName", sql.NVarChar(100), name)
    .input("ShiftDate", sql.Date, dateStr)
    .input("StartTime", sql.VarChar(15), startTime)
    .input("EndTime", sql.VarChar(15), endTime)
    .input("MaxTechnicians", sql.Int, maxTech)
    .input("Status", sql.NVarChar(20), status)
    .query(`
      UPDATE WorkShifts
      SET ShiftName = @ShiftName,
          ShiftDate = @ShiftDate,
          StartTime = @StartTime,
          EndTime = @EndTime,
          MaxTechnicians = @MaxTechnicians,
          Status = @Status
      WHERE ShiftId = @ShiftId
    `);

  return getById(id);
}

async function remove(id) {
  const pool = await connectDB();
  await pool.request()
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
