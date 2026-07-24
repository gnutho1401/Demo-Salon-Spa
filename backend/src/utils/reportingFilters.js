const REPORTING_TIME_ZONE = "Asia/Ho_Chi_Minh";

const SUPPORTED_FILTER_TYPES = new Set([
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "thisMonth",
  "lastMonth",
  "customMonth",
  "thisYear",
  "year",
  "custom",
]);

class ReportingFilterError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReportingFilterError";
    this.statusCode = 400;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDateOnly(value, fieldName) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ReportingFilterError(`${fieldName} phải có định dạng YYYY-MM-DD`);
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = dateFromParts(year, month, day);
  if (formatDate(date) !== raw) {
    throw new ReportingFilterError(`${fieldName} không phải là ngày hợp lệ`);
  }
  return raw;
}

function shiftDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = dateFromParts(year, month, day);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
}

function todayInTimeZone(now = new Date(), timeZone = REPORTING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function monthRange(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ReportingFilterError("Năm lọc không hợp lệ");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ReportingFilterError("Tháng lọc không hợp lệ");
  }

  const first = dateFromParts(year, month, 1);
  const last = dateFromParts(year, month + 1, 0);
  return { startDate: formatDate(first), endDate: formatDate(last) };
}

function daySpan(startDate, endDate) {
  const start = dateFromParts(...startDate.split("-").map(Number));
  const end = dateFromParts(...endDate.split("-").map(Number));
  return Math.round((end - start) / 86400000) + 1;
}

function resolveReportingRange(filters = {}, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || REPORTING_TIME_ZONE;
  const today = todayInTimeZone(now, timeZone);
  const filterType = String(filters.filterType || "last30Days").trim();

  if (!SUPPORTED_FILTER_TYPES.has(filterType)) {
    throw new ReportingFilterError("filterType không được hỗ trợ");
  }

  let startDate;
  let endDate;

  if (filterType === "today") {
    startDate = today;
    endDate = today;
  } else if (filterType === "yesterday") {
    startDate = shiftDays(today, -1);
    endDate = startDate;
  } else if (filterType === "last7Days") {
    startDate = shiftDays(today, -6);
    endDate = today;
  } else if (filterType === "last30Days") {
    startDate = shiftDays(today, -29);
    endDate = today;
  } else if (filterType === "thisMonth") {
    const [year, month] = today.split("-").map(Number);
    ({ startDate, endDate } = monthRange(year, month));
  } else if (filterType === "lastMonth") {
    const [year, month] = today.split("-").map(Number);
    const previous = dateFromParts(year, month - 1, 1);
    ({ startDate, endDate } = monthRange(
      previous.getUTCFullYear(),
      previous.getUTCMonth() + 1,
    ));
  } else if (filterType === "customMonth") {
    const monthValue = String(filters.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthValue)) {
      throw new ReportingFilterError("month phải có định dạng YYYY-MM");
    }
    const [year, month] = monthValue.split("-").map(Number);
    ({ startDate, endDate } = monthRange(year, month));
  } else if (filterType === "thisYear" || filterType === "year") {
    const currentYear = Number(today.slice(0, 4));
    const year = filterType === "year" ? Number(filters.year) : currentYear;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new ReportingFilterError("year phải nằm trong khoảng 2000–2100");
    }
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = parseDateOnly(filters.startDate, "startDate");
    endDate = parseDateOnly(filters.endDate, "endDate");
  }

  if (startDate > endDate) {
    throw new ReportingFilterError("startDate không được sau endDate");
  }

  const spanDays = daySpan(startDate, endDate);
  if (spanDays > 366) {
    throw new ReportingFilterError(
      "Khoảng thời gian tối đa cho một biểu đồ là 366 ngày",
    );
  }

  return {
    filterType,
    startDate,
    endDate,
    spanDays,
    granularity: spanDays > 62 ? "month" : "day",
    timeZone,
  };
}

module.exports = {
  REPORTING_TIME_ZONE,
  SUPPORTED_FILTER_TYPES,
  ReportingFilterError,
  resolveReportingRange,
  todayInTimeZone,
};
