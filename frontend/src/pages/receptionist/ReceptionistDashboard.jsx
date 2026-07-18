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
  const [selectedHour, setSelectedHour] = useState("ALL");
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

  // Inject Google Font dynamically on component mount
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"));
    }, 1000);

    loadDashboardData();

    return () => {
      document.head.removeChild(link);
      clearInterval(timer);
    };
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
      showToast(`Cập nhật thành công: ${actionName}`, "success");
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || `Thao tác thất bại: ${actionName}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteService(appointment) {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      await axiosClient.put(`/receptionist/appointments/${appointment.AppointmentId}/complete`);
      const isPaid = appointment.PaymentStatus === "PAID" || appointment.CustomerPackageId;
      if (isPaid) {
        showToast("Hoàn thành dịch vụ & Checkout thành công!", "success");
      } else {
        showToast("Đã hoàn thành dịch vụ! Đang chuyển đến trang thanh toán...", "success");
        setTimeout(() => {
          if (appointment.InvoiceId) {
            navigate(`/receptionist/invoices/${appointment.InvoiceId}`);
          } else {
            navigate(`/receptionist/invoices`);
          }
        }, 1000);
      }
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || "Thao tác thất bại", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // Computed Values
  const allAppointments = stats?.todayAppointments || [];

  const appointments = useMemo(() => {
    let list = allAppointments;

    if (statusFilter !== "ALL") {
      list = list.filter((a) => String(a.Status).toUpperCase() === statusFilter);
    }

    if (selectedHour !== "ALL") {
      list = list.filter((a) => {
        const startHour = String(a.StartTime || "").split(":")[0];
        return startHour === selectedHour;
      });
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
  }, [allAppointments, searchQuery, statusFilter, selectedHour]);

  // Hourly booking slots density
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
    const workingQueue = [...inProgressAppointments];
    return rooms.map(room => {
      const activeApp = workingQueue.find(a => {
        const sName = String(a.ServiceName || "").toLowerCase();
        if (room.type === "Massage" && sName.includes("massage")) return true;
        if (room.type === "Skincare" && (sName.includes("skin") || sName.includes("chăm sóc da") || sName.includes("mụn"))) return true;
        if (room.type === "Detox" && sName.includes("detox")) return true;
        if (room.type === "Hair" && (sName.includes("gội") || sName.includes("tóc"))) return true;
        return false;
      });

      if (activeApp) {
        const idx = workingQueue.indexOf(activeApp);
        if (idx > -1) workingQueue.splice(idx, 1);

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
  const circumference = 2 * Math.PI * 38;
  const paidDash = (paidPercent / 100) * circumference;

  return (
    <ReceptionistLayout>
      <div className="hq-cockpit-container">
        {/* Enforcing global dashboard styling with Plus Jakarta Sans and removing scrollbars */}
        <style>{`
          /* Global typography override to fix Vietnamese rendering and character spaces */
          .hq-cockpit-container, 
          .hq-cockpit-container * {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            box-sizing: border-box;
            letter-spacing: -0.1px;
          }

          .hq-cockpit-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            animation: cleanFade 0.4s ease-out;
          }

          @keyframes cleanFade {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Notification Toast */
          .hq-toast-banner {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 14px 22px;
            border-radius: 12px;
            color: #fff;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.85rem;
            animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes slideInRight {
            from { transform: translateX(120%); }
            to { transform: translateX(0); }
          }

          /* Glass Header Panel */
          .hq-nav-bar {
            background: linear-gradient(135deg, #1b3d2f 0%, #0d261b 100%);
            border-radius: 18px;
            padding: 20px 24px;
            color: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            box-shadow: 0 6px 20px rgba(27, 61, 47, 0.12);
            flex-wrap: wrap;
            gap: 16px;
          }

          .hq-nav-bar h1 {
            margin: 0;
            font-size: 1.6rem;
            font-weight: 800;
            background: linear-gradient(120deg, #ffffff, #ebdcc5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-family: 'Plus Jakarta Sans', sans-serif !important;
          }

          .hq-nav-bar p {
            margin: 3px 0 0;
            font-size: 0.8rem;
            color: #a4bba4;
          }

          .hq-meta-item {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            padding: 8px 14px;
            border-radius: 10px;
            font-size: 0.78rem;
            color: #f5e4c3;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .hq-digital-clock {
            font-size: 1.05rem;
            font-weight: 700;
            background: rgba(0,0,0,0.2);
            padding: 8px 14px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.08);
            color: #fff;
            font-family: monospace !important;
          }

          /* KPIs Layout Grid */
          .hq-stats-row {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
            width: 100%;
          }

          @media (max-width: 1200px) {
            .hq-stats-row {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 768px) {
            .hq-stats-row {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          .hq-stats-badge {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 16px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 10px rgba(180, 83, 9, 0.01);
            transition: all 0.25s ease;
          }

          .hq-stats-badge:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 14px rgba(180, 83, 9, 0.04);
            border-color: #d1b491;
          }

          .hq-stats-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: grid;
            place-items: center;
            font-size: 1.2rem;
            flex-shrink: 0;
          }

          .stats-blue { background: #e3f2fd; color: #1e88e5; }
          .stats-green { background: #e8f5e9; color: #2e7d32; }
          .stats-amber { background: #fff8e1; color: #f59e0b; }
          .stats-red { background: #ffebee; color: #e53935; }
          .stats-purple { background: #f3e5f5; color: #8e24aa; }

          .hq-stats-content h3 {
            margin: 0;
            font-size: 0.68rem;
            color: #8c7e74;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.3px;
          }

          .hq-stats-content h2 {
            margin: 2px 0;
            font-size: 1.3rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .hq-stats-content p {
            margin: 0;
            font-size: 0.68rem;
            color: #777;
          }

          /* Fluid 2-Column Responsive Layout */
          .hq-workspace {
            display: grid;
            grid-template-columns: minmax(0, 1.22fr) minmax(0, 0.78fr);
            gap: 20px;
            width: 100%;
          }

          @media (max-width: 1200px) {
            .hq-workspace {
              grid-template-columns: minmax(0, 1fr);
            }
          }

          .hq-panel-card {
            background: #fff;
            border: 1px solid #ebdcc5;
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(180, 83, 9, 0.01);
            width: 100%;
          }

          .hq-panel-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #f1ebd9;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }

          .hq-panel-title h3 {
            margin: 0;
            font-family: 'Plus Jakarta Sans', sans-serif !important;
            font-size: 1.08rem;
            color: #1b3d2f;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 800;
          }

          /* Popular Services List & Progress Styling */
          .hq-progress-bar-container {
            margin-bottom: 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .hq-progress-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .hq-rank-badge {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.68rem;
            font-weight: 800;
            color: #fff;
            flex-shrink: 0;
          }
          .hq-rank-1 { background: #1b3d2f; }
          .hq-rank-2 { background: #b45309; }
          .hq-rank-3 { background: #c5ac6b; color: #1b3d2f; }
          .hq-rank-other { background: #8c7e74; }

          .hq-progress-labels {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex: 1;
            font-size: 0.78rem;
            font-weight: 600;
            color: #242019;
            min-width: 0;
          }
          .hq-service-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-right: 8px;
          }
          .hq-service-count {
            font-weight: 700;
            color: #1b3d2f;
            flex-shrink: 0;
          }
          .hq-progress-track {
            height: 6px;
            background: #ebdcc533;
            border-radius: 99px;
            width: 100%;
            overflow: hidden;
          }
          .hq-progress-fill {
            height: 100%;
            border-radius: 99px;
            transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* Highlight Customer Card */
          .hq-vip-card {
            display: flex;
            gap: 12px;
            background: linear-gradient(135deg, #fffdfa 0%, #fcf8f0 100%);
            padding: 14px 16px;
            border-radius: 16px;
            border: 1px solid #ebdcc5;
            align-items: center;
            box-shadow: 0 4px 12px rgba(27, 61, 47, 0.03);
            transition: all 0.25s ease;
          }
          .hq-vip-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(27, 61, 47, 0.06);
            border-color: #d4a94f;
          }
          .hq-vip-avatar-wrapper {
            position: relative;
            flex-shrink: 0;
          }
          .hq-vip-badge {
            position: absolute;
            bottom: -3px;
            right: -3px;
            background: linear-gradient(135deg, #ebdcc5, #d4a94f);
            color: #1b3d2f;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            border: 1.5px solid #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .hq-vip-info {
            flex: 1;
            min-width: 0;
          }
          .hq-vip-name {
            font-size: 0.86rem;
            font-weight: 700;
            color: #1b3d2f;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .hq-vip-meta {
            margin: 2px 0 0;
            font-size: 0.72rem;
            color: #665c54;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
          }
          .hq-vip-spent {
            font-weight: 700;
            color: #b45309;
            background: #fff8f1;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #ffedd5;
          }
          .hq-vip-btn {
            font-size: 0.72rem;
            padding: 6px 12px;
            background: #1b3d2f;
            color: #fff;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 700;
            transition: all 0.2s ease;
            border: 1px solid #1b3d2f;
          }
          .hq-vip-btn:hover {
            background: #ebdcc5;
            color: #1b3d2f;
            border-color: #ebdcc5;
          }

          /* Hourly timeline grid slots */
          .hq-timeline-slots {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }

          .hq-timeline-slots::-webkit-scrollbar {
            height: 4px;
          }

          .hq-timeline-slots::-webkit-scrollbar-thumb {
            background: #ebdcc5;
            border-radius: 4px;
          }

          .slot-btn {
            background: #faf8f5;
            border: 1px solid #ebdcc5;
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 0.72rem;
            font-weight: 800;
            color: #8c7e74;
            cursor: pointer;
            transition: all 0.2s;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 52px;
          }

          .slot-btn:hover {
            border-color: #1b3d2f;
            color: #1b3d2f;
          }

          .slot-btn.active {
            background: #1b3d2f;
            border-color: #1b3d2f;
            color: #fff;
          }

          .slot-btn span {
            font-size: 0.6rem;
            font-weight: 500;
            opacity: 0.8;
            margin-top: 1px;
          }

          /* List Timeline Filter Controls */
          .hq-filter-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            flex-wrap: wrap;
            gap: 10px;
            background: #faf8f5;
            padding: 8px 12px;
            border-radius: 12px;
            border: 1px solid #ebdcc5;
            width: 100%;
          }

          .hq-filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }

          .hq-f-btn {
            border: none;
            background: none;
            padding: 5px 10px;
            font-size: 0.72rem;
            font-weight: 800;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            color: #8c7e74;
            border: 1px solid transparent;
          }

          .hq-f-btn.active {
            background: #1b3d2f;
            color: #fff;
            border-color: #1b3d2f;
          }

          /* Core lists container scrollbar */
          .hq-scroll-container {
            max-height: 480px;
            overflow-y: auto;
            padding-right: 4px;
            width: 100%;
          }

          .hq-scroll-container::-webkit-scrollbar {
            width: 4px;
          }

          .hq-scroll-container::-webkit-scrollbar-thumb {
            background: #ebdcc5;
            border-radius: 8px;
          }

          /* Flex List Row Cards */
          .hq-row-card {
            background: #faf8f5;
            border: 1px solid #f1ebd9;
            border-radius: 14px;
            padding: 12px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            transition: all 0.2s;
            gap: 12px;
            flex-wrap: wrap; /* Prevent button overflow clipping */
            width: 100%;
          }

          .hq-row-card:hover {
            background: #fffefb;
            border-color: #d1b491;
            transform: translateX(2px);
          }

          .hq-row-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            flex: 1;
          }

          .hq-row-text {
            min-width: 0;
          }

          .hq-row-text h4 {
            margin: 0;
            font-size: 0.88rem;
            color: #2b231c;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .hq-row-text p {
            margin: 3px 0 0;
            font-size: 0.75rem;
            color: #666;
            line-height: 1.3;
          }

          .hq-row-actions-group {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap; /* Ensure buttons wrap in narrow slots */
          }

          .hq-meta-block {
            text-align: right;
            font-size: 0.75rem;
          }

          .hq-meta-block strong {
            display: block;
            color: #1b3d2f;
            font-size: 0.82rem;
          }

          .hq-meta-block span {
            display: block;
            color: #8c7e74;
            margin-top: 1px;
          }

          /* Buttons group */
          .hq-btn-actions {
            display: flex;
            gap: 6px;
          }

          .hq-action-btn {
            background: #fff;
            border: 1px solid #ebdcc5;
            color: #1b3d2f;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.74rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
          }

          .hq-action-btn:hover {
            border-color: #1b3d2f;
            background: #faf8f5;
          }

          .hq-action-btn.primary {
            background: #1b3d2f;
            color: #fff;
            border-color: #1b3d2f;
          }

          .hq-action-btn.primary:hover {
            background: #12281f;
          }

          .hq-action-btn.danger {
            color: #c62828;
            border-color: #f5c6cb;
          }

          .hq-action-btn.danger:hover {
            background: #fff5f5;
            border-color: #c62828;
          }

          /* Status Badges */
          .hq-badge {
            font-size: 0.65rem;
            font-weight: 800;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 12px;
            display: inline-block;
            letter-spacing: 0.2px;
          }

          .badge-pending { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
          .badge-confirmed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .badge-checked_in { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
          .badge-in_progress { background: #e8dbfc; color: #5c25a7; border: 1px solid #d4c0f8; }
          .badge-completed { background: #e2f4e8; color: #166534; border: 1px solid #c2e9d2; }
          .badge-cancelled { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .badge-no_show { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }

          /* Interactive Room Layout Map */
          .hq-rooms-layout {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 12px;
            width: 100%;
          }

          @media (max-width: 600px) {
            .hq-rooms-layout {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          .room-cell {
            background: #faf8f5;
            border: 1px dashed #ebdcc5;
            border-radius: 12px;
            padding: 10px;
            text-align: center;
            font-size: 0.72rem;
            transition: all 0.2s;
            width: 100%;
          }

          .room-cell.busy {
            background: #fff5f5;
            border: 1.5px solid #fbc2c2;
          }

          .room-cell.free {
            background: #f2faf4;
            border: 1.5px solid #c2f0d0;
          }

          .room-cell h4 {
            margin: 0;
            font-size: 0.78rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .room-dot {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-right: 4px;
          }

          .room-dot.green { background: #28a745; }
          .room-dot.red { background: #dc3545; }

          /* Active Technician Status Matrix */
          .hq-ktv-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }

          .ktv-card {
            background: #faf8f5;
            border: 1px solid #f1ebd9;
            border-radius: 12px;
            padding: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s;
            min-width: 0;
          }

          .ktv-card:hover {
            border-color: #ebdcc5;
            background: #fffdf5;
          }

          .ktv-card-text {
            min-width: 0;
            flex: 1;
          }

          .ktv-card-text h4 {
            margin: 0;
            font-size: 0.78rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .ktv-card-text p {
            margin: 2px 0 0;
            font-size: 0.66rem;
            color: #8c7e74;
          }

          .ktv-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.65rem;
            font-weight: bold;
            margin-top: 3px;
          }

          .ktv-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            display: inline-block;
          }

          /* Financial Summary card structure */
          .hq-finance-deck {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            background: #faf8f5;
            padding: 14px;
            border-radius: 16px;
            border: 1px solid #f1ebd9;
            width: 100%;
          }

          .hq-donut-view {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            width: 90px;
            height: 90px;
            flex-shrink: 0;
            margin: 0 auto;
          }

          .hq-donut-lbl {
            position: absolute;
            text-align: center;
          }

          .hq-donut-lbl h4 {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 800;
            color: #1b3d2f;
          }

          .hq-donut-lbl span {
            font-size: 0.6rem;
            color: #666;
            text-transform: uppercase;
            font-weight: bold;
          }

          /* Wave line chart height limit */
          .hq-wave-chart {
            background: #faf8f5;
            padding: 8px;
            border-radius: 12px;
            border: 1px solid #f1ebd9;
            width: 100%;
          }

          /* Tools Shortcuts command buttons */
          .hq-shortcuts-deck {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }

          .shortcut-node {
            background: #faf8f5;
            border: 1px solid #f1ebd9;
            border-radius: 12px;
            padding: 10px 4px;
            text-align: center;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }

          .shortcut-node:hover {
            background: #fffbeb;
            border-color: #d97706;
            transform: translateY(-1px);
          }

          .shortcut-node span.icon {
            font-size: 1.3rem;
          }

          .shortcut-node span.txt {
            font-size: 0.68rem;
            font-weight: 800;
            color: #1b3d2f;
          }
        `}</style>

        {/* Action toast feedback */}
        {toast.show && (
          <div
            className="hq-toast-banner"
            style={{
              backgroundColor: toast.type === "success" ? "#28a745" : toast.type === "info" ? "#17a2b8" : "#dc3545",
            }}
          >
            <span>{toast.type === "success" ? "✅" : toast.type === "info" ? "ℹ️" : "❌"}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Top Control Panel Header */}
        <header className="hq-nav-bar">
          <div className="hq-greeter">
            <h1>Quầy Vận Hành Trung Tâm 🍃</h1>
            <p>Bảng điều khiển Lễ tân và Quản lý Salon • {todayText}</p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="hq-meta-item">
              <span>👤</span>
              <span><strong>Ca Trực:</strong> Sáng (08:00 - 16:00)</span>
            </div>
            <div className="hq-digital-clock">
              ⏰ {currentTime}
            </div>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && <div style={{ color: "#721c24", backgroundColor: "#f8d7da", padding: "12px 18px", borderRadius: "12px", border: "1px solid #f5c6cb", marginBottom: "20px", width: "100%" }}>{error}</div>}

        {loading && !stats ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px", color: "#8c7e74" }}>
            <span style={{ fontSize: "36px", animation: "spin 1.5s linear infinite" }}>🔄</span>
            <h4 style={{ margin: "12px 0 0 0" }}>Đang đồng bộ dữ liệu thời gian thực...</h4>
          </div>
        ) : (
          <>
            {/* KPI grid counts */}
            <section className="hq-stats-row">
              <div className="hq-stats-badge">
                <div className="hq-stats-icon stats-blue">📅</div>
                <div className="hq-stats-content">
                  <h3>Tổng Đặt Lịch</h3>
                  <h2>{stats?.todayAppointmentsCount || 0}</h2>
                  <p><strong>{stats?.pendingCount || 0}</strong> lượt chờ duyệt</p>
                </div>
              </div>

              <div className="hq-stats-badge">
                <div className="hq-stats-icon stats-amber">🔑</div>
                <div className="hq-stats-content">
                  <h3>Khách Chờ Check-in</h3>
                  <h2>{stats?.checkedInCount || 0}</h2>
                  <p>Lễ tân chuẩn bị đón tiếp</p>
                </div>
              </div>

              <div className="hq-stats-badge">
                <div className="hq-stats-icon stats-purple">💆</div>
                <div className="hq-stats-content">
                  <h3>Đang Phục Vụ</h3>
                  <h2>{stats?.inProgressCount || 0}</h2>
                  <p>Kỹ thuật viên đang làm</p>
                </div>
              </div>

              <div className="hq-stats-badge">
                <div className="hq-stats-icon stats-green">💰</div>
                <div className="hq-stats-content">
                  <h3>Doanh Thu</h3>
                  <h2>{money(stats?.todayRevenue)}</h2>
                  <p>Đã thanh toán <strong>{stats?.paidInvoiceCount || 0}</strong> ca</p>
                </div>
              </div>

              <div className="hq-stats-badge">
                <div className="hq-stats-icon stats-red">↩️</div>
                <div className="hq-stats-content">
                  <h3>Đổi Trả & Hủy</h3>
                  <h2>{stats?.refundPendingCount || 0}</h2>
                  <p>Có <strong>{stats?.cancelledCount || 0}</strong> lượt hủy lịch</p>
                </div>
              </div>
            </section>

            {/* Main Interactive Grid Workspace */}
            <section className="hq-workspace">

              {/* Column 1: Timeline, Queue, and Search filters */}
              <div>

                {/* Appointment timeline and operations board */}
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>📅 Tiến trình & Lịch trình Khách hàng đặt hẹn</h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Tìm tên, sđt khách..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1.5px solid #ebdcc5",
                          fontSize: "0.74rem",
                          outline: "none",
                          width: "160px",
                          background: "#faf8f5"
                        }}
                      />
                      <button className="hq-action-btn" onClick={loadDashboardData} style={{ padding: "6px 10px", background: "#ebdcc5", color: "#1b3d2f", borderRadius: "8px", fontWeight: "bold", border: "none", cursor: "pointer" }}>
                        🔄
                      </button>
                    </div>
                  </div>

                  {/* Hourly timeline density navigator */}
                  <div className="hq-timeline-slots">
                    <button
                      type="button"
                      onClick={() => setSelectedHour("ALL")}
                      className={`slot-btn ${selectedHour === "ALL" ? "active" : ""}`}
                    >
                      🗣️ Tất cả
                      <span>{allAppointments.length} ca</span>
                    </button>
                    {hourSlots.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => setSelectedHour(hour)}
                        className={`slot-btn ${selectedHour === hour ? "active" : ""}`}
                      >
                        🕒 {hour}:00
                        <span>{hourBookingCounts[hour] || 0} ca</span>
                      </button>
                    ))}
                  </div>

                  {/* Status tabs row */}
                  <div className="hq-filter-bar">
                    <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "#666" }}>Lọc trạng thái:</span>
                    <div className="hq-filter-buttons">
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
                          className={`hq-f-btn ${statusFilter === status ? "active" : ""}`}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable list content */}
                  <div className="hq-scroll-container">
                    {appointments.length === 0 ? (
                      <div style={{ padding: "40px", textAlign: "center", color: "#8c7e74", fontSize: "0.82rem" }}>
                        🏝️ Không có lịch hẹn nào tương ứng với giờ hoặc trạng thái đã chọn.
                      </div>
                    ) : (
                      appointments.map((a) => (
                        <div className="hq-row-card" key={a.AppointmentId}>
                          <div className="hq-row-profile">
                            <Avatar src={a.CustomerAvatarUrl} name={a.CustomerName} size="38px" />
                            <div className="hq-row-text">
                              <h4>{a.CustomerName}</h4>
                              <p>
                                📞 {a.CustomerPhone || "Chưa có SĐT"} • Dịch vụ: <strong>{a.ServiceName}</strong> ({a.TotalDuration}p)
                              </p>
                              <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "#666", fontSize: "0.72rem", marginTop: "2px" }}>
                                👤 Kỹ thuật viên: <strong style={{ color: a.TechnicianName ? "#2b231c" : "#b45309" }}>{a.TechnicianName || "Chưa chỉ định"}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="hq-row-actions-group">
                            <div className="hq-meta-block">
                              <strong>{a.StartTime} - {a.EndTime}</strong>
                              <span>{money(a.FinalAmount)} • <span className={`hq-badge badge-${a.Status.toLowerCase()}`}>{translateStatus(a.Status)}</span></span>
                            </div>

                            {/* Direct workflows */}
                            <div className="hq-btn-actions">
                              {a.Status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "confirm", "Xác nhận lịch")}
                                    className="hq-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    ✓ Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "cancel", "Hủy lịch")}
                                    className="hq-action-btn danger"
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
                                    className="hq-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    🔑 Check-in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => executeAppointmentAction(a.AppointmentId, "cancel", "Hủy lịch")}
                                    className="hq-action-btn danger"
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
                                    className="hq-action-btn primary"
                                    disabled={actionLoading}
                                  >
                                    ▶ Bắt đầu
                                  </button>
                                  <Link to={`/receptionist/appointments?assign=${a.AppointmentId}`} className="hq-action-btn" style={{ textDecoration: "none" }}>
                                    🔄 Đổi KTV
                                  </Link>
                                </>
                              )}

                              {a.Status === "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteService(a)}
                                  className="hq-action-btn primary"
                                  disabled={actionLoading}
                                >
                                  {a.PaymentStatus === "PAID" || a.CustomerPackageId
                                    ? "🏁 Hoàn thành & Checkout"
                                    : "🏁 Hoàn thành & Thanh toán"}
                                </button>
                              )}

                              {(a.Status === "COMPLETED" || a.Status === "PENDING_PAYMENT") && a.PaymentStatus !== "PAID" && (
                                <Link
                                  to={a.InvoiceId ? `/receptionist/invoices/${a.InvoiceId}` : `/receptionist/invoices`}
                                  className="hq-action-btn primary"
                                  style={{ textDecoration: "none" }}
                                >
                                  💳 Thanh toán tính tiền
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
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>⏳ Danh sách chờ Check-in tại quầy ({checkInQueue.length} khách)</h3>
                  </div>

                  <div className="hq-scroll-container" style={{ maxHeight: "240px" }}>
                    {checkInQueue.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#8c7e74", fontSize: "0.8rem" }}>
                        ⏳ Hiện chưa có khách hàng nào xếp hàng chờ check-in tại quầy.
                      </div>
                    ) : (
                      checkInQueue.map((q) => (
                        <div className="hq-row-card" key={`queue-${q.AppointmentId}`}>
                          <div className="hq-row-profile">
                            <Avatar src={q.CustomerAvatarUrl} name={q.CustomerName} size="34px" />
                            <div className="hq-row-text">
                              <h4 style={{ fontSize: "0.82rem" }}>{q.CustomerName}</h4>
                              <p style={{ fontSize: "0.72rem" }}>⏱️ Đặt: {q.StartTime} - {q.EndTime} • Dịch vụ: {q.ServiceName}</p>
                            </div>
                          </div>
                          <div className="hq-row-actions-group">
                            <span className="hq-badge badge-confirmed" style={{ fontSize: "0.6rem" }}>Đã đến Salon</span>
                            <button
                              type="button"
                              onClick={() => executeAppointmentAction(q.AppointmentId, "check-in", "Check-in khách hàng")}
                              className="hq-action-btn primary"
                              disabled={actionLoading}
                              style={{ padding: "5px 10px", fontSize: "0.72rem" }}
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
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>🚪 Bản đồ Phòng / Buồng Giường Thời Gian Thực</h3>
                  </div>
                  <div className="hq-rooms-layout">
                    {liveRooms.map((room) => (
                      <div key={room.id} className={`room-cell ${room.status === "BUSY" ? "busy" : "free"}`}>
                        <h4>{room.name}</h4>
                        <div style={{ marginTop: "4px", fontSize: "0.68rem", fontWeight: "bold" }}>
                          <span className={`room-dot ${room.status === "BUSY" ? "red" : "green"}`} />
                          {room.status === "BUSY" ? "ĐANG SỬ DỤNG" : "TRỐNG"}
                        </div>
                        {room.status === "BUSY" && (
                          <div style={{ marginTop: "4px", borderTop: "1px dashed #ebdcc5", paddingTop: "4px", fontSize: "0.65rem", color: "#666", textAlign: "left" }}>
                            <strong>Khách:</strong> {room.customerName}<br />
                            <strong>KTV:</strong> {room.technicianName}<br />
                            <strong>Giờ:</strong> {room.time}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Live KTV Dispatch Matrix */}
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>👥 Sơ đồ trạng thái Kỹ thuật viên (KTV)</h3>
                  </div>
                  <div className="hq-scroll-container" style={{ maxHeight: "250px" }}>
                    <div className="hq-ktv-list">
                      {liveTechnicians.length === 0 ? (
                        <p style={{ gridColumn: "span 2", textAlign: "center", color: "#888", fontSize: "0.78rem" }}>Chưa có danh sách KTV.</p>
                      ) : (
                        liveTechnicians.map((tech) => (
                          <div className="ktv-card" key={tech.TechnicianId}>
                            <Avatar src={tech.ImageUrl} name={tech.FullName} size="32px" />
                            <div className="ktv-card-text">
                              <h4>{tech.FullName}</h4>
                              <p>{tech.Specialization || "Spa KTV"}</p>

                              <div className="ktv-indicator">
                                <span className="ktv-dot" style={{ backgroundColor: tech.status === "BUSY" ? "#dc3545" : "#28a745" }} />
                                <span style={{ color: tech.status === "BUSY" ? "#dc3545" : "#28a745" }}>
                                  {tech.status === "BUSY" ? "ĐANG LÀM" : "ĐANG RẢNH"}
                                </span>
                              </div>
                              {tech.status === "BUSY" && (
                                <div style={{ fontSize: "0.6rem", color: "#555", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  Khách: <strong>{tech.customerName}</strong>
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
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>📊 Thống kê Doanh thu & Hóa đơn hôm nay</h3>
                    <Link to="/receptionist/invoices" style={{ fontSize: "0.78rem", color: "#1b3d2f", fontWeight: "bold", textDecoration: "none" }}>Chi tiết →</Link>
                  </div>

                  <div className="hq-finance-deck">
                    {/* SVG Donut */}
                    <div className="hq-donut-view">
                      <svg width="80" height="80" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#f1ebd9" strokeWidth="10" />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="none"
                          stroke="#28a745"
                          strokeWidth="10"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - paidDash}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="hq-donut-lbl">
                        <h4>{paidPercent}%</h4>
                        <span>Đã thu</span>
                      </div>
                    </div>

                    {/* Breakdown lists */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.76rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tổng số hóa đơn:</span>
                        <strong>{invoiceCount}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#28a745" }}>✓ Đã thanh toán:</span>
                        <strong>{paidInvoiceCount} ({paidPercent}%)</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#d97706" }}>📄 Chưa thanh toán:</span>
                        <strong>{unpaidInvoiceCount} ({unpaidPercent}%)</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ebdcc5", paddingTop: "4px", marginTop: "2px" }}>
                        <strong>Doanh thu hôm nay:</strong>
                        <strong style={{ color: "#1b3d2f" }}>{money(stats?.todayRevenue)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Load Graph (SVG Wave chart) */}
                  <h5 style={{ margin: "14px 0 6px 0", fontSize: "0.72rem", color: "#8c7e74", textTransform: "uppercase", fontWeight: "bold" }}>📈 Tải lượng đặt lịch theo giờ</h5>
                  <div className="hq-wave-chart">
                    <svg viewBox="0 0 300 60" width="100%" height="45">
                      <line x1="0" y1="50" x2="300" y2="50" stroke="#ebdcc5" strokeWidth="0.5" />
                      <line x1="0" y1="25" x2="300" y2="25" stroke="#ebdcc5" strokeWidth="0.5" strokeDasharray="3 3" />

                      <path
                        d={`M 10 ${50 - ((hourBookingCounts["08"] || 0) * 12)} 
                            L 40 ${50 - ((hourBookingCounts["09"] || 0) * 12)} 
                            L 70 ${50 - ((hourBookingCounts["10"] || 0) * 12)} 
                            L 100 ${50 - ((hourBookingCounts["11"] || 0) * 12)} 
                            L 130 ${50 - ((hourBookingCounts["12"] || 0) * 12)} 
                            L 160 ${50 - ((hourBookingCounts["13"] || 0) * 12)} 
                            L 190 ${50 - ((hourBookingCounts["14"] || 0) * 12)} 
                            L 220 ${50 - ((hourBookingCounts["15"] || 0) * 12)} 
                            L 250 ${50 - ((hourBookingCounts["16"] || 0) * 12)} 
                            L 280 ${50 - ((hourBookingCounts["17"] || 0) * 12)}`}
                        fill="none"
                        stroke="#1b3d2f"
                        strokeWidth="2"
                      />

                      <circle cx="10" cy={50 - ((hourBookingCounts["08"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="40" cy={50 - ((hourBookingCounts["09"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="70" cy={50 - ((hourBookingCounts["10"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="100" cy={50 - ((hourBookingCounts["11"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="130" cy={50 - ((hourBookingCounts["12"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="160" cy={50 - ((hourBookingCounts["13"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="190" cy={50 - ((hourBookingCounts["14"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="220" cy={50 - ((hourBookingCounts["15"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="250" cy={50 - ((hourBookingCounts["16"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                      <circle cx="280" cy={50 - ((hourBookingCounts["17"] || 0) * 12)} r="2.5" fill="#ef4f83" />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "#8c7e74", marginTop: "2px" }}>
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
                    <div style={{ marginTop: "12px", borderTop: "1.5px solid #ebdcc5", paddingTop: "10px" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.78rem", color: "#dc3545", fontWeight: "bold" }}>⚠️ Duyệt hoàn tiền ({pendingRefunds.length})</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {pendingRefunds.map((ref) => (
                          <div key={ref.RefundId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff5f5", border: "1px solid #f5c6cb", padding: "8px 10px", borderRadius: "10px", fontSize: "0.72rem" }}>
                            <div>
                              <strong>{ref.CustomerName}</strong>: {money(ref.RefundAmount)}<br />
                              <span style={{ color: "#666", fontSize: "0.68rem" }}>Lý do: {ref.Reason}</span>
                            </div>
                            <Link to="/receptionist/invoices" className="hq-action-btn danger" style={{ fontSize: "0.68rem", padding: "4px 8px", textDecoration: "none" }}>
                              Duyệt
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Popular Services & Highlighted VIP Customer */}
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>📈 Thị hiếu Dịch vụ & Khách hàng nổi bật</h3>
                  </div>

                  {/* Popular Services progress bars */}
                  <h4 style={{ fontSize: "0.74rem", color: "#8c7e74", margin: "0 0 10px 0", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.3px" }}>🔥 Top dịch vụ đặt nhiều hôm nay</h4>
                  <div style={{ background: "#faf8f5", padding: "14px", borderRadius: "16px", border: "1px solid #f1ebd9", marginBottom: "20px" }}>
                    {popularServices.length === 0 ? (
                      <p style={{ fontSize: "0.74rem", color: "#888", textAlign: "center", margin: 0 }}>Chưa có thống kê dịch vụ hôm nay.</p>
                    ) : (
                      popularServices.map((s, idx) => {
                        const maxVal = Math.max(...popularServices.map((x) => Number(x.BookingCount || 0)), 1);
                        const percentFill = Math.round((Number(s.BookingCount || 0) / maxVal) * 100);
                        const rankClass = idx === 0 ? "hq-rank-1" : idx === 1 ? "hq-rank-2" : idx === 2 ? "hq-rank-3" : "hq-rank-other";

                        return (
                          <div className="hq-progress-bar-container" key={s.ServiceId}>
                            <div className="hq-progress-row">
                              <div className={`hq-rank-badge ${rankClass}`}>{idx + 1}</div>
                              <div className="hq-progress-labels">
                                <span className="hq-service-name">{s.ServiceName}</span>
                                <span className="hq-service-count">{s.BookingCount} ca</span>
                              </div>
                            </div>
                            <div style={{ paddingLeft: "30px" }}>
                              <div className="hq-progress-track">
                                <div
                                  className="hq-progress-fill"
                                  style={{
                                    width: `${percentFill}%`,
                                    background: idx === 0 
                                      ? "linear-gradient(90deg, #1b3d2f 0%, #34614d 100%)" 
                                      : idx === 1 
                                      ? "linear-gradient(90deg, #b45309 0%, #f59e0b 100%)" 
                                      : "linear-gradient(90deg, #ebdcc5 0%, #d4a94f 100%)",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* VIP Profile summary info */}
                  {highlightedCustomer && (
                    <>
                      <h4 style={{ fontSize: "0.74rem", color: "#8c7e74", margin: "14px 0 10px 0", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.3px" }}>⭐ Khách hàng nổi bật trong ca</h4>
                      <div className="hq-vip-card">
                        <div className="hq-vip-avatar-wrapper">
                          <Avatar src={highlightedCustomer.AvatarUrl} name={highlightedCustomer.FullName} size="42px" />
                          <div className="hq-vip-badge">👑</div>
                        </div>
                        <div className="hq-vip-info">
                          <span className="hq-vip-name">{highlightedCustomer.FullName}</span>
                          <div className="hq-vip-meta">
                            <span>SĐT: {highlightedCustomer.Phone || "Chưa gán"}</span>
                            <span>•</span>
                            <span>Chi tiêu: <strong className="hq-vip-spent">{money(highlightedCustomer.TotalSpent)}</strong></span>
                          </div>
                        </div>
                        <Link to="/receptionist/customers" className="hq-vip-btn">Hồ sơ</Link>
                      </div>
                    </>
                  )}
                </div>

                {/* Section 5: Tools shortcuts grid */}
                <div className="hq-panel-card">
                  <div className="hq-panel-title">
                    <h3>⚡ Trung tâm Điều hành nhanh Lễ tân</h3>
                  </div>
                  <div className="hq-shortcuts-deck">
                    <Link className="shortcut-node" to="/receptionist/appointments/create?walkin=1">
                      <span className="icon">🚶</span>
                      <span className="txt">Khách Walk-in</span>
                    </Link>

                    <Link className="shortcut-node" to="/receptionist/appointments/create">
                      <span className="icon">📅</span>
                      <span className="txt">Đặt lịch hẹn</span>
                    </Link>

                    <Link className="shortcut-node" to="/receptionist/invoices">
                      <span className="icon">🧾</span>
                      <span className="txt">Hóa đơn</span>
                    </Link>

                    <Link className="shortcut-node" to="/receptionist/waiting-list">
                      <span className="icon">⏳</span>
                      <span className="txt">Hàng chờ</span>
                    </Link>

                    <Link className="shortcut-node" to="/admin/ai-crm">
                      <span className="icon">🔮</span>
                      <span className="txt">AI CRM</span>
                    </Link>

                    <Link className="shortcut-node" to="/receptionist/profile">
                      <span className="icon">👤</span>
                      <span className="txt">Hồ sơ cá nhân</span>
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
