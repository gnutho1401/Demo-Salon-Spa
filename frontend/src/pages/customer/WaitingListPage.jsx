import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

const STATUS_META = {
  WAITING: { text: "Đang chờ", icon: "⏳", tone: "waiting" },
  NOTIFIED: { text: "Đã thông báo", icon: "🔔", tone: "notified" },
  BOOKED: { text: "Đã đặt lịch", icon: "✅", tone: "booked" },
  CANCELLED: { text: "Đã hủy", icon: "✕", tone: "cancelled" },
};

function formatDate(value) {
  if (!value) return "Linh hoạt";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "Linh hoạt";
  const text = String(value);
  if (text.includes("T")) {
    return new Date(text).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return text.slice(0, 5);
}

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

export default function WaitingListPage() {
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    serviceId: "",
    preferredDate: "",
    preferredTime: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => String(s.ServiceId) === String(form.serviceId)),
    [services, form.serviceId],
  );

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [serviceRes, waitRes] = await Promise.all([
        axiosClient.get("/services"),
        axiosClient.get("/waiting-list/my"),
      ]);

      setServices(serviceRes.data?.data || serviceRes.data || []);
      setItems(waitRes.data?.data || waitRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được hàng chờ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.serviceId) {
      setError("Vui lòng chọn dịch vụ.");
      return;
    }

    try {
      setSubmitting(true);
      await axiosClient.post("/waiting-list", form);
      setMessage("Đã thêm vào hàng chờ thành công.");
      setForm({ serviceId: "", preferredDate: "", preferredTime: "" });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Thêm hàng chờ thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id) {
    if (!window.confirm("Bạn chắc chắn muốn hủy yêu cầu hàng chờ này?")) return;

    try {
      setMessage("");
      setError("");
      await axiosClient.delete(`/waiting-list/${id}`);
      setMessage("Đã hủy yêu cầu hàng chờ.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy hàng chờ thất bại");
    }
  }

  return (
    <CustomerLayout>
      <div className="waiting-customer-page">
        <section className="waiting-customer-hero">
          <div>
            <span className="waiting-customer-kicker">WAITING LIST</span>
            <h1>Hàng chờ lịch hẹn</h1>
            <p>
              Chọn dịch vụ và thời gian mong muốn. Khi có lịch phù hợp, salon sẽ
              thông báo để bạn đặt lịch nhanh hơn.
            </p>
          </div>

          <div className="waiting-customer-hero-card">
            <span>Yêu cầu hiện tại</span>
            <strong>{items.length}</strong>
            <small>Được sắp xếp mới nhất trước</small>
          </div>
        </section>

        {message && (
          <div className="waiting-customer-alert success">{message}</div>
        )}
        {error && <div className="waiting-customer-alert error">{error}</div>}

        <section className="waiting-customer-grid">
          <form className="waiting-customer-form-card" onSubmit={submit}>
            <div className="waiting-customer-card-head">
              <div>
                <span>01</span>
                <h2>Thêm vào hàng chờ</h2>
                <p>Phù hợp khi chưa có khung giờ trống đúng ý bạn.</p>
              </div>
            </div>

            <div className="waiting-customer-form">
              <label>
                Dịch vụ <b>*</b>
                <select
                  value={form.serviceId}
                  onChange={(e) =>
                    setForm({ ...form, serviceId: e.target.value })
                  }
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
                Ngày mong muốn
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) =>
                    setForm({ ...form, preferredDate: e.target.value })
                  }
                />
              </label>

              <label>
                Giờ mong muốn
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) =>
                    setForm({ ...form, preferredTime: e.target.value })
                  }
                />
              </label>
            </div>

            {selectedService && (
              <div className="waiting-service-preview">
                <div>
                  <span>Dịch vụ đã chọn</span>
                  <strong>{selectedService.ServiceName}</strong>
                  <small>
                    {selectedService.DurationMinutes || 0} phút ·{" "}
                    {money(selectedService.Price)}
                  </small>
                </div>
              </div>
            )}

            <button className="waiting-customer-primary" disabled={submitting}>
              {submitting ? "Đang thêm..." : "Thêm vào hàng chờ"}
            </button>
          </form>

          <div className="waiting-customer-guide">
            <h3>Thông tin trạng thái</h3>

            <div className="waiting-guide-item">
              <b>⏳ Đang chờ</b>
              <span>Yêu cầu của bạn đang chờ salon xử lý.</span>
            </div>

            <div className="waiting-guide-item">
              <b>🔔 Đã thông báo</b>
              <span>Salon đã có lịch phù hợp và thông báo cho bạn.</span>
            </div>

            <div className="waiting-guide-item">
              <b>✅ Đã đặt lịch</b>
              <span>Yêu cầu hàng chờ đã được chuyển thành lịch hẹn.</span>
            </div>

            <div className="waiting-guide-item">
              <b>✕ Đã hủy</b>
              <span>Bạn đã hủy hoặc yêu cầu không còn hiệu lực.</span>
            </div>
          </div>
        </section>

        <section className="waiting-customer-list-card">
          <div className="waiting-customer-list-head">
            <div>
              <span>02</span>
              <h2>Danh sách hàng chờ của tôi</h2>
            </div>
          </div>

          {loading ? (
            <div className="waiting-empty">Đang tải dữ liệu...</div>
          ) : items.length === 0 ? (
            <div className="waiting-empty">
              Bạn chưa có yêu cầu hàng chờ nào.
            </div>
          ) : (
            <div className="waiting-customer-table-wrap">
              <table className="waiting-customer-table">
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>Ngày mong muốn</th>
                    <th>Giờ</th>
                    <th>Giá</th>
                    <th>Thời lượng</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((w) => {
                    const meta = STATUS_META[w.Status] || {
                      text: w.Status,
                      icon: "•",
                      tone: "default",
                    };

                    return (
                      <tr key={w.WaitingId}>
                        <td>
                          <strong>{w.ServiceName}</strong>
                        </td>
                        <td>{formatDate(w.PreferredDate)}</td>
                        <td>{formatTime(w.PreferredTime)}</td>
                        <td>{money(w.Price)}</td>
                        <td>{w.DurationMinutes || 0} phút</td>
                        <td>
                          <span className={`waiting-status ${meta.tone}`}>
                            {meta.icon} {meta.text}
                          </span>
                        </td>
                        <td>{formatDate(w.CreatedAt)}</td>
                        <td>
                          {w.Status === "WAITING" ? (
                            <button
                              type="button"
                              className="waiting-cancel-btn"
                              onClick={() => cancel(w.WaitingId)}
                            >
                              Hủy
                            </button>
                          ) : (
                            <span className="waiting-muted">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </CustomerLayout>
  );
}
