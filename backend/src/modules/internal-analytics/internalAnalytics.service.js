const { sql, connectDB } = require("../../config/db");
const { resolveReportingRange } = require("../../utils/reportingFilters");
const {
  CHART_DEFINITIONS,
  canAccessChart,
  getCatalogForRole,
  normalizeRole,
  publicDefinition,
  roleGroup,
} = require("./internalAnalytics.catalog");

const ANALYTICS_SCHEMA_VERSION = "1.0";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function number(value) {
  return Number(value || 0);
}

function periodExpression(column, granularity) {
  return granularity === "month"
    ? `CONVERT(char(7), ${column}, 120)`
    : `CONVERT(char(10), ${column}, 120)`;
}

async function getUserScope(pool, userId) {
  const result = await pool.request().input("UserId", sql.Int, Number(userId))
    .query(`
      SELECT TOP 1 EmployeeId, BranchId
      FROM Employees
      WHERE UserId = @UserId
    `);
  const row = result.recordset[0] || {};
  return {
    employeeId: row.EmployeeId ? Number(row.EmployeeId) : null,
    branchId: row.BranchId ? Number(row.BranchId) : null,
  };
}

function scopedRequest(pool, range, scope, userId) {
  return pool
    .request()
    .input("StartDate", sql.Date, range.startDate)
    .input("EndDate", sql.Date, range.endDate)
    .input("BranchId", sql.Int, scope.branchId)
    .input("EmployeeId", sql.Int, scope.employeeId)
    .input("UserId", sql.Int, Number(userId));
}

function appointmentScopeCondition(group, appointmentAlias = "a") {
  if (group === "MANAGER") {
    return `AND @BranchId IS NOT NULL AND ${appointmentAlias}.BranchId = @BranchId`;
  }
  if (group === "STAFF") {
    return `AND @EmployeeId IS NOT NULL AND ${appointmentAlias}.EmployeeId = @EmployeeId`;
  }
  return "";
}

function mapSingleSeries(rows) {
  return rows.map((row) => ({
    label: String(row.Label || "Không xác định"),
    value: number(row.Value),
  }));
}

function standardizeSeries(series) {
  return series.map((item, index) => {
    const metrics = Object.fromEntries(
      Object.entries(item)
        .filter(([key]) => key !== "label" && key !== "value")
        .map(([key, value]) => [
          key,
          typeof value === "number" ? value : number(value),
        ]),
    );
    return {
      id: `point-${index + 1}`,
      label: String(item.label || "Không xác định"),
      value: number(item.value),
      metrics,
    };
  });
}

function publicScope(group, scope) {
  return {
    type: group.toLowerCase(),
    branchId: group === "MANAGER" ? scope.branchId : null,
    employeeId: group === "STAFF" ? scope.employeeId : null,
  };
}

function chartPayload(
  chartKey,
  rawSeries,
  range,
  group,
  scope,
  userRole,
  generatedAt,
) {
  const series = standardizeSeries(rawSeries);
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    source: "database",
    generatedAt,
    chart: publicDefinition(CHART_DEFINITIONS[chartKey], userRole),
    range,
    scope: publicScope(group, scope),
    data: {
      series,
      totals: {
        primary: series.reduce((sum, item) => sum + item.value, 0),
      },
    },
  };
}

async function revenueTrend(context) {
  const period = periodExpression("p.PaidAt", context.range.granularity);
  const result = await context.request.query(`
    SELECT ${period} AS Label, SUM(p.Amount) AS Value
    FROM Payments p
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    WHERE p.Status = 'PAID'
      AND p.PaidAt >= @StartDate
      AND p.PaidAt < DATEADD(DAY, 1, @EndDate)
      ${appointmentScopeCondition(context.group)}
    GROUP BY ${period}
    ORDER BY Label
  `);
  return mapSingleSeries(result.recordset).map((item) => ({
    ...item,
    revenue: item.value,
  }));
}

async function profitCost(context) {
  const period = periodExpression("PaidAt", context.range.granularity);
  const result = await context.request.query(`
    WITH PaidInvoices AS (
      SELECT
        i.InvoiceId,
        MAX(p.PaidAt) AS PaidAt,
        SUM(p.Amount) AS Revenue,
        MAX(ISNULL(i.TechnicianCommissionAmount, 0) + ISNULL(i.TechnicianTipAmount, 0)) AS Cost
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      WHERE p.Status = 'PAID'
        AND p.PaidAt >= @StartDate
        AND p.PaidAt < DATEADD(DAY, 1, @EndDate)
      GROUP BY i.InvoiceId
    )
    SELECT
      ${period} AS Label,
      SUM(Revenue) AS Revenue,
      SUM(Cost) AS Cost
    FROM PaidInvoices
    GROUP BY ${period}
    ORDER BY Label
  `);
  return result.recordset.map((row) => {
    const revenue = number(row.Revenue);
    const cost = number(row.Cost);
    return {
      label: String(row.Label),
      value: revenue - cost,
      revenue,
      cost,
      profit: revenue - cost,
    };
  });
}

