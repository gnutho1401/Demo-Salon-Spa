import { useEffect, useMemo, useState } from "react";
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
  Legend,
  BarChart,
  Bar
} from "recharts";

const DEFAULT_AVATAR = "/images/default-avatar.png";

// Helper Formatters
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

function statusClass(status) {
  return `admin-status admin-status-${String(status || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function safeAvatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

// Modern Metric Card Component
function StatCard({ label, value, note, icon, trend, colorClass }) {
  return (
    <article className={`admin-stat-card-new ${colorClass || ""}`}>
      <div className="card-header-row">
        <span className="card-label">{label}</span>
        <span className="card-icon">{icon}</span>
      </div>
      <h3 className="card-value">{value}</h3>
      {note && <div className="card-note">{note}</div>}
      {trend && <span className="card-trend">{trend}</span>}
    </article>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("overview"); // "overview", "staff", "appointments", "feedback"

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
          "Không tải được dashboard admin",
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

  // Formatter for Recharts money axis
  const formatYAxisMoney = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
  };

  // 1. Prepare Revenue Data
  const revenueChartData = useMemo(() => {
    if (!data?.revenueByDay) return [];
    return data.revenueByDay.map((item) => ({
      name: new Date(item.date).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric" }),
      DoanhThu: Number(item.revenue || 0),
      rawDate: item.date
    }));
  }, [data]);

  // 2. Prepare Appointment Status Data for Donut
  const appointmentStatusData = useMemo(() => {
    if (!data?.appointmentStatus) return [];
    const statusMap = {
      COMPLETED: { label: "Đã hoàn thành", color: "#10b981" },
      CONFIRMED: { label: "Đã xác nhận", color: "#3b82f6" },
      PENDING: { label: "Chờ duyệt", color: "#f59e0b" },
      CANCELLED: { label: "Đã hủy", color: "#ef4444" }
    };

    return data.appointmentStatus.map((item) => {
      const config = statusMap[item.status] || { label: item.status, color: "#6366f1" };
      return {
        name: config.label,
        value: item.count,
        color: config.color
      };
    });
  }, [data]);

  // 3. Prepare Payment Status Data for Donut
  const paymentStatusData = useMemo(() => {
    if (!data?.paymentStatus) return [];
    const statusMap = {
      PAID: { label: "Đã thanh toán", color: "#10b981" },
      PENDING: { label: "Chờ thanh toán", color: "#f59e0b" },
      FAILED: { label: "Thanh toán lỗi", color: "#ef4444" }
    };

    return data.paymentStatus.map((item) => {
      const config = statusMap[item.status] || { label: item.status, color: "#6366f1" };
      return {
        name: config.label,
        value: item.count,
        color: config.color
      };
    });
  }, [data]);

  // 4. Prepare Top Services Data
  const topServicesData = useMemo(() => {
    if (!data?.topServices) return [];
    return [...data.topServices]
      .sort((a, b) => b.appointmentCount - a.appointmentCount)
      .slice(0, 5)
      .map(item => ({
        name: item.serviceName.length > 20 ? `${item.serviceName.slice(0, 20)}...` : item.serviceName,
        "Lượt đặt": item.appointmentCount,
        "Doanh thu": item.revenue
      }));
  }, [data]);

  return (
    <section className="admin-dashboard admin-page">
      
      {/* Upper Dashboard Hero with original dark brown background styling */}
      <div className="admin-dashboard-hero">
        <div>
          <div className="admin-eyebrow">⚡ HỆ THỐNG QUẢN TRỊ SALON CAO CẤP</div>
          <h1>Chào mừng trở lại, Admin</h1>
          <p>
            Báo cáo trực quan và số liệu tổng hợp thời gian thực từ cơ sở dữ liệu hệ thống.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          {refreshing ? "Đang cập nhật..." : "Làm mới dữ liệu"}
        </button>
      </div>

      {/* Loading & Error Blocks */}
      {loading && (
        <div className="dashboard-loading-overlay">
          <div className="spinner-large" />
          <p>Đang đồng bộ số liệu và dựng biểu đồ...</p>
        </div>
      )}

      {error && (
        <div className="dashboard-error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* 1. Stat Cards Grid */}
          <section className="dashboard-stats-grid">
            <StatCard
              label="DOANH THU HÔM NAY"
              value={formatMoney(summary.revenueToday)}
              note="Từ các giao dịch thanh toán thành công"
              icon="💰"
              colorClass="stat-revenue-today"
            />
            <StatCard
              label="DOANH THU THÁNG NÀY"
              value={formatMoney(summary.revenueThisMonth)}
              note="Tổng tích lũy tháng hiện tại"
              icon="📈"
              colorClass="stat-revenue-month"
            />
            <StatCard
              label="LỊCH HẸN HÔM NAY"
              value={summary.appointmentsToday}
              note={`Tổng số ${summary.totalAppointments || 0} lịch đặt`}
              icon="📅"
              colorClass="stat-appointments"
            />
            <StatCard
              label="TỔNG SỐ KHÁCH HÀNG"
              value={summary.totalCustomers}
              note={`${summary.activeUsers || 0} tài khoản đang hoạt động`}
              icon="👥"
              colorClass="stat-customers"
            />
          </section>

          {/* 2. Secondary Mini Metrics */}
          <section className="dashboard-mini-metrics-row">
            <div className="mini-metric">
              <span className="label">Nhân sự hệ thống</span>
              <strong>{summary.totalEmployees} nhân viên</strong>
            </div>
            <div className="mini-metric">
              <span className="label">Danh mục dịch vụ</span>
              <strong>{summary.activeServices} active ({summary.inactiveServices || 0} ẩn)</strong>
            </div>
            <div className="mini-metric">
              <span className="label">Thanh toán chờ duyệt</span>
              <strong>{summary.pendingPayments || 0} pending</strong>
            </div>
            <div className="mini-metric">
              <span className="label">Đánh giá mới</span>
              <strong>{summary.pendingReviews || 0} review chưa đọc</strong>
            </div>
          </section>

          {/* 3. Navigation Tabs */}
          <nav className="dashboard-subtab-nav">
            <button
              className={`subtab-btn ${activeSubTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveSubTab("overview")}
            >
              📊 Biểu đồ tổng quan
            </button>
            <button
              className={`subtab-btn ${activeSubTab === "staff" ? "active" : ""}`}
              onClick={() => setActiveSubTab("staff")}
            >
              💆 Hiệu suất & Dịch vụ
            </button>
            <button
              className={`subtab-btn ${activeSubTab === "appointments" ? "active" : ""}`}
              onClick={() => setActiveSubTab("appointments")}
            >
              📋 Nhật ký lịch hẹn mới
            </button>
            <button
              className={`subtab-btn ${activeSubTab === "feedback" ? "active" : ""}`}
              onClick={() => setActiveSubTab("feedback")}
            >
              💬 Feedback & Đánh giá
            </button>
          </nav>

          {/* Tab Contents */}
          <main className="dashboard-tab-content">
            
            {/* SUBTAB: OVERVIEW */}
            {activeSubTab === "overview" && (
              <div className="overview-tab-layout">
                
                {/* Line area Chart */}
                <article className="chart-card large-chart">
                  <div className="chart-header">
                    <h3>Xu hướng doanh thu 7 ngày gần nhất</h3>
                    <p>Thống kê theo các hóa đơn đã hoàn tất thanh toán thành công (PAID)</p>
                  </div>
                  <div className="chart-container" style={{ width: '100%', height: 350 }}>
                    <ResponsiveContainer>
                      <AreaChart data={revenueChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e8396c" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#e8396c" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e2e5" />
                        <XAxis dataKey="name" stroke="#a38f9d" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                        <YAxis stroke="#a38f9d" tickLine={false} axisLine={false} tickFormatter={formatYAxisMoney} style={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value) => [formatMoney(value), "Doanh thu"]}
                          contentStyle={{ background: "#ffffff", border: "1px solid #ffdce3", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
                        />
                        <Area type="monotone" dataKey="DoanhThu" stroke="#e8396c" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                {/* Donut Charts Block */}
                <div className="donut-charts-row">
                  {/* Donut 1 */}
                  <article className="chart-card">
                    <div className="chart-header">
                      <h3>Phân bố Trạng thái Lịch hẹn</h3>
                      <p>Cơ cấu theo tổng số lịch đặt trong hệ thống</p>
                    </div>
                    <div className="donut-chart-wrapper" style={{ width: '100%', height: 220, position: 'relative' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={appointmentStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {appointmentStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} lịch hẹn`, "Số lượng"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="chart-custom-legend">
                      {appointmentStatusData.map((item, idx) => (
                        <div className="legend-item" key={idx}>
                          <span className="legend-dot" style={{ backgroundColor: item.color }} />
                          <span className="legend-label">{item.name}: <strong>{item.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </article>

                  {/* Donut 2 */}
                  <article className="chart-card">
                    <div className="chart-header">
                      <h3>Cơ cấu Trạng thái Giao dịch</h3>
                      <p>Thống kê theo các lượt thanh toán (Payments)</p>
                    </div>
                    <div className="donut-chart-wrapper" style={{ width: '100%', height: 220, position: 'relative' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={paymentStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {paymentStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} giao dịch`, "Số lượng"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="chart-custom-legend">
                      {paymentStatusData.map((item, idx) => (
                        <div className="legend-item" key={idx}>
                          <span className="legend-dot" style={{ backgroundColor: item.color }} />
                          <span className="legend-label">{item.name}: <strong>{item.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                {/* Detailed Operation Metrics Deck */}
                <article className="chart-card full-width-panel" style={{ marginTop: 24 }}>
                  <div className="chart-header">
                    <h3>📊 Bảng phân tích vận hành chi tiết</h3>
                    <p>Toàn bộ trạng thái người dùng, lịch hẹn và các chỉ số giao dịch trong cơ sở dữ liệu</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                    
                    {/* User accounts block */}
                    <div style={{ background: "#fdf8fa", border: "1px solid #f6edf0", borderRadius: "20px", padding: "20px" }}>
                      <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "800", color: "#8a653a", display: "flex", alignItems: "center", gap: 8 }}>
                        👤 Tài Khoản Người Dùng
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Đang hoạt động:</span>
                          <strong>{summary.activeUsers || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Không hoạt động:</span>
                          <strong>{summary.inactiveUsers || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#ef4444" }}>Bị khóa (Banned):</span>
                          <strong style={{ color: "#ef4444" }}>{summary.bannedUsers || 0}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Appointment breakdown block */}
                    <div style={{ background: "#fdf8fa", border: "1px solid #f6edf0", borderRadius: "20px", padding: "20px" }}>
                      <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "800", color: "#8a653a", display: "flex", alignItems: "center", gap: 8 }}>
                        📅 Chi Tiết Lịch Hẹn
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Chờ duyệt:</span>
                          <strong style={{ color: "#f59e0b" }}>{summary.pendingAppointments || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Đã xác nhận:</span>
                          <strong style={{ color: "#3b82f6" }}>{summary.confirmedAppointments || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Hoàn thành:</span>
                          <strong style={{ color: "#10b981" }}>{summary.completedAppointments || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#ef4444" }}>Đã hủy:</span>
                          <strong style={{ color: "#ef4444" }}>{summary.cancelledAppointments || 0}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Financial details block */}
                    <div style={{ background: "#fdf8fa", border: "1px solid #f6edf0", borderRadius: "20px", padding: "20px" }}>
                      <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "800", color: "#8a653a", display: "flex", alignItems: "center", gap: 8 }}>
                        💳 Chi Tiết Giao Dịch
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Chờ thanh toán:</span>
                          <strong style={{ color: "#f59e0b" }}>{summary.pendingPayments || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#ef4444" }}>Thanh toán lỗi:</span>
                          <strong style={{ color: "#ef4444" }}>{summary.failedPayments || 0}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Quality control block */}
                    <div style={{ background: "#fdf8fa", border: "1px solid #f6edf0", borderRadius: "20px", padding: "20px" }}>
                      <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "800", color: "#8a653a", display: "flex", alignItems: "center", gap: 8 }}>
                        🌟 Đánh Giá & Phản Hồi
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Review chờ duyệt:</span>
                          <strong style={{ color: "#f59e0b" }}>{summary.pendingReviews || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#7b6874" }}>Feedback chưa đọc:</span>
                          <strong style={{ color: "#f59e0b" }}>{summary.pendingFeedbacks || 0}</strong>
                        </div>
                      </div>
                    </div>

                  </div>
                </article>
              </div>
            )}

            {/* SUBTAB: STAFF & SERVICES */}
            {activeSubTab === "staff" && (
              <div className="staff-services-tab-layout">
                
                {/* Horizontal Bar Chart for Services */}
                <article className="chart-card services-chart">
                  <div className="chart-header">
                    <h3>Top 5 dịch vụ được đặt nhiều nhất</h3>
                    <p>Theo số lượng lịch hẹn và tổng doanh thu thu về</p>
                  </div>
                  <div className="chart-container" style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={topServicesData}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0e2e5" />
                        <XAxis type="number" stroke="#a38f9d" tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#a38f9d" tickLine={false} axisLine={false} width={120} style={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => [`${value} lượt đặt`, "Số lượng"]} />
                        <Bar dataKey="Lượt đặt" fill="#e8396c" radius={[0, 8, 8, 0]} barSize={20}>
                          {topServicesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#ff4778" : index === 1 ? "#ff6992" : index === 2 ? "#ffa1ba" : "#ffd1dc"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                {/* Smart Waiting List Panel */}
                <article className="chart-card waiting-list-panel">
                  <div className="chart-header">
                    <h3>Hiệu suất hàng chờ thông minh (Smart Waiting List)</h3>
                    <p>Phân tích chuyển đổi từ danh sách hàng chờ tự động</p>
                  </div>
                  <div className="waiting-conversion-funnel">
                    <div className="funnel-metrics-grid">
                      <div className="funnel-card">
                        <span className="funnel-icon">⏳</span>
                        <h4>Lượt chờ</h4>
                        <div className="val">{summary.totalWaitingCount || 0}</div>
                      </div>
                      <div className="funnel-card active">
                        <span className="funnel-icon">⚡</span>
                        <h4>Khớp slot</h4>
                        <div className="val">{summary.matchedWaitingCount || 0}</div>
                      </div>
                      <div className="funnel-card success">
                        <span className="funnel-icon">✅</span>
                        <h4>Đặt lịch</h4>
                        <div className="val">{summary.bookedWaitingCount || 0}</div>
                      </div>
                      <div className="funnel-card fail">
                        <span className="funnel-icon">📅</span>
                        <h4>Hết hạn</h4>
                        <div className="val">{summary.expiredWaitingCount || 0}</div>
                      </div>
                    </div>

                    <div className="funnel-conversion-rate-box">
                      <div className="rate-circle">
                        <span className="percentage">
                          {summary.totalWaitingCount
                            ? ((summary.bookedWaitingCount / summary.totalWaitingCount) * 100).toFixed(1)
                            : "0.0"}%
                        </span>
                        <span className="lbl">Tỷ lệ chuyển đổi</span>
                      </div>
                      <div className="funnel-text-summary">
                        <p>
                          Hệ thống đã tự động kết nối và lắp đầy các khung giờ trống bằng khách hàng đăng ký hàng chờ.
                          Giúp tăng tối đa công suất làm việc của chi nhánh.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>

                {/* Top Technicians List */}
                <article className="chart-card technicians-card" style={{ gridColumn: 'span 2' }}>
                  <div className="chart-header">
                    <h3>Bảng xếp hạng năng suất Kỹ thuật viên</h3>
                    <p>Dựa trên xếp hạng trung bình (Rating), số lịch phục vụ và doanh thu đem lại</p>
                  </div>
                  <div className="tech-ranking-grid">
                    {(data.topTechnicians || []).map((item, idx) => (
                      <div className="tech-ranking-row" key={item.employeeId}>
                        <div className="rank-badge">{idx + 1}</div>
                        <img className="tech-avatar" src={safeAvatar(item.avatarUrl)} alt={item.fullName} />
                        <div className="tech-details">
                          <h4>{item.fullName}</h4>
                          <span className="spec">{item.specialization || item.position || "Kỹ thuật viên"}</span>
                        </div>
                        <div className="tech-stat">
                          <span className="lbl">Lịch hẹn</span>
                          <strong>{item.appointmentCount}</strong>
                        </div>
                        <div className="tech-stat">
                          <span className="lbl">Đánh giá</span>
                          <strong style={{ color: "#f59e0b" }}>{item.avgRating ? `${item.avgRating.toFixed(1)} ★` : "N/A"}</strong>
                        </div>
                        <div className="tech-stat">
                          <span className="lbl">Tổng doanh số</span>
                          <strong style={{ color: "#e8396c" }}>{formatMoney(item.revenue)}</strong>
                        </div>
                      </div>
                    ))}
                    {!data.topTechnicians?.length && (
                      <p className="no-data-text">Chưa ghi nhận dữ liệu kỹ thuật viên.</p>
                    )}
                  </div>
                </article>

              </div>
            )}

            {/* SUBTAB: APPOINTMENTS LOGS */}
            {activeSubTab === "appointments" && (
              <article className="chart-card full-width-panel">
                <div className="chart-header">
                  <h3>Nhật ký lịch hẹn đăng ký mới nhất</h3>
                  <p>Hiển thị các lịch hẹn được tạo gần đây trên toàn hệ thống</p>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Khách hàng</th>
                        <th>Kỹ thuật viên</th>
                        <th>Ngày phục vụ</th>
                        <th>Giờ bắt đầu</th>
                        <th>Trạng thái lịch</th>
                        <th>Thanh toán</th>
                        <th style={{ textAlign: 'right' }}>Tổng hóa đơn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.latestAppointments || []).map((item) => (
                        <tr key={item.appointmentId}>
                          <td><strong>#{item.appointmentId}</strong></td>
                          <td>
                            <div className="client-cell">
                              <strong>{item.customerName || "Vô danh"}</strong>
                            </div>
                          </td>
                          <td>
                            <div className="staff-assign-badge">
                              {item.employeeName || "⚠️ Chưa phân công"}
                            </div>
                          </td>
                          <td>{formatDate(item.appointmentDate)}</td>
                          <td><strong>{timeText(item.startTime)}</strong></td>
                          <td>
                            <span className={statusClass(item.status)}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <span className={statusClass(item.paymentStatus)}>
                              {item.paymentStatus}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#e8396c' }}>
                            {formatMoney(item.finalAmount)}
                          </td>
                        </tr>
                      ))}
                      {!data.latestAppointments?.length && (
                        <tr>
                          <td colSpan="8" style={{ textAlign: "center", padding: "40px 0", color: "#a38f9d" }}>
                            Chưa ghi nhận lịch hẹn nào trong hệ thống.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {/* SUBTAB: FEEDBACK & REVIEWS */}
            {activeSubTab === "feedback" && (
              <div className="feedback-reviews-tab-layout">
                
                {/* Customer Reviews Card */}
                <article className="chart-card">
                  <div className="chart-header">
                    <h3>Đánh giá dịch vụ gần đây (Reviews)</h3>
                    <p>Ý kiến phản hồi công khai từ khách hàng sau khi hoàn tất dịch vụ</p>
                  </div>
                  <div className="premium-reviews-feed">
                    {(data.latestReviews || []).map((item) => (
                      <div className="premium-review-card-new" key={item.reviewId}>
                        <div className="review-top-bar">
                          <strong>{item.customerName}</strong>
                          <span className="rating-stars">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} style={{ color: i < item.rating ? "#f59e0b" : "#e2e8f0" }}>★</span>
                            ))}
                          </span>
                        </div>
                        <p className="comment">{item.comment || "Khách hàng không để lại bình luận chữ."}</p>
                        <div className="review-bottom-meta">
                          <span className="service">{item.serviceName}</span>
                          <span className="dot" />
                          <span className="tech">Thực hiện: {item.employeeName || "N/A"}</span>
                          <span className="dot" />
                          <span className="date">{formatDateTime(item.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {!data.latestReviews?.length && (
                      <p className="no-data-text">Chưa ghi nhận đánh giá nào.</p>
                    )}
                  </div>
                </article>

                {/* Customer Feedbacks (Góp ý hệ thống) */}
                <article className="chart-card">
                  <div className="chart-header">
                    <h3>Phản hồi góp ý hệ thống (Feedbacks)</h3>
                    <p>Các hòm thư đóng góp ý kiến hoặc phản hồi khẩn cấp cần Admin xử lý</p>
                  </div>
                  <div className="premium-feedbacks-feed">
                    {(data.recentFeedbacks || []).map((item) => (
                      <div className="premium-feedback-card-new" key={item.feedbackId}>
                        <div className="feedback-top-bar">
                          <h4>{item.subject}</h4>
                          <span className={statusClass(item.status)}>{item.status}</span>
                        </div>
                        <p className="content">{item.content}</p>
                        <div className="feedback-bottom-meta">
                          <strong>Người gửi: {item.customerName || "Ẩn danh"}</strong>
                          <span className="date">{formatDateTime(item.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {!data.recentFeedbacks?.length && (
                      <p className="no-data-text">Chưa có hòm thư góp ý cần xử lý.</p>
                    )}
                  </div>
                </article>

              </div>
            )}

          </main>
        </>
      )}

    </section>
  );
}
