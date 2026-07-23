const {
  ReportingFilterError,
  resolveReportingRange,
} = require("../../src/utils/reportingFilters");

const NOW = new Date("2026-07-22T05:00:00.000Z");

describe("reportingFilters", () => {
  it.each([
    ["today", "2026-07-22", "2026-07-22"],
    ["yesterday", "2026-07-21", "2026-07-21"],
    ["last7Days", "2026-07-16", "2026-07-22"],
    ["last30Days", "2026-06-23", "2026-07-22"],
    ["thisMonth", "2026-07-01", "2026-07-31"],
    ["lastMonth", "2026-06-01", "2026-06-30"],
    ["thisYear", "2026-01-01", "2026-12-31"],
  ])("resolves %s", (filterType, startDate, endDate) => {
    expect(resolveReportingRange({ filterType }, { now: NOW })).toMatchObject({
      filterType,
      startDate,
      endDate,
      timeZone: "Asia/Ho_Chi_Minh",
    });
  });

  it("resolves a custom month and custom year", () => {
    expect(resolveReportingRange({ filterType: "customMonth", month: "2024-02" }, { now: NOW }))
      .toMatchObject({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(resolveReportingRange({ filterType: "year", year: "2025" }, { now: NOW }))
      .toMatchObject({ startDate: "2025-01-01", endDate: "2025-12-31", granularity: "month" });
  });

  it("accepts a valid custom range", () => {
    expect(resolveReportingRange({
      filterType: "custom",
      startDate: "2026-07-01",
      endDate: "2026-07-15",
    }, { now: NOW })).toMatchObject({ spanDays: 15, granularity: "day" });
  });

  it.each([
    [{ filterType: "unknown" }],
    [{ filterType: "custom", startDate: "2026-07-20", endDate: "2026-07-01" }],
    [{ filterType: "custom", startDate: "2026-02-30", endDate: "2026-03-01" }],
    [{ filterType: "custom", startDate: "2024-01-01", endDate: "2026-01-01" }],
  ])("rejects invalid filters", (filters) => {
    expect(() => resolveReportingRange(filters, { now: NOW })).toThrow(ReportingFilterError);
  });
});
