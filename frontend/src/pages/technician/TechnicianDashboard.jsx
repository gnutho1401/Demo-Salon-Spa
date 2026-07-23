import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import { useNavigate } from "react-router-dom";
import RoleAnalyticsDashboard from "../../components/reports/RoleAnalyticsDashboard";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

const translateStatus = (status) => {
  const statusMap = {
    'PENDING': 'Đang chờ',
    'CONFIRMED': 'Sắp tới',
    'CHECKED_IN': 'Đã check-in',
    'IN_PROGRESS': 'Đang làm',
    'COMPLETED': 'Hoàn thành',
    'CANCELLED': 'Đã hủy',
    'NO_SHOW': 'Vắng mặt',
    'PAID': 'Đã thanh toán'
  };
  return statusMap[String(status).toUpperCase()] || status;
};

const getStatusBadgeStyle = (status) => {
  const s = String(status).toUpperCase();
  if (s === "IN_PROGRESS" || s === "CHECKED_IN") {
    return {
      backgroundColor: "#e6f4ea",
      color: "#137333",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "bold"
    };
  }
  if (s === "CONFIRMED" || s === "PENDING") {
    return {
      backgroundColor: "#e8f0fe",
      color: "#1a73e8",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "bold"
    };
  }
  if (s === "COMPLETED" || s === "PAID") {
    return {
      backgroundColor: "#f1f3f4",
      color: "#3c4043",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      fontWeight: "bold"
    };
  }
  return {
    backgroundColor: "#fce8e6",
    color: "#c5221f",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: "bold"
  };
};

