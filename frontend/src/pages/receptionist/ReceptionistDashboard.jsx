import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 100);
}

function translateStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMED") return "Đã xác nhận";
  if (s === "COMPLETED") return "Đã hoàn thành";
  if (s === "CHECKED_IN") return "Đã check-in";
  if (s === "IN_PROGRESS") return "Đang phục vụ";
  if (s === "PENDING") return "Chờ xác nhận";
  if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (s === "CANCELLED") return "Đã hủy";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  if (s === "NO_SHOW") return "Vắng mặt";
  return status;
}

function Avatar({ src, name, size = "42px" }) {
  const url = src ? resolveFileUrl(src) : "";
  const letter = String(name || "?").trim().charAt(0).toUpperCase();

  const style = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
    backgroundColor: "#1b3d2f",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "1.1rem",
    border: "2px solid #ebdcc5",
    boxShadow: "0 4px 8px rgba(0,0,0,0.06)",
  };

  if (url) {
    return (
      <img
        style={style}
        src={url}
        alt={name || "avatar"}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return <div style={style}>{letter || "?"}</div>;
}

export default function ReceptionistDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("appointments");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const today = new Date();
  const todayText = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function loadDashboardData() {
    try {
      setLoading(true);
      const res = await axiosClient.get("/receptionist/dashboard");
      setStats(res.data.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được dữ liệu bảng điều khiển lễ tân");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  function showToast(msg, type = "success") {
    setToast({ show: true, message: msg, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  }

  // Quick action executors
  async function executeAppointmentAction(id, actionPath, actionName) {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      await axiosClient.put(`/receptionist/appointments/${id}/${actionPath}`);
      showToast(`Đã chuyển trạng thái lịch hẹn thành công: ${actionName}`, "success");
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || `Thao tác thất bại: ${actionName}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvertWaitingList(id) {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.post(`/receptionist/waiting-list/${id}/convert`);
      showToast(res.data?.message || "Đã chuyển đổi hàng chờ sang đặt lịch hẹn thành công!", "success");
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể chuyển đổi hàng chờ", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // Filter and Search Logic
  const appointments = useMemo(() => {
    let list = stats?.todayAppointments || [];

    // Filter by tab/status category
    if (statusFilter !== "ALL") {
      list = list.filter((a) => String(a.Status).toUpperCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (a) =>
          a.CustomerName?.toLowerCase().includes(q) ||
          a.CustomerPhone?.includes(q) ||
          a.ServiceName?.toLowerCase().includes(q) ||
          a.TechnicianName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [stats, searchQuery, statusFilter]);

  const checkInQueue = useMemo(() => {
    return stats?.checkInQueue || [];
  }, [stats]);

  const recentCheckIns = useMemo(() => {
    return stats?.recentCheckIns || [];
  }, [stats]);

  const popularServices = useMemo(() => {
    return stats?.popularServices || [];
  }, [stats]);

  const pendingRefunds = useMemo(() => {
    return stats?.pendingRefunds || [];
  }, [stats]);

  const highlightedCustomer = stats?.highlightedCustomer || null;

  const invoiceCount = Number(stats?.invoiceCount || 0);
  const paidInvoiceCount = Number(stats?.paidInvoiceCount || 0);
  const unpaidInvoiceCount = Number(stats?.unpaidInvoiceCount || 0);
  const refundPendingCount = Number(stats?.refundPendingCount || 0);

  return (
    <ReceptionistLayout>
      <div className="new-dashboard-wrapper">
        {/* Style injection block for the brand new screen design */}
        <style>{`
          .new-dashboard-wrapper {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
            color: #2b231c;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            animation: fadeIn 0.5s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Toast style override */
          .rx-db-toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 16px 24px;
            border-radius: 12px;
            color: #fff;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            font-weight: bold;
            display: flex;
            alignItems: center;
            gap: 10px;
            animation: slideInRight 0.3s ease-out;
          }

          @keyframes slideInRight {
            from { transform: translateX(120%); }
            to { transform: translateX(0); }
          }

          /* Glassmorphism Header */
          .rx-db-header {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid #ebdcc5;
            border-radius: 20px;
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(180, 83, 9, 0.03);
            flex-wrap: wrap;
            gap: 16px;
          }

          .rx-db-header-left h1 {
            margin: 0;
            font-family: Georgia, serif;
            font-size: 1.8rem;
            color: #1b3d2f;
          }

          .rx-db-header-left p {
            margin: 4px 0 0;
            font-size: 0.9rem;
            color: #7c7267;
          }

          .rx-db-search-bar {
            display: flex;
            align-items: center;
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 12px;
            padding: 8px 16px;
            width: 380px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            transition: all 0.25s ease;
          }

          .rx-db-search-bar:focus-within {
            border-color: #1b3d2f;
            box-shadow: 0 0 0 3px rgba(27, 61, 47, 0.08);
          }

          .rx-db-search-bar input {
            border: none;
            outline: none;
            width: 100%;
            font-size: 0.88rem;
            margin-left: 8px;
            background: transparent;
          }

          .rx-db-header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .rx-db-header-btn {
            background: #1b3d2f;
            color: #fff;
            border: none;
            padding: 10px 20px;
            border-radius: 10px;
            font-weight: bold;
            font-size: 0.88rem;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 10px rgba(27, 61, 47, 0.15);
          }

          .rx-db-header-btn:hover {
            background: #12281f;
            transform: translateY(-2px);
            box-shadow: 0 6px 14px rgba(27, 61, 47, 0.2);
          }

          /* KPI Row Grid */
          .rx-db-kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
          }

          .rx-db-kpi-card {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 120px;
            box-shadow: 0 4px 12px rgba(180, 83, 9, 0.02);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }

          .rx-db-kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: #ebdcc5;
          }

          .rx-db-kpi-card.kpi-green::before { background: #28a745; }
          .rx-db-kpi-card.kpi-amber::before { background: #b45309; }
          .rx-db-kpi-card.kpi-red::before { background: #dc3545; }
          .rx-db-kpi-card.kpi-blue::before { background: #007bff; }

          .rx-db-kpi-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(180, 83, 9, 0.08);
          }

          .rx-db-kpi-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .rx-db-kpi-title {
            font-size: 0.8rem;
            color: #8c7e74;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .rx-db-kpi-icon {
            font-size: 1.4rem;
            opacity: 0.85;
          }

          .rx-db-kpi-value {
            font-size: 1.6rem;
            font-weight: 800;
            color: #1b3d2f;
            margin: 8px 0 4px;
          }

          .rx-db-kpi-footer {
            font-size: 0.75rem;
            color: #666;
            line-height: 1.3;
          }

          /* Custom Tab Control Switcher */
          .rx-db-tabs-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #ebdcc5;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 12px;
          }

          .rx-db-tabs {
            display: flex;
            gap: 8px;
          }

          .rx-db-tab-btn {
            background: none;
            border: none;
            padding: 10px 20px;
            font-size: 0.95rem;
            font-weight: bold;
            color: #8c7e74;
            cursor: pointer;
            position: relative;
            transition: all 0.2s;
            border-bottom: 3px solid transparent;
            margin-bottom: -2.5px;
          }

          .rx-db-tab-btn:hover {
            color: #1b3d2f;
          }

          .rx-db-tab-btn.active {
            color: #1b3d2f;
            border-bottom-color: #1b3d2f;
          }

          /* Main content panel layout */
          .rx-db-panel {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 4px 15px rgba(180, 83, 9, 0.02);
            min-height: 480px;
            animation: fadeIn 0.4s ease-out;
          }

          .panel-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #ebdcc5;
            padding-bottom: 14px;
          }

          .panel-title-row h3 {
            margin: 0;
            font-size: 1.2rem;
            color: #1b3d2f;
            font-family: Georgia, serif;
          }

          /* Stepper & List view items */
          .rx-item-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .rx-item-card {
            border: 1px solid #ebdcc5;
            border-radius: 14px;
            padding: 16px 20px;
            background: #faf8f5;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
            flex-wrap: wrap;
            gap: 16px;
          }

          .rx-item-card:hover {
            background: #fdfbf7;
            transform: translateX(4px);
            border-color: #d1b491;
            box-shadow: 0 4px 12px rgba(180,83,9,0.04);
          }

          .rx-item-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .rx-item-details h4 {
            margin: 0;
            font-size: 0.95rem;
            color: #2b231c;
            font-weight: 700;
          }

          .rx-item-details p {
            margin: 4px 0 0;
            font-size: 0.82rem;
            color: #666;
            line-height: 1.4;
          }

          .rx-item-right {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .rx-item-meta {
            text-align: right;
          }

          .rx-item-meta strong {
            display: block;
            font-size: 0.9rem;
            color: #1b3d2f;
          }

          .rx-item-meta span {
            display: block;
            font-size: 0.78rem;
            color: #8c7e74;
            margin-top: 2px;
          }

          /* Status Badges */
          .rx-badge {
            font-size: 0.72rem;
            font-weight: bold;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 20px;
            display: inline-block;
          }

          .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
          .status-confirmed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .status-checked_in { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
          .status-in_progress { background: #e8dbfc; color: #5c25a7; border: 1px solid #d4c0f8; }
          .status-completed { background: #e2f4e8; color: #166534; border: 1px solid #c2e9d2; }
          .status-cancelled { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .status-no_show { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }

          /* Action Buttons group */
          .rx-action-btn-group {
            display: flex;
            gap: 8px;
          }

          .rx-action-btn {
            background: #fff;
            border: 1px solid #ebdcc5;
            color: #1b3d2f;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .rx-action-btn:hover {
            border-color: #1b3d2f;
            background: #faf8f5;
          }

          .rx-action-btn.primary {
            background: #1b3d2f;
            color: #fff;
            border-color: #1b3d2f;
          }

          .rx-action-btn.primary:hover {
            background: #12281f;
          }

          .rx-action-btn.danger {
            color: #c62828;
            border-color: #f5c6cb;
          }

          .rx-action-btn.danger:hover {
            background: #fff5f5;
            border-color: #c62828;
          }

          /* Quick Actions Dashboard center */
          .rx-db-tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
          }

          .tool-card {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 20px;
            display: flex;
            gap: 16px;
            transition: all 0.2s;
            text-decoration: none;
            color: inherit;
            cursor: pointer;
          }

          .tool-card:hover {
            background: #fffbeb;
            border-color: #d97706;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(180,83,9,0.05);
          }

          .tool-icon {
            font-size: 2.2rem;
            background: #fff;
            border: 1px solid #ebdcc5;
            width: 60px;
            height: 60px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.03);
          }

          .tool-info h4 {
            margin: 0;
            font-size: 0.95rem;
            color: #1b3d2f;
            font-weight: 700;
          }

          .tool-info p {
            margin: 6px 0 0;
            font-size: 0.8rem;
            color: #666;
            line-height: 1.4;
          }

          /* Dynamic service list progress */
          .rx-progress-item {
            margin-bottom: 16px;
          }

          .rx-progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 0.82rem;
            margin-bottom: 6px;
            font-weight: bold;
          }

          .rx-progress-bar-bg {
            height: 8px;
            background: #f1ebd9;
            border-radius: 4px;
            overflow: hidden;
          }

          .rx-progress-bar-fill {
            height: 100%;
            background: #ebdcc5;
            border-radius: 4px;
            transition: width 0.8s ease-out;
          }

          /* Two Column Grid for stats */
          .rx-db-two-cols {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
          }

          @media (max-width: 900px) {
            .rx-db-two-cols {
              grid-template-columns: 1fr;
            }
          }

          .sidebar-card {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
          }

          .sidebar-card h4 {
            margin: 0 0 16px 0;
            font-size: 0.9rem;
            color: #1b3d2f;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #ebdcc5;
            padding-bottom: 8px;
          }

          .vip-profile {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 12px;
          }

          .vip-details {
            width: 100%;
            text-align: left;
            margin-top: 10px;
            font-size: 0.8rem;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .vip-detail-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px dashed #ebdcc5;
            padding-bottom: 4px;
          }

          .vip-detail-row span {
            color: #666;
          }

          .vip-detail-row strong {
            color: #1b3d2f;
          }
        `}</style>

        {/* Global Toast Alert */}
        {toast.show && (
          <div
            className="rx-db-toast"
            style={{
              backgroundColor: toast.type === "success" ? "#28a745" : toast.type === "info" ? "#17a2b8" : "#dc3545",
            }}
          >
            {toast.type === "success" ? "✅" : toast.type === "info" ? "ℹ️" : "❌"} {toast.message}
          </div>
        )}

        {/* Header section */}
        <header className="rx-db-header">
          <div className="rx-db-header-left">
            <h1>Quầy Lễ Tân (Dashboard) 🍃</h1>
            <p>Ca trực: {todayText} • Luna Beauty Salon</p>
          </div>

          <div className="rx-db-search-bar">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Tìm khách hàng, số điện thoại, kỹ thuật viên hôm nay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rx-db-header-actions">
            <button className="rx-db-header-btn" onClick={loadDashboardData} disabled={loading}>
              🔄 Làm mới
            </button>
            <Link className="rx-db-header-btn" to="/receptionist/appointments/create">
              ➕ Đặt lịch mới
            </Link>
          </div>
        </header>

        {error && <div style={{ color: "#721c24", backgroundColor: "#f8d7da", padding: "12px 18px", borderRadius: "12px", border: "1px solid #f5c6cb", marginBottom: "20px" }}>{error}</div>}

        {loading && !stats ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", color: "#8c7e74" }}>
            <span style={{ fontSize: "40px", animation: "spin 1.5s linear infinite" }}>🔄</span>
            <h4 style={{ margin: "16px 0 0 0", fontFamily: "Georgia, serif" }}>Đang khởi tạo Dashboard...</h4>
          </div>
        ) : (
          <>
            {/* KPI grid row */}
            <section className="rx-db-kpi-grid">
              <div className="rx-db-kpi-card kpi-blue">
                <div className="rx-db-kpi-top">
                  <span className="rx-db-kpi-title">Đặt lịch hôm nay</span>
                  <span className="rx-db-kpi-icon">📅</span>
                </div>
                <div className="rx-db-kpi-value">{stats?.todayAppointmentsCount || 0}</div>
                <div className="rx-db-kpi-footer">
                  <strong>{stats?.pendingCount || 0}</strong> yêu cầu chờ lễ tân duyệt xác nhận.
                </div>
              </div>

              <div className="rx-db-kpi-card kpi-amber">
                <div className="rx-db-kpi-top">
                  <span className="rx-db-kpi-title">Đang chờ & Phục vụ</span>
                  <span className="rx-db-kpi-icon">💇</span>
                </div>
                <div className="rx-db-kpi-value">
                  {stats?.checkedInCount || 0} / {stats?.inProgressCount || 0}
                </div>
                <div className="rx-db-kpi-footer">
                  Có <strong>{stats?.checkedInCount || 0}</strong> khách đã check-in và <strong>{stats?.inProgressCount || 0}</strong> khách đang làm dịch vụ.
                </div>
              </div>

              <div className="rx-db-kpi-card kpi-green">
                <div className="rx-db-kpi-top">
                  <span className="rx-db-kpi-title">Doanh thu hôm nay</span>
                  <span className="rx-db-kpi-icon">💰</span>
                </div>
                <div className="rx-db-kpi-value">{money(stats?.todayRevenue)}</div>
                <div className="rx-db-kpi-footer">
                  Tương đương <strong>{stats?.paidInvoiceCount || 0}</strong> lượt thanh toán thành công.
                </div>
              </div>

              <div className="rx-db-kpi-card kpi-red">
                <div className="rx-db-kpi-top">
                  <span className="rx-db-kpi-title">Chờ hoàn tiền / Hủy</span>
                  <span className="rx-db-kpi-icon">↩️</span>
                </div>
                <div className="rx-db-kpi-value">{stats?.refundPendingCount || 0}</div>
                <div className="rx-db-kpi-footer">
                  <strong>{stats?.refundPendingCount || 0}</strong> hóa đơn yêu cầu hoàn trả & <strong>{stats?.cancelledCount || 0}</strong> lịch bị hủy.
                </div>
              </div>

              <div className="rx-db-kpi-card kpi-amber">
                <div className="rx-db-kpi-top">
                  <span className="rx-db-kpi-title">Danh sách chờ</span>
                  <span className="rx-db-kpi-icon">⏳</span>
                </div>
                <div className="rx-db-kpi-value">{stats?.waitingListCount || 0}</div>
                <div className="rx-db-kpi-footer">
                  Có <strong>{stats?.waitingTodayCount || 0}</strong> khách hàng trong danh sách chờ hôm nay.
                </div>
              </div>
            </section>

            {/* Smart tab control switcher */}
            <section className="rx-db-tabs-container">
              <div className="rx-db-tabs">
                <button
                  type="button"
                  onClick={() => { setActiveTab("appointments"); setStatusFilter("ALL"); }}
                  className={`rx-db-tab-btn ${activeTab === "appointments" ? "active" : ""}`}
                >
                  📅 Tiến trình Lịch hẹn
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("waiting-list")}
                  className={`rx-db-tab-btn ${activeTab === "waiting-list" ? "active" : ""}`}
                >
                  ⏳ Hàng chờ Smart List
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("finance")}
                  className={`rx-db-tab-btn ${activeTab === "finance" ? "active" : ""}`}
                >
                  🧾 Hóa đơn & Hoàn tiền
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("insights")}
                  className={`rx-db-tab-btn ${activeTab === "insights" ? "active" : ""}`}
                >
                  📊 Hiệu suất & KTV
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tools")}
                  className={`rx-db-tab-btn ${activeTab === "tools" ? "active" : ""}`}
                >
                  ⚡ Thao tác nhanh
                </button>
              </div>
              
              {activeTab === "appointments" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    ["ALL", "Tất cả"],
                    ["PENDING", "Chờ duyệt"],
                    ["CONFIRMED", "Đã xác nhận"],
                    ["CHECKED_IN", "Đã check-in"],
                    ["IN_PROGRESS", "Đang phục vụ"],
                    ["COMPLETED", "Đã xong"],
                    ["CANCELLED", "Đã hủy"],
                  ].map(([status, text]) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        borderRadius: "8px",
                        border: "1px solid #ebdcc5",
                        cursor: "pointer",
                        backgroundColor: statusFilter === status ? "#1b3d2f" : "#fff",
                        color: statusFilter === status ? "#fff" : "#1b3d2f",
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Render selected tab panel */}
            <section className="rx-db-panel">
              {activeTab === "appointments" && (
                <div>
                  <div className="panel-title-row">
                    <h3>Danh sách khách hàng đặt lịch hôm nay ({appointments.length} lịch hẹn)</h3>
                    <Link to="/receptionist/appointments" style={{ fontSize: "0.85rem", color: "#1b3d2f", fontWeight: "bold" }}>Xem lịch hẹn nâng cao →</Link>
                  </div>

                  <div className="rx-item-list">
                    {appointments.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#8c7e74" }}>
                        🏝️ Không có lịch hẹn nào khớp với bộ lọc trạng thái.
                      </div>
                    ) : (
                      appointments.map((a) => (
                        <div className="rx-item-card" key={a.AppointmentId}>
                          <div className="rx-item-left">
                            <Avatar src={a.CustomerAvatarUrl} name={a.CustomerName} size="46px" />
                            <div className="rx-item-details">
                              <h4>{a.CustomerName}</h4>
                              <p>
                                📞 {a.CustomerPhone || "Chưa có SĐT"} • Dịch vụ: <strong>{a.ServiceName}</strong> ({a.TotalDuration} phút)
                              </p>
                              <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "#666" }}>
                                👤 Kỹ thuật viên phụ trách:{" "}
                                <strong style={{ color: a.TechnicianName ? "#2b231c" : "#b45309" }}>
                                  {a.TechnicianName || "Chưa chỉ định"}
                                </strong>
                              </p>
                            </div>
                          </div>

                          <div className="rx-item-right">
                            <div className="rx-item-meta">
                              <strong>{a.StartTime} - {a.EndTime}</strong>
                              <span>{money(a.FinalAmount)} • Trạng thái: <span className={`rx-badge status-${a.Status.toLowerCase()}`}>{translateStatus(a.Status)}</span></span>
                            </div>

                            {/* Inline Workflow actions */}
                            <div className="rx-action-btn-group">
                              {a.Status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "confirm", "Xác nhận lịch")}
                                    className="rx-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    ✓ Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "cancel", "Hủy lịch")}
                                    className="rx-action-btn danger"
                                    disabled={actionLoading}
                                  >
                                    ✕ Hủy
                                  </button>
                                </>
                              )}

                              {a.Status === "CONFIRMED" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "check-in", "Check-in khách")}
                                    className="rx-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    🔑 Check-in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "cancel", "Hủy lịch")}
                                    className="rx-action-btn danger"
                                    disabled={actionLoading}
                                  >
                                    Huỷ lịch
                                  </button>
                                </>
                              )}

                              {a.Status === "CHECKED_IN" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "start", "Bắt đầu dịch vụ")}
                                    className="rx-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    ▶ Bắt đầu làm
                                  </button>
                                  <Link to={`/receptionist/appointments?assign=${a.AppointmentId}`} className="rx-action-btn">
                                    🔄 Đổi KTV
                                  </Link>
                                </>
                              )}

                              {a.Status === "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={() => executeAppointmentAction(a.AppointmentId, "complete", "Hoàn thành dịch vụ")}
                                  className="rx-action-btn primary"
                                  disabled={actionLoading}
                                >
                                  🏁 Hoàn thành
                                </button>
                              )}

                              {(a.Status === "COMPLETED" || a.Status === "PENDING_PAYMENT") && (
                                <Link
                                  to={`/receptionist/invoices`}
                                  className="rx-action-btn primary"
                                  style={{ textDecoration: "none" }}
                                >
                                  💳 Checkout & Hóa đơn
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "waiting-list" && (
                <div>
                  <div className="panel-title-row">
                    <h3>Danh sách khách hàng đang chờ khớp lịch hôm nay</h3>
                    <Link to="/receptionist/waiting-list" style={{ fontSize: "0.85rem", color: "#1b3d2f", fontWeight: "bold" }}>Quản lý hàng chờ nâng cao →</Link>
                  </div>

                  {/* Smart Waiting List Grid Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
                    <div style={{ background: "#f2faf4", padding: "14px", borderRadius: "12px", border: "1.5px solid #ebdcc5", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "bold" }}>Tổng Khách Đang Chờ</span>
                      <h4 style={{ margin: "4px 0 0", color: "#1b3d2f", fontSize: "1.2rem" }}>{stats?.waitingTodayCount || 0} khách</h4>
                    </div>
                    <div style={{ background: "#fffbeb", padding: "14px", borderRadius: "12px", border: "1.5px solid #ebdcc5", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "bold" }}>Đã Khớp Khung Giờ</span>
                      <h4 style={{ margin: "4px 0 0", color: "#b45309", fontSize: "1.2rem" }}>{stats?.matchedTodayCount || 0} khách</h4>
                    </div>
                    <div style={{ background: "#e2f4e8", padding: "14px", borderRadius: "12px", border: "1.5px solid #ebdcc5", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "bold" }}>Đã Đặt Lịch Thành Công</span>
                      <h4 style={{ margin: "4px 0 0", color: "#28a745", fontSize: "1.2rem" }}>{stats?.bookedTodayCount || 0} lịch</h4>
                    </div>
                    <div style={{ background: "#fff5f5", padding: "14px", borderRadius: "12px", border: "1.5px solid #ebdcc5", textAlign: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "bold" }}>Đã Hết Hạn / Bỏ Lỡ</span>
                      <h4 style={{ margin: "4px 0 0", color: "#dc3545", fontSize: "1.2rem" }}>{stats?.expiredTodayCount || 0} ca</h4>
                    </div>
                  </div>

                  <div className="panel-title-row" style={{ border: "none", marginBottom: "10px", paddingBottom: "0" }}>
                    <h4 style={{ margin: 0, color: "#1b3d2f" }}>Khách hàng đang xếp hàng chờ (Check-in Queue)</h4>
                  </div>
                  <div className="rx-item-list">
                    {checkInQueue.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#8c7e74" }}>
                        ⏳ Hiện không có khách hàng nào đang xếp hàng chờ Check-in tại quầy.
                      </div>
                    ) : (
                      checkInQueue.map((q) => (
                        <div className="rx-item-card" key={`queue-${q.AppointmentId}`}>
                          <div className="rx-item-left">
                            <Avatar src={q.CustomerAvatarUrl} name={q.CustomerName} size="46px" />
                            <div className="rx-item-details">
                              <h4>{q.CustomerName}</h4>
                              <p>📞 {q.CustomerPhone || "Chưa có SĐT"} • Khung giờ: <strong>{q.StartTime} - {q.EndTime}</strong></p>
                              <p style={{ color: "#666" }}>Dịch vụ đặt: <strong>{q.ServiceName}</strong> ({q.TotalDuration} phút)</p>
                            </div>
                          </div>

                          <div className="rx-item-right">
                            <div className="rx-item-meta" style={{ marginRight: "12px" }}>
                              <strong>KTV: {q.TechnicianName || "Tự động phân bổ"}</strong>
                              <span>Trạng thái: <span className="rx-badge status-confirmed">Sẵn sàng</span></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => executeAppointmentAction(q.AppointmentId, "check-in", "Check-in khách hàng")}
                              className="rx-action-btn primary"
                              disabled={actionLoading}
                            >
                              🔑 Check-in ngay
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "finance" && (
                <div>
                  <div className="panel-title-row">
                    <h3>Quản lý doanh thu, hóa đơn & yêu cầu hoàn tiền hôm nay</h3>
                    <Link to="/receptionist/invoices" style={{ fontSize: "0.85rem", color: "#1b3d2f", fontWeight: "bold" }}>Xem sổ hóa đơn →</Link>
                  </div>

                  <div className="rx-db-two-cols">
                    {/* Invoice detail stats */}
                    <div>
                      <h4 style={{ fontSize: "1rem", color: "#1b3d2f", margin: "0 0 16px 0", fontWeight: "bold" }}>Hóa đơn cần xử lý hôm nay</h4>
                      <div style={{ background: "#faf8f5", padding: "16px", borderRadius: "12px", border: "1px solid #ebdcc5", marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                          <span>Tổng số lượng hóa đơn ngày hôm nay:</span>
                          <strong>{invoiceCount} hóa đơn</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                          <span style={{ color: "#28a745" }}>✓ Đã thanh toán:</span>
                          <strong>{paidInvoiceCount} hóa đơn ({percent(paidInvoiceCount, invoiceCount)}%)</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "0.88rem" }}>
                          <span style={{ color: "#ff8c00" }}>📄 Chưa thanh toán:</span>
                          <strong>{unpaidInvoiceCount} hóa đơn ({percent(unpaidInvoiceCount, invoiceCount)}%)</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                          <span style={{ color: "#dc3545" }}>↩ Chờ hoàn trả/Hoàn tiền:</span>
                          <strong>{refundPendingCount} hóa đơn ({percent(refundPendingCount, invoiceCount)}%)</strong>
                        </div>
                      </div>

                      {/* Pending refund lists */}
                      <h4 style={{ fontSize: "1rem", color: "#1b3d2f", margin: "24px 0 12px 0", fontWeight: "bold" }}>⚠️ Yêu cầu hoàn tiền cần duyệt gấp ({pendingRefunds.length})</h4>
                      <div className="rx-item-list">
                        {pendingRefunds.length === 0 ? (
                          <div style={{ padding: "30px", textAlign: "center", color: "#8c7e74", border: "1px dashed #ebdcc5", borderRadius: "12px" }}>
                            ✅ Không có yêu cầu hoàn tiền nào chưa xử lý.
                          </div>
                        ) : (
                          pendingRefunds.map((ref) => (
                            <div className="rx-item-card" key={ref.RefundId} style={{ borderLeft: "4px solid #dc3545" }}>
                              <div className="rx-item-left">
                                <Avatar src={ref.CustomerAvatarUrl} name={ref.CustomerName} size="42px" />
                                <div className="rx-item-details">
                                  <h4>{ref.CustomerName}</h4>
                                  <p>Lý do: <em>"{ref.Reason}"</em></p>
                                  <small style={{ color: "#888" }}>Ngày tạo yêu cầu: {new Date(ref.CreatedAt).toLocaleString("vi-VN")}</small>
                                </div>
                              </div>

                              <div className="rx-item-right">
                                <div className="rx-item-meta" style={{ marginRight: "12px" }}>
                                  <strong>Số tiền: {money(ref.RefundAmount)}</strong>
                                  <span className="rx-badge status-pending">Chờ phê duyệt</span>
                                </div>
                                <Link to={`/receptionist/invoices`} className="rx-action-btn primary">
                                  Xem & Xử lý hoàn trả
                                </Link>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Timeline right sidebar */}
                    <div>
                      <div className="sidebar-card">
                        <h4>Hoạt động tài chính gần đây</h4>
                        <div className="rx-item-list">
                          {recentCheckIns.length === 0 ? (
                            <p style={{ fontSize: "0.8rem", color: "#888", textAlign: "center" }}>Chưa ghi nhận hoạt động thanh toán.</p>
                          ) : (
                            recentCheckIns.slice(0, 5).map((act) => (
                              <div key={`recent-fin-${act.AppointmentId}`} style={{ display: "flex", gap: "10px", borderBottom: "1px solid #ebdcc5", paddingBottom: "10px", fontSize: "0.8rem" }}>
                                <Avatar src={act.CustomerAvatarUrl} name={act.CustomerName} size="32px" />
                                <div>
                                  <strong style={{ color: "#1b3d2f" }}>{act.CustomerName}</strong>
                                  <p style={{ margin: "2px 0 0", color: "#666" }}>
                                    {act.ServiceName} • <span className={`rx-badge status-${act.Status.toLowerCase()}`} style={{ fontSize: "10px", padding: "2px 6px" }}>{translateStatus(act.Status)}</span>
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "insights" && (
                <div>
                  <div className="panel-title-row">
                    <h3>Phân tích hiệu suất dịch vụ & Thông tin khách hàng</h3>
                  </div>

                  <div className="rx-db-two-cols">
                    {/* Left col: Popular services */}
                    <div>
                      <h4 style={{ fontSize: "1rem", color: "#1b3d2f", margin: "0 0 16px 0", fontWeight: "bold" }}>🔥 Dịch vụ được lựa chọn nhiều nhất hôm nay</h4>
                      <div style={{ background: "#faf8f5", padding: "20px", border: "1px solid #ebdcc5", borderRadius: "16px", marginBottom: "20px" }}>
                        {popularServices.length === 0 ? (
                          <div style={{ color: "#8c7e74", textAlign: "center", padding: "20px" }}>Chưa có số liệu thống kê dịch vụ hôm nay.</div>
                        ) : (
                          popularServices.map((s) => {
                            const max = Math.max(...popularServices.map((x) => Number(x.BookingCount || 0)), 1);
                            const width = Math.round((Number(s.BookingCount || 0) / max) * 100);

                            return (
                              <div className="rx-progress-item" key={s.ServiceId}>
                                <div className="rx-progress-label">
                                  <span>{s.ServiceName}</span>
                                  <span style={{ color: "#1b3d2f" }}>{s.BookingCount} lượt đặt lịch</span>
                                </div>
                                <div className="rx-progress-bar-bg">
                                  <div className="rx-progress-bar-fill" style={{ width: `${width}%`, backgroundColor: "#1b3d2f" }}></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Right col: Highlighted VIP Customer Profile */}
                    <div>
                      <div className="sidebar-card">
                        <h4>⭐ Khách hàng nổi bật hôm nay</h4>
                        {highlightedCustomer ? (
                          <div className="vip-profile">
                            <Avatar src={highlightedCustomer.AvatarUrl} name={highlightedCustomer.FullName} size="72px" />
                            <h3 style={{ margin: "8px 0 0 0", fontSize: "1.1rem", color: "#1b3d2f", fontFamily: "Georgia, serif" }}>
                              {highlightedCustomer.FullName}
                            </h3>
                            <span className="rx-badge status-confirmed" style={{ fontWeight: "bold" }}>MEMBER SINCE {new Date(highlightedCustomer.MemberSince).getFullYear()}</span>
                            
                            <div className="vip-details">
                              <div className="vip-detail-row">
                                <span>Điện thoại:</span>
                                <strong>{highlightedCustomer.Phone || "Chưa cập nhật"}</strong>
                              </div>
                              <div className="vip-detail-row">
                                <span>Email:</span>
                                <strong>{highlightedCustomer.Email || "Chưa cập nhật"}</strong>
                              </div>
                              <div className="vip-detail-row">
                                <span>Lịch hẹn đã đi:</span>
                                <strong>{highlightedCustomer.TotalAppointments} lần</strong>
                              </div>
                              <div className="vip-detail-row">
                                <span>Tích lũy chi tiêu:</span>
                                <strong style={{ color: "#b45309" }}>{money(highlightedCustomer.TotalSpent)}</strong>
                              </div>
                            </div>
                            
                            <Link to="/receptionist/customers" style={{ width: "100%", textAlign: "center", textDecoration: "none", marginTop: "10px" }} className="rx-action-btn primary">
                              Xem hồ sơ khách hàng đầy đủ
                            </Link>
                          </div>
                        ) : (
                          <p style={{ textAlign: "center", color: "#888", fontSize: "0.82rem" }}>Chưa có thông tin khách hàng nổi bật.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "tools" && (
                <div>
                  <div className="panel-title-row">
                    <h3>Trung tâm thao tác nhanh thường dùng (Lễ tân Center)</h3>
                  </div>

                  <div className="rx-db-tools-grid">
                    <Link className="tool-card" to="/receptionist/appointments/create?walkin=1">
                      <div className="tool-icon">🚶</div>
                      <div className="tool-info">
                        <h4>Đón khách Walk-in ngay</h4>
                        <p>Khai báo và đặt lịch nhanh cho khách hàng đến trực tiếp spa mà không hẹn trước.</p>
                      </div>
                    </Link>

                    <Link className="tool-card" to="/receptionist/appointments/create">
                      <div className="tool-icon">📅</div>
                      <div className="tool-info">
                        <h4>Đặt lịch hẹn cho khách</h4>
                        <p>Tạo lịch hẹn làm đẹp, chọn ca trực, dịch vụ và phân bổ kỹ thuật viên phù hợp.</p>
                      </div>
                    </Link>

                    <Link className="tool-card" to="/receptionist/invoices">
                      <div className="tool-icon">🧾</div>
                      <div className="tool-info">
                        <h4>Quản lý hóa đơn & Checkout</h4>
                        <p>Kiểm tra danh sách hóa đơn chờ thanh toán, in hóa đơn và hoàn tiền.</p>
                      </div>
                    </Link>

                    <Link className="tool-card" to="/receptionist/waiting-list">
                      <div className="tool-icon">⏳</div>
                      <div className="tool-info">
                        <h4>Danh sách hàng chờ thông minh</h4>
                        <p>Theo dõi hàng chờ tự động, khớp khung giờ trống của kỹ thuật viên.</p>
                      </div>
                    </Link>

                    <Link className="tool-card" to="/admin/ai-crm">
                      <div className="tool-icon">🔮</div>
                      <div className="tool-info">
                        <h4>Phân tích AI CRM & Giữ chân</h4>
                        <p>Truy cập bảng điều khiển CRM thông minh dự báo rủi ro rời đi của khách hàng.</p>
                      </div>
                    </Link>

                    <Link className="tool-card" to="/receptionist/profile">
                      <div className="tool-icon">👤</div>
                      <div className="tool-info">
                        <h4>Hồ sơ cá nhân Lễ tân</h4>
                        <p>Cập nhật thông tin tài khoản ca trực, đổi mật khẩu và avatar cá nhân.</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
