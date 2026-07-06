const { sql, connectDB } = require("../../config/db");

function normalizeText(value) {
  return String(value || "").trim();
}

async function list(filters = {}) {
  const pool = await connectDB();
  const type = normalizeText(filters.type);
  const checked = filters.checked;
  const fromDate = filters.fromDate || null;
  const toDate = filters.toDate || null;
  const keyword = normalizeText(filters.keyword);
  const feature = normalizeText(filters.feature);
  const errorOnly = Number(filters.errorOnly) ? 1 : 0;

  const request = pool.request();
  request.input("Type", sql.NVarChar, type || null);
  request.input("Checked", sql.Bit, checked !== undefined && checked !== "" ? (Number(checked) ? 1 : 0) : null);
  request.input("FromDate", sql.Date, fromDate);
  request.input("ToDate", sql.Date, toDate);
  request.input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null);
  request.input("Feature", sql.NVarChar, feature ? `%${feature}%` : null);
  request.input("ErrorOnly", sql.Bit, errorOnly);

  // 1. Get the list of all matching items
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
      CreatedAt,
      LatencyMs,
      IsError,
      Tokens,
      FeatureName
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
        r.CreatedAt,
        CAST(1200 AS INT) AS LatencyMs,
        CAST(0 AS BIT) AS IsError,
        CAST(850 AS INT) AS Tokens,
        ISNULL(r.RecommendationType, N'Recommendation') AS FeatureName
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
        p.CreatedAt,
        CAST(800 AS INT) AS LatencyMs,
        CAST(0 AS BIT) AS IsError,
        CAST(600 AS INT) AS Tokens,
        ISNULL(p.PredictionType, N'Prediction') AS FeatureName
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
        c.CreatedAt,
        CAST(1500 AS INT) AS LatencyMs,
        CASE WHEN c.Answer IS NULL OR c.Answer = '' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsError,
        CAST(1200 AS INT) AS Tokens,
        N'Chat Log' AS FeatureName
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
        a.CreatedAt,
        CAST(((ISNULL(a.InputToken, 50) + ISNULL(a.OutputToken, 100)) * 15 + 150) AS INT) AS LatencyMs,
        CASE WHEN a.AIResponse IS NULL OR a.AIResponse = '' OR LOWER(a.AIResponse) LIKE '%error%' OR LOWER(a.AIResponse) LIKE '%fail%' OR LOWER(a.CheckResult) LIKE '%error%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsError,
        CAST((ISNULL(a.InputToken, 0) + ISNULL(a.OutputToken, 0)) AS INT) AS Tokens,
        ISNULL(a.FeatureName, N'Audit') AS FeatureName
      FROM AIAuditLogs a
      LEFT JOIN Users u ON a.UserId = u.UserId
    ) x
    WHERE
      (@Type IS NULL OR x.ItemType = @Type)
      AND (@Checked IS NULL OR x.IsChecked = @Checked)
      AND (@FromDate IS NULL OR CAST(x.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(x.CreatedAt AS DATE) <= @ToDate)
      AND (@Keyword IS NULL OR x.Title LIKE @Keyword OR ISNULL(x.Content, N'') LIKE @Keyword OR ISNULL(x.Detail, N'') LIKE @Keyword OR ISNULL(x.UserName, N'') LIKE @Keyword)
      AND (@Feature IS NULL OR x.FeatureName LIKE @Feature)
      AND (@ErrorOnly = 0 OR x.IsError = 1)
    ORDER BY x.CreatedAt DESC
  `);

  // 2. Aggregate Metrics
  const statsResult = await request.query(`
    SELECT
      COUNT(*) AS RequestCount,
      SUM(Tokens) AS TokenUsage,
      CAST(SUM(CASE WHEN IsError = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 AS ErrorRate,
      AVG(LatencyMs) AS AvgLatencyMs
    FROM (
      SELECT
        CAST((ISNULL(InputToken, 0) + ISNULL(OutputToken, 0)) AS INT) AS Tokens,
        CASE WHEN AIResponse IS NULL OR AIResponse = '' OR LOWER(AIResponse) LIKE '%error%' OR LOWER(AIResponse) LIKE '%fail%' OR LOWER(CheckResult) LIKE '%error%' THEN 1 ELSE 0 END AS IsError,
        CAST(((ISNULL(InputToken, 50) + ISNULL(OutputToken, 100)) * 15 + 150) AS INT) AS LatencyMs,
        a.CreatedAt,
        ISNULL(a.FeatureName, N'Audit') AS FeatureName
      FROM AIAuditLogs a

      UNION ALL

      SELECT
        1200 AS Tokens,
        CASE WHEN Answer IS NULL OR Answer = '' THEN 1 ELSE 0 END AS IsError,
        1500 AS LatencyMs,
        CreatedAt,
        N'Chat Log' AS FeatureName
      FROM AIChatLogs
    ) s
    WHERE
      (@FromDate IS NULL OR CAST(s.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(s.CreatedAt AS DATE) <= @ToDate)
      AND (@Feature IS NULL OR s.FeatureName LIKE @Feature)
  `);

  // 3. Daily Trend
  const trendResult = await request.query(`
    SELECT
      CAST(CreatedAt AS DATE) AS LogDate,
      COUNT(*) AS RequestCount,
      SUM(CASE WHEN IsError = 1 THEN 1 ELSE 0 END) AS ErrorCount,
      SUM(Tokens) AS TokenUsage,
      AVG(LatencyMs) AS AvgLatencyMs
    FROM (
      SELECT
        CreatedAt,
        CASE WHEN AIResponse IS NULL OR AIResponse = '' OR LOWER(AIResponse) LIKE '%error%' OR LOWER(AIResponse) LIKE '%fail%' OR LOWER(CheckResult) LIKE '%error%' THEN 1 ELSE 0 END AS IsError,
        (ISNULL(InputToken, 0) + ISNULL(OutputToken, 0)) AS Tokens,
        ((ISNULL(InputToken, 50) + ISNULL(OutputToken, 100)) * 15 + 150) AS LatencyMs,
        ISNULL(FeatureName, N'Audit') AS FeatureName
      FROM AIAuditLogs

      UNION ALL

      SELECT
        CreatedAt,
        CASE WHEN Answer IS NULL OR Answer = '' THEN 1 ELSE 0 END AS IsError,
        1200 AS Tokens,
        1500 AS LatencyMs,
        N'Chat Log' AS FeatureName
      FROM AIChatLogs
    ) t
    WHERE
      (@FromDate IS NULL OR CAST(t.CreatedAt AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(t.CreatedAt AS DATE) <= @ToDate)
      AND (@Feature IS NULL OR t.FeatureName LIKE @Feature)
    GROUP BY CAST(CreatedAt AS DATE)
    ORDER BY LogDate ASC
  `);

  const stats = statsResult.recordset[0] || {};

  return {
    items: result.recordset,
    metrics: {
      requestCount: stats.RequestCount || 0,
      tokenUsage: stats.TokenUsage || 0,
      errorRate: Number(stats.ErrorRate || 0).toFixed(1),
      avgLatency: Math.round(stats.AvgLatencyMs || 0)
    },
    dailyTrend: trendResult.recordset
  };
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
