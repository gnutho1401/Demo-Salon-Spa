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

function Avatar({ src, name, size = "40px" }) {
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
    fontSize: size === "32px" ? "0.85rem" : "1rem",
    border: "2px solid #ebdcc5",
    boxShadow: "0 3px 6px rgba(0,0,0,0.05)",
    flexShrink: 0,
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("vi-VN"));
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const today = new Date();
  const todayText = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    }, 4500);
  }

  // Action Handlers
  async function executeAppointmentAction(id, actionPath, actionName) {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      await axiosClient.put(`/receptionist/appointments/${id}/${actionPath}`);
      showToast(`Đã thực hiện: ${actionName} thành công!`, "success");
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
      showToast(res.data?.message || "Đã chuyển đổi khách hàng từ danh sách chờ thành công!", "success");
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể chuyển đổi lịch hẹn", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // Computed Values
  const appointments = useMemo(() => {
    let list = stats?.todayAppointments || [];
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

  // Donut chart calculations
  const totalInvoices = invoiceCount || 1;
  const paidPercent = percent(paidInvoiceCount, totalInvoices);
  const unpaidPercent = percent(unpaidInvoiceCount, totalInvoices);
  const refundPercent = percent(refundPendingCount, totalInvoices);

  // SVG Circle Stroke Math
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const paidDash = (paidPercent / 100) * circumference;
  const unpaidDash = (unpaidPercent / 100) * circumference;
  const refundDash = (refundPercent / 100) * circumference;

  return (
    <ReceptionistLayout>
      <div className="cockpit-dashboard">
        {/* Advanced visual styling injection */}
        <style>{`
          .cockpit-dashboard {
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
            color: #2b231c;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: cockpitFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes cockpitFadeIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Toast Alert Banner */
          .cockpit-toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 16px 28px;
            border-radius: 14px;
            color: #fff;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
            z-index: 9999;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.92rem;
            animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes slideInRight {
            from { transform: translateX(130%); }
            to { transform: translateX(0); }
          }

          /* Top Navigation & Greeter Cockpit */
          .cockpit-header {
            display: grid;
            grid-template-columns: 1fr auto auto;
            align-items: center;
            gap: 24px;
            background: linear-gradient(135deg, rgba(27, 61, 47, 0.95), rgba(18, 40, 31, 0.98));
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 24px 32px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(18, 40, 31, 0.15);
            color: #fff;
            position: relative;
            overflow: hidden;
          }

          .cockpit-header::after {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(239, 79, 131, 0.15), transparent 70%);
            pointer-events: none;
            border-radius: 50%;
          }

          .cockpit-header-left h1 {
            margin: 0;
            font-family: Georgia, serif;
            font-size: 2.1rem;
            letter-spacing: -0.5px;
            background: linear-gradient(120deg, #fffbeb, #ebdcc5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .cockpit-header-left p {
            margin: 6px 0 0;
            font-size: 0.95rem;
            color: #a3b899;
          }

          .cockpit-clock {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 10px 20px;
            border-radius: 16px;
            text-align: center;
            font-weight: 800;
            font-size: 1.15rem;
            letter-spacing: 1px;
            font-family: monospace;
            color: #ebdcc5;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
          }

          .cockpit-header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .cockpit-btn {
            padding: 12px 24px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: none;
          }

          .cockpit-btn-light {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }

          .cockpit-btn-light:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
          }

          .cockpit-btn-primary {
            background: linear-gradient(135deg, #ef4f83, #ff7aa6);
            color: #fff;
            box-shadow: 0 4px 15px rgba(239, 79, 131, 0.4);
          }

          .cockpit-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(239, 79, 131, 0.55);
            filter: brightness(1.08);
          }

          /* KPI Panel Row */
          .cockpit-kpi-row {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }

          @media (max-width: 1100px) {
            .cockpit-kpi-row {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .cockpit-kpi-card {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 20px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 4px 15px rgba(180, 83, 9, 0.02);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }

          .cockpit-kpi-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(180, 83, 9, 0.08);
            border-color: #d1b491;
          }

          .cockpit-kpi-icon-box {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            display: grid;
            place-items: center;
            font-size: 1.5rem;
            flex-shrink: 0;
          }

          .kpi-box-blue { background: #e3f2fd; color: #0d47a1; }
          .kpi-box-green { background: #e8f5e9; color: #1b5e20; }
          .kpi-box-amber { background: #fff8e1; color: #ff6f00; }
          .kpi-box-red { background: #ffebee; color: #b71c1c; }
          .kpi-box-purple { background: #f3e5f5; color: #4a148c; }

          .cockpit-kpi-info h3 {
            margin: 0;
            font-size: 0.76rem;
            color: #8c7e74;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
          }

          .cockpit-kpi-info h2 {
            margin: 4px 0 2px 0;
            font-size: 1.6rem;
            font-weight: 900;
            color: #1b3d2f;
          }

          .cockpit-kpi-info p {
            margin: 0;
            font-size: 0.72rem;
            color: #666;
            line-height: 1.3;
          }

          /* Two main vertical sections grid layout */
          .cockpit-main-layout {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 24px;
          }

          @media (max-width: 1000px) {
            .cockpit-main-layout {
              grid-template-columns: 1fr;
            }
          }

          .cockpit-card {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(180, 83, 9, 0.02);
            margin-bottom: 24px;
            position: relative;
          }

          .cockpit-card-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1.5px solid #f1ebd9;
            padding-bottom: 14px;
          }

          .cockpit-card-title h3 {
            margin: 0;
            font-family: Georgia, serif;
            font-size: 1.25rem;
            color: #1b3d2f;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Filter timeline controls */
          .timeline-filters {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
            background: #faf8f5;
            padding: 10px 16px;
            border-radius: 14px;
            border: 1px solid #ebdcc5;
          }

          .filter-btn-group {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .filter-btn {
            border: none;
            background: none;
            padding: 6px 12px;
            font-size: 0.75rem;
            font-weight: 800;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            color: #8c7e74;
            border: 1px solid transparent;
          }

          .filter-btn:hover {
            color: #1b3d2f;
          }

          .filter-btn.active {
            background: #1b3d2f;
            color: #fff;
            border-color: #1b3d2f;
          }

          /* Dynamic list content wrapper */
          .scrollable-list {
            max-height: 480px;
            overflow-y: auto;
            padding-right: 6px;
          }

          .scrollable-list::-webkit-scrollbar {
            width: 6px;
          }

          .scrollable-list::-webkit-scrollbar-track {
            background: #faf8f5;
            border-radius: 8px;
          }

          .scrollable-list::-webkit-scrollbar-thumb {
            background: #ebdcc5;
            border-radius: 8px;
          }

          /* Row lists cards design */
          .rx-row-card {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            gap: 16px;
          }

          .rx-row-card:hover {
            background: #fffbeb;
            border-color: #ebdcc5;
            transform: translateX(4px);
            box-shadow: 0 6px 16px rgba(180, 83, 9, 0.05);
          }

          .rx-row-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .rx-row-info h4 {
            margin: 0;
            font-size: 0.94rem;
            color: #2b231c;
            font-weight: 700;
          }

          .rx-row-info p {
            margin: 4px 0 0;
            font-size: 0.8rem;
            color: #666;
            line-height: 1.4;
          }

          .rx-row-right {
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .rx-row-meta {
            text-align: right;
          }

          .rx-row-meta strong {
            display: block;
            font-size: 0.9rem;
            color: #1b3d2f;
          }

          .rx-row-meta span {
            display: block;
            font-size: 0.76rem;
            color: #8c7e74;
            margin-top: 2px;
          }

          /* Interactive Button Groups */
          .rx-btn-group {
            display: flex;
            gap: 8px;
          }

          .rx-action-btn {
            background: #fff;
            border: 1px solid #ebdcc5;
            color: #1b3d2f;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 0.78rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
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

          /* Status Badges */
          .rx-badge {
            font-size: 0.7rem;
            font-weight: 800;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 20px;
            display: inline-block;
            letter-spacing: 0.2px;
          }

          .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
          .status-confirmed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .status-checked_in { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
          .status-in_progress { background: #e8dbfc; color: #5c25a7; border: 1px solid #d4c0f8; }
          .status-completed { background: #e2f4e8; color: #166534; border: 1px solid #c2e9d2; }
          .status-cancelled { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .status-no_show { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }

          /* Charts & Visual Analytics Widgets */
          .financial-widget-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 16px;
            align-items: center;
          }

          @media (max-width: 1200px) {
            .financial-widget-grid {
              grid-template-columns: 1fr;
            }
          }

          /* SVG Donut Chart Styling */
          .donut-chart-container {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            width: 160px;
            height: 160px;
            margin: 0 auto;
          }

          .donut-text-center {
            position: absolute;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }

          .donut-text-center strong {
            font-size: 1.3rem;
            color: #1b3d2f;
            font-weight: 800;
          }

          .donut-text-center span {
            font-size: 0.72rem;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
          }

          .financial-metrics-legend {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .legend-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.8rem;
          }

          .legend-label-box {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
          }

          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 4px;
            display: inline-block;
          }

          /* Services progress item list */
          .progress-bar-group {
            margin-bottom: 12px;
          }

          .progress-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.78rem;
            font-weight: bold;
            margin-bottom: 4px;
          }

          .progress-track {
            height: 6px;
            background: #f1ebd9;
            border-radius: 4px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.8s ease-out;
          }

          /* Highlighted customer widget */
          .customer-highlight-card {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 14px;
          }

          /* Grid of Shortcuts (Tools Center) */
          .shortcuts-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          @media (max-width: 1200px) {
            .shortcuts-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .shortcut-btn {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            border-radius: 14px;
            padding: 14px 10px;
            text-align: center;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }

          .shortcut-btn:hover {
            background: #fffbeb;
            border-color: #b45309;
            transform: translateY(-2px);
          }

          .shortcut-icon {
            font-size: 1.6rem;
          }

          .shortcut-label {
            font-size: 0.78rem;
            font-weight: 800;
            color: #1b3d2f;
          }
        `}</style>

        {/* Action feedback toast */}
        {toast.show && (
          <div
            className="cockpit-toast"
            style={{
              backgroundColor: toast.type === "success" ? "#28a745" : toast.type === "info" ? "#17a2b8" : "#dc3545",
            }}
          >
            <span>{toast.type === "success" ? "✅" : toast.type === "info" ? "ℹ️" : "❌"}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Global welcome header */}
        <header className="cockpit-header">
          <div className="cockpit-header-left">
            <h1>Quầy Tiếp Tân Spa <span>🍃</span></h1>
            <p>Xin chào Lễ tân trực ca! Hôm nay: <strong>{todayText}</strong> • Vận hành & Doanh thu tự động</p>
          </div>

          <div className="cockpit-clock">
            ⏰ {currentTime}
          </div>

          <div className="cockpit-header-actions">
            <button className="cockpit-btn cockpit-btn-light" onClick={loadDashboardData} disabled={loading}>
              🔄 Làm mới dữ liệu
            </button>
            <Link className="cockpit-btn cockpit-btn-primary" to="/receptionist/appointments/create">
              ➕ Tạo lịch mới
            </Link>
          </div>
        </header>

        {error && <div style={{ color: "#721c24", backgroundColor: "#f8d7da", padding: "12px 18px", borderRadius: "12px", border: "1px solid #f5c6cb", marginBottom: "20px" }}>{error}</div>}

        {loading && !stats ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px", color: "#8c7e74" }}>
            <span style={{ fontSize: "44px", animation: "spin 1.5s linear infinite" }}>🔄</span>
            <h4 style={{ margin: "16px 0 0 0", fontFamily: "Georgia, serif" }}>Đang đồng bộ dữ liệu Dashboard...</h4>
          </div>
        ) : (
          <>
            {/* KPI statistics cards row */}
            <section className="cockpit-kpi-row">
              <div className="cockpit-kpi-card">
                <div className="cockpit-kpi-icon-box kpi-box-blue">📅</div>
                <div className="cockpit-kpi-info">
                  <h3>Đặt lịch</h3>
                  <h2>{stats?.todayAppointmentsCount || 0}</h2>
                  <p><strong>{stats?.pendingCount || 0}</strong> lượt chờ duyệt</p>
                </div>
              </div>

              <div className="cockpit-kpi-card">
                <div className="cockpit-kpi-icon-box kpi-box-amber">🔑</div>
                <div className="cockpit-kpi-info">
                  <h3>Đang chờ check-in</h3>
                  <h2>{stats?.checkedInCount || 0}</h2>
                  <p>Khách đã đến tiệm</p>
                </div>
              </div>

              <div className="cockpit-kpi-card">
                <div className="cockpit-kpi-icon-box kpi-box-purple">💆</div>
                <div className="cockpit-kpi-info">
                  <h3>Đang phục vụ</h3>
                  <h2>{stats?.inProgressCount || 0}</h2>
                  <p>KTV đang làm việc</p>
                </div>
              </div>

              <div className="cockpit-kpi-card">
                <div className="cockpit-kpi-icon-box kpi-box-green">💰</div>
                <div className="cockpit-kpi-info">
                  <h3>Doanh thu</h3>
                  <h2>{money(stats?.todayRevenue)}</h2>
                  <p><strong>{stats?.paidInvoiceCount || 0}</strong> hóa đơn đã thu</p>
                </div>
              </div>

              <div className="cockpit-kpi-card">
                <div className="cockpit-kpi-icon-box kpi-box-red">⚠️</div>
                <div className="cockpit-kpi-info">
                  <h3>Hoàn tiền & Hủy</h3>
                  <h2>{stats?.refundPendingCount || 0}</h2>
                  <p><strong>{stats?.cancelledCount || 0}</strong> lượt hủy hôm nay</p>
                </div>
              </div>
            </section>

            {/* Main grid dashboard cockpit layout */}
            <section className="cockpit-main-layout">
              
              {/* Left Column (Timeline and queue operation) */}
              <div>
                {/* Section 1: Today Appointments */}
                <div className="cockpit-card">
                  <div className="cockpit-card-title">
                    <h3>📅 Vận hành & Phân công Lịch hẹn ({appointments.length} lịch)</h3>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Lọc nhanh tên/sđt..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid #ebdcc5",
                          fontSize: "0.8rem",
                          outline: "none",
                          width: "160px",
                        }}
                      />
                      <Link to="/receptionist/appointments" style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#1b3d2f", textDecoration: "none" }}>Xem chi tiết →</Link>
                    </div>
                  </div>

                  {/* Filter tabs inside cockpit card */}
                  <div className="timeline-filters">
                    <span style={{ fontSize: "0.76rem", fontWeight: "bold", color: "#666" }}>Bộ lọc trạng thái:</span>
                    <div className="filter-btn-group">
                      {[
                        ["ALL", "Tất cả"],
                        ["PENDING", "Chờ duyệt"],
                        ["CONFIRMED", "Đã xác nhận"],
                        ["CHECKED_IN", "Đã check-in"],
                        ["IN_PROGRESS", "Đang làm"],
                        ["COMPLETED", "Đã xong"],
                        ["CANCELLED", "Đã hủy"],
                      ].map(([status, text]) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatusFilter(status)}
                          className={`filter-btn ${statusFilter === status ? "active" : ""}`}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable list of today's appointments */}
                  <div className="scrollable-list">
                    {appointments.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#8c7e74" }}>
                        🏝️ Không tìm thấy lịch hẹn nào hôm nay thỏa mãn điều kiện lọc.
                      </div>
                    ) : (
                      appointments.map((a) => (
                        <div className="rx-row-card" key={a.AppointmentId}>
                          <div className="rx-row-left">
                            <Avatar src={a.CustomerAvatarUrl} name={a.CustomerName} size="42px" />
                            <div className="rx-row-info">
                              <h4>{a.CustomerName}</h4>
                              <p>
                                📞 {a.CustomerPhone || "Chưa có SĐT"} • Dịch vụ: <strong>{a.ServiceName}</strong> ({a.TotalDuration}p)
                              </p>
                              <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "#666" }}>
                                👤 Kỹ thuật viên: <strong style={{ color: a.TechnicianName ? "#2b231c" : "#b45309" }}>{a.TechnicianName || "Chưa chỉ định"}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="rx-row-right">
                            <div className="rx-row-meta">
                              <strong>{a.StartTime} - {a.EndTime}</strong>
                              <span>{money(a.FinalAmount)} • <span className={`rx-badge status-${a.Status.toLowerCase()}`}>{translateStatus(a.Status)}</span></span>
                            </div>

                            {/* Direct workflows */}
                            <div className="rx-btn-group">
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
                                    Huỷ
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
                                    ✕ Hủy
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
                                  💳 Checkout tính tiền
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 2: Smart Waiting List and Queues */}
                <div className="cockpit-card">
                  <div className="cockpit-card-title">
                    <h3>⏳ Smart Hàng Chờ & Check-in Queue (Xếp Hàng Quầy Lễ Tân)</h3>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", color: "#8c7e74" }}>
                      <span>Tổng: <strong>{stats?.waitingTodayCount || 0}</strong> ca</span>
                      <span>• Đã khớp: <strong style={{ color: "#28a745" }}>{stats?.matchedTodayCount || 0}</strong> ca</span>
                      <span>• Đã đặt thành công: <strong style={{ color: "#007bff" }}>{stats?.bookedTodayCount || 0}</strong> ca</span>
                    </div>
                  </div>

                  <div className="scrollable-list" style={{ maxHeight: "300px" }}>
                    {checkInQueue.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#8c7e74" }}>
                        ⏳ Hiện tại chưa có khách hàng nào xếp hàng chờ check-in tại quầy lễ tân.
                      </div>
                    ) : (
                      checkInQueue.map((q) => (
                        <div className="rx-row-card" key={`queue-${q.AppointmentId}`}>
                          <div className="rx-row-left">
                            <Avatar src={q.CustomerAvatarUrl} name={q.CustomerName} size="38px" />
                            <div className="rx-row-info">
                              <h4>{q.CustomerName}</h4>
                              <p>⏱️ Khung giờ: {q.StartTime} - {q.EndTime} • Dịch vụ: {q.ServiceName}</p>
                            </div>
                          </div>
                          <div className="rx-row-right">
                            <span className="rx-badge status-confirmed">Sẵn sàng phục vụ</span>
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
              </div>

              {/* Right Column (Financial, Performance charts & Command shortcuts) */}
              <div>
                
                {/* Card 3: Finance Cockpit with SVG Donut Chart */}
                <div className="cockpit-card">
                  <div className="cockpit-card-title">
                    <h3>📊 Báo cáo Doanh thu & Hóa đơn hôm nay</h3>
                    <Link to="/receptionist/invoices" style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#1b3d2f", textDecoration: "none" }}>Sổ hóa đơn →</Link>
                  </div>

                  <div className="financial-widget-grid">
                    {/* SVG Donut Chart representation */}
                    <div className="donut-chart-container">
                      <svg width="150" height="150" viewBox="0 0 120 120">
                        {/* Background stroke */}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#f1ebd9" strokeWidth="12" />
                        
                        {/* Paid stroke */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="#28a745"
                          strokeWidth="12"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - paidDash}
                          transform="rotate(-90 60 60)"
                        />
                        
                        {/* Unpaid stroke */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="#ff8c00"
                          strokeWidth="12"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - (paidDash + unpaidDash)}
                          transform={`rotate(${-90 + (paidPercent * 3.6)} 60 60)`}
                        />
                      </svg>
                      
                      <div className="donut-text-center">
                        <strong>{paidPercent}%</strong>
                        <span>Đã thu</span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div className="financial-metrics-legend">
                      <div className="legend-item">
                        <div className="legend-label-box">
                          <span className="legend-color" style={{ backgroundColor: "#2b231c" }} />
                          <span>Tổng hóa đơn</span>
                        </div>
                        <strong>{invoiceCount}</strong>
                      </div>

                      <div className="legend-item">
                        <div className="legend-label-box">
                          <span className="legend-color" style={{ backgroundColor: "#28a745" }} />
                          <span>Đã thu tiền</span>
                        </div>
                        <strong>{paidInvoiceCount} ({paidPercent}%)</strong>
                      </div>

                      <div className="legend-item">
                        <div className="legend-label-box">
                          <span className="legend-color" style={{ backgroundColor: "#ff8c00" }} />
                          <span>Chưa thu tiền</span>
                        </div>
                        <strong>{unpaidInvoiceCount} ({unpaidPercent}%)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Pending Refund requests */}
                  {pendingRefunds.length > 0 && (
                    <div style={{ marginTop: "20px", borderTop: "1.5px solid #ebdcc5", paddingTop: "15px" }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#dc3545", fontWeight: "bold" }}>⚠️ Cần xử lý yêu cầu hoàn trả tiền ({pendingRefunds.length})</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {pendingRefunds.map((ref) => (
                          <div key={ref.RefundId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff5f5", border: "1px solid #f5c6cb", padding: "10px", borderRadius: "10px" }}>
                            <div style={{ fontSize: "0.78rem" }}>
                              <strong>{ref.CustomerName}</strong> - Lý do: <em>"{ref.Reason}"</em>
                            </div>
                            <Link to="/receptionist/invoices" className="rx-action-btn danger" style={{ fontSize: "0.72rem", padding: "4px 8px", textDecoration: "none" }}>
                              Duyệt {money(ref.RefundAmount)}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 4: Service charts and Highlighted Customer */}
                <div className="cockpit-card">
                  <div className="cockpit-card-title">
                    <h3>📈 Thị hiếu dịch vụ & Khách hàng nổi bật</h3>
                  </div>

                  {/* Popular Services bar charts */}
                  <h4 style={{ fontSize: "0.82rem", color: "#8c7e74", margin: "0 0 12px 0", textTransform: "uppercase" }}>🔥 Dịch vụ được lựa chọn nhiều nhất hôm nay</h4>
                  <div style={{ background: "#faf8f5", padding: "16px", borderRadius: "14px", border: "1px solid #ebdcc5", marginBottom: "20px" }}>
                    {popularServices.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "#888", textAlign: "center", margin: 0 }}>Chưa ghi nhận số liệu dịch vụ hôm nay.</p>
                    ) : (
                      popularServices.map((s, idx) => {
                        const maxVal = Math.max(...popularServices.map((x) => Number(x.BookingCount || 0)), 1);
                        const percentFill = Math.round((Number(s.BookingCount || 0) / maxVal) * 100);

                        return (
                          <div className="progress-bar-group" key={s.ServiceId}>
                            <div className="progress-header">
                              <span>{s.ServiceName}</span>
                              <span style={{ color: "#1b3d2f" }}>{s.BookingCount} lượt</span>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${percentFill}%`,
                                  backgroundColor: idx === 0 ? "#1b3d2f" : idx === 1 ? "#ebdcc5" : "#b45309",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* VIP Profile summary */}
                  {highlightedCustomer && (
                    <>
                      <h4 style={{ fontSize: "0.82rem", color: "#8c7e74", margin: "18px 0 10px 0", textTransform: "uppercase" }}>⭐ Khách hàng nổi bật trong ca</h4>
                      <div className="customer-highlight-card">
                        <Avatar src={highlightedCustomer.AvatarUrl} name={highlightedCustomer.FullName} size="46px" />
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: "0.88rem", color: "#1b3d2f" }}>{highlightedCustomer.FullName}</strong>
                          <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "#666" }}>
                            SĐT: {highlightedCustomer.Phone || "Chưa cập nhật"} • Chi tiêu: <strong style={{ color: "#b45309" }}>{money(highlightedCustomer.TotalSpent)}</strong>
                          </p>
                        </div>
                        <Link to="/receptionist/customers" className="rx-action-btn" style={{ fontSize: "0.72rem", padding: "6px 10px", textDecoration: "none" }}>Chi tiết</Link>
                      </div>
                    </>
                  )}
                </div>

                {/* Card 5: Quick command panel shortcuts */}
                <div className="cockpit-card">
                  <div className="cockpit-card-title">
                    <h3>⚡ Trung tâm Thao tác nhanh Lễ tân</h3>
                  </div>

                  <div className="shortcuts-grid">
                    <Link className="shortcut-btn" to="/receptionist/appointments/create?walkin=1">
                      <span className="shortcut-icon">🚶</span>
                      <span className="shortcut-label">Khách Walk-in</span>
                    </Link>

                    <Link className="shortcut-btn" to="/receptionist/appointments/create">
                      <span className="shortcut-icon">📅</span>
                      <span className="shortcut-label">Đặt lịch hẹn</span>
                    </Link>

                    <Link className="shortcut-btn" to="/receptionist/invoices">
                      <span className="shortcut-icon">🧾</span>
                      <span className="shortcut-label">Hóa đơn</span>
                    </Link>

                    <Link className="shortcut-btn" to="/receptionist/waiting-list">
                      <span className="shortcut-icon">⏳</span>
                      <span className="shortcut-label">Hàng chờ</span>
                    </Link>

                    <Link className="shortcut-btn" to="/admin/ai-crm">
                      <span className="shortcut-icon">🔮</span>
                      <span className="shortcut-label">AI CRM</span>
                    </Link>

                    <Link className="shortcut-btn" to="/receptionist/profile">
                      <span className="shortcut-icon">👤</span>
                      <span className="shortcut-label">Hồ sơ ca trực</span>
                    </Link>
                  </div>
                </div>

              </div>

            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
