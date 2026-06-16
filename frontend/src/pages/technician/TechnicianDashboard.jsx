import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
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

function StatCard({ title, value, icon }) {
  return (
    <div className="tech-stat-card">
      <div className="tech-stat-icon">{icon}</div>
      <div>
        <p>{title}</p>
        <h2>{value}</h2>
        <span>▲ vs yesterday</span>
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
        setError(err.response?.data?.message || "Không tải được dashboard"),
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
      name: item.Status,
      value: item.Total,
    }));
  }, [dashboard]);

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
        <header className="tech-header">
          <div>
            <h1>
              Good morning, {dashboard?.technician?.FullName || "Technician"}!
              🌿
            </h1>
            <p>Here's what's happening today at Luna Salon</p>
          </div>

          <div className="tech-search">
            <input
              placeholder="Search customers, appointments, notes..."
              onKeyDown={handleSearch}
            />
          </div>

          <button
            className="tech-new-btn"
            onClick={() => navigate("/technician/schedule")}
          >
            View My Schedule
          </button>
        </header>

        <section className="tech-stats">
          <StatCard
            title="Today's Appointments"
            value={stats.todayAppointments || 0}
            icon="📅"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress || 0}
            icon="⏱"
          />
          <StatCard title="Completed" value={stats.completed || 0} icon="✓" />
          <StatCard
            title="Today's Revenue"
            value={money(stats.todayRevenue)}
            icon="💰"
          />
          <StatCard
            title="Average Rating"
            value={Number(stats.averageRating || 0).toFixed(1)}
            icon="⭐"
          />
        </section>

        <section className="tech-grid">
          <div className="tech-card tech-large">
            <div className="tech-card-head">
              <h3>Earnings Overview</h3>
              <button onClick={() => navigate("/technician/earnings")}>
                This Week
              </button>
            </div>

            <h2>{money(stats.todayRevenue)}</h2>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dashboard.earnings}>
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#456b35"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="tech-card">
            <h3>Appointments Status</h3>

            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="tech-status-list">
              {pieData.map((item) => (
                <p key={item.name}>
                  <span>{item.name}</span>
                  <b>{item.value}</b>
                </p>
              ))}
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-head">
              <h3>Today's Schedule</h3>
              <button onClick={() => navigate("/technician/schedule")}>
                View All
              </button>
            </div>

            <div className="tech-schedule">
              {dashboard.todaySchedule.map((item) => (
                <div
                  className="tech-schedule-row"
                  key={item.AppointmentId}
                  onClick={() =>
                    navigate(`/technician/appointments/${item.AppointmentId}`)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <b>{item.StartTime}</b>
                  <div className="tech-mini-avatar">👩</div>
                  <div>
                    <h4>{item.CustomerName}</h4>
                    <p>{item.ServiceName}</p>
                  </div>
                  <span
                    className={`tech-badge ${String(item.Status).toLowerCase()}`}
                  >
                    {item.Status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="tech-card">
            <h3>Popular Services</h3>

            {dashboard.popularServices.map((item) => (
              <div className="tech-progress" key={item.ServiceName}>
                <div>
                  <span>{item.ServiceName}</span>
                  <b>{item.Total}</b>
                </div>
                <p>
                  <i style={{ width: `${Math.min(item.Total * 15, 100)}%` }} />
                </p>
              </div>
            ))}
          </div>

          <div className="tech-card">
            <div className="tech-card-head">
              <h3>Recent Reviews</h3>
              <button onClick={() => navigate("/technician/appointments")}>
                View All
              </button>
            </div>

            {dashboard.recentReviews.map((review, index) => (
              <div className="tech-review" key={index}>
                <div className="tech-mini-avatar">👩</div>
                <div>
                  <h4>{review.CustomerName}</h4>
                  <p>⭐ {review.Rating}.0</p>
                  <span>{review.Comment}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tech-card">
            <h3>Upcoming Reminders</h3>

            {dashboard.reminders?.length ? (
              dashboard.reminders.map((item, index) => (
                <div className="tech-reminder" key={index}>
                  <span>🔔</span>
                  <div>
                    <b>{item.Title}</b>
                    <p>{item.Content || item.Type}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="tech-empty">No reminders</p>
            )}
          </div>

          <div className="tech-card tech-goals">
            <h3>Today's Goals</h3>
            <div className="tech-goal-circle">{goalPercent}%</div>
            <p>
              Complete appointments: {stats.completed || 0} /{" "}
              {stats.todayAppointments || 0}
            </p>
            <p>Maintain 4.8+ rating</p>
            <p>No customer complaints</p>
          </div>

          <div className="tech-card tech-actions-card">
            <h3>Quick Actions</h3>

            <div className="tech-actions">
              <button onClick={() => navigate("/technician/schedule")}>
                📅 New Appointment
              </button>

              <button
                onClick={() =>
                  navigate("/technician/appointments?status=CONFIRMED")
                }
              >
                ✅ Check-in Customer
              </button>

              <button onClick={() => navigate("/technician/appointments")}>
                📝 Add Treatment Note
              </button>

              <button onClick={() => navigate("/technician/settings")}>
                🎧 Support Request
              </button>

              <button onClick={() => navigate("/technician/schedule")}>
                📆 View My Schedule
              </button>
            </div>
          </div>
        </section>
      </div>
    </TechnicianLayout>
  );
}
