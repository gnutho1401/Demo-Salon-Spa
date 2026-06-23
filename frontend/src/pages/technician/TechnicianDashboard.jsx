import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import { useNavigate } from "react-router-dom";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

const translateStatus = (status) => {
  const statusMap = {
    'PENDING': 'Đang chờ',
    'CONFIRMED': 'Đã xác nhận',
    'CHECKED_IN': 'Đã check-in',
    'IN_PROGRESS': 'Đang thực hiện',
    'COMPLETED': 'Đã hoàn thành',
    'CANCELLED': 'Đã hủy',
    'NO_SHOW': 'Khách không đến',
    'PAID': 'Đã thanh toán'
  };
  return statusMap[String(status).toUpperCase()] || status;
};

function StatCard({ title, value, icon, subValue }) {
  return (
    <div className="tech-stat-card">
      <div className="tech-stat-icon">{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: "#6f665b", fontSize: "14px" }}>{title}</p>
        <h2 style={{ margin: "4px 0", fontSize: "24px", color: "#102616" }}>{value}</h2>
        {subValue ? (
          <span style={{ fontSize: "12px", color: "#8a7e72" }}>{subValue}</span>
        ) : (
          <span style={{ fontSize: "12px", color: "#456b35" }}>▲ Cập nhật hôm nay</span>
        )}
      </div>
    </div>
  );
}

