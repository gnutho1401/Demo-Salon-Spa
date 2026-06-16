import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "WAITING", label: "Đang chờ" },
  { value: "NOTIFIED", label: "Đã thông báo" },
  { value: "BOOKED", label: "Đã đặt lịch" },
  { value: "CANCELLED", label: "Đã hủy" },
];

function statusLabel(status) {
  const map = {
    WAITING: "Đang chờ",
    NOTIFIED: "Đã thông báo",
    BOOKED: "Đã đặt lịch",
    CANCELLED: "Đã hủy",
  };
  return map[status] || status || "-";
}

function statusClass(status) {
  return `rx-badge status-${String(status || "").toLowerCase()}`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function avatarText(name) {
  return String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
}

export default function ReceptionistWaitingList() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [filters, setFilters] = useState({
    customer: "",
    status: "WAITING",
    serviceId: "",
    date: "",
  });

  const [form, setForm] = useState({
    customerId: "",
    serviceId: "",
    preferredDate: "",
    preferredTime: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load(nextFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const params = {
        customer: nextFilters.customer || undefined,
        status: nextFilters.status || undefined,
        serviceId: nextFilters.serviceId || undefined,
        date: nextFilters.date || undefined,
      };

      const [waitingRes, servicesRes, customersRes] = await Promise.all([
        axiosClient.get("/receptionist/waiting-list", { params }),
        axiosClient.get("/receptionist/services"),
        axiosClient.get("/receptionist/customers"),
      ]);

      setItems(waitingRes.data?.data || waitingRes.data || []);
      setServices(servicesRes.data?.data || servicesRes.data || []);
      setCustomers(customersRes.data?.data || customersRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được Waiting List");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      waiting: items.filter((x) => x.Status === "WAITING").length,
      notified: items.filter((x) => x.Status === "NOTIFIED").length,
      booked: items.filter((x) => x.Status === "BOOKED").length,
      cancelled: items.filter((x) => x.Status === "CANCELLED").length,
    };
  }, [items]);

  async function createWaiting(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post("/receptionist/waiting-list", form);

      setForm({
        customerId: "",
        serviceId: "",
        preferredDate: "",
        preferredTime: "",
      });

      await load();
      setSuccessMsg("Đã thêm khách vào hàng chờ");
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể thêm khách vào hàng chờ",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.put(`/receptionist/waiting-list/${id}`, { status });

      await load();
      setSuccessMsg("Đã cập nhật trạng thái");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể cập nhật trạng thái");
    } finally {
      setSaving(false);
    }
  }

  async function cancelWaiting(id) {
    if (!window.confirm("Bạn có chắc muốn hủy khách khỏi hàng chờ không?"))
      return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.delete(`/receptionist/waiting-list/${id}`);

      await load();
      setSuccessMsg("Đã hủy yêu cầu chờ");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể hủy waiting list");
    } finally {
      setSaving(false);
    }
  }

  function submitFilter(e) {
    e.preventDefault();
    load(filters);
  }

  function resetFilter() {
    const reset = {
      customer: "",
      status: "WAITING",
      serviceId: "",
      date: "",
    };

    setFilters(reset);
    load(reset);
  }

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">⏳</div>
            <div>
              <h1>Waiting List</h1>
              <p>
                Quản lý khách đang chờ lịch trống, liên hệ khách và chuyển sang
                đặt lịch.
              </p>
            </div>
          </div>

          <div className="rx-header-actions">
            <button
              className="rx-light-btn"
              type="button"
              onClick={() => load()}
              disabled={loading}
            >
              ↻ Làm mới
            </button>
          </div>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {successMsg && <div className="rcc-alert success">{successMsg}</div>}

        <div className="rx-stat-grid rx-waiting-stats">
          <div className="rx-stat-card pink">
            <span>📋</span>
            <div>
              <p>Tổng hàng chờ</p>
              <b>{stats.total}</b>
            </div>
          </div>

          <div className="rx-stat-card yellow">
            <span>⏰</span>
            <div>
              <p>Đang chờ</p>
              <b>{stats.waiting}</b>
            </div>
          </div>

          <div className="rx-stat-card blue">
            <span>📞</span>
            <div>
              <p>Đã thông báo</p>
              <b>{stats.notified}</b>
            </div>
          </div>

          <div className="rx-stat-card green">
            <span>✅</span>
            <div>
              <p>Đã đặt lịch</p>
              <b>{stats.booked}</b>
            </div>
          </div>

          <div className="rx-stat-card red">
            <span>✖</span>
            <div>
              <p>Đã hủy</p>
              <b>{stats.cancelled}</b>
            </div>
          </div>
        </div>

        <div className="rx-filter-card">
          <div className="rx-section-title">
            <h2>Thêm khách vào hàng chờ</h2>
            <p>Receptionist chọn khách hàng, dịch vụ và thời gian mong muốn.</p>
          </div>

          <form
            className="rx-filter-grid rx-waiting-form"
            onSubmit={createWaiting}
          >
            <label>
              <span>Khách hàng</span>
              <select
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
                required
              >
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => (
                  <option key={c.CustomerId} value={c.CustomerId}>
                    {c.FullName} - {c.Phone}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Dịch vụ</span>
              <select
                value={form.serviceId}
                onChange={(e) =>
                  setForm({ ...form, serviceId: e.target.value })
                }
                required
              >
                <option value="">Chọn dịch vụ</option>
                {services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Ngày mong muốn</span>
              <input
                type="date"
                value={form.preferredDate}
                onChange={(e) =>
                  setForm({ ...form, preferredDate: e.target.value })
                }
              />
            </label>

            <label>
              <span>Giờ mong muốn</span>
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) =>
                  setForm({ ...form, preferredTime: e.target.value })
                }
              />
            </label>

            <div className="rx-waiting-submit">
              <button
                className="rx-primary-btn"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "+ Thêm vào hàng chờ"}
              </button>
            </div>
          </form>
        </div>

        <form className="rx-filter-card" onSubmit={submitFilter}>
          <div className="rx-filter-grid rx-waiting-filter">
            <label>
              <span>Tìm khách hàng</span>
              <input
                value={filters.customer}
                onChange={(e) =>
                  setFilters({ ...filters, customer: e.target.value })
                }
                placeholder="Tên, SĐT hoặc email"
              />
            </label>

            <label>
              <span>Trạng thái</span>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Dịch vụ</span>
              <select
                value={filters.serviceId}
                onChange={(e) =>
                  setFilters({ ...filters, serviceId: e.target.value })
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
              <span>Ngày mong muốn</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) =>
                  setFilters({ ...filters, date: e.target.value })
                }
              />
            </label>
          </div>

          <div className="rx-filter-actions">
            <button
              className="rx-outline-pink-btn"
              type="button"
              onClick={resetFilter}
            >
              ↺ Đặt lại
            </button>
            <button className="rx-primary-btn" type="submit">
              Tìm kiếm
            </button>
          </div>
        </form>

        <div className="rx-table-card">
          <div className="rx-table-header">
            <div>
              <h2>Danh sách khách chờ</h2>
              <p>{items.length} khách đang hiển thị theo bộ lọc hiện tại</p>
            </div>
          </div>

          <div className="rx-table-scroll">
            <table className="rx-appointment-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Dịch vụ</th>
                  <th>Ngày mong muốn</th>
                  <th>Giờ</th>
                  <th>Thời gian chờ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7" className="rx-empty-row">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan="7" className="rx-empty-row">
                      Không có khách trong Waiting List
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((w) => (
                    <tr key={w.WaitingId}>
                      <td>
                        <div className="rx-customer-cell">
                          <img
                            className="rx-mini-avatar"
                            src={avatarUrl(w.CustomerAvatarUrl)}
                            alt={w.CustomerName || "Customer"}
                          />
                          <div>
                            <b>{w.CustomerName || "-"}</b>
                            <small>{w.CustomerPhone || "-"}</small>
                            <small>{w.CustomerEmail || "-"}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <b>{w.ServiceName || "-"}</b>
                        <small>
                          {money(w.Price)} · {w.DurationMinutes || 0} phút
                        </small>
                      </td>

                      <td>{formatDate(w.PreferredDate)}</td>
                      <td>{w.PreferredTime || "-"}</td>
                      <td>{Number(w.WaitingMinutes || 0)} phút</td>

                      <td>
                        <span className={statusClass(w.Status)}>
                          {statusLabel(w.Status)}
                        </span>
                      </td>

                      <td>
                        <div className="rx-action-cell">
                          {w.Status === "WAITING" && (
                            <button
                              type="button"
                              className="rx-icon-btn"
                              title="Thông báo khách"
                              disabled={saving}
                              onClick={() =>
                                updateStatus(w.WaitingId, "NOTIFIED")
                              }
                            >
                              📞
                            </button>
                          )}

                          {["WAITING", "NOTIFIED"].includes(w.Status) && (
                            <button
                              type="button"
                              className="rx-icon-btn"
                              title="Đánh dấu đã đặt lịch"
                              disabled={saving}
                              onClick={() =>
                                updateStatus(w.WaitingId, "BOOKED")
                              }
                            >
                              ✅
                            </button>
                          )}

                          {w.Status !== "CANCELLED" && (
                            <button
                              type="button"
                              className="rx-icon-btn danger"
                              title="Hủy"
                              disabled={saving}
                              onClick={() => cancelWaiting(w.WaitingId)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
