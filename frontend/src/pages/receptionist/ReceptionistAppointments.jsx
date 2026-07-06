import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const statusOptions = [
  "",
  "PENDING_PAYMENT",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "NO_SHOW",
];

const paymentOptions = [
  "",
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
];

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const STATUS_CONFIGS = {
  PENDING_PAYMENT: { text: "Chờ thanh toán", color: "#f59e0b", bg: "#fffbeb" },
  PENDING: { text: "Đang chờ duyệt", color: "#d97706", bg: "#fef3c7" },
  CONFIRMED: { text: "Đã xác nhận", color: "#3b82f6", bg: "#eff6ff" },
  CHECKED_IN: { text: "Đã check-in", color: "#8b5cf6", bg: "#f5f3ff" },
  IN_PROGRESS: { text: "Đang làm", color: "#06b6d4", bg: "#ecfeff" },
  COMPLETED: { text: "Hoàn thành", color: "#10b981", bg: "#ecfdf5" },
  CANCELLED: { text: "Đã hủy", color: "#6b7280", bg: "#f3f4f6" },
  REFUND_PENDING: { text: "Chờ hoàn tiền", color: "#ec4899", bg: "#fdf2f8" },
  NO_SHOW: { text: "Không đến", color: "#ef4444", bg: "#fef2f2" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIGS[status] || { text: status, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.text}
    </span>
  );
}

const PAYMENT_CONFIGS = {
  UNPAID: { text: "Chưa thanh toán", color: "#ef4444", bg: "#fef2f2" },
  PENDING: { text: "Đang xử lý", color: "#f59e0b", bg: "#fffbeb" },
  PAID: { text: "Đã thanh toán", color: "#10b981", bg: "#ecfdf5" },
  FAILED: { text: "Thất bại", color: "#ef4444", bg: "#fef2f2" },
  REFUND_PENDING: { text: "Chờ hoàn tiền", color: "#ec4899", bg: "#fdf2f8" },
  REFUNDED: { text: "Đã hoàn tiền", color: "#6b7280", bg: "#f3f4f6" },
};

