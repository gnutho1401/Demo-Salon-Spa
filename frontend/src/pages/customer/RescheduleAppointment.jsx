import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const FALLBACK_AVATAR = "/images/avatars/default-avatar.png";

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
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [slots, setSlots] = useState([]);
  const [alternatives, setAlternatives] = useState([]);


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

  const isPendingFollowUp = appointment?.isPendingFollowUp === true;

  // Lấy ngày hôm nay theo múi giờ local địa phương để tránh lệch múi giờ UTC
  const getLocalToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Lịch tái khám thì minDate phải từ ngày tái khám được đề xuất trở về sau
  const minDate = isPendingFollowUp && appointment?.suggestedDate
    ? appointment.suggestedDate
    : getLocalToday();


  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      return !selectedBranchId || String(emp.BranchId) === String(selectedBranchId);
    });
  }, [employees, selectedBranchId]);

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

  const getFormattedDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const hasChanged = useMemo(() => {
    if (!appointment) return false;

    return (
      form.appointmentDate !== getFormattedDate(appointment.AppointmentDate) ||
      String(form.employeeId) !== String(appointment.EmployeeId || "") ||
      form.startTime !== formatTime(appointment.StartTime)
    );
  }, [appointment, form]);

  async function loadAppointment() {
    try {
      setLoading(true);
      setError("");

      const [res, branchRes] = await Promise.all([
        axiosClient.get(`/appointments/${id}/reschedule`),
        axiosClient.get("/employees/branches").catch(() => ({ data: { data: [] } })),
      ]);
      
      const data = res.data.data || res.data;
      const branchList = branchRes.data.data || branchRes.data || [];

      setAppointment(data);
      const availableEmps = data.AvailableEmployees || [];
      setEmployees(availableEmps);
      setBranches(branchList);

      // For PENDING follow-up: use suggested date, otherwise use current appointment date
      const initialDate = data.isPendingFollowUp && data.suggestedDate
        ? data.suggestedDate
        : getFormattedDate(data.AppointmentDate);

      const initialTime = data.isPendingFollowUp && data.suggestedStartTime
        ? formatTime(data.suggestedStartTime)
        : formatTime(data.StartTime);

      setForm({
        appointmentDate: initialDate,
        employeeId: String(data.EmployeeId || ""),
        startTime: initialTime,
        reason: "",
      });

      // Auto-select branch of the current employee
      const currentEmpId = String(data.EmployeeId || "");
      if (currentEmpId) {
        const found = availableEmps.find(e => String(e.EmployeeId) === currentEmpId);
        if (found && found.BranchId) {
          setSelectedBranchId(found.BranchId);
        }
      }
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
  }, [appointment?.ServiceId, form.appointmentDate, form.employeeId, id]);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!form.appointmentDate) return setError("Vui lòng chọn ngày mới");
    if (form.appointmentDate < minDate) {
      return setError(isPendingFollowUp 
        ? `Ngày đổi lịch không được trước ngày đề xuất tái khám (${formatDate(minDate)})` 
        : "Không được đổi lịch về ngày trong quá khứ");
    }

    if (!form.employeeId) return setError("Vui lòng chọn kỹ thuật viên");
    if (!form.startTime) return setError("Vui lòng chọn khung giờ mới");
    if (!selectedSlot)
      return setError("Vui lòng chọn slot hợp lệ từ danh sách");
    if (!isPendingFollowUp && !hasChanged) {
      return setError("Bạn chưa thay đổi thông tin lịch hẹn");
    }

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

              {/* Banner for PENDING follow-up */}
              {isPendingFollowUp && (
                <div style={{
                  background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
                  border: "1.5px solid #86efac",
                  borderRadius: 12,
                  padding: "14px 18px",
                  marginBottom: 20,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start"
                }}>
                  <span style={{ fontSize: 22 }}>📋</span>
                  <div>
                    <b style={{ color: "#15803d", fontSize: 14 }}>Đề xuất lịch tái khám từ Kỹ thuật viên</b>
                    <p style={{ color: "#166534", fontSize: 13, margin: "4px 0 0" }}>
                      Kỹ thuật viên <b>{appointment.EmployeeName}</b> đã đề xuất lịch tái khám này cho bạn. Bạn có thể tự do thay đổi ngày hẹn, kỹ thuật viên hoặc khung giờ mong muốn phía dưới.
                    </p>
                  </div>
                </div>
              )}

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
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    if (selectedVal && selectedVal < minDate) {
                      setError(isPendingFollowUp
                        ? `Ngày hẹn tái khám không thể trước ngày đề xuất tái khám (${formatDate(minDate)})!`
                        : "Ngày hẹn không thể là ngày trong quá khứ!");
                      return;
                    }
                    setError("");
                    setForm((prev) => ({
                      ...prev,
                      appointmentDate: selectedVal,
                      startTime: "",
                    }));
                  }}

                />
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 2</span>
                    <h3>Chọn chi nhánh</h3>
                  </div>
                </div>

                <div className="reschedule-branch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px', marginTop: '12px' }}>
                  {branches.map((b) => {
                    const isSelected = String(selectedBranchId) === String(b.BranchId);
                    return (
                      <button
                        type="button"
                        key={b.BranchId}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '16px',
                          border: isSelected ? '2px solid #ef4f83' : '1px solid #e5e7eb',
                          borderRadius: '12px',
                          backgroundColor: isSelected ? '#fff0f5' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                        onClick={() => {
                          setSelectedBranchId(b.BranchId);
                          setForm((prev) => ({
                            ...prev,
                            employeeId: "",
                            startTime: "",
                          }));
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: isSelected ? '#ef4f83' : '#374151', marginBottom: '4px' }}>
                          🏢 {b.BranchName}
                        </span>
                        <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.3' }}>
                          📍 {b.Address}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 3</span>
                    <h3>Kỹ thuật viên</h3>
                  </div>

                  <small>{filteredEmployees.length} người phù hợp</small>
                </div>

                {/* Clickable employee grid */}
                <div className="reschedule-employee-grid">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
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
                    ))
                  ) : (
                    <p style={{ gridColumn: '1 / -1', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
                      Không có kỹ thuật viên phù hợp tại chi nhánh đã chọn.
                    </p>
                  )}
                </div>
              </section>

              <section className="reschedule-panel-pro">
                <div className="reschedule-panel-head">
                  <div>
                    <span>Bước 4</span>
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
                ) : slots.length > 0 ? (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {slots.map((slot) => {
                        const isSlotAvailable = slot.available !== false;
                        const formattedStart = formatTime(slot.startTime);
                        const formattedEnd = formatTime(slot.endTime);
                        const isActive = formatTime(form.startTime) === formattedStart;

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={!isSlotAvailable}
                            onClick={() => {
                              if (!isSlotAvailable) return;
                              setForm((prev) => ({
                                ...prev,
                                startTime: slot.startTime,
                              }));
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: isActive ? "2.5px solid #2d6a4f" : "1.5px solid #e5e7eb",
                              background: isActive ? "#2d6a4f" : "#fff",
                              color: isActive ? "#fff" : "#374151",
                              fontWeight: isActive ? 700 : 500,
                              fontSize: "0.82rem",
                              cursor: isSlotAvailable ? "pointer" : "not-allowed",
                              opacity: isSlotAvailable ? 1 : 0.45,
                              transition: "all 0.15s",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 90,
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>{formattedStart}</span>
                            <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>- {formattedEnd}</span>
                            {!isSlotAvailable && <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700, marginTop: 2 }}>Bận</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Alternatives suggestions if any */}
                    {alternatives.length > 0 && (
                      <div style={{ marginTop: 12, padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0369a1", display: "block", marginBottom: 6 }}>
                          💡 Kỹ thuật viên khác đang rảnh vào giờ này:
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {alternatives.map((alt) => (
                            <button
                              key={`${alt.employeeId}-${alt.startTime}`}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  employeeId: String(alt.employeeId),
                                  startTime: alt.startTime,
                                }));
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                background: "#fff",
                                border: "1px solid #e0f2fe",
                                color: "#0369a1",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              👤 {alt.employeeName} ({formatTime(alt.startTime)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "10px 0" }}>
                    💡 Vui lòng chọn kỹ thuật viên và ngày để xem khung giờ.
                  </p>
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

                  {appointment.BranchName && (
                    <div>
                      <span>Chi nhánh cũ</span>
                      <b>{appointment.BranchName}</b>
                    </div>
                  )}

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

                  {selectedEmployee && (
                    <div>
                      <span>Chi nhánh mới</span>
                      <b>{selectedEmployee.BranchName || "Chi nhánh chính"}</b>
                      <span style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 400, display: "block", marginTop: "2px" }}>
                        📍 {selectedEmployee.BranchAddress}
                      </span>
                    </div>
                  )}

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

              {selectedEmployee?.BranchAddress && (
                <section className="reschedule-summary-card" style={{ padding: "0", borderRadius: "14px", overflow: "hidden", border: "1px solid #efd8e1" }}>
                  <iframe
                    title="Google Maps Reschedule Branch Locator"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedEmployee.BranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="170"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen=""
                    loading="lazy"
                  />
                </section>
              )}

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
