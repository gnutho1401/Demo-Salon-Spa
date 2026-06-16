import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const statusOptions = ["", "PAID", "UNPAID", "PENDING", "FAILED", "REFUNDED"];

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function statusLabel(status) {
  const map = {
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
    PENDING: "Đang chờ",
    FAILED: "Thất bại",
    REFUNDED: "Đã hoàn tiền",
  };
  return map[String(status || "").toUpperCase()] || status || "-";
}

export default function ReceptionistInvoices() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get("/receptionist/invoices", {
        params: {
          status: status || undefined,
          date: date || undefined,
          customer: keyword || undefined,
        },
      });
      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được danh sách hóa đơn",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const paid = items.filter(
      (i) => String(i.PaymentStatus || i.Status || "").toUpperCase() === "PAID",
    ).length;
    const unpaid = items.filter(
      (i) =>
        String(i.PaymentStatus || i.Status || "UNPAID").toUpperCase() !==
        "PAID",
    ).length;
    const total = items.reduce((sum, i) => sum + Number(i.FinalAmount || 0), 0);
    return { paid, unpaid, total };
  }, [items]);

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">🧾</div>
            <div>
              <h1>Quản lý hóa đơn</h1>
              <p>
                Theo dõi thanh toán, trạng thái hóa đơn và truy cập chi tiết
                từng bill.
              </p>
            </div>
          </div>
        </div>

        <div className="rx-stat-grid" style={{ marginBottom: 18 }}>
          <div className="rx-stat-card pink">
            <span>🧾</span>
            <p>Tổng hóa đơn</p>
            <b>{items.length}</b>
          </div>
          <div className="rx-stat-card green">
            <span>✅</span>
            <p>Đã thanh toán</p>
            <b>{totals.paid}</b>
          </div>
          <div className="rx-stat-card yellow">
            <span>⏰</span>
            <p>Chưa thanh toán</p>
            <b>{totals.unpaid}</b>
          </div>
          <div className="rx-stat-card blue">
            <span>💰</span>
            <p>Tổng doanh thu</p>
            <b>{money(totals.total)}</b>
          </div>
        </div>

        <div className="rx-filter-card">
          <div className="rx-filter-grid">
            <label>
              <span>Tìm khách hàng</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên, SĐT hoặc email"
              />
            </label>
            <label>
              <span>Ngày tạo</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              <span>Trạng thái</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s ? statusLabel(s) : "Tất cả trạng thái"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rx-filter-actions">
            <button
              className="rx-outline-pink-btn"
              type="button"
              onClick={() => {
                setStatus("");
                setDate("");
                setKeyword("");
                setTimeout(load, 0);
              }}
            >
              ↺ Đặt lại
            </button>
            <button
              className="rx-primary-btn"
              type="button"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Đang lọc..." : "⌕ Lọc kết quả"}
            </button>
          </div>
        </div>

        {error && <div className="rx-error">{error}</div>}

        <div className="rx-table-card">
          <table className="rx-appointment-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Khách hàng</th>
                <th>Lịch hẹn</th>
                <th>Tổng</th>
                <th>Giảm</th>
                <th>Thành tiền</th>
                <th>Thanh toán</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.InvoiceId}>
                  <td>#{i.InvoiceId}</td>
                  <td>
                    <div className="rx-customer-cell">
                      <img
                        className="rx-mini-avatar"
                        src={avatarUrl(i.CustomerAvatarUrl)}
                        alt={i.CustomerName || "Customer"}
                      />
                      <div>
                        <b>{i.CustomerName || "-"}</b>
                        <small>{i.CustomerPhone || "-"}</small>
                      </div>
                    </div>
                  </td>
                  <td>#{i.AppointmentId}</td>
                  <td>{money(i.Total)}</td>
                  <td>{money(i.Discount)}</td>
                  <td>
                    <b>{money(i.FinalAmount)}</b>
                  </td>
                  <td>
                    <span
                      className={`rx-badge payment-${String(i.PaymentStatus || i.Status || "unpaid").toLowerCase()}`}
                    >
                      {statusLabel(i.PaymentStatus || i.Status)}
                    </span>
                  </td>
                  <td>
                    {i.CreatedAt ? String(i.CreatedAt).slice(0, 10) : "-"}
                  </td>
                  <td>
                    <Link
                      className="rx-icon-btn"
                      to={`/receptionist/invoices/${i.InvoiceId}`}
                    >
                      👁
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Không có hóa đơn phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
