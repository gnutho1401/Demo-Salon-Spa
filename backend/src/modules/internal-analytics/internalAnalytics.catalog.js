const EXTERNAL_ROLES = new Set(["CUSTOMER", "GUEST"]);

const CHART_DEFINITIONS = {
  revenueTrend: {
    key: "revenueTrend",
    title: "Nhịp doanh thu",
    description: "Doanh thu đã thanh toán trong phạm vi toàn hệ thống.",
    type: "area",
    valueType: "currency",
    defaultFilter: "last30Days",
    roles: ["ADMIN"],
  },
  profitCost: {
    key: "profitCost",
    title: "Lợi nhuận & chi phí nhân sự",
    description: "Đối chiếu doanh thu, hoa hồng và lợi nhuận ước tính.",
    type: "composed",
    valueType: "currency",
    defaultFilter: "thisMonth",
    roles: ["ADMIN"],
  },
  activeUsers: {
    key: "activeUsers",
    title: "Người dùng theo trạng thái",
    description: "Tài khoản được tạo trong kỳ, phân theo trạng thái hoạt động.",
    type: "donut",
    valueType: "number",
    defaultFilter: "thisYear",
    roles: ["ADMIN"],
  },
  departmentPerformance: {
    key: "departmentPerformance",
    title: "Hiệu suất chi nhánh",
    description: "Doanh thu và số lịch hoàn thành theo chi nhánh.",
    type: "bar",
    valueType: "currency",
    defaultFilter: "thisMonth",
    roles: ["ADMIN"],
  },
  systemActivity: {
    key: "systemActivity",
    title: "Nhật ký hệ thống",
    description: "Khối lượng thao tác nội bộ theo loại hành động.",
    type: "bar",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["ADMIN"],
  },
  appointmentStatus: {
    key: "appointmentStatus",
    title: "Trạng thái lịch hẹn",
    description: "Phân bổ lịch hẹn toàn hệ thống theo trạng thái.",
    type: "donut",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["ADMIN"],
    catalog: false,
  },
  paymentStatus: {
    key: "paymentStatus",
    title: "Trạng thái thanh toán",
    description: "Phân bổ giao dịch trong khoảng thời gian đang chọn.",
    type: "donut",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["ADMIN"],
    catalog: false,
  },
  servicePerformance: {
    key: "servicePerformance",
    title: "Dịch vụ được đặt nhiều",
    description: "Xếp hạng dịch vụ theo số lượt đặt trong kỳ.",
    type: "bar",
    valueType: "number",
    defaultFilter: "last30Days",
    roles: ["ADMIN"],
    catalog: false,
  },
  departmentSales: {
    key: "departmentSales",
    title: "Doanh số chi nhánh",
    description: "Doanh thu trong phạm vi chi nhánh do quản lý phụ trách.",
    type: "area",
    valueType: "currency",
    defaultFilter: "last30Days",
    roles: ["MANAGER"],
  },
  teamKpi: {
    key: "teamKpi",
    title: "KPI đội nhóm",
    description: "Lịch hoàn thành và điểm đánh giá của nhân sự trong phạm vi quản lý.",
    type: "bar",
    valueType: "number",
    defaultFilter: "thisMonth",
    roles: ["ADMIN", "MANAGER"],
  },
  workProgress: {
    key: "workProgress",
    title: "Tiến độ công việc",
    description: "Trạng thái lịch hẹn của chi nhánh trong kỳ.",
    type: "donut",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["MANAGER"],
  },
  personalKpi: {
    key: "personalKpi",
    title: "KPI cá nhân",
    description: "Số ca hoàn thành và thu nhập ghi nhận theo thời gian.",
    type: "composed",
    valueType: "number",
    defaultFilter: "last30Days",
    roles: ["STAFF"],
  },
  personalWorkload: {
    key: "personalWorkload",
    title: "Tiến độ công việc cá nhân",
    description: "Các lịch được giao cho bạn, phân theo trạng thái.",
    type: "donut",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["STAFF"],
  },
  personalActivity: {
    key: "personalActivity",
    title: "Nhịp thao tác cá nhân",
    description: "Các thao tác nghiệp vụ do chính tài khoản của bạn thực hiện.",
    type: "bar",
    valueType: "number",
    defaultFilter: "last7Days",
    roles: ["STAFF"],
  },
};

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

function isInternalRole(role) {
  const normalized = normalizeRole(role);
  return Boolean(normalized) && !EXTERNAL_ROLES.has(normalized);
}

function roleGroup(role) {
  const normalized = normalizeRole(role);
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "MANAGER") return "MANAGER";
  return isInternalRole(normalized) ? "STAFF" : "EXTERNAL";
}

function canAccessChart(role, chartKey) {
  const definition = CHART_DEFINITIONS[chartKey];
  if (!definition || !isInternalRole(role)) return false;
  return definition.roles.includes(roleGroup(role));
}

function publicDefinition(definition, role) {
  const { roles, catalog, ...safeDefinition } = definition;
  return {
    ...safeDefinition,
    canExport: normalizeRole(role) === "ADMIN",
  };
}

function getCatalogForRole(role) {
  if (!isInternalRole(role)) return [];
  return Object.values(CHART_DEFINITIONS)
    .filter((definition) => definition.catalog !== false)
    .filter((definition) => definition.roles.includes(roleGroup(role)))
    .map((definition) => publicDefinition(definition, role));
}

module.exports = {
  CHART_DEFINITIONS,
  EXTERNAL_ROLES,
  normalizeRole,
  isInternalRole,
  roleGroup,
  canAccessChart,
  getCatalogForRole,
  publicDefinition,
};
