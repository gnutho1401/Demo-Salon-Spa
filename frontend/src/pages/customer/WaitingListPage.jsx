import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useNavigate, useSearchParams } from "react-router-dom";

const STATUS = {
  WAITING: { label: "Đang chờ", icon: "⏳", className: "waiting" },
  MATCHED: { label: "Đã khớp slot", icon: "⚡", className: "matched" },
  SKIPPED: { label: "Bỏ lỡ", icon: "⌛", className: "skipped" },
  EXPIRED: { label: "Hết hạn", icon: "📆", className: "expired" },
  NOTIFIED: { label: "Đã thông báo", icon: "🔔", className: "notified" },
  BOOKED: { label: "Đã đặt lịch", icon: "✅", className: "booked" },
  CANCELLED: { label: "Đã hủy", icon: "✕", className: "cancelled" },
};

const PRIORITY = {
  NORMAL: { label: "Bình thường", className: "normal" },
  HIGH: { label: "Ưu tiên cao", className: "high" },
  URGENT: { label: "Rất gấp", className: "urgent" },
};

const TIME_SLOT = {
  ANY: "Linh hoạt cả ngày",
  MORNING: "Buổi sáng 08:00 - 12:00",
  AFTERNOON: "Buổi chiều 13:00 - 17:00",
  EVENING: "Buổi tối 18:00 - 20:00",
  CUSTOM: "Tự chọn khoảng giờ",
};

const CONTACT = {
  PHONE: "Gọi điện",
  ZALO: "Zalo",
  SMS: "SMS",
  EMAIL: "Email",
};

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function imageUrl(value) {
  return resolveFileUrl(value);
}

function dateText(value) {
  if (!value) return "Linh hoạt";
  return new Date(value).toLocaleDateString("vi-VN");
}

function timeText(value) {
  if (!value) return "Linh hoạt";
  return String(value).slice(0, 5);
}

function timeRangeText(item) {
  if (item.FlexibleTimeSlot && item.FlexibleTimeSlot !== "CUSTOM") {
    return TIME_SLOT[item.FlexibleTimeSlot] || "Linh hoạt";
  }

  if (item.PreferredTimeFrom && item.PreferredTimeTo) {
    return `${timeText(item.PreferredTimeFrom)} - ${timeText(item.PreferredTimeTo)}`;
  }

  if (item.PreferredTime) return timeText(item.PreferredTime);

  return "Linh hoạt";
}

