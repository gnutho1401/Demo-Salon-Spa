import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function BookingPage() {
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bookingType, setBookingType] = useState("SERVICE"); // "SERVICE" or "PACKAGE"
  const [myPackages, setMyPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setPageLoading(true);

        const [serviceRes, packageRes] = await Promise.all([
          axiosClient.get("/services"),
          axiosClient.get("/packages/my").catch(() => ({ data: { data: [] } })),
        ]);

        setServices(serviceRes.data.data || []);
        const activePkgs = (
          packageRes.data.data ||
          packageRes.data ||
          []
        ).filter(
          (p) => p.Status === "ACTIVE" && Number(p.RemainingSessions || 0) > 0,
        );
        setMyPackages(activePkgs);
        setEmployees([]);
      } catch (err) {
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
      } catch (err) {
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
          },
        });

        setAvailableSlots(res.data.data || []);
      } catch (err) {
        setAvailableSlots([]);
        setError(err.response?.data?.message || "Không tải được giờ trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadAvailableSlots();
  }, [form.serviceId, form.employeeId, form.appointmentDate]);

  useEffect(() => {
    const serviceId = searchParams.get("serviceId");
    const employeeId = searchParams.get("employeeId");
    const dateParam =
      searchParams.get("date") || searchParams.get("appointmentDate");

    if (!serviceId && !employeeId && !dateParam) return;

    setForm((prev) => ({
      ...prev,
      serviceId: serviceId || prev.serviceId,
      employeeId: employeeId || prev.employeeId,
      appointmentDate: dateParam || prev.appointmentDate,
    }));

    if (serviceId && employeeId) {
      setStep(3);
    } else if (serviceId) {
      setStep(2);
    } else if (employeeId) {
      setStep(2);
    }
  }, [searchParams]);

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
        String(s.ServiceName || "")
          .toLowerCase()
          .includes(text) ||
        String(s.Description || "")
          .toLowerCase()
          .includes(text);

      const matchCategory =
        categoryFilter === "ALL" || s.CategoryName === categoryFilter;

      return matchKeyword && matchCategory;
    });
  }, [services, keyword, categoryFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const text = employeeKeyword.toLowerCase();

      return (
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
    });
  }, [employees, employeeKeyword]);

  const selectedService = useMemo(() => {
    return services.find((s) => String(s.ServiceId) === String(form.serviceId));
  }, [services, form.serviceId]);

  const selectedEmployee = useMemo(() => {
    return employees.find(
      (e) => String(e.EmployeeId) === String(form.employeeId),
    );
  }, [employees, form.employeeId]);

  const totalPrice = form.customerPackageId
    ? 0
    : Number(selectedService?.Price || 0);
  const finalPrice = form.customerPackageId
    ? 0
    : Math.max(totalPrice - voucherDiscount, 0);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function chooseService(serviceId) {
    setForm({
      ...form,
      serviceId,
      customerPackageId: "",
      employeeId: "",
    });

    setEmployees([]);
    setVoucherDiscount(0);
    setVoucherCode("");
    setStep(2);
  }

  function choosePackageService(customerPackageId, serviceId) {
    setForm({
      ...form,
      serviceId,
      customerPackageId,
      employeeId: "",
    });

    setEmployees([]);
    setVoucherDiscount(0);
    setVoucherCode("");
    setStep(2);
  }

  function chooseEmployee(employeeId) {
    setForm({ ...form, employeeId });
    setStep(3);
  }

  function chooseTime(time) {
    setForm({ ...form, startTime: time });
    setStep(4);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
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
      });

      const data = res.data.data;

      setVoucherDiscount(Number(data.discountAmount || 0));
      setVoucherId(data.VoucherId || data.voucherId || null);
      setMessage(`Đã áp dụng voucher ${data.Code || code}`);
    } catch (err) {
      setVoucherDiscount(0);
      setError(err.response?.data?.message || "Mã voucher không hợp lệ");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const today = new Date().toISOString().split("T")[0];

    if (form.appointmentDate < today) {
      setMessage("Không được đặt lịch trong quá khứ");
      return;
    }
    setMessage("");
    setError("");

    if (!form.serviceId) return setError("Vui lòng chọn dịch vụ");
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.appointmentDate) return setError("Vui lòng chọn ngày hẹn");
    if (!form.startTime) return setError("Vui lòng chọn giờ hẹn");

    try {
      setLoading(true);

      const payload = {
        ...form,
        startTime:
          form.startTime.length === 5 ? form.startTime + ":00" : form.startTime,
      };

      const appointmentRes = await axiosClient.post("/appointments", payload);

      const appointment = appointmentRes.data.data;
      const appointmentId =
        appointment.AppointmentId ||
        appointment.appointmentId ||
        appointment.id;

      sessionStorage.setItem("lastAppointment", JSON.stringify(appointment));
      if (voucherId)
        sessionStorage.setItem("bookingVoucherId", String(voucherId));

      if (form.customerPackageId) {
        navigate(`/customer/appointment-success/${appointmentId}`);
      } else {
        navigate(
          `/customer/payment/${appointmentId}?voucherId=${voucherId || ""}&discount=${voucherDiscount || 0}`,
        );
      }

      setForm({
        serviceId: "",
        employeeId: "",
        appointmentDate: "",
        startTime: "",
        notes: "",
        customerPackageId: "",
      });

      setVoucherCode("");
      setVoucherDiscount(0);
      setVoucherId(null);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.message || "Đặt lịch thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CustomerLayout>
      <style>{`
        .booking-wrap {
          padding: 8px 0 40px;
        }

        .booking-hero {
          background: linear-gradient(135deg, #fff5fa, #ffffff);
          border: 1px solid #ffd7e6;
          border-radius: 26px;
          padding: 26px 30px;
          margin-bottom: 24px;
          box-shadow: 0 20px 45px rgba(255, 75, 140, 0.08);
        }

        .booking-hero h1 {
          margin: 0;
          font-size: 34px;
          font-weight: 900;
          color: #171725;
        }

        .booking-hero p {
          margin: 8px 0 0;
          color: #777;
          font-size: 16px;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 24px;
        }

        .step-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #f5d8e4;
        }

        .step-item.active {
          border-color: #ff4f93;
          box-shadow: 0 12px 28px rgba(255, 79, 147, 0.13);
        }

        .step-number {
          min-width: 42px;
          height: 42px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 900;
          color: #ff3f86;
          background: #fff0f6;
        }

        .step-item.active .step-number {
          color: white;
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
        }

        .step-item strong {
          display: block;
          color: #222;
          font-size: 14px;
        }

        .step-item span {
          color: #777;
          font-size: 12px;
        }

        .booking-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 24px;
          align-items: start;
        }

        .main-card,
        .summary-card {
          background: #fff;
          border: 1px solid #f5d8e4;
          border-radius: 26px;
          box-shadow: 0 18px 45px rgba(255, 75, 140, 0.08);
        }

        .main-card {
          padding: 26px;
        }

        .summary-card {
          padding: 22px;
          position: sticky;
          top: 20px;
        }

        .section-title {
          font-size: 23px;
          font-weight: 900;
          margin: 0 0 18px;
          color: #171725;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr 230px;
          gap: 14px;
          margin-bottom: 20px;
        }

        .toolbar.single {
          grid-template-columns: 1fr;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #efd8e1;
          border-radius: 16px;
          background: #fff;
          padding: 14px 16px;
          outline: none;
          font-size: 14px;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #ff4f93;
          box-shadow: 0 0 0 4px rgba(255, 79, 147, 0.1);
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .service-card {
          border: 1px solid #f2dbe5;
          border-radius: 22px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
          background: white;
          transition: 0.2s ease;
        }

        .service-card:hover,
        .service-card.selected {
          transform: translateY(-4px);
          border-color: #ff4f93;
          box-shadow: 0 16px 32px rgba(255, 79, 147, 0.16);
        }

        .service-card.selected::after {
          content: "✓";
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #ff3f86;
          color: white;
          font-weight: 900;
        }

        .service-img {
          width: 100%;
          height: 145px;
          object-fit: cover;
          background: #fff0f6;
        }

        .service-body {
          padding: 15px;
        }

        .service-body h3 {
          font-size: 16px;
          margin: 0 0 8px;
          color: #222;
        }

        .service-meta {
          display: flex;
          justify-content: space-between;
          color: #777;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .price {
          color: #ff3f86;
          font-weight: 900;
        }

        .service-desc {
          color: #777;
          font-size: 13px;
          line-height: 1.5;
          height: 40px;
          overflow: hidden;
          margin: 0;
        }

        .employee-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 18px;
        }

        .employee-card {
          border: 1px solid #f2dbe5;
          border-radius: 18px;
          padding: 14px;
          cursor: pointer;
          display: flex;
          gap: 12px;
          align-items: center;
          transition: 0.2s ease;
        }

        .employee-card:hover,
        .employee-card.selected {
          border-color: #ff4f93;
          box-shadow: 0 12px 24px rgba(255, 79, 147, 0.12);
        }

        .employee-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          background: #fff0f6;
        }

        .employee-card strong {
          display: block;
          font-size: 14px;
          color: #222;
        }

        .employee-card span {
          font-size: 12px;
          color: #777;
        }

        .time-area {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 18px;
          margin-top: 18px;
        }

        .time-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .time-btn {
          border: 1px solid #f2dbe5;
          background: #fff;
          padding: 13px 8px;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
          color: #333;
        }

        .time-btn.active {
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
          color: white;
          border-color: #ff3f86;
        }

        .textarea {
          margin-top: 18px;
          min-height: 110px;
          resize: vertical;
        }

        .submit-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .submit-btn {
          border: none;
          border-radius: 16px;
          padding: 15px 30px;
          min-width: 220px;
          cursor: pointer;
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
          color: white;
          font-size: 15px;
          font-weight: 900;
          box-shadow: 0 14px 28px rgba(255, 63, 134, 0.25);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .summary-title {
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .summary-box {
          border: 1px solid #f2dbe5;
          border-radius: 18px;
          padding: 15px;
          margin-bottom: 13px;
          background: #fff;
        }

        .summary-box label {
          display: block;
          color: #777;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .summary-service {
          display: flex;
          gap: 13px;
          align-items: center;
        }

        .summary-service img {
          width: 78px;
          height: 66px;
          object-fit: cover;
          border-radius: 14px;
          background: #fff0f6;
        }

        .voucher-row {
          display: grid;
          grid-template-columns: 1fr 96px;
          gap: 8px;
          margin-top: 10px;
        }

        .voucher-btn {
          border: none;
          border-radius: 14px;
          background: #ff3f86;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        .money-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          color: #666;
        }

        .total-row {
          border-top: 1px dashed #edc8d7;
          margin-top: 14px;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          font-size: 21px;
          font-weight: 900;
        }

        .note-box {
          background: #fff5f9;
          border: 1px solid #ffd7e6;
          border-radius: 18px;
          padding: 15px;
          color: #8a4b62;
          line-height: 1.7;
          font-size: 13px;
        }

        .alert-success,
        .alert-error {
          padding: 14px 16px;
          border-radius: 16px;
          margin-bottom: 18px;
          font-weight: 700;
        }

        .alert-success {
          background: #eafff2;
          color: #137333;
          border: 1px solid #b7f0c7;
        }

        .alert-error {
          background: #fff0f3;
          color: #c5221f;
          border: 1px solid #ffc4cf;
        }

        .empty-text {
          grid-column: 1 / -1;
          color: #777;
          text-align: center;
          padding: 20px;
        }

        @media (max-width: 1200px) {
          .booking-grid {
            grid-template-columns: 1fr;
          }

          .summary-card {
            position: static;
          }

          .service-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .employee-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .steps {
            grid-template-columns: 1fr;
          }

          .toolbar,
          .time-area {
            grid-template-columns: 1fr;
          }

          .service-grid,
          .employee-grid,
          .time-grid {
            grid-template-columns: 1fr;
          }
        }

        .booking-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 2px solid #ffd7e6;
          padding-bottom: 12px;
        }

        .booking-tab {
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #ffd7e6;
          background: #fff;
          color: #ff4f93;
          transition: all 0.2s ease;
        }

        .booking-tab.active {
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
          color: white;
          border-color: #ff3f86;
          box-shadow: 0 8px 20px rgba(255, 63, 134, 0.2);
        }

        .pkg-select-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .pkg-select-card {
          border: 1px solid #f2dbe5;
          border-radius: 20px;
          padding: 16px;
          cursor: pointer;
          background: white;
          display: flex;
          gap: 14px;
          transition: all 0.2s ease;
        }

        .pkg-select-card:hover,
        .pkg-select-card.selected {
          border-color: #ff4f93;
          box-shadow: 0 12px 24px rgba(255, 79, 147, 0.12);
        }

        .pkg-select-card.selected {
          background: #fff9fc;
        }

        .pkg-select-card img {
          width: 95px;
          height: 85px;
          object-fit: cover;
          border-radius: 14px;
        }

        .pkg-services-title {
          font-size: 16px;
          font-weight: 800;
          margin: 18px 0 12px;
          color: #ff3f86;
        }
      `}</style>

      <div className="booking-wrap">
        <div className="booking-hero">
          <h1>Đặt lịch hẹn</h1>
          <p>
            Chọn dịch vụ, kỹ thuật viên, thời gian và xác nhận thông tin đặt
            lịch.
          </p>

          <div className="steps">
            {[
              ["1", "Chọn dịch vụ", "Dịch vụ bạn muốn"],
              ["2", "Chọn kỹ thuật viên", "Người thực hiện"],
              ["3", "Chọn thời gian", "Ngày và giờ hẹn"],
              ["4", "Xác nhận", "Kiểm tra thông tin"],
            ].map((item, index) => (
              <div
                key={item[0]}
                className={`step-item ${step >= index + 1 ? "active" : ""}`}
              >
                <div className="step-number">{item[0]}</div>
                <div>
                  <strong>{item[1]}</strong>
                  <span>{item[2]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="booking-grid">
          <div className="main-card">
            <h2 className="section-title">1. Chọn dịch vụ</h2>

            <div className="toolbar">
              <input
                className="input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm kiếm dịch vụ theo tên hoặc mô tả..."
              />

              <select
                className="select"
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
              <p>Đang tải dữ liệu...</p>
            ) : (
              <div className="service-grid">
                {filteredServices.length > 0 ? (
                  filteredServices.map((item) => (
                    <div
                      key={item.ServiceId}
                      className={`service-card ${
                        String(form.serviceId) === String(item.ServiceId)
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => chooseService(item.ServiceId)}
                    >
                      <img
                        className="service-img"
                        src={resolveFileUrl(item.ImageUrl)}
                        alt={item.ServiceName}
                      />

                      <div className="service-body">
                        <h3>{item.ServiceName}</h3>

                        <div className="service-meta">
                          <span>{item.DurationMinutes} phút</span>
                          <span className="price">
                            {formatMoney(item.Price)}
                          </span>
                        </div>

                        <p className="service-desc">{item.Description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-text">Không tìm thấy dịch vụ phù hợp.</p>
                )}
              </div>
            )}

            <h2 className="section-title" style={{ marginTop: 32 }}>
              2. Chọn kỹ thuật viên
            </h2>

            <div className="toolbar single">
              <input
                className="input"
                value={employeeKeyword}
                onChange={(e) => setEmployeeKeyword(e.target.value)}
                placeholder="Tìm kiếm kỹ thuật viên theo tên, chuyên môn hoặc vị trí..."
              />
            </div>
            {!form.serviceId && (
              <p className="empty-text">Vui lòng chọn dịch vụ trước.</p>
            )}

            {employeeLoading && (
              <p className="empty-text">Đang tải kỹ thuật viên phù hợp...</p>
            )}
            <div className="employee-grid">
              {form.serviceId &&
              !employeeLoading &&
              filteredEmployees.length > 0 ? (
                filteredEmployees.map((item) => (
                  <div
                    key={item.EmployeeId}
                    className={`employee-card ${
                      String(form.employeeId) === String(item.EmployeeId)
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => chooseEmployee(item.EmployeeId)}
                  >
                    <img
                      className="employee-avatar"
                      src={
                        resolveFileUrl(item.ImageUrl) || "/default-avatar.png"
                      }
                      alt={item.FullName}
                    />

                    <div>
                      <strong>{item.FullName}</strong>
                      <span>
                        {item.Specialization ||
                          item.Position ||
                          "Kỹ thuật viên"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-text">
                  Không tìm thấy kỹ thuật viên phù hợp.
                </p>
              )}
            </div>

            <h2 className="section-title" style={{ marginTop: 32 }}>
              3. Chọn thời gian
            </h2>

            <div className="time-area">
              <input
                className="input"
                type="date"
                name="appointmentDate"
                min={new Date().toISOString().split("T")[0]}
                value={form.appointmentDate}
                onChange={handleChange}
              />

              <div className="time-grid">
                {slotLoading ? (
                  <p className="empty-text">Đang tải giờ trống...</p>
                ) : availableSlots.length > 0 ? (
                  availableSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      type="button"
                      className={`time-btn ${
                        form.startTime === slot.startTime ? "active" : ""
                      }`}
                      onClick={() => chooseTime(slot.startTime)}
                    >
                      {slot.startTime} - {slot.endTime}
                    </button>
                  ))
                ) : (
                  <p className="empty-text">
                    Vui lòng chọn ngày hoặc ngày này không còn giờ trống.
                  </p>
                )}
              </div>
            </div>

            <h2 className="section-title" style={{ marginTop: 32 }}>
              4. Ghi chú
            </h2>

            <textarea
              className="textarea"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={200}
              placeholder="Nhập yêu cầu đặc biệt của bạn..."
            />

            <div className="submit-row">
              <button className="submit-btn" disabled={loading}>
                {loading ? "Đang đặt lịch..." : "Xác nhận đặt lịch"}
              </button>
            </div>
          </div>

          <aside className="summary-card">
            <div className="summary-title">Thông tin đặt lịch</div>

            <div className="summary-box">
              <label>Dịch vụ đã chọn</label>

              {selectedService ? (
                <div className="summary-service">
                  <img
                    src={resolveFileUrl(selectedService.ImageUrl)}
                    alt={selectedService.ServiceName}
                  />
                  <div>
                    <strong>{selectedService.ServiceName}</strong>
                    <div>{selectedService.DurationMinutes} phút</div>
                    <div className="price">
                      {formatMoney(selectedService.Price)}
                    </div>
                  </div>
                </div>
              ) : (
                <strong>Chưa chọn dịch vụ</strong>
              )}
            </div>

            <div className="summary-box">
              <label>Kỹ thuật viên</label>
              <strong>{selectedEmployee?.FullName || "Chưa chọn"}</strong>
            </div>

            <div className="summary-box">
              <label>Thời gian hẹn</label>
              <strong>
                {form.appointmentDate && form.startTime
                  ? `${form.appointmentDate} - ${form.startTime}`
                  : "Chưa chọn"}
              </strong>
            </div>

            {!form.customerPackageId && (
              <div className="summary-box">
                <label>Voucher / Mã giảm giá</label>

                <div className="voucher-row">
                  <input
                    className="input"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Nhập voucher"
                  />
                  <button
                    type="button"
                    className="voucher-btn"
                    onClick={applyVoucher}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}

            <div className="summary-box">
              <div className="money-row">
                <span>Giá dịch vụ</span>
                <strong>
                  {form.customerPackageId
                    ? "Theo liệu trình"
                    : formatMoney(selectedService?.Price || 0)}
                </strong>
              </div>

              {!form.customerPackageId && (
                <div className="money-row">
                  <span>Giảm giá</span>
                  <strong>-{formatMoney(voucherDiscount)}</strong>
                </div>
              )}

              <div className="total-row">
                <span>Tổng cộng</span>
                <span className="price">
                  {form.customerPackageId ? "0đ" : formatMoney(finalPrice)}
                </span>
              </div>
            </div>

            <div className="note-box">
              <strong>Lưu ý</strong>
              <br />
              • Vui lòng đến trước giờ hẹn 10–15 phút.
              <br />• Hủy lịch trước ít nhất 2 giờ để không mất phí.
            </div>
          </aside>
        </form>
      </div>
    </CustomerLayout>
  );
}
