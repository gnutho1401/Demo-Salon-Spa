const {
  canAccessChart,
  getCatalogForRole,
  isInternalRole,
  roleGroup,
} = require("../../src/modules/internal-analytics/internalAnalytics.catalog");
const requireInternalRole = require("../../src/middlewares/internalRole.middleware");

describe("internal analytics role catalog", () => {
  it("strictly excludes customer and guest roles", () => {
    expect(isInternalRole("CUSTOMER")).toBe(false);
    expect(isInternalRole("guest")).toBe(false);
    expect(getCatalogForRole("CUSTOMER")).toEqual([]);
    expect(canAccessChart("CUSTOMER", "personalKpi")).toBe(false);
  });

  it.each(["CUSTOMER", "GUEST"])("returns 403 before service access for %s", (role) => {
    const req = { user: { userId: 10, role } };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const next = jest.fn();

    requireInternalRole(req, { status }, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps global finance and system charts admin-only", () => {
    expect(canAccessChart("ADMIN", "revenueTrend")).toBe(true);
    expect(canAccessChart("ADMIN", "systemActivity")).toBe(true);
    expect(canAccessChart("MANAGER", "revenueTrend")).toBe(false);
    expect(canAccessChart("MANAGER", "systemActivity")).toBe(false);
  });

  it("gives managers only branch/team charts", () => {
    const keys = getCatalogForRole("MANAGER").map((chart) => chart.key);
    expect(keys).toEqual(["departmentSales", "teamKpi", "workProgress"]);
    expect(getCatalogForRole("MANAGER").every((chart) => chart.canExport === false)).toBe(true);
  });

  it("maps known and extended staff roles to personal charts", () => {
    expect(roleGroup("TECHNICIAN")).toBe("STAFF");
    expect(roleGroup("RECEPTIONIST")).toBe("STAFF");
    expect(roleGroup("INVENTORY_SPECIALIST")).toBe("STAFF");
    const keys = getCatalogForRole("INVENTORY_SPECIALIST").map((chart) => chart.key);
    expect(keys).toEqual(["personalKpi", "personalWorkload", "personalActivity"]);
  });

  it("allows export metadata only for admin", () => {
    expect(getCatalogForRole("ADMIN").every((chart) => chart.canExport)).toBe(true);
  });
});
