import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function BookingPage() {
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [bookingType, setBookingType] = useState("SERVICE");

  const [myPackages, setMyPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [packageServices, setPackageServices] = useState([]);
  const [packageDetailLoading, setPackageDetailLoading] = useState(false);

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
        setError("");

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
    const serviceId =
      searchParams.get("serviceId") || localStorage.getItem("bookingServiceId");
    const employeeId = searchParams.get("employeeId");
    const dateParam =
      searchParams.get("date") || searchParams.get("appointmentDate");
    const customerPackageId = searchParams.get("customerPackageId");

    if (!serviceId && !employeeId && !dateParam) return;

    setForm((prev) => ({
      ...prev,
      serviceId: serviceId || prev.serviceId,
      employeeId: employeeId || prev.employeeId,
      appointmentDate: dateParam || prev.appointmentDate,
      customerPackageId: customerPackageId || prev.customerPackageId,
    }));

    if (customerPackageId && serviceId) {
      setBookingType("PACKAGE");
      setSelectedPackageId(customerPackageId);
      setStep(2);
    } else if (serviceId && employeeId) {
      setStep(3);
    } else if (serviceId) {
      setStep(2);
    }
  }, [searchParams]);

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

  function formatTime(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }

  function resetAfterServiceChange(nextForm) {
    setForm(nextForm);
    setEmployees([]);
    setVoucherDiscount(0);
    setVoucherCode("");
    setVoucherId(null);
    setAvailableSlots([]);
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
      const res = await axiosClient.get(`/packages/${pkg.PackageId}`);
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
    setStep(3);
  }

  function chooseTime(time) {
    setForm({ ...form, startTime: time });
    setStep(4);
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

  async function handleSubmit(e) {
    e.preventDefault();

    const today = new Date().toISOString().split("T")[0];

    setMessage("");
    setError("");

    if (!form.serviceId) return setError("Vui lòng chọn dịch vụ");
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.appointmentDate) return setError("Vui lòng chọn ngày hẹn");
    if (form.appointmentDate < today) {
      return setError("Không được đặt lịch trong quá khứ");
    }
    if (!form.startTime) return setError("Vui lòng chọn giờ hẹn");

    const isValidSlot = availableSlots.some(
      (slot) =>
        String(slot.startTime).slice(0, 5) ===
        String(form.startTime).slice(0, 5),
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

      sessionStorage.setItem("lastAppointment", JSON.stringify(appointment));

      if (voucherId) {
        sessionStorage.setItem("bookingVoucherId", String(voucherId));
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
            ["1", "Chọn dịch vụ", "Dịch vụ bạn muốn"],
            ["2", "Kỹ thuật viên", "Người thực hiện"],
            ["3", "Thời gian", "Ngày và giờ hẹn"],
            ["4", "Xác nhận", "Kiểm tra thông tin"],
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

        <form onSubmit={handleSubmit} className="booking-layout">
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

                  {selectedPackageId && packageServices.length > 0 && (
                    <>
                      <h3 className="booking-mini-title">
                        Chọn dịch vụ trong combo
                      </h3>

                      <div className="booking-service-grid">
                        {packageServices.map((item) => (
                          <button
                            type="button"
                            key={item.ServiceId}
                            className={`booking-service-card ${
                              String(form.serviceId) ===
                                String(item.ServiceId) &&
                              String(form.customerPackageId) ===
                                String(selectedPackageId)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              choosePackageService(
                                selectedPackageId,
                                item.ServiceId,
                              )
                            }
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
                                <strong>0đ</strong>
                              </div>
                              <p>Dịch vụ thuộc combo/liệu trình đã mua.</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="booking-section">
              <div className="booking-section-head">
                <div>
                  <h2>2. Chọn kỹ thuật viên</h2>
                  <p>Chỉ hiển thị kỹ thuật viên phù hợp với dịch vụ đã chọn.</p>
                </div>
              </div>

              <input
                className="booking-input"
                value={employeeKeyword}
                onChange={(e) => setEmployeeKeyword(e.target.value)}
                placeholder="Tìm kiếm kỹ thuật viên theo tên, chuyên môn hoặc vị trí..."
              />

              {!form.serviceId && (
                <p className="booking-empty">Vui lòng chọn dịch vụ trước.</p>
              )}

              {employeeLoading && (
                <p className="booking-empty">
                  Đang tải kỹ thuật viên phù hợp...
                </p>
              )}

              {form.serviceId && !employeeLoading && (
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
                          src={
                            resolveFileUrl(item.ImageUrl) ||
                            "/default-avatar.png"
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
                      </button>
                    ))
                  ) : (
                    <p className="booking-empty">
                      Không tìm thấy kỹ thuật viên phù hợp.
                    </p>
                  )}
                </div>
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
                  min={new Date().toISOString().split("T")[0]}
                  value={form.appointmentDate}
                  onChange={handleChange}
                />

                <div className="booking-time-grid">
                  {slotLoading ? (
                    <p className="booking-empty">Đang tải giờ trống...</p>
                  ) : availableSlots.length > 0 ? (
                    availableSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        className={`booking-time-btn ${
                          String(form.startTime).slice(0, 5) ===
                          String(slot.startTime).slice(0, 5)
                            ? "active"
                            : ""
                        }`}
                        onClick={() => chooseTime(slot.startTime)}
                      >
                        {formatTime(slot.startTime)} -{" "}
                        {formatTime(slot.endTime)}
                      </button>
                    ))
                  ) : (
                    <p className="booking-empty">
                      Vui lòng chọn dịch vụ, kỹ thuật viên và ngày hẹn.
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
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Nhập voucher"
                  />

                  <button
                    type="button"
                    className="booking-voucher-btn"
                    onClick={applyVoucher}
                  >
                    Áp dụng
                  </button>
                </div>
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
