import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    appointmentDate: "",
    startTime: "",
  });

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(`/appointments/${id}`);
      const data = res.data.data || res.data;
      const history =
        typeof data?.StatusHistoryJson === "string" && data.StatusHistoryJson
          ? JSON.parse(data.StatusHistoryJson)
          : Array.isArray(data?.StatusHistoryJson)
            ? data.StatusHistoryJson
            : [];

      setAppointment({
        ...data,
        ParsedStatusHistory: history,
      });
      setRescheduleForm({
        appointmentDate: data?.AppointmentDate
          ? String(data.AppointmentDate).slice(0, 10)
          : "",
        startTime: data?.StartTime ? time(data.StartTime) : "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được chi tiết lịch hẹn",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    async function loadSlots() {
      if (
        !appointment?.EmployeeId ||
        !appointment?.ServiceId ||
        !rescheduleForm.appointmentDate
      ) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotLoading(true);

        const res = await axiosClient.get("/appointments/available-slots", {
          params: {
            employeeId: appointment.EmployeeId,
            serviceId: appointment.ServiceId,
            appointmentDate: rescheduleForm.appointmentDate,
            excludeAppointmentId: appointment.AppointmentId,
          },
        });

        setAvailableSlots(res.data.data || []);
      } catch (err) {
        setAvailableSlots([]);
        setError(err.response?.data?.message || "Không tải được giờ trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadSlots();
  }, [appointment, rescheduleForm.appointmentDate]);

  function money(v) {
    return Number(v || 0).toLocaleString("vi-VN") + "đ";
  }
  function date(v) {
    return v ? new Date(v).toLocaleDateString("vi-VN") : "Chưa có";
  }
  function time(v) {
    if (!v) return "";

    const text = String(v);

    if (text.includes("T")) {
      const afterT = text.split("T")[1];
      return afterT ? afterT.slice(0, 5) : "";
    }

    if (text.includes(":")) {
      return text.slice(0, 5);
    }

    return text;
  }
  function statusText(s) {
    s = String(s || "").toUpperCase();
    if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
    if (s === "CONFIRMED") return "Đã xác nhận";
    if (s === "COMPLETED") return "Hoàn thành";
    if (s === "CANCELLED") return "Đã hủy";
    if (s === "NO_SHOW") return "Vắng mặt";
    if (s === "REFUND_PENDING") return "Đang chờ hoàn tiền";
    if (s === "REFUNDED") return "Đã hoàn tiền";
    return s || "Chưa rõ";
  }
  function paymentText(s) {
    s = String(s || "UNPAID").toUpperCase();
    if (s === "PAID") return "Đã thanh toán";
    if (s === "PENDING") return "Đang chờ thanh toán";
    if (s === "FAILED") return "Thanh toán thất bại";
    if (s === "REFUND_PENDING") return "Đang chờ hoàn tiền";
    if (s === "REFUNDED") return "Đã hoàn tiền";
    return "Chưa thanh toán";
  }

  const status = String(appointment?.Status || "").toUpperCase();
  const paymentStatus = String(
    appointment?.PaymentStatus || "UNPAID",
  ).toUpperCase();
  const canCancel = ["PENDING_PAYMENT", "CONFIRMED"].includes(status);
  const canReschedule = ["PENDING_PAYMENT", "CONFIRMED"].includes(status);
  const canPay =
    ["PENDING_PAYMENT"].includes(status) &&
    ["UNPAID", "PENDING", "FAILED"].includes(paymentStatus);
  const canReview =
    status === "COMPLETED" &&
    Number(appointment?.ReviewCount || 0) <
      Number(appointment?.ServiceCount || 1);
  const isNoShow = status === "NO_SHOW";

  const statusHistory = appointment?.ParsedStatusHistory || [];

  async function submitCancel(e) {
    e.preventDefault();
    if (!cancelReason.trim()) return setError("Vui lòng nhập lý do hủy lịch");
    try {
      setError("");
      setMessage("");
      await axiosClient.delete(`/appointments/${id}`, {
        data: { reason: cancelReason },
      });
      setMessage(
        paymentStatus === "PAID"
          ? "Đã gửi yêu cầu hủy lịch và hoàn tiền"
          : "Hủy lịch hẹn thành công",
      );
      setShowCancel(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch thất bại");
    }
  }

  async function submitReschedule(e) {
    e.preventDefault();

    if (!rescheduleForm.appointmentDate) {
      return setError("Vui lòng chọn ngày mới");
    }

    if (!rescheduleForm.startTime) {
      return setError("Vui lòng chọn giờ mới");
    }

    const selectedSlot = availableSlots.find(
      (slot) =>
        String(slot.startTime).slice(0, 5) ===
        String(rescheduleForm.startTime).slice(0, 5),
    );

    if (!selectedSlot) {
      return setError(
        "Vui lòng chọn giờ trống từ danh sách, không nhập giờ tùy ý",
      );
    }

    const today = new Date().toISOString().split("T")[0];
    if (rescheduleForm.appointmentDate < today)
      return setError("Không được đổi lịch về ngày trong quá khứ");
    try {
      setError("");
      setMessage("");
      await axiosClient.put(`/appointments/${id}`, {
        appointmentDate: rescheduleForm.appointmentDate,
        startTime: selectedSlot.startTime,
      });
      setMessage("Đổi lịch thành công");
      setShowReschedule(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    }
  }

  return (
    <CustomerLayout>
      <style>{`
  .detail-page {
    padding: 28px 0 60px;
    background:
      radial-gradient(circle at 20% 10%, rgba(255, 92, 154, .12), transparent 28%),
      radial-gradient(circle at 90% 20%, rgba(255, 190, 220, .18), transparent 30%),
      linear-gradient(135deg, #fff7fb 0%, #ffffff 55%, #fff3f8 100%);
  }

  .detail-hero {
    position: relative;
    overflow: hidden;
    min-height: 190px;
    padding: 38px 44px;
    margin-bottom: 26px;
    border: 1px solid #ffd3e4;
    border-radius: 32px;
    background:
      linear-gradient(120deg, rgba(255,255,255,.92), rgba(255,240,248,.88)),
      url("https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=80");
    background-size: cover;
    background-position: center right;
    box-shadow: 0 28px 70px rgba(255, 75, 140, .16);
  }

  .detail-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(255,255,255,.72), rgba(255,255,255,.2));
    z-index: 0;
  }

  .detail-hero > * {
    position: relative;
    z-index: 1;
  }

  .detail-hero h2 {
    margin: 0;
    font-size: 42px;
    font-weight: 950;
    color: #181827;
    letter-spacing: -1px;
  }

  .detail-hero h2::after {
    content: " ✨";
    color: #ff4f92;
  }

  .muted {
    color: #767082;
    line-height: 1.6;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1.35fr .75fr;
    gap: 24px;
  }

  .detail-card {
    position: relative;
    background: rgba(255,255,255,.86);
    backdrop-filter: blur(16px);
    border: 1px solid #ffd8e8;
    border-radius: 30px;
    padding: 28px;
    box-shadow: 0 22px 60px rgba(255, 75, 140, .12);
    transition: .3s ease;
  }

  .detail-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 30px 80px rgba(255, 75, 140, .18);
  }

  .detail-card h3 {
    margin: 0 0 20px;
    font-size: 22px;
    color: #171727;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .detail-card h3::before {
    content: "🌸";
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    background: linear-gradient(135deg, #ff4f92, #ff9ac2);
    color: #fff;
    box-shadow: 0 12px 25px rgba(255, 79, 146, .28);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .info-box {
    position: relative;
    overflow: hidden;
    min-height: 92px;
    background: linear-gradient(135deg, #fff, #fff5fa);
    border: 1px solid #ffd6e7;
    border-radius: 22px;
    padding: 18px 18px 18px 62px;
    transition: .25s ease;
  }

  .info-box:hover {
    transform: translateY(-3px) scale(1.01);
    border-color: #ff8fbb;
    box-shadow: 0 16px 35px rgba(255, 79, 146, .13);
  }

  .info-box::before {
    content: "✦";
    position: absolute;
    left: 18px;
    top: 22px;
    width: 32px;
    height: 32px;
    border-radius: 13px;
    background: #fff0f6;
    color: #ff4f92;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
  }

  .info-box b {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    color: #5d5363;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border-radius: 999px;
    font-weight: 900;
    font-size: 13px;
    background: #eafff2;
    color: #16a34a;
  }

  .badge::before {
    content: "✓";
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 20px;
  }

  .btn,
  .btn-outline,
  .btn-soft,
  .btn-danger {
    border-radius: 15px !important;
    padding: 13px 22px !important;
    font-weight: 900 !important;
    transition: .25s ease;
  }

  .btn:hover,
  .btn-outline:hover,
  .btn-soft:hover,
  .btn-danger:hover {
    transform: translateY(-2px);
  }

  .btn-danger {
    border: none;
    background: linear-gradient(135deg, #ff4b4b, #ff2f75);
    color: white;
    box-shadow: 0 16px 30px rgba(255, 47, 117, .25);
  }

  .btn-soft {
    background: #fff0f6;
    color: #ff3f86;
    border: 1px solid #ffc2da;
  }

  .form-row {
    margin-top: 24px;
    padding: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 14px;
    align-items: end;
    border: 1px solid #efd3ff;
    border-radius: 24px;
    background:
      radial-gradient(circle at top right, rgba(211, 89, 255, .12), transparent 30%),
      linear-gradient(135deg, #fff7ff, #fff);
    animation: fadeUp .35s ease;
  }

  .form-row h3 {
    grid-column: 1 / -1;
    margin-bottom: 0;
  }

  .form-row input,
  .form-row select,
  .form-row textarea {
    width: 100%;
    border: 1px solid #efd8e1;
    border-radius: 16px;
    padding: 14px 16px;
    background: #fff;
    outline: none;
    transition: .25s ease;
  }

  .form-row input:focus,
  .form-row select:focus,
  .form-row textarea:focus {
    border-color: #ff4f92;
    box-shadow: 0 0 0 4px rgba(255, 79, 146, .12);
  }

  .form-row button {
    min-width: 180px;
    height: 48px;
    border: none;
    border-radius: 16px;
    background: linear-gradient(135deg, #ff4f92, #d946ef);
    color: #fff;
    font-weight: 900;
    box-shadow: 0 18px 38px rgba(217, 70, 239, .25);
  }

  .price-line {
    display: flex;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid #f4e1e9;
    font-size: 16px;
  }

  .price-line.total {
    margin-top: 8px;
    padding-top: 22px;
    font-size: 24px;
    font-weight: 950;
    color: #ff3f86;
    border-bottom: none;
  }

  .detail-card:nth-child(2) {
    background:
      radial-gradient(circle at top right, rgba(255, 79, 146, .12), transparent 30%),
      rgba(255,255,255,.9);
  }

  .detail-card:nth-child(2)::after {
    content: "🔒 Thanh toán của bạn được bảo mật tuyệt đối";
    display: block;
    margin-top: 24px;
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(135deg, #fff0f6, #fff);
    border: 1px solid #ffd2e4;
    color: #ff3f86;
    font-weight: 800;
  }

  .alert {
    margin-bottom: 18px;
    padding: 14px 18px;
    border-radius: 16px;
    font-weight: 800;
  }

  .alert.success {
    background: #eafff2;
    color: #16a34a;
    border: 1px solid #b7f7ce;
  }

  .alert.error {
    background: #fff1f2;
    color: #e11d48;
    border: 1px solid #fecdd3;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media(max-width: 1000px) {
    .detail-grid,
    .info-grid,
    .form-row {
      grid-template-columns: 1fr;
    }

    .detail-hero h2 {
      font-size: 32px;
    }
  }
`}</style>
      <div className="detail-page">
        <div className="detail-hero">
          <h2>Chi tiết lịch hẹn #{id}</h2>
          <p className="muted">
            Xem thông tin dịch vụ, kỹ thuật viên, hóa đơn và thao tác với lịch
            hẹn.
          </p>
        </div>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        {loading ? (
          <p>Đang tải...</p>
        ) : !appointment ? (
          <p>Không tìm thấy lịch hẹn</p>
        ) : (
          <div className="detail-grid">
            <div className="detail-card">
              <h3>Thông tin lịch hẹn</h3>
              <div className="info-grid">
                <div className="info-box">
                  <b>Dịch vụ</b>
                  {appointment.ServiceNames || "Dịch vụ"}
                </div>
                <div className="info-box">
                  <b>Kỹ thuật viên</b>
                  {appointment.EmployeeName || "Chưa có"}
                </div>
                <div className="info-box">
                  <b>Ngày hẹn</b>
                  {date(appointment.AppointmentDate)}
                </div>
                <div className="info-box">
                  <b>Thời gian</b>
                  {time(appointment.StartTime)} - {time(appointment.EndTime)}
                </div>
                <div className="info-box">
                  <b>Trạng thái</b>
                  <span className="badge" style={isNoShow ? { background: '#fff1f2', color: '#e11d48' } : undefined}>
                    {statusText(appointment.Status)}
                  </span>
                </div>
                <div className="info-box">
                  <b>Thanh toán</b>
                  <span className="badge">
                    {paymentText(appointment.PaymentStatus)}
                  </span>
                </div>
                <div className="info-box">
                  <b>Lý do hủy</b>
                  {appointment.CancelReason || "Chưa có"}
                </div>
                <div className="info-box">
                  <b>Trạng thái hoàn tiền</b>
                  {appointment.RefundStatus
                    ? paymentText(appointment.RefundStatus)
                    : "Chưa có"}
                </div>
              </div>
              <p className="muted">
                <b>Ghi chú:</b>
                <br />
                {appointment.Notes || "Không có ghi chú"}
              </p>

              {(appointment.RefundStatus || status === "REFUND_PENDING") && (
                <div className="dashboard-card" style={{ marginTop: 18 }}>
                  <h3>Chi tiết hoàn tiền</h3>
                  <div className="price-line">
                    <span>Trạng thái</span>
                    <b>
                      {appointment.RefundStatus
                        ? statusText(appointment.RefundStatus)
                        : "Đang chờ hoàn tiền"}
                    </b>
                  </div>
                  <div className="price-line">
                    <span>Số tiền</span>
                    <b>{money(appointment.RefundAmount)}</b>
                  </div>
                  <div className="price-line">
                    <span>Lý do</span>
                    <b>{appointment.RefundReason || appointment.CancelReason || "Chưa có"}</b>
                  </div>
                  <div className="price-line">
                    <span>Ngày hoàn tiền</span>
                    <b>{appointment.RefundDate ? date(appointment.RefundDate) : "Chưa có"}</b>
                  </div>
                </div>
              )}

              {statusHistory.length > 0 && (
                <div className="dashboard-card" style={{ marginTop: 18 }}>
                  <h3>Lịch sử trạng thái</h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    {statusHistory.map((item, index) => (
                      <div key={`${item.AppointmentStatusHistoryId || index}`} className="mini-item">
                        <strong>
                          {item.OldStatus ? `${statusText(item.OldStatus)} → ` : ""}
                          {statusText(item.NewStatus)}
                        </strong>
                        <span>{item.Reason || "Không có ghi chú"}</span>
                        <span className="status">
                          {item.ChangedByName || "Hệ thống"} • {item.CreatedAt ? date(item.CreatedAt) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="actions">
                <Link className="btn btn-outline" to="/customer/appointments">
                  Quay lại
                </Link>
                {canPay && (
                  <button
                    className="btn"
                    onClick={() => navigate(`/customer/payment/${id}`)}
                  >
                    Thanh toán
                  </button>
                )}
                {canReschedule && (
                  <button
                    className="btn btn-soft"
                    onClick={() => setShowReschedule(!showReschedule)}
                  >
                    Đổi lịch
                  </button>
                )}
                {canCancel && (
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowCancel(!showCancel)}
                  >
                    {paymentStatus === "PAID"
                      ? "Hủy & tạo hoàn tiền"
                      : "Hủy lịch"}
                  </button>
                )}
                {canReview && (
                  <Link
                    className="btn"
                    to={`/customer/feedback?appointmentId=${id}&serviceId=${appointment.ServiceId || ""}`}
                  >
                    Đánh giá
                  </Link>
                )}
              </div>
              {showReschedule && (
                <form className="form-row" onSubmit={submitReschedule}>
                  <h3>Đổi lịch hẹn</h3>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleForm.appointmentDate}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        appointmentDate: e.target.value,
                        startTime: "",
                      })
                    }
                  />
                  <select
                    value={rescheduleForm.startTime}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        startTime: e.target.value,
                      })
                    }
                  >
                    <option value="">Chọn giờ mới</option>
                    {slotLoading ? (
                      <option disabled>Đang tải giờ trống...</option>
                    ) : availableSlots.length > 0 ? (
                      availableSlots.map((slot) => (
                        <option key={slot.startTime} value={slot.startTime}>
                          {time(slot.startTime)} - {time(slot.endTime)}
                        </option>
                      ))
                    ) : (
                      <option disabled>Ngày này không còn giờ trống</option>
                    )}
                  </select>
                  <button
                    className="btn"
                    disabled={slotLoading || availableSlots.length === 0}
                  >
                    Lưu đổi lịch
                  </button>
                </form>
              )}
              {showCancel && (
                <form className="form-row" onSubmit={submitCancel}>
                  <h3>Lý do hủy lịch</h3>
                  <textarea
                    rows="4"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ví dụ: Tôi bận đột xuất..."
                  />
                  <button className="btn btn-danger">Xác nhận hủy</button>
                </form>
              )}
            </div>
            <div className="detail-card">
              <h3>Hóa đơn & thanh toán</h3>

              <div className="price-line">
                <span>Mã hóa đơn</span>
                <b>
                  {appointment.InvoiceId
                    ? `#${appointment.InvoiceId}`
                    : "Chưa có"}
                </b>
              </div>

              <div className="price-line">
                <span>Tạm tính</span>
                <b>{money(appointment.TotalAmount)}</b>
              </div>

              <div className="price-line">
                <span>Voucher</span>
                <b>{appointment.VoucherCode || "Không dùng"}</b>
              </div>

              <div className="price-line">
                <span>Giảm giá</span>
                <b>- {money(appointment.DiscountAmount)}</b>
              </div>

              <div className="price-line total">
                <span>Thành tiền</span>
                <span>
                  {money(appointment.FinalAmount || appointment.TotalAmount)}
                </span>
              </div>

              <div className="price-line">
                <span>Trạng thái thanh toán</span>
                <b>{paymentText(appointment.PaymentStatus)}</b>
              </div>

              <div className="price-line">
                <span>Phương thức</span>
                <b>{appointment.PaymentMethod || "Chưa thanh toán"}</b>
              </div>

              <div className="price-line">
                <span>Mã giao dịch</span>
                <b>
                  {appointment.TransactionCode ||
                    appointment.VnpTxnRef ||
                    "Chưa có"}
                </b>
              </div>

              <div className="price-line">
                <span>Mã VNPay</span>
                <b>{appointment.VnpTransactionNo || "Chưa có"}</b>
              </div>

              <div className="price-line">
                <span>Ngày thanh toán</span>
                <b>
                  {appointment.PaidAt
                    ? date(appointment.PaidAt)
                    : "Chưa thanh toán"}
                </b>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
