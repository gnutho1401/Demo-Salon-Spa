import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const FALLBACK_SERVICE = "/images/default-service.png";
const FALLBACK_AVATAR = "/images/default-avatar.png";

function parseJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function dateText(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
}

function dateTextShort(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("vi-VN");
}

function dateTimeText(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 19)
    : date.toLocaleString("vi-VN");
}

function timeText(value) {
  if (!value) return "";

  if (value instanceof Date || (typeof value === "object" && typeof value.getHours === "function")) {
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  if (typeof value === "object" && value !== null) {
    const ms = value.ms !== undefined ? value.ms : value.milliseconds;
    if (typeof ms === "number") {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const str = String(value);
  if (str.includes("T")) {
    const parts = str.split("T")[1];
    if (parts) return parts.slice(0, 5);
  }

  const timeRegex = /(\d{2}):(\d{2})(?::\d{2})?/;
  const match = str.match(timeRegex);
  if (match) return `${match[1]}:${match[2]}`;

  return str.slice(0, 5);
}

function code(id) {
  return `AP${String(id || "").padStart(5, "0")}`;
}

function statusText(status) {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING: "Đang chờ",
    PAID: "Đã thanh toán",
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    IN_PROGRESS: "Đang thực hiện",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
    NO_SHOW: "Vắng mặt",
  };
  return map[s] || status || "Chưa rõ";
}

function statusEmoji(status) {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING_PAYMENT: "💳",
    PENDING: "⏳",
    CONFIRMED: "✅",
    CHECKED_IN: "📍",
    IN_PROGRESS: "✨",
    COMPLETED: "🌸",
    CANCELLED: "❌",
    REFUND_PENDING: "🔄",
    REFUNDED: "💰",
    NO_SHOW: "👻",
  };
  return map[s] || "📋";
}

function paymentText(status) {
  const s = String(status || "UNPAID").toUpperCase();
  const map = {
    UNPAID: "Chưa thanh toán",
    PENDING: "Đang chờ",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    REFUND_PENDING: "Chờ hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
  };
  return map[s] || status || "Chưa thanh toán";
}

function refundText(status) {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING: "Chờ hoàn tiền",
    PROCESSING: "Đang xử lý",
    APPROVED: "Đã duyệt",
    COMPLETED: "Đã hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
    REJECTED: "Từ chối",
  };
  return map[s] || status || "Chưa có";
}

function statusClass(status) {
  return String(status || "unknown").toLowerCase().replaceAll("_", "-");
}

function canPay(item) {
  const status = String(item?.Status || "").toUpperCase();
  const payment = String(item?.PaymentStatus || "UNPAID").toUpperCase();
  return status === "PENDING_PAYMENT" && ["UNPAID", "PENDING", "FAILED"].includes(payment);
}

function canCancel(item) {
  const status = String(item?.Status || "").toUpperCase();
  return ["PENDING_PAYMENT", "CONFIRMED"].includes(status);
}

function canReschedule(item) {
  const status = String(item?.Status || "").toUpperCase();
  return ["PENDING_PAYMENT", "CONFIRMED"].includes(status);
}

function canReview(item, services) {
  const status = String(item?.Status || "").toUpperCase();
  const notReviewed = services.some((s) => !Number(s.HasReviewed || 0));
  return status === "COMPLETED" && notReviewed;
}

