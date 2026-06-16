import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function safeTime(value) {
  return String(value || "").slice(0, 5);
}

export default function ReceptionistCreateAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWalkIn = searchParams.get("walkin") === "1";
  const todayText = new Date().toISOString().slice(0, 10);

  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");

  const [appointmentDate, setAppointmentDate] = useState(
    isWalkIn ? todayText : "",
  );
  const [startTime, setStartTime] = useState("");
  const [note, setNote] = useState(
    isWalkIn ? "Walk-in customer - check-in tại quầy" : "",
  );

  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedServices = useMemo(() => {
    return services.filter((s) =>
      selectedServiceIds.includes(String(s.ServiceId)),
    );
  }, [services, selectedServiceIds]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + Number(s.Price || 0), 0);
  }, [selectedServices]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce(
      (sum, s) => sum + Number(s.DurationMinutes || 30),
      0,
    );
  }, [selectedServices]);

  const selectedTechnician = useMemo(() => {
    return technicians.find(
      (t) =>
        String(t.EmployeeId || t.TechnicianId) === String(selectedTechnicianId),
    );
  }, [technicians, selectedTechnicianId]);

  const endTimePreview = useMemo(() => {
    if (!startTime || !totalDuration) return "";

    const [h, m] = startTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m + totalDuration, 0, 0);

    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  }, [startTime, totalDuration]);

  const canSubmit =
    selectedCustomer &&
    selectedServiceIds.length > 0 &&
    selectedTechnicianId &&
    appointmentDate &&
    startTime &&
    !saving;

  useEffect(() => {
    setLoadingServices(true);
    axiosClient
      .get("/receptionist/services")
      .then((res) => setServices(res.data.data || res.data || []))
      .catch((err) =>
        setError(
          err.response?.data?.message || "Không tải được danh sách dịch vụ",
        ),
      )
      .finally(() => setLoadingServices(false));
  }, []);

  useEffect(() => {
    if (!customerKeyword.trim()) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(() => {
      axiosClient
        .get("/receptionist/customers/search", {
          params: { keyword: customerKeyword },
        })
        .then((res) => setCustomerResults(res.data.data || res.data || []))
        .catch((err) =>
          setError(
            err.response?.data?.message || "Không tìm kiếm được khách hàng",
          ),
        );
    }, 350);

    return () => clearTimeout(timer);
  }, [customerKeyword]);

  useEffect(() => {
    setStartTime("");
    setSelectedTechnicianId("");
    setTechnicians([]);

    if (selectedServiceIds.length === 0 || !appointmentDate) {
      setAvailableSlots([]);
      return;
    }

    setLoadingSlots(true);
    setError("");

    axiosClient
      .get("/receptionist/available-slots", {
        params: {
          serviceIds: selectedServiceIds.join(","),
          appointmentDate,
        },
      })
      .then((res) => setAvailableSlots(res.data.data || res.data || []))
      .catch((err) => {
        setAvailableSlots([]);
        setError(
          err.response?.data?.message || "Không tải được khung giờ trống",
        );
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedServiceIds, appointmentDate]);

  useEffect(() => {
    setSelectedTechnicianId("");

    if (selectedServiceIds.length === 0 || !appointmentDate || !startTime) {
      setTechnicians([]);
      return;
    }

    setLoadingTechs(true);
    setError("");

    axiosClient
      .get("/receptionist/available-technicians", {
        params: {
          serviceIds: selectedServiceIds.join(","),
          appointmentDate,
          startTime,
        },
      })
      .then((res) => setTechnicians(res.data.data || res.data || []))
      .catch((err) => {
        setTechnicians([]);
        setError(
          err.response?.data?.message ||
            "Không tải được kỹ thuật viên khả dụng",
        );
      })
      .finally(() => setLoadingTechs(false));
  }, [selectedServiceIds, appointmentDate, startTime]);

  function chooseCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerKeyword(customer.FullName || "");
    setCustomerResults([]);
  }

  function toggleService(serviceId) {
    const id = String(serviceId);

    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

    setStartTime("");
    setSelectedTechnicianId("");
    setTechnicians([]);
  }

  function removeService(serviceId) {
    setSelectedServiceIds((prev) =>
      prev.filter((id) => id !== String(serviceId)),
    );
    setStartTime("");
    setSelectedTechnicianId("");
    setTechnicians([]);
  }

  async function submit(e) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Vui lòng nhập đầy đủ thông tin lịch hẹn");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const endpoint = isWalkIn
        ? "/receptionist/walk-ins"
        : "/receptionist/appointments";

      const res = await axiosClient.post(endpoint, {
        customerId: Number(selectedCustomer.CustomerId),
        serviceIds: selectedServiceIds.map(Number),
        technicianId: Number(selectedTechnicianId),
        appointmentDate,
        startTime,
        note,
        paymentStatus,
        paymentMethod,
        isWalkIn,
      });

      const data = res.data.data || res.data;
      navigate(`/receptionist/appointments/${data.AppointmentId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Tạo lịch hẹn thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="rca-page">
        <div className="rca-hero">
          <div>
            <Link to="/receptionist/appointments" className="rca-back">
              ← Quay lại danh sách
            </Link>
            <h1>{isWalkIn ? "Walk-in Customer" : "Tạo lịch hẹn mới"}</h1>
            <p>
              Chọn khách hàng, nhiều dịch vụ, khung giờ phù hợp, kỹ thuật viên
              khả dụng và ghi nhận thanh toán tại quầy.
            </p>
          </div>

          <div className="rca-hero-badge">
            <span>{isWalkIn ? "🚶" : "✨"}</span>
            <div>
              <b>{isWalkIn ? "Walk-in Booking" : "Receptionist Booking"}</b>
              <small>{appointmentDate || todayText}</small>
            </div>
          </div>
        </div>

        {error && <div className="rca-alert">{error}</div>}

        <form className="rca-layout" onSubmit={submit}>
          <div className="rca-main-flow">
            <section className="rca-card">
              <div className="rca-card-title">
                <span>1</span>
                <div>
                  <h3>Chọn khách hàng</h3>
                  <p>Tìm theo tên, số điện thoại hoặc email.</p>
                </div>
              </div>

              <div className="rca-search-box">
                <input
                  value={customerKeyword}
                  onChange={(e) => {
                    setCustomerKeyword(e.target.value);
                    setSelectedCustomer(null);
                  }}
                  placeholder="Nhập tên / SĐT / email khách hàng..."
                />
                <span>⌕</span>
              </div>

              {customerResults.length > 0 && (
                <div className="rca-result-list">
                  {customerResults.map((c) => (
                    <button
                      key={c.CustomerId}
                      type="button"
                      onClick={() => chooseCustomer(c)}
                    >
                      <img
                        className="rca-avatar"
                        src={avatarUrl(c.AvatarUrl)}
                        alt={c.FullName || "Customer"}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                      <div>
                        <b>{c.FullName}</b>
                        <small>
                          {c.Phone || "-"} • {c.Email || "-"}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedCustomer && (
                <div className="rca-selected rca-selected-customer">
                  <img
                    className="rca-avatar large"
                    src={avatarUrl(selectedCustomer.AvatarUrl)}
                    alt={selectedCustomer.FullName || "Customer"}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div>
                    <label>Đã chọn khách hàng</label>
                    <h4>{selectedCustomer.FullName}</h4>
                    <p>
                      {selectedCustomer.Phone || "-"} •{" "}
                      {selectedCustomer.Email || "-"}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rca-card">
              <div className="rca-card-title">
                <span>2</span>
                <div>
                  <h3>Chọn dịch vụ</h3>
                  <p>Có thể chọn nhiều dịch vụ trong cùng một lịch hẹn.</p>
                </div>
              </div>

              {loadingServices && (
                <p className="rca-muted">Đang tải danh sách dịch vụ...</p>
              )}

              {!loadingServices && services.length === 0 && (
                <div className="rca-empty">Chưa có dịch vụ khả dụng.</div>
              )}

              <div className="rca-service-list">
                {services.map((s) => {
                  const id = String(s.ServiceId);
                  const checked = selectedServiceIds.includes(id);

                  return (
                    <label
                      key={s.ServiceId}
                      className={`rca-service-option ${
                        checked ? "active" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(s.ServiceId)}
                      />

                      <div className="rca-service-info">
                        <b>{s.ServiceName}</b>
                        <small>
                          {money(s.Price)} • {s.DurationMinutes || 30} phút
                        </small>
                      </div>

                      <span className="rca-service-check">
                        {checked ? "✓" : "+"}
                      </span>
                    </label>
                  );
                })}
              </div>

              {selectedServices.length > 0 && (
                <>
                  <div className="rca-service-preview">
                    <div>
                      <span>Số dịch vụ</span>
                      <b>{selectedServices.length}</b>
                    </div>
                    <div>
                      <span>Tổng thời lượng</span>
                      <b>{totalDuration} phút</b>
                    </div>
                    <div>
                      <span>Tổng tiền</span>
                      <b>{money(totalPrice)}</b>
                    </div>
                  </div>

                  <div className="rca-selected-services">
                    {selectedServices.map((s) => (
                      <div key={s.ServiceId} className="rca-selected-service">
                        <div>
                          <b>{s.ServiceName}</b>
                          <small>
                            {money(s.Price)} • {s.DurationMinutes || 30} phút
                          </small>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeService(s.ServiceId)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="rca-card">
              <div className="rca-card-title">
                <span>3</span>
                <div>
                  <h3>Chọn ngày & giờ</h3>
                  <p>Giờ kết thúc được tính theo tổng thời lượng dịch vụ.</p>
                </div>
              </div>

              <div className="rca-two">
                <label>
                  Ngày hẹn
                  <input
                    type="date"
                    min={todayText}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                  />
                </label>

                <label>
                  Giờ trống
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={
                      selectedServiceIds.length === 0 ||
                      !appointmentDate ||
                      loadingSlots
                    }
                  >
                    <option value="">
                      {loadingSlots
                        ? "Đang tải khung giờ..."
                        : "Chọn khung giờ trống"}
                    </option>

                    {availableSlots.map((slot) => (
                      <option
                        key={slot.startTime}
                        value={slot.startTime}
                        disabled={!slot.available}
                      >
                        {safeTime(slot.startTime)} - {safeTime(slot.endTime)}
                        {slot.available
                          ? ` | ${slot.availableTechnicianCount} KTV trống`
                          : " | Hết KTV"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {endTimePreview && (
                <div className="rca-time-preview">
                  <span>Khung giờ dự kiến</span>
                  <b>
                    {startTime} - {endTimePreview}
                  </b>
                </div>
              )}
            </section>

            <section className="rca-card">
              <div className="rca-card-title">
                <span>4</span>
                <div>
                  <h3>Chọn kỹ thuật viên</h3>
                  <p>
                    Chỉ hiển thị nhân viên trống và làm được tất cả dịch vụ.
                  </p>
                </div>
              </div>

              {loadingTechs && (
                <p className="rca-muted">Đang tìm kỹ thuật viên khả dụng...</p>
              )}

              {!loadingTechs &&
                selectedServiceIds.length > 0 &&
                appointmentDate &&
                startTime &&
                technicians.length === 0 && (
                  <div className="rca-empty">
                    Không có kỹ thuật viên trống trong khung giờ này.
                  </div>
                )}

              <div className="rca-tech-grid">
                {technicians.map((t) => {
                  const id = t.EmployeeId || t.TechnicianId;
                  const active = String(id) === String(selectedTechnicianId);

                  return (
                    <button
                      key={id}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => setSelectedTechnicianId(String(id))}
                    >
                      <img
                        className="rca-avatar tech"
                        src={avatarUrl(t.ImageUrl || t.AvatarUrl)}
                        alt={t.TechnicianName || t.FullName || "Technician"}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                      <b>{t.TechnicianName || t.FullName}</b>
                      <small>
                        {t.Specialization || t.Position || "Kỹ thuật viên"}
                      </small>
                      {active && <em>Đã chọn</em>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rca-card">
              <div className="rca-card-title">
                <span>5</span>
                <div>
                  <h3>Thanh toán & ghi chú</h3>
                  <p>Ghi nhận thanh toán tại quầy nếu khách đã trả tiền.</p>
                </div>
              </div>

              <div className="rca-two">
                <label>
                  Trạng thái thanh toán
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="UNPAID">Chưa thanh toán</option>
                    <option value="PAID">Đã thanh toán tại quầy</option>
                  </select>
                </label>

                <label>
                  Phương thức
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={paymentStatus !== "PAID"}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="CARD">Thẻ</option>
                    <option value="TRANSFER">Chuyển khoản</option>
                  </select>
                </label>
              </div>

              <label className="rca-note">
                Ghi chú
                <textarea
                  rows="4"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: khách muốn phòng riêng, dị ứng mỹ phẩm, cần gọi trước 15 phút..."
                />
              </label>
            </section>
          </div>

          <aside className="rca-summary">
            <div className="rca-summary-card">
              <div className="rca-summary-head">
                <h3>Tóm tắt lịch hẹn</h3>
                <span>{isWalkIn ? "Walk-in" : "Booking"}</span>
              </div>

              <div className="rca-summary-line">
                <span>Khách hàng</span>
                <b>{selectedCustomer?.FullName || "Chưa chọn"}</b>
              </div>

              <div className="rca-summary-line">
                <span>Dịch vụ</span>
                <b>
                  {selectedServices.length > 0
                    ? selectedServices.map((s) => s.ServiceName).join(", ")
                    : "Chưa chọn"}
                </b>
              </div>

              <div className="rca-summary-line">
                <span>Số dịch vụ</span>
                <b>{selectedServices.length || "Chưa chọn"}</b>
              </div>

              <div className="rca-summary-line">
                <span>Tổng thời lượng</span>
                <b>{totalDuration ? `${totalDuration} phút` : "Chưa chọn"}</b>
              </div>

              <div className="rca-summary-line">
                <span>Kỹ thuật viên</span>
                <b>
                  {selectedTechnician?.TechnicianName ||
                    selectedTechnician?.FullName ||
                    "Chưa chọn"}
                </b>
              </div>

              <div className="rca-summary-line">
                <span>Ngày giờ</span>
                <b>
                  {appointmentDate && startTime
                    ? `${appointmentDate} • ${startTime}${
                        endTimePreview ? ` - ${endTimePreview}` : ""
                      }`
                    : "Chưa chọn"}
                </b>
              </div>

              <div className="rca-summary-line">
                <span>Thanh toán</span>
                <b>
                  {paymentStatus === "PAID"
                    ? `Đã thanh toán - ${paymentMethod}`
                    : "Chưa thanh toán"}
                </b>
              </div>

              <div className="rca-total">
                <span>Tổng tiền</span>
                <strong>{money(totalPrice)}</strong>
              </div>

              <button
                className="rca-submit"
                type="submit"
                disabled={!canSubmit}
              >
                {saving
                  ? "Đang xử lý..."
                  : isWalkIn
                    ? "Tạo Walk-in & Check-in"
                    : "Tạo lịch hẹn"}
              </button>

              {!canSubmit && (
                <p className="rca-submit-hint">
                  Cần chọn đủ khách hàng, dịch vụ, ngày giờ và kỹ thuật viên.
                </p>
              )}
            </div>
          </aside>
        </form>
      </div>
    </ReceptionistLayout>
  );
}
