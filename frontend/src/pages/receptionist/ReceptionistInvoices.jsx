import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const statusOptions = ["", "PAID", "UNPAID", "PENDING", "FAILED", "REFUND_PENDING", "REFUNDED"];

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function statusLabel(status) {
  const map = {
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
    PENDING: "Chờ thanh toán",
    FAILED: "Thất bại",
    REFUND_PENDING: "Chờ hoàn tiền",
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
    let paidCount = 0;
    let unpaidCount = 0;
    let totalRevenue = 0;

    items.forEach((i) => {
      const s = String(i.Status || i.PaymentStatus || "UNPAID").toUpperCase();
      if (s === "PAID") {
        paidCount++;
        totalRevenue += Number(i.FinalAmount || 0);
      } else {
        unpaidCount++;
      }
    });

    return { paid: paidCount, unpaid: unpaidCount, total: totalRevenue };
  }, [items]);

  const handleReset = () => {
    setStatus("");
    setDate("");
    setKeyword("");
    setTimeout(() => {
      setLoading(true);
      axiosClient.get("/receptionist/invoices")
        .then(res => setItems(res.data.data || res.data || []))
        .catch(err => setError(err.response?.data?.message || "Không tải được danh sách hóa đơn"))
        .finally(() => setLoading(false));
    }, 0);
  };

  return (
    <ReceptionistLayout>
      <div className="rx-page fade-in">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">🧾</div>
            <div>
              <h1>Quản lý hóa đơn khách hàng</h1>
              <p>
                Theo dõi lịch sử thanh toán, cập nhật trạng thái hóa đơn tại quầy, và xử lý hoàn tiền trực tuyến.
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Statistics Widget */}
        <div className="rx-stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
          <div className="rx-stat-card pink">
            <span>📁</span>
            <div>
              <p>Tổng số hóa đơn</p>
              <b>{items.length}</b>
            </div>
          </div>

          <div className="rx-stat-card green">
            <span>💳</span>
            <div>
              <p>Hóa đơn đã trả</p>
              <b>{totals.paid}</b>
            </div>
          </div>

          <div className="rx-stat-card yellow">
            <span>⏳</span>
            <div>
              <p>Chưa thanh toán</p>
              <b>{totals.unpaid}</b>
            </div>
          </div>

          <div className="rx-stat-card blue">
            <span>💰</span>
            <div>
              <p>Doanh thu ghi nhận</p>
              <b>{money(totals.total)}</b>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className="rx-filter-card">
          <div className="rx-filter-grid" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
            <label>
              <span>🔍 Tìm kiếm khách hàng</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên, số điện thoại hoặc email..."
              />
            </label>
            
            <label>
              <span>📅 Ngày tạo hóa đơn</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            
            <label>
              <span>⚙ Trạng thái thanh toán</span>
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
              onClick={handleReset}
            >
              ↺ Đặt lại bộ lọc
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

        {error && <div className="rx-error" style={{ marginBottom: 15 }}>{error}</div>}

        {/* Invoice List Table */}
        <div className="rx-table-card">
          <div className="rx-table-scroll">
            <table className="rx-appointment-table">
              <thead>
                <tr>
                  <th>Mã HĐ</th>
                  <th>Khách hàng</th>
                  <th>Mã lịch hẹn</th>
                  <th>Đơn giá gốc</th>
                  <th>Giảm giá</th>
                  <th>Thành tiền</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "#6f766f" }}>
                      Đang tải danh sách hóa đơn...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "#6f766f" }}>
                      Không tìm thấy hóa đơn nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  items.map((i) => {
                    const currentStatus = String(i.Status || i.PaymentStatus || "UNPAID").toUpperCase();
                    return (
                      <tr key={i.InvoiceId}>
                        <td>
                          <b>#{i.InvoiceId}</b>
                        </td>
                        <td>
                          <div className="rx-customer-cell">
                            <img
                              className="rx-mini-avatar"
                              src={avatarUrl(i.CustomerAvatarUrl)}
                              alt={i.CustomerName}
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_AVATAR;
                              }}
                            />
                            <div>
                              <b>{i.CustomerName || "Khách vãng lai"}</b>
                              <small>{i.CustomerPhone || "Không có SĐT"}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Link to={`/receptionist/appointments/${i.AppointmentId}`}>
                            #{i.AppointmentId}
                          </Link>
                        </td>
                        <td>{money(i.Total)}</td>
                        <td style={{ color: "#d91f68" }}>-{money(i.Discount)}</td>
                        <td>
                          <b>{money(i.FinalAmount)}</b>
                        </td>
                        <td>
                          <span className={`rx-badge status-${currentStatus.toLowerCase()}`}>
                            {statusLabel(currentStatus)}
                          </span>
                        </td>
                        <td>
                          {i.CreatedAt ? String(i.CreatedAt).slice(0, 10).split("-").reverse().join("/") : "-"}
                        </td>
                        <td>
                          <Link
                            className="rx-outline-pink-btn"
                            to={`/receptionist/invoices/${i.InvoiceId}`}
                            style={{ padding: "6px 12px", borderRadius: "8px", textDecoration: "none", fontSize: "12px", display: "inline-block", fontWeight: "bold" }}
                          >
                            👁 Chi tiết
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
