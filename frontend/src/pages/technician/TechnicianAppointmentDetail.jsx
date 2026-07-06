import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";
const DEFAULT_SERVICE_IMAGE = "/images/default-service.png";

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.slice(0, 5);
}

const STATUS_STEPS = [
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán", icon: "▣" },
  { key: "PAID", label: "Đã thanh toán", icon: "💳" },
  { key: "CONFIRMED", label: "Đã xác nhận", icon: "✓" },
  { key: "CHECKED_IN", label: "Đã check-in", icon: "◇" },
  { key: "IN_PROGRESS", label: "Đang thực hiện", icon: "▶" },
  { key: "COMPLETED", label: "Hoàn thành", icon: "✓" },
  { key: "NO_SHOW", label: "Khách không đến", icon: "⊗" },
];

const STATUS_LABELS = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  NO_SHOW: "Khách không đến",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  UNPAID: "Chưa thanh toán",
};

const PROGRESS_LABELS = {
  IN_PROGRESS: "Đang theo dõi",
  IMPROVED: "Đã cải thiện",
  NEEDS_FOLLOW_UP: "Cần theo dõi lại",
  COMPLETED: "Hoàn thành",
};

const MEMBERSHIP_MAP = {
  Normal: "Thành viên Thường",
  Silver: "Thành viên Bạc",
  Gold: "Thành viên Vàng",
  Diamond: "Thành viên Kim cương",
  Platinum: "Thành viên Bạch kim",
};

function getMembershipLabel(level) {
  return MEMBERSHIP_MAP[level] || level || "Thành viên Thường";
}

const PAYMENT_METHOD_MAP = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  VNPAY: "Ví VNPAY",
  MOMO: "Ví Momo",
  PAYOS: "Cổng PayOS",
};

function getPaymentMethodLabel(method) {
  return PAYMENT_METHOD_MAP[String(method).toUpperCase()] || method || "—";
}

const translateNoteType = (type) => {
  const map = {
    'GENERAL': 'Ghi chú chung',
    'TREATMENT': 'Ghi chú trị liệu',
    'PRESCRIPTION': 'Phác đồ điều trị',
    'FOLLOWUP': 'Theo dõi',
  };
  return map[String(type).toUpperCase()] || type;
};

function fileUrl(url, fallback) {
  return resolveFileUrl(url) || fallback;
}

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("vi-VN") + " VND";
}

function safeDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function statusClass(status) {
  return String(status || "pending")
    .toLowerCase()
    .replaceAll("_", "-");
}

function statusLabel(status) {
  const key = String(status || "").toUpperCase();
  return STATUS_LABELS[key] || key.replaceAll("_", " ") || "—";
}

function progressLabel(status) {
  const key = String(status || "").toUpperCase();
  return PROGRESS_LABELS[key] || key.replaceAll("_", " ") || "—";
}

