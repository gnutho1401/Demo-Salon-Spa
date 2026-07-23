const {
  ANALYTICS_SCHEMA_VERSION,
  resolveChartKeys,
  standardizeSeries,
} = require("../../src/modules/internal-analytics/internalAnalytics.service");

describe("internal analytics contract", () => {
  it("normalizes every data point into label, value and metrics", () => {
    expect(standardizeSeries([
      { label: "2026-07", value: "1200000", revenue: 1500000, cost: "300000" },
    ])).toEqual([
      {
        id: "point-1",
        label: "2026-07",
        value: 1200000,
        metrics: { revenue: 1500000, cost: 300000 },
      },
    ]);
    expect(ANALYTICS_SCHEMA_VERSION).toBe("1.0");
  });

  it("keeps one requested dashboard chart list while enforcing RBAC", () => {
    expect(resolveChartKeys("ADMIN", "revenueTrend,appointmentStatus,revenueTrend"))
      .toEqual(["revenueTrend", "appointmentStatus"]);
    expect(() => resolveChartKeys("MANAGER", "revenueTrend"))
      .toThrow("không có quyền");
    expect(() => resolveChartKeys("ADMIN", "missingChart"))
      .toThrow("Không tìm thấy");
  });

  it("returns the role catalog when keys are omitted", () => {
    expect(resolveChartKeys("MANAGER")).toEqual([
      "departmentSales",
      "teamKpi",
      "workProgress",
    ]);
  });
});
