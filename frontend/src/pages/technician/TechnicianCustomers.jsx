import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function shortDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function getAvatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function fileUrl(url) {
  return resolveFileUrl(url) || url || "#";
}

function safeText(value, fallback = "N/A") {
  return value === null || value === undefined || value === ""
    ? fallback
    : value;
}

function statusClass(value) {
  return String(value || "unknown").toLowerCase();
}

export default function TechnicianCustomers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [summary, setSummary] = useState({});
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [search, setSearch] = useState("");
  const [membership, setMembership] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [gender, setGender] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [error, setError] = useState("");

  const totalPages = Number(pagination.totalPages || 1);

  const loadSummary = async () => {
    try {
      const res = await axiosClient.get("/technician/customers/summary");
      setSummary(res.data?.data || {});
    } catch (err) {
      console.error("Load customer summary failed:", err);
    }
  };

  const loadCustomers = async () => {
    try {
      setError("");

      const res = await axiosClient.get("/technician/customers", {
        params: {
          page,
          limit: 8,
          search,
          membership,
          status,
          gender,
        },
      });

      const payload = res.data?.data || {};
      setCustomers(payload.customers || []);
      setPagination(payload.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Load customers failed:", err);
      setCustomers([]);
      setError(
        err.response?.data?.message || "Không tải được danh sách khách hàng",
      );
    }
  };

  const loadDetail = async (customerId) => {
    if (!customerId) return;

    try {
      setSelected(customerId);
      setActiveTab("overview");
      setDetailLoading(true);
      setError("");

      const res = await axiosClient.get(`/technician/customers/${customerId}`);
      setDetail(res.data?.data || null);
    } catch (err) {
      console.error("Load customer detail failed:", err);
      setDetail(null);
      setError(
        err.response?.data?.message || "Không tải được chi tiết khách hàng",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);
  useEffect(() => {
    const customerId = searchParams.get("customerId");

    if (customerId) {
      loadDetail(customerId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, membership, status, gender]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  };

  const detailCustomer = detail?.customer || {};
  const preferences = Array.isArray(detail?.preferences)
    ? detail.preferences
    : [];
  const notes = Array.isArray(detail?.notes) ? detail.notes : [];
  const visits = Array.isArray(detail?.visits) ? detail.visits : [];
  const reviews = Array.isArray(detail?.reviews) ? detail.reviews : [];
  const upcoming = Array.isArray(detail?.upcoming) ? detail.upcoming : [];
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  const beautyProfile = detail?.beautyProfile || {};

  const noShowRate = useMemo(() => {
    const total = Number(detailCustomer.TotalVisits || visits.length || 0);
    const noShow = Number(detailCustomer.NoShowCount || 0);
    if (!total) return 0;
    return Math.round((noShow / total) * 100);
  }, [detailCustomer, visits.length]);

  const riskLevel = useMemo(() => {
    if (noShowRate >= 30) return "High";
    if (noShowRate >= 10) return "Medium";
    return "Low";
  }, [noShowRate]);

  const nextAppointment = upcoming[0] || null;

  return (
    <TechnicianLayout>
      <div className="tech-customers-page">
        <header className="tech-page-head customer-page-head">
          <div>
            <h1>
              Customers <span>👥</span>
            </h1>
            <p>Manage customer information, treatment history and insights</p>
          </div>

          <form
            className="tech-search customer-top-search"
            onSubmit={submitSearch}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers, phone, email..."
            />
          </form>

          <button
            type="button"
            className="tech-new-btn"
            onClick={() => navigate("/technician/schedule")}
          >
            View My Schedule
          </button>
        </header>

        <section className="customer-stats">
          <div className="customer-stat-card">
            <span>🏥</span>
            <p>Total Customers</p>
            <h2>{summary.totalCustomers || 0}</h2>
            <small>Assigned to you</small>
          </div>

          <div className="customer-stat-card blue">
            <span>🔄</span>
            <p>Active Customers</p>
            <h2>{summary.activeCustomers || 0}</h2>
            <small>Active accounts</small>
          </div>

          <div className="customer-stat-card gold">
            <span>⭐</span>
            <p>New This Month</p>
            <h2>{summary.newThisMonth || 0}</h2>
            <small>New visits</small>
          </div>

          <div className="customer-stat-card purple">
            <span>💎</span>
            <p>VIP Customers</p>
            <h2>{summary.vipCustomers || 0}</h2>
            <small>Gold / Diamond</small>
          </div>
        </section>

        {error && <div className="customer-error">{error}</div>}

        <section className={`customer-layout ${detail ? "has-detail" : ""}`}>
          <main className="customer-left-col">
            <form className="customer-filter-bar" onSubmit={submitSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers by name, phone, email..."
              />

              <select
                value={membership}
                onChange={(e) => {
                  setMembership(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Membership</option>
                <option value="Normal">Normal</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
              </select>

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="BANNED">Banned</option>
              </select>

              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Gender</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>

              <button type="submit">Search</button>
            </form>

            <div className="customer-table-card">
              <div className="customer-table-title">
                Customer List ({pagination.total || 0})
              </div>

              <div className="customer-table-wrap">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Membership</th>
                      <th>Last Visit</th>
                      <th>Total Visits</th>
                      <th>Total Spent</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="customer-empty-row">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr
                          key={c.CustomerId}
                          className={selected === c.CustomerId ? "active" : ""}
                          onClick={() => loadDetail(c.CustomerId)}
                        >
                          <td>
                            <div className="customer-name-cell">
                              <img
                                src={getAvatar(c.AvatarUrl)}
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_AVATAR;
                                }}
                                alt={c.FullName || "Customer"}
                              />

                              <div>
                                <b>{safeText(c.FullName)}</b>
                                <p>
                                  {safeText(
                                    c.CustomerCode,
                                    `#CUST-${String(c.CustomerId).padStart(
                                      3,
                                      "0",
                                    )}`,
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td>
                            <b>{safeText(c.Phone, "No phone")}</b>
                            <p>{safeText(c.Email, "No email")}</p>
                          </td>

                          <td>
                            <span
                              className={`member-badge ${String(
                                c.MembershipLevel || "normal",
                              ).toLowerCase()}`}
                            >
                              {c.MembershipLevel || "Normal"}
                            </span>
                          </td>

                          <td>{shortDate(c.LastVisit)}</td>
                          <td>{c.TotalVisits || 0}</td>
                          <td>{money(c.TotalSpent)}</td>

                          <td>
                            <span
                              className={`customer-status ${statusClass(
                                c.Status,
                              )}`}
                            >
                              {c.Status || "Active"}
                            </span>
                          </td>

                          <td>
                            <div className="customer-actions">
                              <button
                                type="button"
                                title="View detail"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadDetail(c.CustomerId);
                                }}
                              >
                                👁
                              </button>

                              <button
                                type="button"
                                title="View schedule"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/technician/schedule");
                                }}
                              >
                                📅
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="customer-pagination">
                <span>
                  Showing {customers.length} of {pagination.total || 0}{" "}
                  customers
                </span>

                <div>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>

                  <b>{page}</b>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </main>

          {detail && (
            <aside className="customer-detail-panel">
              {detailLoading ? (
                <div className="empty-customer-detail">
                  <h3>Loading...</h3>
                  <p>Đang tải thông tin khách hàng</p>
                </div>
              ) : (
                <>
                  <div className="customer-detail-head">
                    <h3>Customer Detail</h3>

                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        setSelected(null);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="customer-profile-card">
                    <img
                      src={getAvatar(detailCustomer.AvatarUrl)}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                      alt={detailCustomer.FullName || "Customer"}
                    />

                    <div>
                      <h2>{safeText(detailCustomer.FullName)}</h2>
                      <span>
                        {detailCustomer.MembershipLevel || "Normal Member"}
                      </span>
                      <p>📞 {safeText(detailCustomer.Phone, "No phone")}</p>
                      <p>✉ {safeText(detailCustomer.Email, "No email")}</p>
                      <p>🎂 {shortDate(detailCustomer.DateOfBirth)}</p>
                      <p>📍 {safeText(detailCustomer.Address, "No address")}</p>
                    </div>

                    <div className="customer-id-box">
                      <p>Customer ID</p>
                      <b>{safeText(detailCustomer.CustomerCode)}</b>

                      <p>Total Visits</p>
                      <b>{detailCustomer.TotalVisits || visits.length || 0}</b>

                      <p>Total Spent</p>
                      <b>{money(detailCustomer.TotalSpent)}</b>
                    </div>
                  </div>

                  {nextAppointment && (
                    <div className="customer-upcoming-card">
                      <div>
                        <span>Next Appointment</span>
                        <h4>
                          {shortDate(nextAppointment.AppointmentDate)} •{" "}
                          {nextAppointment.StartTime}
                        </h4>
                        <p>{nextAppointment.ServiceName || "No service"}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/technician/appointments/${nextAppointment.AppointmentId}`,
                          )
                        }
                      >
                        View
                      </button>
                    </div>
                  )}

                  <div className="customer-detail-actions">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                    >
                      View Profile
                    </button>

                    <button
                      type="button"
                      disabled={!detailCustomer.Phone && !detailCustomer.Email}
                      onClick={() => {
                        if (detailCustomer.Phone) {
                          window.location.href = `tel:${detailCustomer.Phone}`;
                        } else if (detailCustomer.Email) {
                          window.location.href = `mailto:${detailCustomer.Email}`;
                        }
                      }}
                    >
                      Contact
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (nextAppointment?.AppointmentId) {
                          navigate(
                            `/technician/appointments/${nextAppointment.AppointmentId}`,
                          );
                        } else {
                          navigate("/technician/treatment-notes");
                        }
                      }}
                    >
                      + Add Treatment Note
                    </button>
                  </div>

                  <div className="customer-tabs">
                    <button
                      type="button"
                      className={activeTab === "overview" ? "active" : ""}
                      onClick={() => setActiveTab("overview")}
                    >
                      Overview
                    </button>

                    <button
                      type="button"
                      className={activeTab === "visits" ? "active" : ""}
                      onClick={() => setActiveTab("visits")}
                    >
                      Visit History
                    </button>

                    <button
                      type="button"
                      className={activeTab === "notes" ? "active" : ""}
                      onClick={() => setActiveTab("notes")}
                    >
                      Notes & Treatment
                    </button>

                    <button
                      type="button"
                      className={activeTab === "timeline" ? "active" : ""}
                      onClick={() => setActiveTab("timeline")}
                    >
                      Timeline
                    </button>

                    <button
                      type="button"
                      className={activeTab === "reviews" ? "active" : ""}
                      onClick={() => setActiveTab("reviews")}
                    >
                      Reviews
                    </button>
                  </div>

                  {activeTab === "overview" && (
                    <div className="customer-detail-grid">
                      <div className="customer-info-card customer-info-main">
                        <h4>Customer Information</h4>

                        <p>
                          <span>Full Name</span>
                          <b>{safeText(detailCustomer.FullName)}</b>
                        </p>

                        <p>
                          <span>Phone</span>
                          <b>{safeText(detailCustomer.Phone)}</b>
                        </p>

                        <p>
                          <span>Email</span>
                          <b>{safeText(detailCustomer.Email)}</b>
                        </p>

                        <p>
                          <span>Date of Birth</span>
                          <b>{shortDate(detailCustomer.DateOfBirth)}</b>
                        </p>

                        <p>
                          <span>Gender</span>
                          <b>{safeText(detailCustomer.Gender)}</b>
                        </p>

                        <p>
                          <span>Address</span>
                          <b>{safeText(detailCustomer.Address)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Beauty Profile</h4>

                        <p>
                          <span>Skin Condition</span>
                          <b>{safeText(beautyProfile.skinCondition)}</b>
                        </p>

                        <p>
                          <span>Products Used</span>
                          <b>{safeText(beautyProfile.productsUsed)}</b>
                        </p>

                        <p>
                          <span>Technique</span>
                          <b>{safeText(beautyProfile.technique)}</b>
                        </p>

                        <p>
                          <span>Recommendation</span>
                          <b>{safeText(beautyProfile.recommendation)}</b>
                        </p>

                        <p>
                          <span>Follow Up</span>
                          <b>{shortDate(beautyProfile.followUpDate)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Membership Information</h4>

                        <div className="membership-box">
                          <b>{detailCustomer.MembershipLevel || "Normal"}</b>
                          <p>
                            Member points: {detailCustomer.LoyaltyPoints || 0}
                          </p>
                        </div>

                        <p>
                          <span>Current Points</span>
                          <b>{detailCustomer.LoyaltyPoints || 0} pts</b>
                        </p>

                        <p>
                          <span>Discount</span>
                          <b>{detailCustomer.DiscountPercent || 0}%</b>
                        </p>

                        <p>
                          <span>Total Spent</span>
                          <b>{money(detailCustomer.TotalSpent)}</b>
                        </p>

                        <p>
                          <span>Average Ticket</span>
                          <b>{money(detailCustomer.AverageTicket)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Customer Risk</h4>

                        <p>
                          <span>No-show Rate</span>
                          <b>{noShowRate}%</b>
                        </p>

                        <p>
                          <span>No-show Count</span>
                          <b>{detailCustomer.NoShowCount || 0}</b>
                        </p>

                        <p>
                          <span>Cancelled Count</span>
                          <b>{detailCustomer.CancelledCount || 0}</b>
                        </p>

                        <p>
                          <span>Risk Level</span>
                          <b>{riskLevel}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Favorite Services</h4>

                        {preferences.length === 0 ? (
                          <p className="muted-line">No favorite services</p>
                        ) : (
                          preferences.map((p, index) => (
                            <p key={`${p.ServiceName}-${index}`}>
                              <span>♡ {p.ServiceName}</span>
                              <b>{p.UsedCount || 0} lần</b>
                            </p>
                          ))
                        )}
                      </div>

                      <div className="customer-info-card quick-stat-card">
                        <h4>Satisfaction Summary</h4>

                        <p>
                          <span>Average Rating</span>
                          <b>
                            ⭐{" "}
                            {Number(detailCustomer.AverageRating || 0).toFixed(
                              1,
                            )}
                          </b>
                        </p>

                        <p>
                          <span>Review Count</span>
                          <b>{detailCustomer.ReviewCount || 0}</b>
                        </p>

                        <p>
                          <span>Last Visit</span>
                          <b>{shortDate(detailCustomer.LastVisit)}</b>
                        </p>

                        <p>
                          <span>Member Since</span>
                          <b>{shortDate(detailCustomer.MemberSince)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Upcoming Appointments</h4>

                        {upcoming.length === 0 ? (
                          <p className="muted-line">No upcoming appointments</p>
                        ) : (
                          upcoming.map((item) => (
                            <div className="mini-note" key={item.AppointmentId}>
                              <b>{item.AppointmentCode}</b>
                              <p>
                                {shortDate(item.AppointmentDate)} •{" "}
                                {item.StartTime} - {item.EndTime}
                              </p>
                              <small>{item.ServiceName || "No service"}</small>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="customer-info-card">
                        <h4>Latest Treatment Notes</h4>

                        {notes.length === 0 ? (
                          <p className="muted-line">No treatment notes</p>
                        ) : (
                          notes.slice(0, 3).map((n, index) => (
                            <div
                              className="mini-note"
                              key={n.NoteId || `${n.CreatedAt}-${index}`}
                            >
                              <b>{n.Title || n.NoteType || "Treatment note"}</b>
                              <p>{n.Content || "No content"}</p>
                              <small>{shortDate(n.CreatedAt)}</small>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "visits" && (
                    <div className="customer-tab-panel">
                      <h4>Visit History</h4>

                      {visits.length === 0 ? (
                        <p className="muted-line">No visit history</p>
                      ) : (
                        <div className="customer-history-list">
                          {visits.map((v, index) => (
                            <div
                              className="history-item"
                              key={v.AppointmentId || index}
                            >
                              <div>
                                <b>
                                  {v.AppointmentCode ||
                                    `#APT-${String(v.AppointmentId).padStart(
                                      3,
                                      "0",
                                    )}`}
                                </b>
                                <p>
                                  {shortDate(v.AppointmentDate)} •{" "}
                                  {safeText(v.StartTime, "--:--")} -{" "}
                                  {safeText(v.EndTime, "--:--")}
                                </p>
                                <p>{v.ServiceName || "No service"}</p>
                              </div>

                              <div>
                                <span
                                  className={`customer-status ${statusClass(
                                    v.Status,
                                  )}`}
                                >
                                  {v.Status || "N/A"}
                                </span>
                                <p>{money(v.FinalAmount)}</p>
                                <small>
                                  Payment: {v.PaymentStatus || "N/A"}
                                </small>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${v.AppointmentId}`,
                                  )
                                }
                              >
                                View Appointment
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "notes" && (
                    <div className="customer-tab-panel">
                      <div className="tab-title-row">
                        <h4>Notes & Treatment</h4>

                        <button
                          type="button"
                          onClick={() =>
                            navigate("/technician/treatment-notes")
                          }
                        >
                          + Add Treatment Note
                        </button>
                      </div>

                      {notes.length === 0 ? (
                        <p className="muted-line">No treatment notes</p>
                      ) : (
                        <div className="customer-history-list">
                          {notes.map((n, index) => (
                            <div
                              className="history-item"
                              key={n.NoteId || `${n.CreatedAt}-${index}`}
                            >
                              <div>
                                <b>
                                  {n.Title || n.NoteType || "Treatment note"}
                                </b>
                                <p>{n.Content || "No content"}</p>

                                <small>
                                  {shortDate(n.CreatedAt)} •{" "}
                                  {n.AppointmentCode || "No appointment code"}
                                </small>

                                {Array.isArray(n.Attachments) &&
                                  n.Attachments.length > 0 && (
                                    <div className="note-attachments">
                                      {n.Attachments.map((file) => (
                                        <a
                                          key={file.AttachmentId}
                                          href={fileUrl(file.FileUrl)}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          📎 {file.FileName}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${n.AppointmentId}`,
                                  )
                                }
                              >
                                View Note
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "timeline" && (
                    <div className="customer-tab-panel">
                      <h4>Customer Timeline</h4>

                      {timeline.length === 0 ? (
                        <p className="muted-line">No timeline data</p>
                      ) : (
                        <div className="customer-history-list">
                          {timeline.map((item, index) => (
                            <div className="history-item" key={index}>
                              <div>
                                <b>
                                  {item.type === "APPOINTMENT" && "📅 "}
                                  {item.type === "NOTE" && "📝 "}
                                  {item.type === "REVIEW" && "⭐ "}
                                  {item.title}
                                </b>
                                <p>{safeText(item.subtitle, "")}</p>
                                <small>{shortDate(item.date)}</small>
                              </div>

                              {item.status && (
                                <span
                                  className={`customer-status ${statusClass(
                                    item.status,
                                  )}`}
                                >
                                  {item.status}
                                </span>
                              )}

                              {item.appointmentId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/technician/appointments/${item.appointmentId}`,
                                    )
                                  }
                                >
                                  View
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "reviews" && (
                    <div className="customer-tab-panel">
                      <h4>Customer Reviews</h4>

                      {reviews.length === 0 ? (
                        <p className="muted-line">No reviews</p>
                      ) : (
                        <div className="customer-history-list">
                          {reviews.map((r, index) => (
                            <div
                              className="history-item"
                              key={r.ReviewId || index}
                            >
                              <div>
                                <b>⭐ {Number(r.Rating || 0).toFixed(1)}</b>
                                <p>{r.Comment || "No comment"}</p>
                                <small>
                                  {r.ServiceName || "Service"} •{" "}
                                  {shortDate(r.CreatedAt)}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
        </section>
      </div>
    </TechnicianLayout>
  );
}
