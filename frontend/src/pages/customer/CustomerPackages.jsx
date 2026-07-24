import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const STATUS_LABELS = {
  ACTIVE: { text: "Đang hoạt động", color: "#059669", bg: "#ecfdf5" },
  FROZEN: { text: "Đang tạm dừng", color: "#2563eb", bg: "#eff6ff" },
  EXPIRED: { text: "Đã hết hạn", color: "#dc2626", bg: "#fef2f2" },
  USED_UP: { text: "Đã hoàn thành", color: "#7c3aed", bg: "#f5f3ff" },
  COMPLETED: { text: "Đã hoàn thành", color: "#7c3aed", bg: "#f5f3ff" },
  PENDING_PAYMENT: { text: "Chờ thanh toán", color: "#d97706", bg: "#fffbeb" },
  CANCELLED: { text: "Đã hủy", color: "#4b5563", bg: "#f9fafb" },
};

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || {
    text: status,
    color: "#4b5563",
    bg: "#f3f4f6",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        color: info.color,
        backgroundColor: info.bg,
        border: `1px solid ${info.color}30`,
        letterSpacing: 0.3,
      }}
    >
      {info.text}
    </span>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  let str =
    dateValue instanceof Date
      ? dateValue.toISOString().slice(0, 10)
      : String(dateValue);
  if (str.includes("T")) {
    str = str.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }
  return str;
}

