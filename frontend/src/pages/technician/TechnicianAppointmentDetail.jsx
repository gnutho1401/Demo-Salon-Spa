import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";
const DEFAULT_SERVICE_IMAGE = "/images/services/default-service.png";

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

function statusLabel(status, isCombo = false, allCompleted = false) {
  const key = String(status || "").toUpperCase();
  if (isCombo) {
    if (key === "CONFIRMED") return "Đã đặt (Gói Combo)";
    if (key === "CHECKED_IN") return "Đã check-in (Gói Combo)";
    if (key === "IN_PROGRESS") return "Đang thực hiện Combo";
    if (key === "COMPLETED") return allCompleted ? "Hoàn thành Combo" : "Hoàn thành dịch vụ";
    if (key === "CANCELLED") return "Đã hủy lịch Combo";
  }
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
  const [searchParams, setSearchParams] = useSearchParams();
  const paramServiceId = searchParams.get("serviceId") || searchParams.get("appointmentServiceId");
  const [selectedServiceId, setSelectedServiceId] = useState(paramServiceId ? Number(paramServiceId) : null);

  const [slots, setSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    axiosClient.get("/technician/profile").then(res => {
      setMyProfile(res.data?.data || null);
    }).catch(() => {});
  }, []);




  async function load() {
    try {
      setLoading(true);
      setError("");

      let profile = myProfile;
      if (!profile) {
        try {
          const profRes = await axiosClient.get("/technician/profile");
          profile = profRes.data?.data || null;
          setMyProfile(profile);
        } catch (pErr) {
          console.warn("Failed to load technician profile:", pErr);
        }
      }

      const res = await axiosClient.get(`/technician/appointments/${id}`);
      const data = res.data.data || null;
      setAppointment(data);

      const svcs = data?.services || [];
      if (svcs.length > 0) {
        setSelectedServiceId((prevSelected) => {
          if (prevSelected && prevSelected !== "ALL") {
            const exists = svcs.find(
              (s) => Number(s.ServiceId) === Number(prevSelected) || Number(s.AppointmentServiceId) === Number(prevSelected)
            );
            if (exists) return prevSelected;
          }
          if (paramServiceId) {
            const paramMatch = svcs.find(
              (s) => Number(s.ServiceId) === Number(paramServiceId) || Number(s.AppointmentServiceId) === Number(paramServiceId)
            );
            if (paramMatch) return paramMatch.AppointmentServiceId || paramMatch.ServiceId;
          }
          const myEmpId = profile?.EmployeeId;
          const myStep = myEmpId ? svcs.find((s) => Number(s.EmployeeId) === Number(myEmpId)) : null;
          if (myStep) {
            return myStep.AppointmentServiceId || myStep.ServiceId;
          }
          const inProg = svcs.find((s) => s.StepStatus === "IN_PROGRESS");
          const pend = svcs.find((s) => s.StepStatus === "PENDING");
          return (inProg || pend || svcs[0])?.AppointmentServiceId || (inProg || pend || svcs[0])?.ServiceId;
        });
      }





      try {
        const resReq = await axiosClient.get("/reschedule/technician/reschedule-requests");
        const list = resReq.data?.data || [];
        // Lấy request mới nhất của appointment này (bất kể trạng thái)
        const allForAppt = list.filter(r => Number(r.AppointmentId) === Number(id));
        const latest = allForAppt.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))[0] || null;
        setRescheduleRequest(latest);
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

  async function cancelReschedule() {
    if (!rescheduleRequest || !window.confirm("Bạn có chắc chắn muốn hủy yêu cầu đề xuất đổi lịch này không?")) return;
    try {
      setActionLoading("cancel_reschedule");
      await axiosClient.put(`/reschedule/technician/reschedule-requests/${rescheduleRequest.RequestId}/cancel`);
      alert("Đã hủy yêu cầu đề xuất đổi lịch thành công!");
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể hủy yêu cầu đề xuất đổi lịch");
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

  const filteredServices = useMemo(() => {
    if (!services || services.length === 0) return [];
    if (selectedServiceId && selectedServiceId !== "ALL") {
      const found = services.find(
        (s) => Number(s.ServiceId) === Number(selectedServiceId) || Number(s.AppointmentServiceId) === Number(selectedServiceId)
      );
      if (found) return [found];
    }
    // Default to step assigned to logged in technician
    const myEmpId = myProfile?.EmployeeId;
    if (myEmpId) {
      const myStep = services.find((s) => Number(s.EmployeeId) === Number(myEmpId));
      if (myStep) return [myStep];
    }

    return [services[0]];
  }, [services, selectedServiceId, myProfile]);

  const currentService = filteredServices[0] || services[0] || null;

  const getServiceTimeRange = useMemo(() => {
    return (targetSvc) => {
      if (!targetSvc) return `${detail.StartTime || "—"} - ${detail.EndTime || "—"}`;

      if (targetSvc.StepStartTime && targetSvc.StepEndTime) {
        return `${targetSvc.StepStartTime.slice(0, 5)} - ${targetSvc.StepEndTime.slice(0, 5)}`;
      }

      const defaultStartTime = detail.StartTime;
      if (!defaultStartTime || !defaultStartTime.includes(":")) {
        return `${detail.StartTime || "—"} - ${detail.EndTime || "—"}`;
      }

      const targetIdx = services.findIndex(
        s => (targetSvc.AppointmentServiceId && s.AppointmentServiceId === targetSvc.AppointmentServiceId) ||
             (targetSvc.ServiceId && s.ServiceId === targetSvc.ServiceId)
      );

      let startMinutes = 0;
      const [h, m] = defaultStartTime.split(":").map(Number);
      const baseMinutes = (h || 0) * 60 + (m || 0);

      for (let i = 0; i < (targetIdx >= 0 ? targetIdx : 0); i++) {
        startMinutes += Number(services[i].DurationMinutes) || 0;
      }

      const stepStartTotal = baseMinutes + startMinutes;
      const stepEndTotal = stepStartTotal + (Number(targetSvc.DurationMinutes) || 0);

      const formatMins = (totalMins) => {
        const hrs = Math.floor(totalMins / 60) % 24;
        const mins = totalMins % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
      };

      return `${formatMins(stepStartTotal)} - ${formatMins(stepEndTotal)}`;
    };
  }, [detail.StartTime, detail.EndTime, services]);

  const uncompletedSteps = useMemo(() => {
    return services.filter((s) => s.StepStatus !== "COMPLETED");
  }, [services]);

  const allServicesCompleted = useMemo(() => {
    return services.length > 0 && uncompletedSteps.length === 0;
  }, [services, uncompletedSteps]);

  const status = useMemo(() => {
    if (allServicesCompleted) {
      return "COMPLETED";
    }
    if (detail.CustomerPackageId && currentService) {
      const stepStat = String(currentService.StepStatus || currentService.Status || "").toUpperCase();
      if (stepStat === "COMPLETED") return "COMPLETED";
      if (stepStat === "IN_PROGRESS") return "IN_PROGRESS";
      if (stepStat === "PENDING" || stepStat === "CONFIRMED" || stepStat === "CHECKED_IN") {
        const apptStat = String(detail.Status || "").toUpperCase();
        return ["CHECKED_IN", "IN_PROGRESS"].includes(apptStat) ? "CHECKED_IN" : "CONFIRMED";
      }
    }
    return String(detail.Status || "PENDING_PAYMENT").toUpperCase();
  }, [allServicesCompleted, detail.CustomerPackageId, currentService, detail.Status]);

  const paymentStatus = String(detail.PaymentStatus || "UNPAID").toUpperCase();


  const displaySteps = useMemo(() => {
    if (detail.CustomerPackageId) {
      const steps = [
        { key: "CONFIRMED", label: "Đã đặt (Gói Combo)", icon: "📦" },
        { key: "CHECKED_IN", label: "Đã check-in", icon: "◇" },
        { key: "IN_PROGRESS", label: "Đang thực hiện", icon: "▶" },
        { key: "COMPLETED", label: "Hoàn thành", icon: "✓" },
      ];
      if (status === "NO_SHOW") steps.push({ key: "NO_SHOW", label: "Khách không đến", icon: "⊗" });
      if (status === "CANCELLED") steps.push({ key: "CANCELLED", label: "Đã hủy lịch", icon: "🚫" });
      return steps;
    } else {
      const steps = [];
      if (status === "PENDING_PAYMENT" || paymentStatus === "UNPAID") {
        steps.push({ key: "PENDING_PAYMENT", label: "Chờ thanh toán", icon: "▣" });
      } else {
        steps.push({ key: "PAID", label: "Đã thanh toán", icon: "💳" });
      }
      steps.push(
        { key: "CONFIRMED", label: "Đã xác nhận", icon: "✓" },
        { key: "CHECKED_IN", label: "Đã check-in", icon: "◇" },
        { key: "IN_PROGRESS", label: "Đang thực hiện", icon: "▶" },
        { key: "COMPLETED", label: "Hoàn thành", icon: "✓" }
      );
      if (status === "NO_SHOW") steps.push({ key: "NO_SHOW", label: "Khách không đến", icon: "⊗" });
      if (status === "CANCELLED") steps.push({ key: "CANCELLED", label: "Đã hủy", icon: "🚫" });
      return steps;
    }
  }, [detail.CustomerPackageId, status, paymentStatus]);

  const activeStepIndex = useMemo(() => {
    const index = displaySteps.findIndex((step) => step.key === status);
    return index < 0 ? 0 : index;
  }, [displaySteps, status]);






  const canStart = ["CHECKED_IN", "CONFIRMED", "PAID", "IN_PROGRESS"].includes(status);
  const canComplete = status === "IN_PROGRESS";
  const canNoShow = ["CONFIRMED", "CHECKED_IN", "PAID"].includes(status);

  const inProgressStep = useMemo(() => {
    return services.find((s) => s.StepStatus === "IN_PROGRESS");
  }, [services]);

  const nextPendingStep = useMemo(() => {
    return services.find((s) => s.StepStatus === "PENDING" || (!s.StepStatus && status !== "COMPLETED"));
  }, [services, status]);




  async function runAction(type, url, message) {
    const ok = window.confirm(message);
    if (!ok) return;

    try {
      setActionLoading(type);
      await axiosClient.patch(url);
      if (type === "complete") {
        alert("✅ Đã hoàn thành dịch vụ!");
      }
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
                  {statusLabel(status, !!detail.CustomerPackageId, allServicesCompleted)}
                </b>
              </div>


              <div>
                <span>Ngày &amp; giờ</span>
                <strong>{safeDate(detail.AppointmentDate)}</strong>
                <small>
                  {detail.CustomerPackageId
                    ? (selectedServiceId && selectedServiceId !== "ALL" && currentService
                        ? getServiceTimeRange(currentService)
                        : `${detail.StartTime || "—"} - ${detail.EndTime || "—"}`
                      )
                    : `${detail.StartTime || "—"} - ${detail.EndTime || "—"}`
                  }
                </small>
              </div>

              <div>
                <span>Thời lượng</span>
                <strong>
                  {detail.CustomerPackageId
                    ? (selectedServiceId && selectedServiceId !== "ALL" && currentService
                        ? (Number(currentService.DurationMinutes) || 0)
                        : services.reduce((sum, s) => sum + (Number(s.DurationMinutes) || 0), 0)
                      )
                    : (services.reduce((sum, s) => sum + (Number(s.DurationMinutes) || 0), 0) || (detail.DurationMinutes || 0))
                  } phút
                </strong>
              </div>

              <div>
                <span>Kỹ thuật viên</span>
                <strong>
                  {selectedServiceId === "ALL"
                    ? (detail.TechnicianName || "—")
                    : (currentService?.AssignedTechnicianName || currentService?.TechnicianName || detail.TechnicianName || "—")
                  }
                </strong>
                <small>Chuyên viên làm đẹp</small>
              </div>
            </section>

            <section className="tech-apd-layout">
              <main className="tech-apd-main">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    {detail.CustomerPackageId ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 6 }}>
                        <span>📦 Dịch vụ thuộc Gói Combo: <strong style={{ color: "#be185d" }}>{detail.PackageName || "Gói Combo"}</strong></span>
                        <span style={{ fontSize: 11, background: "#fdf2f8", color: "#be185d", padding: "2px 8px", borderRadius: 12, border: "1px solid #fbcfe8", fontWeight: 700 }}>
                          Gói Combo #{detail.CustomerPackageId}
                        </span>
                      </div>
                    ) : (
                      "♙ Thông tin dịch vụ"
                    )}
                  </div>




                  {services.length > 1 && (
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", marginTop: "12px", flexWrap: "wrap" }}>
                      {services.map((srv) => {
                        const isSelected = Number(srv.ServiceId) === Number(selectedServiceId) || Number(srv.AppointmentServiceId) === Number(selectedServiceId);
                        const isMine = myProfile?.EmployeeId && Number(srv.EmployeeId) === Number(myProfile.EmployeeId);
                        return (
                          <button
                            key={srv.AppointmentServiceId || srv.ServiceId}
                            type="button"
                            onClick={() => setSelectedServiceId(srv.AppointmentServiceId || srv.ServiceId)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: isSelected ? "2px solid #059669" : "1px solid #e2e8f0",
                              background: isSelected ? "#ecfdf5" : "#f8fafc",
                              color: isSelected ? "#047857" : "#475569",
                              fontWeight: isSelected ? "700" : "500",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            {srv.ServiceName}
                            {isMine && <span style={{ background: "#d1fae5", color: "#065f46", fontSize: "0.7rem", padding: "1px 5px", borderRadius: "4px", fontWeight: "700" }}>Dịch vụ của bạn</span>}
                            {srv.StepStatus === "COMPLETED" && <span style={{ color: "#059669", fontWeight: "700" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredServices.length === 0 ? (
                    <div className="tech-apd-empty">Chưa có dịch vụ</div>
                  ) : (
                    filteredServices.map((srv, index) => (

                      <article
                        className="tech-apd-service"
                        key={`${srv.ServiceId}-${srv.AppointmentServiceId || index}`}
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

                          {/* Với Combo: hiển thị KTV phân công và thời gian bước riêng */}
                          {detail.CustomerPackageId && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                              <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: "6px", padding: "2px 8px", fontSize: "0.78rem", fontWeight: "700", border: "1px solid #bfdbfe" }}>
                                👤 KTV: {srv.AssignedTechnicianName || srv.TechnicianName || detail.TechnicianName || "Tự động phân công"}
                              </span>
                              {(srv.StepStartTime || srv.StepEndTime) && (
                                <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: "6px", padding: "2px 8px", fontSize: "0.78rem", fontWeight: "700" }}>
                                  ⏱ {srv.StepStartTime} – {srv.StepEndTime}
                                </span>
                              )}
                              {srv.StepStatus && (
                                <span style={{
                                  background: srv.StepStatus === 'COMPLETED' ? '#dcfce7' : srv.StepStatus === 'IN_PROGRESS' ? '#fef9c3' : '#f1f5f9',
                                  color: srv.StepStatus === 'COMPLETED' ? '#15803d' : srv.StepStatus === 'IN_PROGRESS' ? '#92400e' : '#64748b',
                                  borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: "700"
                                }}>
                                  {srv.StepStatus === 'COMPLETED' ? '✓ Hoàn thành' : srv.StepStatus === 'IN_PROGRESS' ? '▶ Đang thực hiện' : '○ Chờ thực hiện'}
                                </span>
                              )}
                            </div>
                          )}

                          <p>
                            {srv.Description ||
                              "Dịch vụ chăm sóc chuyên nghiệp tại salon."}
                          </p>

                          <div className="tech-apd-service-meta" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span>
                              ◷{" "}
                              {srv.DurationMinutes ||
                                detail.DurationMinutes ||
                                0}{" "}
                              phút
                            </span>
                            {!detail.CustomerPackageId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const curDur = srv.DurationMinutes || detail.DurationMinutes || 60;
                                  const val = window.prompt("Nhập thời lượng dịch vụ mới (tính theo phút):", curDur);
                                  if (!val) return;
                                  const num = Number(val);
                                  if (isNaN(num) || num <= 0) {
                                    alert("Thời lượng phải là số lớn hơn 0");
                                    return;
                                  }
                                  try {
                                    setActionLoading("update_duration");
                                    await axiosClient.patch(`/technician/appointments/${id}/duration`, { durationMinutes: num });
                                    alert("Đã cập nhật thời gian thực hiện dịch vụ thành công!");
                                    await load();
                                  } catch (err) {
                                    alert(err.response?.data?.message || "Không thể đổi thời gian dịch vụ");
                                  } finally {
                                    setActionLoading("");
                                  }
                                }}
                                style={{
                                  background: "#faf5ff",
                                  border: "1px solid #d8b4fe",
                                  borderRadius: "6px",
                                  padding: "3px 8px",
                                  fontSize: "0.75rem",
                                  fontWeight: "700",
                                  color: "#6b21a8",
                                  cursor: "pointer",
                                  transition: "all 0.2s"
                                }}
                                title="Thay đổi thời gian thực hiện dịch vụ ca hẹn này"
                              >
                                ✏️ Đổi thời gian
                              </button>
                            )}
                             {detail.CustomerPackageId ? (
                              <span style={{ color: "#059669", fontWeight: "700", fontSize: "0.82rem" }}>📦 Trọn gói Combo</span>
                            ) : (
                              <span>◉ {money(srv.Price)}</span>
                            )}

                          </div>

                          <div className="tech-apd-tags" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <span>{srv.CategoryName || "Dịch vụ"}</span>
                              {detail.CustomerPackageId ? (
                                <small style={{ background: "#fce7f3", color: "#831843", borderRadius: "6px", padding: "1px 6px", fontWeight: "700" }}>
                                  📦 Gói Combo
                                </small>
                              ) : (
                                <small>
                                  {index + 1}/{services.length}
                                </small>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const canAccess = ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase());
                                if (!canAccess) {
                                  alert("Chỉ được viết và xem phác đồ điều trị khi lịch hẹn ở trạng thái Đang thực hiện hoặc Hoàn thành.");
                                  return;
                                }
                                navigate(`/technician/treatment-notes?appointmentId=${detail.AppointmentId}&serviceId=${srv.ServiceId}`);
                              }}
                              style={{
                                backgroundColor: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "#2f593a" : "#cbd5e0",
                                color: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "#ffffff" : "#718096",
                                border: "none",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "0.78rem",
                                fontWeight: "600",
                                cursor: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "pointer" : "not-allowed",
                                outline: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              className={["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "hover-scale" : ""}
                              title={!["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "Chỉ khả dụng khi lịch hẹn Đang thực hiện hoặc Hoàn thành" : ""}
                            >
                              📝 Ghi chú &amp; Phác đồ
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}

                </div>

                <div className="tech-apd-card tech-apd-timeline-card">
                  <div className="tech-apd-card-title">Tiến trình lịch hẹn</div>

                  <div className="tech-apd-vertical-timeline">
                    {displaySteps.map((step, index) => (

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
                      onClick={() => {
                        const canAccess = ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase());
                        if (!canAccess) {
                          alert("Chỉ được viết và xem phác đồ điều trị khi lịch hẹn ở trạng thái Đang thực hiện hoặc Hoàn thành.");
                          return;
                        }
                        const firstSvcId = services[0]?.ServiceId;
                        navigate(`/technician/treatment-notes?appointmentId=${detail.AppointmentId}${firstSvcId ? `&serviceId=${firstSvcId}` : ""}`);
                      }}
                      style={{
                        backgroundColor: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "#2f593a" : "#cbd5e0",
                        color: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "#ffffff" : "#718096",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 18px",
                        fontWeight: "600",
                        cursor: ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s"
                      }}
                      className={["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "hover-scale" : ""}
                      title={!["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "Chỉ khả dụng khi lịch hẹn Đang thực hiện hoặc Hoàn thành" : ""}
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

                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    position: "relative",
                    padding: "16px 8px 8px 8px",
                    margin: "8px 0 16px 0"
                  }}>
                    {/* Progress track background line */}
                    <div style={{
                      position: "absolute",
                      top: "35px",
                      left: "35px",
                      right: "35px",
                      height: "4px",
                      background: "#e2e8f0",
                      borderRadius: "4px",
                      zIndex: 1
                    }} />
                    
                    {/* Active progress fill line */}
                    <div style={{
                      position: "absolute",
                      top: "35px",
                      left: "35px",
                      width: displaySteps.length > 1 
                        ? `calc(${(activeStepIndex / (displaySteps.length - 1)) * 100}% - ${activeStepIndex === displaySteps.length - 1 ? 0 : 20}px)`
                        : "0%",
                      maxWidth: "calc(100% - 70px)",
                      height: "4px",
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      borderRadius: "4px",
                      zIndex: 2,
                      transition: "width 0.4s ease"
                    }} />

                    {displaySteps.map((step, index) => {
                      const isPast = index < activeStepIndex;
                      const isCurrent = step.key === status;

                      return (
                        <div
                          key={step.key}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "relative",
                            zIndex: 3,
                            flex: 1
                          }}
                        >
                          {/* Step Circle / Icon */}
                          <div style={{
                            width: isCurrent ? "42px" : "34px",
                            height: isCurrent ? "42px" : "34px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "700",
                            fontSize: isCurrent ? "1.05rem" : "0.85rem",
                            transition: "all 0.3s ease",
                            background: isCurrent
                              ? "linear-gradient(135deg, #059669, #10b981)"
                              : isPast
                                ? "#dcfce7"
                                : "#f1f5f9",
                            color: isCurrent
                              ? "#ffffff"
                              : isPast
                                ? "#15803d"
                                : "#94a3b8",
                            border: isCurrent
                              ? "3px solid #a7f3d0"
                              : isPast
                                ? "2px solid #86efac"
                                : "2px solid #cbd5e1",
                            boxShadow: isCurrent
                              ? "0 0 14px rgba(16, 185, 129, 0.45)"
                              : "none"
                          }}>
                            {isPast ? "✓" : step.icon}
                          </div>

                          {/* Step Label */}
                          <span style={{
                            marginTop: "8px",
                            fontSize: isCurrent ? "0.82rem" : "0.76rem",
                            fontWeight: isCurrent ? "700" : isPast ? "600" : "500",
                            color: isCurrent ? "#047857" : isPast ? "#166534" : "#64748b",
                            textAlign: "center",
                            lineHeight: "1.25",
                            padding: "0 2px"
                          }}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>


                  <div className="tech-apd-update-box">
                    <h3>Cập nhật trạng thái</h3>
                    <p>Cập nhật trạng thái hiện tại của lịch hẹn này</p>

                    {detail.CustomerPackageId ? (() => {
                      const targetSvc = filteredServices[0] || services[0];
                      if (!targetSvc) return <div style={{ color: "#64748b" }}>Chưa chọn dịch vụ</div>;

                      const stepStat = String(targetSvc.StepStatus || targetSvc.Status || "PENDING").toUpperCase();
                      const targetSvcId = targetSvc.ServiceId;
                      const targetApptSvcId = targetSvc.AppointmentServiceId;

                      if (stepStat === "COMPLETED") {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "10px" }}>
                            <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                              ✓ Dịch vụ "{targetSvc.ServiceName}" đã hoàn thành!
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/technician/treatment-notes?appointmentId=${id}&serviceId=${targetSvcId}`);
                              }}
                              style={{
                                background: "#2f593a",
                                color: "#ffffff",
                                border: "none",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                fontWeight: "700",
                                fontSize: "0.88rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: "0 2px 8px rgba(47,89,58,0.25)",
                                width: "100%",
                                justifyContent: "center"
                              }}
                            >
                              📝 Viết & Xem Phác Đồ Trị Liệu →
                            </button>
                          </div>
                        );
                      }

                      if (stepStat === "IN_PROGRESS") {
                        return (
                          <button
                            className="tech-apd-action gold"
                            type="button"
                            disabled={!!actionLoading}
                            onClick={async () => {
                              const ok = window.confirm(`Xác nhận hoàn thành bước dịch vụ "${targetSvc.ServiceName}"?`);
                              if (!ok) return;
                              try {
                                setActionLoading("complete-step");
                                await axiosClient.patch(`/technician/appointments/${id}/complete-step`, { appointmentServiceId: targetApptSvcId });
                                alert(`✅ Đã hoàn thành dịch vụ "${targetSvc.ServiceName}"!`);
                                await load();

                              } catch (err) {
                                alert(err.response?.data?.message || "Không thể hoàn thành bước dịch vụ");
                              } finally {
                                setActionLoading("");
                              }
                            }}
                          >
                            ✓ {actionLoading === "complete-step" ? "Đang xử lý..." : `✅ Hoàn thành: ${targetSvc.ServiceName}`}
                          </button>
                        );
                      }

                      return (
                        (() => {
                          const apptStat = String(detail.Status || "").toUpperCase();
                          const isCheckedIn = ["CHECKED_IN", "IN_PROGRESS"].includes(apptStat);

                          if (!isCheckedIn) {
                            return (
                              <div style={{
                                background: "#fffbeb",
                                border: "1.5px solid #fde68a",
                                borderRadius: 10,
                                padding: "14px 16px",
                                fontSize: "0.85rem",
                                color: "#b45309",
                                fontWeight: "700",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px"
                              }}>
                                <span style={{ fontSize: "1.2rem" }}>🔒</span>
                                <span>Khách hàng chưa Check-in tại Salon. Vui lòng chờ Lễ tân Check-in lịch hẹn trước khi bắt đầu dịch vụ!</span>
                              </div>
                            );
                          }

                          const targetIdx = services.findIndex(s =>
                            (targetApptSvcId && s.AppointmentServiceId === targetApptSvcId) ||
                            (targetSvcId && s.ServiceId === targetSvcId)
                          );

                          if (targetIdx > 0) {
                            const prevSteps = services.slice(0, targetIdx);
                            const uncompletedPrev = prevSteps.filter(s => String(s.StepStatus || s.Status || "").toUpperCase() !== "COMPLETED");
                            if (uncompletedPrev.length > 0) {
                              return (
                                <div style={{
                                  background: "#eff6ff",
                                  border: "1.5px solid #bfdbfe",
                                  borderRadius: 10,
                                  padding: "14px 16px",
                                  fontSize: "0.85rem",
                                  color: "#1e40af",
                                  fontWeight: "700",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px"
                                }}>
                                  <span style={{ fontSize: "1.2rem" }}>⏳</span>
                                  <span>
                                    Vui lòng chờ dịch vụ trước (<strong>{uncompletedPrev[0].ServiceName}</strong>) hoàn thành trước khi bắt đầu dịch vụ "<strong>{targetSvc.ServiceName}</strong>"!
                                  </span>
                                </div>
                              );
                            }
                          }

                          return (
                            <button
                              className="tech-apd-action primary"
                              type="button"
                              disabled={!!actionLoading}
                              onClick={async () => {
                                const ok = window.confirm(`Bạn có chắc muốn BẮT ĐẦU thực hiện dịch vụ "${targetSvc.ServiceName}"?`);
                                if (!ok) return;
                                try {
                                  setActionLoading("start");
                                  await axiosClient.patch(`/technician/appointments/${id}/start`, { appointmentServiceId: targetApptSvcId, serviceId: targetSvcId });

                                  await load();
                                } catch (err) {
                                  alert(err.response?.data?.message || "Không thể bắt đầu dịch vụ");
                                } finally {
                                  setActionLoading("");
                                }
                              }}
                            >
                              ▶ {actionLoading === "start" ? "Đang xử lý..." : `Bắt đầu dịch vụ: ${targetSvc.ServiceName}`}
                            </button>
                          );
                        })()
                      );
                    })() : (

                      <>
                        {canStart && !canComplete && (
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
                            ▶ {actionLoading === "start" ? "Đang xử lý..." : "Bắt đầu dịch vụ"}
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
                      </>
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

                {/* Reschedule Request Card - chỉ hiện khi status = CONFIRMED hoặc đang có request */}
                {(status === "CONFIRMED" || (rescheduleRequest && ["PENDING", "AWAITING_CUSTOMER", "APPROVED", "REJECTED", "CUSTOMER_REJECTED"].includes(rescheduleRequest.Status))) && (
                  <div className="tech-apd-card" style={{ borderLeft: "4px solid #d4a94f" }}>
                    <div className="tech-apd-card-title" style={{ color: "#7a5e44", display: "flex", alignItems: "center", gap: "8px" }}>
                      📅 Đề xuất đổi lịch hẹn
                    </div>
                    <div style={{ marginTop: "12px", color: "#4a5568", fontSize: "0.9rem", lineHeight: "1.45" }}>
                      {status === "CONFIRMED" && (
                        <p style={{ margin: "0 0 16px 0" }}>
                          Nếu bạn bận đột xuất hoặc khách hàng yêu cầu dời giờ, bạn có thể tạo đề xuất giờ mới để gửi cho Lễ tân duyệt.
                        </p>
                      )}
                      
                      {rescheduleRequest ? (
                        rescheduleRequest.Status === "PENDING" ? (
                          <div style={{ background: "#fcf8e3", border: "1px solid #faebcc", color: "#8a6d3b", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                            <b style={{ display: "block", marginBottom: "4px" }}>Đang chờ duyệt đổi lịch:</b>
                            <div>Đề xuất: <b>{safeDate(rescheduleRequest.RequestedDate)}</b> lúc <b>{String(rescheduleRequest.RequestedStartTime).slice(0, 5)}</b></div>
                            <div style={{ fontSize: "0.75rem", color: "#8a6d3b", opacity: 0.8, marginTop: "6px", marginBottom: "10px" }}>
                              Lý do: {rescheduleRequest.Reason || "—"}
                            </div>
                            <button
                              type="button"
                              onClick={cancelReschedule}
                              disabled={actionLoading === "cancel_reschedule"}
                              style={{
                                backgroundColor: "#ffffff",
                                color: "#c53030",
                                border: "1px solid #e53e3e",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontWeight: "700",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                                width: "100%",
                              }}
                            >
                              {actionLoading === "cancel_reschedule" ? "Đang xử lý..." : "🚫 Hủy đề xuất đổi lịch"}
                            </button>
                          </div>
                        ) : rescheduleRequest.Status === "AWAITING_CUSTOMER" ? (
                          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                            <b style={{ display: "block", marginBottom: "4px" }}>⏳ Lễ tân đã duyệt – Chờ khách hàng xác nhận:</b>
                            <div>Đề xuất: <b>{safeDate(rescheduleRequest.RequestedDate)}</b> lúc <b>{String(rescheduleRequest.RequestedStartTime).slice(0, 5)} – {String(rescheduleRequest.RequestedEndTime).slice(0, 5)}</b></div>
                            <div style={{ fontSize: "0.75rem", marginTop: "6px", opacity: 0.8, marginBottom: "10px" }}>
                              Khách hàng sẽ nhận được thông báo và cần xác nhận trước khi lịch được thay đổi.
                            </div>
                            <button
                              type="button"
                              onClick={cancelReschedule}
                              disabled={actionLoading === "cancel_reschedule"}
                              style={{
                                backgroundColor: "#ffffff",
                                color: "#c53030",
                                border: "1px solid #e53e3e",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontWeight: "700",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                                width: "100%",
                              }}
                            >
                              {actionLoading === "cancel_reschedule" ? "Đang xử lý..." : "🚫 Hủy đề xuất đổi lịch"}
                            </button>
                          </div>
                        ) : rescheduleRequest.Status === "APPROVED" ? (
                          <div style={{ background: "#f0fff4", border: "1px solid #9ae6b4", color: "#276749", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                            <b style={{ display: "block", marginBottom: "6px" }}>✅ Đề xuất đổi lịch đã được duyệt!</b>
                            <div>Lịch hẹn đã được cập nhật sang:</div>
                            <div style={{ marginTop: "6px", fontWeight: "700", fontSize: "0.9rem" }}>
                              📅 {safeDate(rescheduleRequest.RequestedDate)} lúc {String(rescheduleRequest.RequestedStartTime).slice(0, 5)} – {String(rescheduleRequest.RequestedEndTime).slice(0, 5)}
                            </div>
                            {rescheduleRequest.Notes && (
                              <div style={{ marginTop: "8px", fontSize: "0.78rem", opacity: 0.8 }}>Ghi chú lễ tân: {rescheduleRequest.Notes}</div>
                            )}
                            {status === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => setShowRescheduleModal(true)}
                                style={{
                                  marginTop: "10px",
                                  backgroundColor: "#FAF6F0",
                                  color: "#7a5e44",
                                  border: "1px solid #d4a94f",
                                  borderRadius: "10px",
                                  padding: "8px 16px",
                                  fontWeight: "700",
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                  width: "100%",
                                }}
                              >
                                Đề xuất đổi lịch mới →
                              </button>
                            )}
                          </div>
                        ) : rescheduleRequest.Status === "SYSTEM_CANCELLED" ? (
                          <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                            <b style={{ display: "block", marginBottom: "4px" }}>⚠️ Đề xuất dời lịch đã bị hệ thống tự động hủy!</b>
                            <div>Lý do: {rescheduleRequest.Notes || "Khung giờ đề xuất đã có khách hàng khác đặt trước."}</div>
                            <div style={{ fontSize: "0.78rem", opacity: 0.85, marginTop: "6px" }}>
                              Đề xuất cũ: {safeDate(rescheduleRequest.RequestedDate)} lúc {String(rescheduleRequest.RequestedStartTime).slice(0, 5)}
                            </div>
                            {status === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => setShowRescheduleModal(true)}
                                style={{
                                  marginTop: "10px",
                                  backgroundColor: "#FAF6F0",
                                  color: "#7a5e44",
                                  border: "1px solid #d4a94f",
                                  borderRadius: "10px",
                                  padding: "8px 16px",
                                  fontWeight: "700",
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                  width: "100%",
                                }}
                              >
                                Đề xuất đổi lịch mới →
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", color: "#c53030", padding: "14px", borderRadius: "10px", fontSize: "0.85rem" }}>
                            <b style={{ display: "block", marginBottom: "4px" }}>❌ Đề xuất đổi lịch bị từ chối</b>
                            <div style={{ fontSize: "0.78rem", opacity: 0.85, marginTop: "4px" }}>
                              Đề xuất: {safeDate(rescheduleRequest.RequestedDate)} lúc {String(rescheduleRequest.RequestedStartTime).slice(0, 5)}
                            </div>
                            {rescheduleRequest.Notes && (
                              <div style={{ marginTop: "8px", fontSize: "0.78rem" }}>Lý do từ chối: {rescheduleRequest.Notes}</div>
                            )}
                            {status === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => setShowRescheduleModal(true)}
                                style={{
                                  marginTop: "10px",
                                  backgroundColor: "#FAF6F0",
                                  color: "#7a5e44",
                                  border: "1px solid #d4a94f",
                                  borderRadius: "10px",
                                  padding: "8px 16px",
                                  fontWeight: "700",
                                  fontSize: "0.82rem",
                                  cursor: "pointer",
                                  width: "100%",
                                }}
                              >
                                Đề xuất đổi lịch mới →
                              </button>
                            )}
                          </div>
                        )
                      ) : status === "CONFIRMED" ? (
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
                      ) : null}
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
                    <div>
                      {(() => {
                        const notesStr = detail.Notes;
                        if (!notesStr) return <p>Khách chưa nhập ghi chú cho lịch hẹn này.</p>;
                        const tags = notesStr.match(/\[(.*?)\]/g) || [];
                        const uniqueTags = [...new Set(tags)];
                        let cleanStr = notesStr;
                        tags.forEach(t => { cleanStr = cleanStr.split(t).join(""); });
                        cleanStr = cleanStr.trim();
                        return (
                          <div>
                            {uniqueTags.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                                {uniqueTags.map((tag, i) => (
                                  <span key={i} style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700" }}>
                                    {tag.replace(/^\[|\]$/g, "")}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p style={{ margin: 0 }}>{cleanStr || "Khách chưa nhập ghi chú thêm."}</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    Thông tin thanh toán
                  </div>

                  {detail.CustomerPackageId ? (
                    <>
                      <div className="tech-apd-payment-row">
                        <span>Trạng thái thanh toán</span>
                        <b style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "4px 12px", borderRadius: "12px", fontSize: "0.82rem", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          💳 Đã thanh toán thành công (Gói Combo)
                        </b>
                      </div>

                      <div className="tech-apd-payment-row">
                        <span>Chi phí ca hẹn</span>
                        <strong style={{ color: "#059669" }}>📦 Trọn gói Combo</strong>
                      </div>
                      <div className="tech-apd-payment-row">
                        <span>Phương thức thanh toán</span>
                        <strong>Thanh toán bằng Gói Combo</strong>
                      </div>
                      <div className="tech-apd-payment-row">
                        <span>Mã gói Combo</span>
                        <strong>Gói Combo #{detail.CustomerPackageId}</strong>
                      </div>
                      <div className="tech-apd-payment-row">
                        <span>Tên gói Combo</span>
                        <strong>{detail.PackageName || "Gói Combo đã đăng ký"}</strong>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
                      onClick={() => {
                        const canAccess = ["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase());
                        if (!canAccess) {
                          alert("Chỉ được viết và xem phác đồ điều trị khi lịch hẹn ở trạng thái Đang thực hiện hoặc Hoàn thành.");
                          return;
                        }
                        const firstSvcId = services[0]?.ServiceId;
                        navigate(`/technician/treatment-notes?appointmentId=${detail.AppointmentId}${firstSvcId ? `&serviceId=${firstSvcId}` : ""}`);
                      }}
                      style={!["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                      title={!["IN_PROGRESS", "COMPLETED"].includes(String(status).toUpperCase()) ? "Chỉ khả dụng khi lịch hẹn Đang thực hiện hoặc Hoàn thành" : ""}
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