function dateTimeText(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function durationText(minutes) {
  const m = Number(minutes || 0);

  if (m < 60) return `${m} phút`;

  const h = Math.floor(m / 60);
  const remain = m % 60;

  return remain ? `${h} giờ ${remain} phút` : `${h} giờ`;
}

function waitedText(minutes) {
  const m = Number(minutes || 0);

  if (m < 60) return `${m} phút`;
  if (m < 1440) return `${Math.floor(m / 60)} giờ`;

  return `${Math.floor(m / 1440)} ngày`;
}

function HoldCountdown({ expiresAt, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      if (!expiresAt) return;
      const exp = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = exp - now;

      if (diff <= 0) {
        setTimeLeft("Đã hết hạn giữ chỗ");
        if (onTimeout) onTimeout();
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span className="hold-countdown">{timeLeft}</span>;
}

export default function WaitingListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const minDate = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= 21) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    return now.toISOString().split("T")[0];
  }, []);
  const [options, setOptions] = useState({
    services: [],
    branches: [],
    employees: [],
    employeeServices: [],
  });

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [customer, setCustomer] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleConfirmMatch(waitingId) {
    try {
      setMessage("");
      setError("");
      setSaving(true);
      const res = await axiosClient.post(`/waiting-list/${waitingId}/confirm`);
      setMessage("Xác nhận lịch ghép thành công! Đang chuyển hướng sang thanh toán...");
      const appointmentId = res.data?.data?.appointmentId || res.data?.data?.AppointmentId;
      if (appointmentId) {
        setTimeout(() => {
          navigate(`/customer/payment/${appointmentId}`);
        }, 1500);
      } else {
        await loadItems();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận lịch ghép thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectMatch(waitingId) {
    if (!window.confirm("Bạn có chắc chắn muốn từ chối khung giờ được ghép này? Yêu cầu hàng chờ của bạn sẽ bị hủy.")) {
      return;
    }
    try {
      setMessage("");
      setError("");
      setSaving(true);
      await axiosClient.post(`/waiting-list/${waitingId}/reject`);
      setMessage("Đã từ chối lịch ghép thành công. Hệ thống đang tìm người thay thế.");
      await loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Từ chối lịch ghép thất bại.");
    } finally {
      setSaving(false);
    }
  }

  const [filters, setFilters] = useState({
    status: "ALL",
    keyword: "",
    fromDate: "",
    toDate: "",
    serviceId: "",
    branchId: "",
    employeeId: "",
    priorityLevel: "ALL",
  });

  const [form, setForm] = useState({
    waitingId: null,
    serviceId: "",
    preferredEmployeeId: "",
    preferredBranchId: "",
    preferredDate: "",
    flexibleTimeSlot: "ANY",
    preferredTimeFrom: "",
    preferredTimeTo: "",
    priorityLevel: "NORMAL",
    contactMethod: "EMAIL",
    contactPhone: "",
    reason: "",
    note: "",
    acceptOtherTechnician: false,
    acceptOtherTimeSlots: false,
  });

  const [detail, setDetail] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const services = options.services || [];
  const branches = options.branches || [];
  const employees = options.employees || [];
  const employeeServices = options.employeeServices || [];

  const selectedService = useMemo(() => {
    return services.find((s) => String(s.ServiceId) === String(form.serviceId));
  }, [services, form.serviceId]);

  const selectedBranchObject = useMemo(() => {
    return branches.find((b) => String(b.BranchId) === String(form.preferredBranchId));
  }, [branches, form.preferredBranchId]);

  const availableEmployees = useMemo(() => {
    let list = employees;
    if (form.serviceId) {
      const allowedIds = employeeServices
        .filter((x) => String(x.ServiceId) === String(form.serviceId))
        .map((x) => String(x.EmployeeId));
      list = list.filter((e) => allowedIds.includes(String(e.EmployeeId)));
    }
    if (form.preferredBranchId) {
      list = list.filter((e) => String(e.BranchId) === String(form.preferredBranchId));
    }
    return list;
  }, [employees, employeeServices, form.serviceId, form.preferredBranchId]);

  const [fullyBookedEmployeeIds, setFullyBookedEmployeeIds] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    let active = true;
    if (!form.serviceId || !form.preferredDate || availableEmployees.length === 0) {
      setFullyBookedEmployeeIds([]);
      return;
    }

    async function checkTechniciansAvailability() {
      try {
        setLoadingAvailability(true);
        const promises = availableEmployees.map(async (emp) => {
          try {
            const res = await axiosClient.get("/appointments/available-slots", {
              params: {
                serviceId: form.serviceId,
                employeeId: emp.EmployeeId,
                appointmentDate: form.preferredDate,
              },
            });
            const data = res.data?.data;
            const isFullyBooked = Array.isArray(data)
              ? data.length === 0
              : (!data?.slots || data.slots.length === 0);
            return { employeeId: emp.EmployeeId, isFullyBooked };
          } catch (e) {
            return { employeeId: emp.EmployeeId, isFullyBooked: true };
          }
        });

        const results = await Promise.all(promises);
        if (active) {
          const bookedIds = results
            .filter((r) => r.isFullyBooked)
            .map((r) => String(r.employeeId));
          setFullyBookedEmployeeIds(bookedIds);
          
          setForm((prev) => {
            // Keep the preferred employee fixed even if they are not fully booked
            // if (prev.preferredEmployeeId && !bookedIds.includes(String(prev.preferredEmployeeId))) {
            //   return { ...prev, preferredEmployeeId: "" };
            // }
            return prev;
          });
        }
      } catch (err) {
        console.error("Lỗi kiểm tra lịch rảnh KTV:", err);
      } finally {
        if (active) setLoadingAvailability(false);
      }
    }

    checkTechniciansAvailability();

    return () => {
      active = false;
    };
  }, [form.serviceId, form.preferredDate, availableEmployees]);

  const filteredEmployees = useMemo(() => {
    if (!form.preferredDate) return availableEmployees;
    return availableEmployees.filter((emp) =>
      fullyBookedEmployeeIds.includes(String(emp.EmployeeId))
    );
  }, [availableEmployees, fullyBookedEmployeeIds, form.preferredDate]);

  async function loadOptions() {
    const res = await axiosClient.get("/waiting-list/options");
    setOptions(res.data?.data || {});
  }

  async function loadItems() {
    const res = await axiosClient.get("/waiting-list/my", { params: filters });
    const data = res.data?.data || {};
    setItems(data.items || []);
    setSummary(data.summary || {});
    setCustomer(data.customer || null);
  }

  async function load() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([loadOptions(), loadItems()]);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được hàng chờ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters.status]);

  useEffect(() => {
    if (customer?.Phone && !form.contactPhone) {
      setForm((prev) => ({ ...prev, contactPhone: customer.Phone }));
    }
  }, [customer]);

  useEffect(() => {
    const serviceId = searchParams.get("serviceId");
    const employeeId = searchParams.get("employeeId");
    const date = searchParams.get("date");
    const acceptTech = searchParams.get("acceptOtherTechnician");
    const acceptTime = searchParams.get("acceptOtherTimeSlots");

    if (serviceId || employeeId || date || acceptTech || acceptTime) {
      setForm((prev) => {
        const isAcceptTech = acceptTech === "true" || acceptTech === "1" ? true : prev.acceptOtherTechnician;
        const isAcceptTime = acceptTime === "true" || acceptTime === "1" ? true : prev.acceptOtherTimeSlots;
        return {
          ...prev,
          serviceId: serviceId || prev.serviceId,
          preferredEmployeeId: isAcceptTech ? "" : (employeeId || prev.preferredEmployeeId),
          preferredDate: date || prev.preferredDate,
          acceptOtherTechnician: isAcceptTech,
          acceptOtherTimeSlots: isAcceptTime,
          flexibleTimeSlot: isAcceptTime ? "ANY" : prev.flexibleTimeSlot,
          preferredTimeFrom: isAcceptTime ? "" : prev.preferredTimeFrom,
          preferredTimeTo: isAcceptTime ? "" : prev.preferredTimeTo,
        };
      });
      setTimeout(() => {
        window.scrollTo({ top: 430, behavior: "smooth" });
      }, 300);
    }
  }, [searchParams]);

  useEffect(() => {
    if (form.preferredEmployeeId && employees.length > 0) {
      const selectedEmpObj = employees.find(
        (emp) => String(emp.EmployeeId) === String(form.preferredEmployeeId)
      );
      if (selectedEmpObj && selectedEmpObj.BranchId && String(form.preferredBranchId) !== String(selectedEmpObj.BranchId)) {
        setForm((prev) => ({
          ...prev,
          preferredBranchId: String(selectedEmpObj.BranchId),
        }));
      }
    }
  }, [form.preferredEmployeeId, employees]);

  function resetForm() {
    setForm({
      waitingId: null,
      serviceId: "",
      preferredEmployeeId: "",
      preferredBranchId: "",
      preferredDate: "",
      flexibleTimeSlot: "ANY",
      preferredTimeFrom: "",
      preferredTimeTo: "",
      priorityLevel: "NORMAL",
      contactMethod: "EMAIL",
      contactPhone: "",
      reason: "",
      note: "",
      acceptOtherTechnician: false,
      acceptOtherTimeSlots: false,
    });
  }

  function resetFilter() {
    setFilters({
      status: "ALL",
      keyword: "",
      fromDate: "",
      toDate: "",
      serviceId: "",
      branchId: "",
      employeeId: "",
      priorityLevel: "ALL",
    });
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.serviceId) {
      setError("Vui lòng chọn dịch vụ.");
      return;
    }

    if (form.preferredDate && form.preferredDate < minDate) {
      setError("Thời gian hoạt động trong ngày đã kết thúc hoặc ngày chọn ở quá khứ. Vui lòng chọn ngày khác.");
      return;
    }

    if (form.flexibleTimeSlot === "CUSTOM") {
      if (!form.preferredTimeFrom || !form.preferredTimeTo) {
        setError("Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc.");
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        serviceId: form.serviceId,
        preferredEmployeeId: form.preferredEmployeeId || null,
        preferredBranchId: form.preferredBranchId || null,
        preferredDate: form.preferredDate || "",
        flexibleTimeSlot: form.flexibleTimeSlot,
        preferredTimeFrom: form.preferredTimeFrom || "",
        preferredTimeTo: form.preferredTimeTo || "",
        priorityLevel: form.priorityLevel,
        contactMethod: form.contactMethod,
        contactPhone: form.contactPhone,
        reason: form.reason,
        note: form.note,
        acceptOtherTechnician: form.acceptOtherTechnician ? 1 : 0,
        acceptOtherTimeSlots: form.acceptOtherTimeSlots ? 1 : 0,
      };

      if (form.waitingId) {
        await axiosClient.put(`/waiting-list/${form.waitingId}`, payload);
        setMessage("Đã cập nhật yêu cầu hàng chờ.");
      } else {
        await axiosClient.post("/waiting-list", payload);
        setMessage("Đã thêm vào hàng chờ.");
      }

      resetForm();
      await loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Lưu hàng chờ thất bại.");
    } finally {
      setSaving(false);
    }
  }

  function editItem(item) {
    const isAcceptTech = !!item.AcceptOtherTechnician;
    const isAcceptTime = !!item.AcceptOtherTimeSlots;
    setForm({
      waitingId: item.WaitingId,
      serviceId: item.ServiceId || "",
      preferredEmployeeId: isAcceptTech ? "" : (item.PreferredEmployeeId || ""),
      preferredBranchId: item.PreferredBranchId || "",
      preferredDate: item.PreferredDate
        ? String(item.PreferredDate).slice(0, 10)
        : "",
      flexibleTimeSlot: isAcceptTime ? "ANY" : (item.FlexibleTimeSlot || "ANY"),
      preferredTimeFrom: isAcceptTime ? "" : (item.PreferredTimeFrom || ""),
      preferredTimeTo: isAcceptTime ? "" : (item.PreferredTimeTo || ""),
      priorityLevel: item.PriorityLevel || "NORMAL",
      contactMethod: item.ContactMethod || "EMAIL",
      contactPhone: item.ContactPhone || "",
      reason: item.Reason || "",
      note: item.Note || "",
      acceptOtherTechnician: isAcceptTech,
      acceptOtherTimeSlots: isAcceptTime,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmCancel() {
    if (!cancelTarget) return;

    try {
      setMessage("");
      setError("");

      await axiosClient.delete(`/waiting-list/${cancelTarget.WaitingId}`, {
        data: { cancelReason },
      });

      setMessage("Đã hủy yêu cầu hàng chờ.");
      setCancelTarget(null);
      setCancelReason("");
      await loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy yêu cầu thất bại.");
    }
  }

  function search(e) {
    e.preventDefault();
    loadItems();
  }

  function openDetail(item) {
    setDetail(item);
  }

  return (
    <CustomerLayout>
      <div className="wlx-page">
        <section className="wlx-hero">
          <div className="wlx-hero-main">
            <span className="wlx-eyebrow">CUSTOMER WAITING LIST</span>
            <h1>Hàng chờ lịch hẹn</h1>
            <p>
              Gửi yêu cầu khi chưa có khung giờ phù hợp. Bạn có thể chọn dịch
              vụ, kỹ thuật viên, chi nhánh, khung giờ, mức ưu tiên và phương
              thức liên hệ.
            </p>

            <div className="wlx-hero-actions">
              {searchParams.get("serviceId") ? (
                <button
                  type="button"
                  onClick={() =>
                    window.scrollTo({ top: 430, behavior: "smooth" })
                  }
                >
                  + Tạo yêu cầu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/customer/booking")}
                >
                  + Đăng ký hàng chờ
                </button>
              )}
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  window.scrollTo({ top: 980, behavior: "smooth" })
                }
              >
                Xem danh sách
              </button>
            </div>
          </div>

          <div className="wlx-hero-side">
            <span>Đang hoạt động</span>
            <b>{summary.Active || 0}</b>
            <small>{summary.UrgentActive || 0} yêu cầu rất gấp</small>
          </div>
        </section>

        {message && <div className="wlx-alert success">{message}</div>}
        {error && <div className="wlx-alert error">{error}</div>}

        <section className="wlx-stats">
          <div>
            <span>Tổng yêu cầu</span>
            <b>{summary.Total || 0}</b>
          </div>
          <div>
            <span>Đang chờ</span>
            <b>{summary.Waiting || 0}</b>
          </div>
          <div>
            <span>⚡ Đã khớp slot</span>
            <b style={{ color: '#ef4f83' }}>{summary.Matched || 0}</b>
          </div>
          <div>
            <span>Đã thông báo</span>
            <b>{summary.Notified || 0}</b>
          </div>
          <div>
            <span>Đã đặt lịch</span>
            <b>{summary.Booked || 0}</b>
          </div>
          <div>
            <span>Đã hủy</span>
            <b>{summary.Cancelled || 0}</b>
          </div>
        </section>

        <section className="wlx-create-grid">
          {!form.waitingId && !searchParams.get("serviceId") ? (
            <div className="wlx-form wlx-info-placeholder" style={{ padding: "40px", textAlign: "center", background: "rgba(255, 255, 255, 0.05)", borderRadius: "16px", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>ℹ️</div>
              <h2 style={{ color: "#ef4f83", marginBottom: "15px" }}>Không thể tạo yêu cầu trực tiếp</h2>
              <p style={{ fontSize: "15px", lineHeight: "1.6", marginBottom: "15px" }}>
                Yêu cầu xếp hàng chờ chỉ được thực hiện khi bạn <strong>đặt lịch hẹn bình thường nhưng hết slot trống phù hợp</strong>.
              </p>
              <p style={{ fontSize: "14px", color: "#aaa", marginBottom: "25px" }}>
                Vui lòng truy cập trang Đặt lịch hẹn để chọn dịch vụ và thời gian mong muốn.
              </p>
              <button
                type="button"
                onClick={() => navigate("/customer/booking")}
                style={{
                  backgroundColor: "#ef4f83",
                  color: "white",
                  padding: "12px 30px",
                  border: "none",
                  borderRadius: "25px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(239, 79, 131, 0.3)",
                  fontSize: "15px"
                }}
              >
                Đến trang Đặt lịch hẹn
              </button>
            </div>
          ) : (
            <form className="wlx-form" onSubmit={submit}>
            <div className="wlx-title">
              <span>01</span>
              <div>
                <h2>
                  {form.waitingId
                    ? "Cập nhật yêu cầu hàng chờ"
                    : "Tạo yêu cầu hàng chờ"}
                </h2>
                <p>Điền đầy đủ thông tin để salon dễ xếp lịch chính xác.</p>
              </div>
            </div>

            <div className="wlx-form-section">
              <h3>Thông tin dịch vụ</h3>

              <label>
                Dịch vụ <b>*</b>
                <select
                  value={form.serviceId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serviceId: e.target.value,
                      preferredEmployeeId: "",
                    })
                  }
                >
                  <option value="">Chọn dịch vụ</option>
                  {services.map((s) => (
                    <option key={s.ServiceId} value={s.ServiceId}>
                      {s.ServiceName} - {money(s.Price)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedService && (
                <div className="wlx-service-preview">
                  <div className="wlx-preview-img">
                    {selectedService.ImageUrl ? (
                      <img
                        src={imageUrl(selectedService.ImageUrl)}
                        alt={selectedService.ServiceName}
                      />
                    ) : (
                      <span>💆</span>
                    )}
                  </div>
                  <div>
                    <b>{selectedService.ServiceName}</b>
                    <p>
                      {selectedService.Description || "Chưa có mô tả dịch vụ."}
                    </p>
                    <small>
                      {durationText(selectedService.DurationMinutes)} ·{" "}
                      {money(selectedService.Price)}
                    </small>
                  </div>
                </div>
              )}
            </div>

            <div className="wlx-form-section">
              <h3>Yêu cầu xếp lịch</h3>

              <div className="wlx-two">
                <label>
                  Chi nhánh mong muốn
                  <select
                    value={form.preferredBranchId}
                    onChange={(e) => {
                      const nextBranchId = e.target.value;
                      const currentEmp = employees.find((x) => String(x.EmployeeId) === String(form.preferredEmployeeId));
                      const nextEmpId = currentEmp && nextBranchId && String(currentEmp.BranchId) !== String(nextBranchId)
                        ? ""
                        : form.preferredEmployeeId;
                      setForm({
                        ...form,
                        preferredBranchId: nextBranchId,
                        preferredEmployeeId: nextEmpId
                      });
                    }}
                  >
                    <option value="">Bất kỳ chi nhánh</option>
                    {branches.map((b) => (
                      <option key={b.BranchId} value={b.BranchId}>
                        {b.BranchName}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBranchObject?.Address && (
                  <div style={{ marginTop: "10px", borderRadius: "12px", overflow: "hidden", border: "1px solid #ffe1ea", gridColumn: "span 2", width: "100%" }}>
                    <iframe
                      title="Bản đồ chi nhánh hàng chờ"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedBranchObject.Address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                      width="100%"
                      height="150"
                      style={{ border: 0, display: "block" }}
                      allowFullScreen=""
                      loading="lazy"
                    />
                  </div>
                )}

                <label>
                  Kỹ thuật viên mong muốn
                  <select
                    value={form.preferredEmployeeId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const empObj = employees.find((x) => String(x.EmployeeId) === String(empId));
                      setForm({
                        ...form,
                        preferredEmployeeId: empId,
                        preferredBranchId: empObj ? String(empObj.BranchId) : form.preferredBranchId
                      });
                    }}
                    disabled={true}
                  >
                    <option value="">Không yêu cầu</option>
                    {employees.map((e) => (
                      <option key={e.EmployeeId} value={e.EmployeeId}>
                        {e.FullName} - {e.Specialization || "Kỹ thuật viên"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="wlx-two">
                <label>
                  Ngày mong muốn
                  <input
                    type="date"
                    min={minDate}
                    value={form.preferredDate}
                    onChange={(e) =>
                      setForm({ ...form, preferredDate: e.target.value })
                    }
                    disabled={true}
                  />
                </label>

                <label>
                  Khung giờ mong muốn
                  <select
                    value={form.flexibleTimeSlot}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        flexibleTimeSlot: e.target.value,
                        preferredTimeFrom: "",
                        preferredTimeTo: "",
                      })
                    }
                    disabled={true}
                  >
                    <option value="ANY">Linh hoạt cả ngày</option>
                  </select>
                </label>
              </div>

              {form.flexibleTimeSlot === "CUSTOM" && (
                <div className="wlx-two">
                  <label>
                    Từ giờ
                    <input
                      type="time"
                      value={form.preferredTimeFrom}
                      onChange={(e) =>
                        setForm({ ...form, preferredTimeFrom: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Đến giờ
                    <input
                      type="time"
                      value={form.preferredTimeTo}
                      onChange={(e) =>
                        setForm({ ...form, preferredTimeTo: e.target.value })
                      }
                    />
                  </label>
                </div>
              )}


            </div>

            <div className="wlx-actions">
              <button disabled={saving}>
                {saving
                  ? "Đang lưu..."
                  : form.waitingId
                    ? "Cập nhật yêu cầu"
                    : "Thêm vào hàng chờ"}
              </button>

              {form.waitingId && (
                <button type="button" className="outline" onClick={resetForm}>
                  Hủy sửa
                </button>
              )}
            </div>
          </form>
          )}

          <aside className="wlx-side-panel">
            <h3>Quy trình xử lý</h3>
            <div>
              <b>1</b>
              <p>
                <strong>Gửi yêu cầu</strong>Chọn dịch vụ, thời gian, KTV và mức ưu tiên.
              </p>
            </div>
            <div>
              <b>2</b>
              <p>
                <strong>Hệ thống tìm kiếm</strong>Hệ thống tự động ghép slot trống phù hợp với yêu cầu của bạn.
              </p>
            </div>
            <div>
              <b>3</b>
              <p>
                <strong>⚡ Khớp slot</strong>Khi tìm được slot, hệ thống giữ chỗ và thông báo cho bạn xác nhận.
              </p>
            </div>
            <div>
              <b>4</b>
              <p>
                <strong>Xác nhận &amp; Thanh toán</strong>Bạn xác nhận slot được ghép và tiến hành thanh toán. Nếu từ chối, yêu cầu sẽ bị hủy.
              </p>
            </div>
            <div>
              <b>5</b>
              <p>
                <strong>✅ Hoàn tất</strong>Lịch hẹn chính thức được tạo và chờ đến ngày phục vụ.
              </p>
            </div>
          </aside>
        </section>

        <section className="wlx-list-panel">
          <div className="wlx-title">
            <span>02</span>
            <div>
              <h2>Danh sách hàng chờ của tôi</h2>
              <p>
                Theo dõi vị trí, thời gian chờ, trạng thái và thao tác sửa/hủy.
              </p>
            </div>
          </div>

          <form className="wlx-filter" onSubmit={search}>
            <input
              value={filters.keyword}
              placeholder="Tìm dịch vụ, chi nhánh, kỹ thuật viên, ghi chú..."
              onChange={(e) =>
                setFilters({ ...filters, keyword: e.target.value })
              }
            />

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="WAITING">Đang chờ</option>
              <option value="MATCHED">Đã khớp slot</option>
              <option value="SKIPPED">Bỏ lỡ</option>
              <option value="EXPIRED">Hết hạn</option>
              <option value="NOTIFIED">Đã thông báo</option>
              <option value="BOOKED">Đã đặt lịch</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>

            <select
              value={filters.priorityLevel}
              onChange={(e) =>
                setFilters({ ...filters, priorityLevel: e.target.value })
              }
            >
              <option value="ALL">Tất cả ưu tiên</option>
              <option value="NORMAL">Bình thường</option>
              <option value="HIGH">Ưu tiên cao</option>
              <option value="URGENT">Rất gấp</option>
            </select>

            <select
              value={filters.serviceId}
              onChange={(e) =>
                setFilters({ ...filters, serviceId: e.target.value })
              }
            >
              <option value="">Tất cả dịch vụ</option>
              {services.map((s) => (
                <option key={s.ServiceId} value={s.ServiceId}>
                  {s.ServiceName}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) =>
                setFilters({ ...filters, fromDate: e.target.value })
              }
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) =>
                setFilters({ ...filters, toDate: e.target.value })
              }
            />

            <button>Tìm</button>
            <button type="button" className="reset" onClick={resetFilter}>
              Reset
            </button>
          </form>

          {loading ? (
            <div className="wlx-empty">Đang tải dữ liệu hàng chờ...</div>
          ) : items.length === 0 ? (
            <div className="wlx-empty">Bạn chưa có yêu cầu hàng chờ nào.</div>
          ) : (
            <div className="wlx-card-list">
              {items.map((item) => {
                const st = STATUS[item.Status] || {
                  label: item.Status,
                  icon: "•",
                  className: "default",
                };
                const pr = PRIORITY[item.PriorityLevel] || PRIORITY.NORMAL;
                // Chỉ WAITING mới được sửa yêu cầu; WAITING + NOTIFIED được hủy (MATCHED đã dùng confirm/reject riêng)
                const canEdit = item.Status === "WAITING";
                const canCancel = ["WAITING", "NOTIFIED"].includes(item.Status);

                return (
                  <article className="wlx-card" key={item.WaitingId}>
                    <div className="wlx-card-top">
                      <div className="wlx-card-img">
                        {item.ServiceImageUrl ? (
                          <img
                            src={imageUrl(item.ServiceImageUrl)}
                            alt={item.ServiceName}
                          />
                        ) : (
                          <span>💆</span>
                        )}
                      </div>

                      <div className="wlx-card-main">
                        <div className="wlx-card-title">
                          <div>
                            <h3>{item.ServiceName}</h3>
                            <p>
                              {item.ServiceDescription ||
                                "Chưa có mô tả dịch vụ."}
                            </p>
                          </div>

                          <div className="wlx-badges">
                            <span className={`wlx-status ${st.className}`}>
                              {st.icon} {st.label}
                            </span>
                            <span className={`wlx-priority ${pr.className}`}>
                              {pr.label}
                            </span>
                          </div>
                        </div>

                        <div className="wlx-tags">
                          <span>{item.CategoryName || "Chưa phân loại"}</span>
                          <span>{money(item.Price)}</span>
                          <span>{durationText(item.DurationMinutes)}</span>
                          <span>
                            {item.AvailableTechnicianCount || 0} KTV phù hợp
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="wlx-info-grid">
                      {item.Status === "BOOKED" && item.ConvertedAppointmentId && (
                        <div style={{ gridColumn: "span 2", background: "rgba(219, 39, 119, 0.1)", padding: "8px 12px", borderRadius: "8px", border: "1px dashed #db2777", marginBottom: "8px" }}>
                          <span style={{ color: "#db2777", fontWeight: "bold" }}>Lịch hẹn liên kết</span>
                          <b>
                            <a
                              href={`/customer/appointments/${item.ConvertedAppointmentId}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/customer/appointments/${item.ConvertedAppointmentId}`);
                              }}
                              style={{ color: "#db2777", textDecoration: "underline", fontWeight: "bold" }}
                            >
                              Xem lịch hẹn AP{String(item.ConvertedAppointmentId).padStart(5, "0")} 📅
                            </a>
                          </b>
                        </div>
                      )}
                      <div>
                        <span>Vị trí hàng chờ</span>
                        <b>#{item.WaitingPosition || 1}</b>
                      </div>
                      <div>
                        <span>Đã chờ</span>
                        <b>{waitedText(item.WaitingMinutes)}</b>
                      </div>
                      <div>
                        <span>Ước tính xử lý</span>
                        <b>{item.EstimatedResponseTime || "-"}</b>
                      </div>
                      <div>
                        <span>Ngày mong muốn</span>
                        <b>{dateText(item.PreferredDate)}</b>
                      </div>
                      <div>
                        <span>Khung giờ</span>
                        <b>{timeRangeText(item)}</b>
                      </div>
                      <div>
                        <span>Kỹ thuật viên</span>
                        <b>{item.PreferredEmployeeName || "Không yêu cầu"}</b>
                      </div>
                      <div>
                        <span>Ghép KTV khác</span>
                        <b>{item.AcceptOtherTechnician ? "Có" : "Không"}</b>
                      </div>
                      <div>
                        <span>Ghép giờ khác</span>
                        <b>{item.AcceptOtherTimeSlots ? "Có" : "Không"}</b>
                      </div>
                      <div>
                        <span>Chi nhánh</span>
                        <b>{item.PreferredBranchName || "Bất kỳ"}</b>
                      </div>
                      <div>
                        <span>Liên hệ</span>
                        <b>{CONTACT[item.ContactMethod] || "Gọi điện"}</b>
                      </div>
                    </div>

                    {item.Reason && (
                      <div className="wlx-note">
                        <b>Lý do:</b> {item.Reason}
                      </div>
                    )}
                    {item.Note && (
                      <div className="wlx-note">
                        <b>Ghi chú:</b> {item.Note}
                      </div>
                    )}

                    {item.Status === "MATCHED" && (
                      <div className="wlx-matched-banner">
                        <div className="wlx-matched-header">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', color: '#db2777' }}>
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                          <h4>ĐÃ KHỚP SLOT & GIỮ CHỖ THÀNH CÔNG</h4>
                        </div>
                        <div className="wlx-matched-body">
                          <div className="wlx-matched-row">
                            <span>Kỹ thuật viên được ghép:</span>
                            <strong>{item.MatchedEmployeeName}</strong>
                          </div>
                          <div className="wlx-matched-row">
                            <span>Khung giờ:</span>
                            <strong>{timeText(item.MatchedStartTime)} - {timeText(item.MatchedEndTime)}</strong>
                          </div>
                          <div className="wlx-matched-row">
                            <span>Ngày hẹn:</span>
                            <strong>{dateText(item.MatchedDate)}</strong>
                          </div>
                          <div className="wlx-matched-row hold-timer-row">
                            <span>Thời gian giữ chỗ còn lại:</span>
                            <strong>
                              <HoldCountdown expiresAt={item.HoldExpiresAt} onTimeout={loadItems} />
                            </strong>
                          </div>
                        </div>
                        <div className="wlx-matched-actions">
                          <button
                            type="button"
                            className="confirm-btn"
                            onClick={() => handleConfirmMatch(item.WaitingId)}
                            disabled={saving}
                          >
                            Xác nhận & Thanh toán
                          </button>
                          <button
                            type="button"
                            className="reject-btn"
                            onClick={() => handleRejectMatch(item.WaitingId)}
                            disabled={saving}
                          >
                            Từ chối nhận slot
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="wlx-card-actions">
                      <button type="button" onClick={() => openDetail(item)}>
                        🔍 Chi tiết
                      </button>

                      {item.Status === "BOOKED" && item.ConvertedAppointmentId && (
                        <button
                          type="button"
                          className="wlx-btn-view-appt"
                          onClick={() => navigate(`/customer/appointments/${item.ConvertedAppointmentId}`)}
                        >
                          📅 Xem lịch hẹn
                        </button>
                      )}



                      {canCancel && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => setCancelTarget(item)}
                        >
                          ✕ Hủy
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {detail && (
          <div className="wlx-modal-backdrop" onClick={() => setDetail(null)}>
            <div className="wlx-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="wlx-modal-close"
                onClick={() => setDetail(null)}
              >
                ×
              </button>
              <h2>Chi tiết yêu cầu hàng chờ</h2>

              <div className="wlx-modal-head">
                <h3>{detail.ServiceName}</h3>
                <p>{detail.ServiceDescription || "Chưa có mô tả dịch vụ."}</p>
              </div>

              <div className="wlx-info-grid modal">
                <div>
                  <span>Trạng thái</span>
                  <b>{STATUS[detail.Status]?.label || detail.Status}</b>
                </div>
                <div>
                  <span>Mức ưu tiên</span>
                  <b>
                    {PRIORITY[detail.PriorityLevel]?.label || "Bình thường"}
                  </b>
                </div>
                <div>
                  <span>Vị trí</span>
                  <b>#{detail.WaitingPosition || 1}</b>
                </div>
                <div>
                  <span>Đã chờ</span>
                  <b>{waitedText(detail.WaitingMinutes)}</b>
                </div>
                <div>
                  <span>Ước tính xử lý</span>
                  <b>{detail.EstimatedResponseTime || "-"}</b>
                </div>
                <div>
                  <span>Ngày mong muốn</span>
                  <b>{dateText(detail.PreferredDate)}</b>
                </div>
                <div>
                  <span>Khung giờ</span>
                  <b>{timeRangeText(detail)}</b>
                </div>
                <div>
                  <span>Kỹ thuật viên</span>
                  <b>{detail.PreferredEmployeeName || "Không yêu cầu"}</b>
                </div>
                <div>
                  <span>Ghép KTV khác</span>
                  <b>{detail.AcceptOtherTechnician ? "Có" : "Không"}</b>
                </div>
                <div>
                  <span>Ghép giờ khác</span>
                  <b>{detail.AcceptOtherTimeSlots ? "Có" : "Không"}</b>
                </div>
                {detail.Status === "MATCHED" && (
                  <>
                    <div>
                      <span>KTV được ghép</span>
                      <b>{detail.MatchedEmployeeName || "-"}</b>
                    </div>
                    <div>
                      <span>Giờ được ghép</span>
                      <b>{timeText(detail.MatchedStartTime)} - {timeText(detail.MatchedEndTime)}</b>
                    </div>
                    <div>
                      <span>Ngày được ghép</span>
                      <b>{dateText(detail.MatchedDate)}</b>
                    </div>
                    <div>
                      <span>Giữ chỗ còn lại</span>
                      <b>
                        <HoldCountdown expiresAt={detail.HoldExpiresAt} />
                      </b>
                    </div>
                  </>
                )}
                {detail.Status === "BOOKED" && detail.ConvertedAppointmentId && (
                  <div>
                    <span>Lịch hẹn liên kết</span>
                    <b>
                      <a
                        href={`/customer/appointments/${detail.ConvertedAppointmentId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setDetail(null);
                          navigate(`/customer/appointments/${detail.ConvertedAppointmentId}`);
                        }}
                        style={{ color: "#db2777", textDecoration: "underline", fontWeight: "bold" }}
                      >
                        Xem lịch hẹn AP{String(detail.ConvertedAppointmentId).padStart(5, "0")} 📅
                      </a>
                    </b>
                  </div>
                )}
                <div>
                  <span>Chi nhánh</span>
                  <b>{detail.PreferredBranchName || "Bất kỳ"}</b>
                </div>
                 <div>
                  <span>Địa chỉ</span>
                  <b>{detail.PreferredBranchAddress || "-"}</b>
                  {detail.PreferredBranchAddress && (
                    <div style={{ marginTop: "8px", borderRadius: "10px", overflow: "hidden", border: "1px solid #ffe1ea", width: "100%" }}>
                      <iframe
                        title="Bản đồ chi nhánh hàng chờ detail"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(detail.PreferredBranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                        width="100%"
                        height="140"
                        style={{ border: 0, display: "block" }}
                        allowFullScreen=""
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <span>Liên hệ</span>
                  <b>{CONTACT[detail.ContactMethod] || "-"}</b>
                </div>
                <div>
                  <span>SĐT</span>
                  <b>{detail.ContactPhone || "-"}</b>
                </div>
                <div>
                  <span>Ngày tạo</span>
                  <b>{dateTimeText(detail.CreatedAt)}</b>
                </div>
                <div>
                  <span>Cập nhật</span>
                  <b>{dateTimeText(detail.UpdatedAt || detail.CreatedAt)}</b>
                </div>
                <div>
                  <span>Giá</span>
                  <b>{money(detail.Price)}</b>
                </div>
                <div>
                  <span>Thời lượng</span>
                  <b>{durationText(detail.DurationMinutes)}</b>
                </div>
              </div>

              {detail.Reason && (
                <div className="wlx-note modal">
                  <b>Lý do:</b> {detail.Reason}
                </div>
              )}
              {detail.Note && (
                <div className="wlx-note modal">
                  <b>Ghi chú:</b> {detail.Note}
                </div>
              )}
              {detail.CancelReason && (
                <div className="wlx-note modal">
                  <b>Lý do hủy:</b> {detail.CancelReason}
                </div>
              )}
            </div>
          </div>
        )}

        {cancelTarget && (
          <div
            className="wlx-modal-backdrop"
            onClick={() => setCancelTarget(null)}
          >
            <div
              className="wlx-cancel-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Hủy yêu cầu hàng chờ</h2>
              <p>
                Bạn muốn hủy yêu cầu cho dịch vụ{" "}
                <b>{cancelTarget.ServiceName}</b>?
              </p>

              <textarea
                rows="4"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy nếu có..."
              />

              <div className="wlx-actions">
                <button
                  type="button"
                  className="danger"
                  onClick={confirmCancel}
                >
                  Xác nhận hủy
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={() => setCancelTarget(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