function formatDateTime(dateValue, timeValue) {
  const dateText = formatDate(dateValue);
  let timeText = "";
  if (timeValue) {
    if (
      timeValue instanceof Date ||
      (typeof timeValue === "object" &&
        typeof timeValue.getHours === "function")
    ) {
      const hours = String(timeValue.getHours()).padStart(2, "0");
      const minutes = String(timeValue.getMinutes()).padStart(2, "0");
      timeText = `${hours}:${minutes}`;
    } else if (typeof timeValue === "object") {
      const ms =
        timeValue.ms !== undefined ? timeValue.ms : timeValue.milliseconds;
      if (typeof ms === "number") {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        timeText = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    } else if (String(timeValue).includes("T")) {
      const parts = String(timeValue).split("T")[1];
      if (parts) timeText = parts.slice(0, 5);
    } else {
      const str = String(timeValue);
      const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
      const match = str.match(timeRegex);
      if (match) {
        timeText = `${match[1]}:${match[2]}`;
      } else {
        timeText = str.slice(0, 5);
      }
    }
  }
  return `${dateText}${timeText ? ` - ${timeText}` : ""}`;
}

function daysLeft(endDate) {
  if (!endDate) return null;
  const diff = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

/* ===== MODAL COMPONENT ===== */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="pkg-modal-overlay" onClick={onClose}>
      <div className="pkg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pkg-modal-header">
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "#831843",
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>
        <div className="pkg-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ===== PACKAGE DETAIL PANEL ===== */
function PackageDetailPanel({ pkg, onClose, onRefresh, onCancelCombo }) {
  const [detail, setDetail] = useState(null);
  const [usages, setUsages] = useState({ data: [], pagination: {} });
  const [usagePage, setUsagePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Combo Booking Modal states
  const [showBookModal, setShowBookModal] = useState(false);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: "09:00",
    notes: "",
  });
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState("");

  // Change Tech Modal states
  const [showTechModal, setShowTechModal] = useState(false);
  const [techList, setTechList] = useState([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [selectedTechStepId, setSelectedTechStepId] = useState(null);
  const [selectedNewTechId, setSelectedNewTechId] = useState("");
  const [techError, setTechError] = useState("");

  const openTechModalForPackageStep = async (appointmentId, stepId) => {
    setSelectedTechStepId(stepId);
    setSelectedNewTechId("");
    setShowTechModal(true);
    setLoadingTechs(true);
    setTechError("");

    try {
      const res = await axiosClient.get(
        `/appointments/${appointmentId}/available-technicians${stepId ? `?appointmentServiceId=${stepId}` : ""}`,
      );
      const data = res.data?.data || {};
      const list = data.availableTechnicians || [];
      setTechList(list);
      if (data.currentEmployeeId) {
        setSelectedNewTechId(String(data.currentEmployeeId));
      } else if (list.length > 0) {
        setSelectedNewTechId(String(list[0].EmployeeId));
      }
    } catch (err) {
      setTechError(
        err.response?.data?.message ||
          "Không lấy được danh sách KTV rảnh trong giờ",
      );
      setTechList([]);
    } finally {
      setLoadingTechs(false);
    }
  };

  const handleConfirmChangeTech = async (e) => {
    e.preventDefault();
    if (!selectedNewTechId) {
      setTechError("Vui lòng chọn Kỹ thuật viên mới");
      return;
    }
    setActionLoading(true);
    setTechError("");

    try {
      const apptId = d?.ActiveAppointment?.AppointmentId;
      if (!apptId) {
        setTechError("Không tìm thấy thông tin ca hẹn để đổi Kỹ thuật viên");
        return;
      }
      await axiosClient.patch(`/appointments/${apptId}/change-technician`, {
        newEmployeeId: Number(selectedNewTechId),
        appointmentServiceId: selectedTechStepId
          ? Number(selectedTechStepId)
          : null,
      });
      setMessage("✅ Đổi Kỹ thuật viên thành công!");
      setShowTechModal(false);
      onRefresh();
      loadDetail();
    } catch (err) {
      setTechError(err.response?.data?.message || "Lỗi khi đổi Kỹ thuật viên");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBookCombo = async () => {
    if (!bookingForm.appointmentDate || !bookingForm.startTime) {
      setBookingError("Vui lòng chọn ngày và giờ hẹn");
      return;
    }
    setActionLoading(true);
    setBookingError("");
    try {
      const endpoint = isRescheduleMode
        ? `/packages/my/${pkg.CustomerPackageId}/reschedule`
        : `/packages/my/${pkg.CustomerPackageId}/book`;

      const res = await axiosClient.post(endpoint, bookingForm);
      const data = res.data.data || res.data;
      setBookingSuccess(data);
      setMessage(
        isRescheduleMode
          ? "✅ Đổi lịch hẹn Combo thành công!"
          : "✅ Đặt lịch sử dụng Combo thành công!",
      );
      onRefresh();
      loadDetail();
    } catch (err) {
      setBookingError(
        err.response?.data?.message ||
          (isRescheduleMode
            ? "Lỗi đổi lịch hẹn Combo"
            : "Lỗi đặt lịch hẹn Combo"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const loadDetail = async () => {
    setLoading(true);
    try {
      const [detailRes, usageRes] = await Promise.all([
        axiosClient.get(`/packages/my/${pkg.CustomerPackageId}/detail`),
        axiosClient.get(
          `/packages/my/${pkg.CustomerPackageId}/usages-paginated?page=${usagePage}&limit=5`,
        ),
      ]);
      setDetail(detailRes.data.data || detailRes.data);
      setUsages(usageRes.data.data || usageRes.data);
    } catch {
      setMessage("Không tải được chi tiết liệu trình");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [pkg?.CustomerPackageId, pkg?._refresh, usagePage]);

  const d = detail || pkg;
  const total = Number(d.TotalSessions || 0) || 1;
  const left = Number(d.RemainingSessions || 0);
  const used = Number(d.UsedSessions || 0);
  const percent = Math.max(0, Math.min(100, (used / total) * 100));
  const services = d.Services || [];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#be185d" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🌸</div>
        <p style={{ fontWeight: 700 }}>Đang tải chi tiết liệu trình...</p>
      </div>
    );
  }

  return (
    <div
      className="pkg-detail-panel"
      style={{
        background: "#fff",
        borderRadius: 24,
        padding: 28,
        border: "1.5px solid #fbcfe8",
        boxShadow: "0 10px 30px rgba(236,72,153,0.08)",
      }}
    >
      {/* PANEL HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px dashed #fbcfe8",
        }}
      >
        <div>
          <span
            style={{
              background: "#ec4899",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            CHI TIẾT LIỆU TRÌNH COMBO
          </span>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#831843",
              margin: "6px 0 4px 0",
            }}
          >
            {d.PackageName}
          </h2>
          {d.CategoryName && (
            <span style={{ fontSize: 12, color: "#be185d", fontWeight: 600 }}>
              📂 {d.CategoryName}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#fdf2f8",
            border: "1px solid #fbcfe8",
            color: "#db2777",
            fontWeight: 700,
            borderRadius: 12,
            padding: "8px 16px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ← Quay lại danh sách
        </button>
      </div>

      {message && (
        <div
          className={message.includes("✅") ? "alert success" : "alert error"}
          style={{ margin: "12px 0", borderRadius: 12 }}
        >
          {message}
          <button
            onClick={() => setMessage("")}
            style={{
              float: "right",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* THÔNG TIN TỔNG QUAN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Trạng thái", value: <StatusBadge status={d.Status} /> },
          {
            label: "Ngày bắt đầu",
            value: formatDate(d.StartDate || d.PaidAt || d.CreatedAt),
          },

          {
            label: "Hạn sử dụng",
            value: d.EndDate ? formatDate(d.EndDate) : "Chưa xác định",
          },
          {
            label: "Giá mua",
            value:
              d.Amount ||
              d.PurchasePrice ||
              d.SalePrice ||
              d.OriginalPrice ||
              d.Price
                ? `${Number(d.Amount || d.PurchasePrice || d.SalePrice || d.OriginalPrice || d.Price).toLocaleString("vi-VN")}đ`
                : "—",
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              background: "#fdf2f8",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #fbcfe8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#be185d",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: item.highlight ? "#059669" : "#1e293b",
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* DANH SÁCH DỊCH VỤ TRONG COMBO */}
      {services.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#831843",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ✂️ Các Dịch Vụ Trong Combo ({services.length} dịch vụ)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
              gap: 12,
            }}
          >
            {services.map((svc, idx) => {
              return (
                <div
                  key={svc.ServiceId || idx}
                  style={{
                    background: "#fff",
                    border: "1.5px solid #fbcfe8",
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {svc.ImageUrl ? (
                      <img
                        src={resolveFileUrl(svc.ImageUrl)}
                        alt={svc.ServiceName}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1.5px solid #fbcfe8",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, #fce7f3, #fbcfe8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                        }}
                      >
                        ✨
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <b
                        style={{
                          fontSize: 13,
                          color: "#831843",
                          display: "block",
                        }}
                      >
                        Bước {idx + 1}. {svc.ServiceName}
                      </b>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        ⏱ {svc.DurationMinutes || 30} phút
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE APPOINTMENT & RESCHEDULE BAR */}
      {d.ActiveAppointment &&
        (() => {
          const apptStat = String(
            d.ActiveAppointment.Status || "",
          ).toUpperCase();
          const isLive = ["CHECKED_IN", "IN_PROGRESS"].includes(apptStat);
          const isInProgress = apptStat === "IN_PROGRESS";
          const isCheckedIn = apptStat === "CHECKED_IN";

          return (
            <div
              style={{
                background: isInProgress
                  ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                  : isCheckedIn
                    ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
                    : "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                border: isInProgress
                  ? "2px solid #86efac"
                  : isCheckedIn
                    ? "2px solid #93c5fd"
                    : "1.5px solid #fbcfe8",
                borderRadius: 16,
                padding: 20,
                marginBottom: 24,
                boxShadow: isInProgress
                  ? "0 8px 24px rgba(16, 185, 129, 0.15)"
                  : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      background: isInProgress
                        ? "#059669"
                        : isCheckedIn
                          ? "#2563eb"
                          : "#db2777",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 12,
                      letterSpacing: 0.5,
                    }}
                  >
                    {isInProgress
                      ? "▶ ĐANG THỰC HIỆN LIỆU TRÌNH TẠI SALON"
                      : isCheckedIn
                        ? "◇ ĐÃ CHECK-IN TẠI SALON"
                        : "📅 ĐÃ CÓ LỊCH HẸN COMBO SẮP TỚI"}
                  </span>
                  <h4
                    style={{
                      margin: "8px 0 4px 0",
                      fontSize: 16,
                      fontWeight: 800,
                      color: isInProgress
                        ? "#065f46"
                        : isCheckedIn
                          ? "#1e3a8a"
                          : "#831843",
                    }}
                  >
                    Khung giờ: {d.ActiveAppointment.StartTime?.slice(0, 5)} -{" "}
                    {d.ActiveAppointment.EndTime?.slice(0, 5)} ngày{" "}
                    {formatDate(d.ActiveAppointment.AppointmentDate)}
                  </h4>
                  <span
                    style={{
                      fontSize: 13,
                      color: isInProgress
                        ? "#047857"
                        : isCheckedIn
                          ? "#1d4ed8"
                          : "#9d174d",
                      fontWeight: "600",
                    }}
                  >
                    Trạng thái ca:{" "}
                    <b>
                      {isInProgress
                        ? "▶ Đang thực hiện"
                        : isCheckedIn
                          ? "◇ Đã check-in"
                          : "✓ Đã xác nhận"}
                    </b>{" "}
                    • Trưởng nhóm KTV:{" "}
                    <b>
                      {d.ActiveAppointment.PrimaryTechName ||
                        "Tự động phân công"}
                    </b>
                  </span>

                  {/* STEP-BY-STEP SERVICE & TECHNICIAN BREAKDOWN */}
                  {d.ActiveAppointment.Services &&
                    d.ActiveAppointment.Services.length > 0 && (
                      <div
                        style={{
                          marginTop: 14,
                          borderTop: isInProgress
                            ? "1px dashed #a7f3d0"
                            : "1px dashed #bfdbfe",
                          paddingTop: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: isInProgress ? "#065f46" : "#1e40af",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 10,
                          }}
                        >
                          ✂️ TIẾN TRÌNH THỰC HIỆN TỪNG DỊCH VỤ TRONG COMBO:
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(260px, 1fr))",
                            gap: 10,
                          }}
                        >
                          {d.ActiveAppointment.Services.map((svcStep, idx) => {
                            const stepStat = String(
                              svcStep.StepStatus || "PENDING",
                            ).toUpperCase();
                            const isStepDone = stepStat === "COMPLETED";
                            const isStepDoing = stepStat === "IN_PROGRESS";

                            return (
                              <div
                                key={svcStep.AppointmentServiceId || idx}
                                style={{
                                  background: "#ffffff",
                                  padding: "10px 14px",
                                  borderRadius: 12,
                                  border: isStepDoing
                                    ? "2px solid #f59e0b"
                                    : isStepDone
                                      ? "1.5px solid #86efac"
                                      : "1px solid #e2e8f0",
                                  boxShadow: isStepDoing
                                    ? "0 2px 10px rgba(245, 158, 11, 0.2)"
                                    : "none",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 6,
                                  }}
                                >
                                  <b style={{ color: "#1e293b", fontSize: 13 }}>
                                    {idx + 1}. {svcStep.ServiceName}
                                  </b>
                                  <span
                                    style={{
                                      background: isStepDone
                                        ? "#dcfce7"
                                        : isStepDoing
                                          ? "#fef3c7"
                                          : "#f1f5f9",
                                      color: isStepDone
                                        ? "#15803d"
                                        : isStepDoing
                                          ? "#b45309"
                                          : "#64748b",
                                      fontSize: 10,
                                      fontWeight: 800,
                                      padding: "2px 8px",
                                      borderRadius: 10,
                                    }}
                                  >
                                    {isStepDone
                                      ? "✓ Hoàn thành"
                                      : isStepDoing
                                        ? "▶ Đang làm"
                                        : "○ Chờ làm"}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: 4,
                                  }}
                                >
                                  <span
                                    style={{ fontSize: 11, color: "#64748b" }}
                                  >
                                    ⏱ {svcStep.DurationMinutes || 30} phút
                                  </span>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      cursor: isLive ? "default" : "pointer",
                                      background: "#f8fafc",
                                      padding: "3px 8px",
                                      borderRadius: 20,
                                      border: "1px solid #cbd5e1",
                                    }}
                                    onClick={() =>
                                      !isLive &&
                                      openTechModalForPackageStep(
                                        d.ActiveAppointment.AppointmentId,
                                        svcStep.AppointmentServiceId,
                                      )
                                    }
                                    title={
                                      isLive
                                        ? "Không thể đổi KTV khi ca hẹn đã check-in/đang làm"
                                        : "Nhấn vào để đổi KTV mới"
                                    }
                                  >
                                    <img
                                      src={
                                        resolveFileUrl(
                                          svcStep.TechnicianAvatar,
                                        ) ||
                                        "/images/avatars/default-avatar.png"
                                      }
                                      alt={svcStep.TechnicianName}
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "1.5px solid #2563eb",
                                      }}
                                    />
                                    <b
                                      style={{ fontSize: 11, color: "#334155" }}
                                    >
                                      {svcStep.TechnicianName || "KTV Rảnh"}{" "}
                                      {!isLive && "✎"}
                                    </b>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {isLive ? (
                <div
                  style={{
                    background: isInProgress ? "#ecfdf5" : "#fffbeb",
                    border: isInProgress
                      ? "1.5px solid #a7f3d0"
                      : "1.5px solid #fde68a",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: isInProgress ? "#047857" : "#b45309",
                    fontWeight: 700,
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{isInProgress ? "💆‍♀️" : "🔒"}</span>
                  <span>
                    {isInProgress
                      ? "Dịch vụ trong combo của Quý khách đang được thực hiện tại salon! Quý khách có thể theo dõi tiến trình thực hiện từng bước ở trên."
                      : "Quý khách đã Check-in tại salon. Dịch vụ sắp sửa được thực hiện nên không thể đổi lịch hoặc hủy lịch hẹn này."}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 14,
                  }}
                >
                  <button
                    style={{
                      background:
                        "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 12,
                      padding: "10px 18px",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => {
                      setIsRescheduleMode(true);
                      const cleanNotes = String(d.ActiveAppointment.Notes || "")
                        .replace(
                          /\[(?:Gói Combo|Đổi lịch Combo|Tái khám từ lịch #[0-9]+):\s*[^\]]+\]/gi,
                          "",
                        )
                        .trim();
                      setBookingForm({
                        appointmentDate:
                          d.ActiveAppointment.AppointmentDate ||
                          new Date().toISOString().slice(0, 10),
                        startTime:
                          d.ActiveAppointment.StartTime?.slice(0, 5) || "09:00",
                        notes: cleanNotes,
                      });
                      setShowBookModal(true);
                      setBookingSuccess(null);
                      setBookingError("");
                    }}
                  >
                    🔄 Đổi Lịch Hẹn Combo Ngay
                  </button>

                  <button
                    style={{
                      background: "#fff1f2",
                      color: "#e11d48",
                      border: "1.5px solid #fecdd3",
                      borderRadius: 12,
                      padding: "10px 18px",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => {
                      if (onCancelCombo) {
                        onCancelCombo(
                          d.CustomerPackageId || pkg.CustomerPackageId,
                          d.ActiveAppointment?.AppointmentId,
                        );
                      }
                    }}
                  >
                    ❌ Hủy Lịch Hẹn Combo
                  </button>
                </div>
              )}
            </div>
          );
        })()}

      {/* BOOK BUTTON BANNER IF NO ACTIVE APPOINTMENT & HAS SESSIONS */}
      {!d.ActiveAppointment && d.Status === "ACTIVE" && left > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
            border: "1.5px solid #fbcfe8",
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h4
              style={{
                margin: "0 0 2px 0",
                fontSize: 15,
                fontWeight: 800,
                color: "#831843",
              }}
            >
              Gói của bạn còn {left} lượt sử dụng
            </h4>
            <span style={{ fontSize: 12, color: "#be185d" }}>
              Bấm Đặt lịch ngay để hệ thống phân công KTV rảnh nhất phục vụ bạn!
            </span>
          </div>

          <button
            style={{
              background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 20px",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(236,72,153,0.3)",
            }}
            onClick={() => {
              setIsRescheduleMode(false);
              setShowBookModal(true);
              setBookingSuccess(null);
              setBookingError("");
            }}
          >
            ✨ 📅 Đặt Lịch Hẹn Combo
          </button>
        </div>
      )}

      {/* LỊCH SỬ SỬ DỤNG */}
      {usages.data && usages.data.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#831843",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📋 Lịch Sử Sử Dụng ({usages.pagination?.total || usages.data.length}{" "}
            buổi)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {usages.data.map((u, idx) => (
              <div
                key={u.UsageId || idx}
                style={{
                  background: "#f8fafc",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <b
                    style={{ fontSize: 13, color: "#1e293b", display: "block" }}
                  >
                    {formatDateTime(
                      u.UsedDate || u.AppointmentDate || u.UsedAt,
                      u.StartTime,
                    )}
                  </b>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {u.ServiceName || "Dịch vụ combo"} · KTV:{" "}
                    {u.EmployeeName || u.TechnicianName || "KTV Salon"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}
                  >
                    ×{u.SessionsUsed || 1} buổi
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: u.Status === "COMPLETED" ? "#059669" : "#94a3b8",
                      background:
                        u.Status === "COMPLETED" ? "#f0fdf4" : "#f8fafc",
                      padding: "2px 8px",
                      borderRadius: 8,
                      border: `1px solid ${u.Status === "COMPLETED" ? "#86efac" : "#e2e8f0"}`,
                    }}
                  >
                    {u.Status === "COMPLETED"
                      ? "✓ Hoàn thành"
                      : u.Status || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {usages.pagination && usages.pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                disabled={usagePage <= 1}
                onClick={() => setUsagePage((p) => p - 1)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: usagePage <= 1 ? "not-allowed" : "pointer",
                  opacity: usagePage <= 1 ? 0.5 : 1,
                }}
              >
                ← Trước
              </button>
              <span
                style={{ padding: "6px 14px", fontSize: 12, color: "#64748b" }}
              >
                Trang {usagePage}/{usages.pagination.totalPages}
              </span>
              <button
                disabled={usagePage >= usages.pagination.totalPages}
                onClick={() => setUsagePage((p) => p + 1)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor:
                    usagePage >= usages.pagination.totalPages
                      ? "not-allowed"
                      : "pointer",
                  opacity: usagePage >= usages.pagination.totalPages ? 0.5 : 1,
                }}
              >
                Sau →
              </button>
            </div>
          )}
        </div>
      )}

      {/* BOOKING MODAL */}
      <Modal
        open={showBookModal}
        onClose={() => setShowBookModal(false)}
        title={
          isRescheduleMode
            ? "🔄 Đổi Lịch Hẹn Combo"
            : "✨ Đặt Lịch Hẹn Sử Dụng Combo"
        }
      >
        {bookingSuccess ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
            <h3 style={{ color: "#db2777", margin: "0 0 6px 0", fontSize: 20 }}>
              {isRescheduleMode
                ? "ĐỔI LỊCH THÀNH CÔNG!"
                : "ĐẶT LỊCH THÀNH CÔNG!"}
            </h3>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#dcfce7",
                color: "#15803d",
                border: "1px solid #bbf7d0",
                padding: "6px 16px",
                borderRadius: "20px",
                fontWeight: "700",
                fontSize: "0.85rem",
                margin: "4px 0 12px 0",
              }}
            >
              💳 Đã thanh toán thành công (Gói Combo)
            </div>
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 16px 0" }}>
              Hệ thống đã cập nhật lịch hẹn và tự động gán KTV rảnh cho từng
              dịch vụ trong Combo của bạn!
            </p>

            <div
              style={{
                background: "#fdf2f8",
                border: "1px solid #fbcfe8",
                padding: 14,
                borderRadius: 12,
                textAlign: "left",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <small
                    style={{ color: "#be185d", fontWeight: 700, fontSize: 11 }}
                  >
                    NGÀY HẸN
                  </small>
                  <div
                    style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}
                  >
                    {formatDate(bookingSuccess.appointmentDate)}
                  </div>
                </div>
                <div>
                  <small
                    style={{ color: "#be185d", fontWeight: 700, fontSize: 11 }}
                  >
                    KHUNG GIỜ
                  </small>
                  <div
                    style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}
                  >
                    {bookingSuccess.startTime?.slice(0, 5)} -{" "}
                    {bookingSuccess.endTime?.slice(0, 5)} (
                    {bookingSuccess.totalDurationMinutes}p)
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px dashed #f472b6",
                  paddingTop: 10,
                  marginTop: 10,
                }}
              >
                <small
                  style={{ color: "#be185d", fontWeight: 700, fontSize: 11 }}
                >
                  DANH SÁCH DỊCH VỤ & KTV ĐƯỢC PHÂN CÔNG TƯƠNG ỨNG
                </small>
                {bookingSuccess.serviceAssignments &&
                  bookingSuccess.serviceAssignments.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {bookingSuccess.serviceAssignments.map((step, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "#ffffff",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #fbcfe8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <b
                              style={{
                                color: "#831843",
                                fontSize: 12,
                                display: "block",
                              }}
                            >
                              {idx + 1}. {step.serviceName}
                            </b>
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              ⏱ {step.startTime?.slice(0, 5)} -{" "}
                              {step.endTime?.slice(0, 5)} (
                              {step.durationMinutes}p)
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <img
                              src={
                                resolveFileUrl(step.technician?.avatarUrl) ||
                                "/images/avatars/default-avatar.png"
                              }
                              alt={step.technician?.fullName}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "1px solid #ec4899",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#be185d",
                              }}
                            >
                              {step.technician?.fullName}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <button
              className="btn primary"
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                borderColor: "#db2777",
                fontWeight: 700,
                padding: 12,
              }}
              onClick={() => {
                setShowBookModal(false);
                setBookingSuccess(null);
              }}
            >
              Hoàn tất & Đóng
            </button>
          </div>
        ) : (
          <div className="pkg-form">
            <div
              style={{
                background: "#fdf2f8",
                border: "1px solid #fbcfe8",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
              }}
            >
              <b
                style={{
                  color: "#be185d",
                  fontSize: 13,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                📦 Gói Combo: {d.PackageName}
              </b>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                Gồm có:{" "}
                <strong>
                  {d.ServiceNames || "Các dịch vụ spa chuyên sâu"}
                </strong>
              </p>
            </div>

            {bookingError && (
              <div className="alert error" style={{ marginBottom: 12 }}>
                {bookingError}
              </div>
            )}

            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                📅 Chọn Ngày Hẹn:
              </span>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={bookingForm.appointmentDate}
                onChange={(e) =>
                  setBookingForm((f) => ({
                    ...f,
                    appointmentDate: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: 8,
                  marginTop: 4,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                ⏰ Chọn Giờ Bắt Đầu:
              </span>
              <select
                value={bookingForm.startTime}
                onChange={(e) =>
                  setBookingForm((f) => ({ ...f, startTime: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: 8,
                  marginTop: 4,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="08:30">08:30 sáng</option>
                <option value="09:00">09:00 sáng</option>
                <option value="09:30">09:30 sáng</option>
                <option value="10:00">10:00 sáng</option>
                <option value="10:30">10:30 sáng</option>
                <option value="11:00">11:00 sáng</option>
                <option value="13:30">13:30 chiều</option>
                <option value="14:00">14:00 chiều</option>
                <option value="14:30">14:30 chiều</option>
                <option value="15:00">15:00 chiều</option>
                <option value="15:30">15:30 chiều</option>
                <option value="16:00">16:00 chiều</option>
                <option value="16:30">16:30 chiều</option>
                <option value="17:00">17:00 chiều</option>
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                📝 Ghi chú dặn dò (Không bắt buộc):
              </span>
              <textarea
                value={bookingForm.notes || ""}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, notes: e.target.value })
                }
                placeholder="Ví dụ: Da nhạy cảm, yêu cầu chỗ đỗ xe, có tiền sử dị ứng..."
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 4,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </label>

            <div
              style={{
                background: "#f8fafc",
                padding: 10,
                borderRadius: 8,
                fontSize: 12,
                color: "#64748b",
                marginBottom: 16,
              }}
            >
              ℹ️ Gói Combo áp dụng 1 lần duy nhất trong suốt thời hạn. Toàn bộ
              các dịch vụ trong Combo sẽ được thực hiện liên tiếp trong cùng 1
              ca.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowBookModal(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleBookCombo}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {actionLoading
                  ? "Đang xử lý..."
                  : isRescheduleMode
                    ? "Xác Nhận Đổi Lịch"
                    : "Xác Nhận Đặt Lịch"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CHANGE TECHNICIAN MODAL */}
      <Modal
        open={showTechModal}
        onClose={() => setShowTechModal(false)}
        title="👤 Chọn Kỹ Thuật Viên Rảnh Trong Giờ"
      >
        <form onSubmit={handleConfirmChangeTech}>
          {techError && (
            <div className="alert error" style={{ marginBottom: 12 }}>
              {techError}
            </div>
          )}

          {loadingTechs ? (
            <div
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "#64748b",
              }}
            >
              ⏳ Đang tải danh sách Kỹ thuật viên rảnh...
            </div>
          ) : techList.length === 0 ? (
            <div className="alert error" style={{ marginBottom: 12 }}>
              Không có Kỹ thuật viên rảnh phù hợp cho khung giờ này. Vui lòng
              liên hệ Lễ tân để hỗ trợ.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 320,
                overflowY: "auto",
                margin: "12px 0",
              }}
            >
              {techList.map((t) => (
                <label
                  key={t.EmployeeId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border:
                      String(selectedNewTechId) === String(t.EmployeeId)
                        ? "2px solid #ec4899"
                        : "1px solid #cbd5e1",
                    background:
                      String(selectedNewTechId) === String(t.EmployeeId)
                        ? "#fdf2f8"
                        : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="newTech"
                    value={t.EmployeeId}
                    checked={String(selectedNewTechId) === String(t.EmployeeId)}
                    onChange={(e) => setSelectedNewTechId(e.target.value)}
                  />
                  <img
                    src={
                      resolveFileUrl(t.AvatarUrl || t.ImageUrl) ||
                      "/images/avatars/default-avatar.png"
                    }
                    alt={t.FullName}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <b
                      style={{
                        fontSize: 13,
                        color: "#1e293b",
                        display: "block",
                      }}
                    >
                      {t.FullName}{" "}
                      {t.IsCurrent ? (
                        <span style={{ color: "#ec4899", fontSize: 11 }}>
                          (Hiện tại)
                        </span>
                      ) : (
                        ""
                      )}
                    </b>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {t.Specialization || t.Position || "Chuyên gia làm đẹp"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowTechModal(false)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={actionLoading || techList.length === 0}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {actionLoading ? "Đang xử lý..." : "Xác Nhận Đổi KTV"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ===== MAIN CUSTOMER PACKAGES PAGE ===== */
export default function CustomerPackages() {
  const navigate = useNavigate();
  const location = useLocation();

  const [customerActiveTab, setCustomerActiveTab] = useState("packages"); // 'packages' | 'history' | 'reviews'

  const [packages, setPackages] = useState([]);
  const [mine, setMine] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);

  // Dedicated History & Review States
  const [comboHistory, setComboHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reviewModalAppt, setReviewModalAppt] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    overallRating: 5,
    overallComment: "",
    stepRatings: {}, // { serviceId: { rating, comment, employeeId } }
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Custom Cancel Combo Modal state
  const [cancelModalPkgId, setCancelModalPkgId] = useState(null);
  const [cancelModalApptId, setCancelModalApptId] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState(
    "Thay đổi kế hoạch cá nhân",
  );
  const [cancellingCombo, setCancellingCombo] = useState(false);

  const triggerCancelCombo = (customerPackageId, appointmentId = null) => {
    setCancelModalPkgId(customerPackageId);
    setCancelModalApptId(appointmentId);
    setCancelReasonInput("Thay đổi kế hoạch cá nhân");
  };

  const confirmCancelCombo = async () => {
    if (!cancelModalPkgId) return;
    setCancellingCombo(true);
    try {
      const res = await axiosClient.post(
        `/packages/my/${cancelModalPkgId}/cancel-appointment`,
        {
          reason: cancelReasonInput,
          appointmentId: cancelModalApptId,
        },
      );
      const successMsg =
        res.data?.message ||
        res.data?.data?.message ||
        "Đã hủy lịch hẹn Combo thành công!";
      alert("🎉 " + successMsg);
      setMessage("✅ " + successMsg);
      setCancelModalPkgId(null);
      setCancelModalApptId(null);
      await Promise.all([load(), loadComboHistory()]);
      if (selectedPkg) {
        setSelectedPkg((prev) =>
          prev ? { ...prev, _refresh: Date.now() } : null,
        );
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Không thể hủy lịch hẹn Combo. Vui lòng thử lại!",
      );
    } finally {
      setCancellingCombo(false);
    }
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(
      ([key, value]) => value && params.append(key, value),
    );
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    const [allRes, myRes, catRes] = await Promise.all([
      axiosClient.get(`/packages?${queryString}`),
      axiosClient.get("/packages/my"),
      axiosClient.get("/packages/categories/list"),
    ]);
    setPackages(allRes.data.data || allRes.data || []);
    setMine(myRes.data.data || myRes.data || []);
    setCategories(catRes.data.data || catRes.data || []);
    setLoading(false);
  };

  const loadComboHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axiosClient.get("/packages/my/combo-history");
      setComboHistory(res.data.data || res.data || []);
    } catch (_) {
      setComboHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    load();
    loadComboHistory();
  }, [queryString]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetPkgId =
      params.get("packageId") || params.get("customerPackageId");
    const isPaid =
      params.get("paid") === "1" || params.get("status") === "success";

    if (isPaid) {
      setShowPaymentSuccessModal(true);
      // Clean up query parameters so back button or refresh won't keep showing modal repeatedly
      params.delete("paid");
      params.delete("status");
      const remainingSearch = params.toString();
      const cleanUrl = `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}`;
      window.history.replaceState(null, "", cleanUrl);
    }

    const tabParam = params.get("tab");
    if (tabParam === "reviews") {
      navigate("/customer/reviews?type=combo");
      return;
    }
    if (tabParam && ["packages", "history"].includes(tabParam)) {
      setCustomerActiveTab(tabParam);
    }

    if (targetPkgId) {
      setCustomerActiveTab("packages");
      axiosClient
        .get(`/packages/my/${targetPkgId}/detail`)
        .then((res) => {
          const detailData = res.data?.data || res.data;
          if (detailData) {
            setSelectedPkg(detailData);
          }
        })
        .catch(() => {
          axiosClient.get("/packages/my").then((r) => {
            const list = r.data?.data || r.data || [];
            const found = list.find(
              (p) => String(p.CustomerPackageId) === String(targetPkgId),
            );
            if (found) setSelectedPkg(found);
          });
        });
    }
  }, [location.search]);

  const repayVnpay = async (e, customerPackageId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      setMessage("");
      const res = await axiosClient.post(
        `/packages/my/${customerPackageId}/repay`,
      );
      const data = res.data.data || res.data;
      if (data && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setMessage("❌ Không tạo được link thanh toán VNPay");
      }
    } catch (err) {
      setMessage(
        "❌ " +
          (err.response?.data?.message || "Lỗi tạo link thanh toán VNPay"),
      );
    }
  };

  const repayPayos = async (e, customerPackageId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      setMessage("");
      const res = await axiosClient.post(
        `/packages/my/${customerPackageId}/repay-payos`,
      );
      const data = res.data.data || res.data;
      if (data && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setMessage("❌ Không tạo được link thanh toán PayOS");
      }
    } catch (err) {
      setMessage(
        "❌ " +
          (err.response?.data?.message || "Lỗi tạo link thanh toán PayOS"),
      );
    }
  };

  const buyVnpay = async (packageId) => {
    const confirmPayment = window.confirm(
      "⚠️ LƯU Ý QUAN TRỌNG:\nGói combo / liệu trình sau khi đã thanh toán thành công sẽ KHÔNG ĐƯỢC HỦY HOẶC HOÀN TIỀN dưới bất kỳ hình thức nào.\n\nBạn có chắc chắn muốn mua gói này?",
    );
    if (!confirmPayment) return;

    try {
      setMessage("");
      const res = await axiosClient.post(`/packages/${packageId}/vnpay`);
      const data = res.data.data || res.data;
      if (data && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setMessage("❌ Không tạo được link thanh toán VNPay");
      }
    } catch (err) {
      setMessage(
        "❌ " +
          (err.response?.data?.message || "Lỗi tạo link thanh toán VNPay"),
      );
    }
  };

  const buyPayos = async (packageId) => {
    const confirmPayment = window.confirm(
      "⚠️ LƯU Ý QUAN TRỌNG:\nGói combo / liệu trình sau khi đã thanh toán thành công sẽ KHÔNG ĐƯỢC HỦY HOẶC HOÀN TIỀN dưới bất kỳ hình thức nào.\n\nBạn có chắc chắn muốn mua gói này?",
    );
    if (!confirmPayment) return;

    try {
      setMessage("");
      const res = await axiosClient.post(`/packages/${packageId}/payos`);
      const data = res.data.data || res.data;
      if (data && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setMessage("❌ Không tạo được link thanh toán PayOS");
      }
    } catch (err) {
      setMessage(
        "❌ " +
          (err.response?.data?.message || "Lỗi tạo link thanh toán PayOS"),
      );
    }
  };

  const openReviewModal = (appt) => {
    if (appt && appt.AppointmentId) {
      navigate(
        `/customer/reviews?type=combo&appointmentId=${appt.AppointmentId}`,
      );
    } else {
      navigate("/customer/reviews?type=combo");
    }
  };

  const handleCancelComboAppointment = async (customerPackageId) => {
    if (!customerPackageId) return;
    const reason = window.prompt(
      "⚠️ Vui lòng nhập lý do hủy lịch hẹn Combo này:\n(Hủy lịch sẽ giữ nguyên số lượt sử dụng gói cho bạn đặt lại sau)",
      "Thay đổi kế hoạch cá nhân",
    );
    if (reason === null) return;

    try {
      setLoading(true);
      const res = await axiosClient.post(
        `/packages/my/${customerPackageId}/cancel-appointment`,
        { reason },
      );
      alert(res.data?.message || "Đã hủy lịch hẹn Combo thành công!");
      fetchData();
      loadComboHistory();
      if (selectedPkg) {
        loadDetail(selectedPkg.CustomerPackageId);
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Không thể hủy lịch hẹn Combo. Vui lòng thử lại!",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerLayout activeTab="packages">
      <section
        className="pkg-container"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 20px 60px 20px",
        }}
      >
        {/* HEADER HERO BANNER */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #fff0f6 0%, #fce7f3 50%, #fbcfe8 100%)",
            borderRadius: 24,
            padding: "32px 36px",
            marginBottom: 24,
            border: "1.5px solid #fbcfe8",
            boxShadow: "0 10px 30px rgba(236, 72, 153, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <span
              style={{
                background: "#db2777",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: 20,
                letterSpacing: 0.5,
              }}
            >
              COMBO TRỌN GÓI SPA 1 LƯỢT
            </span>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#831843",
                margin: "10px 0 6px 0",
              }}
            >
              Quản Lý Combo & Liệu Trình Làm Đẹp
            </h1>
            <p
              style={{
                margin: 0,
                color: "#475569",
                fontSize: 14,
                maxWidth: 600,
                lineHeight: 1.5,
              }}
            >
              Làm toàn bộ dịch vụ trong 1 buổi ghé Spa duy nhất. Hệ thống tự
              động xếp Kỹ thuật viên tốt nhất đang rảnh ca phục vụ quý khách.
            </p>
          </div>

          {/* MAIN TABS NAVIGATION */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setCustomerActiveTab("packages");
                setSelectedPkg(null);
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 14,
                border: "1.5px solid #fbcfe8",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                background:
                  customerActiveTab === "packages" ? "#db2777" : "#ffffff",
                color: customerActiveTab === "packages" ? "#ffffff" : "#be185d",
                boxShadow:
                  customerActiveTab === "packages"
                    ? "0 4px 14px rgba(219,39,119,0.3)"
                    : "none",
                transition: "all 0.2s",
              }}
            >
              📦 Gói Combo Của Tôi ({mine.length})
            </button>

            <button
              onClick={() => {
                setCustomerActiveTab("history");
                setSelectedPkg(null);
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 14,
                border: "1.5px solid #fbcfe8",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                background:
                  customerActiveTab === "history" ? "#db2777" : "#ffffff",
                color: customerActiveTab === "history" ? "#ffffff" : "#be185d",
                boxShadow:
                  customerActiveTab === "history"
                    ? "0 4px 14px rgba(219,39,119,0.3)"
                    : "none",
                transition: "all 0.2s",
              }}
            >
              📜 Lịch Sử Liệu Trình ({comboHistory.length})
            </button>

            <button
              onClick={() => navigate("/customer/reviews?type=combo")}
              style={{
                padding: "10px 20px",
                borderRadius: 14,
                border: "1.5px solid #fbcfe8",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                background: "#ffffff",
                color: "#be185d",
                transition: "all 0.2s",
              }}
            >
              ⭐ Đánh Giá Combo & KTV →
            </button>
          </div>
        </div>

        {message && (
          <div
            className="alert success"
            style={{ marginBottom: 20, borderRadius: 12 }}
          >
            {message}
          </div>
        )}

        {/* TAB 1: MY PACKAGES & SHOP */}
        {customerActiveTab === "packages" && (
          <div>
            {/* BREADCRUMB NAVIGATION khi đang xem detail */}
            {selectedPkg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 20,
                  padding: "10px 16px",
                  background: "#fdf2f8",
                  borderRadius: 12,
                  border: "1px solid #fbcfe8",
                  fontSize: 13,
                }}
              >
                <button
                  onClick={() => setSelectedPkg(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#db2777",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  📦 Gói Combo Của Tôi
                </button>
                <span style={{ color: "#94a3b8" }}>›</span>
                <span style={{ color: "#831843", fontWeight: 700 }}>
                  {selectedPkg.PackageName}
                </span>
              </div>
            )}

            {/* DETAIL PANEL khi chọn 1 combo */}
            {selectedPkg ? (
              <PackageDetailPanel
                pkg={selectedPkg}
                onClose={() => setSelectedPkg(null)}
                onRefresh={load}
                onCancelCombo={triggerCancelCombo}
              />
            ) : (
              /* GRID CÁC COMBO ĐÃ MUA */
              <div style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#831843",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>🌸</span> Liệu Trình Combo Của Tôi ({mine.length})
                </h2>
                <div
                  className="my-combo-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(340px, 1fr))",
                    gap: 20,
                  }}
                >
                  {mine.length ? (
                    mine.map((p) => {
                      const total = Number(p.TotalSessions || 0) || 1;
                      const left = Number(p.RemainingSessions || 0);
                      const used = Number(p.UsedSessions || 0);
                      const percent = Math.max(
                        0,
                        Math.min(100, (used / total) * 100),
                      );
                      const remaining = daysLeft(p.EndDate);
                      const relatedHistory = comboHistory.find(
                        (h) =>
                          Number(h.CustomerPackageId) ===
                          Number(p.CustomerPackageId),
                      );
                      const isPkgReviewed = relatedHistory
                        ? relatedHistory.IsReviewed
                        : false;

                      return (
                        <article
                          className="my-combo-card"
                          key={p.CustomerPackageId}
                          onClick={() => setSelectedPkg(p)}
                          style={{
                            background: "#fff",
                            borderRadius: 20,
                            border: "1.5px solid #fbcfe8",
                            overflow: "hidden",
                            boxShadow: "0 8px 24px rgba(236,72,153,0.06)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <div
                            className="my-combo-card-img-wrap"
                            style={{ position: "relative", height: 160 }}
                          >
                            <img
                              src={
                                resolveFileUrl(p.ImageUrl) ||
                                "/images/services/default-service.png"
                              }
                              alt={p.PackageName}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            {p.CategoryName && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: 12,
                                  right: 12,
                                  background: "rgba(255,255,255,0.9)",
                                  color: "#be185d",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                }}
                              >
                                {p.CategoryName}
                              </span>
                            )}
                          </div>

                          <div
                            className="my-combo-card-body"
                            style={{
                              padding: 18,
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <h3
                                style={{
                                  margin: "0 0 6px 0",
                                  fontSize: 16,
                                  fontWeight: 800,
                                  color: "#831843",
                                }}
                              >
                                {p.PackageName}
                              </h3>
                              <p
                                style={{
                                  margin: "0 0 14px 0",
                                  fontSize: 12,
                                  color: "#64748b",
                                  lineHeight: 1.4,
                                }}
                              >
                                {p.ServiceNames ||
                                  "Dịch vụ chăm sóc spa chuyên sâu"}
                              </p>
                            </div>

                            <div>
                              <div
                                style={{
                                  background: "#fdf2f8",
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  marginBottom: 14,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  fontSize: 12,
                                  color: "#9d174d",
                                  fontWeight: 700,
                                }}
                              >
                                <span>
                                  Giá gói:{" "}
                                  <b style={{ color: "#db2777" }}>
                                    {p.Amount ||
                                    p.PurchasePrice ||
                                    p.SalePrice ||
                                    p.OriginalPrice ||
                                    p.Price
                                      ? `${Number(p.Amount || p.PurchasePrice || p.SalePrice || p.OriginalPrice || p.Price).toLocaleString("vi-VN")}đ`
                                      : "—"}
                                  </b>
                                </span>
                                <span>
                                  {remaining !== null && remaining >= 0
                                    ? `⏳ Còn ${remaining} ngày`
                                    : "❌ Hết hạn"}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <StatusBadge status={p.Status} />
                                {p.Status === "PENDING_PAYMENT" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        repayVnpay(e, p.CustomerPackageId)
                                      }
                                      style={{
                                        background:
                                          "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        borderRadius: 10,
                                        padding: "6px 12px",
                                        cursor: "pointer",
                                        boxShadow:
                                          "0 3px 10px rgba(2,132,199,0.3)",
                                      }}
                                      title="Thanh toán ngay bằng VNPay"
                                    >
                                      💳 VNPay
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        repayPayos(e, p.CustomerPackageId)
                                      }
                                      style={{
                                        background:
                                          "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        borderRadius: 10,
                                        padding: "6px 12px",
                                        cursor: "pointer",
                                        boxShadow:
                                          "0 3px 10px rgba(219,39,119,0.3)",
                                      }}
                                      title="Thanh toán ngay bằng PayOS"
                                    >
                                      📲 PayOS
                                    </button>
                                  </div>
                                ) : p.Status === "ACTIVE" && left > 0 ? (
                                  <span
                                    style={{
                                      background:
                                        "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                                      color: "#ffffff",
                                      padding: "6px 14px",
                                      borderRadius: 12,
                                      fontSize: 12,
                                      fontWeight: 800,
                                      boxShadow:
                                        "0 4px 12px rgba(236,72,153,0.3)",
                                    }}
                                  >
                                    ✨ Đặt Lịch 1 Lượt →
                                  </span>
                                ) : p.Status === "COMPLETED" ||
                                  p.Status === "USED_UP" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomerActiveTab("history");
                                      }}
                                      style={{
                                        background: "#fdf2f8",
                                        border: "1px solid #fbcfe8",
                                        color: "#db2777",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        borderRadius: 10,
                                        padding: "4px 8px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      📜 Lịch sử
                                    </button>
                                    {isPkgReviewed ? (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: "#166534",
                                          background: "#f0fdf4",
                                          border: "1px solid #bbf7d0",
                                          padding: "4px 8px",
                                          borderRadius: 10,
                                        }}
                                      >
                                        ✅ Đã đánh giá
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(
                                            "/customer/reviews?type=combo",
                                          );
                                        }}
                                        style={{
                                          background: "#ec4899",
                                          border: "none",
                                          color: "#fff",
                                          fontSize: 11,
                                          fontWeight: 700,
                                          borderRadius: 10,
                                          padding: "4px 8px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        ⭐ Đánh giá
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: "#db2777",
                                    }}
                                  >
                                    Xem chi tiết →
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px dashed #fbcfe8",
                        borderRadius: 16,
                        padding: 30,
                        textAlign: "center",
                        gridColumn: "1 / -1",
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      Bạn chưa sở hữu Combo nào. Hãy xem danh sách các gói ưu
                      đãi bên dưới để mua ngay!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SHOP STORE SECTION - chỉ hiện khi không xem detail */}
            {!selectedPkg && (
              <div style={{ marginTop: 50 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#831843",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>🛒</span> Các Gói Combo Trọn Gói Khuyến Mãi
                  </h2>

                  <div
                    className="combo-toolbar"
                    style={{ display: "flex", gap: 10 }}
                  >
                    <input
                      value={filters.search}
                      onChange={(e) =>
                        setFilters((p) => ({ ...p, search: e.target.value }))
                      }
                      placeholder="Tìm gói combo..."
                      style={{
                        padding: "8px 14px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    />
                    <select
                      value={filters.category}
                      onChange={(e) =>
                        setFilters((p) => ({ ...p, category: e.target.value }))
                      }
                      style={{
                        padding: "8px 14px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                      }}
                    >
                      <option value="">Tất cả danh mục</option>
                      {categories.map((c) => (
                        <option key={c.CategoryName} value={c.CategoryName}>
                          {c.CategoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {loading && (
                  <p className="muted" style={{ textAlign: "center" }}>
                    Đang tải danh sách combo...
                  </p>
                )}

                <div
                  className="combo-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 24,
                  }}
                >
                  {packages.map((p) => (
                    <article
                      className="combo-card"
                      key={p.PackageId}
                      style={{
                        background: "#fff",
                        borderRadius: 20,
                        border: "1px solid #fbcfe8",
                        overflow: "hidden",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        className="combo-img-wrap"
                        style={{ position: "relative", height: 170 }}
                      >
                        {Number(p.DiscountPercent || 0) > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: 12,
                              left: 12,
                              background: "#dc2626",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "3px 10px",
                              borderRadius: 12,
                            }}
                          >
                            -{p.DiscountPercent}% GIẢM
                          </span>
                        )}
                        <img
                          src={
                            resolveFileUrl(p.ImageUrl) ||
                            "/images/services/default-service.png"
                          }
                          alt={p.PackageName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </div>

                      <div
                        className="combo-card-body"
                        style={{
                          padding: 18,
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              color: "#be185d",
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            {p.CategoryName}
                          </span>
                          <h3
                            style={{
                              margin: "4px 0 6px 0",
                              fontSize: 16,
                              fontWeight: 800,
                              color: "#1e293b",
                            }}
                          >
                            {p.PackageName}
                          </h3>
                          <p
                            style={{
                              margin: "0 0 10px 0",
                              fontSize: 12,
                              color: "#64748b",
                              lineHeight: 1.4,
                            }}
                          >
                            {p.Description}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#be185d",
                              background: "#fdf2f8",
                              padding: "6px 10px",
                              borderRadius: 8,
                              margin: "0 0 14px 0",
                            }}
                          >
                            ✨ {p.ServiceNames}
                          </p>
                        </div>

                        <div>
                          <div
                            className="combo-price-row"
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 10,
                              marginBottom: 14,
                            }}
                          >
                            <b
                              style={{
                                fontSize: 18,
                                color: "#db2777",
                                fontWeight: 800,
                              }}
                            >
                              {money(p.FinalPrice || p.Price)}
                            </b>
                            {Number(p.DiscountPercent || 0) > 0 && (
                              <del style={{ fontSize: 12, color: "#94a3b8" }}>
                                {money(p.Price)}
                              </del>
                            )}
                          </div>

                          <div
                            className="combo-actions"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr",
                              gap: 6,
                            }}
                          >
                            <button
                              className="card-btn"
                              style={{
                                margin: 0,
                                padding: "8px 4px",
                                fontSize: 11,
                                borderRadius: 10,
                                border: "1px solid #cbd5e1",
                                fontWeight: 700,
                              }}
                              onClick={() =>
                                navigate(`/packages/${p.PackageId}`)
                              }
                            >
                              Chi tiết
                            </button>
                            <button
                              className="card-btn primary"
                              style={{
                                margin: 0,
                                padding: "8px 4px",
                                fontSize: 11,
                                borderRadius: 10,
                                background: "#0284c7",
                                borderColor: "#0284c7",
                                fontWeight: 700,
                              }}
                              onClick={() => buyVnpay(p.PackageId)}
                            >
                              💳 VNPay
                            </button>
                            <button
                              className="card-btn primary"
                              style={{
                                margin: 0,
                                padding: "8px 4px",
                                fontSize: 11,
                                borderRadius: 10,
                                background: "#db2777",
                                borderColor: "#db2777",
                                fontWeight: 700,
                              }}
                              onClick={() => buyPayos(p.PackageId)}
                            >
                              📲 PayOS
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEDICATED COMBO TREATMENT HISTORY */}
        {customerActiveTab === "history" && (
          <div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#831843",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📜</span> Lịch Sử Nhật Ký Trị Liệu Combo (
              {comboHistory.length})
            </h2>

            {loadingHistory ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: 30 }}>
                Đang tải lịch sử trị liệu...
              </p>
            ) : comboHistory.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 40,
                  textAlign: "center",
                  border: "1px dashed #fbcfe8",
                  color: "#64748b",
                }}
              >
                Chưa có nhật ký sử dụng Combo nào. Sau khi hoàn thành buổi làm
                tại Spa, lịch sử chi tiết sẽ hiển thị ở đây!
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                {comboHistory.map((item) => (
                  <div
                    key={item.AppointmentId}
                    style={{
                      background: "#fff",
                      borderRadius: 20,
                      border: "1.5px solid #fbcfe8",
                      padding: 24,
                      boxShadow: "0 6px 18px rgba(236,72,153,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              background:
                                "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "3px 10px",
                              borderRadius: 10,
                            }}
                          >
                            #HẸN {item.AppointmentId}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              fontWeight: 700,
                            }}
                          >
                            📅 {formatDate(item.AppointmentDate)}
                          </span>
                          {item.StartTime && (
                            <span
                              style={{
                                fontSize: 12,
                                color: "#db2777",
                                fontWeight: 700,
                                background: "#fdf2f8",
                                padding: "2px 8px",
                                borderRadius: 8,
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              ⏰ {item.StartTime?.slice(0, 5)}
                              {item.EndTime
                                ? ` - ${item.EndTime?.slice(0, 5)}`
                                : ""}
                            </span>
                          )}
                        </div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#831843",
                          }}
                        >
                          {item.PackageName}
                        </h3>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <StatusBadge status={item.Status} />
                        {["CONFIRMED", "BOOKED", "PENDING"].includes(
                          item.Status,
                        ) &&
                          item.CustomerPackageId && (
                            <button
                              onClick={() =>
                                triggerCancelCombo(
                                  item.CustomerPackageId,
                                  item.AppointmentId,
                                )
                              }
                              style={{
                                background: "#fff1f2",
                                border: "1px solid #fecdd3",
                                color: "#e11d48",
                                padding: "4px 10px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              ❌ Hủy Lịch
                            </button>
                          )}
                      </div>
                    </div>

                    {/* SERVICES & TECHNICIANS BREAKDOWN */}
                    <div
                      style={{
                        background: "#fdf2f8",
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid #fbcfe8",
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#be185d",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          marginBottom: 8,
                        }}
                      >
                        ✂️ CÁC BƯỚC DỊCH VỤ & KTV ĐÃ PHỤC VỤ:
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(260px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {(item.Services || []).map((s, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "#ffffff",
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: "1px solid #fbcfe8",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <b
                                style={{
                                  color: "#831843",
                                  fontSize: 13,
                                  display: "block",
                                }}
                              >
                                {idx + 1}. {s.ServiceName}
                              </b>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                ⏱ {s.DurationMinutes || 30} phút
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <img
                                src={
                                  resolveFileUrl(s.TechnicianAvatar) ||
                                  "/images/avatars/default-avatar.png"
                                }
                                alt={s.TechnicianName}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: "1.5px solid #ec4899",
                                }}
                              />
                              <b style={{ fontSize: 12, color: "#be185d" }}>
                                {s.TechnicianName || "KTV Salon"}
                              </b>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TREATMENT NOTES IF ANY */}
                    {item.TreatmentNote && (
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: 12,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        <b
                          style={{
                            color: "#0f766e",
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          📋 Ghi chú chỉ định từ KTV:
                        </b>
                        <div>
                          {item.TreatmentNote.NoteText ||
                            item.TreatmentNote.SkinCondition}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEDICATED COMBO REVIEWS */}
        {customerActiveTab === "reviews" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#831843",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⭐</span> Đánh Giá Combo & Kỹ Thuật Viên Phụ Trách (
                {comboHistory.length})
              </h2>
              <span
                style={{
                  fontSize: 12,
                  color: "#9d174d",
                  background: "#fdf2f8",
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid #fbcfe8",
                  fontWeight: 700,
                }}
              >
                💡 Nhận xét của bạn giúp Spa không ngừng nâng cao chất lượng
                dịch vụ
              </span>
            </div>

            {loadingHistory ? (
              <p
                style={{
                  color: "#64748b",
                  textAlign: "center",
                  padding: 40,
                  fontWeight: 600,
                }}
              >
                ⏳ Đang tải nhật ký đánh giá...
              </p>
            ) : comboHistory.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: 50,
                  textAlign: "center",
                  border: "1.5px dashed #fbcfe8",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10 }}>🌸</div>
                <h3
                  style={{
                    color: "#831843",
                    fontSize: 16,
                    margin: "0 0 6px 0",
                  }}
                >
                  Chưa có liệu trình Combo hoàn thành
                </h3>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Sau khi hoàn thành các buổi trải nghiệm tại Spa, bạn có thể
                  thực hiện đánh giá tại đây!
                </p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {comboHistory.map((item) => (
                  <div
                    key={item.AppointmentId}
                    style={{
                      background:
                        "linear-gradient(180deg, #ffffff 0%, #fff0f6 100%)",
                      borderRadius: 24,
                      border: "1.5px solid #fbcfe8",
                      padding: 26,
                      boxShadow: "0 10px 30px rgba(236,72,153,0.06)",
                      transition: "all 0.25s ease",
                    }}
                  >
                    {/* CARD HEADER */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 16,
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              background:
                                "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "3px 10px",
                              borderRadius: 10,
                            }}
                          >
                            #HẸN {item.AppointmentId}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            📅 {formatDate(item.AppointmentDate)}
                          </span>
                          {item.StartTime && (
                            <span
                              style={{
                                fontSize: 12,
                                color: "#db2777",
                                fontWeight: 700,
                                background: "#fdf2f8",
                                padding: "2px 8px",
                                borderRadius: 8,
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              ⏰ {item.StartTime?.slice(0, 5)}
                              {item.EndTime
                                ? ` - ${item.EndTime?.slice(0, 5)}`
                                : ""}
                            </span>
                          )}
                        </div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 19,
                            fontWeight: 800,
                            color: "#831843",
                          }}
                        >
                          {item.PackageName}
                        </h3>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        {item.IsReviewed ? (
                          <>
                            <span
                              style={{
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                                padding: "6px 14px",
                                borderRadius: 14,
                                fontWeight: 800,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              ✅ Đã gửi đánh giá
                            </span>
                            <button
                              onClick={() => openReviewModal(item)}
                              style={{
                                background: "#fff",
                                color: "#db2777",
                                border: "1px solid #fbcfe8",
                                borderRadius: 12,
                                padding: "6px 14px",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              ✏️ Chỉnh sửa
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openReviewModal(item)}
                            style={{
                              background:
                                "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 14,
                              padding: "10px 20px",
                              fontWeight: 800,
                              fontSize: 13,
                              cursor: "pointer",
                              boxShadow: "0 4px 14px rgba(236,72,153,0.3)",
                            }}
                          >
                            ⭐ Đánh Giá Combo & KTV Ngay
                          </button>
                        )}
                      </div>
                    </div>

                    {/* OVERALL COMBO REVIEW BOX */}
                    {item.IsReviewed && (
                      <div
                        style={{
                          background:
                            "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
                          borderRadius: 18,
                          padding: "16px 20px",
                          border: "1.5px solid #fecdd3",
                          marginBottom: 16,
                          boxShadow: "0 4px 14px rgba(225, 29, 72, 0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: item.OverallComment ? 10 : 0,
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 22 }}>🌟</span>
                            <b
                              style={{
                                color: "#9f1239",
                                fontSize: 14,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              Đánh Giá Tổng Thể Gói Combo
                            </b>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              background: "#ffffff",
                              padding: "6px 14px",
                              borderRadius: 20,
                              border: "1px solid #fda4af",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                            }}
                          >
                            <span
                              style={{
                                color: "#f59e0b",
                                fontSize: 18,
                                fontWeight: 800,
                              }}
                            >
                              {"★".repeat(item.OverallRating || 5)}
                            </span>
                            <b style={{ color: "#9f1239", fontSize: 13 }}>
                              ({item.OverallRating || 5}/5 sao)
                            </b>
                          </div>
                        </div>

                        {item.OverallComment && (
                          <div
                            style={{
                              fontSize: 13,
                              color: "#881337",
                              lineHeight: 1.5,
                              background: "rgba(255,255,255,0.85)",
                              padding: "12px 16px",
                              borderRadius: 14,
                              border: "1px solid #ffe4e6",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>💬</span>
                            <div>
                              <b
                                style={{
                                  color: "#be185d",
                                  fontSize: 12,
                                  display: "block",
                                  marginBottom: 2,
                                }}
                              >
                                Nhận xét tổng quan:
                              </b>
                              <span
                                style={{
                                  fontStyle: "italic",
                                  color: "#4c0519",
                                  fontWeight: 600,
                                }}
                              >
                                "{item.OverallComment}"
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SERVICE STEPS & REVIEWS LIST */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {(item.Services || []).map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "#ffffff",
                            padding: "14px 18px",
                            borderRadius: 16,
                            border: "1px solid #fbcfe8",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10,
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  background: "#fdf2f8",
                                  color: "#db2777",
                                  fontWeight: 800,
                                  fontSize: 12,
                                  width: 26,
                                  height: 26,
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #fbcfe8",
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <b style={{ color: "#831843", fontSize: 14 }}>
                                  {s.ServiceName}
                                </b>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    marginLeft: 8,
                                  }}
                                >
                                  ⏱ {s.DurationMinutes || 30} phút
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "#f8fafc",
                                  padding: "4px 10px",
                                  borderRadius: 20,
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <img
                                  src={
                                    resolveFileUrl(s.TechnicianAvatar) ||
                                    "/images/avatars/default-avatar.png"
                                  }
                                  alt={s.TechnicianName}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    border: "1px solid #ec4899",
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                  }}
                                >
                                  KTV: {s.TechnicianName || "Salon KTV"}
                                </span>
                              </div>

                              <div>
                                {s.TechnicianRating > 0 ? (
                                  <span
                                    style={{
                                      color: "#f59e0b",
                                      fontWeight: 800,
                                      fontSize: 14,
                                      background: "#fffbeb",
                                      padding: "4px 10px",
                                      borderRadius: 12,
                                      border: "1px solid #fef3c7",
                                    }}
                                  >
                                    {"★".repeat(s.TechnicianRating)}{" "}
                                    <small
                                      style={{
                                        color: "#92400e",
                                        fontWeight: 700,
                                      }}
                                    >
                                      ({s.TechnicianRating}/5)
                                    </small>
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#94a3b8",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    Chưa chấm sao
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* CUSTOMER COMMENT SPEECH BUBBLE */}
                          {s.ServiceComment ? (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "10px 14px",
                                background:
                                  "linear-gradient(135deg, #fff1f2 0%, #fff0f6 100%)",
                                borderRadius: 14,
                                border: "1px solid #fecdd3",
                                color: "#881337",
                                fontSize: 13,
                                lineHeight: 1.5,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                              }}
                            >
                              <span style={{ fontSize: 16 }}>💬</span>
                              <div>
                                <b
                                  style={{
                                    color: "#be185d",
                                    fontSize: 12,
                                    display: "block",
                                    marginBottom: 2,
                                  }}
                                >
                                  Nhận xét của bạn:
                                </b>
                                <span
                                  style={{
                                    fontStyle: "italic",
                                    color: "#4c0519",
                                  }}
                                >
                                  "{s.ServiceComment}"
                                </span>
                              </div>
                            </div>
                          ) : s.TechnicianRating > 0 ? (
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                color: "#94a3b8",
                                fontStyle: "italic",
                                paddingLeft: 36,
                              }}
                            >
                              (Không có ghi chú nhận xét thêm)
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL: DEDICATED COMBO & STEP-BY-STEP KTV REVIEW */}
        {reviewModalAppt && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                width: "100%",
                maxWidth: 540,
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  borderBottom: "1px solid #e2e8f0",
                  pb: 12,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "#831843",
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  ⭐ Đánh Giá Combo & Kỹ Thuật Viên
                </h3>
                <button
                  onClick={() => setReviewModalAppt(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  background: "#fdf2f8",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #fbcfe8",
                  marginBottom: 16,
                }}
              >
                <b style={{ color: "#be185d", fontSize: 14, display: "block" }}>
                  {reviewModalAppt.PackageName}
                </b>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Ngày thực hiện: {formatDate(reviewModalAppt.AppointmentDate)}{" "}
                  (#HẸN {reviewModalAppt.AppointmentId})
                </span>
              </div>

              {/* 1. OVERALL COMBO RATING */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#1e293b",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  1. Đánh giá chất lượng tổng quan của Gói Combo:
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      onClick={() =>
                        setReviewForm((f) => ({ ...f, overallRating: star }))
                      }
                      style={{
                        fontSize: 28,
                        cursor: "pointer",
                        color:
                          star <= reviewForm.overallRating
                            ? "#f59e0b"
                            : "#cbd5e1",
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Nhập cảm nhận của bạn về gói Combo..."
                  value={reviewForm.overallComment}
                  onChange={(e) =>
                    setReviewForm((f) => ({
                      ...f,
                      overallComment: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>

              {/* 2. PER-STEP TECHNICIAN RATING */}
              <div
                style={{
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: 16,
                  marginBottom: 20,
                }}
              >
                <label
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#1e293b",
                    display: "block",
                    marginBottom: 10,
                  }}
                >
                  2. Chấm sao riêng cho tay nghề từng Kỹ Thuật Viên:
                </label>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {(reviewModalAppt.Services || []).map((step, idx) => {
                    const currentRating =
                      reviewForm.stepRatings[step.ServiceId]?.rating || 5;
                    const currentComment =
                      reviewForm.stepRatings[step.ServiceId]?.comment || "";

                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#f8fafc",
                          padding: 12,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <b style={{ color: "#0f766e", fontSize: 13 }}>
                            {idx + 1}. {step.ServiceName}
                          </b>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <img
                              src={
                                resolveFileUrl(step.TechnicianAvatar) ||
                                "/images/avatars/default-avatar.png"
                              }
                              alt={step.TechnicianName}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                            <b style={{ fontSize: 12, color: "#1e293b" }}>
                              {step.TechnicianName}
                            </b>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Chấm sao:
                          </span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              onClick={() => {
                                setReviewForm((f) => ({
                                  ...f,
                                  stepRatings: {
                                    ...f.stepRatings,
                                    [step.ServiceId]: {
                                      ...f.stepRatings[step.ServiceId],
                                      rating: star,
                                    },
                                  },
                                }));
                              }}
                              style={{
                                fontSize: 20,
                                cursor: "pointer",
                                color:
                                  star <= currentRating ? "#f59e0b" : "#cbd5e1",
                              }}
                            >
                              ★
                            </span>
                          ))}
                        </div>

                        <input
                          type="text"
                          placeholder={`Ghi chú nhận xét riêng cho KTV ${step.TechnicianName}...`}
                          value={currentComment}
                          onChange={(e) => {
                            setReviewForm((f) => ({
                              ...f,
                              stepRatings: {
                                ...f.stepRatings,
                                [step.ServiceId]: {
                                  ...f.stepRatings[step.ServiceId],
                                  comment: e.target.value,
                                },
                              },
                            }));
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setReviewModalAppt(null)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 10,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {submittingReview ? "Đang gửi..." : "Xác Nhận Gửi Đánh Giá"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CUSTOM CANCEL COMBO APPOINTMENT */}
        {cancelModalPkgId && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                width: "100%",
                maxWidth: 480,
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  borderBottom: "1px solid #fee2e2",
                  pb: 12,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "#be123c",
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  ❌ Hủy Lịch Hẹn Combo
                </h3>
                <button
                  onClick={() => setCancelModalPkgId(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#881337",
                }}
              >
                <b>ℹ️ LƯU Ý BẢO LƯU GÓI:</b>
                <p
                  style={{ margin: "4px 0 0 0", fontSize: 12, lineHeight: 1.5 }}
                >
                  Khi hủy lịch hẹn này,{" "}
                  <strong>
                    số lượt sử dụng trong gói Combo của bạn vẫn được giữ nguyên
                    100%
                  </strong>
                  . Bạn có thể tự do đặt lại lịch khác bất kỳ lúc nào rảnh!
                </p>
              </div>

              <label style={{ display: "block", marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e293b",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Vui lòng chọn hoặc nhập lý do hủy lịch:
                </span>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Nhập lý do hủy..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1.5px solid #fda4af",
                    fontSize: 13,
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setCancelModalPkgId(null)}
                  disabled={cancellingCombo}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Bỏ Qua
                </button>
                <button
                  onClick={confirmCancelCombo}
                  disabled={cancellingCombo}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                    color: "#fff",
                    cursor: cancellingCombo ? "not-allowed" : "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                    boxShadow: "0 4px 14px rgba(225,29,72,0.3)",
                    opacity: cancellingCombo ? 0.7 : 1,
                  }}
                >
                  {cancellingCombo ? "Đang xử lý hủy..." : "Xác Nhận Hủy Lịch"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT SUCCESS MODAL FOR COMBO PURCHASE */}

        {showPaymentSuccessModal && (
          <Modal
            open={true}
            onClose={() => setShowPaymentSuccessModal(false)}
            title="🎉 THANH TOÁN GÓI COMBO THÀNH CÔNG"
          >
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  margin: "0 auto 12px auto",
                  border: "2px solid #86efac",
                  boxShadow: "0 8px 24px rgba(34,197,94,0.25)",
                }}
              >
                💳
              </div>

              <h3
                style={{
                  color: "#15803d",
                  margin: "0 0 4px 0",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                THANH TOÁN THÀNH CÔNG!
              </h3>
              <p
                style={{ fontSize: 13, color: "#475569", margin: "0 0 16px 0" }}
              >
                Cảm ơn quý khách đã đăng ký Gói Combo Spa trọn gói tại Luna
                Salon & Spa.
              </p>

              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #bbf7d0",
                  borderRadius: 16,
                  padding: 18,
                  textAlign: "left",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                    paddingBottom: 10,
                    borderBottom: "1px dashed #cbd5e1",
                  }}
                >
                  <span style={{ fontSize: 24 }}>📦</span>
                  <div>
                    <span
                      style={{
                        background: "#166534",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      GÓI COMBO TRỌN GÓI
                    </span>
                    <h4
                      style={{
                        margin: "2px 0 0 0",
                        color: "#14532d",
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      {selectedPkg?.PackageName || "Gói Combo Spa Trọn Gói"}
                    </h4>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      MÃ GÓI COMBO:
                    </span>
                    <div style={{ fontWeight: 800, color: "#1e293b" }}>
                      #{selectedPkg?.CustomerPackageId || "COMBO"}
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      TRẠNG THÁI:
                    </span>
                    <div style={{ fontWeight: 800, color: "#15803d" }}>
                      ✓ Đã thanh toán 100%
                    </div>
                  </div>
                </div>

                {selectedPkg?.ServiceNames && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px dashed #cbd5e1",
                    }}
                  >
                    <span
                      style={{
                        color: "#166534",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      DỊCH VỤ TRỌN GÓI ĐI KÈM:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {String(selectedPkg.ServiceNames)
                        .split(",")
                        .map((svc, i) => (
                          <span
                            key={i}
                            style={{
                              background: "#ffffff",
                              color: "#166534",
                              border: "1px solid #86efac",
                              padding: "3px 8px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            ✓ {svc.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <button
                  className="btn primary"
                  style={{
                    width: "100%",
                    background:
                      "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    borderColor: "#047857",
                    fontWeight: 800,
                    padding: 12,
                    borderRadius: 12,
                    fontSize: 14,
                    cursor: "pointer",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(5,150,105,0.3)",
                  }}
                  onClick={() => {
                    setShowPaymentSuccessModal(false);
                    if (selectedPkg) {
                      setBookingForm({
                        appointmentDate: new Date().toISOString().slice(0, 10),
                        startTime: "09:00",
                        notes: "",
                      });
                      setIsRescheduleMode(false);
                      setShowBookModal(true);
                    }
                  }}
                >
                  📅 Đặt Lịch Sử Dụng Ngay →
                </button>

                <button
                  style={{
                    width: "100%",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontWeight: 700,
                    padding: 10,
                    borderRadius: 12,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setShowPaymentSuccessModal(false);
                    setCustomerActiveTab("packages");
                  }}
                >
                  Quản Lý Các Gói Combo Của Tôi
                </button>
              </div>
            </div>
          </Modal>
        )}
      </section>
    </CustomerLayout>
  );
}
