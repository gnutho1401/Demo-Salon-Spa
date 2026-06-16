import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatar(url) {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return resolveFileUrl(url);
  return resolveFileUrl(`/${url}`);
}

const STATUS = [
  "ALL",
  "PENDING_PAYMENT",
  "PENDING",
  "PAID",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "NO_SHOW",
];

function serviceText(value) {
  if (!value) return { main: "N/A", more: "" };

  const list = String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    main: list[0] || "N/A",
    more: list.length > 1 ? `+${list.length - 1} services` : "",
  };
}

function statusText(status) {
  const map = {
    PENDING_PAYMENT: "Pending Payment",
    PENDING: "Pending",
    PAID: "Paid",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked In",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REFUND_PENDING: "Refund Pending",
    NO_SHOW: "No Show",
  };

  return map[status] || "N/A";
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replaceAll("_", "-");
}

export default function TechnicianAppointments() {
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [summaryData, setSummaryData] = useState({
    summary: {},
    statusChart: [],
    popularServices: [],
  });

  const [status, setStatus] = useState("ALL");
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAppointments = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axiosClient.get("/technician/appointments", {
        params: {
          page,
          limit: 8,
          status,
          search: search.trim(),
          startDate,
          endDate,
        },
      });

      setAppointments(res.data.data.appointments || []);
      setPagination(
        res.data.data.pagination || {
          page: 1,
          totalPages: 1,
          total: 0,
        },
      );
    } catch (err) {
      setAppointments([]);
      setError(err.response?.data?.message || "Cannot load appointments");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await axiosClient.get("/technician/appointments/summary", {
        params: { startDate, endDate },
      });

      setSummaryData(
        res.data.data || {
          summary: {},
          statusChart: [],
          popularServices: [],
        },
      );
    } catch {
      setSummaryData({
        summary: {},
        statusChart: [],
        popularServices: [],
      });
    }
  };

  const refreshPage = async () => {
    await loadAppointments();
    await loadSummary();
  };

  const startAppointment = async (id) => {
    try {
      await axiosClient.patch(`/technician/appointments/${id}/start`);
      await refreshPage();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot start appointment");
    }
  };

  const completeAppointment = async (id) => {
    try {
      await axiosClient.patch(`/technician/appointments/${id}/complete`);
      await refreshPage();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot complete appointment");
    }
  };

  const markNoShow = async (id) => {
    if (!window.confirm("Mark this appointment as no-show?")) return;

    try {
      await axiosClient.patch(`/technician/appointments/${id}/no-show`);
      await refreshPage();
    } catch (err) {
      alert(err.response?.data?.message || "Cannot mark no-show");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAppointments();
      loadSummary();
    }, 300);

    return () => clearTimeout(timer);
  }, [page, status, search, startDate, endDate]);

  const pieData = useMemo(
    () =>
      (summaryData.statusChart || []).map((x) => ({
        name: x.Status,
        value: x.Total,
      })),
    [summaryData.statusChart],
  );

  const s = summaryData.summary || {};

  return (
    <TechnicianLayout>
      <div className="tech-appointments-page">
        <header className="tech-page-head">
          <div>
            <h1>Appointments 🗓️</h1>
            <p>View and process your assigned service appointments</p>
          </div>

          <button
            className="tech-new-btn"
            onClick={() => navigate("/technician/schedule")}
          >
            View My Schedule
          </button>
        </header>

        <section className="appt-filter-bar">
          <div className="appt-filter-card">
            <span>📅 Date Range</span>
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
              <b>→</b>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="appt-filter-card">
            <span>🛡 Status</span>
            <select
              value={status}
              onChange={(e) => {
                setActiveTab("CUSTOM");
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS.map((x) => (
                <option key={x} value={x}>
                  {x === "ALL" ? "All Status" : statusText(x)}
                </option>
              ))}
            </select>
          </div>

          <form
            className="appt-search-card"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              loadAppointments();
            }}
          >
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, phone, code..."
            />
            <button type="submit">🔍</button>
          </form>
        </section>

        <section className="appointments-layout">
          <main>
            <div className="appt-tabs">
              <button
                className={activeTab === "ALL" ? "active" : ""}
                onClick={() => {
                  setActiveTab("ALL");
                  setStatus("ALL");
                  setPage(1);
                }}
              >
                All Appointments <span>{pagination.total || 0}</span>
              </button>

              <button
                className={activeTab === "TODAY" ? "active" : ""}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setActiveTab("TODAY");
                  setStartDate(today);
                  setEndDate(today);
                  setStatus("ALL");
                  setPage(1);
                }}
              >
                Today
              </button>

              <button
                className={activeTab === "IN_PROGRESS" ? "active" : ""}
                onClick={() => {
                  setActiveTab("IN_PROGRESS");
                  setStatus("IN_PROGRESS");
                  setPage(1);
                }}
              >
                In Progress
              </button>

              <button
                className={activeTab === "COMPLETED" ? "active" : ""}
                onClick={() => {
                  setActiveTab("COMPLETED");
                  setStatus("COMPLETED");
                  setPage(1);
                }}
              >
                Completed
              </button>
            </div>

            {error && <div className="tech-error">{error}</div>}

            <div className="appointments-table-card">
              <table className="appointments-table">
                <thead>
                  <tr>
                    <th>Appointment</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7">Loading...</td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan="7">No appointments found</td>
                    </tr>
                  ) : (
                    appointments.map((a) => {
                      const service = serviceText(a.ServiceName);

                      return (
                        <tr key={a.AppointmentId}>
                          <td>
                            <div className="appt-code-cell">
                              <span>📅</span>
                              <div>
                                <b>
                                  {a.AppointmentCode || `#${a.AppointmentId}`}
                                </b>
                                <p>{String(a.StartTime || "").slice(0, 5)}</p>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="appt-customer-cell">
                              <div className="appt-avatar">
                                <img
                                  src={avatar(a.CustomerAvatar)}
                                  alt={a.CustomerName || "Customer"}
                                  onError={(e) => {
                                    e.currentTarget.src = DEFAULT_AVATAR;
                                  }}
                                />
                              </div>

                              <div>
                                <b>{a.CustomerName || "Unknown Customer"}</b>
                                <p>{a.CustomerPhone || "No phone"}</p>
                                <small>
                                  {a.MembershipLevel || "Normal Member"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <b>{service.main}</b>
                            {service.more && <p>{service.more}</p>}
                          </td>

                          <td>
                            <b>
                              {String(a.AppointmentDate || "").slice(0, 10)}
                            </b>
                            <p>
                              {String(a.StartTime || "").slice(0, 5)} -{" "}
                              {String(a.EndTime || "").slice(0, 5)}
                            </p>
                          </td>

                          <td>
                            <span
                              className={`appt-status ${statusClass(a.Status)}`}
                            >
                              {statusText(a.Status)}
                            </span>
                          </td>

                          <td>⏱ {a.DurationMinutes || 0} min</td>

                          <td>
                            <div className="appt-actions">
                              <button
                                title="View"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${a.AppointmentId}`,
                                  )
                                }
                              >
                                👁
                              </button>

                              {["CONFIRMED", "PAID", "CHECKED_IN"].includes(
                                a.Status,
                              ) && (
                                <button
                                  title="Start"
                                  onClick={() =>
                                    startAppointment(a.AppointmentId)
                                  }
                                >
                                  ▶
                                </button>
                              )}

                              {a.Status === "IN_PROGRESS" && (
                                <button
                                  title="Complete"
                                  onClick={() =>
                                    completeAppointment(a.AppointmentId)
                                  }
                                >
                                  ✅
                                </button>
                              )}

                              {["CONFIRMED", "PAID", "CHECKED_IN"].includes(
                                a.Status,
                              ) && (
                                <button
                                  title="No Show"
                                  onClick={() => markNoShow(a.AppointmentId)}
                                >
                                  🚫
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="appt-pagination">
                <span>
                  Showing {appointments.length} of {pagination.total || 0}{" "}
                  appointments
                </span>

                <div>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  >
                    ‹
                  </button>

                  <b>{page}</b>

                  <button
                    disabled={page >= (pagination.totalPages || 1)}
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(prev + 1, pagination.totalPages || 1),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </main>

          <aside className="appointments-side">
            <div className="appt-side-card">
              <div className="side-title">
                <h3>Appointment Summary</h3>
                <span>Selected Range</span>
              </div>

              <div className="summary-grid">
                <div>
                  <span>📅</span>
                  <b>{s.totalAppointments || 0}</b>
                  <p>Total Appointments</p>
                </div>

                <div>
                  <span>🔄</span>
                  <b>{s.inProgress || 0}</b>
                  <p>In Progress</p>
                </div>

                <div>
                  <span>✅</span>
                  <b>{s.completed || 0}</b>
                  <p>Completed</p>
                </div>

                <div>
                  <span>🚫</span>
                  <b>{s.noShow || 0}</b>
                  <p>No Show</p>
                </div>
              </div>
            </div>

            <div className="appt-side-card">
              <div className="side-title">
                <h3>Status Overview</h3>
                <span>Selected Range</span>
              </div>

              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          [
                            "#315a2a",
                            "#e5aa3d",
                            "#6aa8df",
                            "#a8b98a",
                            "#df6b57",
                          ][i % 5]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="appt-side-card">
              <div className="side-title">
                <h3>Popular Services</h3>
                <span>Selected Range</span>
              </div>

              {(summaryData.popularServices || []).length === 0 ? (
                <p>No service data</p>
              ) : (
                (summaryData.popularServices || []).map((item) => (
                  <div className="popular-service-row" key={item.ServiceName}>
                    <div>
                      <span>✿</span>
                      <b>{item.ServiceName}</b>
                      <p>{item.Total} appointments</p>
                    </div>

                    <div className="popular-bar">
                      <i
                        style={{
                          width: `${Math.min(Number(item.Total || 0) * 15, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="appt-side-card">
              <h3>Quick Actions</h3>

              <div className="appt-quick-actions">
                <button onClick={() => navigate("/technician/schedule")}>
                  📅 My Schedule
                </button>

                <button
                  onClick={() => {
                    setActiveTab("READY");
                    setStatus("CHECKED_IN");
                    setPage(1);
                  }}
                >
                  ✅ Ready To Start
                </button>

                <button
                  onClick={() => {
                    setActiveTab("IN_PROGRESS");
                    setStatus("IN_PROGRESS");
                    setPage(1);
                  }}
                >
                  🔄 In Progress
                </button>

                <button onClick={() => navigate("/technician/customers")}>
                  🔎 Customer Search
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </TechnicianLayout>
  );
}
