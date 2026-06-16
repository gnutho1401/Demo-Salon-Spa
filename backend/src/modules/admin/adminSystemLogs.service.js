const { sql, connectDB } = require("../../config/db");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

async function list(filters = {}) {
  const pool = await connectDB();
  const keyword = normalizeText(filters.keyword);
  const actionType = normalizeText(filters.actionType);
  const fromDate = filters.fromDate || null;
  const toDate = filters.toDate || null;

  const request = pool.request();
  if (keyword) request.input("Keyword", sql.NVarChar, `%${keyword}%`);
  if (actionType) request.input("ActionType", sql.NVarChar, actionType);
  if (fromDate) request.input("FromDate", sql.Date, fromDate);
  if (toDate) request.input("ToDate", sql.Date, toDate);

  const result = await request.query(`
    SELECT
      l.LogId,
      l.UserId,
      u.FullName AS UserName,
      u.Email,
      l.RoleName,
      l.ActionName,
      l.ActionType,
      l.Description,
      l.IpAddress,
      l.OldValue,
      l.NewValue,
      l.CreatedAt
    FROM SystemLogs l
    LEFT JOIN Users u ON l.UserId = u.UserId
    WHERE
      (@Keyword IS NULL OR u.FullName LIKE @Keyword OR u.Email LIKE @Keyword OR l.ActionName LIKE @Keyword OR l.Description LIKE @Keyword)
      AND (@ActionType IS NULL OR l.ActionType = @ActionType)
      AND (@FromDate IS NULL OR CAST(l.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(l.CreatedAt AS DATE) <= @ToDate)
    ORDER BY l.LogId DESC
  `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input("LogId", sql.Int, id).query(`
    SELECT
      l.LogId,
      l.UserId,
      u.FullName AS UserName,
      u.Email,
      l.RoleName,
      l.ActionName,
      l.ActionType,
      l.Description,
      l.IpAddress,
      l.OldValue,
      l.NewValue,
      l.CreatedAt
    FROM SystemLogs l
    LEFT JOIN Users u ON l.UserId = u.UserId
    WHERE l.LogId = @LogId
  `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy log");
  return row;
}

async function writeLog({ userId = null, roleName = null, actionName = "", actionType = "", description = "", ipAddress = null, oldValue = null, newValue = null }) {
  const pool = await connectDB();
  await pool.request()
    .input("UserId", sql.Int, userId)
    .input("RoleName", sql.NVarChar, roleName)
    .input("ActionName", sql.NVarChar, actionName)
    .input("ActionType", sql.NVarChar, actionType)
    .input("Description", sql.NVarChar, description)
    .input("IpAddress", sql.NVarChar, ipAddress)
    .input("OldValue", sql.NVarChar, oldValue)
    .input("NewValue", sql.NVarChar, newValue)
    .query(`
      INSERT INTO SystemLogs (UserId, RoleName, ActionName, ActionType, Description, IpAddress, OldValue, NewValue)
      VALUES (@UserId, @RoleName, @ActionName, @ActionType, @Description, @IpAddress, @OldValue, @NewValue)
    `);
}

module.exports = { list, getById, writeLog };
