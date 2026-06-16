import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function Badge({ status }) {
  const s = String(status || "").toUpperCase();
  return <span className={`spa-badge spa-badge-${s.toLowerCase()}`}>{s}</span>;
}

function StatCard({ icon, title, value, trend, type = "green" }) {
  return (
    <div className="spa-stat-card">
      <div className={`spa-stat-icon spa-stat-${type}`}>{icon}</div>
      <div className="spa-stat-content">
        <p>{title}</p>
        <h2>{value}</h2>
        <span className={type === "red" ? "trend-red" : "trend-green"}>
          {trend}
        </span>
      </div>
      <div className={`spa-spark spa-spark-${type}`} />
    </div>
  );
}

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axiosClient
      .get("/receptionist/dashboard")
      .then((res) => setStats(res.data.data || res.data))
      .catch((err) =>
        setError(
          err.response?.data?.message || "Không tải được dashboard lễ tân",
        ),
      );
  }, []);

  const appointments = useMemo(() => {
    return stats?.todayAppointments || stats?.upcomingAppointments || [];
  }, [stats]);

  const firstCustomer = appointments[0];

  return (
    <ReceptionistLayout>
      <div className="spa-dashboard">
        <header className="spa-topbar">
          <div>
            <h1>
              Good morning, Linh <span>🍃</span>
            </h1>
            <p>Here’s what’s happening at Luna Spa today.</p>
          </div>

          <div className="spa-search">
            <span>⌕</span>
            <input placeholder="Search customers, appointments, services..." />
          </div>

          <div className="spa-top-actions">
            <button className="spa-circle-btn">🔔</button>
            <button className="spa-circle-btn">📅</button>
            <Link
              className="spa-new-btn"
              to="/receptionist/appointments/create"
            >
              + New Appointment
            </Link>
          </div>
        </header>

        {error && <div className="spa-error">{error}</div>}

        {!stats ? (
          <div className="spa-loading">Đang tải dashboard...</div>
        ) : (
          <>
            <section className="spa-stats">
              <StatCard
                icon="📅"
                title="Today’s Appointments"
                value={stats.todayAppointmentsCount || 0}
                trend="▲ 18% vs yesterday"
              />

              <StatCard
                icon="👤"
                title="Checked In"
                value={stats.checkedInCount || 0}
                trend="▲ 33% vs yesterday"
                type="gold"
              />

              <StatCard
                icon="✓"
                title="Completed"
                value={stats.completedCount || 0}
                trend="▲ 25% vs yesterday"
              />

              <StatCard
                icon="$"
                title="Today’s Revenue"
                value={money(stats.todayRevenue)}
                trend="▲ 12% vs yesterday"
                type="gold"
              />

              <StatCard
                icon="↩"
                title="Refunds Pending"
                value={stats.refundPendingCount || 0}
                trend="▼ 10% vs yesterday"
                type="red"
              />
            </section>

            <section className="spa-main-grid">
              <div className="spa-card spa-appointments-card">
                <div className="spa-card-head">
                  <h3>Today’s Appointments</h3>
                  <Link to="/receptionist/appointments">View Calendar</Link>
                </div>

                <div className="spa-timeline">
                  {appointments.slice(0, 5).map((a) => (
                    <div className="spa-timeline-row" key={a.AppointmentId}>
                      <span className="spa-time">{a.StartTime}</span>
                      <div className="spa-dot" />
                      <div className="spa-avatar">👩</div>
                      <div className="spa-info">
                        <h4>{a.CustomerName}</h4>
                        <p>{a.ServiceName || "Spa Service"}</p>
                      </div>
                      <Badge status={a.Status} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="spa-card spa-checkin-card">
                <div className="spa-card-head">
                  <h3>Check-in Queue</h3>
                  <Link to="/receptionist/appointments">View All</Link>
                </div>

                <div className="spa-queue">
                  {appointments.slice(0, 3).map((a, index) => (
                    <div
                      className="spa-queue-row"
                      key={`queue-${a.AppointmentId}`}
                    >
                      <div className="spa-avatar">👩</div>
                      <div>
                        <h4>{a.CustomerName}</h4>
                        <p>{a.ServiceName || "Spa Service"}</p>
                      </div>
                      <div className="spa-room">
                        <b>
                          {index === 0
                            ? "20 min"
                            : index === 1
                              ? "45 min"
                              : "1h 30m"}
                        </b>
                        <span>Room {index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  className="spa-checkin-btn"
                  to="/receptionist/appointments"
                >
                  Check In Next Customer →
                </Link>
              </div>

              <div className="spa-card spa-calendar-card">
                <div className="spa-card-head">
                  <h3>Calendar</h3>
                  <span>May 2025</span>
                </div>

                <div className="spa-calendar">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                    (d) => (
                      <b key={d}>{d}</b>
                    ),
                  )}
                  {[
                    28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
                    30, 31, 1,
                  ].map((d, i) => (
                    <span key={i} className={d === 14 ? "active" : ""}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="spa-card spa-reminder-card">
                <h3>Upcoming Reminders</h3>

                <div className="spa-reminder">
                  <span>🔔</span>
                  <div>
                    <b>Team Meeting</b>
                    <p>In 30 minutes</p>
                  </div>
                  <small>10:00 AM</small>
                </div>

                <div className="spa-reminder">
                  <span>🔔</span>
                  <div>
                    <b>Product Training</b>
                    <p>In 4 hours</p>
                  </div>
                  <small>02:00 PM</small>
                </div>

                <div className="spa-reminder">
                  <span>🔔</span>
                  <div>
                    <b>Inventory Check</b>
                    <p>In 6 hours</p>
                  </div>
                  <small>04:30 PM</small>
                </div>
              </div>

              <div className="spa-card spa-revenue-card">
                <div className="spa-card-head">
                  <h3>Revenue Overview</h3>
                  <button>This Week⌄</button>
                </div>

                <h2>{money(stats.todayRevenue)}</h2>
                <p className="trend-green">▲ 12% vs last week</p>

                <div className="spa-line-chart">
                  <div className="spa-line-path" />
                  <div className="spa-chart-days">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>
              </div>

              <div className="spa-card spa-services-card">
                <div className="spa-card-head">
                  <h3>Popular Services</h3>
                  <Link to="/receptionist/appointments">View All</Link>
                </div>

                {[
                  ["Hair Cut & Styling", 45],
                  ["Hair Color", 25],
                  ["Hair Treatment", 15],
                  ["Nail Art", 10],
                  ["Facial Care", 5],
                ].map(([name, percent]) => (
                  <div className="spa-service-progress" key={name}>
                    <div>
                      <span>{name}</span>
                      <b>{percent}%</b>
                    </div>
                    <p>
                      <i style={{ width: `${percent}%` }} />
                    </p>
                  </div>
                ))}
              </div>

              <div className="spa-card spa-invoice-card">
                <div className="spa-card-head">
                  <h3>Invoice Summary</h3>
                  <Link to="/receptionist/invoices">View All</Link>
                </div>

                <div className="spa-invoice-row">
                  <span>🧾 Total Invoices</span>
                  <b>{stats.unpaidInvoiceCount + 21 || 28}</b>
                </div>

                <div className="spa-invoice-row">
                  <span>✅ Paid Invoices</span>
                  <b>
                    18 <small>64%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>📄 Unpaid Invoices</span>
                  <b>
                    {stats.unpaidInvoiceCount || 7} <small>25%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>↩ Refunds</span>
                  <b>
                    {stats.refundPendingCount || 2} <small>7%</small>
                  </b>
                </div>

                <div className="spa-total-row">
                  <span>Total Revenue</span>
                  <strong>{money(stats.todayRevenue)}</strong>
                </div>
              </div>

              <div className="spa-card spa-profile-card">
                <h3>Customer Profile</h3>

                <div className="spa-profile-avatar">👩</div>

                <h2>{firstCustomer?.CustomerName || "Minh Anh Nguyễn"}</h2>
                <span className="spa-vip">VIP</span>

                <ul>
                  <li>☎ {firstCustomer?.CustomerPhone || "0901 234 567"}</li>
                  <li>✉ minhanh@gmail.com</li>
                  <li>📅 12 Appointments</li>
                  <li>💰 Total Spent: 8,450,000 VND</li>
                  <li>♕ Member since: 12/08/2024</li>
                </ul>

                <Link to="/receptionist/customers" className="spa-profile-btn">
                  View Full Profile
                </Link>
              </div>

              <div className="spa-card spa-recent-card">
                <div className="spa-card-head">
                  <h3>Recent Appointments</h3>
                  <Link to="/receptionist/appointments">View All</Link>
                </div>

                {appointments.slice(0, 3).map((a) => (
                  <div
                    className="spa-recent-row"
                    key={`recent-${a.AppointmentId}`}
                  >
                    <div className="spa-avatar">👩</div>
                    <div>
                      <h4>{a.CustomerName}</h4>
                      <p>
                        {a.StartTime} · {a.ServiceName || "Spa Service"}
                      </p>
                    </div>
                    <Badge status={a.Status || "COMPLETED"} />
                  </div>
                ))}
              </div>

              <div className="spa-card spa-actions-card">
                <h3>Quick Actions</h3>

                <div className="spa-actions">
                  <Link to="/receptionist/appointments/create">
                    📅
                    <span>Create Appointment</span>
                  </Link>

                  <Link to="/receptionist/appointments?status=CONFIRMED">
                    ✅<span>Check-in Customer</span>
                  </Link>

                  <Link to="/receptionist/appointments/create?walkin=1">
                    🚶
                    <span>Walk-in Customer</span>
                  </Link>

                  <Link to="/receptionist/invoices">
                    🧾
                    <span>Create Invoice</span>
                  </Link>

                  <Link to="/receptionist/waiting-list">
                    ⏳<span>Waiting List</span>
                  </Link>
                </div>
              </div>

              <div className="spa-promo-card">
                <div>
                  <h3>Summer Glow Package</h3>
                  <p>Pamper your skin with our special summer treatments.</p>
                  <button>View Promotion</button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
