import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

const STATUS_OPTIONS = [
  ["ALL", "Tất cả trạng thái"],
  ["PENDING_PAYMENT", "Chờ thanh toán"],
  ["CONFIRMED", "Đã xác nhận"],
  ["CHECKED_IN", "Đã check-in"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"],
  ["REFUND_PENDING", "Chờ hoàn tiền"],
  ["NO_SHOW", "Vắng mặt"],
];

const PAYMENT_OPTIONS = [
  ["ALL", "Tất cả thanh toán"],
  ["UNPAID", "Chưa thanh toán"],
  ["PENDING", "Đang chờ"],
  ["PAID", "Đã thanh toán"],
  ["FAILED", "Thất bại"],
  ["REFUND_PENDING", "Chờ hoàn tiền"],
  ["REFUNDED", "Đã hoàn tiền"],
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  if (!value) return "Chưa có";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.includes(":") ? text.slice(0, 5) : text;
}

function getAppointmentCode(id) {
  return `AP${String(id || "").padStart(5, "0")}`;
}

function statusText(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (s === "CONFIRMED") return "Đã xác nhận";
  if (s === "CHECKED_IN") return "Đã check-in";
  if (s === "IN_PROGRESS") return "Đang thực hiện";
  if (s === "COMPLETED") return "Hoàn thành";
  if (s === "CANCELLED") return "Đã hủy";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  if (s === "NO_SHOW") return "Vắng mặt";
  return status || "Chưa rõ";
}

function paymentText(status) {
  const s = String(status || "UNPAID").toUpperCase();
  if (s === "PAID") return "Đã thanh toán";
  if (s === "PENDING") return "Đang chờ thanh toán";
  if (s === "FAILED") return "Thanh toán thất bại";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  if (s === "REFUNDED") return "Đã hoàn tiền";
  return "Chưa thanh toán";
}

function refundText(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "Chờ hoàn tiền";
  if (s === "PROCESSING") return "Đang xử lý";
  if (s === "APPROVED") return "Đã duyệt";
  if (s === "REFUNDED") return "Đã hoàn tiền";
  if (s === "REJECTED") return "Từ chối";
  return status || "Chưa có";
}

function canPay(row) {
  const s = String(row.Status || "").toUpperCase();
  const p = String(row.PaymentStatus || "UNPAID").toUpperCase();

  return s === "PENDING_PAYMENT" && ["UNPAID", "PENDING", "FAILED"].includes(p);
}

function canCancel(row) {
  const s = String(row.Status || "").toUpperCase();
  return ["PENDING_PAYMENT", "CONFIRMED"].includes(s);
}

function canReschedule(row) {
  const s = String(row.Status || "").toUpperCase();
  return ["PENDING_PAYMENT", "CONFIRMED"].includes(s);
}

function canReview(row) {
  const s = String(row.Status || "").toUpperCase();
  return (
    s === "COMPLETED" &&
    Number(row.ReviewCount || 0) < Number(row.ServiceCount || 1)
  );
}

const POPULAR_BANKS = [
  { bin: "970436", name: "VCB - Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970423", name: "TPBank" },
  { bin: "970419", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970448", name: "OCB" }
];

export default function MyAppointments() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [bankList, setBankList] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [cancelModal, setCancelModal] = useState({
    open: false,
    appointment: null,
    reason: "",
  });

  useEffect(() => {
    fetch("https://api.vietqr.io/v2/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data) {
          setBankList(data.data.map(b => ({ bin: b.bin, name: `${b.shortName} - ${b.name}` })));
        } else {
          setBankList(POPULAR_BANKS);
        }
      })
      .catch(() => {
        setBankList(POPULAR_BANKS);
      });
  }, []);

  async function loadAppointments() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/appointments/my");
      setRows(res.data.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch hẹn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const filteredRows = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return [...rows]
      .sort((a, b) => {
        const da = `${a.AppointmentDate || ""} ${a.StartTime || ""}`;
        const db = `${b.AppointmentDate || ""} ${b.StartTime || ""}`;
        return (
          db.localeCompare(da) ||
          Number(b.AppointmentId || 0) - Number(a.AppointmentId || 0)
        );
      })
      .filter((r) => {
        const status = String(r.Status || "").toUpperCase();
        const payment = String(r.PaymentStatus || "UNPAID").toUpperCase();
        const date = String(r.AppointmentDate || "").slice(0, 10);

        let statusOk = false;
        if (statusFilter === "ALL") {
          statusOk = true;
        } else if (statusFilter === "IN_PROGRESS") {
          statusOk = ["IN_PROGRESS", "CHECKED_IN"].includes(status);
        } else if (statusFilter === "CANCELLED") {
          statusOk = ["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status);
        } else {
          statusOk = status === statusFilter;
        }

        const paymentOk = paymentFilter === "ALL" || payment === paymentFilter;
        const fromOk = !fromDate || date >= fromDate;
        const toOk = !toDate || date <= toDate;

        const keywordOk =
          !text ||
          getAppointmentCode(r.AppointmentId).toLowerCase().includes(text) ||
          String(r.ServiceNames || r.ServiceName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.EmployeeName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.BranchName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.Notes || "")
            .toLowerCase()
            .includes(text);

        return statusOk && paymentOk && fromOk && toOk && keywordOk;
      });
  }, [rows, keyword, statusFilter, paymentFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const total = rows.length;

    const active = rows.filter((r) =>
      ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(
        String(r.Status || "").toUpperCase(),
      ),
    ).length;

    const completed = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "COMPLETED",
    ).length;

    const spent = rows
      .filter((r) => String(r.PaymentStatus || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + Number(r.FinalAmount || 0), 0);

    return { total, active, completed, spent };
  }, [rows]);

  function openCancelModal(row) {
    setError("");
    setMessage("");
    setCancelModal({
      open: true,
      appointment: row,
      reason: "",
    });
    setBankCode("");
    setAccountNumber("");
    setAccountName("");
  }

  function closeCancelModal() {
    setCancelModal({
      open: false,
      appointment: null,
      reason: "",
    });
  }

  async function submitCancel() {
    const appointmentId = cancelModal.appointment?.AppointmentId;

    if (!appointmentId) {
      setError("Không tìm thấy lịch hẹn cần hủy");
      return;
    }

    if (!cancelModal.reason.trim()) {
      setError("Vui lòng nhập lý do hủy lịch");
      return;
    }

    const paymentStatus = String(
      cancelModal.appointment?.PaymentStatus || "",
    ).toUpperCase();
    const paymentMethod = String(
      cancelModal.appointment?.PaymentMethod || "",
    ).toUpperCase();
    const hasPaid = paymentStatus === "PAID" && paymentMethod !== "PACKAGE";

    if (hasPaid) {
      if (!bankCode) {
        setError("Vui lòng chọn ngân hàng nhận hoàn tiền");
        return;
      }
      if (!accountNumber.trim()) {
        setError("Vui lòng nhập số tài khoản nhận hoàn tiền");
        return;
      }
      if (!accountName.trim()) {
        setError("Vui lòng nhập tên chủ tài khoản");
        return;
      }
    }

    try {
      setLoadingId(appointmentId);
      setError("");
      setMessage("");

      await axiosClient.delete(`/appointments/${appointmentId}`, {
        data: {
          reason: cancelModal.reason.trim(),
          bankCode,
          accountNumber,
          accountName: accountName.trim().toUpperCase()
        },
      });

      const paymentStatus = String(
        cancelModal.appointment?.PaymentStatus || "",
      ).toUpperCase();

      setMessage(
        paymentStatus === "PAID"
          ? "Đã hủy lịch và gửi yêu cầu hoàn tiền"
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

  function clearFilter() {
    setKeyword("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setFromDate("");
    setToDate("");
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
                Vui lòng nhập lý do hủy để salon xử lý lịch hẹn, thanh toán và
                hoàn tiền chính xác.
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
                    {cancelModal.appointment?.ServiceNames ||
                      cancelModal.appointment?.ServiceName ||
                      "Dịch vụ"}
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

              {String(
                cancelModal.appointment?.PaymentStatus || "",
              ).toUpperCase() === "PAID" && (
                <div className="refund-warning">
                  Lịch này đã thanh toán. Sau khi hủy, hệ thống sẽ tạo yêu cầu
                  hoàn tiền qua cổng PayOS.
                </div>
              )}

              {String(
                cancelModal.appointment?.PaymentStatus || "",
              ).toUpperCase() === "PAID" && (
                <div className="bank-refund-fields" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '15px 0', padding: '12px', border: '1px solid #ffe3e3', borderRadius: '8px', backgroundColor: '#fff9f9' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#d32f2f', fontSize: '14px' }}>Thông tin tài khoản nhận hoàn tiền</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', textAlign: 'left' }}>Ngân hàng nhận:</label>
                    <select
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }}
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                    >
                      <option value="">-- Chọn ngân hàng --</option>
                      {bankList.map((b) => (
                        <option key={b.bin} value={b.bin}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', textAlign: 'left' }}>Số tài khoản:</label>
                    <input
                      type="text"
                      placeholder="Nhập số tài khoản..."
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', textAlign: 'left' }}>Tên chủ tài khoản (viết hoa không dấu):</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: NGUYEN VAN A"
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }}
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              <label className="cancel-label">Lý do hủy lịch</label>

              <textarea
                className="cancel-textarea"
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="Ví dụ: Tôi bận đột xuất, muốn hủy lịch..."
                rows={4}
              />

              <div className="cancel-modal-actions">
                <button
                  type="button"
                  className="cancel-keep-btn"
                  onClick={closeCancelModal}
                >
                  Giữ lịch
                </button>

                <button
                  type="button"
                  className="cancel-confirm-btn"
                  onClick={submitCancel}
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
              Theo dõi dịch vụ, kỹ thuật viên, trạng thái lịch hẹn, thanh toán
              và hoàn tiền.
            </p>
          </div>

          <Link className="btn" to="/customer/booking">
            Đặt lịch mới
          </Link>
        </div>

        <div className="stats">
          <div 
            className="dashboard-card" 
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("ALL")}
          >
            <h3>Tổng lịch hẹn</h3>
            <strong>{stats.total}</strong>
            <p className="muted">Tất cả lịch đã đặt</p>
          </div>

          <div 
            className="dashboard-card" 
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            <h3>Đang hoạt động</h3>
            <strong>{stats.active}</strong>
            <p className="muted">Chờ thanh toán / xác nhận / đang làm</p>
          </div>

          <div 
            className="dashboard-card" 
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("COMPLETED")}
          >
            <h3>Hoàn thành</h3>
            <strong>{stats.completed}</strong>
            <p className="muted">Lịch đã sử dụng dịch vụ</p>
          </div>

          <div className="dashboard-card">
            <h3>Tổng chi tiêu</h3>
            <strong>{formatMoney(stats.spent)}</strong>
            <p className="muted">Các lịch đã thanh toán</p>
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        {/* Tabs Phân loại Lịch hẹn */}
        <div className="service-history-tabs" style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={statusFilter === "ALL" ? "active" : ""}
            onClick={() => setStatusFilter("ALL")}
          >
            Tất cả ({rows.length})
          </button>
          <button
            type="button"
            className={statusFilter === "PENDING_PAYMENT" ? "active" : ""}
            onClick={() => setStatusFilter("PENDING_PAYMENT")}
          >
            Chờ thanh toán ({rows.filter(r => String(r.Status).toUpperCase() === "PENDING_PAYMENT").length})
          </button>
          <button
            type="button"
            className={statusFilter === "CONFIRMED" ? "active" : ""}
            onClick={() => setStatusFilter("CONFIRMED")}
          >
            Đã xác nhận ({rows.filter(r => String(r.Status).toUpperCase() === "CONFIRMED").length})
          </button>
          <button
            type="button"
            className={statusFilter === "IN_PROGRESS" ? "active" : ""}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            Đang làm ({rows.filter(r => ["IN_PROGRESS", "CHECKED_IN"].includes(String(r.Status).toUpperCase())).length})
          </button>
          <button
            type="button"
            className={statusFilter === "COMPLETED" ? "active" : ""}
            onClick={() => setStatusFilter("COMPLETED")}
          >
            Hoàn thành ({rows.filter(r => String(r.Status).toUpperCase() === "COMPLETED").length})
          </button>
          <button
            type="button"
            className={statusFilter === "CANCELLED" ? "active" : ""}
            onClick={() => setStatusFilter("CANCELLED")}
          >
            Đã hủy / Vắng mặt ({rows.filter(r => ["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(String(r.Status).toUpperCase())).length})
          </button>
        </div>

        <div className="dashboard-card appointment-filter-card">
          <input
            className="filter-input"
            placeholder="Tìm mã lịch, dịch vụ, kỹ thuật viên, chi nhánh..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            className="filter-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            {PAYMENT_OPTIONS.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
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

          <button className="card-btn" type="button" onClick={clearFilter}>
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
                <th>Thành tiền</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Đang tải lịch hẹn...
                  </td>
                </tr>
              )}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Không có lịch hẹn phù hợp
                  </td>
                </tr>
              )}

              {!loading &&
                filteredRows.map((r) => {
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
                              {r.ServiceNames || r.ServiceName || "Dịch vụ"}
                            </div>
                            <div className="muted">
                              {r.ServiceCount > 1
                                ? `${r.ServiceCount} dịch vụ trong lịch hẹn`
                                : r.Notes
                                  ? `Ghi chú: ${r.Notes}`
                                  : "Dịch vụ chăm sóc sắc đẹp"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <b>{r.EmployeeName || "Chưa phân công"}</b>
                        {r.BranchName && (
                          <div className="muted">{r.BranchName}</div>
                        )}
                      </td>

                      <td>{formatDate(r.AppointmentDate)}</td>

                      <td>
                        <b>
                          {formatTime(r.StartTime)} - {formatTime(r.EndTime)}
                        </b>
                      </td>

                      <td>
                        <b>
                          {formatMoney(
                            r.FinalAmount || r.TotalAmount || r.TotalPrice,
                          )}
                        </b>
                        {Number(r.DiscountAmount || 0) > 0 && (
                          <div className="muted">
                            Giảm {formatMoney(r.DiscountAmount)}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-badge status-${status.toLowerCase()}`}
                        >
                          {statusText(status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`payment-badge ${
                            paymentStatus === "PAID"
                              ? "payment-paid"
                              : paymentStatus === "REFUND_PENDING"
                                ? "status-pending"
                                : "payment-unpaid"
                          }`}
                        >
                          {paymentText(paymentStatus)}
                        </span>

                        {r.RefundStatus && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            Hoàn tiền: {refundText(r.RefundStatus)}
                          </div>
                        )}

                        {r.CancelReason && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            Lý do hủy: {r.CancelReason}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="action-row">
                          <Link
                            className="btn-detail"
                            to={`/customer/appointments/${r.AppointmentId}`}
                          >
                            Chi tiết
                          </Link>

                          {canPay(r) && (
                            <button
                              type="button"
                              className="btn-pay"
                              onClick={() =>
                                navigate(`/customer/payment/${r.AppointmentId}`)
                              }
                            >
                              Thanh toán
                            </button>
                          )}

                          {canReschedule(r) && (
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

                          {canReview(r) && (
                            <button
                              type="button"
                              className="btn-pay"
                              onClick={() =>
                                navigate(
                                  `/customer/reviews?appointmentId=${r.AppointmentId}`,
                                )
                              }
                            >
                              Đánh giá
                            </button>
                          )}

                          {status === "COMPLETED" && (
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

                          {canCancel(r) && (
                            <button
                              type="button"
                              className="btn-cancel"
                              disabled={loadingId === r.AppointmentId}
                              onClick={() => openCancelModal(r)}
                            >
                              {paymentStatus === "PAID" ? "Hủy & hoàn" : "Hủy"}
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
              Hiển thị {filteredRows.length} / {rows.length} lịch hẹn
            </span>
            <span className="page-dot">1</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
