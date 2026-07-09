import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/customer.css";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function ReceptionistCreateAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWalkIn = searchParams.get("walkin") === "1";
  const todayText = new Date().toISOString().slice(0, 10);

  // Customer search states
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Booking states
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [bookingType, setBookingType] = useState("SERVICE");

  const [myPackages, setMyPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [packageServices, setPackageServices] = useState([]);
  const [packageDetailLoading, setPackageDetailLoading] = useState(false);

  const [availableSlots, setAvailableSlots] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState("");
  const [showSmartSection, setShowSmartSection] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [employeeKeyword, setEmployeeKeyword] = useState("");

  const [form, setForm] = useState({
    serviceId: "",
    employeeId: "",
    appointmentDate: "",
    startTime: "",
    notes: isWalkIn ? "Walk-in customer - check-in tại quầy" : "",
    customerPackageId: "",
  });

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherId, setVoucherId] = useState(null);

  const [myVouchers, setMyVouchers] = useState([]);
  const [showVoucherList, setShowVoucherList] = useState(false);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [membership, setMembership] = useState(null);

  // Fetch initial services & branches list
  useEffect(() => {
    async function loadInitialData() {
      try {
        setPageLoading(true);
        const [servicesRes, branchesRes] = await Promise.all([
          axiosClient.get("/receptionist/services"),
          axiosClient.get("/employees/branches").catch(() => ({ data: { data: [] } })),
        ]);
        setServices(servicesRes.data.data || servicesRes.data || []);
        setBranches(branchesRes.data.data || branchesRes.data || []);
      } catch (err) {
        setError("Không tải được danh sách dữ liệu ban đầu");
      } finally {
        setPageLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Fetch customer details, packages, vouchers upon selection
  useEffect(() => {
    if (!selectedCustomer) {
      setMyPackages([]);
      setMyVouchers([]);
      setMembership(null);
      return;
    }

    async function loadCustomerBookingData() {
      try {
        setError("");
        const [pkgRes, voucherRes, detailsRes] = await Promise.all([
          axiosClient.get("/packages/my", { params: { customerId: selectedCustomer.CustomerId } }).catch(() => ({ data: { data: [] } })),
          axiosClient.get("/vouchers/my", { params: { customerId: selectedCustomer.CustomerId } }).catch(() => ({ data: { data: [] } })),
          axiosClient.get(`/receptionist/customers/${selectedCustomer.CustomerId}`).catch(() => ({ data: { data: null } })),
        ]);

        const pkgs = pkgRes.data.data || pkgRes.data || [];
        const activePkgs = pkgs.filter(
          (p) => p.Status === "ACTIVE" && Number(p.RemainingSessions || 0) > 0,
        );
        setMyPackages(activePkgs);

        const vouchers = voucherRes.data.data || voucherRes.data || [];
        const usableVouchers = vouchers.filter((v) => {
          const notUsed = !v.UsedStatus && Number(v.UseCount || 0) < 3;
          const active = v.Status === "ACTIVE";
          const notExpired = !v.EndDate || new Date(v.EndDate) >= new Date();
          return notUsed && active && notExpired;
        });
        setMyVouchers(usableVouchers);

        const details = detailsRes.data?.data;
        if (details) {
          setMembership({
            LevelName: details.MembershipName || "Bronze",
            DiscountPercent: Number(details.DiscountPercent || 0),
          });
        }
      } catch (err) {
        setError("Không tải được dữ liệu combo/voucher của khách hàng");
      }
    }

    loadCustomerBookingData();
  }, [selectedCustomer]);

  // Customer search autocomplete
  useEffect(() => {
    if (!customerKeyword.trim()) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setCustomerLoading(true);
      axiosClient
        .get("/receptionist/customers/search", {
          params: { keyword: customerKeyword },
        })
        .then((res) => setCustomerResults(res.data.data || res.data || []))
        .catch(() => setError("Không tìm kiếm được khách hàng"))
        .finally(() => setCustomerLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [customerKeyword]);

  // Fetch employees by service
  useEffect(() => {
    async function loadEmployeesByService() {
      if (!form.serviceId) {
        setEmployees([]);
        return;
      }

      try {
        setEmployeeLoading(true);
        const res = await axiosClient.get(`/employees/by-service/${form.serviceId}`);
        setEmployees(res.data.data || []);
      } catch {
        setEmployees([]);
        setError("Không tải được kỹ thuật viên theo dịch vụ");
      } finally {
        setEmployeeLoading(false);
      }
    }

    loadEmployeesByService();
  }, [form.serviceId]);

  // Fetch available slots
  useEffect(() => {
    async function loadAvailableSlots() {
      if (!form.serviceId || !form.employeeId || !form.appointmentDate) {
        setAvailableSlots([]);
        setAlternatives([]);
        return;
      }

      try {
        setSlotLoading(true);
        const res = await axiosClient.get("/appointments/available-slots", {
          params: {
            serviceId: form.serviceId,
            employeeId: form.employeeId,
            appointmentDate: form.appointmentDate,
            includeAlternatives: true,
            includeAllSlots: true,
          },
        });

        const data = res.data.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setAvailableSlots(data.slots || []);
          setAlternatives(data.alternatives || []);
        } else {
          setAvailableSlots(data || []);
          setAlternatives([]);
        }
      } catch (err) {
        setAvailableSlots([]);
        setAlternatives([]);
        setError(err.response?.data?.message || "Không tải được giờ trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadAvailableSlots();
  }, [form.serviceId, form.employeeId, form.appointmentDate]);

  const categories = useMemo(() => {
    return [
      "ALL",
      ...new Set(services.map((s) => s.CategoryName).filter(Boolean)),
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const text = keyword.toLowerCase();
      const matchKeyword =
        String(s.ServiceName || "").toLowerCase().includes(text) ||
        String(s.Description || "").toLowerCase().includes(text);
      const matchCategory = categoryFilter === "ALL" || s.CategoryName === categoryFilter;
      return matchKeyword && matchCategory;
    });
  }, [services, keyword, categoryFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchBranch = !selectedBranchId || String(e.BranchId) === String(selectedBranchId);
      const text = employeeKeyword.toLowerCase();
      const matchText = (
        String(e.FullName || "").toLowerCase().includes(text) ||
        String(e.Specialization || "").toLowerCase().includes(text) ||
        String(e.Position || "").toLowerCase().includes(text)
      );
      return matchBranch && matchText;
    });
  }, [employees, employeeKeyword, selectedBranchId]);

  const selectedService = useMemo(() => {
    return services.find((s) => String(s.ServiceId) === String(form.serviceId));
  }, [services, form.serviceId]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => String(e.EmployeeId) === String(form.employeeId));
  }, [employees, form.employeeId]);

  const totalPrice = form.customerPackageId ? 0 : Number(selectedService?.Price || 0);

  const availableVouchers = useMemo(() => {
    if (!selectedService) return [];
    
    const serviceName = String(selectedService.ServiceName || "").toLowerCase();
    
    return myVouchers.filter((voucher) => {
      const used = Boolean(voucher.UsedStatus || voucher.usedStatus);
      const useCount = Number(voucher.UseCount || 0);
      if (used || useCount >= 1) return false;

      const status = String(voucher.Status || voucher.status || "ACTIVE").toUpperCase();
      if (status !== "ACTIVE") return false;

      if (voucher.EndDate && new Date(voucher.EndDate) < new Date()) return false;

      const minOrder = Number(voucher.MinOrderAmount || voucher.minOrderAmount || 0);
      if (minOrder > 0 && totalPrice < minOrder) return false;

      const code = String(voucher.Code || "").toUpperCase();
      if (code.startsWith("FREEPH") && serviceName !== "phục hồi tóc hư tổn") {
        return false;
      }
      if (code.startsWith("FREEMS") && serviceName !== "massage cổ vai gáy") {
        return false;
      }

      return true;
    });
  }, [myVouchers, selectedService, totalPrice]);

  const calc = useMemo(() => {
    const membershipPercent = Number(membership?.DiscountPercent || 0);
    const membershipDiscount = Math.round((totalPrice * membershipPercent) / 100);
    const afterMembership = Math.max(totalPrice - membershipDiscount, 0);
    const voucherDiscountAmount = Math.min(voucherDiscount, afterMembership);
    const finalPrice = Math.max(afterMembership - voucherDiscountAmount, 0);

    return {
      membershipDiscount,
      voucherDiscount: voucherDiscountAmount,
      finalPrice,
    };
  }, [totalPrice, membership, voucherDiscount]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatTime(value) {
    if (!value) return "";
    const str = String(value);
    if (str.includes("T")) {
      const parts = str.split("T")[1];
      if (parts) return parts.slice(0, 5);
    }
    return str.slice(0, 5);
  }

  function getVoucherText(voucher) {
    if (!voucher) return "";
    const type = String(voucher.DiscountType || "").toUpperCase();
    if (type === "PERCENT") {
      return `Giảm ${Number(voucher.DiscountValue || 0)}%`;
    }
    return `Giảm ${formatMoney(voucher.DiscountValue || 0)}`;
  }

  function resetAfterServiceChange(nextForm) {
    setForm(nextForm);
    setEmployees([]);
    setVoucherDiscount(0);
    setVoucherCode("");
    setVoucherId(null);
    setAvailableSlots([]);
    setAlternatives([]);
    setSelectedBranchId("");
  }

  function chooseCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerKeyword(customer.FullName || "");
    setCustomerResults([]);
  }

  async function fetchSmartSuggestions() {
    if (!form.serviceId) {
      alert("Vui lòng chọn dịch vụ trước!");
      return;
    }
    if (!selectedBranchId) {
      alert("Vui lòng chọn chi nhánh trước!");
      return;
    }
    if (!form.appointmentDate) {
      alert("Vui lòng chọn ngày hẹn trước!");
      return;
    }

    try {
      setSmartLoading(true);
      setSmartError("");
      setShowSmartSection(true);
      const res = await axiosClient.get("/receptionist/smart-booking-suggestions", {
        params: {
          customerId: selectedCustomer?.CustomerId || null,
          serviceId: form.serviceId,
          branchId: selectedBranchId,
          appointmentDate: form.appointmentDate,
          preferredStartTime: form.startTime || null
        }
      });
      setSmartSuggestions(res.data.data || []);
    } catch (err) {
      setSmartError(err.response?.data?.message || "Không thể lấy đề xuất thông minh");
      setSmartSuggestions([]);
    } finally {
      setSmartLoading(false);
    }
  }

  function chooseService(serviceId) {
    resetAfterServiceChange({
      ...form,
      serviceId,
      customerPackageId: "",
      employeeId: "",
      startTime: "",
    });
    setStep(2);
  }

  async function selectPackage(pkg) {
    setSelectedPackageId(pkg.CustomerPackageId);
    setPackageDetailLoading(true);
    setError("");

    try {
      const res = await axiosClient.get(`/packages/my/${pkg.CustomerPackageId}/detail`, {
        params: { customerId: selectedCustomer.CustomerId }
      });
      const data = res.data.data || res.data;
      setPackageServices(data.Services || []);
    } catch {
      setPackageServices([]);
      setError("Không tải được dịch vụ trong combo");
    } finally {
      setPackageDetailLoading(false);
    }
  }

  function choosePackageService(customerPackageId, serviceId) {
    resetAfterServiceChange({
      ...form,
      serviceId,
      customerPackageId,
      employeeId: "",
      startTime: "",
    });
    setStep(2);
  }

  function chooseEmployee(employeeId) {
    setForm({
      ...form,
      employeeId,
      startTime: "",
    });
    setAvailableSlots([]);
    setAlternatives([]);
    setStep(4);
  }

  function chooseTime(time) {
    setForm({ ...form, startTime: time });
    setStep(5);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "appointmentDate") {
      setForm({
        ...form,
        appointmentDate: value,
        startTime: "",
      });
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  }

  async function applyVoucher() {
    setError("");
    setMessage("");

    if (!selectedService) {
      setError("Vui lòng chọn dịch vụ trước khi áp dụng voucher");
      return;
    }

    const code = voucherCode.trim();
    if (!code) {
      setError("Vui lòng nhập mã voucher");
      return;
    }

    try {
      const res = await axiosClient.post("/vouchers/validate", {
        code,
        totalAmount: totalPrice,
        customerId: selectedCustomer.CustomerId,
        serviceId: selectedService?.ServiceId || selectedService?.serviceId,
      });

      const data = res.data.data;
      setVoucherDiscount(Number(data.discountAmount || 0));
      setVoucherId(data.VoucherId || data.voucherId || null);
      setMessage(`Đã áp dụng voucher ${data.Code || code}`);
    } catch (err) {
      setVoucherDiscount(0);
      setVoucherId(null);
      setError(err.response?.data?.message || "Mã voucher không hợp lệ");
    }
  }

  async function chooseVoucher(voucher) {
    setVoucherCode(voucher.Code || "");
    setShowVoucherList(false);
    setError("");
    setMessage("");

    if (!selectedService) {
      setError("Vui lòng chọn dịch vụ trước khi áp dụng voucher");
      return;
    }

    try {
      const res = await axiosClient.post("/vouchers/validate", {
        code: voucher.Code,
        totalAmount: totalPrice,
        customerId: selectedCustomer.CustomerId,
        serviceId: selectedService?.ServiceId || selectedService?.serviceId,
      });

      const data = res.data.data;
      setVoucherDiscount(Number(data.discountAmount || 0));
      setVoucherId(data.VoucherId || data.voucherId || voucher.VoucherId);
      setMessage(`Đã áp dụng voucher ${data.Code || voucher.Code}`);
    } catch (err) {
      setVoucherDiscount(0);
      setVoucherId(null);
      setError(err.response?.data?.message || "Voucher không hợp lệ");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const now = new Date();
    let today = now.toISOString().split("T")[0];
    if (now.getHours() >= 21) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      today = tomorrow.toISOString().split("T")[0];
    }

    setMessage("");
    setError("");

    if (!selectedCustomer) return setError("Vui lòng chọn khách hàng");
    if (!form.serviceId) return setError("Vui lòng chọn dịch vụ");
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.appointmentDate) return setError("Vui lòng chọn ngày hẹn");
    if (form.appointmentDate < today) {
      if (now.getHours() >= 21 && form.appointmentDate === now.toISOString().split("T")[0]) {
        return setError("Thời gian hoạt động trong ngày đã kết thúc. Vui lòng chọn ngày khác.");
      }
      return setError("Không được đặt lịch trong quá khứ");
    }
    if (!form.startTime) return setError("Vui lòng chọn giờ hẹn");

    const isValidSlot = availableSlots.some(
      (slot) =>
        String(slot.startTime).slice(0, 5) === String(form.startTime).slice(0, 5) &&
        slot.available !== false,
    );

    if (!isValidSlot) {
      return setError("Vui lòng chọn giờ từ danh sách giờ trống");
    }

    try {
      setLoading(true);

      const endpoint = isWalkIn ? "/receptionist/walk-ins" : "/receptionist/appointments";
      const payload = {
        customerId: Number(selectedCustomer.CustomerId),
        serviceId: Number(form.serviceId),
        technicianId: Number(form.employeeId),
        appointmentDate: form.appointmentDate,
        startTime: form.startTime.length === 5 ? `${form.startTime}:00` : form.startTime,
        note: form.notes,
        customerPackageId: form.customerPackageId ? Number(form.customerPackageId) : null,
        isWalkIn,
      };

      const appointmentRes = await axiosClient.post(endpoint, payload);
      const appointment = appointmentRes.data.data || appointmentRes.data;
      const newAppointmentId = appointment.AppointmentId || appointment.id;

      if (voucherId) {
        try {
          await axiosClient.post(`/payments/appointment/${newAppointmentId}/apply-voucher`, {
            voucherId: voucherId,
            rewardPoints: 0,
            customerId: Number(selectedCustomer.CustomerId)
          });
        } catch (voucherErr) {
          console.error("Failed to apply voucher to booking invoice:", voucherErr);
        }
      }

      navigate(`/receptionist/appointments/${newAppointmentId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Đặt lịch thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="customer-booking-page rx-booking-wrapper" style={{ padding: "0 20px" }}>
        
        {/* Header Hero */}
        <div className="booking-hero" style={{ margin: "20px 0" }}>
          <div>
            <div className="eyebrow" style={{ color: "#d4a94f" }}>Receptionist Booking Support</div>
            <h1>{isWalkIn ? "Hỗ trợ khách vãng lai (Walk-in)" : "Hỗ trợ đặt lịch hẹn"}</h1>
            <p>Quy trình đặt lịch của lễ tân tương thích 100% với giao diện và quy định của khách hàng.</p>
          </div>
        </div>

        {/* STEP 0: SELECT CUSTOMER */}
        {!selectedCustomer ? (
          <section className="booking-main-card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", marginBottom: 8 }}>
              Chọn khách hàng cần hỗ trợ
            </h2>
            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: 20 }}>
              Tìm kiếm khách hàng bằng tên, số điện thoại hoặc địa chỉ email.
            </p>

            <div className="booking-toolbar" style={{ marginBottom: 20 }}>
              <input
                className="booking-input"
                value={customerKeyword}
                onChange={(e) => setCustomerKeyword(e.target.value)}
                placeholder="Nhập tên / SĐT / email khách hàng..."
                style={{ width: "100%" }}
              />
            </div>

            {customerLoading && <p>Đang tìm kiếm khách hàng...</p>}

            {customerResults.length > 0 && (
              <div className="booking-service-grid" style={{ gridTemplateColumns: "1fr" }}>
                {customerResults.map((c) => (
                  <button
                    key={c.CustomerId}
                    type="button"
                    className="booking-service-card"
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", width: "100%", textAlign: "left" }}
                    onClick={() => chooseCustomer(c)}
                  >
                    <img
                      src={avatarUrl(c.AvatarUrl)}
                      alt={c.FullName}
                      style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    />
                    <div>
                      <h3 style={{ margin: 0 }}>{c.FullName}</h3>
                      <p style={{ margin: "2px 0 0", color: "#666", fontSize: "0.85rem" }}>
                        {c.Phone || "Không có SĐT"} • {c.Email || "Không có Email"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!customerLoading && customerResults.length === 0 && customerKeyword && (
              <p className="booking-empty">Không tìm thấy khách hàng nào khớp.</p>
            )}
          </section>
        ) : (
          <>
            {/* Customer Selected Header Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(184, 154, 94, 0.15)', marginBottom: 24 }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Khách hàng được hỗ trợ đặt lịch</span>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontFamily: 'Georgia, serif', color: '#17201d' }}>{selectedCustomer.FullName} ({selectedCustomer.Phone || 'N/A'})</h2>
              </div>
              <button type="button" className="booking-tab" style={{ height: 38, padding: "0 16px", borderRadius: 8, fontSize: "0.85rem", border: "1px solid #c5ac6b", cursor: "pointer", background: "none" }} onClick={() => {
                setSelectedCustomer(null);
                setForm({
                  serviceId: "",
                  employeeId: "",
                  appointmentDate: "",
                  startTime: "",
                  notes: isWalkIn ? "Walk-in customer - check-in tại quầy" : "",
                  customerPackageId: "",
                });
                setStep(1);
              }}>
                Chọn khách hàng khác
              </button>
            </div>

            {/* Standard Steps Progress */}
            <div className="booking-steps">
              {[
                ["1", "Chọn dịch vụ", "Dịch vụ bạn muốn"],
                ["2", "Chọn chi nhánh", "Địa điểm thực hiện"],
                ["3", "Kỹ thuật viên", "Người thực hiện"],
                ["4", "Thời gian", "Ngày và giờ hẹn"],
                ["5", "Xác nhận", "Kiểm tra thông tin"],
              ].map((item, index) => (
                <div
                  key={item[0]}
                  className={`booking-step ${step >= index + 1 ? "active" : ""}`}
                >
                  <span>{item[0]}</span>
                  <div>
                    <strong>{item[1]}</strong>
                    <p>{item[2]}</p>
                  </div>
                </div>
              ))}
            </div>

            {message && <div className="alert success">{message}</div>}
            {error && <div className="alert error">{error}</div>}

             {/* Main Booking Wizard Layout */}
            <form onSubmit={handleSubmit} className="booking-layout">
              <main className="booking-main-card">

                {/* Smart Booking Suggestion Panel */}
                <div className="booking-section" style={{
                  background: "linear-gradient(135deg, #1b3d2f 0%, #11261d 100%)",
                  color: "#ffffff",
                  padding: "20px",
                  borderRadius: "16px",
                  marginBottom: "24px",
                  boxShadow: "0 10px 25px rgba(27, 61, 47, 0.15)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#c5ac6b", display: "flex", alignItems: "center", gap: 6 }}>
                        ⚡ Đề xuất lịch thông minh (Smart Booking)
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#a9bcae" }}>
                        Tự động tìm kiếm, xếp hạng KTV và khung giờ làm việc tối ưu nhất dựa trên dữ liệu.
                      </p>
                      {(!form.serviceId || !selectedBranchId || !form.appointmentDate) && (
                        <small style={{ display: "block", color: "#ff8a80", fontSize: "0.75rem", marginTop: "4px" }}>
                          * Chọn Dịch vụ, Chi nhánh và Ngày hẹn để sử dụng tính năng này
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fetchSmartSuggestions}
                      disabled={!form.serviceId || !selectedBranchId || !form.appointmentDate}
                      style={{
                        backgroundColor: "#c5ac6b",
                        color: "#1b3d2f",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "10px",
                        fontWeight: "bold",
                        fontSize: "0.85rem",
                        cursor: (!form.serviceId || !selectedBranchId || !form.appointmentDate) ? "not-allowed" : "pointer",
                        opacity: (!form.serviceId || !selectedBranchId || !form.appointmentDate) ? 0.6 : 1,
                        transition: "all 0.2s"
                      }}
                    >
                      {smartLoading ? "Đang đề xuất..." : "Tìm đề xuất ngay"}
                    </button>
                  </div>

                  {/* Suggestions results block */}
                  {showSmartSection && (
                    <div style={{ marginTop: "16px", borderTop: "1px solid rgba(197, 172, 107, 0.2)", paddingTop: "16px" }}>
                      {smartLoading ? (
                        <div style={{ textAlign: "center", padding: "20px", fontSize: "0.9rem" }}>
                          ⌛ Đang phân tích kỹ thuật viên, đánh giá, lịch sử khách hàng và giờ trống khả dụng...
                        </div>
                      ) : smartError ? (
                        <div style={{ color: "#fc8181", fontSize: "0.9rem", padding: "10px 0" }}>
                          ❌ Lỗi: {smartError}
                        </div>
                      ) : smartSuggestions.length === 0 ? (
                        <div style={{ color: "#e2e8f0", fontSize: "0.9rem", padding: "10px 0", textAlign: "center" }}>
                          Không tìm thấy KTV trống ca làm phù hợp trong ngày đã chọn.
                        </div>
                      ) : (
                        <div>
                          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#c5ac6b", textTransform: "uppercase" }}>Gợi ý hàng đầu phù hợp:</h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                            {smartSuggestions.map((sug, idx) => (
                              <div
                                key={idx}
                                style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                                  border: "1.5px solid rgba(197, 172, 107, 0.3)",
                                  borderRadius: "12px",
                                  padding: "14px",
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                  transition: "all 0.2s",
                                  position: "relative"
                                }}
                              >
                                {/* Score badge */}
                                <span style={{
                                  position: "absolute",
                                  top: "12px",
                                  right: "12px",
                                  backgroundColor: sug.score >= 90 ? "#2e7d32" : "#b5871f",
                                  color: "#fff",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  fontWeight: "700"
                                }}>
                                  {sug.score}% Phù hợp
                                </span>

                                {/* KTV Info */}
                                <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                                  <img
                                    src={resolveFileUrl(sug.avatarUrl) || "/images/default-avatar.png"}
                                    alt={sug.fullName}
                                    style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "1px solid #c5ac6b" }}
                                    onError={(e) => { e.currentTarget.src = "/images/default-avatar.png"; }}
                                  />
                                  <div>
                                    <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#fff" }}>{sug.fullName}</h4>
                                    <span style={{ fontSize: "0.75rem", color: "#a9bcae" }}>{sug.specialization}</span>
                                    <div style={{ fontSize: "0.9rem", color: "#c5ac6b", fontWeight: "700", marginTop: "4px" }}>
                                      ⏰ {formatTime(sug.startTime)} - {formatTime(sug.endTime)}
                                    </div>
                                  </div>
                                </div>

                                {/* Reasons bullet list */}
                                <ul style={{ margin: "0 0 12px 0", paddingLeft: "16px", fontSize: "0.78rem", color: "#e2e8f0", lineHeight: "1.5", textAlign: "left" }}>
                                  {sug.reasons.map((r, rIdx) => (
                                    <li key={rIdx}>{r}</li>
                                  ))}
                                </ul>

                                {/* Apply Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm((prev) => ({
                                      ...prev,
                                      employeeId: sug.employeeId,
                                      startTime: sug.startTime
                                    }));
                                    setStep(5);
                                    alert(`Đã áp dụng đề xuất: KTV ${sug.fullName} vào lúc ${formatTime(sug.startTime)}!`);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    border: "none",
                                    borderRadius: "8px",
                                    backgroundColor: "rgba(197, 172, 107, 0.15)",
                                    color: "#c5ac6b",
                                    fontWeight: "700",
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                    border: "1px solid #c5ac6b",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = "#c5ac6b";
                                    e.currentTarget.style.color = "#1b3d2f";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = "rgba(197, 172, 107, 0.15)";
                                    e.currentTarget.style.color = "#c5ac6b";
                                  }}
                                >
                                  Áp dụng đề xuất này
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 1. SELECT SERVICE / COMBO */}
                <section className="booking-section">
                  <div className="booking-section-head">
                    <div>
                      <h2>1. Chọn dịch vụ</h2>
                      <p>Chọn dịch vụ lẻ hoặc dùng combo/liệu trình còn buổi.</p>
                    </div>
                  </div>

                  <div className="booking-tabs">
                    <button
                      type="button"
                      className={`booking-tab ${bookingType === "SERVICE" ? "active" : ""}`}
                      onClick={() => {
                        setBookingType("SERVICE");
                        setSelectedPackageId("");
                        setPackageServices([]);
                        resetAfterServiceChange({
                          ...form,
                          customerPackageId: "",
                          serviceId: "",
                          employeeId: "",
                          startTime: "",
                        });
                        setStep(1);
                      }}
                    >
                      Dịch vụ lẻ
                    </button>

                    <button
                      type="button"
                      className={`booking-tab ${bookingType === "PACKAGE" ? "active" : ""}`}
                      onClick={() => {
                        setBookingType("PACKAGE");
                        resetAfterServiceChange({
                          ...form,
                          customerPackageId: "",
                          serviceId: "",
                          employeeId: "",
                          startTime: "",
                        });
                        setStep(1);
                      }}
                    >
                      Dùng combo / liệu trình
                    </button>
                  </div>

                  {bookingType === "SERVICE" ? (
                    <>
                      <div className="booking-toolbar">
                        <input
                          className="booking-input"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                          placeholder="Tìm kiếm dịch vụ theo tên hoặc mô tả..."
                        />

                        <select
                          className="booking-select"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c === "ALL" ? "Tất cả danh mục" : c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {pageLoading ? (
                        <p className="booking-empty">Đang tải dữ liệu...</p>
                      ) : (
                        <div className="booking-service-grid">
                          {filteredServices.length > 0 ? (
                            filteredServices.map((item) => (
                              <button
                                type="button"
                                key={item.ServiceId}
                                className={`booking-service-card ${String(form.serviceId) === String(item.ServiceId) ? "selected" : ""}`}
                                onClick={() => chooseService(item.ServiceId)}
                              >
                                <img
                                  src={resolveFileUrl(item.ImageUrl) || "/images/default-service.jpg"}
                                  alt={item.ServiceName}
                                />
                                <div className="booking-service-body">
                                  <h3>{item.ServiceName}</h3>
                                  <div className="booking-service-meta">
                                    <span>{item.DurationMinutes} phút</span>
                                    <strong>{formatMoney(item.Price)}</strong>
                                  </div>
                                  <p>{item.Description || "Dịch vụ chăm sóc cao cấp"}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="booking-empty">Không tìm thấy dịch vụ phù hợp.</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : pageLoading ? (
                    <p className="booking-empty">Đang tải dữ liệu...</p>
                  ) : myPackages.length === 0 ? (
                    <p className="booking-empty">Khách hàng chưa có combo / liệu trình còn buổi.</p>
                  ) : (
                    <>
                      <div className="booking-package-grid">
                        {myPackages.map((pkg) => (
                          <button
                            type="button"
                            key={pkg.CustomerPackageId}
                            className={`booking-package-card ${String(selectedPackageId) === String(pkg.CustomerPackageId) ? "selected" : ""}`}
                            onClick={() => selectPackage(pkg)}
                          >
                            <img
                              src={resolveFileUrl(pkg.ImageUrl) || "/vite.svg"}
                              alt={pkg.PackageName}
                            />
                            <div>
                              <strong>{pkg.PackageName}</strong>
                              <p>{pkg.ServiceNames || "Combo dịch vụ"}</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                                <span style={{ fontWeight: 600, color: '#0f766e' }}>Còn {pkg.RemainingSessions} buổi</span>
                                <span>Hạn dùng: {pkg.EndDate ? new Date(pkg.EndDate).toLocaleDateString("vi-VN") : "Không hạn"}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {packageDetailLoading && (
                        <p className="booking-empty">Đang tải dịch vụ trong combo...</p>
                      )}

                      {selectedPackageId && packageServices.length > 0 && (
                        <>
                          <h3 className="booking-mini-title">Chọn dịch vụ trong combo</h3>
                          <div className="booking-service-grid">
                            {packageServices.map((item) => {
                              const maxS = Number(item.MaxSessions || 0);
                              const usedS = Number(item.UsedSessions || 0);
                              const activeS = Number(item.ActiveBookings || 0);
                              const leftS = Math.max(0, maxS - usedS);
                              const availableS = Math.max(0, leftS - activeS);
                              const isBlocked = availableS === 0;

                              return (
                                <button
                                  type="button"
                                  key={item.ServiceId}
                                  disabled={isBlocked}
                                  className={`booking-service-card ${String(form.serviceId) === String(item.ServiceId) && String(form.customerPackageId) === String(selectedPackageId) ? "selected" : ""}`}
                                  style={isBlocked ? { opacity: 0.5, filter: "grayscale(100%)", cursor: "not-allowed" } : {}}
                                  onClick={() => {
                                    if (isBlocked) return;
                                    choosePackageService(selectedPackageId, item.ServiceId);
                                  }}
                                >
                                  <img
                                    src={resolveFileUrl(item.ImageUrl) || "/images/default-service.jpg"}
                                    alt={item.ServiceName}
                                  />
                                  <div className="booking-service-body">
                                    <h3>{item.ServiceName}</h3>
                                    <div className="booking-service-meta">
                                      <span>{item.DurationMinutes} phút</span>
                                      <strong style={{ color: isBlocked ? "#ef4444" : "var(--primary, #8b5cf6)" }}>
                                        {leftS === 0 ? "Hết buổi" : availableS === 0 ? `Đã đặt (${item.ActiveBookingName || "Khác"})` : `Còn ${leftS} / ${maxS} buổi`}
                                      </strong>
                                    </div>
                                    <p style={{ color: leftS === 0 ? "#ef4444" : "#64748b", margin: "4px 0" }}>
                                      {leftS === 0 ? "Đã dùng hết số buổi trong combo." : "Dịch vụ thuộc combo đã mua."}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </section>

                {/* 2. SELECT BRANCH */}
                <section className="booking-section">
                  <div className="booking-section-head">
                    <div>
                      <h2>2. Chọn chi nhánh</h2>
                      <p>Chọn chi nhánh thực hiện dịch vụ.</p>
                    </div>
                  </div>

                  <div className="booking-branch-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px", marginTop: "12px" }}>
                    {branches.map((b) => {
                      const isSelected = String(selectedBranchId) === String(b.BranchId);
                      return (
                        <button
                          type="button"
                          key={b.BranchId}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            padding: "16px",
                            border: isSelected ? "2.5px solid var(--primary, #c5ac6b)" : "1px solid #e2e8f0",
                            borderRadius: "12px",
                            backgroundColor: isSelected ? "rgba(197, 172, 107, 0.08)" : "#ffffff",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s",
                            width: "100%"
                          }}
                          onClick={() => {
                            setSelectedBranchId(b.BranchId);
                            setForm((prev) => ({
                              ...prev,
                              employeeId: "",
                              startTime: "",
                            }));
                            setStep(3);
                          }}
                        >
                          <strong style={{ fontSize: "14px", color: isSelected ? "#b45309" : "#1e293b", marginBottom: "4px" }}>
                            🏢 {b.BranchName}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                            📍 {b.Address}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 3. SELECT EMPLOYEE */}
                <section className="booking-section">
                  <div className="booking-section-head">
                    <div>
                      <h2>3. Chọn kỹ thuật viên</h2>
                      <p>Chỉ hiển thị kỹ thuật viên phù hợp tại chi nhánh đã chọn.</p>
                    </div>
                  </div>

                  <input
                    className="booking-input"
                    value={employeeKeyword}
                    onChange={(e) => setEmployeeKeyword(e.target.value)}
                    placeholder="Tìm kiếm kỹ thuật viên theo tên, chuyên môn..."
                  />

                  {!form.serviceId && (
                    <p className="booking-empty">Vui lòng chọn dịch vụ trước.</p>
                  )}

                  {employeeLoading && (
                    <p className="booking-empty">Đang tải kỹ thuật viên phù hợp...</p>
                  )}

                  {form.serviceId && !employeeLoading && (
                    <div className="booking-employee-grid">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((item) => (
                          <button
                            type="button"
                            key={item.EmployeeId}
                            className={`booking-employee-card ${String(form.employeeId) === String(item.EmployeeId) ? "selected" : ""}`}
                            onClick={() => chooseEmployee(item.EmployeeId)}
                          >
                            <img
                              src={resolveFileUrl(item.ImageUrl) || "/default-avatar.png"}
                              alt={item.FullName}
                            />
                            <div>
                              <strong>{item.FullName}</strong>
                              <span>{item.Specialization || item.Position || "Kỹ thuật viên"}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="booking-empty">Không tìm thấy kỹ thuật viên phù hợp tại chi nhánh này.</p>
                      )}
                    </div>
                  )}
                </section>

                {/* 3. SELECT TIME SLOTS */}
                <section className="booking-section">
                  <div className="booking-section-head">
                    <div>
                      <h2>3. Chọn thời gian</h2>
                      <p>Chọn ngày và giờ trống từ hệ thống.</p>
                    </div>
                  </div>

                  <div className="booking-time-area">
                    <input
                      className="booking-input"
                      type="date"
                      name="appointmentDate"
                      min={(() => {
                        const now = new Date();
                        if (now.getHours() >= 21) {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          return tomorrow.toISOString().split("T")[0];
                        }
                        return now.toISOString().split("T")[0];
                      })()}
                      value={form.appointmentDate}
                      onChange={handleChange}
                    />

                    <div className="booking-time-grid-container">
                      {slotLoading ? (
                        <p className="booking-empty">Đang tải giờ trống...</p>
                      ) : (availableSlots.length > 0 && availableSlots.some(slot => slot.available !== false)) ? (
                        <div className="booking-time-grid">
                          {availableSlots.map((slot) => {
                            const isSlotAvailable = slot.available !== false;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                disabled={!isSlotAvailable}
                                className={`booking-time-btn ${formatTime(form.startTime) === formatTime(slot.startTime) ? "active" : ""}`}
                                style={!isSlotAvailable ? { opacity: 0.45, filter: "grayscale(100%)", cursor: "not-allowed", border: "1px dashed #d1d5db" } : {}}
                                onClick={() => {
                                  if (!isSlotAvailable) return;
                                  chooseTime(slot.startTime);
                                }}
                              >
                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                {!isSlotAvailable && <span style={{ fontSize: 10, display: "block", color: "#ef4444", fontWeight: 600 }}>Bận</span>}
                              </button>
                            );
                          })}
                        </div>
                      ) : form.serviceId && form.employeeId && form.appointmentDate ? (
                        <div className="booking-no-slots-container">
                          {alternatives.length > 0 && (
                            <div className="booking-alternatives-section">
                              <h3 className="booking-alternatives-title">Gợi ý khung giờ trống khác</h3>
                              <div className="booking-alternatives-grid">
                                {alternatives.map((alt, idx) => (
                                  <div
                                    key={idx}
                                    className="booking-alternative-card"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        employeeId: alt.employeeId,
                                        appointmentDate: alt.date,
                                        startTime: alt.startTime,
                                      }));
                                      setStep(4);
                                    }}
                                  >
                                    <div className="alt-employee-info">
                                      <img
                                        src={resolveFileUrl(alt.imageUrl) || "/default-avatar.png"}
                                        alt={alt.employeeName}
                                        className="alt-employee-img"
                                      />
                                      <div>
                                        <strong className="alt-employee-name">{alt.employeeName}</strong>
                                        <p className="alt-time-label">{alt.label}</p>
                                      </div>
                                    </div>
                                    <div className="alt-time-badge">
                                      {formatTime(alt.startTime)} - {formatTime(alt.endTime)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="booking-empty" style={{ margin: "20px 0" }}>Hết giờ trống khả dụng trong ngày được chọn.</p>
                          <div style={{ marginTop: "15px", padding: "16px", background: "rgba(197, 172, 107, 0.08)", border: "1px solid rgba(197, 172, 107, 0.2)", borderRadius: "8px", textAlign: "center" }}>
                            <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#b45309", fontWeight: "600" }}>
                              Kỹ thuật viên này đã hết lịch hẹn trong ngày. Bạn muốn đăng ký vào hàng chờ?
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/receptionist/waiting-list?customerId=${selectedCustomer.CustomerId}&serviceId=${form.serviceId}&date=${form.appointmentDate}`);
                              }}
                              style={{
                                backgroundColor: "#c5ac6b",
                                color: "#000",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: "6px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#b45309"}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#c5ac6b"}
                            >
                              + Đăng ký hàng chờ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="booking-empty">Vui lòng chọn dịch vụ, kỹ thuật viên và ngày hẹn.</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* 4. NOTES */}
                <section className="booking-section">
                  <div className="booking-section-head">
                    <div>
                      <h2>4. Ghi chú</h2>
                      <p>Nhập yêu cầu đặc biệt nếu có.</p>
                    </div>
                  </div>

                  <textarea
                    className="booking-textarea"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Lễ tân ghi chú thông tin hỗ trợ khách tại đây..."
                    rows={4}
                  />
                </section>
              </main>

              {/* Sidebar Summary - giống 100% giao diện khách hàng */}
              <aside className="booking-summary-card">
                <div className="booking-summary-title">
                  <span>Thông tin đặt lịch</span>
                  <small>Kiểm tra trước khi xác nhận</small>
                </div>

                <div className="booking-summary-box">
                  <label>Dịch vụ</label>

                  {selectedService ? (
                    <div className="booking-summary-service">
                      <img
                        src={
                          resolveFileUrl(selectedService.ImageUrl) ||
                          "/images/default-service.jpg"
                        }
                        alt={selectedService.ServiceName}
                      />

                      <div>
                        <strong>{selectedService.ServiceName}</strong>
                        <span>{selectedService.DurationMinutes} phút</span>
                        <b>
                          {form.customerPackageId
                            ? "Theo combo"
                            : formatMoney(selectedService.Price)}
                        </b>
                      </div>
                    </div>
                  ) : (
                    <strong>Chưa chọn dịch vụ</strong>
                  )}
                </div>

                <div className="booking-summary-box">
                  <label>Kỹ thuật viên</label>
                  <strong>{selectedEmployee?.FullName || "Chưa chọn"}</strong>
                </div>

                <div className="booking-summary-box">
                  <label>Thời gian hẹn</label>
                  <strong>
                    {form.appointmentDate && form.startTime
                      ? `${form.appointmentDate} - ${formatTime(form.startTime)}`
                      : "Chưa chọn"}
                  </strong>
                </div>

                {!form.customerPackageId && (
                  <div className="booking-summary-box">
                    <label>Voucher / Mã giảm giá</label>

                    <div className="booking-voucher-row">
                      <input
                        className="booking-input"
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value);
                          setVoucherDiscount(0);
                          setVoucherId(null);
                        }}
                        placeholder="Nhập hoặc chọn voucher"
                      />

                      <button
                        type="button"
                        className="booking-voucher-btn"
                        onClick={applyVoucher}
                      >
                        Áp dụng
                      </button>
                    </div>

                    <button
                      type="button"
                      className="booking-show-vouchers-btn"
                      onClick={() => setShowVoucherList((prev) => !prev)}
                    >
                      {showVoucherList
                        ? "Ẩn voucher của khách"
                        : `Chọn voucher của khách (${availableVouchers.length})`}
                    </button>

                    {showVoucherList && (
                      <div className="booking-my-voucher-list">
                        {availableVouchers.length > 0 ? (
                          availableVouchers.map((voucher) => (
                            <button
                              type="button"
                              key={voucher.VoucherId}
                              className={`booking-my-voucher-card ${
                                String(voucherId) === String(voucher.VoucherId)
                                  ? "selected"
                                  : ""
                              }`}
                              onClick={() => chooseVoucher(voucher)}
                            >
                              <div>
                                <strong>{voucher.Code}</strong>
                                <span>{getVoucherText(voucher)}</span>
                              </div>

                              <small>
                                HSD:{" "}
                                {voucher.EndDate
                                  ? new Date(voucher.EndDate).toLocaleDateString("vi-VN")
                                  : "Không hạn"}
                              </small>
                            </button>
                          ))
                        ) : (
                          <p className="booking-empty small">
                            Không có voucher nào phù hợp với dịch vụ hoặc điều kiện hóa đơn của khách.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="booking-summary-total">
                  <div>
                    <span>Giá dịch vụ</span>
                    <strong>
                      {form.customerPackageId
                        ? "Theo liệu trình"
                        : formatMoney(selectedService?.Price || 0)}
                    </strong>
                  </div>

                  {!form.customerPackageId && (
                    <div>
                      <span>Giảm giá</span>
                      <strong>-{formatMoney(voucherDiscount)}</strong>
                    </div>
                  )}

                  <div className="final">
                    <span>Tổng cộng</span>
                    <strong>
                      {form.customerPackageId ? "0đ" : formatMoney(calc.finalPrice)}
                    </strong>
                  </div>
                </div>

                <div className="booking-note-box">
                  <strong>Lưu ý</strong>
                  <p>
                    Vui lòng đến trước giờ hẹn 10–15 phút. Hủy lịch trước ít nhất 2
                    giờ để không mất phí.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !form.serviceId || !form.employeeId || !form.appointmentDate || !form.startTime}
                  className="booking-submit-btn"
                  style={{ marginTop: 18, width: "100%" }}
                >
                  {loading ? "Đang tiến hành đặt..." : "Xác nhận đặt lịch hỗ trợ"}
                </button>
              </aside>
            </form>
          </>
        )}

      </div>
    </ReceptionistLayout>
  );
}
