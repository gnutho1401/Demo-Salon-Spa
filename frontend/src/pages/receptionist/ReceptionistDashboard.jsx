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

function Avatar({ src, name, size = "38px" }) {
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
    fontWeight: "700",
    fontSize: size === "32px" ? "0.8rem" : "0.95rem",
    border: "2px solid #ebdcc5",
    boxShadow: "0 4px 10px rgba(27, 61, 47, 0.08)",
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
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedHour, setSelectedHour] = useState("ALL"); // ALL or specific hour e.g. "09"
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

  // Time ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [dbRes, techRes] = await Promise.all([
        axiosClient.get("/receptionist/dashboard"),
        axiosClient.get("/receptionist/technicians")
      ]);
      setStats(dbRes.data.data || dbRes.data);
      setTechnicians(techRes.data.data || techRes.data || []);
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

  // Workflows
  async function executeAppointmentAction(id, actionPath, actionName) {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      await axiosClient.put(`/receptionist/appointments/${id}/${actionPath}`);
      showToast(`Cập nhật trạng thái lịch hẹn thành công: ${actionName}`, "success");
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || `Thao tác thất bại: ${actionName}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  // Filter and Search Logic
  const allAppointments = stats?.todayAppointments || [];

  const appointments = useMemo(() => {
    let list = allAppointments;

    // Filter by status tab
    if (statusFilter !== "ALL") {
      list = list.filter((a) => String(a.Status).toUpperCase() === statusFilter);
    }

    // Filter by selected hour
    if (selectedHour !== "ALL") {
      list = list.filter((a) => {
        const startHour = String(a.StartTime || "").split(":")[0];
        return startHour === selectedHour;
      });
    }

    // Filter by search query
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
  }, [allAppointments, searchQuery, statusFilter, selectedHour]);

  // Hourly booking slots density mapping
  const hourSlots = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];
  const hourBookingCounts = useMemo(() => {
    const counts = {};
    hourSlots.forEach(h => { counts[h] = 0; });
    allAppointments.forEach(a => {
      const startHour = String(a.StartTime || "").split(":")[0];
      if (counts[startHour] !== undefined) {
        counts[startHour]++;
      }
    });
    return counts;
  }, [allAppointments]);

  // Active appointments in progress
  const inProgressAppointments = useMemo(() => {
    return allAppointments.filter(a => String(a.Status).toUpperCase() === "IN_PROGRESS");
  }, [allAppointments]);

  // Live room allocation mapping
  const rooms = [
    { id: 1, name: "Phòng Massage 01", type: "Massage" },
    { id: 2, name: "Phòng Massage 02", type: "Massage" },
    { id: 3, name: "Phòng Chăm Sóc Da 01", type: "Skincare" },
    { id: 4, name: "Phòng Chăm Sóc Da 02", type: "Skincare" },
    { id: 5, name: "Phòng Detox 01", type: "Detox" },
    { id: 6, name: "Phòng Gội Đầu 01", type: "Hair" },
  ];

  const liveRooms = useMemo(() => {
    return rooms.map(room => {
      // Find an appointment in progress that fits this room type
      const activeApp = inProgressAppointments.find(a => {
        const sName = String(a.ServiceName || "").toLowerCase();
        if (room.type === "Massage" && sName.includes("massage")) return true;
        if (room.type === "Skincare" && (sName.includes("skin") || sName.includes("chăm sóc da") || sName.includes("mụn"))) return true;
        if (room.type === "Detox" && sName.includes("detox")) return true;
        if (room.type === "Hair" && (sName.includes("gội") || sName.includes("tóc"))) return true;
        return false;
      });

      if (activeApp) {
        // Remove from list so it doesn't double-allocate same appointment to multiple rooms
        const idx = inProgressAppointments.indexOf(activeApp);
        if (idx > -1) inProgressAppointments.splice(idx, 1);

        return {
          ...room,
          status: "BUSY",
          customerName: activeApp.CustomerName,
          technicianName: activeApp.TechnicianName || "Chưa gán",
          serviceName: activeApp.ServiceName,
          time: `${activeApp.StartTime} - ${activeApp.EndTime}`,
        };
      }

      return { ...room, status: "FREE" };
    });
  }, [inProgressAppointments]);

  // Live KTV dispatch calculations
  const liveTechnicians = useMemo(() => {
    return technicians.map(tech => {
      const busyApp = allAppointments.find(a => 
        a.TechnicianId === tech.TechnicianId && 
        String(a.Status).toUpperCase() === "IN_PROGRESS"
      );

      if (busyApp) {
        return {
          ...tech,
          status: "BUSY",
          customerName: busyApp.CustomerName,
          serviceName: busyApp.ServiceName,
        };
      }
      return { ...tech, status: "FREE" };
    });
  }, [technicians, allAppointments]);

  const checkInQueue = stats?.checkInQueue || [];
  const recentCheckIns = stats?.recentCheckIns || [];
  const popularServices = stats?.popularServices || [];
  const pendingRefunds = stats?.pendingRefunds || [];
  const highlightedCustomer = stats?.highlightedCustomer || null;

  const invoiceCount = Number(stats?.invoiceCount || 0);
  const paidInvoiceCount = Number(stats?.paidInvoiceCount || 0);
  const unpaidInvoiceCount = Number(stats?.unpaidInvoiceCount || 0);
  const refundPendingCount = Number(stats?.refundPendingCount || 0);

  // Financial calculations
  const totalInvoices = invoiceCount || 1;
  const paidPercent = percent(paidInvoiceCount, totalInvoices);
  const unpaidPercent = percent(unpaidInvoiceCount, totalInvoices);
  const refundPercent = percent(refundPendingCount, totalInvoices);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const paidDash = (paidPercent / 100) * circumference;
  const unpaidDash = (unpaidPercent / 100) * circumference;

  return (
    <ReceptionistLayout>
      <div className="hq-cockpit">
        {/* Style tags containing complete custom typography and layouts */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

          .hq-cockpit {
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: #2c2520;
            padding: 16px;
            background: #fbf9f6;
            animation: fadeInPage 0.5s ease-out;
          }

          @keyframes fadeInPage {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Toast Alert Overlay */
          .hq-toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 14px 24px;
            border-radius: 16px;
            color: #fff;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.88rem;
            animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes slideRight {
            from { transform: translateX(120%); }
            to { transform: translateX(0); }
          }

          /* Top Cockpit Header Panel */
          .hq-header-panel {
            background: linear-gradient(135deg, #1b3d2f 0%, #0f271d 100%);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            padding: 24px 28px;
            color: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            box-shadow: 0 10px 25px rgba(27, 61, 47, 0.15);
            flex-wrap: wrap;
            gap: 16px;
            position: relative;
          }

          .hq-header-panel::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 150px;
            height: 100%;
            background: radial-gradient(circle, rgba(209, 175, 103, 0.12), transparent 70%);
            pointer-events: none;
          }

          .hq-greeter h1 {
            margin: 0;
            font-size: 1.85rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(120deg, #fffcf5, #f5e4c3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .hq-greeter p {
            margin: 4px 0 0;
            font-size: 0.88rem;
            color: #b0c9b0;
          }

          .hq-shift-badge {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 0.8rem;
            color: #f5e4c3;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .hq-live-clock {
            font-family: monospace;
            font-size: 1.1rem;
            font-weight: 700;
            background: rgba(0,0,0,0.15);
            padding: 8px 16px;
            border-radius: 12px;
            border: 1.5px solid rgba(255,255,255,0.1);
            color: #fff;
          }

          /* Global Metrics Grid */
          .hq-metrics-row {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }

          @media (max-width: 1100px) {
            .hq-metrics-row {
              grid-template-columns: repeat(3, 1fr);
            }
          }

          .hq-metric-card {
            background: #fff;
            border: 1.5px solid #ebdcc5;
            border-radius: 20px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 4px 12px rgba(180, 83, 9, 0.01);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .hq-metric-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(180, 83, 9, 0.06);
            border-color: #d1b491;
          }

          .hq-metric-icon {
            width: 46px;
            height: 46px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            font-size: 1.3rem;
            flex-shrink: 0;
          }

          .icon-blue { background: #eef7ff; color: #1e88e5; }
          .icon-green { background: #eefaf0; color: #2e7d32; }
          .icon-amber { background: #fffdf5; color: #d97706; }
          .icon-red { background: #fff5f5; color: #e53935; }
          .icon-purple { background: #faf5ff; color: #8e24aa; }

          .hq-metric-info h3 {
            margin: 0;
            font-size: 0.72rem;
            color: #8c7e74;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.3px;
          }

          .hq-metric-info h2 {
            margin: 2px 0;
            font-size: 1.45rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .hq-metric-info p {
            margin: 0;
            font-size: 0.7rem;
            color: #666;
          }

          /* Two-Column Grid Setup */
          .hq-grid-container {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 20px;
          }

          @media (max-width: 1100px) {
            .hq-grid-container {
              grid-template-columns: 1fr;
            }
          }

          /* High fidelity cockpit layout cards */
          .hq-card {
            background: #fff;
            border: 1.5px solid #ebdcc5;
            border-radius: 24px;
            padding: 22px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(180, 83, 9, 0.015);
          }

          .hq-card-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #f1ebd9;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }

          .hq-card-title h3 {
            margin: 0;
            font-family: Georgia, serif;
            font-size: 1.15rem;
            color: #1b3d2f;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 800;
          }

          /* Time Slots grid filtering */
          .hq-hours-grid {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }

          .hq-hours-grid::-webkit-scrollbar {
            height: 4px;
          }

          .hq-hours-grid::-webkit-scrollbar-thumb {
            background: #ebdcc5;
            border-radius: 4px;
          }

          .hour-slot-btn {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            padding: 6px 12px;
            border-radius: 10px;
            font-size: 0.72rem;
            font-weight: 800;
            color: #8c7e74;
            cursor: pointer;
            transition: all 0.2s;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 50px;
          }

          .hour-slot-btn:hover {
            border-color: #1b3d2f;
            color: #1b3d2f;
          }

          .hour-slot-btn.active {
            background: #1b3d2f;
            border-color: #1b3d2f;
            color: #fff;
            box-shadow: 0 4px 10px rgba(27,61,47,0.15);
          }

          .hour-slot-btn span {
            font-size: 0.62rem;
            font-weight: 500;
            opacity: 0.8;
            margin-top: 2px;
          }

          /* Live Table and Rows */
          .hq-scroll-list {
            max-height: 460px;
            overflow-y: auto;
            padding-right: 6px;
          }

          .hq-scroll-list::-webkit-scrollbar {
            width: 5px;
          }

          .hq-scroll-list::-webkit-scrollbar-thumb {
            background: #ebdcc5;
            border-radius: 6px;
          }

          .hq-row-item {
            background: #faf8f5;
            border: 1.5px solid #f1ebd9;
            border-radius: 16px;
            padding: 14px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            gap: 14px;
          }

          .hq-row-item:hover {
            background: #fffdf5;
            border-color: #ebdcc5;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(180,83,9,0.03);
          }

          .hq-row-details h4 {
            margin: 0;
            font-size: 0.9rem;
            color: #2b231c;
            font-weight: 700;
          }

          .hq-row-details p {
            margin: 3px 0 0;
            font-size: 0.76rem;
            color: #666;
          }

          .hq-row-meta {
            text-align: right;
            margin-right: 10px;
          }

          .hq-row-meta strong {
            display: block;
            font-size: 0.85rem;
            color: #1b3d2f;
          }

          .hq-row-meta span {
            display: block;
            font-size: 0.72rem;
            color: #8c7e74;
            margin-top: 1px;
          }

          /* Custom Grid of Beds / Rooms Map */
          .hq-rooms-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }

          @media (max-width: 600px) {
            .hq-rooms-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .room-node {
            background: #faf8f5;
            border: 1px dashed #ebdcc5;
            border-radius: 14px;
            padding: 12px;
            text-align: center;
            font-size: 0.75rem;
            transition: all 0.2s;
            position: relative;
          }

          .room-node.occupied {
            background: #fff5f5;
            border: 1.5px solid #fbc2c2;
          }

          .room-node.free {
            background: #f2faf4;
            border: 1.5px solid #c2f0d0;
          }

          .room-node h4 {
            margin: 0;
            font-size: 0.8rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .room-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 4px;
          }

          .room-indicator.green { background: #28a745; }
          .room-indicator.red { background: #dc3545; }

          /* Live KTV Grid */
          .ktv-live-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .ktv-node {
            background: #faf8f5;
            border: 1.5px solid #f1ebd9;
            border-radius: 14px;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s;
          }

          .ktv-node:hover {
            border-color: #ebdcc5;
            background: #fffdf5;
          }

          .ktv-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
          }

          /* Financial visual report */
          .hq-finance-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            flex-wrap: wrap;
            background: #faf8f5;
            padding: 16px;
            border-radius: 18px;
            border: 1.5px solid #f1ebd9;
          }

          .donut-layout {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            width: 110px;
            height: 110px;
          }

          .donut-center-text {
            position: absolute;
            text-align: center;
          }

          .donut-center-text h4 {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .donut-center-text span {
            font-size: 0.65rem;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
          }

          /* Progress Bar and Tool Grid */
          .hq-progress-bar-container {
            margin-bottom: 12px;
          }

          .hq-progress-labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.74rem;
            font-weight: bold;
            margin-bottom: 4px;
          }

          .hq-progress-track {
            height: 6px;
            background: #f1ebd9;
            border-radius: 4px;
            overflow: hidden;
          }

          .hq-progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.8s ease-out;
          }

          /* Tool shortcuts grid */
          .tools-grid-box {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          .tool-btn-node {
            background: #faf8f5;
            border: 1.5px solid #f1ebd9;
            border-radius: 12px;
            padding: 12px 6px;
            text-align: center;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }

          .tool-btn-node:hover {
            background: #fffbeb;
            border-color: #b45309;
            transform: translateY(-2px);
          }

          .tool-btn-node span.icon {
            font-size: 1.4rem;
          }

          .tool-btn-node span.lbl {
            font-size: 0.7rem;
            font-weight: 800;
            color: #1b3d2f;
          }
        `}</style>

        {/* Action toast feedback */}
        {toast.show && (
          <div
            className="hq-toast"
            style={{
              backgroundColor: toast.type === "success" ? "#28a745" : toast.type === "info" ? "#17a2b8" : "#dc3545",
            }}
          >
            <span>{toast.type === "success" ? "✅" : toast.type === "info" ? "ℹ️" : "❌"}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Top Control Panel Header */}
        <header className="hq-header-panel">
          <div className="hq-greeter">
            <h1>Quầy Vận Hành Trung Tâm 🍃</h1>
            <p>Bảng điều khiển Lễ tân và Điều phối KTV trực ca • {todayText}</p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div className="hq-shift-badge">
              <span>👤</span>
              <span><strong>Ca Trực:</strong> Sáng (08h00 - 16h00) • Quầy 1</span>
            </div>
            <div className="hq-live-clock">
              ⏰ {currentTime}
            </div>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && <div style={{ color: "#721c24", backgroundColor: "#f8d7da", padding: "12px 18px", borderRadius: "12px", border: "1px solid #f5c6cb", marginBottom: "20px" }}>{error}</div>}

        {loading && !stats ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px", color: "#8c7e74" }}>
            <span style={{ fontSize: "40px", animation: "spin 1.5s linear infinite" }}>🔄</span>
            <h4 style={{ margin: "16px 0 0 0" }}>Đang đồng bộ dữ liệu thời gian thực...</h4>
          </div>
        ) : (
          <>
            {/* KPI grid counts */}
            <section className="hq-metrics-row">
              <div className="hq-metric-card">
                <div className="hq-metric-icon icon-blue">📅</div>
                <div className="hq-metric-info">
                  <h3>Tổng Đặt Lịch</h3>
                  <h2>{stats?.todayAppointmentsCount || 0}</h2>
                  <p>Có <strong>{stats?.pendingCount || 0}</strong> lịch chờ duyệt</p>
                </div>
              </div>

              <div className="hq-metric-card">
                <div className="hq-metric-icon icon-amber">🔑</div>
                <div className="hq-metric-info">
                  <h3>Khách Chờ Check-in</h3>
                  <h2>{stats?.checkedInCount || 0}</h2>
                  <p>Lễ tân chuẩn bị đón tiếp</p>
                </div>
              </div>

              <div className="hq-metric-card">
                <div className="hq-metric-icon icon-purple">💆</div>
                <div className="hq-metric-info">
                  <h3>Đang Phục Vụ</h3>
                  <h2>{stats?.inProgressCount || 0}</h2>
                  <p>Kỹ thuật viên đang làm</p>
                </div>
              </div>

              <div className="hq-metric-card">
                <div className="hq-metric-icon icon-green">💰</div>
                <div className="hq-metric-info">
                  <h3>Doanh Thu</h3>
                  <h2>{money(stats?.todayRevenue)}</h2>
                  <p>Đã thanh toán <strong>{stats?.paidInvoiceCount || 0}</strong> ca</p>
                </div>
              </div>

              <div className="hq-metric-card">
                <div className="hq-metric-icon icon-red">↩️</div>
                <div className="hq-metric-info">
                  <h3>Đổi Trả & Hủy</h3>
                  <h2>{stats?.refundPendingCount || 0}</h2>
                  <p>Có <strong>{stats?.cancelledCount || 0}</strong> lượt hủy lịch</p>
                </div>
              </div>
            </section>

            {/* Main Interactive Grid */}
            <section className="hq-grid-container">
              
              {/* Column 1: Timeline, Queue, and Search filters */}
              <div>
                
                {/* Appointment timeline and operations board */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>📅 Tiến trình & Lịch trình Khách hàng đặt hẹn</h3>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Tìm tên, sđt khách..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: "1.5px solid #ebdcc5",
                          fontSize: "0.78rem",
                          outline: "none",
                          width: "180px",
                          background: "#faf8f5"
                        }}
                      />
                      <button className="filter-btn" onClick={loadDashboardData} style={{ padding: "8px 12px", background: "#ebdcc5", color: "#1b3d2f", borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
                        ↻ Tải lại
                      </button>
                    </div>
                  </div>

                  {/* Hourly timeline density navigator */}
                  <div className="hq-hours-grid">
                    <button
                      type="button"
                      onClick={() => setSelectedHour("ALL")}
                      className={`hour-slot-btn ${selectedHour === "ALL" ? "active" : ""}`}
                    >
                      🗣️ Tất cả
                      <span>{allAppointments.length} ca</span>
                    </button>
                    {hourSlots.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={`hour-slot-btn ${selectedHour === hour ? "active" : ""}`}
                      >
                        🕒 {hour}:00
                        <span>{hourBookingCounts[hour] || 0} ca</span>
                      </button>
                    ))}
                  </div>

                  {/* Status tabs row */}
                  <div className="timeline-filters">
                    <span style={{ fontSize: "0.74rem", fontWeight: "800", color: "#666" }}>Bộ lọc nhanh trạng thái:</span>
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

                  {/* Scrollable list content */}
                  <div className="hq-scroll-list">
                    {appointments.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#8c7e74" }}>
                        🏝️ Không có lịch hẹn nào tương ứng với giờ hoặc trạng thái đã chọn.
                      </div>
                    ) : (
                      appointments.map((a) => (
                        <div className="hq-row-item" key={a.AppointmentId}>
                          <div className="hq-row-left">
                            <Avatar src={a.CustomerAvatarUrl} name={a.CustomerName} size="42px" />
                            <div className="hq-row-details">
                              <h4>{a.CustomerName}</h4>
                              <p>
                                📞 {a.CustomerPhone || "Chưa có SĐT"} • Dịch vụ: <strong>{a.ServiceName}</strong> ({a.TotalDuration} phút)
                              </p>
                              <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "#666", fontSize: "0.74rem", marginTop: "3px" }}>
                                👤 Kỹ thuật viên: <strong style={{ color: a.TechnicianName ? "#2b231c" : "#b45309" }}>{a.TechnicianName || "Chưa chỉ định"}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="hq-row-right">
                            <div className="hq-row-meta">
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

                {/* Queue list component */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>⏳ Smart Hàng Chờ Lễ Tân & Check-in Quầy ({checkInQueue.length} khách)</h3>
                    <Link to="/receptionist/waiting-list" style={{ fontSize: "0.8rem", color: "#1b3d2f", fontWeight: "bold", textDecoration: "none" }}>Xem hàng chờ →</Link>
                  </div>

                  <div className="hq-scroll-list" style={{ maxHeight: "250px" }}>
                    {checkInQueue.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#8c7e74", fontSize: "0.82rem" }}>
                        ⏳ Hiện chưa có khách hàng nào xếp hàng chờ check-in tại quầy.
                      </div>
                    ) : (
                      checkInQueue.map((q) => (
                        <div className="hq-row-item" key={`queue-${q.AppointmentId}`}>
                          <div className="hq-row-left">
                            <Avatar src={q.CustomerAvatarUrl} name={q.CustomerName} size="36px" />
                            <div className="hq-row-details">
                              <h4 style={{ fontSize: "0.86rem" }}>{q.CustomerName}</h4>
                              <p style={{ fontSize: "0.72rem" }}>⏱️ Đặt: {q.StartTime} - {q.EndTime} • Dịch vụ: {q.ServiceName}</p>
                            </div>
                          </div>
                          <div className="hq-row-right">
                            <span className="rx-badge status-confirmed" style={{ fontSize: "0.62rem" }}>Đã đến Salon</span>
                            <button
                              type="button"
                              onClick={() => executeAppointmentAction(q.AppointmentId, "check-in", "Check-in khách hàng")}
                              className="rx-action-btn primary"
                              disabled={actionLoading}
                              style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                            >
                              🔑 Check-in
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Column 2: Live Beds layout, Live KTV availability, Finance report, Quick tools */}
              <div>
                
                {/* Section 1: Room & Bed Availability Map */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>🚪 Bản đồ Phòng / Buồng Giường Thời Gian Thực</h3>
                  </div>
                  <div className="hq-rooms-grid">
                    {liveRooms.map((room) => (
                      <div key={room.id} className={`room-node ${room.status === "BUSY" ? "occupied" : "free"}`}>
                        <h4>{room.name}</h4>
                        <div style={{ marginTop: "6px", fontSize: "0.7rem", fontWeight: "bold" }}>
                          <span className={`room-indicator ${room.status === "BUSY" ? "red" : "green"}`} />
                          {room.status === "BUSY" ? "ĐANG SỬ DỤNG" : "TRỐNG"}
                        </div>
                        {room.status === "BUSY" && (
                          <div style={{ marginTop: "6px", borderTop: "1px dashed #ebdcc5", paddingTop: "4px", fontSize: "0.66rem", color: "#666" }}>
                            <strong>Khách:</strong> {room.customerName}<br />
                            <strong>KTV:</strong> {room.technicianName}<br />
                            <strong>Hẹn:</strong> {room.time}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Live KTV Dispatch Matrix */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>👥 Sơ đồ trạng thái Kỹ thuật viên (KTV)</h3>
                  </div>
                  <div className="hq-scroll-list" style={{ maxHeight: "250px" }}>
                    <div className="ktv-live-grid">
                      {liveTechnicians.length === 0 ? (
                        <p style={{ gridColumn: "span 2", textAlign: "center", color: "#888", fontSize: "0.8rem" }}>Chưa có danh sách KTV.</p>
                      ) : (
                        liveTechnicians.map((tech) => (
                          <div className="ktv-node" key={tech.TechnicianId}>
                            <Avatar src={tech.ImageUrl} name={tech.FullName} size="32px" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontSize: "0.78rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tech.FullName}</h4>
                              <p style={{ margin: "2px 0 0", fontSize: "0.66rem", color: "#8c7e74" }}>{tech.Specialization || "Spa KTV"}</p>
                              
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.66rem", fontWeight: "bold" }}>
                                <span className="ktv-status-dot" style={{ backgroundColor: tech.status === "BUSY" ? "#dc3545" : "#28a745" }} />
                                <span style={{ color: tech.status === "BUSY" ? "#dc3545" : "#28a745" }}>
                                  {tech.status === "BUSY" ? "ĐANG LÀM" : "ĐANG RẢNH"}
                                </span>
                              </div>
                              {tech.status === "BUSY" && (
                                <div style={{ fontSize: "0.6rem", color: "#666", marginTop: "2px" }}>
                                  Làm dịch vụ cho: <strong>{tech.customerName}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Detailed Financial Donut & Bar Charts */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>📊 Thống kê Doanh thu & Dòng tiền</h3>
                    <Link to="/receptionist/invoices" style={{ fontSize: "0.8rem", color: "#1b3d2f", fontWeight: "bold", textDecoration: "none" }}>Hóa đơn →</Link>
                  </div>

                  <div className="hq-finance-summary">
                    {/* SVG Donut */}
                    <div className="donut-layout">
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1ebd9" strokeWidth="9" />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="none"
                          stroke="#28a745"
                          strokeWidth="9"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - paidDash}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="donut-center-text">
                        <h4>{paidPercent}%</h4>
                        <span>Đã thu</span>
                      </div>
                    </div>

                    {/* Quick breakdown metrics list */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.78rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tổng số hóa đơn:</span>
                        <strong>{invoiceCount} hóa đơn</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#28a745" }}>✓ Đã thanh toán:</span>
                        <strong>{paidInvoiceCount} ({paidPercent}%)</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#d97706" }}>📄 Chưa thanh toán:</span>
                        <strong>{unpaidInvoiceCount} ({unpaidPercent}%)</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ebdcc5", paddingTop: "6px" }}>
                        <strong>Doanh thu thực tế:</strong>
                        <strong style={{ color: "#1b3d2f" }}>{money(stats?.todayRevenue)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Load Graph (SVG Wave chart representation) */}
                  <h5 style={{ margin: "16px 0 8px 0", fontSize: "0.76rem", color: "#8c7e74", textTransform: "uppercase", fontWeight: "bold" }}>📈 Tải lượng đặt lịch theo giờ</h5>
                  <div style={{ background: "#faf8f5", padding: "10px", borderRadius: "12px", border: "1px solid #f1ebd9" }}>
                    <svg viewBox="0 0 300 60" width="100%" height="60">
                      {/* Grid Lines */}
                      <line x1="0" y1="50" x2="300" y2="50" stroke="#ebdcc5" strokeWidth="0.5" />
                      <line x1="0" y1="25" x2="300" y2="25" stroke="#ebdcc5" strokeWidth="0.5" strokeDasharray="3 3" />
                      
                      {/* SVG Line / Wave path based on hour density */}
                      <path
                        d={`M 10 ${50 - ((hourBookingCounts["08"] || 0) * 15)} 
                            L 40 ${50 - ((hourBookingCounts["09"] || 0) * 15)} 
                            L 70 ${50 - ((hourBookingCounts["10"] || 0) * 15)} 
                            L 100 ${50 - ((hourBookingCounts["11"] || 0) * 15)} 
                            L 130 ${50 - ((hourBookingCounts["12"] || 0) * 15)} 
                            L 160 ${50 - ((hourBookingCounts["13"] || 0) * 15)} 
                            L 190 ${50 - ((hourBookingCounts["14"] || 0) * 15)} 
                            L 220 ${50 - ((hourBookingCounts["15"] || 0) * 15)} 
                            L 250 ${50 - ((hourBookingCounts["16"] || 0) * 15)} 
                            L 280 ${50 - ((hourBookingCounts["17"] || 0) * 15)}`}
                        fill="none"
                        stroke="#1b3d2f"
                        strokeWidth="2.5"
                      />
                      
                      {/* Hourly dots */}
                      <circle cx="10" cy={50 - ((hourBookingCounts["08"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="40" cy={50 - ((hourBookingCounts["09"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="70" cy={50 - ((hourBookingCounts["10"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="100" cy={50 - ((hourBookingCounts["11"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="130" cy={50 - ((hourBookingCounts["12"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="160" cy={50 - ((hourBookingCounts["13"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="190" cy={50 - ((hourBookingCounts["14"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="220" cy={50 - ((hourBookingCounts["15"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="250" cy={50 - ((hourBookingCounts["16"] || 0) * 15)} r="3" fill="#ef4f83" />
                      <circle cx="280" cy={50 - ((hourBookingCounts["17"] || 0) * 15)} r="3" fill="#ef4f83" />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#8c7e74", marginTop: "4px" }}>
                      <span>08:00</span>
                      <span>10:00</span>
                      <span>12:00</span>
                      <span>14:00</span>
                      <span>16:00</span>
                      <span>18:00</span>
                    </div>
                  </div>

                  {/* Pending refund request list */}
                  {pendingRefunds.length > 0 && (
                    <div style={{ marginTop: "16px", borderTop: "1.5px solid #ebdcc5", paddingTop: "14px" }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "0.8rem", color: "#dc3545", fontWeight: "bold" }}>⚠️ Duyệt yêu cầu hoàn tiền ({pendingRefunds.length})</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {pendingRefunds.map((ref) => (
                          <div key={ref.RefundId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff5f5", border: "1px solid #f5c6cb", padding: "8px 12px", borderRadius: "12px", fontSize: "0.74rem" }}>
                            <div>
                              <strong>{ref.CustomerName}</strong>: {money(ref.RefundAmount)}<br />
                              <span style={{ color: "#666" }}>Lý do: {ref.Reason}</span>
                            </div>
                            <Link to="/receptionist/invoices" className="rx-action-btn danger" style={{ fontSize: "0.68rem", padding: "4px 8px", textDecoration: "none" }}>
                              Duyệt ngay
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Popular Services & Highlighted VIP Customer */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>📈 Thị hiếu Dịch vụ & Khách hàng nổi bật</h3>
                  </div>

                  {/* Popular Services bar progress chart */}
                  <h4 style={{ fontSize: "0.78rem", color: "#8c7e74", margin: "0 0 10px 0", textTransform: "uppercase" }}>🔥 Top dịch vụ đặt nhiều hôm nay</h4>
                  <div style={{ background: "#faf8f5", padding: "16px", borderRadius: "16px", border: "1px solid #f1ebd9", marginBottom: "20px" }}>
                    {popularServices.length === 0 ? (
                      <p style={{ fontSize: "0.78rem", color: "#888", textAlign: "center", margin: 0 }}>Chưa có thống kê dịch vụ hôm nay.</p>
                    ) : (
                      popularServices.map((s, idx) => {
                        const maxVal = Math.max(...popularServices.map((x) => Number(x.BookingCount || 0)), 1);
                        const percentFill = Math.round((Number(s.BookingCount || 0) / maxVal) * 100);

                        return (
                          <div className="hq-progress-bar-container" key={s.ServiceId}>
                            <div className="hq-progress-labels">
                              <span>{s.ServiceName}</span>
                              <span style={{ color: "#1b3d2f" }}>{s.BookingCount} ca</span>
                            </div>
                            <div className="hq-progress-track">
                              <div
                                className="hq-progress-fill"
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

                  {/* VIP Profile summary info */}
                  {highlightedCustomer && (
                    <>
                      <h4 style={{ fontSize: "0.78rem", color: "#8c7e74", margin: "16px 0 10px 0", textTransform: "uppercase" }}>⭐ Khách hàng nổi bật trong ca</h4>
                      <div style={{ display: "flex", gap: "12px", background: "#faf8f5", padding: "14px", borderRadius: "16px", border: "1.5px solid #ebdcc5", alignItems: "center" }}>
                        <Avatar src={highlightedCustomer.AvatarUrl} name={highlightedCustomer.FullName} size="44px" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: "0.86rem", color: "#1b3d2f" }}>{highlightedCustomer.FullName}</strong>
                          <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#666" }}>
                            SĐT: {highlightedCustomer.Phone || "Chưa gán"} • Tổng tích lũy chi tiêu: <strong style={{ color: "#b45309" }}>{money(highlightedCustomer.TotalSpent)}</strong>
                          </p>
                        </div>
                        <Link to="/receptionist/customers" className="rx-action-btn" style={{ fontSize: "0.72rem", padding: "6px 10px", textDecoration: "none" }}>Hồ sơ</Link>
                      </div>
                    </>
                  )}
                </div>

                {/* Section 5: Tools shortcuts grid */}
                <div className="hq-card">
                  <div className="hq-card-title">
                    <h3>⚡ Trung tâm Điều hành nhanh Lễ tân</h3>
                  </div>
                  <div className="tools-grid-box">
                    <Link className="tool-btn-node" to="/receptionist/appointments/create?walkin=1">
                      <span className="icon">🚶</span>
                      <span className="lbl">Khách Walk-in</span>
                    </Link>

                    <Link className="tool-btn-node" to="/receptionist/appointments/create">
                      <span className="icon">📅</span>
                      <span className="lbl">Đặt lịch hẹn</span>
                    </Link>

                    <Link className="tool-btn-node" to="/receptionist/invoices">
                      <span className="icon">🧾</span>
                      <span className="lbl">Hóa đơn</span>
                    </Link>

                    <Link className="tool-btn-node" to="/receptionist/waiting-list">
                      <span className="icon">⏳</span>
                      <span className="lbl">Hàng chờ</span>
                    </Link>

                    <Link className="tool-btn-node" to="/admin/ai-crm">
                      <span className="icon">🔮</span>
                      <span className="lbl">AI CRM</span>
                    </Link>

                    <Link className="tool-btn-node" to="/receptionist/profile">
                      <span className="icon">👤</span>
                      <span className="lbl">Hồ sơ cá nhân</span>
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
