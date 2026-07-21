import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

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
  if (lower.includes("created walk-in appointment and checked in customer")) {
    return "Lễ tân tạo lịch hẹn trực tiếp và đã check-in cho khách.";
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

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.slice(0, 5);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("vi-VN");
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

export default function ReceptionistAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [availableTechnicians, setAvailableTechnicians] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [slots, setSlots] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [bankList, setBankList] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [techList, setTechList] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [showAssignTech, setShowAssignTech] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [techWorkload, setTechWorkload] = useState(null);

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
  const canCheckout = ["IN_PROGRESS", "COMPLETED"].includes(status) && !item?.CheckedOutAt;
  
  const canNoShow = ["CONFIRMED", "PENDING", "PENDING_PAYMENT"].includes(status);
  const canEdit = !["COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status);
  const canReschedule = !["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status) && !item?.CheckedInAt;

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

  const selectedRescheduleEmp = useMemo(() => {
    return employees.find((emp) => String(emp.EmployeeId) === String(rescheduleForm.technicianId));
  }, [employees, rescheduleForm.technicianId]);

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

  async function handleCompleteService() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await axiosClient.put(`/receptionist/appointments/${id}/complete`);
      const isPaid = item?.PaymentStatus === "PAID" || item?.CustomerPackageId;
      if (isPaid) {
        setSuccess("Đã hoàn thành dịch vụ & Checkout thành công!");
        await load();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setSuccess("Đã hoàn thành dịch vụ! Đang chuyển đến trang thanh toán...");
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          if (item?.InvoiceId) {
            navigate(`/receptionist/invoices/${item.InvoiceId}`);
          } else {
            navigate(`/receptionist/invoices`);
          }
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Thao tác thất bại");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout() {
    if (!window.confirm("Xác nhận khách hàng đã làm xong và check-out rời salon?")) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.post(`/receptionist/appointments/${id}/checkout`);
      await load();
      setSuccess("Check-out khách hàng rời salon thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Check-out thất bại");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvoice() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const res = await axiosClient.post(`/receptionist/appointments/${id}/create-invoice`);
      const newInvoice = res.data.data || res.data;
      setSuccess("Tạo hóa đơn thành công!");
      await load();
      if (newInvoice && newInvoice.InvoiceId) {
        navigate(`/receptionist/invoices/${newInvoice.InvoiceId}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Tạo hóa đơn thất bại");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function loadTechnicians() {
    try {
      setTechLoading(true);
      setError("");
      const serviceId = item?.ServiceId || item?.Services?.[0]?.ServiceId;
      const res = await axiosClient.get("/receptionist/available-technicians", {
        params: {
          serviceId,
          appointmentDate: item?.AppointmentDate ? String(item.AppointmentDate).slice(0, 10) : "",
          startTime: item?.StartTime ? String(item.StartTime).slice(0, 5) : "",
        }
      });
      setTechList(res.data.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được danh sách kỹ thuật viên rảnh");
    } finally {
      setTechLoading(false);
    }
  }

  useEffect(() => {
    async function checkWorkload() {
      if (!selectedTechId) {
        setTechWorkload(null);
        return;
      }
      try {
        const dateStr = item?.AppointmentDate ? String(item.AppointmentDate).slice(0, 10) : "";
        const res = await axiosClient.get(`/receptionist/technicians/${selectedTechId}/workload`, {
          params: { date: dateStr }
        });
        setTechWorkload(res.data.data || res.data);
      } catch (err) {
        console.error("Failed to load workload:", err);
      }
    }
    checkWorkload();
  }, [selectedTechId, item?.AppointmentDate]);

  async function submitAssignTech(e, overrideOverload = false) {
    if (e) e.preventDefault();
    if (!selectedTechId) {
      setError("Vui lòng chọn kỹ thuật viên");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.put(`/receptionist/appointments/${id}/assign-technician`, {
        technicianId: Number(selectedTechId),
        overrideOverload
      });

      await load();
      setShowAssignTech(false);
      setSelectedTechId("");
      setTechWorkload(null);
      setSuccess("Điều phối kỹ thuật viên phụ trách thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const errMsg = err.response?.data?.message || "";
      if (errMsg.includes("OVERLOAD_WARNING")) {
        if (window.confirm("Kỹ thuật viên này đã có nhiều ca làm việc hôm nay (Quá tải). Bạn có chắc chắn muốn tiếp tục phân công không?")) {
          submitAssignTech(null, true);
          return;
        }
      } else {
        setError(errMsg || "Điều phối kỹ thuật viên thất bại");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
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

    const hasPaid = paymentStatus === "PAID" && itemPaymentMethod !== "PACKAGE";

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
      setSaving(true);
      setError("");
      setSuccess("");

      await axiosClient.put(`/receptionist/appointments/${id}/cancel`, {
        reason: cancelReason.trim(),
        bankCode,
        accountNumber,
        accountName: accountName.trim().toUpperCase()
      });

      await load();
      setCancelReason("");
      setShowCancel(false);
      setSuccess(
        hasPaid
          ? "Đã hủy lịch hẹn và gửi yêu cầu hoàn tiền thành công!"
          : "Đã hủy lịch hẹn thành công!"
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function loadRescheduleData() {
    try {
      setError("");
      const res = await axiosClient.get(`/appointments/${id}/reschedule`);
      const data = res.data.data || res.data;
      setEmployees(data.AvailableEmployees || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được danh sách kỹ thuật viên");
    }
  }

  useEffect(() => {
    if (showReschedule) {
      loadRescheduleData();
    }
  }, [showReschedule, id]);

  useEffect(() => {
    async function loadSlots() {
      const serviceId = item?.ServiceId || item?.Services?.[0]?.ServiceId;
      if (
        !serviceId ||
        !rescheduleForm.appointmentDate ||
        !rescheduleForm.technicianId
      ) {
        setSlots([]);
        return;
      }

      try {
        setSlotLoading(true);
        setError("");

        const res = await axiosClient.get("/appointments/available-slots", {
          params: {
            appointmentDate: rescheduleForm.appointmentDate,
            employeeId: rescheduleForm.technicianId,
            serviceId: serviceId,
            excludeAppointmentId: id,
            includeAllSlots: true,
            includeAlternatives: true,
          },
        });

        const data = res.data.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setSlots(data.slots || []);
          setAlternatives(data.alternatives || []);
        } else {
          setSlots(data || []);
          setAlternatives([]);
        }
      } catch (err) {
        setSlots([]);
        setError(err.response?.data?.message || "Không tải được slot trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadSlots();
  }, [
    item?.ServiceId,
    item?.Services,
    rescheduleForm.appointmentDate,
    rescheduleForm.technicianId,
    id,
  ]);

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

      const res = await axiosClient.put(`/receptionist/appointments/${id}/reschedule`, {
        appointmentDate: rescheduleForm.appointmentDate,
        startTime: rescheduleForm.startTime,
        technicianId: Number(rescheduleForm.technicianId),
      });

      await load();
      setShowReschedule(false);
      setSuccess(res.data?.message || res.data?.data?.message || "Đã gửi đề xuất đổi lịch hẹn tới khách hàng để xác nhận!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    } finally {
      setSaving(false);
    }
  }

  const itemPaymentMethod = String(item?.PaymentMethod || "").toUpperCase();

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
                      {item.CustomerPackageId && item.CustomerPackageName && (
                        <div style={{
                          marginTop: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          border: '1px solid #e9d5ff',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          📦 Combo: {item.CustomerPackageName}
                        </div>
                      )}
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

                    {item.CheckedOutAt && (
                      <div>
                        <label>Thời gian Check-out rời salon</label>
                        <strong style={{ color: "#d91f68" }}>{formatDateTime(item.CheckedOutAt)}</strong>
                      </div>
                    )}

                    <div style={{ gridColumn: "span 2", borderTop: "1px dashed #eee", paddingTop: "12px", marginTop: "4px" }}>
                      <label>Chi nhánh phục vụ</label>
                      <strong style={{ color: "#85583f" }}>{item.BranchName || "Chi nhánh chính"}</strong>
                      {item.BranchAddress && (
                        <p style={{ color: "#7d837d", margin: "4px 0 8px", fontSize: "0.88rem" }}>
                          📍 Địa chỉ: {item.BranchAddress}
                        </p>
                      )}
                      {item.BranchAddress && (
                        <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid #f0f2f0", marginTop: "8px" }}>
                          <iframe
                            title="Bản đồ chi nhánh lễ tân"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(item.BranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                            width="100%"
                            height="160"
                            style={{ border: 0, display: "block" }}
                            allowFullScreen=""
                            loading="lazy"
                          />
                        </div>
                      )}
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
                            <p style={{ margin: "4px 0" }}>{formatReason(h.Reason)}</p>
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
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAssignTech(true);
                          loadTechnicians();
                        }}
                        style={{ background: "none", border: "none", color: "#d91f68", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ✏️ Điều phối
                      </button>
                    )}
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

                  {!item.InvoiceId && !["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(status) ? (
                    <button
                      className="ra-btn primary"
                      type="button"
                      onClick={handleCreateInvoice}
                      disabled={saving}
                      style={{ width: "100%", marginTop: "12px", cursor: "pointer", fontWeight: "bold" }}
                    >
                      🧾 Tạo hóa đơn mới
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
                    onClick={handleCompleteService}
                  >
                    {item?.PaymentStatus === "PAID" || item?.CustomerPackageId
                      ? "★ Hoàn thành & Checkout"
                      : "★ Hoàn thành & Thanh toán"}
                  </button>
                )}

                {canCheckout && item?.PaymentStatus !== "PAID" && (
                  <button
                    className="ra-btn primary"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (item?.InvoiceId) {
                        navigate(`/receptionist/invoices/${item.InvoiceId}`);
                      } else {
                        navigate(`/receptionist/invoices`);
                      }
                    }}
                    style={{ background: "#d91f68", color: "#fff", fontWeight: "bold" }}
                  >
                    💳 Đi tới thanh toán tính tiền
                  </button>
                )}

                {canReschedule && (
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
              <div className="ra-modal-backdrop" style={{ overflowY: "auto", padding: "20px 0" }}>
                <form className="ra-modal" onSubmit={submitCancel} style={{ maxWidth: "550px", width: "95%", margin: "auto" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "4px" }}>Xác nhận hủy lịch hẹn</h3>
                  <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "15px" }}>
                    Xác nhận hủy lịch hẹn cho khách hàng. Vui lòng kiểm tra loại dịch vụ để xử lý hoàn tiền/buổi học chính xác.
                  </p>

                  {/* Cảnh báo phân biệt loại dịch vụ */}
                  {itemPaymentMethod === "PACKAGE" ? (
                    <div style={{ padding: "12px", borderRadius: "8px", background: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", fontSize: "0.875rem", marginBottom: "15px", fontWeight: "bold" }}>
                      📦 DỊCH VỤ TRONG COMBO/LIỆU TRÌNH:<br />
                      Lịch này sử dụng gói combo. Sau khi hủy, hệ thống sẽ tự động hoàn trả lại 1 buổi sử dụng vào tài khoản Gói Combo của khách hàng.
                    </div>
                  ) : paymentStatus === "PAID" ? (
                    <div style={{ padding: "12px", borderRadius: "8px", background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", fontSize: "0.875rem", marginBottom: "15px", fontWeight: "bold" }}>
                      💳 DỊCH VỤ LẺ ĐÃ THANH TOÁN:<br />
                      Lịch này là dịch vụ lẻ đã thanh toán bằng tiền mặt/chuyển khoản. Sau khi hủy, hệ thống sẽ tạo yêu cầu hoàn tiền. Vui lòng điền thông tin tài khoản ngân hàng của khách hàng ở dưới.
                    </div>
                  ) : (
                    <div style={{ padding: "12px", borderRadius: "8px", background: "#f3f4f6", border: "1px solid #9ca3af", color: "#4b5563", fontSize: "0.875rem", marginBottom: "15px", fontWeight: "bold" }}>
                      ✏️ DỊCH VỤ LẺ CHƯA THANH TOÁN:<br />
                      Lịch hẹn này chưa thanh toán. Trạng thái lịch sẽ chuyển sang Đã hủy và không phát sinh yêu cầu hoàn tiền.
                    </div>
                  )}

                  {/* Thu thập thông tin ngân hàng nếu dịch vụ lẻ đã thanh toán */}
                  {paymentStatus === "PAID" && itemPaymentMethod !== "PACKAGE" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fafaf9", marginBottom: "15px" }}>
                      <h4 style={{ margin: "0 0 4px 0", color: "#85583f", fontSize: "0.9rem", fontWeight: "bold" }}>Tài khoản nhận hoàn tiền</h4>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "bold", color: "#4b5563", textAlign: "left" }}>Ngân hàng nhận:</label>
                        <select
                          style={{ height: "38px", padding: "0 8px", borderRadius: "6px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.85rem", background: "#fff" }}
                          value={bankCode}
                          onChange={(e) => setBankCode(e.target.value)}
                          required
                        >
                          <option value="">-- Chọn ngân hàng --</option>
                          {bankList.map((b) => (
                            <option key={b.bin} value={b.bin}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "bold", color: "#4b5563", textAlign: "left" }}>Số tài khoản:</label>
                        <input
                          type="text"
                          placeholder="Nhập số tài khoản khách..."
                          style={{ height: "38px", padding: "0 8px", borderRadius: "6px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.85rem" }}
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
                          required
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "bold", color: "#4b5563", textAlign: "left" }}>Tên chủ tài khoản (viết hoa không dấu):</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: NGUYEN VAN A"
                          style={{ height: "38px", padding: "0 8px", borderRadius: "6px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.85rem" }}
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#374151", display: "block", marginBottom: "6px", textAlign: "left" }}>Lý do hủy lịch</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do khách hàng muốn hủy lịch..."
                    required
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", marginBottom: "15px", outline: "none", minHeight: "80px", resize: "vertical", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />

                  <div className="ra-modal-actions" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <button
                      className="ra-btn danger"
                      type="submit"
                      disabled={saving}
                      style={{ background: "#d32232", color: "#fff" }}
                    >
                      {saving ? "Đang xử lý..." : "Xác nhận hủy lịch"}
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
              <div className="ra-modal-backdrop" style={{ overflowY: "auto", padding: "20px 0" }}>
                <form className="ra-modal wide" onSubmit={submitReschedule} style={{ maxWidth: "800px", width: "95%", margin: "auto" }}>
                  <style>{`
                    .rx-reschedule-step {
                      margin-bottom: 24px;
                      border-bottom: 1px solid #f3f4f6;
                      padding-bottom: 20px;
                    }
                    .rx-reschedule-step:last-of-type {
                      border-bottom: none;
                      padding-bottom: 0;
                    }
                    .rx-reschedule-step-title {
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      margin-bottom: 12px;
                    }
                    .rx-reschedule-step-num {
                      background: #85583f;
                      color: #fff;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.8rem;
                      font-weight: bold;
                    }
                    .rx-reschedule-step-text {
                      font-size: 1rem;
                      font-weight: bold;
                      color: #111827;
                    }
                    .rx-reschedule-employee-grid {
                      display: grid;
                      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                      gap: 12px;
                      margin-top: 10px;
                    }
                    .rx-reschedule-employee-card {
                      display: flex;
                      gap: 12px;
                      align-items: center;
                      padding: 12px;
                      border-radius: 12px;
                      border: 1.5px solid #e5e7eb;
                      background: #fff;
                      text-align: left;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      width: 100%;
                    }
                    .rx-reschedule-employee-card:hover {
                      border-color: #c5ac6b;
                      background: #faf6ee;
                    }
                    .rx-reschedule-employee-card.active {
                      border-color: #92733a;
                      background: #f5edd6;
                      box-shadow: 0 0 0 2px #e6d7b8;
                    }
                    .rx-reschedule-employee-card img {
                      width: 48px;
                      height: 48px;
                      border-radius: 50%;
                      object-fit: cover;
                    }
                    .rx-reschedule-employee-card b {
                      display: block;
                      color: #1f2937;
                      font-size: 0.95rem;
                    }
                    .rx-reschedule-employee-card span {
                      display: block;
                      font-size: 0.8rem;
                      color: #4b5563;
                    }
                    .rx-reschedule-employee-card small {
                      display: block;
                      font-size: 0.75rem;
                      color: #6b7280;
                    }
                    .rx-reschedule-slot-grid {
                      display: grid;
                      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                      gap: 8px;
                      margin-top: 10px;
                    }
                    .rx-reschedule-slot-btn {
                      padding: 10px;
                      border-radius: 8px;
                      border: 1.5px solid #e5e7eb;
                      background: #fff;
                      text-align: center;
                      cursor: pointer;
                      font-size: 0.85rem;
                      transition: all 0.2s ease;
                    }
                    .rx-reschedule-slot-btn:hover:not(:disabled) {
                      border-color: #c5ac6b;
                      background: #faf6ee;
                    }
                    .rx-reschedule-slot-btn.active {
                      border-color: #92733a;
                      background: #92733a;
                      color: #fff;
                      font-weight: bold;
                    }
                    .rx-reschedule-slot-btn:disabled {
                      background: #f3f4f6;
                      color: #9ca3af;
                      cursor: not-allowed;
                      border-color: #e5e7eb;
                    }
                    .rx-reschedule-slot-empty {
                      padding: 20px;
                      text-align: center;
                      background: #f9fafb;
                      border-radius: 8px;
                      color: #6b7280;
                      font-size: 0.9rem;
                    }
                    /* Override pink primary button locally inside this modal */
                    .ra-modal .ra-btn.primary {
                      background: linear-gradient(135deg, #85583f, #66412c) !important;
                      box-shadow: 0 8px 16px rgba(102, 65, 44, 0.2) !important;
                      color: #fff !important;
                    }
                    .ra-modal .ra-btn.primary:hover:not(:disabled) {
                      background: linear-gradient(135deg, #754b34, #573623) !important;
                      transform: translateY(-2px) !important;
                    }
                  `}</style>
                  
                  <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "4px" }}>Đổi lịch / đổi chuyên viên</h3>
                  <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "20px" }}>
                    Cập nhật thời gian hẹn mới và phân công kỹ thuật viên cho lịch hẹn này.
                  </p>

                  {/* BƯỚC 1: CHỌN NGÀY */}
                  <div className="rx-reschedule-step">
                    <div className="rx-reschedule-step-title">
                      <div className="rx-reschedule-step-num">1</div>
                      <div className="rx-reschedule-step-text">Chọn ngày hẹn mới</div>
                    </div>
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={rescheduleForm.appointmentDate}
                      onChange={(e) =>
                        setRescheduleForm((p) => ({
                          ...p,
                          appointmentDate: e.target.value,
                          startTime: "", // Reset start time when date changes
                        }))
                      }
                      style={{ width: "100%", maxWidth: "300px", height: "42px", padding: "0 12px", borderRadius: "8px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.95rem" }}
                    />
                  </div>

                  {/* BƯỚC 2: CHỌN KỸ THUẬT VIÊN */}
                  <div className="rx-reschedule-step">
                    <div className="rx-reschedule-step-title">
                      <div className="rx-reschedule-step-num">2</div>
                      <div className="rx-reschedule-step-text">Chọn kỹ thuật viên ({employees.length} người phù hợp)</div>
                    </div>
                    {employees.length === 0 ? (
                      <div style={{ color: "#6b7280", fontSize: "0.9rem", padding: "10px 0" }}>
                        Không có kỹ thuật viên nào khả dụng hoặc chưa chọn ngày.
                      </div>
                    ) : (
                      <div className="rx-reschedule-employee-grid">
                        {employees.map((emp) => (
                          <button
                            type="button"
                            key={emp.EmployeeId}
                            className={`rx-reschedule-employee-card ${
                              String(rescheduleForm.technicianId) === String(emp.EmployeeId) ? "active" : ""
                            }`}
                            onClick={() =>
                              setRescheduleForm((p) => ({
                                ...p,
                                technicianId: String(emp.EmployeeId),
                                startTime: "", // Reset start time when technician changes
                              }))
                            }
                          >
                            <img
                              src={resolveFileUrl(emp.ImageUrl) || DEFAULT_AVATAR}
                              alt={emp.EmployeeName}
                            />
                            <div>
                              <b>{emp.EmployeeName}</b>
                              <span>{emp.Specialization || emp.Position || "Kỹ thuật viên"}</span>
                              <small>⭐ {Number(emp.AverageRating || 0).toFixed(1)} · {emp.ReviewCount || 0} đánh giá</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedRescheduleEmp && (
                      <div style={{ marginTop: "12px", background: "#fdfbf7", border: "1px solid #f5ebd6", padding: "12px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "0.85rem", color: "#85583f", fontWeight: "bold" }}>
                          Chi nhánh hoạt động của chuyên viên: {selectedRescheduleEmp.BranchName || "Chi nhánh chính"}
                        </span>
                        {selectedRescheduleEmp.BranchAddress && (
                          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                            📍 Địa chỉ: {selectedRescheduleEmp.BranchAddress}
                          </span>
                        )}
                        {selectedRescheduleEmp.BranchAddress && (
                          <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e7eb", marginTop: "6px" }}>
                            <iframe
                              title="Bản đồ chuyên viên đổi lịch"
                              src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedRescheduleEmp.BranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                              width="100%"
                              height="120"
                              style={{ border: 0, display: "block" }}
                              allowFullScreen=""
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BƯỚC 3: CHỌN SLOT TRỐNG */}
                  <div className="rx-reschedule-step">
                    <div className="rx-reschedule-step-title">
                      <div className="rx-reschedule-step-num">3</div>
                      <div className="rx-reschedule-step-text">
                        Chọn khung giờ trống {slotLoading && <span style={{ fontSize: "0.85rem", color: "#6b7280", marginLeft: "10px", fontWeight: "normal" }}>Đang tải...</span>}
                      </div>
                    </div>

                    {!rescheduleForm.appointmentDate || !rescheduleForm.technicianId ? (
                      <div className="rx-reschedule-slot-empty">
                        Vui lòng chọn ngày hẹn và kỹ thuật viên trước để xem các khung giờ trống.
                      </div>
                    ) : slotLoading ? (
                      <div className="rx-reschedule-slot-empty">Đang tìm kiếm khung giờ trống...</div>
                    ) : slots.length === 0 ? (
                      <div className="rx-reschedule-slot-empty">
                        Không tìm thấy khung giờ nào trống cho kỹ thuật viên này vào ngày đã chọn.
                      </div>
                    ) : (
                      <div className="rx-reschedule-slot-grid">
                        {slots.map((slot) => {
                          const isAvailable = slot.available !== false;
                          const formattedStart = formatTime(slot.startTime);
                          const isActive = formatTime(rescheduleForm.startTime) === formattedStart;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              disabled={!isAvailable}
                              className={`rx-reschedule-slot-btn ${isActive ? "active" : ""}`}
                              onClick={() => {
                                if (isAvailable) {
                                  setRescheduleForm((p) => ({
                                    ...p,
                                    startTime: slot.startTime,
                                  }));
                                }
                              }}
                            >
                              <strong style={{ display: "block" }}>{formattedStart}</strong>
                              <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.8 }}>
                                {formatTime(slot.endTime)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* MODAL ACTIONS */}
                  <div className="ra-modal-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving || !rescheduleForm.appointmentDate || !rescheduleForm.startTime || !rescheduleForm.technicianId}
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

            {showAssignTech && (
              <div className="ra-modal-backdrop" style={{ overflowY: "auto", padding: "20px 0" }}>
                <form className="ra-modal" onSubmit={(e) => submitAssignTech(e, false)} style={{ maxWidth: "550px", width: "95%", margin: "auto" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "4px" }}>Điều phối Kỹ thuật viên</h3>
                  <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "15px" }}>
                    Chọn kỹ thuật viên rảnh phù hợp cho dịch vụ này. Hệ thống sẽ tự động phát hiện tình trạng lịch nghỉ phép hoặc quá tải.
                  </p>

                  {techLoading ? (
                    <div style={{ padding: "20px 0", textAlign: "center", color: "#6b7280" }}>
                      ⏳ Đang quét danh sách kỹ thuật viên rảnh...
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                      <select
                        style={{ height: "40px", padding: "0 10px", borderRadius: "8px", border: "1px solid #d1d5db", outline: "none", fontSize: "0.9rem", width: "100%" }}
                        value={selectedTechId}
                        onChange={(e) => setSelectedTechId(e.target.value)}
                        required
                      >
                        <option value="">-- Chọn kỹ thuật viên --</option>
                        {techList.map((t) => (
                          <option key={t.EmployeeId} value={t.EmployeeId}>
                            {t.TechnicianName || t.FullName} ({t.Position || "Kỹ thuật viên"})
                          </option>
                        ))}
                      </select>

                      {techWorkload && (
                        <div style={{
                          padding: "12px",
                          borderRadius: "8px",
                          background: techWorkload.isOverloaded || techWorkload.isConsecutiveOverloaded ? "#fef3c7" : "#ecfdf5",
                          border: techWorkload.isOverloaded || techWorkload.isConsecutiveOverloaded ? "1px solid #f59e0b" : "1px solid #10b981",
                          color: techWorkload.isOverloaded || techWorkload.isConsecutiveOverloaded ? "#b45309" : "#065f46",
                          fontSize: "0.875rem",
                          textAlign: "left"
                        }}>
                          <strong>📊 Tải trọng công việc hôm nay:</strong>
                          <ul style={{ margin: "5px 0 0 15px", padding: 0 }}>
                            <li>Tổng số ca hẹn đã gán: <strong>{techWorkload.totalAppointments} ca</strong></li>
                            {techWorkload.isOverloaded && (
                              <li style={{ color: "#ef4444", fontWeight: "bold" }}>⚠️ Cảnh báo: Kỹ thuật viên quá tải ca (&gt;= 5 ca/ngày)</li>
                            )}
                            {techWorkload.isConsecutiveOverloaded && (
                              <li style={{ color: "#ef4444", fontWeight: "bold" }}>⚠️ Cảnh báo: Có &gt;= 3 ca làm việc liên tiếp không nghỉ</li>
                            )}
                            {!techWorkload.isOverloaded && !techWorkload.isConsecutiveOverloaded && (
                              <li>Tải trọng công việc: Bình thường (Hợp lý)</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ra-modal-actions" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                    <button
                      className="ra-btn primary"
                      type="submit"
                      disabled={saving || techLoading}
                      style={{ background: "#d91f68", color: "#fff" }}
                    >
                      {saving ? "Đang xử lý..." : "Xác nhận điều phối"}
                    </button>
                    <button
                      className="ra-btn light"
                      type="button"
                      onClick={() => {
                        setShowAssignTech(false);
                        setSelectedTechId("");
                        setTechWorkload(null);
                      }}
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
