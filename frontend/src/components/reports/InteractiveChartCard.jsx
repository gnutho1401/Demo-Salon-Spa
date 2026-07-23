import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { filterLabel } from "./ChartTimeFilter";
import { exportInteractiveChart } from "./useInteractiveChart";

const CHART_COLORS = ["#e8396c", "#d6b57e", "#10b981", "#4a3222", "#8b5cf6", "#3b82f6", "#a64238"];
const STATUS_LABELS = {
  ACTIVE: "Hoạt động",
  INACTIVE: "Không hoạt động",
  BANNED: "Bị khóa",
  COMPLETED: "Hoàn thành",
  CONFIRMED: "Đã xác nhận",
  PENDING: "Chờ xử lý",
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  NO_SHOW: "Vắng mặt",
};

function compactNumber(value) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function prettyLabel(label) {
  return STATUS_LABELS[label] || label;
}

function EmptyState() {
  return (
    <div className="interactive-chart-empty">
      <span aria-hidden="true">⌁</span>
      <strong>Chưa có dữ liệu trong kỳ này</strong>
      <small>Hãy thử một khoảng thời gian khác.</small>
    </div>
  );
}

export function ChartWidgetState({ loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="interactive-chart-loading" role="status" aria-live="polite">
        <span className="chart-skeleton chart-skeleton-summary" />
        <span className="chart-skeleton chart-skeleton-plot" />
        <span className="sr-only">Đang tải dữ liệu biểu đồ</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="interactive-chart-error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={onRetry}>Thử lại</button>
      </div>
    );
  }
  return null;
}

export function ChartExportActions({ chartKey, filter }) {
  const [exporting, setExporting] = useState("");

  async function handleExport(format) {
    try {
      setExporting(format);
      await exportInteractiveChart(chartKey, filter, format);
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="interactive-chart-export" aria-label="Xuất biểu đồ">
      <button type="button" disabled={Boolean(exporting)} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "…" : "PDF"}</button>
      <button type="button" disabled={Boolean(exporting)} onClick={() => handleExport("excel")}>{exporting === "excel" ? "…" : "Excel"}</button>
    </div>
  );
}

function ChartBody({ type, series, valueType }) {
  const data = useMemo(() => series.map((item) => ({
    ...item,
    ...(item.metrics || {}),
    label: prettyLabel(item.label),
  })), [series]);
  const formatter = (value) => valueType === "currency" ? money(value) : Number(value || 0).toLocaleString("vi-VN");
  const axisFormatter = valueType === "currency" ? compactNumber : compactNumber;

  if (!data.length) return <EmptyState />;

  if (type === "donut") {
    return (
      <div className="interactive-donut-layout">
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={3}>
              {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatter(value)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="interactive-chart-legend">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              <span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <small>{item.label}</small>
              <strong>{formatter(item.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "composed") {
    const isFinance = data.some((item) => Object.hasOwn(item, "profit"));
    return (
      <ResponsiveContainer width="100%" height={290}>
        <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="rgba(74, 50, 34, 0.1)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={54} />
          <Tooltip formatter={(value, name) => [name === "earnings" || isFinance ? money(value) : formatter(value), name]} />
          <Legend />
          {isFinance ? (
            <>
              <Bar dataKey="revenue" name="Doanh thu" fill="#d6b57e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cost" name="Chi phí" fill="#e9b8a8" radius={[6, 6, 0, 0]} />
              <Line dataKey="profit" name="Lợi nhuận" stroke="#4a3222" strokeWidth={3} dot={{ r: 3 }} />
            </>
          ) : (
            <>
              <Bar dataKey="completed" name="Ca hoàn thành" fill="#d6b57e" radius={[6, 6, 0, 0]} />
              <Line dataKey="earnings" name="Thu nhập" stroke="#4a3222" strokeWidth={3} dot={{ r: 3 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 14, right: 10, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="rgba(74, 50, 34, 0.1)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} angle={-18} textAnchor="end" height={54} interval={0} />
          <YAxis tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={54} />
          <Tooltip formatter={(value) => formatter(value)} />
          <Bar dataKey="value" name="Giá trị" radius={[7, 7, 0, 0]}>
            {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={index === 0 ? "#e8396c" : "#d6b57e"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={290}>
      <AreaChart data={data} margin={{ top: 14, right: 12, bottom: 8, left: 4 }}>
        <defs>
          <linearGradient id="interactiveRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e8396c" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#e8396c" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(74, 50, 34, 0.1)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={54} />
        <Tooltip formatter={(value) => formatter(value)} />
        <Area type="monotone" dataKey="value" name="Giá trị" stroke="#e8396c" strokeWidth={3} fill="url(#interactiveRevenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function InteractiveChartCard({
  chartKey,
  title,
  description,
  type = "area",
  valueType = "number",
  canExport = false,
  className = "",
  report,
  filter,
  loading = false,
  error = "",
  onRetry,
}) {
  const chart = report?.chart || { title, description, type, valueType };
  const series = report?.data?.series || [];

  return (
    <article className={`chart-card interactive-chart-card ${className}`.trim()} aria-busy={loading}>
      <div className="interactive-chart-header">
        <div>
          <span className="interactive-chart-kicker">Đồng bộ toàn trang · {filterLabel(filter)}</span>
          <h3>{title || chart.title}</h3>
          <p>{description || chart.description}</p>
        </div>
        <div className="interactive-chart-actions">
          {canExport && (
            <ChartExportActions chartKey={chartKey} filter={filter} />
          )}
        </div>
      </div>
      <div className="interactive-chart-canvas">
        <ChartWidgetState loading={loading} error={error} onRetry={onRetry} />
        {!error && <ChartBody type={type || chart.type} series={series} valueType={valueType || chart.valueType} />}
      </div>
    </article>
  );
}