const STEPS = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"];
const STEP_ICONS = ["💳", "✅", "📍", "✨", "🌸"];

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(`/appointments/${id}`);
      const data = res.data.data || res.data;
      setAppointment({
        ...data,
        Services: parseJson(data.ServicesJson),
        Payments: parseJson(data.PaymentsJson),
        Refunds: parseJson(data.RefundsJson),
        Reviews: parseJson(data.ReviewsJson),
        StatusHistory: parseJson(data.StatusHistoryJson),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được chi tiết lịch hẹn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const services = appointment?.Services || [];
  const payments = appointment?.Payments || [];
  const refunds = appointment?.Refunds || [];
  const reviews = appointment?.Reviews || [];
  const histories = appointment?.StatusHistory || [];

  const progress = useMemo(() => {
    const status = String(appointment?.Status || "").toUpperCase();
    if (["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status)) {
      return STEPS.indexOf("CONFIRMED");
    }
    const index = STEPS.indexOf(status);
    return index < 0 ? 0 : index;
  }, [appointment]);

  const isCancelled = ["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(
    String(appointment?.Status || "").toUpperCase()
  );

  async function submitCancel() {
    if (!cancelReason.trim()) {
      setError("Vui lòng nhập lý do hủy lịch");
      return;
    }
    try {
      setActionLoading(true);
      setError("");
      setMessage("");
      await axiosClient.delete(`/appointments/${id}`, { data: { reason: cancelReason.trim() } });
      setMessage(
        String(appointment?.PaymentStatus || "").toUpperCase() === "PAID"
          ? "Đã hủy lịch và tạo yêu cầu hoàn tiền"
          : "Hủy lịch hẹn thành công",
      );
      setCancelReason("");
      setShowCancel(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch hẹn thất bại");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="appointment-detail-pro loading">
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🌸</div>
          Đang tải chi tiết lịch hẹn...
        </div>
      </CustomerLayout>
    );
  }

  if (!appointment) {
    return (
      <CustomerLayout>
        <div className="appointment-detail-pro">
          <div className="appointment-empty-pro">
            <h2>Không tìm thấy lịch hẹn</h2>
            <Link to="/customer/appointments">← Quay lại danh sách</Link>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  const isCompleted = String(appointment.Status).toUpperCase() === "COMPLETED";

  return (
    <CustomerLayout>
      <div className="appointment-detail-pro">

        {/* ── TOP NAV ── */}
        <div className="appointment-detail-top">
          <Link to="/customer/appointments">← Quay lại lịch hẹn</Link>

          <div className="appointment-detail-actions">
            {canPay(appointment) && (
              <button
                type="button"
                onClick={() => navigate(`/customer/payment/${appointment.AppointmentId}`)}
              >
                💳 Thanh toán ngay
              </button>
            )}

            {canReschedule(appointment) && (
              <button
                type="button"
                className="soft"
                onClick={() => navigate(`/customer/reschedule/${appointment.AppointmentId}`)}
              >
                📅 Đổi lịch hẹn
              </button>
            )}

            {canReview(appointment, services) && (
              <button
                type="button"
                className="soft"
                onClick={() => navigate(`/customer/reviews?appointmentId=${appointment.AppointmentId}`)}
              >
                ⭐ Viết đánh giá
              </button>
            )}

            {isCompleted && (
              <button
                type="button"
                className="soft"
                onClick={() =>
                  navigate(`/customer/booking?serviceId=${appointment.ServiceId || ""}&employeeId=${appointment.EmployeeId || ""}`)
                }
              >
                🔁 Đặt lại dịch vụ
              </button>
            )}

            {canCancel(appointment) && (
              <button
                type="button"
                className="danger"
                onClick={() => setShowCancel(true)}
              >
                ✕ Hủy lịch hẹn
              </button>
            )}
          </div>
        </div>

        {message && <div className="appointment-alert success">✓ {message}</div>}
        {error && <div className="appointment-alert error">⚠ {error}</div>}

        {/* ── HERO BANNER ── */}
        <section className="appointment-hero-pro">
          <div>
            <span>Chi tiết lịch hẹn · Luna Salon</span>
            <h1>{code(appointment.AppointmentId)}</h1>
            <p>
              {appointment.ServiceNames || appointment.ServiceName || "Dịch vụ chăm sóc sắc đẹp"}{" "}
              · {dateTextShort(appointment.AppointmentDate)}{" "}
              · {timeText(appointment.StartTime)} – {timeText(appointment.EndTime)}
            </p>

            <div className="appointment-hero-tags">
              <b className={`status-pill status-${statusClass(appointment.Status)}`}>
                {statusEmoji(appointment.Status)} {statusText(appointment.Status)}
              </b>
              <b className={`payment-pill payment-${statusClass(appointment.PaymentStatus || "UNPAID")}`}>
                {paymentText(appointment.PaymentStatus)}
              </b>
              {appointment.CustomerPackageId && (
                <b className="package-pill">🎁 Dùng combo</b>
              )}
              {appointment.VoucherCode && (
                <b className="voucher-pill">🏷 {appointment.VoucherCode}</b>
              )}
              {appointment.InvoiceId && (
                <b style={{
                  display: "inline-flex", alignItems: "center", minHeight: 32,
                  padding: "0 14px", borderRadius: 999, background: "rgba(255,255,255,0.12)",
                  color: "#fff", border: "1px solid rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700
                }}>
                  📄 INV{String(appointment.InvoiceId).padStart(5, "0")}
                </b>
              )}
            </div>
          </div>

          <div className="appointment-total-card">
            <span>Tổng thanh toán</span>
            <strong>{money(appointment.FinalAmount)}</strong>
            <small>
              Tạm tính: {money(appointment.TotalAmount)}
            </small>
            {Number(appointment.DiscountAmount) > 0 && (
              <small style={{ color: "#ffe1ea", marginTop: 2 }}>
                🏷 Giảm: -{money(appointment.DiscountAmount)}
              </small>
            )}
            {appointment.BranchName && (
              <small style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
                📍 {appointment.BranchName}
              </small>
            )}
          </div>
        </section>

        {/* ── PROGRESS STEPS ── */}
        <section className="appointment-progress-pro">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className={`appointment-progress-step ${
                isCancelled && index === 1
                  ? "active cancelled"
                  : index <= progress && !isCancelled
                  ? "active"
                  : ""
              }`}
            >
              <span>{isCancelled && index === 1 ? "✕" : STEP_ICONS[index]}</span>
              <b>{isCancelled && index === 1 ? statusText(appointment.Status) : statusText(step)}</b>
            </div>
          ))}
        </section>

        {/* ── MAIN GRID ── */}
        <section className="appointment-detail-grid">

          {/* COL 1: Services (large) */}
          <div className="appointment-panel large">
            <div className="panel-head">
              <div>
                <span>Dịch vụ</span>
                <h3>Dịch vụ trong lịch hẹn</h3>
              </div>
              <b>{services.length || appointment.ServiceCount || 1} dịch vụ</b>
            </div>

            <div className="service-detail-list">
              {services.length ? (
                services.map((s) => (
                  <article key={s.AppointmentServiceId || s.ServiceId}>
                    <img
                      src={resolveFileUrl(s.ImageUrl) || FALLBACK_SERVICE}
                      alt={s.ServiceName}
                    />
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#ef4f83", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {s.CategoryName || "Beauty Service"}
                      </span>
                      <h4>{s.ServiceName}</h4>
                      <p>{s.Description || "Dịch vụ chăm sóc sắc đẹp tại salon."}</p>
                      <div className="service-detail-meta">
                        <b>{money(s.Price)}</b>
                        <small>⏱ {s.DurationMinutes || 0} phút</small>
                        {Number(s.HasReviewed || 0) ? (
                          <small className="reviewed">★ Đã đánh giá</small>
                        ) : isCompleted ? (
                          <small
                            style={{ cursor: "pointer", color: "#ef4f83", background: "#fff0f5", border: "1px solid #ffe1ea" }}
                            onClick={() => navigate(`/customer/reviews?appointmentId=${appointment.AppointmentId}`)}
                          >
                            ✎ Đánh giá ngay
                          </small>
                        ) : (
                          <small>Chưa đánh giá</small>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="appointment-empty-small">
                  Chưa có dữ liệu dịch vụ.
                </div>
              )}
            </div>
          </div>

          {/* COL 2: Technician */}
          <div className="appointment-panel">
            <div className="panel-head">
              <div>
                <span>Kỹ thuật viên</span>
                <h3>Người thực hiện</h3>
              </div>
            </div>

            <div className="employee-card-pro">
              <img
                src={resolveFileUrl(appointment.EmployeeImageUrl) || FALLBACK_AVATAR}
                alt={appointment.EmployeeName}
              />
              <div>
                <h4>{appointment.EmployeeName || "Chưa phân công"}</h4>
                <p>{appointment.Specialization || appointment.Position || "Beauty Expert"}</p>
                {appointment.EmployeePhone && (
                  <span>📞 {appointment.EmployeePhone}</span>
                )}
                {appointment.EmployeeEmail && (
                  <span>✉ {appointment.EmployeeEmail}</span>
                )}
              </div>
            </div>
          </div>

          {/* COL 2: Time & Booking Info */}
          <div className="appointment-panel">
            <div className="panel-head">
              <div>
                <span>Thông tin lịch</span>
                <h3>Thời gian &amp; địa điểm</h3>
              </div>
            </div>

            <div className="info-list-pro">
              <div>
                <span>📅 Ngày hẹn</span>
                <b>{dateText(appointment.AppointmentDate)}</b>
              </div>
              <div>
                <span>⏰ Giờ hẹn</span>
                <b>{timeText(appointment.StartTime)} – {timeText(appointment.EndTime)}</b>
              </div>
              <div>
                <span>⏱ Thời lượng</span>
                <b>{appointment.TotalDuration || 0} phút</b>
              </div>
              <div>
                <span>📍 Chi nhánh</span>
                <b>{appointment.BranchName || "Chưa có"}</b>
              </div>
              {appointment.CustomerPackageId && (
                <div>
                  <span>🎁 Combo dùng</span>
                  <b style={{ color: "#ef4f83" }}>#{appointment.CustomerPackageId}</b>
                </div>
              )}
              {appointment.Notes && (
                <div style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <span>📝 Ghi chú</span>
                  <b style={{ textAlign: "left", color: "#7c6175" }}>{appointment.Notes}</b>
                </div>
              )}
              <div>
                <span>🗓 Ngày đặt lịch</span>
                <b>{dateTimeText(appointment.CreatedAt)}</b>
              </div>
            </div>
          </div>

          {/* COL 2: Payment summary */}
          <div className="appointment-panel">
            <div className="panel-head">
              <div>
                <span>Hóa đơn</span>
                <h3>Thanh toán</h3>
              </div>
              {appointment.InvoiceId && (
                <b>INV{String(appointment.InvoiceId).padStart(5, "0")}</b>
              )}
            </div>

            <div className="price-box-pro">
              <div>
                <span>Tạm tính</span>
                <b>{money(appointment.TotalAmount)}</b>
              </div>
              {Number(appointment.DiscountAmount) > 0 && (
                <div>
                  <span>Giảm giá</span>
                  <b style={{ color: "#ef4f83" }}>-{money(appointment.DiscountAmount)}</b>
                </div>
              )}
              <div style={{ background: "#fff0f5", borderColor: "#ef4f83" }}>
                <span style={{ fontWeight: 700 }}>Thành tiền</span>
                <strong>{money(appointment.FinalAmount)}</strong>
              </div>
            </div>

            <div className="info-list-pro compact">
              {appointment.VoucherCode && (
                <div>
                  <span>🏷 Voucher</span>
                  <b style={{ color: "#ef4f83" }}>{appointment.VoucherCode}</b>
                </div>
              )}
              <div>
                <span>Trạng thái</span>
                <b>{paymentText(appointment.PaymentStatus)}</b>
              </div>
              {appointment.InvoiceStatus && (
                <div>
                  <span>Hóa đơn</span>
                  <b>{appointment.InvoiceStatus}</b>
                </div>
              )}
              {appointment.InvoiceCreatedAt && (
                <div>
                  <span>Ngày xuất HĐ</span>
                  <b>{dateTimeText(appointment.InvoiceCreatedAt)}</b>
                </div>
              )}
            </div>

            {canPay(appointment) && (
              <button
                type="button"
                style={{
                  marginTop: 14, width: "100%", padding: "13px",
                  background: "linear-gradient(135deg, #ef4f83, #ff5ea8)",
                  color: "#fff", border: "none", borderRadius: 14, fontWeight: 700,
                  cursor: "pointer", fontSize: "0.95rem",
                  boxShadow: "0 6px 18px rgba(239,79,131,0.25)",
                  transition: "all 0.2s"
                }}
                onClick={() => navigate(`/customer/payment/${appointment.AppointmentId}`)}
              >
                💳 Thanh toán ngay · {money(appointment.FinalAmount)}
              </button>
            )}
          </div>

          {/* COL 1: Payment History Timeline (large) */}
          <div className="appointment-panel large">
            <div className="panel-head">
              <div>
                <span>Timeline</span>
                <h3>Lịch sử trạng thái</h3>
              </div>
            </div>

            <div className="status-history-pro">
              {histories.length ? (
                histories.map((h) => (
                  <article key={h.HistoryId}>
                    <div className="history-icon">
                      {statusEmoji(h.NewStatus) || "✓"}
                    </div>
                    <div>
                      <h4>
                        {h.OldStatus ? `${statusText(h.OldStatus)} → ` : ""}
                        {statusText(h.NewStatus)}
                      </h4>
                      <p>{h.Reason || "Cập nhật trạng thái lịch hẹn"}</p>
                      <small>
                        🕐 {dateTimeText(h.ChangedAt)} · {h.ChangedByName || "Hệ thống"}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="appointment-empty-small">
                  Chưa có lịch sử trạng thái.
                </div>
              )}
            </div>
          </div>

          {/* COL 2: Payment transaction timeline */}
          <div className="appointment-panel">
            <div className="panel-head">
              <div>
                <span>Giao dịch</span>
                <h3>Lịch sử thanh toán</h3>
              </div>
            </div>

            <div className="mini-timeline-pro">
              {payments.length ? (
                payments.map((p) => (
                  <article key={p.PaymentId}>
                    <span className={`dot payment-${statusClass(p.Status)}`} />
                    <div>
                      <h4>{money(p.Amount)} · {paymentText(p.Status)}</h4>
                      <p>{p.PaymentMethod || "VNPay"} · {dateTimeText(p.PaidAt || p.CreatedAt)}</p>
                      {p.TransactionCode && <small>💳 Mã GD: {p.TransactionCode}</small>}
                      {p.VnpTxnRef && <small>🔖 VNP Ref: {p.VnpTxnRef}</small>}
                    </div>
                  </article>
                ))
              ) : (
                <div className="appointment-empty-small">
                  Chưa có giao dịch thanh toán.
                </div>
              )}
            </div>
          </div>

          {/* COL 2: Refunds */}
          {(refunds.length > 0 || isCancelled) && (
            <div className="appointment-panel">
              <div className="panel-head">
                <div>
                  <span>Hoàn tiền</span>
                  <h3>Yêu cầu hoàn tiền</h3>
                </div>
              </div>

              <div className="mini-timeline-pro">
                {refunds.length ? (
                  refunds.map((r) => (
                    <article key={r.RefundId}>
                      <span className={`dot refund-${statusClass(r.Status)}`} />
                      <div>
                        <h4>{money(r.RefundAmount)} · {refundText(r.Status)}</h4>
                        <p>{r.Reason || "Không có lý do"}</p>
                        {r.BankName && <small>🏦 {r.BankName} – {r.BankAccountNumber}</small>}
                        <small>🕐 {dateTimeText(r.RefundedAt || r.CreatedAt)}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="appointment-empty-small">
                    Chưa có yêu cầu hoàn tiền.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COL 2: Reviews */}
          <div className="appointment-panel">
            <div className="panel-head">
              <div>
                <span>Đánh giá</span>
                <h3>Nhận xét dịch vụ</h3>
              </div>
              {canReview(appointment, services) && (
                <button
                  type="button"
                  className="panel-mini-btn"
                  onClick={() => navigate(`/customer/reviews?appointmentId=${appointment.AppointmentId}`)}
                >
                  ✎ Viết đánh giá
                </button>
              )}
            </div>

            <div className="review-list-pro">
              {reviews.length ? (
                reviews.map((r) => (
                  <article key={r.ReviewId}>
                    <h4>{r.ServiceName}</h4>
                    <p>{"★".repeat(Number(r.Rating || 0))}{"☆".repeat(5 - Number(r.Rating || 0))}</p>
                    <span>{r.Comment || "Không có nội dung đánh giá"}</span>
                    {r.AdminResponse && (
                      <small>💬 Salon phản hồi: {r.AdminResponse}</small>
                    )}
                  </article>
                ))
              ) : (
                <div className="appointment-empty-small">
                  {isCompleted
                    ? "Bạn chưa đánh giá lịch hẹn này. Hãy chia sẻ trải nghiệm!"
                    : "Chưa có đánh giá."
                  }
                </div>
              )}
            </div>
          </div>

        </section>

        {/* ── CANCEL MODAL ── */}
        {showCancel && (
          <div
            className="cancel-modal-backdrop"
            onClick={() => setShowCancel(false)}
          >
            <div
              className="cancel-modal-pro"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="modal-close"
              >
                ×
              </button>

              <div className="cancel-icon-pro">⚠</div>
              <h3>Xác nhận hủy lịch hẹn</h3>
              <p>
                Nếu lịch đã thanh toán, hệ thống sẽ tạo yêu cầu hoàn tiền để salon xử lý.
              </p>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy lịch..."
                rows={4}
              />

              <div className="cancel-actions-pro">
                <button type="button" onClick={() => setShowCancel(false)}>
                  Giữ lịch
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={submitCancel}
                >
                  {actionLoading ? "Đang xử lý..." : "Xác nhận hủy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
