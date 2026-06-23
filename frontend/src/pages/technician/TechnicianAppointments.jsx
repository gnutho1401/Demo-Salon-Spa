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

const translateStatus = (status) => {
  const statusMap = {
    'PENDING_PAYMENT': 'Chờ thanh toán',
    'PENDING': 'Đang chờ',
    'PAID': 'Đã thanh toán',
    'CONFIRMED': 'Đã xác nhận',
    'CHECKED_IN': 'Đã check-in',
    'IN_PROGRESS': 'Đang thực hiện',
    'COMPLETED': 'Đã hoàn thành',
    'CANCELLED': 'Đã hủy',
    'REFUND_PENDING': 'Chờ hoàn tiền',
    'NO_SHOW': 'Khách không đến'
  };
  return statusMap[String(status).toUpperCase()] || status;
};

function serviceText(value) {
  if (!value) return { main: "Không có", more: "" };

  const list = String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    main: list[0] || "Không có",
    more: list.length > 1 ? `+${list.length - 1} dịch vụ khác` : "",
  };
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
      setError(err.response?.data?.message || "Không thể tải danh sách lịch hẹn");
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
      alert(err.response?.data?.message || "Không thể bắt đầu lịch hẹn");
    }
  };

  const completeAppointment = async (id) => {
    try {
      await axiosClient.patch(`/technician/appointments/${id}/complete`);
      await refreshPage();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể hoàn thành lịch hẹn");
    }
  };

  const markNoShow = async (id) => {
    if (!window.confirm("Đánh dấu khách hàng này không đến (No-show)?")) return;

    try {
      await axiosClient.patch(`/technician/appointments/${id}/no-show`);
      await refreshPage();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể đánh dấu khách không đến");
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
        name: translateStatus(x.Status),
        value: x.Total,
      })),
    [summaryData.statusChart],
  );

  const s = summaryData.summary || {};

  return (
    <TechnicianLayout>
      <div className="tech-appointments-page">
        <header className="tech-page-head" style={{ marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "32px", margin: 0, color: "#1f1a13" }}>Danh sách Lịch hẹn 🗓️</h1>
            <p style={{ margin: "6px 0 0", color: "#6f665b" }}>Xem và xử lý các lịch hẹn chăm sóc làm đẹp được phân công cho bạn</p>
          </div>

          <button
            className="tech-new-btn"
            onClick={() => navigate("/technician/schedule")}
          >
            Xem lịch của tôi
          </button>
        </header>

        <section className="appt-filter-bar" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.5fr", gap: "16px", marginBottom: "24px" }}>
          <div className="appt-filter-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold", color: "#8a7d6b", textTransform: "uppercase", marginBottom: "4px" }}>📅 Khoảng ngày</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                style={{ border: "none", outline: "none", fontWeight: "bold", background: "transparent", color: "#102616", fontSize: "14px" }}
              />
              <span style={{ color: "#8a7d6b" }}>→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                style={{ border: "none", outline: "none", fontWeight: "bold", background: "transparent", color: "#102616", fontSize: "14px" }}
              />
            </div>
          </div>

          <div className="appt-filter-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold", color: "#8a7d6b", textTransform: "uppercase", marginBottom: "4px" }}>🛡 Trạng thái</span>
            <select
              value={status}
              onChange={(e) => {
                setActiveTab("CUSTOM");
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{ border: "none", outline: "none", fontWeight: "bold", background: "transparent", color: "#102616", fontSize: "14px", width: "100%", cursor: "pointer" }}
            >
              {STATUS.map((x) => (
                <option key={x} value={x}>
                  {x === "ALL" ? "Tất cả trạng thái" : translateStatus(x)}
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
            style={{ display: "flex", alignItems: "center", position: "relative" }}
          >
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm khách hàng, số điện thoại, mã lịch hẹn..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontWeight: "bold", color: "#102616", fontSize: "14px" }}
            />
            <button type="submit" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px" }}>🔍</button>
          </form>
        </section>

        <section className="appointments-layout">
          <main>
            <div className="appt-tabs" style={{ display: "flex", gap: "8px", background: "rgba(255, 252, 246, 0.85)", borderRadius: "18px 18px 0 0", padding: "10px", borderBottom: "none" }}>
              <button
                className={activeTab === "ALL" ? "active" : ""}
                onClick={() => {
                  setActiveTab("ALL");
                  setStatus("ALL");
                  setPage(1);
                }}
              >
                Tất cả lịch hẹn <span style={{ marginLeft: "6px", background: activeTab === "ALL" ? "rgba(255,255,255,0.2)" : "#efe3c4", color: activeTab === "ALL" ? "white" : "#173516", padding: "2px 8px", borderRadius: "999px", fontSize: "12px" }}>{pagination.total || 0}</span>
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
                Hôm nay
              </button>

              <button
                className={activeTab === "IN_PROGRESS" ? "active" : ""}
                onClick={() => {
                  setActiveTab("IN_PROGRESS");
                  setStatus("IN_PROGRESS");
                  setPage(1);
                }}
              >
                Đang thực hiện
              </button>

              <button
                className={activeTab === "COMPLETED" ? "active" : ""}
                onClick={() => {
                  setActiveTab("COMPLETED");
                  setStatus("COMPLETED");
                  setPage(1);
                }}
              >
                Đã hoàn thành
              </button>
            </div>

            {error && <div className="tech-error">{error}</div>}

            <div className="appointments-table-card" style={{ background: "rgba(255, 252, 246, 0.96)", border: "1px solid rgba(222, 203, 166, 0.55)", borderRadius: "0 0 22px 22px", boxShadow: "0 16px 35px rgba(95, 72, 35, 0.08)", overflow: "hidden" }}>
              <table className="appointments-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(244, 234, 218, 0.3)" }}>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Mã lịch hẹn</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Khách hàng</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Dịch vụ</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Thời gian</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Trạng thái</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Thời lượng</th>
                    <th style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#6f665b" }}>Đang tải lịch hẹn...</td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#6f665b" }}>Không tìm thấy lịch hẹn nào trong thời gian này</td>
                    </tr>
                  ) : (
                    appointments.map((a) => {
                      const service = serviceText(a.ServiceName);

                      return (
                        <tr key={a.AppointmentId} style={{ transition: "all 0.2s ease" }}>
                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <div className="appt-code-cell">
                              <span style={{ fontSize: "18px" }}>📅</span>
                              <div>
                                <b style={{ color: "#102616" }}>
                                  {a.AppointmentCode || `#APT-${a.AppointmentId}`}
                                </b>
                                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6f665b" }}>{String(a.StartTime || "").slice(0, 5)}</p>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <div className="appt-customer-cell">
                              <div className="appt-avatar">
                                <img
                                  src={avatar(a.CustomerAvatar)}
                                  alt={a.CustomerName || "Khách hàng"}
                                  style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                                  onError={(e) => {
                                    e.currentTarget.src = DEFAULT_AVATAR;
                                  }}
                                />
                              </div>

                              <div>
                                <b style={{ color: "#102616" }}>{a.CustomerName || "Khách vãng lai"}</b>
                                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6f665b" }}>{a.CustomerPhone || "Không có SĐT"}</p>
                                <small style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", background: "#f5e5c7", color: "#8b651e", padding: "2px 6px", borderRadius: "6px" }}>
                                  {a.MembershipLevel || "Hội viên thường"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <b style={{ color: "#102616" }}>{service.main}</b>
                            {service.more && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#8b651e" }}>{service.more}</p>}
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <b style={{ color: "#102616" }}>
                              {safeDateString(a.AppointmentDate)}
                            </b>
                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6f665b" }}>
                              {String(a.StartTime || "").slice(0, 5)} -{" "}
                              {String(a.EndTime || "").slice(0, 5)}
                            </p>
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <span
                              className={`appt-status ${statusClass(a.Status)}`}
                            >
                              {translateStatus(a.Status)}
                            </span>
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca", color: "#102616", fontWeight: "bold" }}>
                            ⏱ {a.DurationMinutes || 0} phút
                          </td>

                          <td style={{ padding: "16px", borderBottom: "1px solid #eadfca" }}>
                            <div className="appt-actions" style={{ display: "flex", gap: "6px" }}>
                              <button
                                title="Chi tiết lịch hẹn"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${a.AppointmentId}`,
                                  )
                                }
                                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #eadfca", background: "white", cursor: "pointer", transition: "all 0.2s" }}
                              >
                                👁
                              </button>

                              {["CONFIRMED", "PAID", "CHECKED_IN"].includes(
                                a.Status,
                              ) && (
                                <button
                                  title="Bắt đầu dịch vụ"
                                  onClick={() =>
                                    startAppointment(a.AppointmentId)
                                  }
                                  style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", background: "#24431f", color: "white", cursor: "pointer", transition: "all 0.2s" }}
                                >
                                  ▶
                                </button>
                              )}

                              {a.Status === "IN_PROGRESS" && (
                                <button
                                  title="Hoàn thành dịch vụ"
                                  onClick={() =>
                                    completeAppointment(a.AppointmentId)
                                  }
                                  style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", background: "#e5aa3d", color: "white", cursor: "pointer", transition: "all 0.2s" }}
                                >
                                  ✅
                                </button>
                              )}

                              {["CONFIRMED", "PAID", "CHECKED_IN"].includes(
                                a.Status,
                              ) && (
                                <button
                                  title="Khách không đến"
                                  onClick={() => markNoShow(a.AppointmentId)}
                                  style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #e46d5b", background: "#fff8f6", color: "#c73628", cursor: "pointer", transition: "all 0.2s" }}
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

              <div className="appt-pagination" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderTop: "1px solid #eadfca" }}>
                <span style={{ fontSize: "14px", color: "#6f665b" }}>
                  Hiển thị {appointments.length} trên tổng số {pagination.total || 0}{" "}
                  lịch hẹn
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #eadfca", background: "white", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}
                  >
                    ‹
                  </button>

                  <b style={{ padding: "6px 12px", borderRadius: "8px", background: "#173516", color: "white", minWidth: "32px", textAlign: "center" }}>{page}</b>

                  <button
                    disabled={page >= (pagination.totalPages || 1)}
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(prev + 1, pagination.totalPages || 1),
                      )
                    }
                    style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #eadfca", background: "white", cursor: page >= (pagination.totalPages || 1) ? "not-allowed" : "pointer", opacity: page >= (pagination.totalPages || 1) ? 0.5 : 1 }}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </main>

          <aside className="appointments-side" style={{ display: "grid", gap: "18px" }}>
            <div className="appt-side-card" style={{ background: "rgba(255, 252, 246, 0.96)", border: "1px solid rgba(222, 203, 166, 0.55)", borderRadius: "22px", padding: "20px", boxShadow: "0 16px 35px rgba(95, 72, 35, 0.08)" }}>
              <div className="side-title" style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Tóm tắt lịch hẹn</h3>
                <span style={{ fontSize: "12px", color: "#8b651e" }}>Thời gian chọn</span>
              </div>

              <div className="summary-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ background: "#faf4e9", padding: "14px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "20px" }}>📅</span>
                  <b style={{ display: "block", fontSize: "22px", margin: "6px 0 2px" }}>{s.totalAppointments || 0}</b>
                  <p style={{ margin: 0, fontSize: "12px", color: "#756a5c" }}>Tổng số lịch hẹn</p>
                </div>

                <div style={{ background: "#faf4e9", padding: "14px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "20px" }}>🔄</span>
                  <b style={{ display: "block", fontSize: "22px", margin: "6px 0 2px" }}>{s.inProgress || 0}</b>
                  <p style={{ margin: 0, fontSize: "12px", color: "#756a5c" }}>Đang thực hiện</p>
                </div>

                <div style={{ background: "#faf4e9", padding: "14px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "20px" }}>✅</span>
                  <b style={{ display: "block", fontSize: "22px", margin: "6px 0 2px" }}>{s.completed || 0}</b>
                  <p style={{ margin: 0, fontSize: "12px", color: "#756a5c" }}>Đã hoàn thành</p>
                </div>

                <div style={{ background: "#faf4e9", padding: "14px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "20px" }}>🚫</span>
                  <b style={{ display: "block", fontSize: "22px", margin: "6px 0 2px" }}>{s.noShow || 0}</b>
                  <p style={{ margin: 0, fontSize: "12px", color: "#756a5c" }}>Khách không đến</p>
                </div>
              </div>
            </div>

            <div className="appt-side-card" style={{ background: "rgba(255, 252, 246, 0.96)", border: "1px solid rgba(222, 203, 166, 0.55)", borderRadius: "22px", padding: "20px", boxShadow: "0 16px 35px rgba(95, 72, 35, 0.08)" }}>
              <div className="side-title" style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Trạng thái tổng quan</h3>
                <span style={{ fontSize: "12px", color: "#8b651e" }}>Biểu đồ</span>
              </div>

              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={50}
                      outerRadius={75}
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
                    <Tooltip formatter={(value, name) => [value, `Lịch hẹn: ${name}`]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: "center", color: "#6f665b", padding: "30px 0" }}>Chưa có dữ liệu trạng thái</p>
              )}
            </div>

            <div className="appt-side-card" style={{ background: "rgba(255, 252, 246, 0.96)", border: "1px solid rgba(222, 203, 166, 0.55)", borderRadius: "22px", padding: "20px", boxShadow: "0 16px 35px rgba(95, 72, 35, 0.08)" }}>
              <div className="side-title" style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px" }}>Dịch vụ ưa chuộng</h3>
                <span style={{ fontSize: "12px", color: "#8b651e" }}>Liệu trình hot</span>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {(summaryData.popularServices || []).length === 0 ? (
                  <p style={{ textAlign: "center", color: "#6f665b", padding: "20px 0" }}>Chưa có số liệu dịch vụ</p>
                ) : (
                  (summaryData.popularServices || []).map((item) => (
                    <div className="popular-service-row" key={item.ServiceName} style={{ display: "grid", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#102616", fontWeight: "bold" }}>✿ {item.ServiceName}</span>
                        <span style={{ color: "#6f665b" }}>{item.Total} lịch hẹn</span>
                      </div>

                      <div className="popular-bar" style={{ height: "6px", background: "#eee4d2", borderRadius: "10px", overflow: "hidden" }}>
                        <i
                          style={{
                            display: "block",
                            height: "100%",
                            background: "#456b35",
                            width: `${Math.min(Number(item.Total || 0) * 15, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="appt-side-card" style={{ background: "rgba(255, 252, 246, 0.96)", border: "1px solid rgba(222, 203, 166, 0.55)", borderRadius: "22px", padding: "20px", boxShadow: "0 16px 35px rgba(95, 72, 35, 0.08)" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>Hành động nhanh</h3>

              <div className="appt-quick-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button 
                  onClick={() => navigate("/technician/schedule")}
                  style={{ border: "none", background: "#f4ead7", color: "#173516", fontWeight: "bold", padding: "14px", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  📅 Lịch làm việc
                </button>

                <button
                  onClick={() => {
                    setActiveTab("READY");
                    setStatus("CHECKED_IN");
                    setPage(1);
                  }}
                  style={{ border: "none", background: "#f4ead7", color: "#173516", fontWeight: "bold", padding: "14px", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  ✅ Sẵn sàng làm
                </button>

                <button
                  onClick={() => {
                    setActiveTab("IN_PROGRESS");
                    setStatus("IN_PROGRESS");
                    setPage(1);
                  }}
                  style={{ border: "none", background: "#f4ead7", color: "#173516", fontWeight: "bold", padding: "14px", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  🔄 Đang làm
                </button>

                <button 
                  onClick={() => navigate("/technician/customers")}
                  style={{ border: "none", background: "#f4ead7", color: "#173516", fontWeight: "bold", padding: "14px", borderRadius: "14px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  🔎 Tìm khách hàng
                </button>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </TechnicianLayout>
  );
}

function safeDateString(val) {
  if (!val) return "—";
  const date = new Date(val);
  if (isNaN(date.getTime())) return String(val).slice(0, 10);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