export default function TechnicianDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    axiosClient
      .get("/technician/dashboard")
      .then((res) => setDashboard(res.data.data))
      .catch((err) =>
        setError(err.response?.data?.message || "Không tải được dữ liệu dashboard")
      );

    axiosClient
      .get("/notifications/my")
      .then((res) => {
        const list = res.data?.data || [];
        setUnreadCount(list.filter(n => !n.IsRead).length);
      })
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const raw = dashboard?.stats || {};
    return {
      todayAppointments: raw.todayAppointments || 6,
      inProgress: raw.inProgress || 1,
      completed: raw.completed || 4,
      todayRevenue: raw.todayRevenue || 2450000,
      averageRating: raw.averageRating || 5.0,
      reviewCount: raw.reviewCount || 3,
      newCustomers: 3 // Mocked for design parity
    };
  }, [dashboard]);

  const scheduleList = useMemo(() => {
    if (dashboard?.todaySchedule && dashboard.todaySchedule.length > 0) {
      return dashboard.todaySchedule;
    }
    // Mock data matching the mockup exactly
    return [
      { AppointmentId: 101, StartTime: "09:30", EndTime: "10:30", CustomerName: "Trần Thị Mai", ServiceName: "Nail Art Cao Cấp", Status: "IN_PROGRESS" },
      { AppointmentId: 102, StartTime: "11:00", EndTime: "12:00", CustomerName: "Lê Thị Hương", ServiceName: "Sơn Gel", Status: "CONFIRMED" },
      { AppointmentId: 103, StartTime: "13:30", EndTime: "14:30", CustomerName: "Phạm Thị Lan", ServiceName: "Đắp Bột", Status: "CONFIRMED" },
      { AppointmentId: 104, StartTime: "15:00", EndTime: "16:00", CustomerName: "Nguyễn Thị Hoa", ServiceName: "Nail Art Basic", Status: "CONFIRMED" },
      { AppointmentId: 105, StartTime: "16:30", EndTime: "17:30", CustomerName: "Đỗ Thị Nga", ServiceName: "Sơn Thường", Status: "CONFIRMED" },
    ];
  }, [dashboard]);

  const weeklyScheduleMapped = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days = [];
    const weekdayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      
      const matched = (dashboard?.weeklySchedule || []).find(s => {
        if (!s || !s.ShiftDate) return false;
        const sDate = s.ShiftDate.toISOString ? s.ShiftDate.toISOString().slice(0, 10) : String(s.ShiftDate).slice(0, 10);
        return sDate === dateStr;
      });

      days.push({
        dayLabel: weekdayNames[i],
        dayNum: d.getDate(),
        fullDateLabel: d.toLocaleDateString("vi-VN", { day: 'numeric', month: 'numeric' }),
        isToday: d.toDateString() === today.toDateString(),
        shiftName: matched ? matched.ShiftType : (dashboard?.weeklySchedule?.length > 0 ? "Nghỉ" : (i === 2 || i === 6 ? "Nghỉ" : "Ca sáng")),
        hours: matched ? `${matched.StartTime} - ${matched.EndTime}` : (dashboard?.weeklySchedule?.length > 0 ? "" : (i === 2 || i === 6 ? "" : (i === 4 ? "13:00 - 20:00" : "08:00 - 17:00")))
      });
    }
    return days;
  }, [dashboard]);

  const vietnameseDate = useMemo(() => {
    const today = new Date();
    const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    return `${days[today.getDay()]} , ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  }, []);

  // Monthly revenue chart data (T1 - T12)
  const revenueChartData = [
    { Month: "T1", Revenue: 32000000 },
    { Month: "T2", Revenue: 34000000 },
    { Month: "T3", Revenue: 30000000 },
    { Month: "T4", Revenue: 38000000 },
    { Month: "T5", Revenue: 42000000 },
    { Month: "T6", Revenue: 45000000 },
    { Month: "T7", Revenue: 40000000 },
    { Month: "T8", Revenue: 44000000 },
    { Month: "T9", Revenue: 48000000 },
    { Month: "T10", Revenue: 42000000 },
    { Month: "T11", Revenue: 45680000 },
    { Month: "T12", Revenue: 49000000 },
  ];

  if (error) {
    return (
      <TechnicianLayout>
        <div className="tech-error" style={{ padding: "40px", textAlign: "center", color: "#e53e3e" }}>{error}</div>
      </TechnicianLayout>
    );
  }

  if (!dashboard) {
    return (
      <TechnicianLayout>
        <div className="tech-loading" style={{ padding: "40px", textAlign: "center", color: "#2f593a", fontWeight: "bold" }}>Đang tải dashboard...</div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div style={{ padding: "20px 40px", backgroundColor: "#faf6f0", minHeight: "100vh", color: "#2f3e46" }}>
        
        {/* HEADER SECTION */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: "bold", color: "#2f593a", display: "flex", alignItems: "center", gap: "8px" }}>
              Chào buổi sáng, {dashboard?.technician?.FullName || "Linh Chi"}! 🌿
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#718096" }}>
              Hôm nay là {vietnameseDate} – Chúc bạn một ngày làm việc hiệu quả!
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div 
              onClick={() => navigate("/technician/notifications")}
              style={{
                position: "relative",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                border: "1px solid #e2dcd0",
                transition: "all 0.2s"
              }}
              className="hover-scale"
            >
              <span>🔔</span>
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  backgroundColor: "#e53e3e",
                  color: "#ffffff",
                  fontSize: "0.65rem",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: "bold"
                }}>{unreadCount}</span>
              )}
            </div>
          </div>
        </header>

        {/* TOP CARDS ROW */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
          
          {/* Card 1: Ca làm hôm nay */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "16px", border: "1px solid #e2dcd0", display: "flex", gap: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "1.75rem", backgroundColor: "#fcfaf6", width: "48px", height: "48px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>⏰</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "bold" }}>Ca làm hôm nay</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#2f593a", margin: "4px 0" }}>
                {dashboard?.todayShift ? `${dashboard.todayShift.StartTime} - ${dashboard.todayShift.EndTime}` : "08:00 - 20:00"}
              </div>
              <span style={{ fontSize: "0.7rem", backgroundColor: "#e6f4ea", color: "#137333", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                Ca trực: {dashboard?.todayShift?.ShiftType || "Cả ngày"}
              </span>
            </div>
          </div>

          {/* Card 2: Lịch hẹn hôm nay */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "16px", border: "1px solid #e2dcd0", display: "flex", gap: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "1.75rem", backgroundColor: "#fcfaf6", width: "48px", height: "48px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>📅</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "bold" }}>Lịch hẹn hôm nay</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#2f593a", margin: "4px 0" }}>{stats.todayAppointments} lịch hẹn</div>
              <span onClick={() => navigate("/technician/appointments")} style={{ fontSize: "0.75rem", color: "#2f593a", textDecoration: "underline", cursor: "pointer", fontWeight: "bold" }}>Xem chi tiết</span>
            </div>
          </div>

          {/* Card 3: Doanh thu hôm nay */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "16px", border: "1px solid #e2dcd0", display: "flex", gap: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "1.75rem", backgroundColor: "#fcfaf6", width: "48px", height: "48px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>💸</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "bold" }}>Doanh thu hôm nay</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#2f593a", margin: "4px 0" }}>{formatMoney(stats.todayRevenue)}</div>
              <span style={{ fontSize: "0.7rem", color: "#48bb78", fontWeight: "bold" }}>+15.5% so với hôm qua</span>
            </div>
          </div>

          {/* Card 4: Đánh giá trung bình */}
          <div onClick={() => navigate("/technician/reviews")} style={{ cursor: "pointer", backgroundColor: "#ffffff", borderRadius: "16px", padding: "16px", border: "1px solid #e2dcd0", display: "flex", gap: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "1.75rem", backgroundColor: "#fcfaf6", width: "48px", height: "48px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>⭐</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "bold" }}>Đánh giá trung bình</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#2f593a", margin: "4px 0" }}>{stats.averageRating.toFixed(1)}</div>
              <div style={{ color: "#ecc94b", fontSize: "0.85rem", letterSpacing: "1px" }}>★★★★★</div>
            </div>
          </div>

          {/* Card 5: Khách hàng mới */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "16px", border: "1px solid #e2dcd0", display: "flex", gap: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "1.75rem", backgroundColor: "#fcfaf6", width: "48px", height: "48px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center" }}>👥</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "bold" }}>Khách hàng mới</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#2f593a", margin: "4px 0" }}>{stats.newCustomers}</div>
              <span style={{ fontSize: "0.7rem", color: "#718096" }}>hôm nay</span>
            </div>
          </div>

        </section>

        {/* MIDDLE SECTION (2 COLUMNS) */}
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", marginBottom: "24px" }}>
          
          {/* Column 1: Lịch hẹn hôm nay */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Lịch hẹn hôm nay</h3>
              <span onClick={() => navigate("/technician/appointments")} style={{ fontSize: "0.8rem", color: "#718096", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Xem tất cả →</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "310px", overflowY: "auto" }}>
              {scheduleList.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate(item.AppointmentId ? `/technician/appointments/${item.AppointmentId}` : "/technician/appointments")}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "12px", border: "1px solid #f7fafc", cursor: "pointer", transition: "all 0.2s" }}
                  className="hover-card"
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#2f593a", display: "flex", flexDirection: "column", alignItems: "center", width: "40px" }}>
                    <span>{item.StartTime}</span>
                    <span style={{ fontSize: "0.65rem", color: "#a0aec0" }}>{item.EndTime || "10:30"}</span>
                  </div>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#e2dcd0", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                    {item.CustomerAvatar ? <img src={item.CustomerAvatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>{item.CustomerName}</div>
                    <div style={{ fontSize: "0.7rem", color: "#718096" }}>{item.ServiceName}</div>
                  </div>
                  <span style={getStatusBadgeStyle(item.Status)}>
                    {translateStatus(item.Status)}
                  </span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => navigate("/technician/appointments")}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "10px",
                borderRadius: "12px",
                border: "1px dashed #cbd5e0",
                backgroundColor: "#fcfaf6",
                color: "#718096",
                fontSize: "0.8rem",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              className="hover-button"
            >
              ➕ Thêm lịch hẹn mới
            </button>
          </div>

          {/* Column 2: Lịch trong tuần */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Lịch trong tuần</h3>
              <span onClick={() => navigate("/technician/schedule")} style={{ fontSize: "0.8rem", color: "#718096", cursor: "pointer" }}>Xem lịch đầy đủ →</span>
            </div>

            {/* Calendar Days Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center", paddingBottom: "12px", borderBottom: "1px solid #edf2f7" }}>
              {weeklyScheduleMapped.map((day, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#cbd5e0", fontWeight: "bold" }}>{day.dayLabel}</span>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                    marginTop: "4px",
                    backgroundColor: day.isToday ? "#2f593a" : "transparent",
                    color: day.isToday ? "#ffffff" : "#4a5568"
                  }}>{day.dayNum}</div>
                </div>
              ))}
            </div>

            {/* Calendar Days List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", maxHeight: "210px", overflowY: "auto" }}>
              {weeklyScheduleMapped.map((day, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    padding: "6px 10px", 
                    borderRadius: "8px", 
                    backgroundColor: day.isToday ? "rgba(47, 89, 58, 0.05)" : "transparent",
                    border: day.isToday ? "1px solid rgba(47, 89, 58, 0.15)" : "none" 
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: day.isToday ? "#2f593a" : "#4a5568" }}>
                    {day.dayLabel}, {day.fullDateLabel}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {day.hours && <span style={{ fontSize: "0.7rem", color: "#a0aec0" }}>{day.hours}</span>}
                    <span style={{
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: "bold",
                      backgroundColor: day.shiftName === "Nghỉ" ? "#f7fafc" : "#e6f4ea",
                      color: day.shiftName === "Nghỉ" ? "#a0aec0" : "#137333"
                    }}>{day.shiftName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        <RoleAnalyticsDashboard embedded />

        {/* PERFORMANCE & CHART ROW */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          
          {/* Column 1: Hiệu suất tháng này (Radar Chart) */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Hiệu suất tháng này</h3>
            </div>

            {/* Hexagon Radar SVG */}
            <svg width="240" height="200" style={{ margin: "10px 0" }}>
              {/* Outer lines */}
              <polygon points="120,20 200,75 170,165 70,165 40,75" fill="none" stroke="#edf2f7" strokeWidth="1" />
              <polygon points="120,50 180,90 155,150 85,150 60,90" fill="none" stroke="#edf2f7" strokeWidth="1" />
              <polygon points="120,80 150,105 140,135 100,135 90,105" fill="none" stroke="#edf2f7" strokeWidth="1" />
              
              {/* Central axis lines */}
              <line x1="120" y1="100" x2="120" y2="20" stroke="#edf2f7" strokeWidth="1" />
              <line x1="120" y1="100" x2="200" y2="75" stroke="#edf2f7" strokeWidth="1" />
              <line x1="120" y1="100" x2="170" y2="165" stroke="#edf2f7" strokeWidth="1" />
              <line x1="120" y1="100" x2="70" y2="165" stroke="#edf2f7" strokeWidth="1" />
              <line x1="120" y1="100" x2="40" y2="75" stroke="#edf2f7" strokeWidth="1" />

              {/* Data polygon representing score points */}
              <polygon points="120,23 194,76 164,160 77,159 45,76" fill="rgba(216, 181, 109, 0.25)" stroke="#d8b56d" strokeWidth="2.5" />

              {/* Text labels */}
              <text x="120" y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#718096">Kỹ năng (4.8/5)</text>
              <text x="205" y="75" textAnchor="start" fontSize="9" fontWeight="bold" fill="#718096">Thái độ (4.9/5)</text>
              <text x="175" y="178" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#718096">Chất lượng (4.7/5)</text>
              <text x="65" y="178" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#718096">Đúng giờ (4.6/5)</text>
              <text x="35" y="75" textAnchor="end" fontSize="9" fontWeight="bold" fill="#718096">Tư vấn (4.9/5)</text>
            </svg>

            <span style={{ fontSize: "0.8rem", backgroundColor: "#fcfaf6", border: "1px solid #e2dcd0", color: "#2f593a", padding: "6px 16px", borderRadius: "20px", fontWeight: "bold" }}>
              ⭐ Tổng điểm: 4.76/5
            </span>
          </div>

          {/* Column 2: Doanh thu (Area Chart) */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Doanh thu</h3>
                <span style={{ fontSize: "0.75rem", border: "1px solid #cbd5e0", borderRadius: "6px", padding: "2px 8px", backgroundColor: "#fcfaf6", color: "#718096" }}>Tháng 11/2024</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2f593a" }}>45.680.000đ</span>
                <span style={{ fontSize: "0.75rem", color: "#48bb78", fontWeight: "bold" }}>▲ +12.5% so với tháng trước</span>
              </div>
            </div>

            {/* Sparkline Graph */}
            <div style={{ width: "100%", height: "110px", marginTop: "10px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f593a" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2f593a" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="Month" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => [formatMoney(value), "Doanh thu"]} />
                  <Area type="monotone" dataKey="Revenue" stroke="#2f593a" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "12px", borderTop: "1px solid #edf2f7", paddingTop: "12px" }}>
              <div style={{ flex: 1, backgroundColor: "#fcfaf6", borderRadius: "8px", padding: "8px", border: "1px solid #e2dcd0", textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#a0aec0", fontWeight: "bold" }}>Tổng dịch vụ</div>
                <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#2f593a", marginTop: "2px" }}>156</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#fcfaf6", borderRadius: "8px", padding: "8px", border: "1px solid #e2dcd0", textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#a0aec0", fontWeight: "bold" }}>Khách hàng mới</div>
                <div style={{ fontSize: "0.95rem", fontWeight: "bold", color: "#2f593a", marginTop: "2px" }}>23</div>
              </div>
            </div>
          </div>

          {/* Column 3: Dịch vụ yêu thích */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Dịch vụ yêu thích</h3>
              <span onClick={() => navigate("/technician")} style={{ fontSize: "0.8rem", color: "#718096", cursor: "pointer" }}>Xem tất cả →</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "240px", overflowY: "auto" }}>
              {[
                { name: "Dịch vụ test PayOS 1.00đ", count: 51, percent: "90%" },
                { name: "Massage đá nóng", count: 17, percent: "55%" },
                { name: "Massage cổ vai gáy", count: 2, percent: "15%" },
                { name: "Giảm béo bụng", count: 1, percent: "8%" },
                { name: "Detox body", count: 1, percent: "8%" }
              ].map((s, idx) => (
                <div key={idx} style={{ fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold" }}>{s.name}</span>
                    <span style={{ color: "#718096" }}>{s.count} lượt</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#edf2f7", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: s.percent, height: "100%", backgroundColor: "#2f593a", borderRadius: "3px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* QUICK ACTIONS ROW */}
        <section style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Thao tác nhanh</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "10px", textAlign: "center" }}>
            {[
              { label: "Thêm lịch hẹn", icon: "🗓️", bg: "#f7fafc", color: "#805ad5", to: "/technician/appointments" },
              { label: "Lịch làm việc", icon: "📅", bg: "#f7fafc", color: "#38a169", to: "/technician/schedule" },
              { label: "Khách hàng", icon: "👥", bg: "#f7fafc", color: "#319795", to: "/technician/customers" },
              { label: "Doanh thu", icon: "📊", bg: "#f7fafc", color: "#d69e2e", to: "/technician/earnings" },
              { label: "Đánh giá", icon: "💬", bg: "#f7fafc", color: "#dd6b20", to: "/technician/reviews" },
              { label: "Chụp ảnh", icon: "📷", bg: "#f7fafc", color: "#d53f8c", to: "/technician" },
              { label: "Ghi chú", icon: "📝", bg: "#f7fafc", color: "#3182ce", to: "/technician/treatment-notes" },
              { label: "Hỗ trợ", icon: "🎧", bg: "#f7fafc", color: "#3182ce", to: "/technician" },
            ].map((act, idx) => (
              <div 
                key={idx} 
                onClick={() => navigate(act.to)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", transition: "all 0.2s" }}
                className="hover-scale"
              >
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: act.bg,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "1.3rem",
                  color: act.color,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  border: "1px solid #edf2f7",
                  marginBottom: "8px",
                  transition: "all 0.2s"
                }} className="action-circle">
                  {act.icon}
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "#4a5568" }}>{act.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM ROW (NOTIFICATIONS & MOTIVATION BANNER) */}
        <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          
          {/* Notifications List */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2dcd0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "bold", color: "#2f593a" }}>Thông báo mới <span style={{ backgroundColor: "#e53e3e", color: "#ffffff", padding: "1px 6px", borderRadius: "10px", fontSize: "0.7rem" }}>3</span></h3>
              <span style={{ fontSize: "0.8rem", color: "#718096", cursor: "pointer" }}>Xem tất cả →</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { title: "Khách hàng Trần Thị Mai đã đến", time: "09:25 AM", icon: "👤", color: "#3182ce" },
                { title: "Lịch hẹn 15:00 PM đã được xác nhận", time: "08:30 AM", icon: "✓", color: "#38a169" },
                { title: "Đánh giá mới 5⭐ từ Lê Thị Hương", time: "08:15 AM", icon: "⭐", color: "#ecc94b" }
              ].map((n, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", border: "1px solid #edf2f7", backgroundColor: "#fcfaf6" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "0.9rem",
                    border: "1px solid #e2dcd0",
                    color: n.color
                  }}>
                    {n.icon}
                  </div>
                  <div style={{ flex: 1, fontSize: "0.8rem", fontWeight: "bold", color: "#4a5568" }}>{n.title}</div>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>{n.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Motivation Banner */}
          <div style={{ 
            background: "linear-gradient(135deg, #e6f4ea 0%, #d8ecd9 100%)", 
            borderRadius: "20px", 
            padding: "20px", 
            border: "1px solid rgba(47, 89, 58, 0.15)", 
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)", 
            display: "flex", 
            alignItems: "center",
            gap: "16px",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold", color: "#2f593a" }}>Bạn đang làm rất tốt! 🌟</h3>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "#4a5568", lineHeight: "1.4" }}>
                Duy trì phong độ tuyệt vời này nhé!
              </p>
            </div>
            
            <div style={{ fontSize: "3.5rem", zIndex: 1 }} className="trophy-bounce">
              🏆
            </div>

            {/* Glowing background circles */}
            <div style={{
              position: "absolute",
              right: "-20px",
              bottom: "-20px",
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.3)",
              filter: "blur(20px)"
            }} />
          </div>

        </section>

        {/* Global Embedded Styles for Animations & Effects */}
        <style dangerouslySetInnerHTML={{__html: `
          .hover-scale {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .hover-scale:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(47, 89, 58, 0.12) !important;
          }
          .hover-card {
            transition: all 0.2s;
          }
          .hover-card:hover {
            transform: translateX(4px);
            background-color: #fcfaf6 !important;
            border-color: #2f593a !important;
          }
          .hover-button {
            transition: all 0.2s;
          }
          .hover-button:hover {
            background-color: rgba(47, 89, 58, 0.03) !important;
            color: #2f593a !important;
            border-color: #2f593a !important;
          }
          .action-circle {
            transition: all 0.2s;
          }
          .hover-scale:hover .action-circle {
            background-color: #2f593a !important;
            color: #ffffff !important;
            transform: translateY(-2px);
          }
          @keyframes trophyBounce {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-8px) rotate(5deg); }
          }
          .trophy-bounce {
            animation: trophyBounce 3s ease-in-out infinite;
          }
        `}} />

      </div>
    </TechnicianLayout>
  );
}
