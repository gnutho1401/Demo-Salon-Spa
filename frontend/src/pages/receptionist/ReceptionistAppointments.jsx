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

function statusLabel(status) {
  const map = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING: "Đang chờ",
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    IN_PROGRESS: "Đang làm",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    NO_SHOW: "Không đến",
  };

  return map[status] || status || "-";
}

function paymentLabel(status) {
  const map = {
    UNPAID: "Chưa thanh toán",
    PENDING: "Đang chờ",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    REFUND_PENDING: "Chờ hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
  };

  return map[status] || status || "Chưa thanh toán";
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

  const [filters, setFilters] = useState({
    customer: "",
    date: "",
    status: "",
    technicianId: "",
    serviceId: "",
    paymentStatus: "",
  });

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
      setError(
        err.response?.data?.message || "Không tải được danh sách lịch hẹn",
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      today: items.filter((x) => {
        const today = new Date().toISOString().slice(0, 10);
        return String(x.AppointmentDate || "").slice(0, 10) === today;
      }).length,
      pending: items.filter((x) =>
        ["PENDING", "PENDING_PAYMENT"].includes(x.Status),
      ).length,
      confirmed: items.filter((x) => x.Status === "CONFIRMED").length,
      completed: items.filter((x) => x.Status === "COMPLETED").length,
      cancelled: items.filter((x) => x.Status === "CANCELLED").length,
    };
  }, [items]);

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

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">📅</div>
            <div>
              <h1>Danh sách lịch hẹn</h1>
              <p>Quản lý, theo dõi, lọc và xử lý toàn bộ lịch hẹn tại salon</p>
            </div>
          </div>

          <div className="rx-header-actions">
            <Link
              className="rx-primary-btn"
              to="/receptionist/appointments/create"
            >
              + Tạo lịch hẹn mới
            </Link>

            <Link
              className="rx-light-btn"
              to="/receptionist/appointments/create?walkin=1"
            >
              🚶 Walk-in
            </Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rx-filter-card">
          <div className="rx-filter-grid">
            <label>
              <span>Tìm khách hàng</span>
              <input
                placeholder="Nhập tên, SĐT hoặc email..."
                value={filters.customer}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, customer: e.target.value }))
                }
              />
            </label>

            <label>
              <span>Ngày hẹn</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, date: e.target.value }))
                }
              />
            </label>

            <label>
              <span>Trạng thái</span>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, status: e.target.value }))
                }
              >
                {statusOptions.map((s) => (
                  <option key={s || "all-status"} value={s}>
                    {s ? statusLabel(s) : "Tất cả trạng thái"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Kỹ thuật viên</span>
              <select
                value={filters.technicianId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, technicianId: e.target.value }))
                }
              >
                <option value="">Tất cả kỹ thuật viên</option>
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

            <label>
              <span>Dịch vụ</span>
              <select
                value={filters.serviceId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, serviceId: e.target.value }))
                }
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Thanh toán</span>
              <select
                value={filters.paymentStatus}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    paymentStatus: e.target.value,
                  }))
                }
              >
                {paymentOptions.map((s) => (
                  <option key={s || "all-payment"} value={s}>
                    {s ? paymentLabel(s) : "Tất cả thanh toán"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rx-filter-actions">
            <button
              className="rx-outline-pink-btn"
              type="button"
              onClick={resetFilters}
            >
              ↺ Đặt lại
            </button>

            <button className="rx-primary-btn" type="submit" disabled={loading}>
              {loading ? "Đang lọc..." : "⌕ Lọc kết quả"}
            </button>
          </div>
        </form>

        {error && <div className="rx-error">{error}</div>}

        <div className="rx-stat-grid">
          <div className="rx-stat-card pink">
            <span>📅</span>
            <p>Tổng lịch hẹn</p>
            <b>{stats.total}</b>
          </div>

          <div className="rx-stat-card blue">
            <span>🗓️</span>
            <p>Hôm nay</p>
            <b>{stats.today}</b>
          </div>

          <div className="rx-stat-card yellow">
            <span>⏰</span>
            <p>Đang chờ</p>
            <b>{stats.pending}</b>
          </div>

          <div className="rx-stat-card purple">
            <span>✓</span>
            <p>Đã xác nhận</p>
            <b>{stats.confirmed}</b>
          </div>

          <div className="rx-stat-card green">
            <span>✅</span>
            <p>Hoàn thành</p>
            <b>{stats.completed}</b>
          </div>

          <div className="rx-stat-card red">
            <span>✕</span>
            <p>Đã hủy</p>
            <b>{stats.cancelled}</b>
          </div>
        </div>

        <div className="rx-table-card">
          <table className="rx-appointment-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Khách hàng</th>
                <th>KTV</th>
                <th>Dịch vụ</th>
                <th>Ngày hẹn</th>
                <th>Giờ hẹn</th>
                <th>TT thanh toán</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {items.map((a) => (
                <tr key={a.AppointmentId}>
                  <td>#{a.AppointmentId}</td>

                  <td>
                    <div className="rx-customer-cell">
                      <img
                        className="rx-mini-avatar"
                        src={avatarUrl(a.CustomerAvatarUrl)}
                        alt={a.CustomerName || "Customer"}
                      />
                      <div>
                        <b>{a.CustomerName || "-"}</b>
                        <small>{a.CustomerPhone || "-"}</small>
                        <small>{a.CustomerEmail || "-"}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="rx-tech-cell">
                      <img
                        className="rx-tech-avatar"
                        src={avatarUrl(
                          a.TechnicianAvatarUrl || a.TechnicianImageUrl,
                        )}
                        alt={a.TechnicianName || "Technician"}
                      />
                      <span>{a.TechnicianName || "-"}</span>
                    </div>
                  </td>

                  <td>
                    <b>{a.ServiceName || "-"}</b>
                    <small>
                      {a.FinalAmount
                        ? `${Number(a.FinalAmount).toLocaleString("vi-VN")}đ`
                        : ""}
                    </small>
                  </td>

                  <td>
                    <b>{formatDate(a.AppointmentDate)}</b>
                    <small>
                      {String(a.AppointmentDate || "").slice(0, 10)}
                    </small>
                  </td>

                  <td>
                    {a.StartTime} - {a.EndTime}
                  </td>

                  <td>
                    <span
                      className={`rx-badge payment-${String(
                        a.PaymentStatus || "UNPAID",
                      ).toLowerCase()}`}
                    >
                      {paymentLabel(a.PaymentStatus)}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`rx-badge status-${String(
                        a.Status || "",
                      ).toLowerCase()}`}
                    >
                      {statusLabel(a.Status)}
                    </span>
                  </td>

                  <td>
                    <div className="rx-action-cell">
                      <Link
                        className="rx-icon-btn"
                        to={`/receptionist/appointments/${a.AppointmentId}`}
                      >
                        👁
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Không có lịch hẹn phù hợp
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="rx-table-footer">
            <span>Hiển thị {items.length} lịch hẹn</span>
          </div>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
