import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("vi-VN");
}

function timeText(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusLabel(status) {
  const map = {
    PENDING: "Chờ duyệt",
    CONFIRMED: "Đã xác nhận",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    PAID: "Đã thanh toán",
    FAILED: "Thanh toán lỗi",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
    ACTIVE: "Đang hoạt động",
    INACTIVE: "Không hoạt động",
    BANNED: "Bị khóa",
  };
  return map[status] || status;
}

function statusClass(status) {
  return `admin-status admin-status-${String(status || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function safeAvatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

/* ─────────── Stat Card (clickable) ─────────── */
function StatCard({ label, value, note, icon, colorClass, onClick }) {
  const CardElement = onClick ? "button" : "article";
  return (
    <CardElement
      type={onClick ? "button" : undefined}
      className={`admin-stat-card-new ${colorClass || ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", position: "relative" }}
    >
      <div className="card-header-row">
        <span className="card-label">{label}</span>
        <span className="card-icon">{icon}</span>
      </div>
      <h3 className="card-value">{value}</h3>
      {note && <div className="card-note">{note}</div>}
      {onClick && (
        <span style={{
          position: "absolute", bottom: 14, right: 16,
          fontSize: "11px", fontWeight: "700", color: "#e8396c", opacity: 0.7
        }}>Xem chi tiết →</span>
      )}
    </CardElement>
  );
}

/* ─────────── Info Row ─────────── */
function InfoRow({ label, value, valueColor }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "13px",
        padding: "6px 0",
        borderBottom: "1px dashed #f0e2e5",
      }}
    >
      <span style={{ color: "#7b6874" }}>{label}</span>
      <strong style={{ color: valueColor || "#2d2430" }}>{value}</strong>
    </div>
  );
}

function ActionChip({ children, onClick, urgent = false }) {
  return (
    <button
      className={`dashboard-action-chip${urgent ? " is-urgent" : ""}`}
      type="button"
      onClick={onClick}
    >
      {children}
      <span aria-hidden="true">→</span>
    </button>
  );
}

