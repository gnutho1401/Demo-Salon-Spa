import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

export default function RescheduleAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    appointmentDate: "",
    employeeId: "",
    serviceId: "",
    startTime: "",
  });

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startTime === form.startTime),
    [slots, form.startTime],
  );

  async function loadAppointment() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(`/appointments/${id}/reschedule`);
      const data = res.data.data || res.data;
      setAppointment(data);
      setForm({
        appointmentDate: String(data.AppointmentDate || "").slice(0, 10),
        employeeId: String(data.EmployeeId || ""),
        serviceId: String(data.ServiceId || ""),
        startTime: String(data.StartTime || "").slice(0, 5),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được dữ liệu đổi lịch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointment();
  }, [id]);

  useEffect(() => {
    async function loadSlots() {
      if (!form.appointmentDate || !form.employeeId || !form.serviceId) {
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
            serviceId: form.serviceId,
            excludeAppointmentId: id,
          },
        });
        setSlots(res.data.data || []);
      } catch (err) {
        setSlots([]);
        setError(err.response?.data?.message || "Không tải được slot trống");
      } finally {
        setSlotLoading(false);
      }
    }

    loadSlots();
  }, [form.appointmentDate, form.employeeId, form.serviceId, id]);

  const minDate = new Date().toISOString().slice(0, 10);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.appointmentDate) return setError("Vui lòng chọn ngày mới");
    if (form.appointmentDate < minDate) {
      return setError("Không được đổi lịch về ngày trong quá khứ");
    }
    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.serviceId) return setError("Vui lòng chọn dịch vụ");
    if (!form.startTime) return setError("Vui lòng chọn slot hợp lệ");

    if (!selectedSlot) {
      return setError("Vui lòng chọn slot hợp lệ từ danh sách");
    }

    try {
      setSubmitting(true);
      await axiosClient.post(`/appointments/${id}/reschedule`, {
        appointmentDate: form.appointmentDate,
        employeeId: Number(form.employeeId),
        serviceId: Number(form.serviceId),
        startTime: selectedSlot.startTime,
      });
      setMessage("Đổi lịch thành công");
      navigate("/customer/appointments");
    } catch (err) {
      setError(err.response?.data?.message || "Đổi lịch thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerLayout>
      <div className="container" style={{ padding: "24px 0 56px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/customer/appointments">← Quay lại danh sách lịch hẹn</Link>
          <h2 style={{ marginTop: 12 }}>Đổi lịch hẹn</h2>
          <p className="muted">Chọn ngày, kỹ thuật viên và khung giờ mới phù hợp.</p>
        </div>

        {loading ? (
          <p>Đang tải...</p>
        ) : error ? (
          <div className="alert error">{error}</div>
        ) : appointment ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 18 }}>
            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              {message && <div className="alert success">{message}</div>}

              <div>
                <label>Ngày mới</label>
                <input
                  type="date"
                  min={minDate}
                  value={form.appointmentDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      appointmentDate: e.target.value,
                      startTime: "",
                    })
                  }
                />
              </div>

              <div>
                <label>Kỹ thuật viên</label>
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm({ ...form, employeeId: e.target.value, startTime: "" })
                  }
                >
                  <option value="">Chọn kỹ thuật viên</option>
                  <option value={appointment.EmployeeId}>{appointment.EmployeeName}</option>
                </select>
              </div>

              <div>
                <label>Dịch vụ</label>
                <select
                  value={form.serviceId}
                  onChange={(e) =>
                    setForm({ ...form, serviceId: e.target.value, startTime: "" })
                  }
                >
                  <option value="">Chọn dịch vụ</option>
                  <option value={appointment.ServiceId}>{appointment.ServiceName || "Dịch vụ"}</option>
                </select>
              </div>

              <div>
                <label>Slot trống</label>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {slotLoading ? (
                    <p>Đang tải slot...</p>
                  ) : slots.length === 0 ? (
                    <p>Không có slot trống</p>
                  ) : (
                    slots.map((slot) => (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setForm({ ...form, startTime: slot.startTime })}
                        style={{
                          textAlign: "left",
                          padding: "12px 14px",
                          border:
                            form.startTime === slot.startTime
                              ? "2px solid #ff4fa3"
                              : "1px solid #ddd",
                          borderRadius: 12,
                          background:
                            form.startTime === slot.startTime ? "#fff3fb" : "#fff",
                        }}
                      >
                        {slot.startTime} - {slot.endTime}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Đang xử lý..." : "Xác nhận đổi lịch"}
                </button>
                <Link to="/customer/appointments">Hủy</Link>
              </div>
            </form>

            <aside style={{ padding: 18, border: "1px solid #eee", borderRadius: 16, background: "#fff" }}>
              <h3>Thông tin lịch hẹn hiện tại</h3>
              <p><b>Dịch vụ:</b> {appointment.ServiceName || "-"}</p>
              <p><b>Kỹ thuật viên:</b> {appointment.EmployeeName || "-"}</p>
              <p><b>Ngày hiện tại:</b> {formatDate(appointment.AppointmentDate)}</p>
              <p><b>Giờ hiện tại:</b> {formatTime(appointment.StartTime)} - {formatTime(appointment.EndTime)}</p>
              <p><b>Trạng thái:</b> {appointment.Status || "-"}</p>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#faf7ff" }}>
                <b>Gợi ý</b>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Chỉ chọn những slot được hệ thống hiển thị. Nếu không thấy slot nào, hãy thử đổi ngày khác.
                </p>
              </div>

              {selectedSlot ? (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#fff0f7" }}>
                  <b>Slot đã chọn</b>
                  <p style={{ marginBottom: 0 }}>{selectedSlot.startTime} - {selectedSlot.endTime}</p>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </CustomerLayout>
  );
}
