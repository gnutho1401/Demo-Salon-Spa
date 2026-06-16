import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function MyAppointments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [cancelModal, setCancelModal] = useState({
    open: false,
    appointment: null,
    reason: "",
    paymentStatus: "UNPAID",
  });

  async function loadAppointments() {
    try {
      setError("");
      const [appointmentsRes, reviewsRes] = await Promise.all([
        axiosClient.get("/appointments/my"),
        axiosClient.get("/customers/me/reviews"),
      ]);
      setRows(appointmentsRes.data.data || []);
      setReviews(reviewsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch hẹn");
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const filteredRows = useMemo(() => {
    return [...rows]
      .sort(
        (a, b) => Number(b.AppointmentId || 0) - Number(a.AppointmentId || 0),
      )
      .filter((r) => {
        const status = String(r.Status || "").toUpperCase();
        const payment = String(r.PaymentStatus || "UNPAID").toUpperCase();
        const appointmentDate = String(r.AppointmentDate || "").slice(0, 10);

        const statusOk = statusFilter === "ALL" || status === statusFilter;

        const paymentOk = paymentFilter === "ALL" || payment === paymentFilter;

        const dateOk =
          (!dateFilter || appointmentDate === dateFilter) &&
          (!fromDate || appointmentDate >= fromDate) &&
          (!toDate || appointmentDate <= toDate);

        const text = keyword.trim().toLowerCase();

        const keywordOk =
          !text ||
          String(r.ServiceName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.EmployeeName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.Notes || "")
            .toLowerCase()
            .includes(text) ||
          getAppointmentCode(r.AppointmentId).toLowerCase().includes(text);

        return statusOk && paymentOk && dateOk && keywordOk;
      });
  }, [
    rows,
    statusFilter,
    paymentFilter,
    keyword,
    dateFilter,
    fromDate,
    toDate,
  ]);

  const stats = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "CONFIRMED",
    ).length;
    const pending = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "PENDING_PAYMENT",
    ).length;
    const spent = rows
      .filter((r) => String(r.PaymentStatus || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + Number(r.FinalAmount || r.Price || 0), 0);

    return { total, confirmed, pending, spent };
  }, [rows]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatDate(value) {
    if (!value) return "Chưa có";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function formatTime(value) {
    if (!value) return "";

    const text = String(value);

    if (text.includes("T")) {
      const afterT = text.split("T")[1];
      return afterT ? afterT.slice(0, 5) : "";
    }

    if (text.includes(":")) {
      return text.slice(0, 5);
    }

    return text;
  }

  function getAppointmentCode(id) {
    return `AP${String(id).padStart(5, "0")}`;
  }

  function canPay(status, paymentStatus) {
    const s = String(status || "").toUpperCase();
    const p = String(paymentStatus || "").toUpperCase();
    return (
      s === "PENDING_PAYMENT" && ["UNPAID", "PENDING", "FAILED"].includes(p)
    );
  }

  function canCancel(status) {
    const s = String(status || "").toUpperCase();
    return s === "PENDING_PAYMENT" || s === "CONFIRMED";
  }

  function canReschedule(status) {
    const s = String(status || "").toUpperCase();
    return !["COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(s);
  }

  function hasReviewed(appointmentId, serviceId) {
    return reviews.some(
      (review) =>
        String(review.AppointmentId) === String(appointmentId) &&
        String(review.ServiceId) === String(serviceId),
    );
  }

  function canReviewAppointment(status, appointmentId, serviceId) {
    return (
      String(status || "").toUpperCase() === "COMPLETED" &&
      !hasReviewed(appointmentId, serviceId)
    );
  }

  function getStatusText(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
    if (s === "CONFIRMED") return "Đã xác nhận";
    if (s === "CHECKED_IN") return "Đã check-in";
    if (s === "IN_PROGRESS") return "Đang thực hiện";
    if (s === "COMPLETED") return "Hoàn thành";
    if (s === "CANCELLED") return "Đã hủy";
    if (s === "REFUND_PENDING") return "Đang chờ hoàn tiền";
    if (s === "NO_SHOW") return "Vắng mặt";
    return status || "Chưa rõ";
  }

  function getPaymentText(paymentStatus) {
    const p = String(paymentStatus || "").toUpperCase();
    if (p === "PAID") return "Đã thanh toán";
    if (p === "UNPAID") return "Chưa thanh toán";
    if (p === "PENDING") return "Đang chờ thanh toán";
    if (p === "FAILED") return "Thanh toán thất bại";
    if (p === "REFUND_PENDING") return "Đang chờ hoàn tiền";
    if (p === "REFUNDED") return "Đã hoàn tiền";
    return paymentStatus || "Chưa thanh toán";
  }

  function getRefundText(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PENDING") return "Đang chờ hoàn tiền";
    if (s === "PROCESSING") return "Đang xử lý hoàn tiền";
    if (s === "APPROVED") return "Đã chấp nhận hoàn tiền";
    if (s === "REFUNDED") return "Đã hoàn tiền";
    if (s === "REJECTED") return "Từ chối hoàn tiền";
    return status || "Chưa có";
  }

  function openCancelModal(r) {
    setCancelModal({
      open: true,
      appointment: r,
      reason: "",
      paymentStatus: String(r.PaymentStatus || "UNPAID").toUpperCase(),
    });
  }

  function closeCancelModal() {
    setCancelModal({
      open: false,
      appointment: null,
      reason: "",
      paymentStatus: "UNPAID",
    });
  }

  async function handleCancelSubmit() {
    if (!cancelModal.reason.trim()) {
      setError("Vui lòng nhập lý do hủy lịch");
      return;
    }

    const appointmentId = cancelModal.appointment?.AppointmentId;

    if (!appointmentId) {
      setError("Không tìm thấy lịch hẹn cần hủy");
      return;
    }

    try {
      setLoadingId(appointmentId);
      setError("");
      setMessage("");

      await axiosClient.delete(`/appointments/${appointmentId}`, {
        data: { reason: cancelModal.reason.trim() },
      });

      setMessage(
        cancelModal.paymentStatus === "PAID"
          ? "Đã gửi yêu cầu hủy lịch và chờ hoàn tiền"
          : "Hủy lịch hẹn thành công",
      );

      closeCancelModal();
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch hẹn thất bại");
    } finally {
      setLoadingId(null);
    }
  }

  function handlePay(appointmentId) {
    navigate(`/customer/payment/${appointmentId}`);
  }

  return (
    <CustomerLayout>
      <div className="customer-appointments-page">
        {cancelModal.open && (
          <div className="cancel-modal-backdrop" onClick={closeCancelModal}>
            <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="cancel-modal-close"
                onClick={closeCancelModal}
              >
                ×
              </button>

              <div className="cancel-modal-icon">!</div>

              <h3>Xác nhận hủy lịch hẹn</h3>

              <p className="cancel-modal-desc">
                Bạn có chắc chắn muốn hủy lịch hẹn này không? Vui lòng nhập lý
                do để salon hỗ trợ xử lý đúng nghiệp vụ.
              </p>

              <div className="cancel-summary">
                <div>
                  <span>Mã lịch</span>
                  <b>
                    {getAppointmentCode(cancelModal.appointment?.AppointmentId)}
                  </b>
                </div>

                <div>
                  <span>Dịch vụ</span>
                  <b>
                    {cancelModal.appointment?.ServiceName || "Dịch vụ đã đặt"}
                  </b>
                </div>

                <div>
                  <span>Ngày hẹn</span>
                  <b>{formatDate(cancelModal.appointment?.AppointmentDate)}</b>
                </div>

                <div>
                  <span>Thời gian</span>
                  <b>
                    {formatTime(cancelModal.appointment?.StartTime)} -{" "}
                    {formatTime(cancelModal.appointment?.EndTime)}
                  </b>
                </div>
              </div>

              {cancelModal.paymentStatus === "PAID" && (
                <div className="refund-warning">
                  Lịch hẹn này đã thanh toán. Sau khi hủy, hệ thống sẽ chuyển
                  lịch sang trạng thái <b>Đang chờ hoàn tiền</b>.
                </div>
              )}

              <label className="cancel-label">Lý do hủy lịch</label>

              <textarea
                className="cancel-textarea"
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal({ ...cancelModal, reason: e.target.value })
                }
                placeholder="Ví dụ: Tôi bận đột xuất, muốn hủy lịch..."
                rows={4}
              />

              <div className="cancel-modal-actions">
                <button
                  type="button"
                  className="cancel-keep-btn"
                  onClick={closeCancelModal}
                  disabled={
                    loadingId === cancelModal.appointment?.AppointmentId
                  }
                >
                  Giữ lịch
                </button>

                <button
                  type="button"
                  className="cancel-confirm-btn"
                  onClick={handleCancelSubmit}
                  disabled={
                    loadingId === cancelModal.appointment?.AppointmentId
                  }
                >
                  {loadingId === cancelModal.appointment?.AppointmentId
                    ? "Đang xử lý..."
                    : "Xác nhận hủy"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="section-head">
          <div>
            <div className="eyebrow">Appointments</div>
            <h2 className="section-title">Lịch hẹn của tôi</h2>
            <p className="muted">
              Theo dõi lịch hẹn, trạng thái xác nhận và trạng thái thanh toán.
            </p>
          </div>

          <Link className="btn" to="/customer/booking">
            Đặt lịch mới
          </Link>
        </div>

        <div className="stats">
          <div className="dashboard-card">
            <h3>Tổng lịch hẹn</h3>
            <strong>{stats.total}</strong>
            <p className="muted">Tất cả lịch đã đặt</p>
          </div>

          <div className="dashboard-card">
            <h3>Đã xác nhận</h3>
            <strong>{stats.confirmed}</strong>
            <p className="muted">Lịch đã được salon xác nhận</p>
          </div>

          <div className="dashboard-card">
            <h3>Đang chờ</h3>
            <strong>{stats.pending}</strong>
            <p className="muted">Lịch chờ thanh toán</p>
          </div>

          <div className="dashboard-card">
            <h3>Tổng chi tiêu</h3>
            <strong>{formatMoney(stats.spent)}</strong>
            <p className="muted">Các lịch đã thanh toán</p>
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <div className="dashboard-card appointment-filter-card">
          <input
            className="filter-input"
            placeholder="🔍 Tìm theo mã lịch, dịch vụ, kỹ thuật viên..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING_PAYMENT">Chờ thanh toán</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="filter-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PENDING">Đang chờ</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="FAILED">Thất bại</option>
            <option value="REFUND_PENDING">Đang hoàn tiền</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>

          <input
            className="filter-input"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            className="filter-input"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <button
            className="card-btn"
            type="button"
            onClick={() => {
              setKeyword("");
              setDateFilter("");
              setFromDate("");
              setToDate("");
              setStatusFilter("ALL");
              setPaymentFilter("ALL");
            }}
          >
            Xóa lọc
          </button>
        </div>

        <div className="table-card">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Mã lịch</th>
                <th>Dịch vụ</th>
                <th>Kỹ thuật viên</th>
                <th>Ngày</th>
                <th>Giờ</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Bạn chưa có lịch hẹn nào
                  </td>
                </tr>
              )}

              {filteredRows.map((r) => {
                const status = String(r.Status || "").toUpperCase();
                const paymentStatus = String(
                  r.PaymentStatus || "UNPAID",
                ).toUpperCase();

                return (
                  <tr key={r.AppointmentId}>
                    <td>
                      <span className="code">
                        {getAppointmentCode(r.AppointmentId)}
                      </span>
                    </td>

                    <td>
                      <div className="service-cell">
                        <div className="service-icon">🌸</div>
                        <div>
                          <div className="service-name">
                            {r.ServiceName || "Dịch vụ"}
                          </div>
                          <div className="muted">
                            {r.Notes
                              ? `Ghi chú: ${r.Notes}`
                              : "Dịch vụ chăm sóc cao cấp"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>{r.EmployeeName || "Chưa có"}</td>

                    <td>{formatDate(r.AppointmentDate)}</td>

                    <td>
                      <b>
                        {formatTime(r.StartTime)} - {formatTime(r.EndTime)}
                      </b>
                    </td>

                    <td>{formatMoney(r.FinalAmount || r.Price)}</td>

                    <td>
                      <span
                        className={`status-badge status-${status.toLowerCase()}`}
                      >
                        {status === "PENDING_PAYMENT" || status === "PENDING"
                          ? "⏳ "
                          : status === "CONFIRMED"
                            ? "✅ "
                            : status === "NO_SHOW"
                              ? "🚫 "
                              : ""}
                        {getStatusText(status)}
                      </span>
                    </td>

                    <td>
                      <div>
                        <span
                          className={`payment-badge ${
                            paymentStatus === "PAID"
                              ? "payment-paid"
                              : paymentStatus === "REFUND_PENDING"
                                ? "status-pending"
                                : "payment-unpaid"
                          }`}
                        >
                          {paymentStatus === "PAID"
                            ? "💳 "
                            : paymentStatus === "REFUND_PENDING"
                              ? "⏳ "
                              : "⚠️ "}
                          {getPaymentText(paymentStatus)}
                        </span>
                        {r.CancelReason && (
                          <div className="muted" style={{ marginTop: 8 }}>
                            <b>Lý do hủy:</b> {r.CancelReason}
                          </div>
                        )}
                        {r.RefundStatus && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            <b>Hoàn tiền:</b> {getRefundText(r.RefundStatus)}
                          </div>
                        )}
                        {String(r.Status || "").toUpperCase() ===
                          "REFUND_PENDING" && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            <b>Trạng thái:</b> Đang chờ hoàn tiền
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="action-row">
                        <Link
                          className="btn-detail"
                          to={`/customer/appointments/${r.AppointmentId}`}
                        >
                          Chi tiết
                        </Link>

                        {canPay(r.Status, r.PaymentStatus) && (
                          <button
                            type="button"
                            className="btn-pay"
                            disabled={loadingId === r.AppointmentId}
                            onClick={() => handlePay(r.AppointmentId)}
                          >
                            {loadingId === r.AppointmentId
                              ? "Đang xử lý..."
                              : "Thanh toán"}
                          </button>
                        )}

                        {canReviewAppointment(
                          r.Status,
                          r.AppointmentId,
                          r.ServiceId,
                        ) ? (
                          <button
                            type="button"
                            className="btn-pay"
                            onClick={() =>
                              navigate(
                                `/customer/feedback?appointmentId=${r.AppointmentId}&serviceId=${r.ServiceId || ""}`,
                              )
                            }
                          >
                            Đánh giá
                          </button>
                        ) : String(r.Status || "").toUpperCase() ===
                          "COMPLETED" ? (
                          <span
                            className="btn-pay"
                            style={{ cursor: "default" }}
                          >
                            Đã đánh giá
                          </span>
                        ) : null}

                        {canReschedule(r.Status) && (
                          <button
                            type="button"
                            className="btn-detail"
                            onClick={() =>
                              navigate(
                                `/customer/reschedule/${r.AppointmentId}`,
                              )
                            }
                          >
                            Đổi lịch
                          </button>
                        )}

                        {String(r.Status || "").toUpperCase() ===
                          "COMPLETED" && (
                          <button
                            type="button"
                            className="btn-again"
                            onClick={() =>
                              navigate(
                                `/customer/booking?serviceId=${r.ServiceId || ""}&employeeId=${r.EmployeeId || ""}`,
                              )
                            }
                          >
                            Đặt lại
                          </button>
                        )}

                        {canCancel(r.Status) && (
                          <button
                            type="button"
                            className="btn-cancel"
                            disabled={loadingId === r.AppointmentId}
                            onClick={() => openCancelModal(r)}
                          >
                            {loadingId === r.AppointmentId
                              ? "Đang hủy..."
                              : paymentStatus === "PAID"
                                ? "Hủy & hoàn"
                                : "Hủy"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="table-footer">
            <span>
              Hiển thị 1 - {filteredRows.length} của {filteredRows.length} lịch
              hẹn
            </span>
            <span className="page-dot">1</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