/* ─────────── Mini Panel ─────────── */
function MiniPanel({ title, icon, children, linkLabel, onLink }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #f6edf0",
        borderRadius: "20px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h4
        style={{
          margin: "0 0 14px 0",
          fontSize: "13.5px",
          fontWeight: "800",
          color: "#8a653a",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {icon} {title}
      </h4>
      <div style={{ flex: 1 }}>{children}</div>
      {linkLabel && onLink && (
        <button
          onClick={onLink}
          style={{
            marginTop: 12,
            background: "none",
            border: "1px solid #f6d0db",
            borderRadius: "999px",
            color: "#e8396c",
            fontSize: "12px",
            fontWeight: "700",
            padding: "5px 14px",
            cursor: "pointer",
            alignSelf: "flex-start",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.background = "#fdf0f4"}
          onMouseLeave={(e) => e.target.style.background = "none"}
        >
          {linkLabel} →
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  /* Quick link button style */
  const quickLinkStyle = {
    background: "none",
    border: "1px solid #f6d0db",
    borderRadius: "999px",
    color: "#e8396c",
    fontSize: "12px",
    fontWeight: "700",
    padding: "5px 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  async function loadDashboard(isRefresh = false) {
    try {
      setError("");
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get("/admin/dashboard");
      setData(res.data.data || res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dữ liệu dashboard"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const summary = data?.summary || {};

  /* ── Chart data preparations ── */
  const revenueByDayData = useMemo(() => {
    if (!data?.revenueByDay) return [];
    return data.revenueByDay.map((item) => ({
      name: new Date(item.date).toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "numeric",
      }),
      "Doanh thu": item.revenue,
    }));
  }, [data]);

  const revenueByMonthData = useMemo(() => {
    if (!data?.revenueByMonth) return [];
    return data.revenueByMonth.map((item) => ({
      name: item.month?.slice(0, 7) || "",
      "Doanh thu": item.revenue,
    }));
  }, [data]);

  const appointmentStatusData = useMemo(() => {
    if (!data?.appointmentStatus) return [];
    const map = {
      COMPLETED: { label: "Hoàn thành", color: "#10b981" },
      CONFIRMED: { label: "Đã xác nhận", color: "#3b82f6" },
      PENDING: { label: "Chờ duyệt", color: "#f59e0b" },
      CANCELLED: { label: "Đã hủy", color: "#ef4444" },
    };
    return data.appointmentStatus.map((item) => {
      const c = map[item.status] || { label: item.status, color: "#6366f1" };
      return { name: c.label, value: item.count, color: c.color };
    });
  }, [data]);

  const paymentStatusData = useMemo(() => {
    if (!data?.paymentStatus) return [];
    const map = {
      PAID: { label: "Đã thanh toán", color: "#10b981" },
      PENDING: { label: "Chờ thanh toán", color: "#f59e0b" },
      FAILED: { label: "Lỗi thanh toán", color: "#ef4444" },
    };
    return data.paymentStatus.map((item) => {
      const c = map[item.status] || { label: item.status, color: "#6366f1" };
      return { name: c.label, value: item.count, color: c.color };
    });
  }, [data]);

  const topServicesData = useMemo(() => {
    if (!data?.topServices) return [];
    return [...data.topServices]
      .sort((a, b) => b.appointmentCount - a.appointmentCount)
      .slice(0, 6)
      .map((item) => ({
        name:
          item.serviceName.length > 22
            ? item.serviceName.slice(0, 22) + "…"
            : item.serviceName,
        "Lượt đặt": item.appointmentCount,
      }));
  }, [data]);

  const formatYAxis = (v) => {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000) return (v / 1000).toFixed(0) + "K";
    return v;
  };

  const renderStars = (rating) => {
    const r = Math.round(rating || 0);
    return "★".repeat(r) + "☆".repeat(5 - r);
  };

  const TABS = [
    { key: "overview", label: "📊 Tổng quan" },
    { key: "revenue", label: "💰 Doanh thu" },
    { key: "staff", label: "💆 Nhân sự & Dịch vụ" },
    { key: "appointments", label: "📋 Lịch hẹn" },
    { key: "feedback", label: "💬 Phản hồi & Hoàn tiền" },
  ];

  return (
    <section className="admin-dashboard admin-page">
      {/* ── Hero Header (nâu vàng đặc trưng salon) ── */}
      <div className="admin-dashboard-hero">
        <div>
          <div className="admin-eyebrow">
            ⚡ HỆ THỐNG QUẢN TRỊ SALON CAO CẤP
          </div>
          <h1>Chào mừng trở lại, Admin</h1>
          <p>
            Báo cáo trực quan và số liệu tổng hợp thời gian thực từ cơ sở dữ
            liệu hệ thống.
          </p>
        </div>
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          {refreshing ? "Đang cập nhật..." : "🔄 Làm mới dữ liệu"}
        </button>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="dashboard-loading-overlay">
          <div className="spinner-large" />
          <p>Đang đồng bộ số liệu và dựng biểu đồ...</p>
        </div>
      )}
      {error && (
        <div className="dashboard-error-banner">
          ⚠️ {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── 8 Thẻ thống kê chính ── */}
          <div className="dashboard-stats-grid">
            <StatCard
              label="DOANH THU HÔM NAY"
              value={formatMoney(summary.revenueToday)}
              note="Từ các giao dịch PAID hôm nay"
              icon="💰"
              colorClass="stat-revenue-today"
              onClick={() => navigate("/admin/reports")}
            />
            <StatCard
              label="DOANH THU THÁNG NÀY"
              value={formatMoney(summary.revenueThisMonth)}
              note={`Gói liệu trình: ${formatMoney(summary.packageRevenueThisMonth)}`}
              icon="📈"
              colorClass="stat-revenue-month"
              onClick={() => navigate("/admin/reports")}
            />
            <StatCard
              label="LỊCH HẸN HÔM NAY"
              value={summary.appointmentsToday ?? 0}
              note={`Tổng: ${summary.totalAppointments ?? 0} lịch đặt`}
              icon="📅"
              colorClass="stat-appointments"
              onClick={() => navigate("/admin/reports")}
            />
            <StatCard
              label="TỔNG KHÁCH HÀNG"
              value={summary.totalCustomers ?? 0}
              note={`${summary.activeUsers ?? 0} tài khoản đang hoạt động`}
              icon="👥"
              colorClass="stat-customers"
              onClick={() => navigate("/admin/customers")}
            />
            <StatCard
              label="NHÂN SỰ HỆ THỐNG"
              value={`${summary.totalEmployees ?? 0} nhân viên`}
              note={`Điểm danh hôm nay: ${data.todayAttendance?.totalCheckedIn ?? 0} người`}
              icon="🧑‍💼"
              colorClass=""
              onClick={() => navigate("/admin/employees")}
            />
            <StatCard
              label="DỊCH VỤ ĐANG HOẠT ĐỘNG"
              value={`${summary.activeServices ?? 0} dịch vụ`}
              note={`${summary.inactiveServices ?? 0} ẩn | ${summary.activePromotions ?? 0} KM đang chạy`}
              icon="✂️"
              colorClass=""
              onClick={() => navigate("/admin/services")}
            />
            <StatCard
              label="GÓI LIỆU TRÌNH"
              value={`${summary.activePackages ?? 0} đang dùng`}
              note={`${summary.expiredPackages ?? 0} đã hết hạn`}
              icon="📦"
              colorClass=""
              onClick={() => navigate("/admin/packages")}
            />
            <StatCard
              label="VOUCHER & KHUYẾN MÃI"
              value={`${summary.totalVouchers ?? 0} voucher`}
              note={`${summary.activePromotions ?? 0} chương trình đang chạy`}
              icon="🎟️"
              colorClass=""
              onClick={() => navigate("/admin/vouchers")}
            />
          </div>

          {/* ── Thanh cảnh báo các việc cần xử lý ── */}
          {(summary.pendingAppointments > 0 ||
            summary.pendingPayments > 0 ||
            summary.pendingReviews > 0 ||
            summary.pendingFeedbacks > 0 ||
            summary.pendingRefunds > 0 ||
            summary.pendingPayouts > 0) && (
            <section className="dashboard-action-rail" aria-labelledby="operations-pulse-title">
              <div className="dashboard-action-heading">
                <span className="dashboard-action-symbol" aria-hidden="true">!</span>
                <div>
                  <p>Nhịp vận hành</p>
                  <h2 id="operations-pulse-title">Việc cần xử lý</h2>
                </div>
              </div>
              <div className="dashboard-action-list">
                {summary.pendingAppointments > 0 && (
                  <ActionChip onClick={() => navigate("/admin/reports")}>
                    {summary.pendingAppointments} lịch hẹn chờ duyệt
                  </ActionChip>
                )}
                {summary.pendingPayments > 0 && (
                  <ActionChip onClick={() => navigate("/admin/reports")}>
                    {summary.pendingPayments} giao dịch chờ thanh toán
                  </ActionChip>
                )}
                {summary.pendingReviews > 0 && (
                  <ActionChip onClick={() => navigate("/admin/reviews")}>
                    {summary.pendingReviews} đánh giá chờ duyệt
                  </ActionChip>
                )}
                {summary.pendingFeedbacks > 0 && (
                  <ActionChip onClick={() => navigate("/admin/feedbacks")}>
                    {summary.pendingFeedbacks} phản hồi chưa đọc
                  </ActionChip>
                )}
                {summary.pendingRefunds > 0 && (
                  <ActionChip urgent onClick={() => navigate("/admin/refunds")}>
                    {summary.pendingRefunds} hoàn tiền chờ xử lý
                  </ActionChip>
                )}
                {summary.pendingPayouts > 0 && (
                  <ActionChip urgent onClick={() => navigate("/admin/employees")}>
                    {summary.pendingPayouts} payout chờ duyệt
                  </ActionChip>
                )}
              </div>
            </section>
          )}

          {/* ── Tab điều hướng ── */}
          <nav className="dashboard-subtab-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`subtab-btn${activeTab === t.key ? " active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* ════════════════════════════
              TAB: TỔNG QUAN
          ════════════════════════════ */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Biểu đồ doanh thu 7 ngày + 2 donut */}
              <div className="overview-tab-layout">
                <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>Doanh thu 7 ngày gần nhất</h3>
                    <p>Tổng thu từ các giao dịch đã thanh toán trong tuần</p>
                  </div>
                  <button onClick={() => navigate("/admin/reports")} style={quickLinkStyle}>Báo cáo chi tiết →</button>
                </div>
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart
                      data={revenueByDayData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="areaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#e8396c"
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="95%"
                            stopColor="#e8396c"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0e2e5"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#a38f9d"
                        tickLine={false}
                        axisLine={false}
                        style={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={formatYAxis}
                        stroke="#a38f9d"
                        tickLine={false}
                        axisLine={false}
                        style={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v) => [formatMoney(v), "Doanh thu"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="Doanh thu"
                        stroke="#e8396c"
                        strokeWidth={2.5}
                        fill="url(#areaGrad)"
                        dot={{ fill: "#e8396c", r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>

                <div className="donut-charts-row">
                  <article className="chart-card">
                    <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3>Trạng thái Lịch hẹn</h3>
                        <p>Toàn bộ trong hệ thống</p>
                      </div>
                      <button onClick={() => navigate("/admin/reports")} style={quickLinkStyle}>Quản lý →</button>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={appointmentStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={72}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {appointmentStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [`${v} lịch`, "Số lượng"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-custom-legend">
                      {appointmentStatusData.map((item, i) => (
                        <div className="legend-item" key={i}>
                          <span
                            className="legend-dot"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="legend-label">
                            {item.name}: <strong>{item.value}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="chart-card">
                    <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3>Trạng thái Thanh toán</h3>
                        <p>Theo bảng Payments trong CSDL</p>
                      </div>
                      <button onClick={() => navigate("/admin/reports")} style={quickLinkStyle}>Xem hóa đơn →</button>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={paymentStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={72}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {paymentStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [`${v} giao dịch`, "Số lượng"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-custom-legend">
                      {paymentStatusData.map((item, i) => (
                        <div className="legend-item" key={i}>
                          <span
                            className="legend-dot"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="legend-label">
                            {item.name}: <strong>{item.value}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>

              {/* Bảng phân tích vận hành chi tiết */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>📊 Bảng phân tích vận hành chi tiết</h3>
                    <p>Toàn bộ trạng thái các phân hệ trong cơ sở dữ liệu hệ thống</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
                  <MiniPanel title="Tài Khoản Người Dùng" icon="👤" linkLabel="Quản lý users" onLink={() => navigate("/admin/users")}>
                    <InfoRow label="Đang hoạt động" value={summary.activeUsers ?? 0} valueColor="#10b981" />
                    <InfoRow label="Không hoạt động" value={summary.inactiveUsers ?? 0} />
                    <InfoRow label="Bị khóa (Banned)" value={summary.bannedUsers ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Chi Tiết Lịch Hẹn" icon="📅" linkLabel="Xem lịch hẹn" onLink={() => navigate("/admin/reports")}>
                    <InfoRow label="Chờ duyệt" value={summary.pendingAppointments ?? 0} valueColor="#f59e0b" />
                    <InfoRow label="Đã xác nhận" value={summary.confirmedAppointments ?? 0} valueColor="#3b82f6" />
                    <InfoRow label="Hoàn thành" value={summary.completedAppointments ?? 0} valueColor="#10b981" />
                    <InfoRow label="Đã hủy" value={summary.cancelledAppointments ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Gói Liệu Trình" icon="📦" linkLabel="Quản lý gói" onLink={() => navigate("/admin/packages")}>
                    <InfoRow label="Đang sử dụng (Active)" value={summary.activePackages ?? 0} valueColor="#8b5cf6" />
                    <InfoRow label="Đã hết hạn" value={summary.expiredPackages ?? 0} />
                    <InfoRow label="Doanh thu gói tháng này" value={formatMoney(summary.packageRevenueThisMonth)} valueColor="#10b981" />
                  </MiniPanel>
                  <MiniPanel title="Hoàn Tiền & Payout" icon="💳" linkLabel="Xem hoàn tiền" onLink={() => navigate("/admin/refunds")}>
                    <InfoRow label="Hoàn tiền chờ xử lý" value={summary.pendingRefunds ?? 0} valueColor="#f59e0b" />
                    <InfoRow label="Hoàn tiền hoàn tất" value={summary.completedRefunds ?? 0} valueColor="#10b981" />
                    <InfoRow label="Payout KTV chờ duyệt" value={summary.pendingPayouts ?? 0} valueColor="#f59e0b" />
                    <InfoRow label="Đã chi trả (Approved)" value={formatMoney(summary.totalPaidOut)} />
                  </MiniPanel>
                  <MiniPanel title="Hàng Chờ (Waiting List)" icon="⏳" linkLabel="Xem hàng chờ" onLink={() => navigate("/admin/reports")}>
                    <InfoRow label="Tổng đăng ký" value={summary.totalWaitingCount ?? 0} />
                    <InfoRow label="Đã match / booked" value={summary.matchedWaitingCount ?? 0} valueColor="#10b981" />
                    <InfoRow label="Đã đặt lịch thành công" value={summary.bookedWaitingCount ?? 0} valueColor="#3b82f6" />
                    <InfoRow label="Hết hạn / Bỏ qua" value={summary.expiredWaitingCount ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Điểm Danh Hôm Nay" icon="🧑‍💼" linkLabel="Xem nhân viên" onLink={() => navigate("/admin/employees")}>
                    <InfoRow label="Đã check-in" value={data.todayAttendance?.totalCheckedIn ?? 0} />
                    <InfoRow label="Đúng giờ" value={data.todayAttendance?.present ?? 0} valueColor="#10b981" />
                    <InfoRow label="Đến muộn" value={data.todayAttendance?.late ?? 0} valueColor="#f59e0b" />
                    <InfoRow label="Vắng mặt" value={data.todayAttendance?.absent ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                </div>
              </article>
            </div>
          )}

          {/* ════════════════════════════
              TAB: DOANH THU
          ════════════════════════════ */}
          {activeTab === "revenue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Thẻ tóm tắt doanh thu */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                }}
              >
                {[
                  {
                    label: "Doanh thu hôm nay",
                    value: formatMoney(summary.revenueToday),
                    color: "#e8396c",
                  },
                  {
                    label: "Doanh thu tháng này",
                    value: formatMoney(summary.revenueThisMonth),
                    color: "#f97316",
                  },
                  {
                    label: "Doanh thu gói liệu trình",
                    value: formatMoney(summary.packageRevenueThisMonth),
                    color: "#8b5cf6",
                  },
                  {
                    label: "Tổng đã chi trả payout",
                    value: formatMoney(summary.totalPaidOut),
                    color: "#10b981",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #f6edf0",
                      borderRadius: "20px",
                      padding: "20px 24px",
                      borderLeft: `4px solid ${item.color}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "800",
                        color: "#a38f9d",
                        letterSpacing: "0.8px",
                        marginBottom: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "900",
                        color: item.color,
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Biểu đồ cột doanh thu 12 tháng */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>📊 Doanh thu 12 tháng gần nhất</h3>
                    <p>Tổng thu từ các giao dịch đã thanh toán theo từng tháng</p>
                  </div>
                  <button onClick={() => navigate("/admin/reports")} style={quickLinkStyle}>Báo cáo →</button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={revenueByMonthData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0e2e5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#a38f9d"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      stroke="#a38f9d"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) => [formatMoney(v), "Doanh thu"]}
                    />
                    <Bar
                      dataKey="Doanh thu"
                      fill="#e8396c"
                      radius={[6, 6, 0, 0]}
                      barSize={24}
                    >
                      {revenueByMonthData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === revenueByMonthData.length - 1
                              ? "#e8396c"
                              : "#fda4c0"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </article>

              {/* Bảng doanh thu gói liệu trình */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>📦 Bảng doanh thu theo Gói Liệu Trình</h3>
                    <p>Top gói bán chạy nhất theo tổng số lượt mua</p>
                  </div>
                  <button onClick={() => navigate("/admin/packages")} style={quickLinkStyle}>Quản lý gói →</button>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tên Gói</th>
                        <th style={{ textAlign: "right" }}>Đã bán</th>
                        <th style={{ textAlign: "right" }}>Đang dùng</th>
                        <th style={{ textAlign: "right" }}>Tổng doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.packagesSummary || []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              textAlign: "center",
                              color: "#a38f9d",
                              padding: "30px",
                            }}
                          >
                            Chưa có dữ liệu gói liệu trình
                          </td>
                        </tr>
                      ) : (
                        (data.packagesSummary || []).map((pkg, i) => (
                          <tr key={pkg.packageId}>
                            <td>
                              <span
                                style={{
                                  fontWeight: "800",
                                  color: "#e8396c",
                                }}
                              >
                                #{i + 1}
                              </span>
                            </td>
                            <td style={{ fontWeight: "700" }}>
                              {pkg.packageName}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {pkg.totalSold}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span
                                style={{
                                  background: "#f0fdf4",
                                  color: "#16a34a",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                }}
                              >
                                {pkg.activeCount}
                              </span>
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: "800",
                                color: "#10b981",
                              }}
                            >
                              {formatMoney(pkg.totalRevenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}

          {/* ════════════════════════════
              TAB: NHÂN SỰ & DỊCH VỤ
          ════════════════════════════ */}
          {activeTab === "staff" && (
            <div className="staff-services-tab-layout">
              {/* Biểu đồ cột ngang dịch vụ */}
              <article className="chart-card">
                <div className="chart-header">
                  <h3>Top 6 dịch vụ được đặt nhiều nhất</h3>
                  <p>Theo số lượng lịch hẹn tích lũy trong hệ thống</p>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={topServicesData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0e2e5"
                      vertical={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#a38f9d"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#a38f9d"
                      tickLine={false}
                      axisLine={false}
                      width={130}
                      style={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="Lượt đặt"
                      fill="#e8396c"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    >
                      {topServicesData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            [
                              "#e8396c",
                              "#ff6992",
                              "#ff91b0",
                              "#ffa9c4",
                              "#ffc2d4",
                              "#ffdce8",
                            ][i] || "#ffdce8"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </article>

              {/* Bảng xếp hạng kỹ thuật viên */}
              <article className="chart-card">
                <div className="chart-header">
                  <h3>Bảng xếp hạng Kỹ thuật viên</h3>
                  <p>Theo số lịch hẹn phục vụ và đánh giá sao trung bình</p>
                </div>
                <div className="tech-ranking-grid">
                  {(data.topTechnicians || []).map((tech, i) => (
                    <div key={tech.employeeId} className="tech-ranking-row">
                      <span className="rank-badge">{i + 1}</span>
                      <img
                        src={safeAvatar(tech.avatarUrl)}
                        alt={tech.fullName}
                        className="tech-avatar"
                        onError={(e) => {
                          e.target.src = DEFAULT_AVATAR;
                        }}
                      />
                      <div className="tech-details">
                        <h4>{tech.fullName}</h4>
                        <span className="spec">
                          {tech.specialization ||
                            tech.position ||
                            "Kỹ thuật viên"}
                        </span>
                      </div>
                      <div className="tech-stat">
                        <span className="lbl">
                          ⭐{" "}
                          {tech.avgRating
                            ? Number(tech.avgRating).toFixed(1)
                            : "—"}{" "}
                          ({tech.reviewCount} đánh giá)
                        </span>
                        <strong>{tech.appointmentCount} lịch</strong>
                      </div>
                    </div>
                  ))}
                  {(!data.topTechnicians ||
                    data.topTechnicians.length === 0) && (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#a38f9d",
                        padding: "30px",
                      }}
                    >
                      Chưa có dữ liệu kỹ thuật viên
                    </p>
                  )}
                </div>
              </article>

              {/* Phễu chuyển đổi Waiting List */}
              <article
                className="chart-card"
                style={{ gridColumn: "span 2" }}
              >
                <div className="chart-header">
                  <h3>⏳ Phễu chuyển đổi Hàng Chờ (Waiting List)</h3>
                  <p>
                    Theo dõi tỷ lệ từ đăng ký chờ đến đặt lịch thành công
                  </p>
                </div>
                <div className="funnel-metrics-grid">
                  <div className="funnel-card">
                    <div className="val">
                      {summary.totalWaitingCount ?? 0}
                    </div>
                    <h4>Tổng đăng ký</h4>
                  </div>
                  <div className="funnel-card active">
                    <div className="val">
                      {summary.matchedWaitingCount ?? 0}
                    </div>
                    <h4>Đã được match</h4>
                  </div>
                  <div className="funnel-card success">
                    <div className="val">
                      {summary.bookedWaitingCount ?? 0}
                    </div>
                    <h4>Đặt thành công</h4>
                  </div>
                  <div className="funnel-card fail">
                    <div className="val">
                      {summary.expiredWaitingCount ?? 0}
                    </div>
                    <h4>Hết hạn / Bỏ qua</h4>
                  </div>
                </div>
                {(summary.totalWaitingCount ?? 0) > 0 && (
                  <div
                    className="funnel-conversion-rate-box"
                    style={{ marginTop: 16 }}
                  >
                    <div className="rate-circle">
                      <span className="percentage">
                        {Math.round(
                          ((summary.bookedWaitingCount ?? 0) /
                            summary.totalWaitingCount) *
                            100
                        )}
                        %
                      </span>
                      <span className="lbl">Booked</span>
                    </div>
                    <div className="funnel-text-summary">
                      <p>
                        Tỷ lệ chuyển đổi từ hàng chờ sang đặt lịch thành công
                        là{" "}
                        <strong>
                          {Math.round(
                            ((summary.bookedWaitingCount ?? 0) /
                              summary.totalWaitingCount) *
                              100
                          )}
                          %
                        </strong>
                        . Trong tổng số{" "}
                        <strong>{summary.totalWaitingCount}</strong> lượt đăng
                        ký, có{" "}
                        <strong>{summary.bookedWaitingCount ?? 0}</strong> người
                        đã đặt lịch thành công.
                      </p>
                    </div>
                  </div>
                )}
              </article>
            </div>
          )}

          {/* ════════════════════════════
              TAB: LỊCH HẸN
          ════════════════════════════ */}
          {activeTab === "appointments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* KPI cards */}
              <div className="dashboard-appointment-kpis">
                {[
                  {
                    label: "Hôm nay",
                    value: summary.appointmentsToday ?? 0,
                    color: "#3b82f6",
                  },
                  {
                    label: "Chờ duyệt",
                    value: summary.pendingAppointments ?? 0,
                    color: "#f59e0b",
                  },
                  {
                    label: "Đã xác nhận",
                    value: summary.confirmedAppointments ?? 0,
                    color: "#3b82f6",
                  },
                  {
                    label: "Hoàn thành",
                    value: summary.completedAppointments ?? 0,
                    color: "#10b981",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #f6edf0",
                      borderRadius: "20px",
                      padding: "20px 24px",
                      borderTop: `4px solid ${item.color}`,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "30px",
                        fontWeight: "900",
                        color: item.color,
                      }}
                    >
                      {item.value}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#a38f9d",
                        marginTop: 6,
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bảng lịch hẹn mới nhất */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>📋 Nhật ký Lịch hẹn mới nhất</h3>
                    <p>8 lịch hẹn gần đây nhất trong hệ thống</p>
                  </div>
                  <button onClick={() => navigate("/admin/reports")} style={quickLinkStyle}>Xem tất cả →</button>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Mã LH</th>
                        <th>Ngày hẹn</th>
                        <th>Giờ</th>
                        <th>Khách hàng</th>
                        <th>Kỹ thuật viên</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Thanh toán</th>
                        <th style={{ textAlign: "right" }}>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.latestAppointments || []).map((appt) => (
                        <tr key={appt.appointmentId}>
                          <td
                            style={{
                              fontWeight: "700",
                              color: "#e8396c",
                            }}
                          >
                            #{appt.appointmentId}
                          </td>
                          <td>{formatDate(appt.appointmentDate)}</td>
                          <td>
                            {timeText(appt.startTime)} –{" "}
                            {timeText(appt.endTime)}
                          </td>
                          <td style={{ fontWeight: "600" }}>
                            {appt.customerName || "—"}
                          </td>
                          <td>
                            <span className="staff-assign-badge">
                              {appt.employeeName || "Chưa phân công"}
                            </span>
                          </td>
                          <td>
                            <span className={statusClass(appt.status)}>
                              {statusLabel(appt.status)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span
                              className={statusClass(appt.paymentStatus)}
                            >
                              {statusLabel(appt.paymentStatus)}
                            </span>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: "700",
                            }}
                          >
                            {formatMoney(appt.finalAmount)}
                          </td>
                        </tr>
                      ))}
                      {(!data.latestAppointments ||
                        data.latestAppointments.length === 0) && (
                        <tr>
                          <td
                            colSpan={8}
                            style={{
                              textAlign: "center",
                              color: "#a38f9d",
                              padding: "30px",
                            }}
                          >
                            Chưa có lịch hẹn nào
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}

          {/* ════════════════════════════
              TAB: PHẢN HỒI & HOÀN TIỀN
          ════════════════════════════ */}
          {activeTab === "feedback" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="feedback-reviews-tab-layout">
                {/* Cột đánh giá */}
                <div>
                  <h3
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: "17px",
                      fontWeight: "850",
                      color: "#2d2430",
                    }}
                  >
                    ⭐ Đánh giá mới nhất
                  </h3>
                  <div className="premium-reviews-feed">
                    {(data.latestReviews || []).map((rv) => (
                      <div
                        key={rv.reviewId}
                        className="premium-review-card-new"
                      >
                        <div className="review-top-bar">
                          <strong>{rv.customerName || "Khách hàng"}</strong>
                          <span
                            className="rating-stars"
                            style={{ color: "#f59e0b" }}
                          >
                            {renderStars(rv.rating)}
                          </span>
                        </div>
                        <p className="comment">
                          {rv.comment || (
                            <em style={{ color: "#c4aeb9" }}>
                              Không có nội dung
                            </em>
                          )}
                        </p>
                        <div className="review-bottom-meta">
                          <span className="service">✂️ {rv.serviceName}</span>
                          <span className="dot" />
                          {rv.employeeName && (
                            <span>KTV: {rv.employeeName}</span>
                          )}
                          <span className="dot" />
                          <span>{formatDate(rv.createdAt)}</span>
                          <span className="dot" />
                          <span className={statusClass(rv.status)}>
                            {statusLabel(rv.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!data.latestReviews ||
                      data.latestReviews.length === 0) && (
                      <p
                        style={{
                          color: "#a38f9d",
                          textAlign: "center",
                          padding: "40px",
                        }}
                      >
                        Chưa có đánh giá nào
                      </p>
                    )}
                  </div>
                </div>

                {/* Cột phản hồi */}
                <div>
                  <h3
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: "17px",
                      fontWeight: "850",
                      color: "#2d2430",
                    }}
                  >
                    💬 Phản hồi gần đây
                  </h3>
                  <div className="premium-feedbacks-feed">
                    {(data.recentFeedbacks || []).map((fb) => (
                      <div
                        key={fb.feedbackId}
                        className="premium-feedback-card-new"
                      >
                        <div className="feedback-top-bar">
                          <h4>{fb.subject || "Không có tiêu đề"}</h4>
                          <span className={statusClass(fb.status)}>
                            {statusLabel(fb.status)}
                          </span>
                        </div>
                        <p className="content">{fb.content}</p>
                        <div className="feedback-bottom-meta">
                          <span>👤 {fb.customerName || "Khách hàng"}</span>
                          <span>{formatDateTime(fb.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {(!data.recentFeedbacks ||
                      data.recentFeedbacks.length === 0) && (
                      <p
                        style={{
                          color: "#a38f9d",
                          textAlign: "center",
                          padding: "40px",
                        }}
                      >
                        Chưa có phản hồi nào
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bảng hoàn tiền */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>💸 Danh sách Hoàn tiền gần đây</h3>
                    <p>
                      Chờ xử lý:{" "}
                      <strong style={{ color: "#ef4444" }}>
                        {summary.pendingRefunds ?? 0}
                      </strong>{" "}
                      &nbsp;|&nbsp; Đã hoàn:{" "}
                      <strong style={{ color: "#10b981" }}>
                        {summary.completedRefunds ?? 0}
                      </strong>
                    </p>
                  </div>
                  <button onClick={() => navigate("/admin/refunds")} style={quickLinkStyle}>Quản lý hoàn tiền →</button>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Mã HT</th>
                        <th>Khách hàng</th>
                        <th>Lý do</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Số tiền</th>
                        <th>Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.pendingRefunds || []).map((r) => (
                        <tr key={r.refundId}>
                          <td
                            style={{
                              fontWeight: "700",
                              color: "#e8396c",
                            }}
                          >
                            #{r.refundId}
                          </td>
                          <td style={{ fontWeight: "600" }}>
                            {r.customerName || "—"}
                          </td>
                          <td
                            style={{
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.reason || "—"}
                          </td>
                          <td>
                            <span className={statusClass(r.status)}>
                              {statusLabel(r.status)}
                            </span>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: "700",
                              color: "#ef4444",
                            }}
                          >
                            {formatMoney(r.refundAmount)}
                          </td>
                          <td>{formatDate(r.createdAt)}</td>
                        </tr>
                      ))}
                      {(!data.pendingRefunds ||
                        data.pendingRefunds.length === 0) && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              textAlign: "center",
                              color: "#a38f9d",
                              padding: "30px",
                            }}
                          >
                            Không có yêu cầu hoàn tiền nào
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              {/* Bảng payout kỹ thuật viên */}
              <article className="chart-card">
                <div className="chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>🏦 Yêu cầu Chi trả Kỹ thuật viên (Payout)</h3>
                    <p>
                      Chờ phê duyệt:{" "}
                      <strong style={{ color: "#f59e0b" }}>
                        {summary.pendingPayouts ?? 0}
                      </strong>{" "}
                      &nbsp;|&nbsp; Tổng đã chi:{" "}
                      <strong style={{ color: "#10b981" }}>
                        {formatMoney(summary.totalPaidOut)}
                      </strong>
                    </p>
                  </div>
                  <button onClick={() => navigate("/admin/employees")} style={quickLinkStyle}>Xem nhân viên →</button>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Mã YC</th>
                        <th>Kỹ thuật viên</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Số tiền</th>
                        <th>Ngày yêu cầu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.pendingPayouts || []).map((p) => (
                        <tr key={p.payoutRequestId}>
                          <td
                            style={{
                              fontWeight: "700",
                              color: "#8b5cf6",
                            }}
                          >
                            #{p.payoutRequestId}
                          </td>
                          <td style={{ fontWeight: "600" }}>
                            {p.technicianName || "—"}
                          </td>
                          <td>
                            <span className={statusClass(p.status)}>
                              {statusLabel(p.status)}
                            </span>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: "700",
                              color: "#8b5cf6",
                            }}
                          >
                            {formatMoney(p.amount)}
                          </td>
                          <td>{formatDateTime(p.requestedAt)}</td>
                        </tr>
                      ))}
                      {(!data.pendingPayouts ||
                        data.pendingPayouts.length === 0) && (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              textAlign: "center",
                              color: "#a38f9d",
                              padding: "30px",
                            }}
                          >
                            Không có yêu cầu payout nào đang chờ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}
        </>
      )}
    </section>
  );
}

