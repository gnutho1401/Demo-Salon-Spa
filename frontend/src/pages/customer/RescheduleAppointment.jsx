import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const FALLBACK_AVATAR = "/images/default-avatar.png";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.slice(0, 5);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function statusText(status) {
  const s = String(status || "").toUpperCase();

  const map = {
    PENDING_PAYMENT: "Chờ thanh toán",
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    IN_PROGRESS: "Đang thực hiện",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    NO_SHOW: "Vắng mặt",
  };

  return map[s] || status || "Chưa rõ";
}

function appointmentCode(id) {
  return `AP${String(id || "").padStart(5, "0")}`;
}

export default function RescheduleAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [slots, setSlots] = useState([]);

  const [loading, setLoading] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    appointmentDate: "",
    employeeId: "",
    startTime: "",
    reason: "",
  });

  const minDate = new Date().toISOString().slice(0, 10);

  const selectedEmployee = useMemo(() => {
    return employees.find(
      (item) => String(item.EmployeeId) === String(form.employeeId),
    );
  }, [employees, form.employeeId]);

  const selectedSlot = useMemo(() => {
    return slots.find(
      (slot) => formatTime(slot.startTime) === formatTime(form.startTime) && slot.available !== false,
    );
  }, [slots, form.startTime]);

  const hasChanged = useMemo(() => {
    if (!appointment) return false;

    return (
      form.appointmentDate !==
        String(appointment.AppointmentDate || "").slice(0, 10) ||
      String(form.employeeId) !== String(appointment.EmployeeId || "") ||
      form.startTime !== formatTime(appointment.StartTime)
    );
  }, [appointment, form]);

  async function loadAppointment() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get(`/appointments/${id}/reschedule`);
      const data = res.data.data || res.data;

      setAppointment(data);
      setEmployees(data.AvailableEmployees || []);

      setForm({
        appointmentDate: String(data.AppointmentDate || "").slice(0, 10),
        employeeId: String(data.EmployeeId || ""),
        startTime: formatTime(data.StartTime),
        reason: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được dữ liệu đổi lịch",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointment();
  }, [id]);

  useEffect(() => {
    async function loadSlots() {
      if (
        !appointment?.ServiceId ||
        !form.appointmentDate ||
        !form.employeeId
      ) {
        setSlots([]);
        return;
      }

      try {
        setSlotLoading(true);
        setError("");

        const res = await axiosClient.get("/appointments/available-slots", {
          params: {
            appointmentDate: form.appointmentDate,
            employeeId: form.employeeId,
            serviceId: appointment.ServiceId,
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
        setSlots([]);
        setError(err.response?.data?.message || "Không tải được slot trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadSlots();
  }, [appointment?.ServiceId, form.appointmentDate, form.employeeId, id]);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.appointmentDate) return setError("Vui lòng chọn ngày mới");
    if (form.appointmentDate < minDate)
      return setError("Không được đổi lịch về ngày trong quá khứ");
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.startTime) return setError("Vui lòng chọn khung giờ mới");
    if (!selectedSlot)
      return setError("Vui lòng chọn slot hợp lệ từ danh sách");
    if (!hasChanged) return setError("Bạn chưa thay đổi thông tin lịch hẹn");

    try {
      setSubmitting(true);

      await axiosClient.post(`/appointments/${id}/reschedule`, {
        appointmentDate: form.appointmentDate,
        employeeId: Number(form.employeeId),
        startTime: selectedSlot.startTime,
        reason: form.reason.trim() || "Customer rescheduled appointment",
      });

      setMessage("Đổi lịch thành công");
      setTimeout(() => {
        navigate(`/customer/appointments/${id}`);
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="reschedule-page-pro">
          <div className="reschedule-loading">Đang tải dữ liệu đổi lịch...</div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="reschedule-page-pro">
        <div className="reschedule-top-pro">
          <Link to={`/customer/appointments/${id}`}>
            ← Quay lại chi tiết lịch hẹn
          </Link>

          <div>
            <span>Reschedule Appointment</span>
            <h2>Đổi lịch hẹn</h2>
            <p>
              Chọn ngày, kỹ thuật viên và khung giờ mới. Hệ thống chỉ hiển thị
              những slot còn trống.
            </p>
          </div>
        </div>

        {error && <div className="reschedule-alert error">{error}</div>}
        {message && <div className="reschedule-alert success">{message}</div>}

        {!appointment ? (
          <div className="reschedule-empty">
            <h3>Không tìm thấy lịch hẹn</h3>
            <Link to="/customer/appointments">Quay lại danh sách</Link>
          </div>
        ) : (
          <div className="reschedule-grid-pro">
            <form className="reschedule-form-pro" onSubmit={submit}>
              <section className="reschedule-hero-pro">
                <div>
                  <span>Mã lịch hẹn</span>
                  <h1>{appointmentCode(appointment.AppointmentId)}</h1>
                  <p>
                    {appointment.ServiceName || "Dịch vụ"} ·{" "}
                    {formatDate(appointment.AppointmentDate)} ·{" "}
                    {formatTime(appointment.StartTime)} -{" "}
                    {formatTime(appointment.EndTime)}
                  </p>
                </div>

                <b>{statusText(appointment.Status)}</b>
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 1</span>
                    <h3>Chọn ngày mới</h3>
                  </div>
                </div>

                <input
                  className="reschedule-input-pro"
                  type="date"
                  min={minDate}
                  value={form.appointmentDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      appointmentDate: e.target.value,
                      startTime: "",
                    }))
                  }
                />
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 2</span>
                    <h3>Chọn kỹ thuật viên</h3>
                  </div>

                  <small>{employees.length} người phù hợp</small>
                </div>

                <div className="reschedule-employee-grid">
                  {employees.map((emp) => (
                    <button
                      type="button"
                      key={emp.EmployeeId}
                      className={`reschedule-employee-card ${
                        String(form.employeeId) === String(emp.EmployeeId)
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          employeeId: String(emp.EmployeeId),
                          startTime: "",
                        }))
                      }
                    >
                      <img
                        src={resolveFileUrl(emp.ImageUrl) || FALLBACK_AVATAR}
                        alt={emp.EmployeeName}
                      />

                      <div>
                        <b>{emp.EmployeeName}</b>
                        <span>
                          {emp.Specialization ||
                            emp.Position ||
                            "Beauty Expert"}
                        </span>
                        <small>
                          ⭐ {Number(emp.AverageRating || 0).toFixed(1)} ·{" "}
                          {emp.ReviewCount || 0} đánh giá
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 3</span>
                    <h3>Chọn slot trống</h3>
                  </div>

                  {slotLoading ? (
                    <small>Đang tải...</small>
                  ) : (
                    <small>{slots.length} slot</small>
                  )}
                </div>

                {slotLoading ? (
                  <div className="reschedule-slot-empty">
                    Đang tải slot trống...
                  </div>
                ) : !slots.some(slot => slot.available !== false) ? (
                  <div className="reschedule-slot-empty">
                    Không có slot trống. Hãy thử đổi ngày hoặc kỹ thuật viên
                    khác.
                  </div>
                ) : (
                  <div className="reschedule-slot-grid">
                    {slots.map((slot) => {
                      const isSlotAvailable = slot.available !== false;
                      const formattedStart = formatTime(slot.startTime);
                      const formattedEnd = formatTime(slot.endTime);

                      return (
                        <button
                          key={`${slot.startTime}-${slot.endTime}`}
                          type="button"
                          disabled={!isSlotAvailable}
                          className={`reschedule-slot-btn ${
                            formatTime(form.startTime) === formattedStart ? "active" : ""
                          }`}
                          style={!isSlotAvailable ? { opacity: 0.45, filter: "grayscale(100%)", cursor: "not-allowed", border: "1px dashed #d1d5db" } : {}}
                          onClick={() => {
                            if (!isSlotAvailable) return;
                            setForm((prev) => ({
                              ...prev,
                              startTime: slot.startTime,
                            }));
                          }}
                        >
                          <b>{formattedStart}</b>
                          <span>
                            {formattedStart} - {formattedEnd}
                          </span>
                          {!isSlotAvailable && <span style={{ fontSize: 10, display: "block", color: "#ef4444", fontWeight: 600 }}>Bận</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 4</span>
                    <h3>Lý do đổi lịch</h3>
                  </div>
                </div>

                <textarea
                  className="reschedule-textarea-pro"
                  rows={4}
                  value={form.reason}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Ví dụ: Tôi bận đột xuất nên muốn đổi sang khung giờ khác..."
                />
              </section>

              <div className="reschedule-submit-row">
                <Link to={`/customer/appointments/${id}`}>Hủy</Link>

                <button type="submit" disabled={submitting || slotLoading}>
                  {submitting ? "Đang xử lý..." : "Xác nhận đổi lịch"}
                </button>
              </div>
            </form>

            <aside className="reschedule-summary-pro">
              <section className="reschedule-summary-card">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Lịch hiện tại</span>
                    <h3>Thông tin cũ</h3>
                  </div>
                </div>

                <div className="reschedule-info-list">
                  <div>
                    <span>Dịch vụ</span>
                    <b>{appointment.ServiceName || "-"}</b>
                  </div>

                  <div>
                    <span>Giá dịch vụ</span>
                    <b>{formatMoney(appointment.Price)}</b>
                  </div>

                  <div>
                    <span>Thời lượng</span>
                    <b>{appointment.DurationMinutes || 0} phút</b>
                  </div>

                  <div>
                    <span>Kỹ thuật viên cũ</span>
                    <b>{appointment.EmployeeName || "-"}</b>
                  </div>

                  <div>
                    <span>Ngày giờ cũ</span>
                    <b>
                      {formatDate(appointment.AppointmentDate)} ·{" "}
                      {formatTime(appointment.StartTime)} -{" "}
                      {formatTime(appointment.EndTime)}
                    </b>
                  </div>
                </div>
              </section>

              <section className="reschedule-summary-card highlight">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Lịch mới</span>
                    <h3>Dự kiến sau khi đổi</h3>
                  </div>
                </div>

                <div className="reschedule-info-list">
                  <div>
                    <span>Ngày mới</span>
                    <b>
                      {form.appointmentDate
                        ? formatDate(form.appointmentDate)
                        : "Chưa chọn"}
                    </b>
                  </div>

                  <div>
                    <span>Kỹ thuật viên mới</span>
                    <b>{selectedEmployee?.EmployeeName || "Chưa chọn"}</b>
                  </div>

                  <div>
                    <span>Giờ mới</span>
                    <b>
                      {selectedSlot
                        ? `${selectedSlot.startTime} - ${selectedSlot.endTime}`
                        : "Chưa chọn"}
                    </b>
                  </div>

                  <div>
                    <span>Trạng thái</span>
                    <b>{hasChanged ? "Có thay đổi" : "Chưa thay đổi"}</b>
                  </div>
                </div>
              </section>

              <section className="reschedule-note-card">
                <b>Lưu ý đổi lịch</b>
                <p>
                  Bạn chỉ được đổi lịch khi lịch đang chờ thanh toán hoặc đã xác
                  nhận. Không thể đổi lịch quá sát giờ hẹn. Nếu không có slot
                  trống, hãy thử ngày khác.
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
