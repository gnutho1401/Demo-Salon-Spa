import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import GlobalAnalyticsToolbar from "./GlobalAnalyticsToolbar";
import InteractiveChartCard from "./InteractiveChartCard";
import { useAnalyticsDashboard } from "./useInteractiveChart";

const COPY = {
  admin: {
    eyebrow: "Phân tích toàn hệ thống",
    title: "Nhịp kinh doanh theo thời gian",
    description:
      "Một khoảng thời gian dùng chung cho toàn bộ biểu đồ và quyền xuất báo cáo dành riêng cho Admin.",
  },
  manager: {
    eyebrow: "Phạm vi quản lý",
    title: "Hiệu suất chi nhánh & đội nhóm",
    description:
      "Dữ liệu được giới hạn theo chi nhánh gắn với tài khoản quản lý.",
  },
  staff: {
    eyebrow: "Không gian cá nhân",
    title: "Tiến độ & KPI của bạn",
    description:
      "Chỉ hiển thị công việc và thao tác gắn với chính tài khoản đang đăng nhập.",
  },
};

export default function RoleAnalyticsDashboard({ embedded = false }) {
  const [catalog, setCatalog] = useState(null);
  const [filter, setFilter] = useState({ filterType: "last30Days" });
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    axiosClient
      .get("/internal-analytics/catalog", { signal: controller.signal })
      .then((response) => {
        const payload = response.data?.data || response.data;
        if (!payload?.schemaVersion || payload?.source !== "configuration") {
          throw new Error("Danh mục báo cáo không đúng chuẩn");
        }
        setCatalog(payload);
      })
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") {
          setError(
            requestError.response?.data?.message ||
              "Không tải được danh mục biểu đồ",
          );
        }
      });
    return () => controller.abort();
  }, []);

  const scope = catalog?.scope || "staff";
  const copy = COPY[scope] || COPY.staff;
  const chartKeys = catalog?.charts?.map((chart) => chart.key) || [];
  const analytics = useAnalyticsDashboard(chartKeys, filter, Boolean(catalog));

  if (error)
    return (
      <div className="role-analytics-error" role="alert">
        {error}
      </div>
    );

  return (
    <section
      className={`role-analytics-shell${embedded ? " is-embedded" : ""}`}
    >
      <header className="role-analytics-heading">
        <div>
          <span>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="role-scope-badge">
          <span aria-hidden="true">◉</span>
          {scope === "manager"
            ? "Theo chi nhánh"
            : scope === "admin"
              ? "Toàn hệ thống"
              : "Chỉ dữ liệu cá nhân"}
        </div>
      </header>
      <GlobalAnalyticsToolbar
        filter={filter}
        onFilterChange={setFilter}
        loading={analytics.loading}
        onRefresh={analytics.reload}
        scopeLabel={
          scope === "manager"
            ? "Theo chi nhánh"
            : scope === "admin"
              ? "Toàn hệ thống"
              : "Dữ liệu cá nhân"
        }
      />
      {!catalog ? (
        <div className="role-analytics-grid" aria-label="Đang tải biểu đồ">
          {[0, 1, 2].map((item) => (
            <div className="role-analytics-card-placeholder" key={item} />
          ))}
        </div>
      ) : (
        <div className="role-analytics-grid">
          {catalog.charts.map((chart) => (
            <InteractiveChartCard
              key={chart.key}
              chartKey={chart.key}
              title={chart.title}
              description={chart.description}
              type={chart.type}
              valueType={chart.valueType}
              canExport={chart.canExport}
              report={analytics.getChart(chart.key)}
              filter={filter}
              loading={analytics.loading}
              error={analytics.error}
              onRetry={analytics.reload}
            />
          ))}
        </div>
      )}
    </section>
  );
}
