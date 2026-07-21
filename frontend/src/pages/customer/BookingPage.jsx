import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useNavigate, useSearchParams } from "react-router-dom";

function calcBookingVoucherDiscount(voucher, amount) {
  if (!voucher) return 0;
  const total = Number(amount || 0);
  const type = String(voucher.DiscountType || voucher.discountType || "").toUpperCase();
  const value = Number(voucher.DiscountValue || voucher.discountValue || 0);
  const maxDiscount = Number(voucher.MaxDiscountAmount || voucher.maxDiscountAmount || 0);
  const minOrder = Number(voucher.MinOrderAmount || voucher.minOrderAmount || 0);

  if (total <= 0) return 0;
  if (minOrder > 0 && total < minOrder) return 0;

  let discountAmount = 0;
  if (type === "PERCENT") {
    discountAmount = Math.round((total * value) / 100);
    if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
  } else {
    discountAmount = value;
  }
  return Math.min(discountAmount, total);
}

export default function BookingPage() {
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
  const [acceptOtherTechnician, setAcceptOtherTechnician] = useState(false);
  const [acceptOtherTimeSlots, setAcceptOtherTimeSlots] = useState(false);


  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priceFilter, setPriceFilter] = useState("ALL");
  const [durationFilter, setDurationFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("DEFAULT");
  const [employeeKeyword, setEmployeeKeyword] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    serviceId: "",
    employeeId: "",
    appointmentDate: "",
    startTime: "",
    notes: "",
    customerPackageId: "",
  });

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherId, setVoucherId] = useState(null);

  const [myVouchers, setMyVouchers] = useState([]);
  const [showVoucherList, setShowVoucherList] = useState(false);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [waitingLoading, setWaitingLoading] = useState(false);
  const [waitingCreated, setWaitingCreated] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, _setError] = useState("");
  const setError = (msg) => {
    _setError(msg);
    if (msg) {
      window.alert("⚠️ CẢNH BÁO LỖI:\n\n" + msg);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setPageLoading(true);
        setError("");

        const [serviceRes, packageRes, voucherRes, branchRes] = await Promise.all([
          axiosClient.get("/services"),
          axiosClient.get("/packages/my").catch(() => ({ data: { data: [] } })),
          axiosClient.get("/vouchers/my").catch(() => ({ data: { data: [] } })),
          axiosClient.get("/employees/branches").catch(() => ({ data: { data: [] } })),
        ]);

        setServices(serviceRes.data.data || []);
        const listBranches = branchRes.data.data || branchRes.data || [];
        setBranches(listBranches);
        if (listBranches.length > 0) {
          setSelectedBranchId(listBranches[0].BranchId);
        }

        const activePkgs = (
          packageRes.data.data ||
          packageRes.data ||
          []
        ).filter(
          (p) => p.Status === "ACTIVE" && Number(p.RemainingSessions || 0) > 0,
        );

        setMyPackages(activePkgs);
        const vouchers = voucherRes.data.data || voucherRes.data || [];

        const usableVouchers = vouchers.filter((v) => {
          const notUsed = !v.UsedStatus;
          const active = v.Status === "ACTIVE";
          const notExpired = !v.EndDate || new Date(v.EndDate) >= new Date();

          return notUsed && active && notExpired;
        });

        setMyVouchers(usableVouchers);
      } catch {
        setError("Không tải được dữ liệu đặt lịch");
      } finally {
        setPageLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function loadEmployeesByService() {
      if (!form.serviceId) {
        setEmployees([]);
        return;
      }

      try {
        setEmployeeLoading(true);
        setError("");

        const res = await axiosClient.get(
          `/employees/by-service/${form.serviceId}`,
        );

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

  useEffect(() => {
    async function loadAvailableSlots() {
      if (!form.serviceId || !form.employeeId || !form.appointmentDate) {
        setAvailableSlots([]);
        setAlternatives([]);
        return;
      }

      try {
        setSlotLoading(true);
        setError("");

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

  useEffect(() => {
    const serviceId =
      searchParams.get("serviceId") || localStorage.getItem("bookingServiceId");
    const employeeId = searchParams.get("employeeId");
    const dateParam =
      searchParams.get("date") || searchParams.get("appointmentDate");
    const customerPackageId = searchParams.get("customerPackageId");
    const hairPrompt = searchParams.get("hairPrompt");
    const hairImage = searchParams.get("hairImage");

    if (!serviceId && !employeeId && !dateParam && !customerPackageId && !hairPrompt && !hairImage) return;

    let prefilledNotes = "";
    if (hairPrompt) {
      prefilledNotes += `[Yêu cầu thiết kế tóc AI]: ${hairPrompt}`;
    }
    if (hairImage) {
      prefilledNotes += `\n[Link ảnh mẫu tóc thiết kế]: ${hairImage}`;
    }

    setForm((prev) => ({
      ...prev,
      serviceId: serviceId || prev.serviceId,
      employeeId: employeeId || prev.employeeId,
      appointmentDate: dateParam || prev.appointmentDate,
      customerPackageId: customerPackageId || prev.customerPackageId,
      notes: prefilledNotes ? (prev.notes ? `${prev.notes}\n${prefilledNotes}` : prefilledNotes) : prev.notes,
    }));

    if (customerPackageId) {
      setBookingType("PACKAGE");
      setSelectedPackageId(customerPackageId);
      setStep(1);
    } else if (serviceId && employeeId) {
      setStep(4); // Go to step 4 (Chọn thời gian)
    } else if (serviceId) {
      setStep(3); // Go to step 3 (Chọn kỹ thuật viên)
    }
  }, [searchParams]);

  useEffect(() => {
    if (form.employeeId && employees.length > 0) {
      const emp = employees.find(e => String(e.EmployeeId) === String(form.employeeId));
      if (emp && emp.BranchId) {
        setSelectedBranchId(emp.BranchId);
      }
    }
  }, [form.employeeId, employees]);

  useEffect(() => {
    const customerPackageId = searchParams.get("customerPackageId");
    const serviceId = searchParams.get("serviceId");

    if (!customerPackageId || !serviceId || myPackages.length === 0) return;

    const pkg = myPackages.find(
      (p) => String(p.CustomerPackageId) === String(customerPackageId),
    );

    if (pkg) selectPackage(pkg);
  }, [myPackages, searchParams]);

  const categories = useMemo(() => {
    return [
      "ALL",
      ...new Set(services.map((s) => s.CategoryName).filter(Boolean)),
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = services.filter((s) => {
      const text = keyword.toLowerCase();

      const matchKeyword =
        String(s.ServiceName || "")
          .toLowerCase()
          .includes(text) ||
        String(s.Description || "")
          .toLowerCase()
          .includes(text);

      const matchCategory =
        categoryFilter === "ALL" || s.CategoryName === categoryFilter;

      // Price filter logic
      const price = Number(s.Price || 0);
      let matchPrice = true;
      if (priceFilter === "UNDER_100") matchPrice = price < 100000;
      else if (priceFilter === "100_300") matchPrice = price >= 100000 && price <= 300000;
      else if (priceFilter === "300_500") matchPrice = price >= 300000 && price <= 500000;
      else if (priceFilter === "OVER_500") matchPrice = price > 500000;

      // Duration filter logic
      const duration = Number(s.DurationMinutes || 0);
      let matchDuration = true;
      if (durationFilter === "UNDER_30") matchDuration = duration < 30;
      else if (durationFilter === "30_60") matchDuration = duration >= 30 && duration <= 60;
      else if (durationFilter === "OVER_60") matchDuration = duration > 60;

      return matchKeyword && matchCategory && matchPrice && matchDuration;
    });

    // Sorting logic
    if (sortBy === "PRICE_ASC") {
      result.sort((a, b) => Number(a.Price || 0) - Number(b.Price || 0));
    } else if (sortBy === "PRICE_DESC") {
      result.sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0));
    } else if (sortBy === "DURATION_ASC") {
      result.sort((a, b) => Number(a.DurationMinutes || 0) - Number(b.DurationMinutes || 0));
    } else if (sortBy === "DURATION_DESC") {
      result.sort((a, b) => Number(b.DurationMinutes || 0) - Number(a.DurationMinutes || 0));
    }

    return result;
  }, [services, keyword, categoryFilter, priceFilter, durationFilter, sortBy]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchBranch = !selectedBranchId || String(e.BranchId) === String(selectedBranchId);
      const text = employeeKeyword.toLowerCase();

      const matchKeyword = (
        String(e.FullName || "")
          .toLowerCase()
          .includes(text) ||
        String(e.Specialization || "")
          .toLowerCase()
          .includes(text) ||
        String(e.Position || "")
          .toLowerCase()
          .includes(text)
      );

      return matchBranch && matchKeyword;
    });
  }, [employees, employeeKeyword, selectedBranchId]);

  const selectedService = useMemo(() => {
    return services.find((s) => String(s.ServiceId) === String(form.serviceId));
  }, [services, form.serviceId]);

  const selectedEmployee = useMemo(() => {
    return employees.find(
      (e) => String(e.EmployeeId) === String(form.employeeId),
    );
  }, [employees, form.employeeId]);

  const selectedBranch = useMemo(() => {
    return branches.find(
      (b) => String(b.BranchId) === String(selectedBranchId),
    );
  }, [branches, selectedBranchId]);

  const totalPrice = form.customerPackageId
    ? 0
    : Number(selectedService?.Price || 0);
  const finalPrice = form.customerPackageId
    ? 0
    : Math.max(totalPrice - voucherDiscount, 0);

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
      if (code.startsWith("FREEGD") && !serviceName.includes("gội đầu")) {
        return false;
      }

      // Verify actual computed discount > 0 (same logic as PaymentPage)
      const discountAmt = calcBookingVoucherDiscount(voucher, totalPrice);
      if (discountAmt <= 0) return false;

      return true;
    });
  }, [myVouchers, selectedService, totalPrice]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatTime(value) {
    if (!value) return "";
    
    // Case 1: Date object
    if (value instanceof Date || (typeof value === "object" && typeof value.getHours === "function")) {
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    
    // Case 2: Object with ms / milliseconds (mssql time type representation)
    if (typeof value === "object") {
      const ms = value.ms !== undefined ? value.ms : value.milliseconds;
      if (typeof ms === "number") {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    }
    
    // Case 3: ISO String or date string (e.g. "1899-12-30T08:00:00.000Z")
    const str = String(value);
    if (str.includes("T")) {
      const parts = str.split("T")[1];
      if (parts) return parts.slice(0, 5);
    }
    
    // Case 4: Standard string representation containing time (e.g. "Sat Dec 30 1899 08:00:00 GMT...")
    const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
    const match = str.match(timeRegex);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    
    // Case 5: Standard string like "08:00:00" or "08:00"
    return str.slice(0, 5);
  }

  function getVoucherText(voucher) {
    if (!voucher) return "";

    const type = String(voucher.DiscountType || "").toUpperCase();
    const value = Number(voucher.DiscountValue || 0);
    const maxDiscount = Number(voucher.MaxDiscountAmount || voucher.maxDiscountAmount || 0);

    if (type === "PERCENT") {
      let text = `Giảm ${value}%`;
      if (maxDiscount > 0) text += ` · tối đa ${formatMoney(maxDiscount)}`;
      return text;
    }

    return `Giảm ${formatMoney(value)}`;
  }

  function formatVoucherDate(value) {
    if (!value) return "Không giới hạn";
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Không giới hạn";

    return date.toLocaleDateString("vi-VN");
  }
  function resetAfterServiceChange(nextForm) {
    setForm(nextForm);
    setEmployees([]);
    setVoucherDiscount(0);
    setVoucherCode("");
    setVoucherId(null);
    setAvailableSlots([]);
    setAlternatives([]);
  }

  function chooseService(serviceId) {
    setWaitingCreated(false);
    resetAfterServiceChange({
      ...form,
      serviceId,
      customerPackageId: "",
      employeeId: "",
      startTime: "",
    });
    setSelectedBranchId(branches[0]?.BranchId || 1);

    setStep(3); // Go to step 3: Chọn kỹ thuật viên
  }

  async function selectPackage(pkg) {
    setSelectedPackageId(pkg.CustomerPackageId);
    setPackageDetailLoading(true);
    setError("");

    try {
      const res = await axiosClient.get(`/packages/my/${pkg.CustomerPackageId}/detail`);
      const data = res.data.data || res.data;
      const svcs = data.Services || [];
      setPackageServices(svcs);

      // Tự động chọn dịch vụ nếu có tham số serviceId trên URL
      const prefilledServiceId = searchParams.get("serviceId");
      if (prefilledServiceId) {
        const foundSvc = svcs.find(
          (s) => String(s.ServiceId) === String(prefilledServiceId),
        );
        if (foundSvc) {
          const maxS = Number(foundSvc.MaxSessions || 0);
          const usedS = Number(foundSvc.UsedSessions || 0);
          const leftS = Math.max(0, maxS - usedS);
          if (leftS > 0) {
            choosePackageService(pkg.CustomerPackageId, foundSvc.ServiceId);
          }
        }
      }
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
    setSelectedBranchId(branches[0]?.BranchId || 1);

    setStep(3); // Go to step 3: Chọn kỹ thuật viên
  }

  function chooseBranch(branchId) {
    setSelectedBranchId(branchId);
    setForm({
      ...form,
      employeeId: "",
      startTime: "",
    });
    setStep(3); // Go to step 3: Chọn kỹ thuật viên
  }

  function chooseEmployee(employeeId) {
    setWaitingCreated(false);
    setForm({
      ...form,
      employeeId,
      startTime: "",
    });

    setAvailableSlots([]);
    setAlternatives([]);
    setStep(4); // Go to step 4: Chọn thời gian
  }

  // Go to step 5: Xác nhận
  function chooseTime(time) {
    setForm({ ...form, startTime: time });
    setStep(5);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "appointmentDate") {
      setWaitingCreated(false);
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

  async function joinWaitingListFromBooking() {
    setError("");
    setMessage("");

    const now = new Date();
    let today = now.toISOString().split("T")[0];
    if (now.getHours() >= 21) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      today = tomorrow.toISOString().split("T")[0];
    }

    if (!form.serviceId) return setError("Vui lòng chọn dịch vụ trước");
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên trước");
    if (!form.appointmentDate) return setError("Vui lòng chọn ngày muốn chờ");
    if (form.appointmentDate < today) {
      if (now.getHours() >= 21 && form.appointmentDate === now.toISOString().split("T")[0]) {
        return setError("Thời gian hoạt động trong ngày đã kết thúc. Vui lòng chọn ngày khác.");
      }
      return setError("Không được tham gia hàng chờ cho ngày trong quá khứ");
    }

    try {
      setWaitingLoading(true);

      await axiosClient.post("/waiting-list", {
        serviceId: form.serviceId,
        preferredEmployeeId: form.employeeId,
        preferredDate: form.appointmentDate,
        flexibleTimeSlot: "ANY",
        priorityLevel: "NORMAL",
        contactMethod: "PHONE",
        acceptOtherTechnician: acceptOtherTechnician ? 1 : 0,
        acceptOtherTimeSlots: acceptOtherTimeSlots ? 1 : 0,
        reason:
          "Không còn slot trống trong ngày đã chọn, khách muốn chờ khi có slot.",
        note:
          form.notes ||
          `Tạo tự động từ trang đặt lịch. Dịch vụ: ${
            selectedService?.ServiceName || form.serviceId
          }, kỹ thuật viên: ${selectedEmployee?.FullName || form.employeeId}.`,
      });

      setWaitingCreated(true);
      setMessage(
        "Đã đăng ký Hàng Chờ thành công! Lưu ý: Đây là yêu cầu hàng chờ (chưa phải lịch hẹn chính thức). Bạn có thể theo dõi và quản lý yêu cầu tại mục 'Hàng chờ của tôi'."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không thể tham gia danh sách chờ. Vui lòng thử lại.",
      );
    } finally {
      setWaitingLoading(false);
    }
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
        String(slot.startTime).slice(0, 5) ===
        String(form.startTime).slice(0, 5) &&
        slot.available !== false,
    );

    if (!isValidSlot) {
      return setError("Vui lòng chọn giờ từ danh sách giờ trống");
    }

    try {
      setLoading(true);

      const payload = {
        ...form,
        startTime:
          form.startTime.length === 5 ? `${form.startTime}:00` : form.startTime,
      };

      const appointmentRes = await axiosClient.post("/appointments", payload);

      const appointment = appointmentRes.data.data;
      const newAppointmentId =
        appointment.AppointmentId ||
        appointment.appointmentId ||
        appointment.id;

      // Lưu thêm thời điểm client tạo lịch để tính countdown chính xác (tránh lệch timezone)
      sessionStorage.setItem("bookingCreatedAt", String(Date.now()));
      sessionStorage.setItem("lastAppointment", JSON.stringify(appointment));

      if (voucherId) {
        sessionStorage.setItem("bookingVoucherId", String(voucherId));
        try {
          await axiosClient.post(`/payments/appointment/${newAppointmentId}/apply-voucher`, {
            voucherId: voucherId,
            rewardPoints: 0,
          });
        } catch (voucherErr) {
          console.error("Lỗi tự động áp dụng voucher lên hóa đơn lịch hẹn:", voucherErr);
        }
      }

      if (form.customerPackageId) {
        navigate(`/customer/appointment-success/${newAppointmentId}`);
      } else {
        navigate(
          `/customer/payment/${newAppointmentId}?voucherId=${voucherId || ""}&discount=${voucherDiscount || 0}`,
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Đặt lịch thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CustomerLayout>
      <div className="customer-booking-page">
        <div className="booking-hero">
          <div>
            <div className="eyebrow">Booking</div>
            <h1>Đặt lịch hẹn</h1>
            <p>
              Chọn dịch vụ, kỹ thuật viên, thời gian và xác nhận thông tin đặt
              lịch.
            </p>
          </div>
        </div>

        <div className="booking-steps">
          {[
            ["1", "Dịch vụ", "Dịch vụ bạn muốn", 1],
            ["2", "Kỹ thuật viên", "Người thực hiện", 3],
            ["3", "Thời gian", "Ngày và giờ hẹn", 4],
            ["4", "Xác nhận", "Kiểm tra thông tin", 5],
          ].map((item) => (
            <div
              key={item[0]}
              className={`booking-step ${step >= item[3] ? "active" : ""}`}
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

        <form onSubmit={handleSubmit} className="booking-layout" noValidate>
          <main className="booking-main-card">
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
                  className={`booking-tab ${
                    bookingType === "SERVICE" ? "active" : ""
                  }`}
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
                  className={`booking-tab ${
                    bookingType === "PACKAGE" ? "active" : ""
                  }`}
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

                    <select
                      className="booking-select"
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả mức giá</option>
                      <option value="UNDER_100">Dưới 100.000đ</option>
                      <option value="100_300">100.000đ - 300.000đ</option>
                      <option value="300_500">300.000đ - 500.000đ</option>
                      <option value="OVER_500">Trên 500.000đ</option>
                    </select>

                    <select
                      className="booking-select"
                      value={durationFilter}
                      onChange={(e) => setDurationFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả thời lượng</option>
                      <option value="UNDER_30">Dưới 30 phút</option>
                      <option value="30_60">30 - 60 phút</option>
                      <option value="OVER_60">Trên 60 phút</option>
                    </select>

                    <select
                      className="booking-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="DEFAULT">Sắp xếp mặc định</option>
                      <option value="PRICE_ASC">Giá: Thấp đến Cao</option>
                      <option value="PRICE_DESC">Giá: Cao đến Thấp</option>
                      <option value="DURATION_ASC">Thời gian: Nhanh đến Lâu</option>
                      <option value="DURATION_DESC">Thời gian: Lâu đến Nhanh</option>
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
                            className={`booking-service-card ${
                              String(form.serviceId) === String(item.ServiceId)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => chooseService(item.ServiceId)}
                          >
                            <img
                              src={
                                resolveFileUrl(item.ImageUrl) ||
                                "/images/default-service.jpg"
                              }
                              alt={item.ServiceName}
                            />

                            <div className="booking-service-body">
                              <h3>{item.ServiceName}</h3>
                              <div className="booking-service-meta">
                                <span>{item.DurationMinutes} phút</span>
                                <strong>{formatMoney(item.Price)}</strong>
                              </div>
                              <p>
                                {item.Description || "Dịch vụ chăm sóc cao cấp"}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="booking-empty">
                          Không tìm thấy dịch vụ phù hợp.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : pageLoading ? (
                <p className="booking-empty">Đang tải dữ liệu...</p>
              ) : myPackages.length === 0 ? (
                <p className="booking-empty">
                  Bạn chưa có combo / liệu trình còn buổi.{" "}
                  <a href="/customer/packages">Mua combo ngay</a>
                </p>
              ) : (
                <>
                  <div className="booking-package-grid">
                    {myPackages.map((pkg) => (
                      <button
                        type="button"
                        key={pkg.CustomerPackageId}
                        className={`booking-package-card ${
                          String(selectedPackageId) ===
                          String(pkg.CustomerPackageId)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => selectPackage(pkg)}
                      >
                        <img
                          src={resolveFileUrl(pkg.ImageUrl) || "/vite.svg"}
                          alt={pkg.PackageName}
                        />

                        <div>
                          <strong>{pkg.PackageName}</strong>
                          <p>{pkg.ServiceNames || "Combo dịch vụ"}</p>
                          <span>Còn {pkg.RemainingSessions} buổi</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {packageDetailLoading && (
                    <p className="booking-empty">
                      Đang tải dịch vụ trong combo...
                    </p>
                  )}

                  {selectedPackageId && (
                    <div style={{
                      background: "linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 100%)",
                      border: "2px solid #ec4899",
                      borderRadius: 16,
                      padding: 20,
                      marginTop: 24,
                      boxShadow: "0 8px 20px rgba(236,72,153,0.1)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>🎁</span>
                        <h3 style={{ color: "#be185d", margin: 0, fontSize: 16, fontWeight: 800 }}>
                          COMBO TRỌN GÓI 1 LƯỢT: {myPackages.find(p => String(p.CustomerPackageId) === String(selectedPackageId))?.PackageName}
                        </h3>
                      </div>
                      <p style={{ color: "#831843", fontSize: 13, margin: "0 0 14px 0", lineHeight: 1.5 }}>
                        Dịch vụ bao gồm: <strong>{myPackages.find(p => String(p.CustomerPackageId) === String(selectedPackageId))?.ServiceNames || "Các dịch vụ làm đẹp cao cấp"}</strong>
                      </p>

                      <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 12, marginBottom: 16, border: "1px dashed #f472b6" }}>
                        <b style={{ color: "#be185d", fontSize: 12, display: "block", marginBottom: 2 }}>✨ LÀM CÙNG LÚC 1 LẦN TẤT CẢ DỊCH VỤ:</b>
                        <span style={{ fontSize: 12, color: "#475569" }}>
                          Combo của bạn sẽ được thực hiện trọn gói trong <strong>1 lần ghé duy nhất</strong>. Hệ thống sẽ tự động xếp Kỹ thuật viên tốt nhất đang rảnh ca cho bạn.
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn primary"
                        style={{
                          width: "100%",
                          background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                          borderColor: "#db2777",
                          fontSize: 14,
                          fontWeight: 800,
                          padding: "12px 16px",
                          borderRadius: 12,
                          justifyContent: "center",
                          color: "#ffffff"
                        }}
                        onClick={() => {
                          navigate(`/customer/packages`);
                        }}
                      >
                        ✨ 📅 Mở Ví Combo Để Đặt Lịch Làm 1 Lượt Ngay →
                      </button>
                    </div>
                  )}

                </>
              )}

            </section>

            <section className="booking-section">
              <div className="booking-section-head">
                <div>
                  <h2>2. Chọn kỹ thuật viên</h2>
                  <p>Danh sách nhân viên tại chi nhánh phù hợp với dịch vụ của bạn.</p>
                </div>
              </div>

              {!form.serviceId ? (
                <p className="booking-empty">Vui lòng chọn dịch vụ trước.</p>
              ) : !selectedBranchId ? (
                <p className="booking-empty">Vui lòng chọn chi nhánh trước.</p>
              ) : (
                <>
                  <input
                    className="booking-input"
                    value={employeeKeyword}
                    onChange={(e) => setEmployeeKeyword(e.target.value)}
                    placeholder="Tìm kiếm kỹ thuật viên theo tên, chuyên môn..."
                  />

                  {employeeLoading ? (
                    <p className="booking-empty">Đang tải kỹ thuật viên phù hợp...</p>
                  ) : (
                    <div className="booking-employee-grid">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((item) => (
                          <button
                            type="button"
                            key={item.EmployeeId}
                            className={`booking-employee-card ${
                              String(form.employeeId) === String(item.EmployeeId)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => chooseEmployee(item.EmployeeId)}
                          >
                            <img
                              src={resolveFileUrl(item.ImageUrl) || "/images/avatars/default-avatar.png"}
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
                </>
              )}
            </section>

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
                             className={`booking-time-btn ${
                               formatTime(form.startTime) ===
                               formatTime(slot.startTime)
                                 ? "active"
                                 : ""
                             }`}
                             style={!isSlotAvailable ? { opacity: 0.45, filter: "grayscale(100%)", cursor: "not-allowed", border: "1px dashed #d1d5db" } : {}}
                             onClick={() => {
                               if (!isSlotAvailable) return;
                               chooseTime(slot.startTime);
                             }}
                           >
                             {formatTime(slot.startTime)} -{" "}
                             {formatTime(slot.endTime)}
                             {!isSlotAvailable && <span style={{ fontSize: 10, display: "block", color: "#ef4444", fontWeight: 600 }}>Bận</span>}
                           </button>
                         );
                       })}
                    </div>
                  ) : form.serviceId &&
                    form.employeeId &&
                    form.appointmentDate ? (
                    <div className="booking-no-slots-container">
                      {alternatives.length > 0 ? (
                        <div className="booking-alternatives-section">
                          <p style={{ color: "#ef4444", fontWeight: "bold", margin: "0 0 15px 0", fontSize: "14px", textAlign: "left" }}>
                            ⚠️ Kỹ thuật viên này đã hết lịch hẹn trong ngày. Dưới đây là các gợi ý khung giờ trống khác dành cho bạn:
                          </p>
                          <h3 className="booking-alternatives-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle', color: '#db2777' }}>
                              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            Gợi ý khung giờ trống khác dành cho bạn
                          </h3>
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
                                  setStep(5);
                                }}
                              >
                                <div className={`alt-badge type-${alt.type}`}>
                                  {alt.type === 1
                                    ? "Đổi KTV hôm nay"
                                    : alt.type === 2
                                    ? "Chọn ngày khác"
                                    : "Ngày khác & KTV khác"}
                                </div>
                                <div className="alt-employee-info">
                                  <img
                                    src={resolveFileUrl(alt.imageUrl) || "/images/avatars/default-avatar.png"}
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
                      ) : (
                        <p className="booking-empty" style={{ color: "#ef4444", fontWeight: "bold" }}>
                          Kỹ thuật viên này đã hết lịch hẹn trong ngày. Vui lòng chọn ngày khác hoặc kỹ thuật viên khác.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="booking-empty">
                      Vui lòng chọn dịch vụ, chi nhánh, kỹ thuật viên và ngày hẹn.
                    </p>
                  )}
                </div>
              </div>
            </section>

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
                maxLength={200}
                placeholder="Ví dụ: Tôi muốn kỹ thuật viên nhẹ tay, da nhạy cảm..."
              />

              <div className="booking-submit-row">
                <button className="booking-submit-btn" disabled={loading}>
                  {loading
                    ? "Đang đặt lịch..."
                    : form.customerPackageId
                      ? "Xác nhận đặt lịch"
                      : "Tiếp tục thanh toán"}
                </button>
              </div>
            </section>
          </main>

          <aside className="booking-summary-card">
            <div className="booking-summary-title">
              <span>Thông tin đặt lịch</span>
              <small>Kiểm tra trước khi xác nhận</small>
            </div>

            <div className="booking-summary-box" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Địa điểm thực hiện</label>
              <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b' }}>🏢 {selectedBranch?.BranchName || "LUNA Beauty Salon"}</strong>
              <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '2px', marginBottom: '10px' }}>
                {selectedBranch?.Address || "Chưa chọn chi nhánh"}
              </small>
              {selectedBranch?.Address && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', height: '160px', width: '100%' }}>
                  <iframe
                    title="Bản đồ salon"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedBranch.Address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen=""
                    loading="lazy"
                  />
                </div>
              )}
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
                    ? "Ẩn voucher của tôi"
                    : `Chọn voucher của tôi (${availableVouchers.length})`}
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
                            Giảm được {formatMoney(calcBookingVoucherDiscount(voucher, totalPrice))}
                            {Number(voucher.MinOrderAmount || 0) > 0
                              ? ` · Đơn tối thiểu ${formatMoney(voucher.MinOrderAmount)}`
                              : ""}
                            {" · "}HSD: {formatVoucherDate(voucher.EndDate)}
                          </small>
                        </button>
                      ))
                    ) : (
                      <p className="booking-empty small">
                        Không có voucher nào phù hợp với dịch vụ hoặc điều kiện hóa đơn của bạn.
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
                  {form.customerPackageId ? "0đ" : formatMoney(finalPrice)}
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
          </aside>
        </form>
      </div>
    </CustomerLayout>
  );
}