export default function TechnicianDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axiosClient
      .get("/technician/dashboard")
      .then((res) => setDashboard(res.data.data))
      .catch((err) =>
        setError(err.response?.data?.message || "Không tải được dữ liệu dashboard"),
      );
  }, []);

  const stats = dashboard?.stats || {};

  const goalPercent =
    stats.todayAppointments > 0
      ? Math.round(((stats.completed || 0) / stats.todayAppointments) * 100)
      : 0;

  const handleSearch = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      navigate(
        `/technician/appointments?search=${encodeURIComponent(e.target.value.trim())}`,
      );
    }
  };

  const pieData = useMemo(() => {
    return (dashboard?.appointmentStatus || []).map((item) => ({
      name: translateStatus(item.Status),
      value: item.Total,
    }));
  }, [dashboard]);

  const formattedEarnings = useMemo(() => {
    const dayMap = {
      'Mon': 'Thứ 2',
      'Tue': 'Thứ 3',
      'Wed': 'Thứ 4',
      'Thu': 'Thứ 5',
      'Fri': 'Thứ 6',
      'Sat': 'Thứ 7',
      'Sun': 'Chủ nhật'
    };
    return (dashboard?.earnings || []).map(item => ({
      ...item,
      DayName: dayMap[item.DayName] || item.DayName
    }));
  }, [dashboard]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  if (error) {
    return (
      <TechnicianLayout>
        <div className="tech-error">{error}</div>
      </TechnicianLayout>
    );
  }

  if (!dashboard) {
    return (
      <TechnicianLayout>
        <div className="tech-loading">Đang tải dashboard...</div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div className="tech-dashboard">
        <header className="tech-header" style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "28px", margin: 0, color: "#1f1a13" }}>
                {greeting}, {dashboard?.technician?.FullName || "Kỹ thuật viên"}! 🌿
              </h1>
              <p style={{ margin: "4px 0 0", color: "#6f665b" }}>Dưới đây là lịch trình hôm nay của bạn tại Luna Salon</p>
            </div>
            
            {/* Shift Alert Box */}
            {dashboard?.todayShift ? (
              <div className={`tech-shift-alert ${dashboard.todayShift.IsDayOff ? "day-off" : "on-duty"}`}>
                <span>{dashboard.todayShift.IsDayOff ? "🏖️" : "⏰"}</span>
                <div>
                  <h5>
                    {dashboard.todayShift.IsDayOff ? "Hôm nay nghỉ phép" : `Ca trực: ${dashboard.todayShift.ShiftType}`}
                  </h5>
                  {!dashboard.todayShift.IsDayOff && (
                    <p>
                      {dashboard.todayShift.StartTime} - {dashboard.todayShift.EndTime}
                      {dashboard.todayShift.Notes && ` (${dashboard.todayShift.Notes})`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="tech-shift-alert unassigned">
                <span>📅</span>
                <div>
                  <h5>Chưa phân ca trực</h5>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="tech-search">
              <input
                placeholder="Tìm kiếm khách hàng, lịch hẹn, ghi chú..."
                onKeyDown={handleSearch}
                style={{ width: "280px" }}
              />
            </div>

            <button
              className="tech-new-btn"
              onClick={() => navigate("/technician/schedule")}
            >
              Xem lịch của tôi
            </button>
          </div>
        </header>

        <section className="tech-stats">
          <StatCard
            title="Lịch hẹn hôm nay"
            value={stats.todayAppointments || 0}
            icon="📅"
          />
          <StatCard
            title="Đang thực hiện"
            value={stats.inProgress || 0}
            icon="⏱"
          />
          <StatCard 
            title="Đã hoàn thành" 
            value={stats.completed || 0} 
            icon="✓" 
          />
          <StatCard
            title="Doanh thu hôm nay"
            value={money(stats.todayRevenue)}
            icon="💰"
          />
          <StatCard
            title="Đánh giá trung bình"
            value={`${Number(stats.averageRating || 0).toFixed(1)} ⭐`}
            subValue={`${stats.reviewCount || 0} lượt đánh giá`}
            icon="⭐"
          />
        </section>

        <section className="tech-grid">
          <div className="tech-card tech-large">
            <div className="tech-card-head">
              <h3>Tổng quan thu nhập</h3>
              <button onClick={() => navigate("/technician/earnings")}>
                Tuần này
              </button>
            </div>

            <h2 style={{ color: "#24431f", margin: "10px 0" }}>{money(stats.todayRevenue)}</h2>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formattedEarnings}>
                <XAxis dataKey="DayName" stroke="#6f665b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis width={60} stroke="#6f665b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip formatter={(value) => [money(value), "Doanh thu"]} labelStyle={{ color: '#102616', fontWeight: 'bold' }} />
                <Line
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#456b35"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="tech-card">
            <h3>Trạng thái lịch hẹn</h3>

            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={
                            ["#d9a441", "#456b35", "#8d7b4a", "#a8b98a", "#d96b43"][
                              index % 5
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, `Lịch hẹn: ${name}`]} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="tech-status-list" style={{ maxHeight: "90px", overflowY: "auto" }}>
                  {pieData.map((item) => (
                    <p key={item.name} style={{ margin: "4px 0", display: "flex", justifyContent: "space-between" }}>
                      <span>{item.name}</span>
                      <b>{item.value}</b>
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ textAlign: "center", color: "#6f665b", marginTop: "60px" }}>Chưa có lịch hẹn hôm nay</p>
            )}
          </div>

          <div className="tech-card">
            <div className="tech-card-head">
              <h3>Lịch hẹn hôm nay</h3>
              <button onClick={() => navigate("/technician/schedule")}>
                Xem tất cả
              </button>
            </div>

            <div className="tech-schedule" style={{ maxHeight: "250px", overflowY: "auto" }}>
              {dashboard.todaySchedule?.length > 0 ? (
                dashboard.todaySchedule.map((item) => (
                  <div
                    className="tech-schedule-row"
                    key={item.AppointmentId}
                    onClick={() =>
                      navigate(`/technician/appointments/${item.AppointmentId}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <b>{item.StartTime}</b>
                    <div className="tech-mini-avatar">
                      {item.CustomerAvatar ? (
                        <img src={item.CustomerAvatar} alt={item.CustomerName} />
                      ) : (
                        "👤"
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: "14px", margin: 0 }}>{item.CustomerName}</h4>
                      <p style={{ fontSize: "12px", margin: "2px 0 0", color: "#7c7162" }}>{item.ServiceName}</p>
                    </div>
                    <span
                      className={`tech-badge ${String(item.Status).toLowerCase()}`}
                    >
                      {translateStatus(item.Status)}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", color: "#6f665b", marginTop: "60px" }}>Không có lịch hẹn nào hôm nay</p>
              )}
            </div>
          </div>

          <div className="tech-card">
            <h3>Dịch vụ ưa chuộng</h3>

            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {dashboard.popularServices?.length > 0 ? (
                dashboard.popularServices.map((item) => (
                  <div className="tech-progress" key={item.ServiceName} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span>{item.ServiceName}</span>
                      <b>{item.Total} lượt</b>
                    </div>
                    <p style={{ height: "6px", background: "#eee4d2", borderRadius: "10px", overflow: "hidden", margin: 0 }}>
                      <i style={{ display: "block", height: "100%", background: "#456b35", borderRadius: "10px", width: `${Math.min(item.Total * 15, 100)}%` }} />
                    </p>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", color: "#6f665b", marginTop: "60px" }}>Chưa có dữ liệu dịch vụ</p>
              )}
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-head">
              <h3>Đánh giá gần đây</h3>
              <button onClick={() => navigate("/technician/appointments")}>
                Xem tất cả
              </button>
            </div>

            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {dashboard.recentReviews?.length > 0 ? (
                dashboard.recentReviews.map((review, index) => (
                  <div className="tech-review" key={index} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: "1px solid #eee2cf" }}>
                    <div className="tech-mini-avatar">
                      {review.CustomerAvatar ? (
                        <img
                          src={review.CustomerAvatar}
                          alt={review.CustomerName}
                          style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                        />
                      ) : (
                        "👤"
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: "14px", margin: 0 }}>{review.CustomerName}</h4>
                      <p style={{ margin: "2px 0", color: "#d9a441", fontSize: "13px" }}>{"★".repeat(review.Rating)}{"☆".repeat(5 - review.Rating)}</p>
                      <span style={{ fontSize: "12px", color: "#6f665b" }}>{review.Comment}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: "center", color: "#6f665b", marginTop: "60px" }}>Chưa có đánh giá nào</p>
              )}
            </div>
          </div>

          <div className="tech-card">
            <h3>Thông báo nhắc nhở</h3>

            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {dashboard.reminders?.length ? (
                dashboard.reminders.map((item, index) => (
                  <div className="tech-reminder" key={index} style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: "1px solid #eee2cf" }}>
                    <span style={{ fontSize: "18px" }}>🔔</span>
                    <div>
                      <b style={{ fontSize: "14px" }}>{item.Title}</b>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6f665b" }}>{item.Content || item.Type}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="tech-empty" style={{ textAlign: "center", color: "#6f665b", marginTop: "60px" }}>Không có nhắc nhở nào</p>
              )}
            </div>
          </div>

          <div className="tech-card tech-goals">
            <h3>Mục tiêu hôm nay</h3>
            <div className="tech-goal-circle" style={{ borderColor: goalPercent >= 100 ? "#456b35" : "#d9a441" }}>{goalPercent}%</div>
            <p style={{ fontWeight: "bold", textAlign: "center" }}>
              Đã hoàn thành: {stats.completed || 0} /{" "}
              {stats.todayAppointments || 0} lịch hẹn
            </p>
            <div style={{ borderTop: "1px solid #eee2cf", marginTop: "10px", paddingTop: "10px", fontSize: "13px", color: "#6f665b" }}>
              <p>📍 Duy trì điểm số đánh giá từ 4.8+</p>
              <p>📍 Đảm bảo phục vụ đúng giờ cho mọi khách hàng</p>
              <p>📍 Ghi chú trị liệu đầy đủ sau mỗi ca hoàn thành</p>
            </div>
          </div>

          <div className="tech-actions-grid">
            <div className="tech-action-card schedule" onClick={() => navigate("/technician/schedule")}>
              <div className="tech-action-icon-wrapper">📆</div>
              <h4 className="tech-action-title">Lịch biểu của tôi</h4>
              <p className="tech-action-desc">Xem ca trực & quản lý lịch hẹn trong ngày</p>
            </div>

            <div
              className="tech-action-card start"
              onClick={() => navigate("/technician/appointments?status=CONFIRMED")}
            >
              <div className="tech-action-icon-wrapper">▶️</div>
              <h4 className="tech-action-title">Bắt đầu dịch vụ</h4>
              <p className="tech-action-desc">Kích hoạt ca dịch vụ khi khách đã sẵn sàng</p>
            </div>

            <div
              className="tech-action-card complete"
              onClick={() => navigate("/technician/appointments?status=IN_PROGRESS")}
            >
              <div className="tech-action-icon-wrapper">✅</div>
              <h4 className="tech-action-title">Hoàn thành dịch vụ</h4>
              <p className="tech-action-desc">Hoàn tất quy trình trị liệu cho khách hàng</p>
            </div>

            <div className="tech-action-card notes" onClick={() => navigate("/technician/treatment-notes")}>
              <div className="tech-action-icon-wrapper">📝</div>
              <h4 className="tech-action-title">Ghi chú trị liệu</h4>
              <p className="tech-action-desc">Cập nhật hồ sơ da & phác đồ trị liệu của khách</p>
            </div>

            <div className="tech-action-card customers" onClick={() => navigate("/technician/customers")}>
              <div className="tech-action-icon-wrapper">👥</div>
              <h4 className="tech-action-title">Khách hàng của tôi</h4>
              <p className="tech-action-desc">Xem danh sách & lịch sử chăm sóc khách hàng</p>
            </div>
          </div>
        </section>
      </div>
    </TechnicianLayout>
  );
}