async function activeUsers(context) {
  const result = await context.request.query(`
    SELECT Status AS Label, COUNT(*) AS Value
    FROM Users
    WHERE CreatedAt >= @StartDate
      AND CreatedAt < DATEADD(DAY, 1, @EndDate)
    GROUP BY Status
    ORDER BY Value DESC
  `);
  return mapSingleSeries(result.recordset);
}

async function departmentPerformance(context) {
  const result = await context.request.query(`
    SELECT
      b.BranchName AS Label,
      SUM(CASE WHEN p.Status = 'PAID' THEN p.Amount ELSE 0 END) AS Value,
      COUNT(DISTINCT CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentId END) AS Appointments
    FROM Branches b
    LEFT JOIN Appointments a
      ON b.BranchId = a.BranchId
      AND a.AppointmentDate >= @StartDate
      AND a.AppointmentDate <= @EndDate
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    LEFT JOIN Payments p ON i.InvoiceId = p.InvoiceId
    WHERE b.Status = 'ACTIVE'
    GROUP BY b.BranchId, b.BranchName
    ORDER BY Value DESC, Appointments DESC
  `);
  return result.recordset.map((row) => ({
    label: row.Label,
    value: number(row.Value),
    appointments: number(row.Appointments),
  }));
}

async function systemActivity(context) {
  const result = await context.request.query(`
    SELECT ISNULL(ActionType, 'OTHER') AS Label, COUNT(*) AS Value
    FROM SystemLogs
    WHERE CreatedAt >= @StartDate
      AND CreatedAt < DATEADD(DAY, 1, @EndDate)
    GROUP BY ActionType
    ORDER BY Value DESC
  `);
  return mapSingleSeries(result.recordset);
}

async function statusDistribution(
  context,
  tableName,
  dateColumn,
  extraWhere = "",
) {
  const scope =
    tableName === "Appointments"
      ? appointmentScopeCondition(context.group)
      : appointmentScopeCondition(context.group, "a");
  const joins =
    tableName === "Payments"
      ? "JOIN Invoices i ON p.InvoiceId = i.InvoiceId JOIN Appointments a ON i.AppointmentId = a.AppointmentId"
      : "";
  const alias = tableName === "Payments" ? "p" : "a";
  const result = await context.request.query(`
    SELECT ${alias}.Status AS Label, COUNT(*) AS Value
    FROM ${tableName} ${alias}
    ${joins}
    WHERE ${alias}.${dateColumn} >= @StartDate
      AND ${alias}.${dateColumn} < DATEADD(DAY, 1, @EndDate)
      ${scope}
      ${extraWhere}
    GROUP BY ${alias}.Status
    ORDER BY Value DESC
  `);
  return mapSingleSeries(result.recordset);
}

async function servicePerformance(context) {
  const result = await context.request.query(`
    SELECT TOP 8 s.ServiceName AS Label, COUNT(DISTINCT a.AppointmentId) AS Value
    FROM Services s
    JOIN AppointmentServices aps ON s.ServiceId = aps.ServiceId
    JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    WHERE a.AppointmentDate >= @StartDate
      AND a.AppointmentDate <= @EndDate
      ${appointmentScopeCondition(context.group)}
    GROUP BY s.ServiceId, s.ServiceName
    ORDER BY Value DESC, s.ServiceName
  `);
  return mapSingleSeries(result.recordset);
}

async function teamKpi(context) {
  const branchGuard =
    context.group === "MANAGER"
      ? "AND @BranchId IS NOT NULL AND e.BranchId = @BranchId"
      : "";
  const result = await context.request.query(`
    SELECT TOP 10
      u.FullName AS Label,
      COUNT(DISTINCT CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentId END) AS Value,
      COUNT(DISTINCT a.AppointmentId) AS Appointments,
      CAST(ISNULL(rating.AverageRating, 0) AS DECIMAL(4,2)) AS Rating
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Appointments a
      ON e.EmployeeId = a.EmployeeId
      AND a.AppointmentDate >= @StartDate
      AND a.AppointmentDate <= @EndDate
    OUTER APPLY (
      SELECT AVG(CAST(r.Rating AS DECIMAL(10,2))) AS AverageRating
      FROM Reviews r
      WHERE r.EmployeeId = e.EmployeeId
        AND r.CreatedAt >= @StartDate
        AND r.CreatedAt < DATEADD(DAY, 1, @EndDate)
        AND r.Status = 'APPROVED'
    ) rating
    WHERE e.Status = 'ACTIVE'
      ${branchGuard}
    GROUP BY e.EmployeeId, u.FullName, rating.AverageRating
    ORDER BY Value DESC, Appointments DESC, u.FullName
  `);
  return result.recordset.map((row) => ({
    label: row.Label,
    value: number(row.Value),
    appointments: number(row.Appointments),
    rating: number(row.Rating),
  }));
}

