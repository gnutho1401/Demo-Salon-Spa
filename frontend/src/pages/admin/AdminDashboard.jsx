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
  BarChart,
  Bar,
} from "recharts";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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

/* ─────────── Small reusable components ─────────── */
function StatCard({ label, value, note, icon, colorClass }) {
  return (
    <article className={`admin-stat-card-new ${colorClass || ""}`}>
      <div className="card-header-row">
        <span className="card-label">{label}</span>
        <span className="card-icon">{icon}</span>
      </div>
      <h3 className="card-value">{value}</h3>
      {note && <div className="card-note">{note}</div>}
    </article>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "6px 0", borderBottom: "1px dashed #f0e2e5" }}>
      <span style={{ color: "#7b6874" }}>{label}</span>
      <strong style={{ color: valueColor || "#2d2430" }}>{value}</strong>
    </div>
  );
}

function MiniPanel({ title, icon, children }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #f6edf0",
      borderRadius: "20px",
      padding: "20px",
    }}>
      <h4 style={{ margin: "0 0 14px 0", fontSize: "13.5px", fontWeight: "800", color: "#8a653a", display: "flex", alignItems: "center", gap: 8 }}>
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

/* ─────────── Main Component ─────────── */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

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
          "Khong tai duoc dashboard admin",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const summary = data?.summary || {};

  /* ── Chart data ── */
  const revenueByDayData = useMemo(() => {
    if (!data?.revenueByDay) return [];
    return data.revenueByDay.map((item) => ({
      name: new Date(item.date).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric" }),
      DoanhThu: item.revenue,
    }));
  }, [data]);

  const revenueByMonthData = useMemo(() => {
    if (!data?.revenueByMonth) return [];
    return data.revenueByMonth.map((item) => ({
      name: item.month?.slice(0, 7) || "",
      DoanhThu: item.revenue,
    }));
  }, [data]);

  const appointmentStatusData = useMemo(() => {
    if (!data?.appointmentStatus) return [];
    const map = {
      COMPLETED: { label: "Hoan thanh", color: "#10b981" },
      CONFIRMED:  { label: "Xac nhan",  color: "#3b82f6" },
      PENDING:    { label: "Cho duyet", color: "#f59e0b" },
      CANCELLED:  { label: "Da huy",   color: "#ef4444" },
    };
    return data.appointmentStatus.map((item) => {
      const c = map[item.status] || { label: item.status, color: "#6366f1" };
      return { name: c.label, value: item.count, color: c.color };
    });
  }, [data]);

  const paymentStatusData = useMemo(() => {
    if (!data?.paymentStatus) return [];
    const map = {
      PAID:    { label: "Da thanh toan", color: "#10b981" },
      PENDING: { label: "Cho TT",       color: "#f59e0b" },
      FAILED:  { label: "Loi TT",       color: "#ef4444" },
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
        name: item.serviceName.length > 22 ? item.serviceName.slice(0, 22) + "..." : item.serviceName,
        "Luot dat": item.appointmentCount,
      }));
  }, [data]);

  const formatYAxis = (v) => {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000)    return (v / 1000).toFixed(0) + "K";
    return v;
  };

  const TABS = [
    { key: "overview",      label: "Tong quan"         },
    { key: "revenue",       label: "Doanh thu"          },
    { key: "staff",         label: "Nhan su & DV"       },
    { key: "appointments",  label: "Lich hen"           },
    { key: "feedback",      label: "Phan hoi & Hoan tien" },
  ];

  const renderStars = (rating) => {
    const r = Math.round(rating || 0);
    return "★".repeat(r) + "☆".repeat(5 - r);
  };

  return (
    <section className="admin-dashboard admin-page">

      {/* Hero Header - original dark brown gradient */}
      <div className="admin-dashboard-hero">
        <div>
          <div className="admin-eyebrow">HE THONG QUAN TRI SALON CAO CAP</div>
          <h1>Chao mung tro lai, Admin</h1>
          <p>Bao cao truc quan va so lieu tong hop thoi gian thuc tu co so du lieu he thong.</p>
        </div>
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          {refreshing ? "Dang cap nhat..." : "Lam moi du lieu"}
        </button>
      </div>

      {loading && (
        <div className="dashboard-loading-overlay">
          <div className="spinner-large" />
          <p>Dang dong bo so lieu va dung bieu do...</p>
        </div>
      )}
      {error && (
        <div className="dashboard-error-banner">
          <span>Warning</span> {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* 8 Primary Stat Cards */}
          <div className="dashboard-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <StatCard
              label="DOANH THU HOM NAY"
              value={formatMoney(summary.revenueToday)}
              note="Tu cac giao dich PAID hom nay"
              icon="💰"
              colorClass="stat-revenue-today"
            />
            <StatCard
              label="DOANH THU THANG NAY"
              value={formatMoney(summary.revenueThisMonth)}
              note={"Goi lieu trinh: " + formatMoney(summary.packageRevenueThisMonth)}
              icon="📈"
              colorClass="stat-revenue-month"
            />
            <StatCard
              label="LICH HEN HOM NAY"
              value={summary.appointmentsToday ?? 0}
              note={"Tong: " + (summary.totalAppointments ?? 0) + " lich dat"}
              icon="📅"
              colorClass="stat-appointments"
            />
            <StatCard
              label="TONG KHACH HANG"
              value={summary.totalCustomers ?? 0}
              note={(summary.activeUsers ?? 0) + " tai khoan dang hoat dong"}
              icon="👥"
              colorClass="stat-customers"
            />
            <StatCard
              label="NHAN SU HE THONG"
              value={(summary.totalEmployees ?? 0) + " nhan vien"}
              note={"Diem danh hom nay: " + (data.todayAttendance?.totalCheckedIn ?? 0)}
              icon="🧑‍💼"
              colorClass=""
            />
            <StatCard
              label="DICH VU DANG HOAT DONG"
              value={(summary.activeServices ?? 0) + " active"}
              note={(summary.inactiveServices ?? 0) + " an | " + (summary.activePromotions ?? 0) + " KM dang chay"}
              icon="✂️"
              colorClass=""
            />
            <StatCard
              label="GOI LIEU TRINH"
              value={(summary.activePackages ?? 0) + " dang dung"}
              note={(summary.expiredPackages ?? 0) + " da het han"}
              icon="📦"
              colorClass=""
            />
            <StatCard
              label="VOUCHER & KHUYEN MAI"
              value={(summary.totalVouchers ?? 0) + " voucher"}
              note={(summary.activePromotions ?? 0) + " chuong trinh dang chay"}
              icon="🎟️"
              colorClass=""
            />
          </div>

          {/* Alert strip */}
          {(summary.pendingAppointments > 0 || summary.pendingPayments > 0 || summary.pendingReviews > 0 || summary.pendingFeedbacks > 0 || summary.pendingRefunds > 0 || summary.pendingPayouts > 0) && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 12,
              background: "linear-gradient(135deg, #fffbeb, #fff7f0)",
              border: "1px solid #fde68a", borderRadius: "20px",
              padding: "16px 24px",
            }}>
              <span style={{ fontWeight: "800", color: "#92400e", fontSize: "13px", marginRight: 8 }}>CAN XU LY:</span>
              {summary.pendingAppointments > 0 && <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingAppointments} lich hen cho duyet</span>}
              {summary.pendingPayments > 0 && <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingPayments} giao dich cho TT</span>}
              {summary.pendingReviews > 0 && <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingReviews} review cho duyet</span>}
              {summary.pendingFeedbacks > 0 && <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingFeedbacks} feedback chua doc</span>}
              {summary.pendingRefunds > 0 && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingRefunds} hoan tien cho xu ly</span>}
              {summary.pendingPayouts > 0 && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>{summary.pendingPayouts} payout KTV cho duyet</span>}
            </div>
          )}

          {/* Tab navigation */}
          <nav className="dashboard-subtab-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={"subtab-btn" + (activeTab === t.key ? " active" : "")}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="overview-tab-layout">
                <article className="chart-card large-chart">
                  <div className="chart-header">
                    <h3>Doanh thu 7 ngay gan nhat</h3>
                    <p>Tong thu tu cac giao dich PAID trong tuan</p>
                  </div>
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart data={revenueByDayData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#e8396c" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#e8396c" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0e2e5" vertical={false} />
                      <XAxis dataKey="name" stroke="#a38f9d" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                      <YAxis tickFormatter={formatYAxis} stroke="#a38f9d" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [formatMoney(v), "Doanh thu"]} />
                      <Area type="monotone" dataKey="DoanhThu" stroke="#e8396c" strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: "#e8396c", r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>

                <div className="donut-charts-row">
                  <article className="chart-card">
                    <div className="chart-header">
                      <h3>Trang thai Lich hen</h3>
                      <p>Toan bo trong he thong</p>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={appointmentStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                          {appointmentStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [v + " lich", "So luong"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-custom-legend">
                      {appointmentStatusData.map((item, i) => (
                        <div className="legend-item" key={i}>
                          <span className="legend-dot" style={{ backgroundColor: item.color }} />
                          <span className="legend-label">{item.name}: <strong>{item.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="chart-card">
                    <div className="chart-header">
                      <h3>Trang thai Thanh toan</h3>
                      <p>Theo Payments trong DB</p>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                          {paymentStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [v + " giao dich", "So luong"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-custom-legend">
                      {paymentStatusData.map((item, i) => (
                        <div className="legend-item" key={i}>
                          <span className="legend-dot" style={{ backgroundColor: item.color }} />
                          <span className="legend-label">{item.name}: <strong>{item.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>

              {/* Detailed operations breakdown */}
              <article className="chart-card">
                <div className="chart-header">
                  <h3>Bang phan tich van hanh chi tiet</h3>
                  <p>Toan bo trang thai cac module trong co so du lieu</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
                  <MiniPanel title="Tai Khoan Nguoi Dung" icon="👤">
                    <InfoRow label="Dang hoat dong" value={summary.activeUsers ?? 0} valueColor="#10b981" />
                    <InfoRow label="Khong hoat dong" value={summary.inactiveUsers ?? 0} />
                    <InfoRow label="Bi khoa (Banned)" value={summary.bannedUsers ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Chi Tiet Lich Hen" icon="📅">
                    <InfoRow label="Cho duyet"   value={summary.pendingAppointments ?? 0}   valueColor="#f59e0b" />
                    <InfoRow label="Da xac nhan" value={summary.confirmedAppointments ?? 0} valueColor="#3b82f6" />
                    <InfoRow label="Hoan thanh"  value={summary.completedAppointments ?? 0} valueColor="#10b981" />
                    <InfoRow label="Da huy"      value={summary.cancelledAppointments ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Goi Lieu Trinh" icon="📦">
                    <InfoRow label="Goi dang dung (Active)" value={summary.activePackages ?? 0} valueColor="#8b5cf6" />
                    <InfoRow label="Goi da het han"         value={summary.expiredPackages ?? 0} />
                    <InfoRow label="DT goi thang nay"       value={formatMoney(summary.packageRevenueThisMonth)} valueColor="#10b981" />
                  </MiniPanel>
                  <MiniPanel title="Hoan Tien & Payout" icon="💳">
                    <InfoRow label="Hoan tien cho xu ly"  value={summary.pendingRefunds ?? 0}   valueColor="#f59e0b" />
                    <InfoRow label="Hoan tien hoan tat"   value={summary.completedRefunds ?? 0} valueColor="#10b981" />
                    <InfoRow label="Payout KTV cho duyet" value={summary.pendingPayouts ?? 0}   valueColor="#f59e0b" />
                    <InfoRow label="Da chi tra (Approved)" value={formatMoney(summary.totalPaidOut)} />
                  </MiniPanel>
                  <MiniPanel title="Hang Cho (Waiting List)" icon="⏳">
                    <InfoRow label="Tong dang ky"   value={summary.totalWaitingCount ?? 0} />
                    <InfoRow label="Da match/booked" value={summary.matchedWaitingCount ?? 0} valueColor="#10b981" />
                    <InfoRow label="Da dat lich"     value={summary.bookedWaitingCount ?? 0} valueColor="#3b82f6" />
                    <InfoRow label="Het han/bo qua" value={summary.expiredWaitingCount ?? 0} valueColor="#ef4444" />
                  </MiniPanel>
                  <MiniPanel title="Diem Danh Hom Nay" icon="🧑‍💼">
                    <InfoRow label="Da check-in" value={data.todayAttendance?.totalCheckedIn ?? 0} />
                    <InfoRow label="Dung gio"     value={data.todayAttendance?.present ?? 0}        valueColor="#10b981" />
                    <InfoRow label="Den muon"     value={data.todayAttendance?.late ?? 0}           valueColor="#f59e0b" />
                    <InfoRow label="Vang mat"     value={data.todayAttendance?.absent ?? 0}         valueColor="#ef4444" />
                  </MiniPanel>
                </div>
              </article>
            </div>
          )}

          {/* TAB: REVENUE */}
          {activeTab === "revenue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {[
                  { label: "Doanh thu hom nay",   value: formatMoney(summary.revenueToday),           color: "#e8396c" },
                  { label: "Doanh thu thang nay",  value: formatMoney(summary.revenueThisMonth),        color: "#f97316" },
                  { label: "Doanh thu goi thang",  value: formatMoney(summary.packageRevenueThisMonth), color: "#8b5cf6" },
                  { label: "Da chi tra payout",    value: formatMoney(summary.totalPaidOut),            color: "#10b981" },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: "#ffffff", border: "1px solid #f6edf0", borderRadius: "20px", padding: "20px 24px",
                    borderLeft: "4px solid " + item.color,
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#a38f9d", letterSpacing: "0.8px", marginBottom: 8 }}>{item.label.toUpperCase()}</div>
                    <div style={{ fontSize: "22px", fontWeight: "900", color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Doanh thu 12 thang gan nhat</h3>
                  <p>Tong thu tu cac giao dich PAID theo tung thang</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByMonthData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e2e5" vertical={false} />
                    <XAxis dataKey="name" stroke="#a38f9d" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatYAxis} stroke="#a38f9d" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [formatMoney(v), "Doanh thu"]} />
                    <Bar dataKey="DoanhThu" fill="#e8396c" radius={[6, 6, 0, 0]} barSize={24}>
                      {revenueByMonthData.map((_, i) => (
                        <Cell key={i} fill={i === revenueByMonthData.length - 1 ? "#e8396c" : "#fda4c0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </article>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Bang doanh thu theo Goi Lieu Trinh</h3>
                  <p>Top goi ban chay nhat theo tong so luot mua</p>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ten Goi</th>
                        <th style={{ textAlign: "right" }}>Da ban</th>
                        <th style={{ textAlign: "right" }}>Dang dung</th>
                        <th style={{ textAlign: "right" }}>Tong doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.packagesSummary || []).length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: "center", color: "#a38f9d", padding: "30px" }}>Chua co du lieu goi lieu trinh</td></tr>
                      ) : (data.packagesSummary || []).map((pkg, i) => (
                        <tr key={pkg.packageId}>
                          <td><span style={{ fontWeight: "800", color: "#e8396c" }}>#{i + 1}</span></td>
                          <td style={{ fontWeight: "700" }}>{pkg.packageName}</td>
                          <td style={{ textAlign: "right" }}>{pkg.totalSold}</td>
                          <td style={{ textAlign: "right" }}>
                            <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>
                              {pkg.activeCount}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "800", color: "#10b981" }}>{formatMoney(pkg.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}

          {/* TAB: STAFF & SERVICES */}
          {activeTab === "staff" && (
            <div className="staff-services-tab-layout">
              <article className="chart-card">
                <div className="chart-header">
                  <h3>Top 6 dich vu duoc dat nhieu nhat</h3>
                  <p>Theo so luong lich hen tich luy</p>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topServicesData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0e2e5" vertical={false} />
                    <XAxis type="number" stroke="#a38f9d" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#a38f9d" tickLine={false} axisLine={false} width={130} style={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Luot dat" fill="#e8396c" radius={[0, 8, 8, 0]} barSize={18}>
                      {topServicesData.map((_, i) => (
                        <Cell key={i} fill={["#e8396c","#ff6992","#ff91b0","#ffa9c4","#ffc2d4","#ffdce8"][i] || "#ffdce8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </article>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Bang xep hang Ky thuat vien</h3>
                  <p>Theo so lich hen phuc vu va danh gia sao</p>
                </div>
                <div className="tech-ranking-grid">
                  {(data.topTechnicians || []).map((tech, i) => (
                    <div key={tech.employeeId} className="tech-ranking-row">
                      <span className="rank-badge">{i + 1}</span>
                      <img
                        src={safeAvatar(tech.avatarUrl)}
                        alt={tech.fullName}
                        className="tech-avatar"
                        onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                      />
                      <div className="tech-details">
                        <h4>{tech.fullName}</h4>
                        <span className="spec">{tech.specialization || tech.position || "Ky thuat vien"}</span>
                      </div>
                      <div className="tech-stat">
                        <span className="lbl">{tech.avgRating ? Number(tech.avgRating).toFixed(1) : "—"} sao ({tech.reviewCount} DG)</span>
                        <strong>{tech.appointmentCount} lich</strong>
                      </div>
                    </div>
                  ))}
                  {(!data.topTechnicians || data.topTechnicians.length === 0) && (
                    <p style={{ textAlign: "center", color: "#a38f9d", padding: "30px" }}>Chua co du lieu ky thuat vien</p>
                  )}
                </div>
              </article>

              <article className="chart-card" style={{ gridColumn: "span 2" }}>
                <div className="chart-header">
                  <h3>Pheu chuyen doi Hang Cho (Waiting List)</h3>
                  <p>Ty le tu dang ky cho den dat lich thanh cong</p>
                </div>
                <div className="funnel-metrics-grid">
                  <div className="funnel-card">
                    <div className="val">{summary.totalWaitingCount ?? 0}</div>
                    <h4>Tong dang ky</h4>
                  </div>
                  <div className="funnel-card active">
                    <div className="val">{summary.matchedWaitingCount ?? 0}</div>
                    <h4>Da match</h4>
                  </div>
                  <div className="funnel-card success">
                    <div className="val">{summary.bookedWaitingCount ?? 0}</div>
                    <h4>Dat thanh cong</h4>
                  </div>
                  <div className="funnel-card fail">
                    <div className="val">{summary.expiredWaitingCount ?? 0}</div>
                    <h4>Het han / Bo qua</h4>
                  </div>
                </div>
                {(summary.totalWaitingCount ?? 0) > 0 && (
                  <div className="funnel-conversion-rate-box" style={{ marginTop: 16 }}>
                    <div className="rate-circle">
                      <span className="percentage">
                        {Math.round(((summary.bookedWaitingCount ?? 0) / summary.totalWaitingCount) * 100)}%
                      </span>
                      <span className="lbl">Booked</span>
                    </div>
                    <div className="funnel-text-summary">
                      <p>Ty le chuyen doi tu hang cho sang dat lich thanh cong la <strong>{Math.round(((summary.bookedWaitingCount ?? 0) / summary.totalWaitingCount) * 100)}%</strong>. Trong tong so <strong>{summary.totalWaitingCount}</strong> luot dang ky, co <strong>{summary.bookedWaitingCount}</strong> nguoi da dat lich.</p>
                    </div>
                  </div>
                )}
              </article>
            </div>
          )}

          {/* TAB: APPOINTMENTS */}
          {activeTab === "appointments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { label: "Hom nay",     value: summary.appointmentsToday ?? 0,     color: "#3b82f6" },
                  { label: "Cho duyet",   value: summary.pendingAppointments ?? 0,   color: "#f59e0b" },
                  { label: "Da xac nhan", value: summary.confirmedAppointments ?? 0, color: "#3b82f6" },
                  { label: "Hoan thanh",  value: summary.completedAppointments ?? 0, color: "#10b981" },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: "#ffffff", border: "1px solid #f6edf0", borderRadius: "20px",
                    padding: "20px 24px", borderTop: "4px solid " + item.color, textAlign: "center",
                  }}>
                    <div style={{ fontSize: "28px", fontWeight: "900", color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: "12px", color: "#a38f9d", marginTop: 4, fontWeight: "700" }}>{item.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Nhat ky Lich hen moi nhat</h3>
                  <p>8 lich hen gan day nhat trong he thong</p>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Ma LH</th>
                        <th>Ngay hen</th>
                        <th>Gio</th>
                        <th>Khach hang</th>
                        <th>Ky thuat vien</th>
                        <th>Trang thai</th>
                        <th style={{ textAlign: "right" }}>Thanh toan</th>
                        <th style={{ textAlign: "right" }}>So tien</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.latestAppointments || []).map((appt) => (
                        <tr key={appt.appointmentId}>
                          <td style={{ fontWeight: "700", color: "#e8396c" }}>#{appt.appointmentId}</td>
                          <td>{formatDate(appt.appointmentDate)}</td>
                          <td>{timeText(appt.startTime)} - {timeText(appt.endTime)}</td>
                          <td style={{ fontWeight: "600" }}>{appt.customerName || "—"}</td>
                          <td>
                            <span className="staff-assign-badge">{appt.employeeName || "Chua phan cong"}</span>
                          </td>
                          <td><span className={statusClass(appt.status)}>{appt.status}</span></td>
                          <td style={{ textAlign: "right" }}><span className={statusClass(appt.paymentStatus)}>{appt.paymentStatus}</span></td>
                          <td style={{ textAlign: "right", fontWeight: "700" }}>{formatMoney(appt.finalAmount)}</td>
                        </tr>
                      ))}
                      {(!data.latestAppointments || data.latestAppointments.length === 0) && (
                        <tr><td colSpan={8} style={{ textAlign: "center", color: "#a38f9d", padding: "30px" }}>Chua co lich hen</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          )}

          {/* TAB: FEEDBACK & REFUNDS */}
          {activeTab === "feedback" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="feedback-reviews-tab-layout">
                <div>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "850", color: "#2d2430" }}>Danh gia moi nhat</h3>
                  <div className="premium-reviews-feed">
                    {(data.latestReviews || []).map((rv) => (
                      <div key={rv.reviewId} className="premium-review-card-new">
                        <div className="review-top-bar">
                          <strong>{rv.customerName || "Khach hang"}</strong>
                          <span className="rating-stars" style={{ color: "#f59e0b" }}>{renderStars(rv.rating)}</span>
                        </div>
                        <p className="comment">{rv.comment || "Khong co noi dung"}</p>
                        <div className="review-bottom-meta">
                          <span className="service">{rv.serviceName}</span>
                          <span className="dot" />
                          {rv.employeeName && <span>KTV: {rv.employeeName}</span>}
                          <span className="dot" />
                          <span>{formatDate(rv.createdAt)}</span>
                          <span className="dot" />
                          <span className={statusClass(rv.status)}>{rv.status}</span>
                        </div>
                      </div>
                    ))}
                    {(!data.latestReviews || data.latestReviews.length === 0) && (
                      <p style={{ color: "#a38f9d", textAlign: "center", padding: "40px" }}>Chua co danh gia</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: "850", color: "#2d2430" }}>Phan hoi gan day</h3>
                  <div className="premium-feedbacks-feed">
                    {(data.recentFeedbacks || []).map((fb) => (
                      <div key={fb.feedbackId} className="premium-feedback-card-new">
                        <div className="feedback-top-bar">
                          <h4>{fb.subject || "Khong co tieu de"}</h4>
                          <span className={statusClass(fb.status)}>{fb.status}</span>
                        </div>
                        <p className="content">{fb.content}</p>
                        <div className="feedback-bottom-meta">
                          <span>{fb.customerName || "Khach hang"}</span>
                          <span>{formatDateTime(fb.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {(!data.recentFeedbacks || data.recentFeedbacks.length === 0) && (
                      <p style={{ color: "#a38f9d", textAlign: "center", padding: "40px" }}>Chua co phan hoi</p>
                    )}
                  </div>
                </div>
              </div>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Danh sach Hoan tien gan day</h3>
                  <p>Tong cho xu ly: <strong style={{ color: "#ef4444" }}>{summary.pendingRefunds ?? 0}</strong> | Da hoan: <strong style={{ color: "#10b981" }}>{summary.completedRefunds ?? 0}</strong></p>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Ma HT</th>
                        <th>Khach hang</th>
                        <th>Ly do</th>
                        <th>Trang thai</th>
                        <th style={{ textAlign: "right" }}>So tien</th>
                        <th>Ngay tao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.pendingRefunds || []).map((r) => (
                        <tr key={r.refundId}>
                          <td style={{ fontWeight: "700", color: "#e8396c" }}>#{r.refundId}</td>
                          <td style={{ fontWeight: "600" }}>{r.customerName || "—"}</td>
                          <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "—"}</td>
                          <td><span className={statusClass(r.status)}>{r.status}</span></td>
                          <td style={{ textAlign: "right", fontWeight: "700", color: "#ef4444" }}>{formatMoney(r.refundAmount)}</td>
                          <td>{formatDate(r.createdAt)}</td>
                        </tr>
                      ))}
                      {(!data.pendingRefunds || data.pendingRefunds.length === 0) && (
                        <tr><td colSpan={6} style={{ textAlign: "center", color: "#a38f9d", padding: "30px" }}>Khong co hoan tien nao</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="chart-card">
                <div className="chart-header">
                  <h3>Yeu cau Chi tra Ky thuat vien (Payout)</h3>
                  <p>Cho phe duyet: <strong style={{ color: "#f59e0b" }}>{summary.pendingPayouts ?? 0}</strong> | Tong da chi: <strong style={{ color: "#10b981" }}>{formatMoney(summary.totalPaidOut)}</strong></p>
                </div>
                <div className="table-responsive-new">
                  <table className="premium-admin-table">
                    <thead>
                      <tr>
                        <th>Ma YC</th>
                        <th>Ky thuat vien</th>
                        <th>Trang thai</th>
                        <th style={{ textAlign: "right" }}>So tien</th>
                        <th>Ngay yeu cau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.pendingPayouts || []).map((p) => (
                        <tr key={p.payoutRequestId}>
                          <td style={{ fontWeight: "700", color: "#8b5cf6" }}>#{p.payoutRequestId}</td>
                          <td style={{ fontWeight: "600" }}>{p.technicianName || "—"}</td>
                          <td><span className={statusClass(p.status)}>{p.status}</span></td>
                          <td style={{ textAlign: "right", fontWeight: "700", color: "#8b5cf6" }}>{formatMoney(p.amount)}</td>
                          <td>{formatDateTime(p.requestedAt)}</td>
                        </tr>
                      ))}
                      {(!data.pendingPayouts || data.pendingPayouts.length === 0) && (
                        <tr><td colSpan={5} style={{ textAlign: "center", color: "#a38f9d", padding: "30px" }}>Khong co yeu cau payout nao dang cho</td></tr>
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