export default function TechnicianAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState("");
  const [rescheduleRequest, setRescheduleRequest] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rescheduleForm, setRescheduleForm] = useState({
    requestedDate: "",
    requestedStartTime: "",
    requestedEndTime: "",
    reason: ""
  });
  const [slots, setSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");


  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get(`/technician/appointments/${id}`);
      setAppointment(res.data.data || null);

      try {
        const resReq = await axiosClient.get("/reschedule/technician/reschedule-requests");
        const list = resReq.data?.data || [];
        const pending = list.find(r => Number(r.AppointmentId) === Number(id) && r.Status === "PENDING");
        setRescheduleRequest(pending || null);
      } catch (errReq) {
        console.warn("Failed to load reschedule requests:", errReq);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được chi tiết lịch hẹn",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitReschedule(e) {
    e.preventDefault();

    const [startH, startM] = rescheduleForm.requestedStartTime.split(":").map(Number);
    const [endH, endM] = rescheduleForm.requestedEndTime.split(":").map(Number);
    const startMin = startH * 60 + (startM || 0);
    const endMin = endH * 60 + (endM || 0);

    if (endMin <= startMin) {
      alert("Giờ kết thúc đề xuất phải sau giờ bắt đầu đề xuất!");
      return;
    }

    try {
      setActionLoading("reschedule");
      await axiosClient.post(`/reschedule/technician/appointments/${id}/reschedule-request`, rescheduleForm);
      alert("Gửi yêu cầu đề xuất đổi lịch thành công!");
      setShowRescheduleModal(false);
      setRescheduleForm({ requestedDate: "", requestedStartTime: "", requestedEndTime: "", reason: "" });
      setSlots([]);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể gửi yêu cầu đề xuất đổi lịch");
    } finally {
      setActionLoading("");
    }
  }

  async function loadSlots(selectedDate) {
    if (!selectedDate || !(detail.TechnicianId || detail.EmployeeId) || services.length === 0) {
      setSlots([]);
      setSlotError("");
      return;
    }
    try {
      setSlotLoading(true);
      setSlotError("");
      const res = await axiosClient.get("/appointments/available-slots", {
        params: {
          appointmentDate: selectedDate,
          employeeId: detail.TechnicianId || detail.EmployeeId,
          serviceId: services[0]?.ServiceId,
          excludeAppointmentId: id,
          includeAllSlots: true,
        },
      });
      const data = res.data.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setSlots(data.slots || []);
      } else {
        setSlots(data || []);
      }
    } catch (err) {
      console.error("Failed to load slots:", err);
      setSlotError(err.response?.data?.message || err.message || "Lỗi tải khung giờ trống");
      setSlots([]);
    } finally {
      setSlotLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const detail = appointment?.appointment || {};
  const services = appointment?.services || [];
  const history = appointment?.statusHistory || [];
  const notes = appointment?.treatmentNotes || [];

  function historyTime(statusKey) {
    return history.find((item) => item.NewStatus === statusKey)?.ChangedAt;
  }

  const status = String(detail.Status || "PENDING_PAYMENT").toUpperCase();
  const paymentStatus = String(detail.PaymentStatus || "UNPAID").toUpperCase();

  const activeStepIndex = useMemo(() => {
    const index = STATUS_STEPS.findIndex((step) => step.key === status);
    return index < 0 ? 0 : index;
  }, [status]);

  const canStart = ["CHECKED_IN", "CONFIRMED", "PAID"].includes(status);
  const canComplete = status === "IN_PROGRESS";
  const canNoShow = ["CONFIRMED", "CHECKED_IN", "PAID"].includes(status);



  async function runAction(type, url, message) {
    const ok = window.confirm(message);
    if (!ok) return;

    try {
      setActionLoading(type);
      await axiosClient.patch(url);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    } finally {
      setActionLoading("");
    }
  }



  return (
    <TechnicianLayout>
      <div className="tech-apd-page">
        <header className="tech-apd-topbar">
          <div>
            <button
              className="tech-apd-back"
              type="button"
              onClick={() => navigate("/technician/schedule")}
            >
              ‹ Quay lại lịch làm việc
            </button>

            <h1>
              Chi tiết lịch hẹn <span>▣</span>
            </h1>
            <p>Xem và quản lý thông tin lịch hẹn được phân công</p>
          </div>

          <div className="tech-apd-top-actions">
            <button className="tech-apd-round" type="button">
              🔔
            </button>

            <button className="tech-apd-round" type="button">
              ▣
            </button>

            <button
              className="tech-apd-new"
              type="button"
              onClick={() => navigate("/technician/schedule")}
            >
              Xem lịch làm việc
            </button>
          </div>
        </header>

        {loading ? (
          <div className="tech-apd-state">Đang tải chi tiết lịch hẹn...</div>
        ) : error ? (
          <div className="tech-apd-state tech-apd-error">{error}</div>
        ) : appointment ? (
          <>
            <section className="tech-apd-hero">
              <div className="tech-apd-hero-icon">▣</div>

              <div>
                <span>Mã lịch hẹn</span>
                <strong>
                  {detail.AppointmentCode || `#APT-${detail.AppointmentId}`}
                </strong>
              </div>

              <div>
                <span>Trạng thái</span>
                <b className={`tech-apd-badge ${statusClass(status)}`}>
                  {statusLabel(status)}
                </b>
              </div>

              <div>
                <span>Ngày & giờ</span>
                <strong>{safeDate(detail.AppointmentDate)}</strong>
                <small>
                  {detail.StartTime || "—"} - {detail.EndTime || "—"}
                </small>
              </div>

              <div>
                <span>Thời lượng</span>
                <strong>{detail.DurationMinutes || 0} phút</strong>
              </div>

              <div>
                <span>Kỹ thuật viên</span>
                <strong>{detail.TechnicianName || "—"}</strong>
                <small>Chuyên viên làm đẹp</small>
              </div>
            </section>

            <section className="tech-apd-layout">
              <main className="tech-apd-main">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">♙ Thông tin dịch vụ</div>

                  {services.length === 0 ? (
                    <div className="tech-apd-empty">Chưa có dịch vụ</div>
                  ) : (
                    services.map((srv, index) => (
                      <article
                        className="tech-apd-service"
                        key={`${srv.ServiceId}-${index}`}
                      >
                        <img
                          src={fileUrl(srv.ImageUrl, DEFAULT_SERVICE_IMAGE)}
                          alt={srv.ServiceName || "Dịch vụ"}
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_SERVICE_IMAGE;
                          }}
                        />

                        <div>
                          <h3>{srv.ServiceName}</h3>

                          <p>
                            {srv.Description ||
                              "Dịch vụ chăm sóc chuyên nghiệp tại salon."}
                          </p>

                          <div className="tech-apd-service-meta">
                            <span>
                              ◷{" "}
                              {srv.DurationMinutes ||
                                detail.DurationMinutes ||
                                0}{" "}
                              phút
                            </span>
                            <span>◉ {money(srv.Price)}</span>
                          </div>

                          <div className="tech-apd-tags">
                            <span>{srv.CategoryName || "Dịch vụ"}</span>
                            <small>
                              {index + 1}/{services.length}
                            </small>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="tech-apd-card tech-apd-timeline-card">
                  <div className="tech-apd-card-title">Tiến trình lịch hẹn</div>

                  <div className="tech-apd-vertical-timeline">
                    {STATUS_STEPS.map((step, index) => (
                      <div
                        className={index <= activeStepIndex ? "done" : ""}
                        key={step.key}
                      >
                        <i>{index <= activeStepIndex ? "✓" : "○"}</i>

                        <time>
                          {step.key === "IN_PROGRESS"
                            ? historyTime("IN_PROGRESS")
                              ? safeDateTime(historyTime("IN_PROGRESS"))
                              : "—"
                            : step.key === "COMPLETED"
                              ? detail.CompletedAt
                                ? safeDateTime(detail.CompletedAt)
                                : historyTime("COMPLETED")
                                  ? safeDateTime(historyTime("COMPLETED"))
                                  : "—"
                              : historyTime(step.key)
                                ? safeDateTime(historyTime(step.key))
                                : "—"}
                        </time>

                        <section>
                          <strong>{step.label}</strong>
                          <p>
                            {index <= activeStepIndex
                              ? step.key === status
                                ? "Trạng thái hiện tại"
                                : "Đã cập nhật"
                              : "Đang chờ"}
                          </p>
                        </section>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tech-apd-card" style={{ borderLeft: "4px solid #2f593a" }}>
                  <div className="tech-apd-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="tech-apd-card-title" style={{ color: "#2f593a", display: "flex", alignItems: "center", gap: "8px" }}>
                      📝 Ghi chú & Phác đồ Trị liệu ({notes.length})
                    </div>
                  </div>
                  <div style={{ marginTop: "12px", color: "#4a5568", fontSize: "0.9rem", lineHeight: "1.5" }}>
                    <p style={{ margin: "0 0 16px 0" }}>
                      Hồ sơ ghi chú chi tiết, hình ảnh chụp da/tóc/móng và hướng dẫn chăm sóc sau điều trị của khách hàng được quản lý đồng bộ và tập trung để tối ưu hóa phác đồ điều trị lâu dài.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/technician/treatment-notes?appointmentId=${detail.AppointmentId}`)}
                      style={{
                        backgroundColor: "#2f593a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 18px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s"
                      }}
                      className="hover-scale"
                    >
                      Viết & Xem chi tiết phác đồ →
                    </button>
                  </div>
                </div>
              </main>

              <section className="tech-apd-center">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    ♙ Trạng thái lịch hẹn
                  </div>

                  <div className="tech-apd-steps">
                    {STATUS_STEPS.map((step, index) => (
                      <div
                        className={`${index <= activeStepIndex ? "active" : ""} ${
                          step.key === status ? "current" : ""
                        }`}
                        key={step.key}
                      >
                        <i>{step.icon}</i>
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tech-apd-update-box">
                    <h3>Cập nhật trạng thái</h3>
                    <p>Cập nhật trạng thái hiện tại của lịch hẹn này</p>

                    {canStart && (
                      <button
                        className="tech-apd-action primary"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "start",
                            `/technician/appointments/${id}/start`,
                            "Bạn có chắc muốn bắt đầu thực hiện dịch vụ này?",
                          )
                        }
                      >
                        ▶{" "}
                        {actionLoading === "start"
                          ? "Đang xử lý..."
                          : "Bắt đầu dịch vụ"}
                      </button>
                    )}

                    {canComplete && (
                      <button
                        className="tech-apd-action gold"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "complete",
                            `/technician/appointments/${id}/complete`,
                            "Bạn có chắc muốn đánh dấu hoàn thành dịch vụ này?",
                          )
                        }
                      >
                        ✓{" "}
                        {actionLoading === "complete"
                          ? "Đang xử lý..."
                          : "Đánh dấu hoàn thành"}
                      </button>
                    )}

                    {canNoShow && (
                      <button
                        className="tech-apd-action danger"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "noshow",
                            `/technician/appointments/${id}/no-show`,
                            "Bạn có chắc muốn đánh dấu khách không đến?",
                          )
                        }
                      >
                        ⊗{" "}
                        {actionLoading === "noshow"
                          ? "Đang xử lý..."
                          : "Khách không đến"}
                      </button>
                    )}

                    {!canStart && !canComplete && !canNoShow && (
                      <div className="tech-apd-empty">
                        Trạng thái này hiện không còn thao tác cập nhật.
                      </div>
                    )}
                  </div>
                </div>

                {/* Reschedule Request Card */}
                {["PENDING_PAYMENT", "PENDING", "CONFIRMED", "PAID"].includes(status) && (
                  <div className="tech-apd-card" style={{ borderLeft: "4px solid #d4a94f" }}>
                    <div className="tech-apd-card-title" style={{ color: "#7a5e44", display: "flex", alignItems: "center", gap: "8px" }}>
                      📅 Đề xuất đổi lịch hẹn
                    </div>
                    <div style={{ marginTop: "12px", color: "#4a5568", fontSize: "0.9rem", lineHeight: "1.45" }}>
                      <p style={{ margin: "0 0 16px 0" }}>
                        Nếu bạn bận đột xuất hoặc khách hàng yêu cầu dời giờ, bạn có thể tạo đề xuất giờ mới để gửi cho Lễ tân duyệt.
                      </p>
                      
                      {rescheduleRequest ? (
                        <div style={{ background: "#fcf8e3", border: "1px solid #faebcc", color: "#8a6d3b", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                          <b style={{ display: "block", marginBottom: "4px" }}>Đang chờ duyệt đổi lịch:</b>
                          <div>Đề xuất: <b>{safeDate(rescheduleRequest.RequestedDate)}</b> lúc <b>{String(rescheduleRequest.RequestedStartTime).slice(0, 5)}</b></div>
                          <div style={{ fontSize: "0.75rem", color: "#8a6d3b", opacity: 0.8, marginTop: "6px" }}>
                            Lý do: {rescheduleRequest.Reason || "—"}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowRescheduleModal(true)}
                          style={{
                            backgroundColor: "#FAF6F0",
                            color: "#7a5e44",
                            border: "1px solid #d4a94f",
                            borderRadius: "10px",
                            padding: "10px 18px",
                            fontWeight: "700",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            width: "100%",
                            transition: "all 0.2s"
                          }}
                          className="hover-scale"
                        >
                          Đề xuất đổi lịch →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Lịch sử trạng thái</div>

                  <div className="tech-apd-history">
                    {history.length === 0 ? (
                      <div className="tech-apd-empty">
                        Chưa có lịch sử trạng thái
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={
                            item.HistoryId ||
                            `${item.NewStatus}-${item.ChangedAt}`
                          }
                        >
                          <b className={statusClass(item.NewStatus)}>
                            {statusLabel(item.NewStatus)}
                          </b>
                          <span>{safeDateTime(item.ChangedAt)}</span>
                          <small>bởi {item.ChangedByName || "Hệ thống"}</small>
                        </div>
                      ))
                    )}
                  </div>
                </div>


              </section>

              <aside className="tech-apd-side">
                <div className="tech-apd-card tech-apd-customer">
                  <div className="tech-apd-card-title">
                    ♡ Thông tin khách hàng
                  </div>

                  <div className="tech-apd-customer-main">
                    <img
                      src={fileUrl(detail.CustomerAvatar, DEFAULT_AVATAR)}
                      alt={detail.CustomerName || "Khách hàng"}
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div>
                      <h3>
                        {detail.CustomerName || "Khách hàng"}{" "}
                        <span>{getMembershipLabel(detail.MembershipLevel)}</span>
                      </h3>
                      <p>♧ {detail.CustomerPhone || "Chưa có số điện thoại"}</p>
                      <p>✉ {detail.CustomerEmail || "Chưa có email"}</p>
                    </div>
                  </div>

                  <button
                    className="tech-apd-outline"
                    type="button"
                    disabled={!detail.CustomerId}
                    onClick={() =>
                      navigate(
                        `/technician/customers?customerId=${detail.CustomerId}`,
                      )
                    }
                  >
                    Xem hồ sơ khách hàng
                  </button>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    Ghi chú của khách hàng
                  </div>

                  <div className="tech-apd-customer-note">
                    <b>Ghi chú lịch hẹn</b>
                    <p>
                      {detail.Notes ||
                        "Khách chưa nhập ghi chú cho lịch hẹn này."}
                    </p>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    Thông tin thanh toán
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Trạng thái thanh toán</span>
                    <b
                      className={`tech-apd-badge ${statusClass(paymentStatus)}`}
                    >
                      {statusLabel(paymentStatus)}
                    </b>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Tổng tiền</span>
                    <strong>{money(detail.TotalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Giảm giá</span>
                    <strong>{money(detail.DiscountAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Thành tiền</span>
                    <strong>{money(detail.FinalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Phương thức thanh toán</span>
                    <strong>{getPaymentMethodLabel(detail.PaymentMethod)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Mã giao dịch</span>
                    <strong>{detail.TransactionCode || "—"}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Ngày thanh toán</span>
                    <strong>{safeDateTime(detail.PaidAt)}</strong>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Thao tác nhanh</div>

                  <div className="tech-apd-quick-list">
                    <button
                      type="button"
                      disabled={!detail.CustomerId}
                      onClick={() =>
                        navigate(
                          `/technician/customers?customerId=${detail.CustomerId}`,
                        )
                      }
                    >
                      ▣ Xem lịch sử khách hàng <span>›</span>
                    </button>

                    <button
                      type="button"
                      disabled={!detail.CustomerId}
                      onClick={() =>
                        navigate(
                          `/technician/customers?customerId=${detail.CustomerId}`,
                        )
                      }
                    >
                      ♙ Hồ sơ khách hàng <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/technician/treatment-notes?appointmentId=${detail.AppointmentId}`,
                        )
                      }
                    >
                      ✎ Ghi chú dịch vụ <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/technician/schedule")}
                    >
                      ♧ Quay lại lịch làm việc <span>›</span>
                    </button>
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <div className="tech-apd-state">Không tìm thấy lịch hẹn.</div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && (
          <div className="modal-overlay" style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}>
            <div className="modal-content" style={{
              backgroundColor: "#ffffff",
              padding: "24px",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "450px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)"
            }}>
              <h3 style={{ margin: "0 0 16px 0", color: "#1e3a29", fontSize: "1.2rem", fontWeight: "bold" }}>
                📅 Đề xuất đổi lịch hẹn mới
              </h3>
              <form onSubmit={submitReschedule}>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4a5568", textTransform: "uppercase" }}>Chọn ngày đề xuất *</label>
                    <input
                      type="date"
                      value={rescheduleForm.requestedDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setRescheduleForm({ ...rescheduleForm, requestedDate: newDate, requestedStartTime: "", requestedEndTime: "" });
                        loadSlots(newDate);
                      }}
                      required
                      style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e0", outline: "none" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4a5568", textTransform: "uppercase" }}>Chọn khung giờ trống *</label>
                    {slotLoading ? (
                      <div style={{ fontSize: "0.85rem", color: "#718096", padding: "8px 0" }}>Đang tải danh sách giờ trống...</div>
                    ) : slotError ? (
                      <div style={{ fontSize: "0.85rem", color: "#e53e3e", padding: "8px 0" }}>Lỗi: {slotError}</div>
                    ) : !rescheduleForm.requestedDate ? (
                      <div style={{ fontSize: "0.85rem", color: "#a0aec0", padding: "8px 0" }}>Vui lòng chọn ngày trước</div>
                    ) : slots.length === 0 ? (
                      <div style={{ fontSize: "0.85rem", color: "#e53e3e", padding: "8px 0" }}>Không có khung giờ nào trống trong ngày này</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px", maxHeight: "150px", overflowY: "auto", padding: "4px" }}>
                        {slots.map((slot) => {
                          const isSlotAvailable = slot.available !== false;
                          const formattedStart = formatTime(slot.startTime);
                          const isActive = rescheduleForm.requestedStartTime === slot.startTime;

                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              disabled={!isSlotAvailable}
                              onClick={() => {
                                setRescheduleForm({
                                  ...rescheduleForm,
                                  requestedStartTime: slot.startTime,
                                  requestedEndTime: slot.endTime
                                });
                              }}
                              style={{
                                padding: "8px",
                                borderRadius: "8px",
                                border: isActive ? "2.5px solid #2f593a" : "1.5px solid #edf2f7",
                                background: isActive ? "#2f593a" : isSlotAvailable ? "#ffffff" : "#f7fafc",
                                color: isActive ? "#ffffff" : isSlotAvailable ? "#2d3748" : "#a0aec0",
                                fontWeight: isActive ? "700" : "600",
                                fontSize: "0.8rem",
                                cursor: isSlotAvailable ? "pointer" : "not-allowed",
                                textAlign: "center",
                                transition: "all 0.2s"
                              }}
                            >
                              {formattedStart}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {rescheduleForm.requestedStartTime && (
                    <div style={{ background: "#edf7ed", color: "#1e4620", padding: "10px 14px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "600" }}>
                      ⏰ Đã chọn: {formatTime(rescheduleForm.requestedStartTime)} - {formatTime(rescheduleForm.requestedEndTime)}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4a5568", textTransform: "uppercase" }}>Lý do đổi lịch *</label>
                    <textarea
                      placeholder="Lý do bận / đổi giờ..."
                      value={rescheduleForm.reason}
                      onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                      required
                      rows={3}
                      style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e0", outline: "none", resize: "none" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(false)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e0",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: "600"
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === "reschedule"}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "10px",
                      border: "none",
                      backgroundColor: "#2f593a",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: "600"
                    }}
                  >
                    {actionLoading === "reschedule" ? "Đang gửi..." : "Gửi đề xuất"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
