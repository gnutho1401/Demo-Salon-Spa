import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function dateText(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
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
  const canNoShow = ["CONFIRMED", "PENDING", "PENDING_PAYMENT"].includes(
    status,
  );
  const canEdit = ![
    "COMPLETED",
    "CANCELLED",
    "REFUND_PENDING",
    "NO_SHOW",
  ].includes(status);

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
        appointmentDate: dateText(data?.AppointmentDate),
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
      setSuccess("Đã xác nhận thanh toán và cập nhật lịch hẹn");
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận thanh toán thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function submitCancel(e) {
    e.preventDefault();

    if (!cancelReason.trim()) {
      setError("Vui lòng nhập lý do hủy lịch");
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
        "Đã hủy lịch hẹn. Nếu đã thanh toán, hệ thống đã tạo yêu cầu hoàn tiền.",
      );
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
      setError("Vui lòng chọn đủ ngày, giờ và kỹ thuật viên");
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
      setSuccess("Đã đổi lịch và phân công kỹ thuật viên thành công");
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="ra-detail-page">
        <div className="ra-detail-header">
          <div>
            <Link to="/receptionist/appointments" className="ra-back-link">
              ← Quay lại danh sách
            </Link>
            <h1>Chi tiết lịch hẹn #{id}</h1>
            <p>
              Quản lý check-in, thanh toán, đổi lịch, hủy lịch và theo dõi trạng
              thái.
            </p>
          </div>

          {item ? (
            <div className="ra-header-badges">
              <span
                className={`rx-badge status-${String(item.Status || "").toLowerCase()}`}
              >
                {statusLabel(item.Status)}
              </span>
              <span
                className={`rx-badge payment-${String(item.PaymentStatus || "UNPAID").toLowerCase()}`}
              >
                {paymentLabel(item.PaymentStatus)}
              </span>
            </div>
          ) : null}
        </div>

        {loading && <div className="ra-alert info">Đang tải dữ liệu...</div>}
        {error && <div className="ra-alert error">{error}</div>}
        {success && <div className="ra-alert success">{success}</div>}

        {item ? (
          <>
            <div className="ra-overview">
              <div className="ra-hero-card">
                <img
                  className="ra-avatar"
                  src={avatarUrl(item.CustomerAvatarUrl)}
                  alt={item.CustomerName || "Customer"}
                />

                <div>
                  <span className="ra-eyebrow">Khách hàng</span>
                  <h2>{item.CustomerName || "-"}</h2>
                  <p>
                    {item.CustomerPhone || "-"} • {item.CustomerEmail || "-"}
                  </p>
                </div>
              </div>

              <div className="ra-mini-card">
                <span>📅</span>
                <p>Ngày hẹn</p>
                <b>{dateText(item.AppointmentDate)}</b>
              </div>

              <div className="ra-mini-card">
                <span>⏰</span>
                <p>Giờ hẹn</p>
                <b>
                  {item.StartTime} - {item.EndTime}
                </b>
              </div>

              <div className="ra-mini-card">
                <span>💰</span>
                <p>Tổng tiền</p>
                <b>{money(item.FinalAmount)}</b>
              </div>
            </div>

            <div className="ra-grid">
              <section className="ra-card ra-main-card">
                <div className="ra-card-title">
                  <h3>Thông tin lịch hẹn</h3>
                  <span>Appointment #{item.AppointmentId}</span>
                </div>

                <div className="ra-info-grid">
                  <div>
                    <label>Dịch vụ</label>
                    <strong>{servicesText}</strong>
                  </div>

                  <div>
                    <label>Kỹ thuật viên</label>
                    <strong>{item.TechnicianName || "-"}</strong>
                    <small>{item.Specialization || item.Position || "-"}</small>
                  </div>

                  <div>
                    <label>Ngày</label>
                    <strong>{dateText(item.AppointmentDate)}</strong>
                  </div>

                  <div>
                    <label>Giờ</label>
                    <strong>
                      {item.StartTime} - {item.EndTime}
                    </strong>
                  </div>

                  <div>
                    <label>Ghi chú</label>
                    <strong>{item.Notes || "Không có ghi chú"}</strong>
                  </div>

                  <div>
                    <label>Lý do hủy</label>
                    <strong>{item.CancelReason || "Không có"}</strong>
                  </div>
                </div>
              </section>

              <section className="ra-card">
                <div className="ra-card-title">
                  <h3>Khách hàng</h3>
                  <Link to={`/receptionist/customers/${item.CustomerId}`}>
                    Xem hồ sơ
                  </Link>
                </div>

                <div className="ra-profile-line">
                  <img
                    className="ra-small-avatar"
                    src={avatarUrl(item.CustomerAvatarUrl)}
                    alt={item.CustomerName || "Customer"}
                  />
                  <div>
                    <b>{item.CustomerName || "-"}</b>
                    <p>{item.CustomerPhone || "-"}</p>
                    <p>{item.CustomerEmail || "-"}</p>
                  </div>
                </div>
              </section>

              <section className="ra-card">
                <div className="ra-card-title">
                  <h3>Kỹ thuật viên</h3>
                </div>

                <div className="ra-profile-line">
                  <img
                    className="ra-small-avatar tech"
                    src={avatarUrl(
                      item.TechnicianImageUrl || item.TechnicianAvatarUrl,
                    )}
                    alt={item.TechnicianName || "Technician"}
                  />
                  <div>
                    <b>{item.TechnicianName || "-"}</b>
                    <p>{item.TechnicianPhone || "-"}</p>
                    <p>{item.TechnicianEmail || "-"}</p>
                  </div>
                </div>
              </section>

              <section className="ra-card">
                <div className="ra-card-title">
                  <h3>Hóa đơn & thanh toán</h3>
                  {item.InvoiceId ? (
                    <Link to={`/receptionist/invoices/${item.InvoiceId}`}>
                      Xem hóa đơn
                    </Link>
                  ) : null}
                </div>

                <div className="ra-money-list">
                  <div>
                    <span>Tạm tính</span>
                    <b>{money(item.TotalAmount)}</b>
                  </div>
                  <div>
                    <span>Giảm giá</span>
                    <b>{money(item.DiscountAmount)}</b>
                  </div>
                  <div>
                    <span>Thành tiền</span>
                    <b>{money(item.FinalAmount)}</b>
                  </div>
                  <div>
                    <span>Phương thức</span>
                    <b>{item.PaymentMethod || "-"}</b>
                  </div>
                  <div>
                    <span>Mã giao dịch</span>
                    <b>{item.TransactionCode || "-"}</b>
                  </div>
                  <div>
                    <span>Ngày thanh toán</span>
                    <b>
                      {item.PaidAt ? String(item.PaidAt).slice(0, 19) : "-"}
                    </b>
                  </div>
                </div>

                {canMarkPaid ? (
                  <button
                    className="ra-btn primary full"
                    type="button"
                    onClick={() => setShowPayment(true)}
                  >
                    Xác nhận đã thanh toán
                  </button>
                ) : null}
              </section>

              {item.RefundInfo ? (
                <section className="ra-card">
                  <div className="ra-card-title">
                    <h3>Hoàn tiền</h3>
                  </div>

                  <div className="ra-money-list">
                    <div>
                      <span>Trạng thái</span>
                      <b>{item.RefundInfo.RefundStatus || "-"}</b>
                    </div>
                    <div>
                      <span>Số tiền</span>
                      <b>{money(item.RefundInfo.RefundAmount)}</b>
                    </div>
                    <div>
                      <span>Lý do</span>
                      <b>{item.RefundInfo.RefundReason || "-"}</b>
                    </div>
                    <div>
                      <span>Thông báo</span>
                      <b>{item.RefundInfo.MomoMessage || "-"}</b>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <section className="ra-card ra-action-card">
              <div className="ra-card-title">
                <h3>Thao tác lễ tân</h3>
                <span>Chỉ hiện nút phù hợp với trạng thái hiện tại</span>
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
                        "Đã xác nhận lịch hẹn",
                      )
                    }
                  >
                    ✓ Xác nhận
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
                        "Đã check-in khách hàng",
                      )
                    }
                  >
                    ✅ Check-in
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
                        "Đã bắt đầu dịch vụ",
                      )
                    }
                  >
                    ▶ Bắt đầu dịch vụ
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
                        "Đã hoàn thành lịch hẹn",
                      )
                    }
                  >
                    ★ Hoàn thành
                  </button>
                )}

                {canEdit && (
                  <button
                    className="ra-btn light"
                    type="button"
                    disabled={saving}
                    onClick={() => setShowReschedule(true)}
                  >
                    🔁 Đổi lịch / đổi KTV
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
                        "Đã chuyển lịch sang trạng thái khách không đến",
                      )
                    }
                  >
                    ⚠ No-show
                  </button>
                )}

                {canEdit && (
                  <button
                    className="ra-btn danger"
                    type="button"
                    disabled={saving}
                    onClick={() => setShowCancel(true)}
                  >
                    ✕ Hủy lịch
                  </button>
                )}
              </div>
            </section>

            {Array.isArray(item.StatusHistory) &&
            item.StatusHistory.length > 0 ? (
              <section className="ra-card">
                <div className="ra-card-title">
                  <h3>Lịch sử trạng thái</h3>
                </div>

                <div className="ra-timeline">
                  {item.StatusHistory.map((h) => (
                    <div className="ra-timeline-item" key={h.HistoryId}>
                      <span></span>
                      <div>
                        <b>
                          {statusLabel(h.OldStatus) || "Tạo lịch"} →{" "}
                          {statusLabel(h.NewStatus)}
                        </b>
                        <p>{h.Reason || "-"}</p>
                        <small>
                          {h.ChangedByName || "System"} •{" "}
                          {h.ChangedAt ? String(h.ChangedAt).slice(0, 19) : ""}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {showPayment && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal" onSubmit={markPaid}>
                  <h3>Xác nhận thanh toán</h3>
                  <p>Chọn phương thức thanh toán tại quầy.</p>

                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="CARD">Thẻ</option>
                    <option value="TRANSFER">Chuyển khoản</option>
                  </select>

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang xử lý..." : "Xác nhận"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowPayment(false)}
                    >
                      Đóng
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showCancel && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal" onSubmit={submitCancel}>
                  <h3>Hủy lịch hẹn</h3>
                  <p>
                    Nếu lịch đã thanh toán, hệ thống sẽ tạo yêu cầu hoàn tiền.
                  </p>

                  <textarea
                    rows="5"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy lịch..."
                    required
                  />

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn danger"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang xử lý..." : "Xác nhận hủy"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowCancel(false)}
                    >
                      Đóng
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showReschedule && (
              <div className="ra-modal-backdrop">
                <form className="ra-modal wide" onSubmit={submitReschedule}>
                  <h3>Đổi lịch / đổi kỹ thuật viên</h3>

                  <div className="ra-form-grid">
                    <label>
                      Ngày mới
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
                      />
                    </label>

                    <label>
                      Giờ mới
                      <input
                        type="time"
                        value={rescheduleForm.startTime}
                        onChange={(e) =>
                          setRescheduleForm((p) => ({
                            ...p,
                            startTime: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Kỹ thuật viên khả dụng
                      <select
                        value={rescheduleForm.technicianId}
                        onChange={(e) =>
                          setRescheduleForm((p) => ({
                            ...p,
                            technicianId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Chọn kỹ thuật viên</option>
                        {availableTechnicians.map((t) => (
                          <option key={t.EmployeeId} value={t.EmployeeId}>
                            {t.TechnicianName}{" "}
                            {t.Position ? `- ${t.Position}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="ra-muted">
                    Tìm thấy {availableTechnicians.length} kỹ thuật viên khả
                    dụng.
                  </p>

                  <div className="ra-modal-actions">
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Đang xử lý..." : "Cập nhật lịch hẹn"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => setShowReschedule(false)}
                    >
                      Đóng
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
