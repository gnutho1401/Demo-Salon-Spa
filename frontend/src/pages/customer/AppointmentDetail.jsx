import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import "../../styles/pages/customer-appointment-detail-v2.css";

const FALLBACK_SERVICE = "/images/services/default-service.png";
const FALLBACK_AVATAR = "/images/avatars/default-avatar.png";

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
  const isBilledUnderPackage = item?.CustomerPackageId != null;

  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) return false;
  if (payment === "PAID" || isBilledUnderPackage) return false;

  return ["UNPAID", "PENDING", "FAILED"].includes(payment);
}

function canCancel(item) {
  const status = String(item?.Status || "").toUpperCase();
  return ["PENDING", "PENDING_PAYMENT", "CONFIRMED"].includes(status);
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

function formatName(name) {
  if (!name) return "Hệ thống";
  const lower = String(name).toLowerCase().trim();
  if (lower === "system") return "Hệ thống";
  if (lower === "automatch" || lower === "auto-match") return "Hệ thống tự động";
  if (lower === "scheduler") return "Hệ thống tự động";
  if (lower === "receptionist") return "Lễ tân";
  if (lower === "admin") return "Quản trị viên";
  if (lower === "customer") return "Khách hàng";
  return name;
}

function formatReason(reason) {
  if (!reason) return "Hệ thống tự động cập nhật trạng thái.";

  const lower = String(reason).toLowerCase();

  if (lower.includes("customer created appointment and waiting for payment")) {
    return "Khách hàng tạo lịch hẹn và đang chờ thanh toán.";
  }
  if (lower.includes("receptionist checked in customer")) {
    return "Lễ tân ghi nhận khách hàng đã check-in.";
  }
  if (lower.includes("receptionist started service")) {
    return "Lễ tân ghi nhận bắt đầu thực hiện dịch vụ.";
  }
  if (lower.includes("receptionist completed service")) {
    return "Lễ tân ghi nhận hoàn thành dịch vụ.";
  }
  if (lower.includes("receptionist checked-out customer")) {
    return "Lễ tân thực hiện checkout (hoàn thành quy trình/ra về) cho khách.";
  }
  if (lower.includes("created walk-in appointment by receptionist")) {
    return "Lễ tân tạo lịch hẹn trực tiếp tại cửa hàng.";
  }
  if (lower.includes("created appointment with status pending_payment")) {
    return "Đăng ký lịch hẹn thành công (Chờ khách hàng thanh toán cọc).";
  }
  if (lower.includes("created appointment with status confirmed")) {
    return "Đăng ký lịch hẹn thành công (Đã xác nhận).";
  }
  if (lower.includes("invoice marked paid by receptionist")) {
    return "Lễ tân xác nhận thanh toán trực tiếp thành công.";
  }
  if (lower.includes("walk-in appointment marked confirmed without invoice payment")) {
    return "Lịch hẹn trực tiếp được xác nhận không cần thanh toán trước.";
  }
  if (lower.includes("appointment confirmed by receptionist")) {
    return "Lễ tân phê duyệt xác nhận lịch hẹn thành công.";
  }
  if (lower.includes("payment completed via vnpay")) {
    return "Thanh toán trực tuyến thành công qua cổng VNPay.";
  }
  if (lower.includes("payment completed via payos")) {
    return "Thanh toán trực tuyến thành công qua cổng PayOS.";
  }
  if (lower.includes("status updated by system auto-expire due to payment failure or timeout")) {
    return "Hệ thống tự động hủy lịch do hết hạn chờ thanh toán cọc.";
  }
  if (lower.includes("status updated by system auto-expire")) {
    return "Hệ thống tự động hủy lịch do hết hạn chờ thanh toán.";
  }
  if (lower.includes("appointment rescheduled")) {
    return "Dời lịch hẹn sang thời gian mới thành công.";
  }
  if (lower.includes("rescheduled successfully")) {
    return "Dời lịch hẹn sang thời gian mới thành công.";
  }
  if (lower.includes("checked in by receptionist")) {
    return "Khách hàng đã check-in tại quầy chi nhánh.";
  }
  if (lower.includes("changed status to in_progress")) {
    return "Bắt đầu thực hiện liệu trình chăm sóc.";
  }
  if (lower.includes("changed status to completed")) {
    return "Hoàn thành toàn bộ liệu trình dịch vụ.";
  }
  if (lower.includes("appointment status updated to no_show")) {
    return "Khách hàng không đến đúng giờ hẹn (Hệ thống ghi nhận vắng mặt).";
  }
  if (lower.includes("appointment cancelled")) {
    return "Lịch hẹn đã bị hủy.";
  }
  if (lower.includes("refund request created")) {
    return "Gửi yêu cầu hoàn tiền thành công.";
  }
  if (lower.includes("refund approved")) {
    return "Yêu cầu hoàn tiền đã được phê duyệt.";
  }
  if (lower.includes("refund completed")) {
    return "Đã hoàn thành thủ tục trả lại tiền.";
  }

  return reason;
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
  const [rescheduleActionLoading, setRescheduleActionLoading] = useState(""); // 'confirm' | 'reject'
  const [pendingReschedule, setPendingReschedule] = useState(null); // AWAITING_CUSTOMER request
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [bankList, setBankList] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

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
      // Load pending reschedule request của khách hàng
      try {
        const rRes = await axiosClient.get(`/reschedule/customer/appointments/${id}/pending-reschedule`);
        setPendingReschedule(rRes.data?.data || null);
      } catch (_) {
        setPendingReschedule(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được chi tiết lịch hẹn");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Xác nhận đổi lịch
  async function handleConfirmReschedule() {
    if (!pendingReschedule) return;
    try {
      setRescheduleActionLoading("confirm");
      await axiosClient.put(`/reschedule/customer/reschedule-requests/${pendingReschedule.RequestId}/confirm`);
      setMessage("✅ Đã xác nhận đổi lịch thành công! Lịch hẹn đã được cập nhật.");
      setPendingReschedule(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận thất bại");
    } finally {
      setRescheduleActionLoading("");
    }
  }

  // Từ chối đổi lịch
  async function handleRejectReschedule() {
    if (!pendingReschedule) return;
    try {
      setRescheduleActionLoading("reject");
      await axiosClient.put(`/reschedule/customer/reschedule-requests/${pendingReschedule.RequestId}/reject`);
      setMessage("❌ Đã từ chối đổi lịch. Lịch hẹn giữ nguyên.");
      setPendingReschedule(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Từ chối thất bại");
    } finally {
      setRescheduleActionLoading("");
    }
  }

  const services = appointment?.Services || [];
  const payments = appointment?.Payments || [];
  const refunds = appointment?.Refunds || [];
  const reviews = appointment?.Reviews || [];
  const histories = useMemo(() => {
    return [...(appointment?.StatusHistory || [])].reverse();
  }, [appointment]);

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

    const paymentStatus = String(appointment?.PaymentStatus || "").toUpperCase();
    const paymentMethod = String(appointment?.PaymentMethod || "").toUpperCase();
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
      setActionLoading(true);
      setError("");
      setMessage("");
      await axiosClient.delete(`/appointments/${id}`, {
        data: {
          reason: cancelReason.trim(),
          bankCode,
          accountNumber,
          accountName: accountName.trim().toUpperCase()
        }
      });
      setMessage(
        hasPaid
          ? "Đã hủy lịch và gửi yêu cầu hoàn tiền"
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

  async function handleConfirm() {
    try {
      setActionLoading(true);
      setError("");
      setMessage("");
      await axiosClient.post(`/appointments/${id}/confirm`);
      setMessage("Xác nhận lịch hẹn tái khám thành công!");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận lịch hẹn thất bại");
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
      <div className="ap-detail-v2-container">
        
        {/* ── TOP ACTION BAR ── */}
        <div className="ap-v2-top-bar">
          <Link to="/customer/appointments" className="ap-v2-back-link">
            ← Quay lại lịch hẹn
          </Link>

          <div className="ap-v2-actions-wrapper">
            {appointment?.Status === "PENDING" && (
              <button
                type="button"
                className="ap-btn-v2 primary"
                onClick={handleConfirm}
                disabled={actionLoading}
              >
                ✓ Xác nhận lịch tái khám
              </button>
            )}

            {canPay(appointment) && (
              <button
                type="button"
                className="ap-btn-v2 primary"
                onClick={() => navigate(`/customer/payment/${appointment.AppointmentId}`)}
              >
                💳 Thanh toán ngay
              </button>
            )}

            {canReschedule(appointment) && (
              <button
                type="button"
                className="ap-btn-v2 soft"
                onClick={() => navigate(`/customer/reschedule/${appointment.AppointmentId}`)}
              >
                📅 Đổi lịch hẹn
              </button>
            )}

            {canReview(appointment, services) && (
              <button
                type="button"
                className="ap-btn-v2 soft"
                onClick={() => navigate(`/customer/reviews?appointmentId=${appointment.AppointmentId}`)}
              >
                ⭐ Viết đánh giá
              </button>
            )}

            {isCompleted && (
              <button
                type="button"
                className="ap-btn-v2 soft"
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
                className="ap-btn-v2 danger"
                onClick={() => setShowCancel(true)}
              >
                ✕ Hủy lịch hẹn
              </button>
            )}
          </div>
        </div>

        {/* ── MESSAGE BANNERS ── */}
        {message && <div className="ap-v2-alert success">✓ {message}</div>}
        {error && <div className="ap-v2-alert error">⚠ {error}</div>}

        {/* ── HERO BANNER ── */}
        <section className="ap-v2-hero-card">
          <div className="ap-v2-hero-info">
            <span style={{ fontSize: "12px", textTransform: "uppercase", color: "#c084fc", fontWeight: 700, letterSpacing: "1px" }}>
              Chi tiết lịch hẹn · Luna Salon
            </span>
            <h1>{code(appointment.AppointmentId)}</h1>
            <p>
              {appointment.ServiceNames || appointment.ServiceName || "Dịch vụ chăm sóc sắc đẹp"}
            </p>

            <div className="ap-v2-hero-badges">
              <b className={`ap-v2-badge status status-${statusClass(appointment.Status)}`}>
                {statusEmoji(appointment.Status)} {statusText(appointment.Status)}
              </b>
              <b className={`ap-v2-badge payment-${statusClass(appointment.PaymentStatus || "UNPAID")}`}>
                💳 {paymentText(appointment.PaymentStatus)}
              </b>
              {appointment.CustomerPackageId && (
                <b className="ap-v2-badge combo">📦 Combo: {appointment.CustomerPackageName || "Dùng combo"}</b>
              )}
              {appointment.VoucherCode && (
                <b className="ap-v2-badge voucher">🏷 {appointment.VoucherCode}</b>
              )}
            </div>
          </div>

          <div className="ap-v2-price-glass">
            <span>Tổng số tiền thanh toán</span>
            <strong>{money(appointment.FinalAmount)}</strong>
            
            <div className="ap-v2-price-breakdowns">
              <div className="ap-v2-price-row">
                <span>Tạm tính:</span>
                <span>{money(appointment.TotalAmount)}</span>
              </div>
              {Number(appointment.DiscountAmount) > 0 && (
                <div className="ap-v2-price-row" style={{ color: "#f472b6" }}>
                  <span>Giảm giá:</span>
                  <span>-{money(appointment.DiscountAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── TIMELINE BAR PROGRESS ── */}
        <section className="ap-v2-progress-timeline">
          <div className="ap-v2-progress-bar-fill" style={{ width: `${progress * 25}%` }} />
          {STEPS.map((step, index) => {
            const isActive = index <= progress && !isCancelled;
            const isCurrent = index === progress && !isCancelled;
            const stepClass = isCancelled && index === 1
              ? "cancelled"
              : isCurrent
              ? "active"
              : isActive
              ? "completed"
              : "";
            
            return (
              <div key={step} className={`ap-v2-progress-step ${stepClass}`}>
                <div className="ap-v2-step-circle">
                  {isCancelled && index === 1 ? "✕" : STEP_ICONS[index]}
                </div>
                <span className="ap-v2-step-label">
                  {isCancelled && index === 1 ? statusText(appointment.Status) : statusText(step)}
                </span>
              </div>
            );
          })}
        </section>

        {/* ── PENDING RESCHEDULE BANNER - khách xác nhận/từ chối đổi lịch ── */}
        {pendingReschedule && (
          <div style={{
            margin: "0 0 20px 0",
            background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
            border: "2px solid #f59e0b",
            borderRadius: "16px",
            padding: "20px 22px",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
              <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>📅</span>
              <div style={{ flex: 1 }}>
                <b style={{ display: "block", color: "#92400e", fontSize: "0.95rem", marginBottom: "6px" }}>
                  Kỹ thuật viên đề xuất dời lịch hẹn của bạn
                </b>
                <span style={{ color: "#78350f", fontSize: "0.85rem", display: "block", marginBottom: "10px" }}>
                  Lễ tân đã phê duyệt đề xuất này. Vui lòng xác nhận hoặc từ chối thay đổi.
                </span>
                <div style={{
                  background: "rgba(255,255,255,0.7)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  border: "1px solid #fcd34d",
                  marginBottom: "14px",
                }}>
                  <div style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 600, marginBottom: "4px" }}>THỚI GIAN ĐỀ XUẤT MỚI</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#78350f" }}>
                    📅 {pendingReschedule.RequestedDate
                      ? new Date(pendingReschedule.RequestedDate).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" })
                      : ""}
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#78350f", marginTop: "4px" }}>
                    ⏰ {String(pendingReschedule.RequestedStartTime || "").slice(0, 5)} – {String(pendingReschedule.RequestedEndTime || "").slice(0, 5)}
                  </div>
                  {pendingReschedule.Reason && (
                    <div style={{ fontSize: "0.82rem", color: "#a16207", marginTop: "8px", fontStyle: "italic" }}>
                      Lý do: {pendingReschedule.Reason}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleConfirmReschedule}
                    disabled={rescheduleActionLoading !== ""}
                    style={{
                      flex: 1,
                      padding: "11px",
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: rescheduleActionLoading ? "not-allowed" : "pointer",
                      opacity: rescheduleActionLoading ? 0.7 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {rescheduleActionLoading === "confirm" ? "⏳ Đang xử lý..." : "✅ Xác nhận đổi lịch"}
                  </button>
                  <button
                    onClick={handleRejectReschedule}
                    disabled={rescheduleActionLoading !== ""}
                    style={{
                      flex: 1,
                      padding: "11px",
                      background: "#fff",
                      color: "#dc2626",
                      border: "2px solid #dc2626",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: rescheduleActionLoading ? "not-allowed" : "pointer",
                      opacity: rescheduleActionLoading ? 0.7 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {rescheduleActionLoading === "reject" ? "⏳ Đang xử lý..." : "❌ Giữ nguyên lịch cũ"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ── MAIN CONTENT GRID ── */}
        <div className="ap-v2-grid">
          
          {/* LEFT COLUMN */}
          <div className="ap-v2-left-col">
            
            {/* Services List Panel */}
            <div className="ap-v2-panel">
              <div className="ap-v2-panel-title">
                <h3>💅 Dịch vụ đã chọn</h3>
                <span>{services.length || appointment.ServiceCount || 1} dịch vụ</span>
              </div>

              <div className="ap-v2-services-list">
                {services.length ? (
                  services.map((s) => (
                    <article className="ap-v2-service-card" key={s.AppointmentServiceId || s.ServiceId}>
                      <img
                        className="ap-v2-service-img"
                        src={resolveFileUrl(s.ImageUrl) || FALLBACK_SERVICE}
                        alt={s.ServiceName}
                      />
                      <div className="ap-v2-service-info">
                        <div>
                          <span className="ap-v2-service-cat">
                            {s.CategoryName || "Dịch vụ làm đẹp"}
                          </span>
                          <h4 className="ap-v2-service-name">{s.ServiceName}</h4>
                          <p className="ap-v2-service-desc">
                            {s.Description || "Trải nghiệm liệu trình chăm sóc sắc đẹp cao cấp tại Luna Salon."}
                          </p>
                        </div>
                        
                        <div className="ap-v2-service-meta">
                          <span className="ap-v2-service-price">{money(s.Price)}</span>
                          <span className="ap-v2-service-duration">⏱ {s.DurationMinutes || 0} phút</span>
                          
                          {Number(s.HasReviewed || 0) ? (
                            <span className="ap-v2-review-badge">★ Đã đánh giá</span>
                          ) : isCompleted ? (
                            <button
                              type="button"
                              className="ap-v2-review-btn"
                              onClick={() => navigate(`/customer/reviews?appointmentId=${appointment.AppointmentId}`)}
                            >
                              ✎ Đánh giá ngay
                            </button>
                          ) : (
                            <span className="ap-v2-service-duration">Chưa thực hiện</span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p style={{ color: "var(--ap-text-sub)", textAlign: "center", padding: "20px 0" }}>
                    Không có thông tin dịch vụ.
                  </p>
                )}
              </div>
            </div>

            {/* Treatment Notes Panel */}
            {appointment?.TreatmentNotes && appointment.TreatmentNotes.length > 0 && (
              <div className="ap-v2-panel" style={{ borderLeft: "4px solid #10b981" }}>
                <div className="ap-v2-panel-title">
                  <h3>📝 Phác đồ điều trị & Lời khuyên của Kỹ thuật viên</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
                  {appointment.TreatmentNotes.map((note, idx) => (
                    <div key={note.id || idx} style={{ borderBottom: idx < appointment.TreatmentNotes.length - 1 ? "1px dashed var(--ap-border)" : "none", paddingBottom: "20px" }}>
                      <h4 style={{ color: "var(--ap-text-main)", fontSize: "1.05rem", fontWeight: "600", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        ✨ Dịch vụ: {note.ServiceName} <span style={{ fontSize: "0.85rem", color: "var(--ap-text-sub)", fontWeight: "normal" }}>— KTV thực hiện: <b>{note.TechnicianName}</b></span>
                      </h4>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                        <div>
                          {note.before_condition && (
                            <p style={{ fontSize: "0.9rem", color: "var(--ap-text-main)", margin: "6px 0", lineHeight: "1.4" }}>
                              <strong style={{ color: "var(--ap-text-sub)" }}>Tình trạng ban đầu:</strong> {note.before_condition}
                            </p>
                          )}
                          {note.after_result && (
                            <p style={{ fontSize: "0.9rem", color: "var(--ap-text-main)", margin: "6px 0", lineHeight: "1.4" }}>
                              <strong style={{ color: "var(--ap-text-sub)" }}>Kết quả thực hiện:</strong> {note.after_result}
                            </p>
                          )}
                          {note.technician_notes && (
                            <p style={{ fontSize: "0.9rem", color: "var(--ap-text-main)", margin: "6px 0", lineHeight: "1.4" }}>
                              <strong style={{ color: "var(--ap-text-sub)" }}>Ghi chú của KTV:</strong> {note.technician_notes}
                            </p>
                          )}
                        </div>

                        <div>
                          {/* Steps performed */}
                          {note.procedure_steps && note.procedure_steps.length > 0 && (
                            <div style={{ marginBottom: "12px" }}>
                              <strong style={{ fontSize: "0.9rem", color: "var(--ap-text-main)" }}>Quy trình thực hiện chi tiết:</strong>
                              <ol style={{ margin: "6px 0 0 18px", padding: 0, fontSize: "0.88rem", color: "var(--ap-text-sub)", lineHeight: "1.5" }}>
                                {note.procedure_steps.map((step, sIdx) => (
                                  <li key={sIdx} style={{ marginBottom: "4px" }}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Products used */}
                          {note.products_used && note.products_used.length > 0 && (
                            <div>
                              <strong style={{ fontSize: "0.9rem", color: "var(--ap-text-main)" }}>Sản phẩm đã sử dụng:</strong>
                              <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: "0.88rem", color: "var(--ap-text-sub)", listStyleType: "circle", lineHeight: "1.5" }}>
                                {note.products_used.map((prod, pIdx) => (
                                  <li key={pIdx} style={{ marginBottom: "4px" }}>{prod}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recommendations */}
                      {note.recommendations && typeof note.recommendations === "string" && note.recommendations.trim() && (
                        <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
                          <strong style={{ fontSize: "0.9rem", color: "#10b981", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                            💡 Khuyến nghị chăm sóc tại nhà:
                          </strong>
                          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ap-text-main)", lineHeight: "1.5" }}>
                            {note.recommendations}
                          </p>
                        </div>
                      )}

                      {/* Images */}
                      {((note.before_images && note.before_images.length > 0) || 
                        (note.after_images && note.after_images.length > 0) || 
                        (note.detailed_images && note.detailed_images.length > 0)) && (
                        <div style={{ marginTop: "16px" }}>
                          <strong style={{ fontSize: "0.9rem", color: "var(--ap-text-main)", display: "block", marginBottom: "8px" }}>🖼️ Hình ảnh thực tế trị liệu:</strong>
                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            {/* Before images */}
                            {note.before_images && note.before_images.map((src, imgIdx) => (
                              <div key={`b-${imgIdx}`} style={{ position: "relative" }}>
                                <img src={resolveFileUrl(src)} alt="Before" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "1.5px solid var(--ap-border)" }} />
                                <span style={{ position: "absolute", bottom: "4px", left: "4px", background: "#3b82f6", color: "#fff", fontSize: "0.62rem", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px" }}>TRƯỚC</span>
                              </div>
                            ))}
                            {/* After images */}
                            {note.after_images && note.after_images.map((src, imgIdx) => (
                              <div key={`a-${imgIdx}`} style={{ position: "relative" }}>
                                <img src={resolveFileUrl(src)} alt="After" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "1.5px solid var(--ap-border)" }} />
                                <span style={{ position: "absolute", bottom: "4px", left: "4px", background: "#10b981", color: "#fff", fontSize: "0.62rem", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px" }}>SAU</span>
                              </div>
                            ))}
                            {/* Detailed images */}
                            {note.detailed_images && note.detailed_images.map((src, imgIdx) => (
                              <div key={`d-${imgIdx}`} style={{ position: "relative" }}>
                                <img src={resolveFileUrl(src)} alt="Detail" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "1.5px solid var(--ap-border)" }} />
                                <span style={{ position: "absolute", bottom: "4px", left: "4px", background: "#6b7280", color: "#fff", fontSize: "0.62rem", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px" }}>CHI TIẾT</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status History Timeline Panel */}
            <div className="ap-v2-panel">
              <div className="ap-v2-panel-title">
                <h3>🕒 Lịch sử trạng thái</h3>
              </div>

              <div className="ap-v2-timeline">
                {histories.length ? (
                  histories.map((h, idx) => (
                    <div key={h.HistoryId || idx} className={`ap-v2-timeline-node ${idx === 0 ? "active" : ""}`}>
                      <div className="ap-v2-timeline-bullet" />
                      <div className="ap-v2-timeline-content">
                        <h4>
                          {h.OldStatus ? `${statusText(h.OldStatus)} → ` : ""}
                          {statusText(h.NewStatus)}
                        </h4>
                        <p>{formatReason(h.Reason)}</p>
                        <span>
                          🕐 {dateTimeText(h.ChangedAt)} · {formatName(h.ChangedByName)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "var(--ap-text-sub)", textAlign: "center", padding: "10px 0" }}>
                    Chưa có ghi nhận lịch sử thay đổi.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="ap-v2-right-col">
            
            {/* Technician Profile Panel */}
            <div className="ap-v2-panel">
              <div className="ap-v2-panel-title">
                <h3>✂ Kỹ thuật viên</h3>
              </div>

              <div className="ap-v2-tech-profile">
                <div className="ap-v2-tech-avatar-container">
                  <img
                    className="ap-v2-tech-avatar"
                    src={resolveFileUrl(appointment.EmployeeImageUrl) || FALLBACK_AVATAR}
                    alt={appointment.EmployeeName}
                  />
                </div>
                <div>
                  <h4 className="ap-v2-tech-name">{appointment.EmployeeName || "Chưa phân công"}</h4>
                  <p className="ap-v2-tech-title">
                    {appointment.Specialization || appointment.Position || "Chuyên gia làm đẹp"}
                  </p>
                  <div className="ap-v2-tech-contacts">
                    {appointment.EmployeePhone && (
                      <span className="ap-v2-tech-contact-item">
                        📞 {appointment.EmployeePhone}
                      </span>
                    )}
                    {appointment.EmployeeEmail && (
                      <span className="ap-v2-tech-contact-item">
                        ✉ {appointment.EmployeeEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Time & Location (Branch Address) */}
            <div className="ap-v2-panel">
              <div className="ap-v2-panel-title">
                <h3>📍 Thời gian & Địa điểm</h3>
              </div>

              <div className="ap-v2-details-list">
                <div className="ap-v2-detail-item">
                  <div className="ap-v2-detail-icon">📅</div>
                  <div className="ap-v2-detail-content">
                    <span className="ap-v2-detail-label">Ngày hẹn thực hiện</span>
                    <span className="ap-v2-detail-value">{dateText(appointment.AppointmentDate)}</span>
                  </div>
                </div>

                <div className="ap-v2-detail-item">
                  <div className="ap-v2-detail-icon">⏰</div>
                  <div className="ap-v2-detail-content">
                    <span className="ap-v2-detail-label">Thời gian làm việc</span>
                    <span className="ap-v2-detail-value">
                      {timeText(appointment.StartTime)} – {timeText(appointment.EndTime)}
                    </span>
                    <span className="ap-v2-detail-subvalue">⏱ Tổng thời lượng: {appointment.TotalDuration || 0} phút</span>
                  </div>
                </div>

                <div className="ap-v2-detail-item">
                  <div className="ap-v2-detail-icon">🏢</div>
                  <div className="ap-v2-detail-content">
                    <span className="ap-v2-detail-label">Chi nhánh thực hiện</span>
                    <span className="ap-v2-detail-value">{appointment.BranchName || "Chưa chọn chi nhánh"}</span>
                    {appointment.BranchAddress && (
                      <span className="ap-v2-detail-subvalue">Địa chỉ: {appointment.BranchAddress}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Google Map Address */}
              {appointment.BranchAddress && (
                <div style={{ marginTop: "16px", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--ap-border)", height: "200px" }}>
                  <iframe
                    title="Bản đồ chỉ dẫn đường đi"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(appointment.BranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen=""
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* Financial Details (Receipt Layout) */}
            <div className="ap-v2-panel">
              <div className="ap-v2-panel-title">
                <h3>🧾 Hóa đơn chi tiết</h3>
              </div>

              <div className="ap-v2-receipt">
                <div className="ap-v2-receipt-header">
                  <h4>LUNA BEAUTY SALON</h4>
                  <span>Mã Hóa Đơn: {appointment.InvoiceId ? `INV${String(appointment.InvoiceId).padStart(5, "0")}` : "Chưa xuất"}</span>
                </div>

                <div className="ap-v2-receipt-list">
                  <div className="ap-v2-receipt-item">
                    <span>Tổng tạm tính dịch vụ</span>
                    <span>{money(appointment.TotalAmount)}</span>
                  </div>
                  
                  {Number(appointment.DiscountAmount) > 0 && (
                    <div className="ap-v2-receipt-item" style={{ color: "var(--ap-secondary)" }}>
                      <span>Giảm giá khuyến mãi / Voucher</span>
                      <span>-{money(appointment.DiscountAmount)}</span>
                    </div>
                  )}

                  <div className="ap-v2-receipt-item total">
                    <span>Số tiền cuối cùng</span>
                    <span>{money(appointment.FinalAmount)}</span>
                  </div>
                </div>

                <div className="ap-v2-receipt-footer">
                  <p>Trạng thái hóa đơn: {appointment.InvoiceStatus || "Chưa hoàn tất"}</p>
                  {appointment.InvoiceCreatedAt && (
                    <p>Ngày xuất: {dateTimeText(appointment.InvoiceCreatedAt)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Transactions List */}
            {payments.length > 0 && (
              <div className="ap-v2-panel">
                <div className="ap-v2-panel-title">
                  <h3>💰 Lịch sử thanh toán</h3>
                </div>

                <div className="ap-v2-trans-list">
                  {payments.map((p) => (
                    <div className="ap-v2-trans-card" key={p.PaymentId}>
                      <div className="ap-v2-trans-left">
                        <span className="ap-v2-trans-method">💳 {p.PaymentMethod || "VNPay Online"}</span>
                        <span className="ap-v2-trans-date">{dateTimeText(p.PaidAt || p.CreatedAt)}</span>
                        {p.TransactionCode && <small style={{ color: "var(--ap-text-sub)" }}>Mã GD: {p.TransactionCode}</small>}
                      </div>
                      <div className="ap-v2-trans-right">
                        <span className="ap-v2-trans-price">{money(p.Amount)}</span>
                        <div className="ap-v2-trans-status">{paymentText(p.Status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refunds Panel if Cancelled/Refunded */}
            {(refunds.length > 0 || isCancelled) && (
              <div className="ap-v2-panel">
                <div className="ap-v2-panel-title">
                  <h3>🔄 Giao dịch hoàn tiền</h3>
                </div>

                <div className="ap-v2-trans-list">
                  {refunds.length ? (
                    refunds.map((r) => (
                      <div className="ap-v2-trans-card" key={r.RefundId} style={{ borderLeft: "4px solid var(--ap-warning)", borderRadius: "8px" }}>
                        <div className="ap-v2-trans-left">
                          <span className="ap-v2-trans-method">🏦 Nhận qua ngân hàng</span>
                          {r.BankName && <small style={{ fontWeight: 600 }}>{r.BankName} – {r.BankAccountNumber}</small>}
                          <span className="ap-v2-trans-date">{dateTimeText(r.RefundedAt || r.CreatedAt)}</span>
                          <small style={{ color: "var(--ap-text-sub)" }}>Lý do: {r.Reason || "Không ghi"}</small>
                        </div>
                        <div className="ap-v2-trans-right">
                          <span className="ap-v2-trans-price" style={{ color: "var(--ap-warning)" }}>{money(r.RefundAmount)}</span>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--ap-warning)" }}>
                            {refundText(r.Status)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "var(--ap-text-sub)", textAlign: "center", padding: "10px 0", fontSize: "13px" }}>
                      Yêu cầu hoàn tiền đang chờ hệ thống xử lý.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Service Review list inside details */}
            {reviews.length > 0 && (
              <div className="ap-v2-panel">
                <div className="ap-v2-panel-title">
                  <h3>⭐ Đánh giá của bạn</h3>
                </div>

                <div>
                  {reviews.map((r) => (
                    <div className="ap-v2-review-card" key={r.ReviewId}>
                      <h4>{r.ServiceName}</h4>
                      <div className="ap-v2-review-stars">
                        {"★".repeat(Number(r.Rating || 0)) + "☆".repeat(5 - Number(r.Rating || 0))}
                      </div>
                      <p className="ap-v2-review-comment">{r.Comment || "Không có nhận xét chi tiết."}</p>
                      {r.AdminResponse && (
                        <div className="ap-v2-review-reply">
                          <strong>Salon phản hồi:</strong> {r.AdminResponse}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CANCEL MODAL ── */}
        {showCancel && (
          <div className="ap-v2-modal-overlay" onClick={() => setShowCancel(false)}>
            <div className="ap-v2-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ap-v2-modal-close"
                onClick={() => setShowCancel(false)}
              >
                ×
              </button>

              <div className="ap-v2-modal-warning-icon">⚠</div>
              <h3 className="ap-v2-modal-title">Xác nhận hủy lịch hẹn</h3>
              <p className="ap-v2-modal-desc">
                {String(appointment?.PaymentStatus || "").toUpperCase() === "PAID" && String(appointment?.PaymentMethod || "").toUpperCase() !== "PACKAGE"
                  ? "Lịch hẹn đã thanh toán. Salon sẽ tạo yêu cầu hoàn trả số tiền đặt cọc vào tài khoản ngân hàng của bạn."
                  : "Hành động này không thể hoàn tác. Bạn có chắc chắn muốn hủy lịch hẹn này?"}
              </p>

              {/* Bank refund information details if paid */}
              {String(appointment?.PaymentStatus || "").toUpperCase() === "PAID" && String(appointment?.PaymentMethod || "").toUpperCase() !== "PACKAGE" && (
                <div className="bank-refund-fields" style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '15px 0', padding: '16px', border: '1px solid #fee2e2', borderRadius: '12px', backgroundColor: '#fef2f2' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--ap-danger)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tài khoản nhận hoàn tiền
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ap-text-sub)' }}>Ngân hàng nhận:</label>
                    <select
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--ap-border)', outline: 'none', backgroundColor: 'white', fontSize: '13px' }}
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
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ap-text-sub)' }}>Số tài khoản:</label>
                    <input
                      type="text"
                      placeholder="Nhập số tài khoản ngân hàng..."
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--ap-border)', outline: 'none', fontSize: '13px' }}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ap-text-sub)' }}>Tên chủ tài khoản (viết hoa không dấu):</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: NGUYEN VAN A"
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--ap-border)', outline: 'none', fontSize: '13px' }}
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              <textarea
                className="ap-v2-modal-textarea"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy lịch hẹn..."
                rows={3}
              />

              <div className="ap-v2-modal-actions">
                <button
                  type="button"
                  className="ap-btn-v2 secondary"
                  onClick={() => setShowCancel(false)}
                >
                  Giữ lại lịch
                </button>
                <button
                  type="button"
                  className="ap-btn-v2 danger"
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
