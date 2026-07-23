import ChartTimeFilter, { filterLabel } from "./ChartTimeFilter";

export default function GlobalAnalyticsToolbar({
  filter,
  onFilterChange,
  loading = false,
  onRefresh,
  scopeLabel = "Toàn hệ thống",
}) {
  return (
    <section className="global-analytics-toolbar" aria-label="Điều khiển dữ liệu biểu đồ">
      <div className="global-analytics-actions">
        <div className="global-analytics-context">
          <span className="global-analytics-pulse" aria-hidden="true" />
          <span>
            <small>Khoảng phân tích</small>
            <strong>{filterLabel(filter)}</strong>
          </span>
        </div>
        <ChartTimeFilter
          value={filter}
          onChange={onFilterChange}
          disabled={loading}
          scopeLabel="Áp dụng đồng thời cho mọi biểu đồ"
        />
        <button
          className="global-analytics-refresh"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
          {loading ? "Đang đồng bộ" : "Đồng bộ lại"}
        </button>
      </div>
      <div className="global-analytics-source" title="Không sử dụng dữ liệu giả">
        <span aria-hidden="true" />
        SQL Server · {scopeLabel}
      </div>
    </section>
  );
}
