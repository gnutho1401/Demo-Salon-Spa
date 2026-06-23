import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function dateText(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function statusLabel(status) {
  const map = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING: "Đang chờ",
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    IN_PROGRESS: "Đang thực hiện",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    NO_SHOW: "Khách không đến",
  };
  return map[status] || status || "-";
}

function statusClass(status) {
  return `rx-badge status-${String(status || "unpaid").toLowerCase()}`;
}

function paymentLabel(status) {
  const map = {
    UNPAID: "Chưa thanh toán",
    PENDING: "Đang chờ",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    REFUNDED: "Đã hoàn tiền",
  };
  return map[status] || status || "Chưa thanh toán";
}

export default function ReceptionistAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [availableTechnicians, setAvailableTechnicians] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [cancelReason, setCancelReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [rescheduleForm, setRescheduleForm] = useState({
    appointmentDate: "",
    startTime: "",
    technicianId: "",
  });

  const status = String(item?.Status || "").toUpperCase();
  const paymentStatus = String(item?.PaymentStatus || "UNPAID").toUpperCase();

  const canConfirm = ["PENDING", "PENDING_PAYMENT"].includes(status);
  const canCheckIn = status === "CONFIRMED";
  const canStart = status === "CHECKED_IN";
  const canComplete = status === "IN_PROGRESS";
  
  const canNoShow = ["CONFIRMED", "PENDING", "PENDING_PAYMENT"].includes(status);
  const canEdit = !["COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status);

  const canMarkPaid =
    item?.InvoiceId &&
    paymentStatus !== "PAID" &&
    !["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status);

  const servicesText = useMemo(() => {
    if (Array.isArray(item?.Services) && item.Services.length > 0) {
      return item.Services.map((s) => s.ServiceName).join(", ");
    }
    return item?.ServiceNames || "-";
  }, [item]);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(`/receptionist/appointments/${id}`);
      const data = res.data.data || res.data;

      setItem(data);
      setRescheduleForm({
        appointmentDate: data?.AppointmentDate ? String(data.AppointmentDate).slice(0, 10) : "",
        startTime: data?.StartTime ? String(data.StartTime).slice(0, 5) : "",
        technicianId: data?.TechnicianId ? String(data.TechnicianId) : "",
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

  async function runAction(url, message) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await axiosClient.put(url);
      await load();
      setSuccess(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Thao tác thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.post(
        `/receptionist/invoices/${item.InvoiceId}/mark-paid`,
        {
          method: paymentMethod,
        },
      );

      await load();
      setShowPayment(false);
      setSuccess("Đã xác nhận thanh toán thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận thanh toán thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function submitCancel(e) {
    e.preventDefault();

    if (!cancelReason.trim()) {
      setError("Vui lòng nhập lý lý hủy lịch");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.put(`/receptionist/appointments/${id}/cancel`, {
        reason: cancelReason,
      });

      await load();
      setCancelReason("");
      setShowCancel(false);
      setSuccess(
        "Đã hủy lịch hẹn. Nếu đã thanh toán trước, hệ thống đã tự động gửi yêu cầu hoàn tiền.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function loadTechnicians() {
    if (
      !item?.Services?.[0]?.ServiceId ||
      !rescheduleForm.appointmentDate ||
      !rescheduleForm.startTime
    ) {
      setAvailableTechnicians([]);
      return;
    }

    try {
      const res = await axiosClient.get("/receptionist/available-technicians", {
        params: {
          serviceId: item.Services[0].ServiceId,
          appointmentDate: rescheduleForm.appointmentDate,
          startTime: rescheduleForm.startTime,
        },
      });

      setAvailableTechnicians(res.data.data || res.data || []);
    } catch (err) {
      setAvailableTechnicians([]);
      setError(
        err.response?.data?.message || "Không tải được kỹ thuật viên khả dụng",
      );
    }
  }

  useEffect(() => {
    if (showReschedule) loadTechnicians();
  }, [
    showReschedule,
    rescheduleForm.appointmentDate,
    rescheduleForm.startTime,
  ]);

  async function submitReschedule(e) {
    e.preventDefault();

    if (
      !rescheduleForm.appointmentDate ||
      !rescheduleForm.startTime ||
      !rescheduleForm.technicianId
    ) {
      setError("Vui lòng chọn đầy đủ ngày mới, giờ mới và kỹ thuật viên");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.put(`/receptionist/appointments/${id}/reschedule`, {
        appointmentDate: rescheduleForm.appointmentDate,
        startTime: rescheduleForm.startTime,
        technicianId: Number(rescheduleForm.technicianId),
      });

      await load();
      setShowReschedule(false);
      setSuccess("Đổi lịch hẹn và phân công kỹ thuật viên thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="rx-page fade-in">
        <div className="ra-detail-header" style={{ marginBottom: "22px" }}>
          <div>
            <Link to="/receptionist/appointments" className="ra-back-link">
              ← Quay lại danh sách lịch hẹn
            </Link>
            <h1 style={{ marginTop: "10px" }}>Chi tiết lịch hẹn #{id}</h1>
            <p style={{ color: "#6f766f", margin: "4px 0 0" }}>
              Quản lý ca trực phục vụ, thay đổi lịch biểu, xác nhận thanh toán trực quầy và check-in cho khách.
            </p>
          </div>

          {item ? (
            <div className="ra-header-badges" style={{ display: "flex", gap: "10px" }}>
              <span className={`rx-badge status-${String(item.Status || "").toLowerCase()}`}>
                Trạng thái: {statusLabel(item.Status)}
              </span>
              <span className={`rx-badge payment-${String(item.PaymentStatus || "UNPAID").toLowerCase()}`}>
                Thanh toán: {paymentLabel(item.PaymentStatus)}
              </span>
            </div>
          ) : null}
        </div>

        {loading && <div className="rx-success" style={{ marginBottom: 15, background: "#e8f0ff", color: "#1260b8" }}>Đang tải dữ liệu...</div>}
        {error && <div className="rx-error" style={{ marginBottom: 15 }}>{error}</div>}
        {success && <div className="rx-success" style={{ marginBottom: 15, padding: "12px", background: "#d4edda", color: "#155724", borderRadius: "10px", fontWeight: "bold" }}>{success}</div>}

        {item ? (
          <>
            <div className="ra-overview" style={{ marginBottom: "24px" }}>
              <div className="ra-hero-card">
                <img
                  className="ra-avatar"
                  src={avatarUrl(item.CustomerAvatarUrl)}
                  alt={item.CustomerName || "Customer"}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />

                <div>
                  <span className="ra-eyebrow">Khách hàng</span>
                  <h2>{item.CustomerName || "Khách vãng lai"}</h2>
                  <p>
                    {item.CustomerPhone || "Không có SĐT"} • {item.CustomerEmail || "Không có Email"}
                  </p>
                </div>
              </div>

              <div className="ra-mini-card">
                <span>📅</span>
                <p>Ngày đặt hẹn</p>
                <b>{dateText(item.AppointmentDate)}</b>
              </div>

              <div className="ra-mini-card">
                <span>⏰</span>
                <p>Giờ làm việc</p>
                <b>
                  {item.StartTime ? String(item.StartTime).slice(0, 5) : "--"} - {item.EndTime ? String(item.EndTime).slice(0, 5) : "--"}
                </b>
              </div>

              <div className="ra-mini-card">
                <span>💰</span>
                <p>Tổng hóa đơn</p>
                <b>{money(item.FinalAmount)}</b>
              </div>
            </div>

            {/* Split grid: Column Left for Details & Timelines, Column Right for cards info */}
            <div className="ra-grid">
              
              {/* Column Left */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                <section className="ra-card ra-main-card" style={{ width: "100%" }}>
                  <div className="ra-card-title">
                    <h3>Thông tin dịch vụ đã đặt</h3>
                    <span>Mã hệ thống: #{item.AppointmentId}</span>
                  </div>

                  <div className="ra-info-grid">
                    <div>
                      <label>Các dịch vụ sử dụng</label>
                      <strong style={{ color: "#d91f68" }}>{servicesText}</strong>
                    </div>

                    <div>
                      <label>Kỹ thuật viên thực hiện</label>
                      <strong>{item.TechnicianName || "Chưa chỉ định KTV"}</strong>
                      <small style={{ color: "#6f766f", marginTop: "3px" }}>
                        {item.Specialization || item.Position || "Chuyên viên trị liệu"}
                      </small>
                    </div>

                    <div>
                      <label>Ngày hẹn dịch vụ</label>
                      <strong>{dateText(item.AppointmentDate)}</strong>
                    </div>

                    <div>
                      <label>Khung giờ dự kiến</label>
                      <strong>
                        {item.StartTime ? String(item.StartTime).slice(0, 5) : "--"} - {item.EndTime ? String(item.EndTime).slice(0, 5) : "--"}
                      </strong>
                    </div>

                    <div style={{ gridColumn: "span 2" }}>
                      <label>Ghi chú của khách</label>
                      <strong>{item.Notes || "Không có ghi chú nào"}</strong>
                    </div>

                    {item.CancelReason && (
                      <div style={{ gridColumn: "span 2", background: "#ffeef0", border: "1px solid #f8b4bc", borderRadius: "12px" }}>
                        <label style={{ color: "#d32232" }}>Lý do hủy lịch hẹn</label>
                        <strong style={{ color: "#d32232" }}>{item.CancelReason}</strong>
                      </div>
                    )}
                  </div>
                </section>

                {/* Status Timeline History */}
                {Array.isArray(item.StatusHistory) && item.StatusHistory.length > 0 && (
                  <section className="ra-card" style={{ width: "100%" }}>
                    <div className="ra-card-title" style={{ marginBottom: "20px" }}>
                      <h3>Dòng thời gian hoạt động trạng thái</h3>
                    </div>

                    <div className="ra-timeline">
                      {item.StatusHistory.map((h) => (
                        <div className="ra-timeline-item" key={h.HistoryId}>
                          <span></span>
                          <div>
                            <b>
                              {statusLabel(h.OldStatus) || "Khởi tạo"} →{" "}
                              {statusLabel(h.NewStatus)}
                            </b>
                            <p style={{ margin: "4px 0" }}>{h.Reason || "Không có lý do chi tiết"}</p>
                            <small style={{ color: "#7d837d" }}>
                              Thực hiện: {h.ChangedByName || "Hệ thống"} •{" "}
                              {h.ChangedAt ? formatDateTime(h.ChangedAt) : ""}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Column Right */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Customer Info Card */}
                <section className="ra-card">
                  <div className="ra-card-title">
                    <h3>Khách hàng đăng ký</h3>
                    <Link to={`/receptionist/customers/${item.CustomerId}`}>
                      Xem hồ sơ
                    </Link>
                  </div>

                  <div className="ra-profile-line">
                    <img
                      className="ra-small-avatar"
                      src={avatarUrl(item.CustomerAvatarUrl)}
                      alt={item.CustomerName}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div>
                      <b>{item.CustomerName || "Khách vãng lai"}</b>
                      <p style={{ color: "#7d837d", margin: "4px 0 0" }}>📞 {item.CustomerPhone || "Không có SĐT"}</p>
                      <p style={{ color: "#7d837d", margin: "2px 0 0" }}>✉ {item.CustomerEmail || "Không có Email"}</p>
                    </div>
                  </div>
                </section>

                {/* Technician Info Card */}
                <section className="ra-card">
                  <div className="ra-card-title">
                    <h3>Kỹ thuật viên phụ trách</h3>
                  </div>

                  <div className="ra-profile-line">
                    <img
                      className="ra-small-avatar tech"
                      src={avatarUrl(
                        item.TechnicianImageUrl || item.TechnicianAvatarUrl,
                      )}
                      alt={item.TechnicianName}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div>
                      <b>{item.TechnicianName || "Chưa phân công"}</b>
                      <p style={{ color: "#7d837d", margin: "4px 0 0" }}>📞 {item.TechnicianPhone || "Chưa cập nhật SĐT"}</p>
                      <p style={{ color: "#7d837d", margin: "2px 0 0" }}>💼 {item.Specialization || item.Position || "Chuyên viên trị liệu"}</p>
                    </div>
                  </div>
                </section>

                {/* Invoice and Payment Details Card */}
                <section className="ra-card">
                  <div className="ra-card-title">
                    <h3>Hóa đơn & quyết toán</h3>
                    {item.InvoiceId ? (
                      <Link to={`/receptionist/invoices/${item.InvoiceId}`}>
                        Chi tiết hóa đơn
                      </Link>
                    ) : null}
                  </div>

                  <div className="ra-money-list">
                    <div>
                      <span>Đơn giá gốc</span>
                      <b>{money(item.TotalAmount)}</b>
                    </div>
                    <div>
                      <span>Giảm giá khuyến mãi</span>
                      <b style={{ color: "#d32232" }}>-{money(item.DiscountAmount)}</b>
                    </div>
                    <div style={{ borderTop: "1px dashed #eee", paddingTop: "12px", marginTop: "12px" }}>
                      <span>Thành tiền quyết toán</span>
                      <b style={{ color: "#d91f68", fontSize: "16px" }}>{money(item.FinalAmount)}</b>
                    </div>
                    <div>
                      <span>Phương thức thanh toán</span>
                      <b>{item.PaymentMethod || "Chưa chọn"}</b>
                    </div>
                    <div>
                      <span>Mã giao dịch bill</span>
                      <b>{item.TransactionCode || "Chưa tạo giao dịch"}</b>
                    </div>
                    <div>
                      <span>Thời gian quyết toán</span>
                      <b>
                        {item.PaidAt ? formatDateTime(item.PaidAt) : "Chưa thanh toán"}
                      </b>
                    </div>
                  </div>

                  {canMarkPaid ? (
                    <button
                      className="ra-btn primary"
                      type="button"
                      onClick={() => setShowPayment(true)}
                      style={{ width: "100%", marginTop: "12px", cursor: "pointer", fontWeight: "bold" }}
                    >
                      💳 Thanh toán trực tiếp tại quầy
                    </button>
                  ) : null}
                </section>

                {/* Refund Information */}
                {item.RefundInfo ? (
                  <section className="ra-card" style={{ border: "1px solid #bee5eb", backgroundColor: "#f8f9fa" }}>
                    <div className="ra-card-title">
                      <h3>Thông tin hoàn tiền dịch vụ</h3>
                    </div>

                    <div className="ra-money-list">
                      <div>
                        <span>Trạng thái hoàn trả</span>
                        <span className={statusClass(item.RefundInfo.RefundStatus)} style={{ fontSize: "11px", padding: "2px 8px" }}>
                          {statusLabel(item.RefundInfo.RefundStatus)}
                        </span>
                      </div>
                      <div>
                        <span>Số tiền hoàn trả</span>
                        <b>{money(item.RefundInfo.RefundAmount)}</b>
                      </div>
                      <div>
                        <span>Lý do hoàn trả</span>
                        <b>{item.RefundInfo.RefundReason || "Không ghi lý do"}</b>
                      </div>
                      {item.RefundInfo.MomoMessage && (
                        <div>
                          <span>Ghi chú MOMO/PayOS</span>
                          <small style={{ color: "#7d837d", marginTop: "3px" }}>{item.RefundInfo.MomoMessage}</small>
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}

              </div>

            </div>

            {/* Receptionist Actions Center */}
            <section className="ra-card ra-action-card" style={{ marginTop: "24px" }}>
              <div className="ra-card-title">
                <h3>Khu vực xử lý nghiệp vụ Lễ tân</h3>
                <span style={{ fontSize: "12px", color: "#6f766f" }}>Các hành động tương ứng với trạng thái hiện tại của ca hẹn</span>
              </div>

              <div className="ra-actions">
                {canMarkPaid && (
                  <button
                    className="ra-btn primary"
                    type="button"
                    onClick={() => setShowPayment(true)}
                  >
                    💳 Thanh toán tại quầy
                  </button>
                )}

                {canConfirm && (
                  <button
                    className="ra-btn primary"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        `/receptionist/appointments/${id}/confirm`,
                        "Đã xác nhận lịch hẹn thành công!",
                      )
                    }
                  >
                    ✓ Xác nhận lịch hẹn
                  </button>
                )}

                {canCheckIn && (
                  <button
                    className="ra-btn green"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        `/receptionist/appointments/${id}/check-in`,
                        "Đã chuyển lịch hẹn sang trạng thái Check-in!",
                      )
                    }
                  >
                    ✅ Check-in khách hàng
                  </button>
                )}

                {canStart && (
                  <button
                    className="ra-btn purple"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        `/receptionist/appointments/${id}/start`,
                        "Bắt đầu thực hiện ca liệu trình thành công!",
                      )
                    }
                  >
                    ▶ Bắt đầu ca liệu trình
                  </button>
                )}

                {canComplete && (
                  <button
                    className="ra-btn green"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        `/receptionist/appointments/${id}/complete`,
                        "Đã hoàn thành lịch hẹn thành công!",
                      )
                    }
                  >
                    ★ Hoàn thành lịch hẹn
                  </button>
                )}

                {canEdit && (
                  <button
                    className="ra-btn light"
                    type="button"
                    disabled={saving}
                    onClick={() => setShowReschedule(true)}
                  >
                    🔁 Đổi ca trực / đổi giờ
                  </button>
                )}

                {canNoShow && (
                  <button
                    className="ra-btn warning"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        `/receptionist/appointments/${id}/no-show`,
                        "Cập nhật trạng thái khách không đến (No-show) thành công!",
                      )
                    }
                  >
                    ⚠ Khách vắng mặt (No-show)
                  </button>
                )}

                {canEdit && (
                  <button
                    className="ra-btn danger"
                    type="button"
                    disabled={saving}
                    onClick={() => setShowCancel(true)}
                  >
                    ✕ Yêu cầu hủy lịch
                  </button>
                )}
              </div>
            </section>

            {/* MODALS SECTION */}
            {showPayment && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal" onSubmit={markPaid}>
                  <h3>Xác nhận hóa đơn đã trả</h3>
                  <p>Hệ thống sẽ cập nhật trạng thái hóa đơn là đã quyết toán thành công.</p>

                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "15px", outline: "none", height: "44px" }}
                  >
                    <option value="CASH">💵 Tiền mặt (Cash)</option>
                    <option value="CARD">💳 Quẹt thẻ (Card)</option>
                    <option value="TRANSFER">🏦 Chuyển khoản ngân hàng</option>
                  </select>

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang xử lý..." : "Xác nhận đã trả"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowPayment(false)}
                    >
                      Đóng cửa sổ
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showCancel && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal" onSubmit={submitCancel}>
                  <h3>Hủy lịch hẹn của khách</h3>
                  <p>
                    Lưu ý: Nếu lịch hẹn đã được thanh toán trước đó, hệ thống sẽ tự động tạo yêu cầu hoàn trả tiền tương ứng cho khách.
                  </p>

                  <textarea
                    rows="4"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết hủy lịch..."
                    required
                    style={{ width: "100%", border: "1px solid #ddd", borderRadius: "12px", padding: "10px 14px", marginBottom: "15px", outline: "none" }}
                  />

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn danger"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang hủy..." : "Xác nhận hủy lịch"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowCancel(false)}
                    >
                      Đóng cửa sổ
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showReschedule && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal wide" onSubmit={submitReschedule}>
                  <h3>Đổi lịch / đổi chuyên viên</h3>
                  <p style={{ color: "#6f766f", marginBottom: "15px" }}>Chọn thời gian mới và kỹ thuật viên khả dụng tương ứng</p>

                  <div className="ra-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                    <label style={{ display: "grid", gap: "6px", fontWeight: "bold" }}>
                      Ngày hẹn mới
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={rescheduleForm.appointmentDate}
                        onChange={(e) =>
                          setRescheduleForm((p) => ({
                            ...p,
                            appointmentDate: e.target.value,
                          }))
                        }
                        style={{ height: "42px", padding: "0 10px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: "6px", fontWeight: "bold" }}>
                      Giờ hẹn mới
                      <input
                        type="time"
                        value={rescheduleForm.startTime}
                        onChange={(e) =>
                          setRescheduleForm((p) => ({
                            ...p,
                            startTime: e.target.value,
                          }))
                        }
                        style={{ height: "42px", padding: "0 10px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: "6px", fontWeight: "bold", gridColumn: "span 2" }}>
                      Kỹ thuật viên đang rảnh ca trực
                      <select
                        value={rescheduleForm.technicianId}
                        onChange={(e) =>
                          setRescheduleForm((p) => ({
                            ...p,
                            technicianId: e.target.value,
                          }))
                        }
                        style={{ height: "42px", padding: "0 10px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" }}
                      >
                        <option value="">Chọn kỹ thuật viên khả dụng</option>
                        {availableTechnicians.map((t) => (
                          <option key={t.EmployeeId} value={t.EmployeeId}>
                            {t.TechnicianName} {t.Position ? `- ${t.Position}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p style={{ fontSize: "13px", color: "#28a745", fontWeight: "bold", margin: "10px 0 15px" }}>
                    ✓ Tìm thấy {availableTechnicians.length} kỹ thuật viên phù hợp.
                  </p>

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang cập nhật..." : "Cập nhật thay đổi"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowReschedule(false)}
                    >
                      Đóng cửa sổ
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        ) : null}
      </div>
    </ReceptionistLayout>
  );
}