function PaymentStatusBadge({ status }) {
  const cfg = PAYMENT_CONFIGS[status] || { text: status || "Chưa thanh toán", color: "#ef4444", bg: "#fef2f2" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.text}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

export default function ReceptionistAppointments() {
  const [items, setItems] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [services, setServices] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);

  // Default to today's date for daily operations
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [filters, setFilters] = useState({
    customer: "",
    date: todayStr,
    status: "",
    technicianId: "",
    serviceId: "",
    paymentStatus: "",
  });

  const [activeTab, setActiveTab] = useState("ALL");

  async function load(nextFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const params = {
        customer: nextFilters.customer || undefined,
        date: nextFilters.date || undefined,
        status: nextFilters.status || undefined,
        technicianId: nextFilters.technicianId || undefined,
        serviceId: nextFilters.serviceId || undefined,
        paymentStatus: nextFilters.paymentStatus || undefined,
      };

      const res = await axiosClient.get("/receptionist/appointments", {
        params,
      });

      const data = res.data.data || res.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được danh sách lịch hẹn");
    } finally {
      setLoading(false);
    }
  }

  async function loadTechnicians() {
    try {
      const res = await axiosClient.get("/receptionist/technicians");
      setTechnicians(res.data.data || res.data || []);
    } catch {
      setTechnicians([]);
    }
  }

  async function loadServices() {
    try {
      const res = await axiosClient.get("/receptionist/services");
      setServices(res.data.data || res.data || []);
    } catch {
      setServices([]);
    }
  }

  useEffect(() => {
    load();
    loadTechnicians();
    loadServices();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      today: items.filter((x) => String(x.AppointmentDate || "").slice(0, 10) === todayStr).length,
      pending: items.filter((x) => ["PENDING", "PENDING_PAYMENT"].includes(x.Status)).length,
      confirmed: items.filter((x) => x.Status === "CONFIRMED").length,
      checkedIn: items.filter((x) => x.Status === "CHECKED_IN").length,
      inProgress: items.filter((x) => x.Status === "IN_PROGRESS").length,
      completed: items.filter((x) => x.Status === "COMPLETED").length,
      cancelled: items.filter((x) => ["CANCELLED", "NO_SHOW", "REFUND_PENDING"].includes(x.Status)).length,
    };
  }, [items, todayStr]);

  const filteredItems = useMemo(() => {
    if (activeTab === "ALL") return items;
    if (activeTab === "PENDING") {
      return items.filter((x) => ["PENDING", "PENDING_PAYMENT"].includes(x.Status));
    }
    if (activeTab === "CONFIRMED") {
      return items.filter((x) => x.Status === "CONFIRMED");
    }
    if (activeTab === "CHECKED_IN") {
      return items.filter((x) => x.Status === "CHECKED_IN");
    }
    if (activeTab === "IN_PROGRESS") {
      return items.filter((x) => x.Status === "IN_PROGRESS");
    }
    if (activeTab === "COMPLETED") {
      return items.filter((x) => x.Status === "COMPLETED");
    }
    if (activeTab === "OTHER") {
      return items.filter((x) => ["CANCELLED", "NO_SHOW", "REFUND_PENDING"].includes(x.Status));
    }
    return items;
  }, [items, activeTab]);

  const onSubmit = (e) => {
    e.preventDefault();
    load(filters);
  };

  const resetFilters = () => {
    const reset = {
      customer: "",
      date: "",
      status: "",
      technicianId: "",
      serviceId: "",
      paymentStatus: "",
    };

    setFilters(reset);
    load(reset);
  };

  /* Action Handlers */
  const handleConfirm = async (id) => {
    if (!window.confirm(`Xác nhận lịch hẹn #${id}?`)) return;
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/confirm`);
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  const handleCheckIn = async (id) => {
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/check-in`);
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  const handleStart = async (id) => {
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/start`);
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (id) => {
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/complete`);
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  const handleNoShow = async (id) => {
    if (!window.confirm("Đánh dấu khách hàng vắng mặt (No-Show)?")) return;
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/no-show`);
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt("Nhập lý do hủy lịch hẹn:", "Khách yêu cầu hủy trực tiếp");
    if (reason === null) return;
    setActionId(id);
    try {
      await axiosClient.put(`/receptionist/appointments/${id}/cancel`, { reason });
      await load();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setActionId(null);
    }
  };

  return (
    <ReceptionistLayout>
      <div className="rx-page" style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px" }}>
        <div className="rx-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div className="rx-title-block" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="rx-title-icon" style={{ fontSize: "2rem" }}>📅</div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#3d2e26", margin: 0 }}>Lịch hẹn làm đẹp</h1>
              <p style={{ margin: "4px 0 0 0", color: "#7c6f68", fontSize: "0.9rem" }}>Điều phối, Check-in, Bắt đầu liệu trình và Quản lý lịch khách hàng</p>
            </div>
          </div>

          <div className="rx-header-actions" style={{ display: "flex", gap: 10 }}>
            <Link
              className="rx-primary-btn"
              to="/receptionist/appointments/create"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, padding: "10px 18px", borderRadius: 12, background: "#a0573a", color: "#fff", textDecoration: "none", fontSize: "0.9rem" }}
            >
              ➕ Lên lịch mới
            </Link>

            <Link
              className="rx-light-btn"
              to="/receptionist/appointments/create?walkin=1"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, padding: "10px 18px", borderRadius: 12, border: "1px solid #d4c4b8", background: "#fff", color: "#3d2e26", textDecoration: "none", fontSize: "0.9rem" }}
            >
              🚶 Khách Walk-in
            </Link>
          </div>
        </div>

        {/* Filter Card */}
        <form onSubmit={onSubmit} className="rx-filter-card" style={{ background: "#fff", border: "1px solid #f4e7dd", borderRadius: 14, padding: 18, marginBottom: 24 }}>
          <div className="rx-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6f68" }}>Tìm khách hàng</span>
              <input
                placeholder="Nhập tên, SĐT..."
                value={filters.customer}
                onChange={(e) => setFilters((p) => ({ ...p, customer: e.target.value }))}
                style={{ border: "1px solid #d4c4b8", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 13 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6f68" }}>Ngày hẹn</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))}
                style={{ border: "1px solid #d4c4b8", borderRadius: 10, padding: "8px 12px", outline: "none", fontSize: 13 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6f68" }}>Kỹ thuật viên (KTV)</span>
              <select
                value={filters.technicianId}
                onChange={(e) => setFilters((p) => ({ ...p, technicianId: e.target.value }))}
                style={{ border: "1px solid #d4c4b8", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 13, background: "#fff" }}
              >
                <option value="">Tất cả KTV</option>
                {technicians.map((t) => {
                  const id = t.TechnicianId || t.EmployeeId;
                  return (
                    <option key={id} value={id}>
                      {t.FullName || t.TechnicianName}
                    </option>
                  );
                })}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6f68" }}>Dịch vụ</span>
              <select
                value={filters.serviceId}
                onChange={(e) => setFilters((p) => ({ ...p, serviceId: e.target.value }))}
                style={{ border: "1px solid #d4c4b8", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 13, background: "#fff" }}
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6f68" }}>Thanh toán</span>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters((p) => ({ ...p, paymentStatus: e.target.value }))}
                style={{ border: "1px solid #d4c4b8", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 13, background: "#fff" }}
              >
                {paymentOptions.map((s) => (
                  <option key={s || "all-payment"} value={s}>
                    {s ? PAYMENT_CONFIGS[s]?.text || s : "Tất cả trạng thái thanh toán"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={resetFilters}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #d4c4b8", background: "#fff", color: "#3d2e26", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              ↺ Đặt lại bộ lọc
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#a0573a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              {loading ? "Đang tải..." : "⌕ Áp dụng"}
            </button>
          </div>
        </form>

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Tổng lịch", val: stats.total, icon: "📋", bg: "#fcf8f2", border: "#f4e7dd" },
            { label: "Đặt Hôm Nay", val: stats.today, icon: "📆", bg: "#eff6ff", border: "#bfdbfe" },
            { label: "Đang Chờ", val: stats.pending, icon: "⏳", bg: "#fffbeb", border: "#fef3c7" },
            { label: "Đã Xác Nhận", val: stats.confirmed, icon: "✓", bg: "#f0fdf4", border: "#bbf7d0" },
            { label: "Đã Check-in", val: stats.checkedIn, icon: "🎯", bg: "#f5f3ff", border: "#ddd6fe" },
            { label: "Đang Làm", val: stats.inProgress, icon: "⚡", bg: "#ecfeff", border: "#cffafe" },
            { label: "Hoàn Thành", val: stats.completed, icon: "🎉", bg: "#f0fdf4", border: "#bbf7d0" },
            { label: "Hủy/Vắng", val: stats.cancelled, icon: "✕", bg: "#fef2f2", border: "#fecaca" },
          ].map((s, idx) => (
            <div key={idx} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
              <span style={{ fontSize: "1.2rem", display: "block", marginBottom: 6 }}>{s.icon}</span>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#7c6f68" }}>{s.label}</p>
              <b style={{ fontSize: "1.5rem", fontWeight: 800, color: "#3d2e26", display: "block", marginTop: 4 }}>{s.val}</b>
            </div>
          ))}
        </div>

        {/* Categorized Status Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #f4e7dd", marginBottom: 20, gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {[
            { id: "ALL", label: "Tất cả", count: stats.total },
            { id: "PENDING", label: "Chờ duyệt/thanh toán", count: stats.pending, color: "#d97706" },
            { id: "CONFIRMED", label: "Đã xác nhận", count: stats.confirmed, color: "#3b82f6" },
            { id: "CHECKED_IN", label: "Đã check-in", count: stats.checkedIn, color: "#8b5cf6" },
            { id: "IN_PROGRESS", label: "Đang làm", count: stats.inProgress, color: "#06b6d4" },
            { id: "COMPLETED", label: "Hoàn thành", count: stats.completed, color: "#10b981" },
            { id: "OTHER", label: "Lịch hủy/Khác", count: stats.cancelled, color: "#ef4444" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderBottom: isActive ? "3px solid #a0573a" : "3px solid transparent",
                  background: "transparent",
                  color: isActive ? "#a0573a" : "#7c6f68",
                  fontWeight: isActive ? 800 : 500,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
                <span
                  style={{
                    background: isActive ? "#a0573a" : "#e5e7eb",
                    color: isActive ? "#fff" : "#4b5563",
                    padding: "2px 7px",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Appointment Table */}
        <div style={{ background: "#fff", border: "1px solid #f4e7dd", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(61,45,26,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: "#fffcf9", borderBottom: "2px solid #f4e7dd" }}>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Lịch hẹn</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Khách hàng</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Kỹ thuật viên</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Dịch vụ</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Thời gian hẹn</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Thanh toán</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68" }}>Trạng thái</th>
                  <th style={{ padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#7c6f68", textAlign: "right" }}>Thao tác điều hành</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((a) => (
                  <tr key={a.AppointmentId} style={{ borderBottom: "1px solid #f4e7dd", transition: "all 0.2s" }} className="rx-table-row">
                    {/* ID */}
                    <td style={{ padding: "14px 18px" }}>
                      <b style={{ color: "#a0573a", fontSize: 13 }}>#{a.AppointmentId}</b>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src={avatarUrl(a.CustomerAvatarUrl)}
                          alt={a.CustomerName}
                          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                        />
                        <div>
                          <b style={{ color: "#3d2e26", fontSize: 13, display: "block" }}>{a.CustomerName || "-"}</b>
                          <small style={{ color: "#7c6f68", fontSize: 11, display: "block", marginTop: 2 }}>{a.CustomerPhone || "-"}</small>
                        </div>
                      </div>
                    </td>

                    {/* Technician */}
                    <td style={{ padding: "14px 18px" }}>
                      {a.TechnicianName ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img
                            src={avatarUrl(a.TechnicianAvatarUrl)}
                            alt={a.TechnicianName}
                            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                          />
                          <span style={{ fontSize: 13, color: "#3d2e26", fontWeight: 500 }}>{a.TechnicianName}</span>
                        </div>
                      ) : (
                        <span style={{ color: "#a08e84", fontSize: 13 }}>—</span>
                      )}
                    </td>

                    {/* Service */}
                    <td style={{ padding: "14px 18px" }}>
                      <b style={{ color: "#3d2e26", fontSize: 13, display: "block" }}>{a.ServiceName || "-"}</b>
                      {a.CustomerPackageId && a.CustomerPackageName && (
                        <div style={{
                          marginTop: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          border: '1px solid #e9d5ff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          📦 Combo: {a.CustomerPackageName}
                        </div>
                      )}
                      {a.FinalAmount !== undefined && (
                        <small style={{ color: "#a0573a", fontWeight: 700, fontSize: 11, display: "block", marginTop: 4 }}>
                          {Number(a.FinalAmount).toLocaleString("vi-VN")} đ
                        </small>
                      )}
                    </td>

                    {/* DateTime */}
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#3d2e26", display: "block" }}>
                        {formatDate(a.AppointmentDate)}
                      </span>
                      <small style={{ color: "#7c6f68", fontSize: 11, display: "block", marginTop: 2 }}>
                        {a.StartTime} - {a.EndTime}
                      </small>
                    </td>

                    {/* Payment */}
                    <td style={{ padding: "14px 18px" }}>
                      <PaymentStatusBadge status={a.PaymentStatus} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px 18px" }}>
                      <StatusBadge status={a.Status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {actionId === a.AppointmentId ? (
                          <span style={{ fontSize: 12, color: "#7c6f68", fontWeight: 600 }}>Đang xử lý...</span>
                        ) : (
                          <>
                            {/* CONFIRM ACTION */}
                            {["PENDING", "PENDING_PAYMENT"].includes(a.Status) && (
                              <button
                                onClick={() => handleConfirm(a.AppointmentId)}
                                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                ✓ Duyệt
                              </button>
                            )}

                            {/* CHECK IN ACTION */}
                            {a.Status === "CONFIRMED" && (
                              <button
                                onClick={() => handleCheckIn(a.AppointmentId)}
                                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                🎯 Check-in
                              </button>
                            )}

                            {/* START ACTION */}
                            {a.Status === "CHECKED_IN" && (
                              <button
                                onClick={() => handleStart(a.AppointmentId)}
                                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                ⚡ Bắt đầu
                              </button>
                            )}

                            {/* COMPLETE ACTION */}
                            {a.Status === "IN_PROGRESS" && (
                              <button
                                onClick={() => handleComplete(a.AppointmentId)}
                                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                🎉 Xong
                              </button>
                            )}

                            {/* NO-SHOW / CANCEL FOR FUTURE APPOINTMENTS */}
                            {["PENDING", "PENDING_PAYMENT", "CONFIRMED"].includes(a.Status) && (
                              <>
                                <button
                                  onClick={() => handleNoShow(a.AppointmentId)}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                  title="Đánh dấu vắng mặt"
                                >
                                  No-Show
                                </button>
                                <button
                                  onClick={() => handleCancel(a.AppointmentId)}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                                  title="Hủy lịch hẹn"
                                >
                                  ✕ Hủy
                                </button>
                              </>
                            )}

                            {/* DETAIL */}
                            <Link
                              to={`/receptionist/appointments/${a.AppointmentId}`}
                              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d4c4b8", background: "#fff", color: "#3d2e26", textDecoration: "none", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            >
                              👁 Xem
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: "30px 18px", textAlign: "center", color: "#7c6f68" }}>
                      Không có lịch hẹn nào thuộc trạng thái này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 14, background: "#fffcf9", borderTop: "1px solid #f4e7dd", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#7c6f68" }}>
            <span>Hiển thị <b>{filteredItems.length}</b> lịch hẹn</span>
          </div>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