async function personalKpi(context) {
  const period = periodExpression(
    "a.AppointmentDate",
    context.range.granularity,
  );
  const result = await context.request.query(`
    SELECT
      ${period} AS Label,
      COUNT(DISTINCT CASE WHEN a.Status = 'COMPLETED' THEN a.AppointmentId END) AS Value,
      SUM(CASE WHEN a.Status = 'COMPLETED' THEN ISNULL(i.TechnicianCommissionAmount, 0) + ISNULL(i.TechnicianTipAmount, 0) ELSE 0 END) AS Earnings
    FROM Appointments a
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    WHERE a.AppointmentDate >= @StartDate
      AND a.AppointmentDate <= @EndDate
      AND @EmployeeId IS NOT NULL
      AND a.EmployeeId = @EmployeeId
    GROUP BY ${period}
    ORDER BY Label
  `);
  return result.recordset.map((row) => ({
    label: String(row.Label),
    value: number(row.Value),
    completed: number(row.Value),
    earnings: number(row.Earnings),
  }));
}

async function personalActivity(context) {
  const result = await context.request.query(`
    SELECT ISNULL(ActionName, 'OTHER') AS Label, COUNT(*) AS Value
    FROM SystemLogs
    WHERE UserId = @UserId
      AND CreatedAt >= @StartDate
      AND CreatedAt < DATEADD(DAY, 1, @EndDate)
    GROUP BY ActionName
    ORDER BY Value DESC
  `);
  return mapSingleSeries(result.recordset);
}

const BUILDERS = {
  revenueTrend,
  profitCost,
  activeUsers,
  departmentPerformance,
  systemActivity,
  appointmentStatus: (context) =>
    statusDistribution(context, "Appointments", "AppointmentDate"),
  paymentStatus: (context) =>
    statusDistribution(context, "Payments", "CreatedAt"),
  servicePerformance,
  departmentSales: revenueTrend,
  teamKpi,
  workProgress: (context) =>
    statusDistribution(context, "Appointments", "AppointmentDate"),
  personalKpi,
  personalWorkload: (context) =>
    statusDistribution(context, "Appointments", "AppointmentDate"),
  personalActivity,
};

function getCatalog(user) {
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    source: "configuration",
    generatedAt: new Date().toISOString(),
    role: normalizeRole(user?.role),
    scope: roleGroup(user?.role).toLowerCase(),
    charts: getCatalogForRole(user?.role),
  };
}

function resolveChartKeys(userRole, requestedKeys) {
  const availableKeys = getCatalogForRole(userRole).map((chart) => chart.key);
  if (!requestedKeys) return availableKeys;

  const keys = Array.from(
    new Set(
      String(requestedKeys)
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
  if (!keys.length) return availableKeys;
  if (keys.length > 12)
    throw httpError("Chỉ được yêu cầu tối đa 12 biểu đồ", 400);

  const invalidKey = keys.find((key) => !CHART_DEFINITIONS[key]);
  if (invalidKey) throw httpError(`Không tìm thấy biểu đồ ${invalidKey}`, 404);
  const forbiddenKey = keys.find((key) => !canAccessChart(userRole, key));
  if (forbiddenKey)
    throw httpError(`Bạn không có quyền xem biểu đồ ${forbiddenKey}`, 403);
  return keys;
}

async function getQueryScope(pool, user) {
  const group = roleGroup(user.role);
  const scope =
    group === "ADMIN"
      ? { employeeId: null, branchId: null }
      : await getUserScope(pool, user.userId);
  return { group, scope };
}

async function getChart(chartKey, filters, user) {
  if (!CHART_DEFINITIONS[chartKey]) {
    throw httpError("Không tìm thấy biểu đồ", 404);
  }
  if (!canAccessChart(user?.role, chartKey)) {
    throw httpError("Bạn không có quyền xem biểu đồ này", 403);
  }

  const range = resolveReportingRange(filters);
  const pool = await connectDB();
  const { group, scope } = await getQueryScope(pool, user);
  const request = scopedRequest(pool, range, scope, user.userId);
  const series = await BUILDERS[chartKey]({
    request,
    range,
    scope,
    group,
    user,
  });
  return chartPayload(
    chartKey,
    series,
    range,
    group,
    scope,
    user.role,
    new Date().toISOString(),
  );
}

async function getDashboard(filters, user, requestedKeys) {
  const chartKeys = resolveChartKeys(user.role, requestedKeys);
  const range = resolveReportingRange(filters);
  const pool = await connectDB();
  const { group, scope } = await getQueryScope(pool, user);
  const generatedAt = new Date().toISOString();

  const entries = await Promise.all(
    chartKeys.map(async (chartKey) => {
      const request = scopedRequest(pool, range, scope, user.userId);
      const series = await BUILDERS[chartKey]({
        request,
        range,
        scope,
        group,
        user,
      });
      return [
        chartKey,
        chartPayload(
          chartKey,
          series,
          range,
          group,
          scope,
          user.role,
          generatedAt,
        ),
      ];
    }),
  );

  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    source: "database",
    generatedAt,
    range,
    scope: publicScope(group, scope),
    charts: Object.fromEntries(entries),
  };
}

module.exports = {
  ANALYTICS_SCHEMA_VERSION,
  getCatalog,
  getChart,
  getDashboard,
  resolveChartKeys,
  standardizeSeries,
};
