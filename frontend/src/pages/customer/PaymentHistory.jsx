import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axiosClient
      .get("/payments/my")
      .then((res) => setPayments(res.data.data || res.data || []))
      .catch((err) =>
        setMessage(
          err.response?.data?.message || "Không tải được lịch sử thanh toán",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const sortedPayments = useMemo(() => {
    return [...payments].sort(
      (a, b) => Number(b.PaymentId || 0) - Number(a.PaymentId || 0),
    );
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return sortedPayments.filter((p) => {
      const status = String(p.Status || "PENDING").toUpperCase();

      const statusOk = statusFilter === "ALL" || status === statusFilter;

      const keywordOk =
        !text ||
        String(p.PaymentId || "").includes(text) ||
        String(p.InvoiceId || "").includes(text) ||
        String(p.AppointmentId || "").includes(text) ||
        String(p.ServiceNames || "")
          .toLowerCase()
          .includes(text) ||
        String(p.TransactionCode || "")
          .toLowerCase()
          .includes(text);

      return statusOk && keywordOk;
    });
  }, [sortedPayments, statusFilter, keyword]);

  const stats = useMemo(() => {
    const total = payments.length;

    const paid = payments.filter(
      (p) => String(p.Status || "").toUpperCase() === "PAID",
    ).length;

    const pending = payments.filter(
      (p) => String(p.Status || "").toUpperCase() === "PENDING",
    ).length;

    const amount = payments
      .filter((p) => String(p.Status || "").toUpperCase() === "PAID")
      .reduce((sum, p) => sum + Number(p.Amount || 0), 0);

    return { total, paid, pending, amount };
  }, [payments]);

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function date(value) {
    if (!value) return "Chưa có";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function statusText(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PAID") return "Đã thanh toán";
    if (s === "PENDING") return "Đang chờ";
    if (s === "FAILED") return "Thất bại";
    if (s === "REFUNDED") return "Đã hoàn tiền";
    if (s === "REFUND_PENDING") return "Đang hoàn tiền";
    return status || "Chưa rõ";
  }

  return (
    <CustomerLayout>
      <div className="payment-history-page">
        <div className="section-head">
          <div>
            <div className="eyebrow">Payment History</div>
            <h2 className="section-title">Lịch sử thanh toán</h2>
            <p className="muted">
              Xem lại các giao dịch VNPay, hóa đơn và trạng thái thanh toán.
            </p>
          </div>

          <Link className="btn" to="/customer/appointments">
            Xem lịch hẹn
          </Link>
        </div>

        {message && <div className="alert error">{message}</div>}

        <div className="stats">
          <div className="dashboard-card">
            <h3>Tổng giao dịch</h3>
            <strong>{stats.total}</strong>
            <p className="muted">Tất cả giao dịch đã tạo</p>
          </div>

          <div className="dashboard-card">
            <h3>Đã thanh toán</h3>
            <strong>{stats.paid}</strong>
            <p className="muted">Giao dịch thành công</p>
          </div>

          <div className="dashboard-card">
            <h3>Đang chờ</h3>
            <strong>{stats.pending}</strong>
            <p className="muted">Giao dịch chưa hoàn tất</p>
          </div>

          <div className="dashboard-card">
            <h3>Tổng đã chi</h3>
            <strong>{money(stats.amount)}</strong>
            <p className="muted">Chỉ tính giao dịch PAID</p>
          </div>
        </div>

        <div className="dashboard-card payment-filter-card">
          <input
            className="filter-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm mã giao dịch, hóa đơn, dịch vụ..."
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="PENDING">Đang chờ</option>
            <option value="FAILED">Thất bại</option>
            <option value="REFUND_PENDING">Đang hoàn tiền</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>

          <button
            className="card-btn"
            type="button"
            onClick={() => {
              setKeyword("");
              setStatusFilter("ALL");
            }}
          >
            Xóa lọc
          </button>
        </div>

        <div className="table-card">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Mã hóa đơn</th>
                <th>Mã lịch</th>
                <th>Dịch vụ</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
                <th>Ngày thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Đang tải lịch sử thanh toán...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Chưa có giao dịch thanh toán nào
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const status = String(p.Status || "PENDING").toUpperCase();

                  return (
                    <tr key={p.PaymentId}>
                      <td>
                        <span className="code">
                          PAY{String(p.PaymentId).padStart(5, "0")}
                        </span>
                      </td>

                      <td>INV{String(p.InvoiceId || "").padStart(5, "0")}</td>

                      <td>
                        {p.AppointmentId
                          ? `AP${String(p.AppointmentId).padStart(5, "0")}`
                          : "Chưa có"}
                      </td>

                      <td>{p.ServiceNames || "-"}</td>

                      <td>
                        <b>{money(p.Amount)}</b>
                      </td>

                      <td>{p.PaymentMethod || "-"}</td>

                      <td>
                        <span
                          className={`payment-badge ${
                            status === "PAID"
                              ? "payment-paid"
                              : status === "REFUND_PENDING"
                                ? "status-pending"
                                : "payment-unpaid"
                          }`}
                        >
                          {statusText(status)}
                        </span>
                      </td>

                      <td>{date(p.PaidAt || p.CreatedAt)}</td>

                      <td>
                        {p.AppointmentId ? (
                          <Link
                            className="btn-detail"
                            to={`/customer/appointments/${p.AppointmentId}`}
                          >
                            Xem lịch
                          </Link>
                        ) : (
                          "Không có"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="table-footer">
            <span>
              Hiển thị {filteredPayments.length} / {payments.length} giao dịch
            </span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
