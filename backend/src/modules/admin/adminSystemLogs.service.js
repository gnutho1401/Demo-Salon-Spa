const { sql, connectDB } = require("../../config/db");

function normalizeText(value) {
  return String(value || "").trim();
}

async function getLogFilters() {
  const pool = await connectDB();
  const usersRes = await pool.query(`
    SELECT DISTINCT l.UserId, u.FullName AS UserName
    FROM SystemLogs l
    JOIN Users u ON l.UserId = u.UserId
    WHERE l.UserId IS NOT NULL
    ORDER BY UserName ASC
  `);
  const typesRes = await pool.query(`
    SELECT DISTINCT ActionType
    FROM SystemLogs
    WHERE ActionType IS NOT NULL AND ActionType <> ''
    ORDER BY ActionType ASC
  `);
  return {
    users: usersRes.recordset,
    actionTypes: typesRes.recordset.map((r) => r.ActionType),
  };
}

async function list(filters = {}) {
  const pool = await connectDB();
  const keyword = normalizeText(filters.keyword);
  const actionType = normalizeText(filters.actionType);
  const fromDate = filters.fromDate || null;
  const toDate = filters.toDate || null;
  const userId = filters.userId ? parseInt(filters.userId, 10) : null;
  const moduleName = normalizeText(filters.module);

  const page = Math.max(1, parseInt(filters.page || 1, 10));
  const limit = Math.max(1, parseInt(filters.limit || 15, 10));
  const offset = (page - 1) * limit;

  const request = pool.request();
  request.input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null);
  request.input("ActionType", sql.NVarChar, actionType || null);
  request.input("FromDate", sql.Date, fromDate || null);
  request.input("ToDate", sql.Date, toDate || null);
  request.input("UserId", sql.Int, userId || null);
  request.input("Module", sql.NVarChar, moduleName ? `%${moduleName}%` : null);
  request.input("Offset", sql.Int, offset);
  request.input("Limit", sql.Int, limit);

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
      l.CreatedAt,
      COUNT(*) OVER() AS TotalCount
    FROM SystemLogs l
    LEFT JOIN Users u ON l.UserId = u.UserId
    WHERE
      (@Keyword IS NULL OR u.FullName LIKE @Keyword OR u.Email LIKE @Keyword OR l.ActionName LIKE @Keyword OR l.Description LIKE @Keyword)
      AND (@ActionType IS NULL OR l.ActionType = @ActionType)
      AND (@FromDate IS NULL OR CAST(l.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(l.CreatedAt AS DATE) <= @ToDate)
      AND (@UserId IS NULL OR l.UserId = @UserId)
      AND (@Module IS NULL OR l.ActionName LIKE @Module OR l.Description LIKE @Module)
    ORDER BY l.LogId DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
  `);

  const logs = result.recordset;
  const totalCount = logs.length > 0 ? logs[0].TotalCount : 0;

  return {
    logs: logs.map((l) => {
      const copy = { ...l };
      delete copy.TotalCount;
      return copy;
    }),
    totalCount,
    page,
    limit,
  };
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

async function writeLog({
  userId = null,
  roleName = null,
  actionName = "",
  actionType = "",
  description = "",
  ipAddress = null,
  oldValue = null,
  newValue = null,
}) {
  const pool = await connectDB();
  await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("RoleName", sql.NVarChar, roleName)
    .input("ActionName", sql.NVarChar, actionName)
    .input("ActionType", sql.NVarChar, actionType)
    .input("Description", sql.NVarChar, description)
    .input("IpAddress", sql.NVarChar, ipAddress)
    .input("OldValue", sql.NVarChar, oldValue)
    .input("NewValue", sql.NVarChar, newValue).query(`
      INSERT INTO SystemLogs (UserId, RoleName, ActionName, ActionType, Description, IpAddress, OldValue, NewValue)
      VALUES (@UserId, @RoleName, @ActionName, @ActionType, @Description, @IpAddress, @OldValue, @NewValue)
    `);
}

module.exports = { list, getById, writeLog, getLogFilters };
