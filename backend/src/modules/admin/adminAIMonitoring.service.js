const { sql, connectDB } = require("../../config/db");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

async function list(filters = {}) {
  const pool = await connectDB();
  const type = normalizeText(filters.type);
  const checked = filters.checked;
  const fromDate = filters.fromDate || null;
  const toDate = filters.toDate || null;
  const keyword = normalizeText(filters.keyword);

  const request = pool.request();
  if (type) request.input("Type", sql.NVarChar, type);
  if (checked !== undefined && checked !== "") request.input("Checked", sql.Bit, Number(checked) ? 1 : 0);
  if (fromDate) request.input("FromDate", sql.Date, fromDate);
  if (toDate) request.input("ToDate", sql.Date, toDate);
  if (keyword) request.input("Keyword", sql.NVarChar, `%${keyword}%`);

  const result = await request.query(`
    SELECT
      ItemType,
      ItemId,
      UserId,
      UserName,
      Title,
      Content,
      Detail,
      IsChecked,
      CreatedAt
    FROM (
      SELECT
        'recommendation' AS ItemType,
        CAST(r.RecommendationId AS NVARCHAR(50)) AS ItemId,
        r.CustomerId AS UserId,
        cu.FullName AS UserName,
        ISNULL(r.RecommendationType, N'Recommendation') AS Title,
        r.Reason AS Content,
        CONCAT(N'ServiceId: ', ISNULL(CAST(r.ServiceId AS NVARCHAR(50)), N'')) AS Detail,
        CAST(0 AS BIT) AS IsChecked,
        r.CreatedAt
      FROM AIRecommendations r
      LEFT JOIN Customers c ON r.CustomerId = c.CustomerId
      LEFT JOIN Users cu ON c.UserId = cu.UserId

      UNION ALL

      SELECT
        'prediction' AS ItemType,
        CAST(p.PredictionId AS NVARCHAR(50)) AS ItemId,
        NULL AS UserId,
        NULL AS UserName,
        ISNULL(p.PredictionType, N'Prediction') AS Title,
        p.Result AS Content,
        NULL AS Detail,
        CAST(0 AS BIT) AS IsChecked,
        p.CreatedAt
      FROM AIPredictions p

      UNION ALL

      SELECT
        'chat' AS ItemType,
        CAST(c.ChatId AS NVARCHAR(50)) AS ItemId,
        c.UserId AS UserId,
        u.FullName AS UserName,
        N'Chat Log' AS Title,
        c.Question AS Content,
        c.Answer AS Detail,
        CAST(0 AS BIT) AS IsChecked,
        c.CreatedAt
      FROM AIChatLogs c
      LEFT JOIN Users u ON c.UserId = u.UserId

      UNION ALL

      SELECT
        'audit' AS ItemType,
        CAST(a.AuditId AS NVARCHAR(50)) AS ItemId,
        a.UserId AS UserId,
        u.FullName AS UserName,
        ISNULL(a.FeatureName, N'Audit') AS Title,
        a.Prompt AS Content,
        a.CheckResult AS Detail,
        ISNULL(a.IsChecked, 0) AS IsChecked,
        a.CreatedAt
      FROM AIAuditLogs a
      LEFT JOIN Users u ON a.UserId = u.UserId
    ) x
    WHERE
      (@Type IS NULL OR x.ItemType = @Type)
      AND (@Checked IS NULL OR x.IsChecked = @Checked)
      AND (@FromDate IS NULL OR CAST(x.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(x.CreatedAt AS DATE) <= @ToDate)
      AND (@Keyword IS NULL OR x.Title LIKE @Keyword OR ISNULL(x.Content, N'') LIKE @Keyword OR ISNULL(x.Detail, N'') LIKE @Keyword OR ISNULL(x.UserName, N'') LIKE @Keyword)
    ORDER BY x.CreatedAt DESC
  `);

  return result.recordset;
}

async function getById(type, id) {
  const pool = await connectDB();
  const normalizedType = normalizeText(type);
  const normalizedId = Number(id);
  if (!normalizedType || !normalizedId) throw new Error("Thiếu dữ liệu cần xem");

  if (normalizedType === "recommendation") {
    const result = await pool.request().input("Id", sql.Int, normalizedId).query(`
      SELECT
        r.RecommendationId AS ItemId,
        'recommendation' AS ItemType,
        r.CustomerId AS UserId,
        cu.FullName AS UserName,
        r.ServiceId,
        s.ServiceName,
        r.RecommendationType,
        r.Reason AS Content,
        CAST(0 AS BIT) AS IsChecked,
        r.CreatedAt
      FROM AIRecommendations r
      LEFT JOIN Customers c ON r.CustomerId = c.CustomerId
      LEFT JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN Services s ON r.ServiceId = s.ServiceId
      WHERE r.RecommendationId = @Id
    `);
    return result.recordset[0] || null;
  }

  if (normalizedType === "prediction") {
    const result = await pool.request().input("Id", sql.Int, normalizedId).query(`
      SELECT
        p.PredictionId AS ItemId,
        'prediction' AS ItemType,
        NULL AS UserId,
        NULL AS UserName,
        p.PredictionType,
        p.Result AS Content,
        CAST(0 AS BIT) AS IsChecked,
        p.CreatedAt
      FROM AIPredictions p
      WHERE p.PredictionId = @Id
    `);
    return result.recordset[0] || null;
  }

  if (normalizedType === "chat") {
    const result = await pool.request().input("Id", sql.Int, normalizedId).query(`
      SELECT
        c.ChatId AS ItemId,
        'chat' AS ItemType,
        c.UserId,
        u.FullName AS UserName,
        c.Question,
        c.Answer,
        CAST(0 AS BIT) AS IsChecked,
        c.CreatedAt
      FROM AIChatLogs c
      LEFT JOIN Users u ON c.UserId = u.UserId
      WHERE c.ChatId = @Id
    `);
    return result.recordset[0] || null;
  }

  if (normalizedType === "audit") {
    const result = await pool.request().input("Id", sql.Int, normalizedId).query(`
      SELECT
        a.AuditId AS ItemId,
        'audit' AS ItemType,
        a.UserId,
        u.FullName AS UserName,
        a.FeatureName,
        a.Prompt,
        a.AIResponse,
        a.ModelName,
        a.InputToken,
        a.OutputToken,
        a.Cost,
        a.IsChecked,
        a.CheckResult,
        a.CreatedAt
      FROM AIAuditLogs a
      LEFT JOIN Users u ON a.UserId = u.UserId
      WHERE a.AuditId = @Id
    `);
    return result.recordset[0] || null;
  }

  throw new Error("Loại dữ liệu không hợp lệ");
}

async function markChecked(type, id, data = {}) {
  const pool = await connectDB();
  const checked = data.checked !== undefined ? Number(data.checked) ? 1 : 0 : 1;
  const checkResult = normalizeText(data.checkResult || data.CheckResult || null);
  const normalizedType = normalizeText(type);
  const normalizedId = Number(id);

  if (normalizedType === "audit") {
    await pool.request()
      .input("Id", sql.Int, normalizedId)
      .input("IsChecked", sql.Bit, checked)
      .input("CheckResult", sql.NVarChar, checkResult || null)
      .query(`
        UPDATE AIAuditLogs
        SET IsChecked = @IsChecked,
            CheckResult = COALESCE(@CheckResult, CheckResult)
        WHERE AuditId = @Id
      `);
    return await getById("audit", normalizedId);
  }

  return await getById(normalizedType, normalizedId);
}

module.exports = { list, getById, markChecked };
