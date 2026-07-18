import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "WAITING", label: "Đang chờ slot" },
  { value: "MATCHED", label: "Đã khớp slot (Đang giữ)" },
  { value: "NOTIFIED", label: "Đã báo khách" },
  { value: "BOOKED", label: "Đã chuyển lịch" },
  { value: "SKIPPED", label: "Khách bỏ lỡ" },
  { value: "EXPIRED", label: "Hết hạn giữ slot" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const TIME_SLOT_MAP = {
  ANY: "Linh hoạt cả ngày",
  MORNING: "Sáng (08:00 - 12:00)",
  AFTERNOON: "Chiều (13:00 - 17:00)",
  EVENING: "Tối (18:00 - 20:00)",
  CUSTOM: "Tự chọn khoảng giờ",
};

function getArray(res) {
  return res?.data?.data || res?.data || [];
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function statusLabel(status) {
  const map = {
    WAITING: "Đang chờ slot",
    MATCHED: "Đã khớp slot (Đang giữ)",
    NOTIFIED: "Đã báo khách",
    BOOKED: "Đã chuyển lịch",
    SKIPPED: "Bỏ lỡ",
    EXPIRED: "Hết hạn",
    CANCELLED: "Đã hủy",
  };
  return map[status] || status || "-";
}

function statusClass(status) {
  return `wl-status ${String(status || "").toLowerCase()}`;
}

function HoldCountdown({ expiresAt, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      if (!expiresAt) return;
      let expObj = new Date(expiresAt);
      // Nếu thời gian hết hạn lớn hơn thời gian hiện tại quá 30 phút (do lệch múi giờ UTC vs Local)
      if (expObj.getTime() - Date.now() > 30 * 60 * 1000) {
        const cleanStr = typeof expiresAt === "string" ? expiresAt.replace(/Z$/, "") : expiresAt;
        expObj = new Date(cleanStr);
      }
      const exp = expObj.getTime();
      const now = Date.now();
      const diff = exp - now;

      if (diff <= 0) {
        setTimeLeft("Đã hết hạn");
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

  return <span className="hold-countdown" style={{ color: "#db2777", fontWeight: "bold" }}>{timeLeft}</span>;
}

export default function ReceptionistWaitingList() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [convertTechnicians, setConvertTechnicians] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);

  const [filters, setFilters] = useState({
    customer: "",
    status: "",
    serviceId: "",
    date: "",
  });

  const [form, setForm] = useState({
    customerId: "",
    serviceId: "",
    preferredDate: "",
    flexibleTimeSlot: "ANY",
    preferredTimeFrom: "",
    preferredTimeTo: "",
    reason: "Khách muốn chờ nếu có slot trống",
    note: "",
  });

  useEffect(() => {
    const customerId = searchParams.get("customerId");
    const serviceId = searchParams.get("serviceId");
    const date = searchParams.get("date");

    if (customerId || serviceId || date) {
      setForm((prev) => ({
        ...prev,
        customerId: customerId || prev.customerId,
        serviceId: serviceId || prev.serviceId,
        preferredDate: date || prev.preferredDate,
        flexibleTimeSlot: "ANY",
        preferredTimeFrom: "",
        preferredTimeTo: "",
      }));
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 300);
    }
  }, [searchParams]);

  const [convertForm, setConvertForm] = useState({
    waitingId: null,
    technicianId: "",
    appointmentDate: "",
    startTime: "",
  });

  const [loading, setLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load(nextFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const params = {
        customer: nextFilters.customer || undefined,
        status: nextFilters.status || undefined,
        serviceId: nextFilters.serviceId || undefined,
        date: nextFilters.date || undefined,
      };

      const waitingRes = await axiosClient.get("/receptionist/waiting-list", {
        params,
      });

      setItems(getArray(waitingRes));

      const [servicesRes, customersRes, techRes] = await Promise.allSettled([
        axiosClient.get("/receptionist/services"),
        axiosClient.get("/receptionist/customers"),
        axiosClient.get("/receptionist/technicians"),
      ]);

      if (servicesRes.status === "fulfilled") {
        setServices(getArray(servicesRes.value));
      }

      if (customersRes.status === "fulfilled") {
        setCustomers(getArray(customersRes.value));
      }

      if (techRes.status === "fulfilled") {
        setTechnicians(getArray(techRes.value));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được Waiting List");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      waiting: items.filter((x) => x.Status === "WAITING").length,
      matched: items.filter((x) => x.Status === "MATCHED").length,
      notified: items.filter((x) => x.Status === "NOTIFIED").length,
      booked: items.filter((x) => x.Status === "BOOKED").length,
      skipped: items.filter((x) => x.Status === "SKIPPED").length,
      expired: items.filter((x) => x.Status === "EXPIRED").length,
      cancelled: items.filter((x) => x.Status === "CANCELLED").length,
    };
  }, [items]);

  const selectedConvertEmp = useMemo(() => {
    return convertTechnicians.find((t) => String(t.EmployeeId || t.TechnicianId) === String(convertForm.technicianId));
  }, [convertTechnicians, convertForm.technicianId]);

  async function createWaiting(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post("/receptionist/waiting-list", form);

      setForm({
        customerId: "",
        serviceId: "",
        preferredDate: "",
        flexibleTimeSlot: "ANY",
        preferredTimeFrom: "",
        preferredTimeTo: "",
        reason: "Khách muốn chờ nếu có slot trống",
        note: "",
      });

      await load();
      setSuccessMsg("Đã thêm khách vào danh sách chờ");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể thêm Waiting List");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(waitingId, status) {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.put(`/receptionist/waiting-list/${waitingId}`, {
        status,
      });

      await load();
      setSuccessMsg("Đã cập nhật trạng thái");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể cập nhật trạng thái");
    } finally {
      setSaving(false);
    }
  }

  async function cancelWaiting(waitingId) {
    const reason = window.prompt(
      "Nhập lý do hủy (không bắt buộc):",
      "Khách hàng muốn hủy yêu cầu"
    );
    if (reason === null) return; // User clicked Cancel in prompt

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.delete(`/receptionist/waiting-list/${waitingId}`, {
        params: { cancelReason: reason },
      });

      await load();
      setSuccessMsg("Đã hủy yêu cầu chờ");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể hủy yêu cầu chờ");
    } finally {
      setSaving(false);
    }
  }

  async function loadWaitingSlots(waitingId, appointmentDate, technicianId) {
    try {
      setSlotLoading(true);
      setError("");

      if (!waitingId || !appointmentDate) {
        setAvailableSlots([]);
        return;
      }

      const res = await axiosClient.get(
        `/receptionist/waiting-list/${waitingId}/available-slots`,
        {
          params: {
            appointmentDate,
            technicianId: technicianId || undefined,
          },
        },
      );

      setAvailableSlots(getArray(res));
    } catch (err) {
      setAvailableSlots([]);
      setError(err.response?.data?.message || "Không tải được slot trống");
    } finally {
      setSlotLoading(false);
    }
  }

  async function openConvertForm(item) {
    const isMatched = item.Status === "MATCHED";

    const appointmentDate = isMatched
      ? (item.MatchedDate ? String(item.MatchedDate).slice(0, 10) : "")
      : (item.PreferredDate ? String(item.PreferredDate).slice(0, 10) : "");

    const technicianId = isMatched
      ? (item.MatchedEmployeeId || "")
      : (item.PreferredEmployeeId || item.EmployeeId || item.TechnicianId || "");

    const startTime = isMatched ? String(item.MatchedStartTime || "").slice(0, 5) : "";

    const next = {
      waitingId: item.WaitingId,
      technicianId,
      appointmentDate,
      startTime,
    };

    setConvertForm(next);
    setAvailableSlots([]);
    setConvertTechnicians([]);

    try {
      const res = await axiosClient.get(`/employees/by-service/${item.ServiceId}`);
      setConvertTechnicians(res.data?.data || []);
    } catch (err) {
      console.error("Lỗi tải KTV theo dịch vụ:", err);
      setConvertTechnicians(technicians);
    }

    if (appointmentDate) {
      await loadWaitingSlots(item.WaitingId, appointmentDate, technicianId);
    }
  }

  function closeConvertForm() {
    setConvertForm({
      waitingId: null,
      technicianId: "",
      appointmentDate: "",
      startTime: "",
    });
    setAvailableSlots([]);
  }

  async function convertToAppointment(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post(
        `/receptionist/waiting-list/${convertForm.waitingId}/convert`,
        {
          technicianId: convertForm.technicianId,
          appointmentDate: convertForm.appointmentDate,
          startTime: convertForm.startTime,
          paymentStatus: "UNPAID",
          paymentMethod: "CASH",
        },
      );

      closeConvertForm();
      await load();
      setSuccessMsg("Đã chuyển Waiting List thành lịch hẹn");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể chuyển thành lịch");
    } finally {
      setSaving(false);
    }
  }

  function submitFilter(e) {
    e.preventDefault();
    load(filters);
  }

  function resetFilter() {
    const reset = {
      customer: "",
      status: "",
      serviceId: "",
      date: "",
    };
    setFilters(reset);
    load(reset);
  }

  return (
    <ReceptionistLayout>
      <div className="wl-page">
        <section className="wl-hero">
          <div>
            <p className="wl-kicker">Receptionist</p>
            <h1>Waiting List</h1>
            <p>
              Quản lý khách đang chờ slot trống. Khi có giờ phù hợp,
              receptionist báo khách và chuyển thành lịch hẹn chính thức.
            </p>
          </div>

          <button
            type="button"
            className="wl-btn secondary"
            onClick={() => load()}
            disabled={loading}
          >
            ↻ Làm mới
          </button>
        </section>

        {error && <div className="wl-alert error">{error}</div>}
        {successMsg && <div className="wl-alert success">{successMsg}</div>}

        <section className="wl-stats">
          <div className="wl-stat-card">
            <span>📋</span>
            <p>Tổng yêu cầu</p>
            <b>{stats.total}</b>
          </div>

          <div className="wl-stat-card">
            <span>⏳</span>
            <p>Đang chờ slot</p>
            <b>{stats.waiting}</b>
          </div>

          <div className="wl-stat-card">
            <span>⚡</span>
            <p>Đã khớp slot</p>
            <b>{stats.matched || 0}</b>
          </div>

          <div className="wl-stat-card">
            <span>📞</span>
            <p>Đã báo khách</p>
            <b>{stats.notified}</b>
          </div>

          <div className="wl-stat-card">
            <span>✅</span>
            <p>Đã chuyển lịch</p>
            <b>{stats.booked}</b>
          </div>

          <div className="wl-stat-card">
            <span>⌛</span>
            <p>Đã bỏ lỡ</p>
            <b>{stats.skipped || 0}</b>
          </div>

          <div className="wl-stat-card">
            <span>📆</span>
            <p>Đã hết hạn</p>
            <b>{stats.expired || 0}</b>
          </div>

          <div className="wl-stat-card">
            <span>🚫</span>
            <p>Đã hủy</p>
            <b>{stats.cancelled}</b>
          </div>
        </section>

        <section className="wl-card">
          <div className="wl-card-head">
            <div>
              <h2>Thêm khách vào hàng chờ</h2>
              <p>
                Dùng khi khách muốn đặt lịch nhưng ngày/kỹ thuật viên đó đã hết
                slot phù hợp.
              </p>
            </div>
          </div>

          <form className="wl-form" onSubmit={createWaiting}>
            <label>
              <span>Khách hàng</span>
              <select
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
                required
              >
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => (
                  <option key={c.CustomerId} value={c.CustomerId}>
                    {c.FullName} {c.Phone ? `- ${c.Phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Dịch vụ</span>
              <select
                value={form.serviceId}
                onChange={(e) =>
                  setForm({ ...form, serviceId: e.target.value })
                }
                required
              >
                <option value="">Chọn dịch vụ</option>
                {services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName} - {formatMoney(s.Price)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Ngày mong muốn</span>
              <input
                type="date"
                value={form.preferredDate}
                onChange={(e) =>
                  setForm({ ...form, preferredDate: e.target.value })
                }
              />
            </label>

            <label>
              <span>Khung giờ mong muốn</span>
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
              >
                <option value="ANY">Linh hoạt cả ngày</option>
                <option value="MORNING">Buổi sáng 08:00 - 12:00</option>
                <option value="AFTERNOON">Buổi chiều 13:00 - 17:00</option>
                <option value="EVENING">Buổi tối 18:00 - 20:00</option>
                <option value="CUSTOM">Tự chọn khoảng giờ</option>
              </select>
            </label>

            {form.flexibleTimeSlot === "CUSTOM" && (
              <>
                <label>
                  <span>Từ giờ</span>
                  <input
                    type="time"
                    value={form.preferredTimeFrom}
                    onChange={(e) =>
                      setForm({ ...form, preferredTimeFrom: e.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  <span>Đến giờ</span>
                  <input
                    type="time"
                    value={form.preferredTimeTo}
                    onChange={(e) =>
                      setForm({ ...form, preferredTimeTo: e.target.value })
                    }
                    required
                  />
                </label>
              </>
            )}

            <label className="wl-col-2">
              <span>Lý do</span>
              <input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Ví dụ: Khách muốn chờ nếu có người hủy lịch"
              />
            </label>

            <label className="wl-col-2">
              <span>Ghi chú</span>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú thêm cho lễ tân"
              />
            </label>

            <div className="wl-form-actions">
              <button
                type="submit"
                className="wl-btn primary"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "+ Thêm vào Waiting List"}
              </button>
            </div>
          </form>
        </section>

        <section className="wl-card">
          <div className="wl-card-head">
            <div>
              <h2>Bộ lọc</h2>
              <p>
                Lọc theo khách hàng, trạng thái, dịch vụ hoặc ngày mong muốn.
              </p>
            </div>
          </div>

          <form className="wl-filter" onSubmit={submitFilter}>
            <label>
              <span>Tìm khách</span>
              <input
                value={filters.customer}
                onChange={(e) =>
                  setFilters({ ...filters, customer: e.target.value })
                }
                placeholder="Tên, số điện thoại, email"
              />
            </label>

            <label>
              <span>Trạng thái</span>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Dịch vụ</span>
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
            </label>

            <label>
              <span>Ngày</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) =>
                  setFilters({ ...filters, date: e.target.value })
                }
              />
            </label>

            <div className="wl-filter-actions">
              <button type="submit" className="wl-btn primary">
                Lọc
              </button>

              <button
                type="button"
                className="wl-btn secondary"
                onClick={resetFilter}
              >
                Xóa lọc
              </button>
            </div>
          </form>
        </section>

        {convertForm.waitingId && (
          <section className="wl-card wl-convert">
            <div className="wl-card-head">
              <div>
                <h2>Chuyển Waiting List thành lịch hẹn</h2>
                <p>
                  Chỉ được chọn slot còn trống thật. Nếu ngày đó hết slot, hãy
                  đổi ngày hoặc đổi kỹ thuật viên.
                </p>
              </div>

              <button
                type="button"
                className="wl-btn secondary"
                onClick={closeConvertForm}
              >
                Đóng
              </button>
            </div>

            <form className="wl-form" onSubmit={convertToAppointment}>
              <label>
                <span>Kỹ thuật viên</span>
                <select
                  value={convertForm.technicianId}
                  onChange={async (e) => {
                    const technicianId = e.target.value;

                    const next = {
                      ...convertForm,
                      technicianId,
                      startTime: "",
                    };

                    setConvertForm(next);

                    await loadWaitingSlots(
                      next.waitingId,
                      next.appointmentDate,
                      technicianId,
                    );
                  }}
                  required
                >
                  <option value="">Chọn kỹ thuật viên</option>
                  {convertTechnicians.map((t) => {
                    const id = t.EmployeeId || t.TechnicianId;

                    return (
                      <option key={id} value={id}>
                        {t.FullName || t.TechnicianName}
                      </option>
                    );
                  })}
                </select>
              </label>

              {selectedConvertEmp && (
                <div style={{ marginTop: "4px", background: "#fffaf4", border: "1px solid #fce8d5", padding: "12px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "4px", gridColumn: "span 2", width: "100%", boxSizing: "border-box" }}>
                  <span style={{ fontSize: "0.85rem", color: "#85583f", fontWeight: "bold" }}>
                    Chi nhánh chuyên viên: {selectedConvertEmp.BranchName || "Chi nhánh chính"}
                  </span>
                  {selectedConvertEmp.BranchAddress && (
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      📍 Địa chỉ: {selectedConvertEmp.BranchAddress}
                    </span>
                  )}
                  {selectedConvertEmp.BranchAddress && (
                    <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e7eb", marginTop: "6px" }}>
                      <iframe
                        title="Bản đồ chuyên viên chuyển lịch"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedConvertEmp.BranchAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                        width="100%"
                        height="130"
                        style={{ border: 0, display: "block" }}
                        allowFullScreen=""
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              )}

              <label>
                <span>Ngày hẹn</span>
                <input
                  type="date"
                  value={convertForm.appointmentDate}
                  onChange={async (e) => {
                    const appointmentDate = e.target.value;

                    const next = {
                      ...convertForm,
                      appointmentDate,
                      startTime: "",
                    };

                    setConvertForm(next);

                    await loadWaitingSlots(
                      next.waitingId,
                      appointmentDate,
                      next.technicianId,
                    );
                  }}
                  required
                />
              </label>

              <label className="wl-col-2">
                <span>Slot trống</span>
                <select
                  value={convertForm.startTime && convertForm.technicianId ? `${convertForm.startTime}|${convertForm.technicianId}` : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setConvertForm({
                        ...convertForm,
                        startTime: "",
                      });
                      return;
                    }
                    const [startTime, technicianId] = val.split("|");
                    setConvertForm({
                      ...convertForm,
                      startTime: startTime || "",
                      technicianId: technicianId || convertForm.technicianId,
                    });
                  }}
                  disabled={slotLoading}
                  required
                >
                  <option value="">
                    {slotLoading ? "Đang tải slot..." : "Chọn slot trống"}
                  </option>

                  {availableSlots.map((slot) => {
                    const id = slot.employeeId || slot.technicianId;
                    return (
                      <option
                        key={`${slot.startTime}-${id}`}
                        value={`${slot.startTime}|${id}`}
                      >
                        {slot.startTime} - {slot.endTime}
                        {slot.technicianName ? ` | ${slot.technicianName}` : ""}
                      </option>
                    );
                  })}
                </select>

                {convertForm.appointmentDate &&
                  !slotLoading &&
                  availableSlots.length === 0 && (
                    <small className="wl-help">
                      Chưa có slot trống phù hợp trong ngày này.
                    </small>
                  )}
              </label>

              <div className="wl-form-actions">
                <button
                  type="submit"
                  className="wl-btn primary"
                  disabled={saving || !convertForm.startTime}
                >
                  {saving ? "Đang tạo lịch..." : "Tạo lịch hẹn"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="wl-card">
          <div className="wl-card-head">
            <div>
              <h2>Danh sách khách chờ slot</h2>
              <p>Luồng chuẩn: WAITING → NOTIFIED → BOOKED hoặc CANCELLED.</p>
            </div>
          </div>

          {loading ? (
            <div className="wl-empty">Đang tải dữ liệu...</div>
          ) : items.length === 0 ? (
            <div className="wl-empty">Chưa có yêu cầu Waiting List.</div>
          ) : (
            <div className="wl-table-wrap">
              <table className="wl-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Dịch vụ</th>
                    <th>Thời gian mong muốn</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.WaitingId}>
                      <td>
                        <div className="wl-customer-cell">
                          <div className="wl-avatar">
                            {item.CustomerAvatarUrl ? (
                              <img
                                src={avatarUrl(item.CustomerAvatarUrl)}
                                alt={item.CustomerName}
                                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = "flex";
                                  }
                                }}
                              />
                            ) : null}
                            <span style={{ display: item.CustomerAvatarUrl ? "none" : "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                              {(item.CustomerName || "?").charAt(0)}
                            </span>
                          </div>

                          <div>
                            <b>{item.CustomerName || "Khách hàng"}</b>
                            <small>{item.CustomerPhone || "-"}</small>
                            <small>{item.CustomerEmail || ""}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <b>{item.ServiceName}</b>
                        <small>{formatMoney(item.Price)}</small>
                        {item.Status === "MATCHED" ? (
                          <small style={{ color: "#c9235e", fontWeight: "bold" }}>
                            Ghép KTV: {item.MatchedEmployeeName}
                          </small>
                        ) : item.PreferredEmployeeName ? (
                          <small>
                            NV mong muốn: {item.PreferredEmployeeName}
                          </small>
                        ) : null}
                      </td>

                      <td>
                        {item.Status === "MATCHED" ? (
                          <div style={{ color: "#db2777" }}>
                            <b>⚡ Ghép: {formatDate(item.MatchedDate)}</b>
                            <small style={{ color: "#c9235e", fontWeight: "bold", display: "block" }}>
                              {item.MatchedStartTime} - {item.MatchedEndTime}
                            </small>
                            <small style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>
                              Còn: <HoldCountdown expiresAt={item.HoldExpiresAt} onTimeout={() => load()} />
                            </small>
                          </div>
                        ) : (
                          <>
                            <b>{formatDate(item.PreferredDate)}</b>
                            <small style={{ display: "block" }}>
                              {item.FlexibleTimeSlot && item.FlexibleTimeSlot !== "CUSTOM"
                                ? (TIME_SLOT_MAP[item.FlexibleTimeSlot] || "Linh hoạt cả ngày")
                                : (item.PreferredTimeFrom && item.PreferredTimeTo
                                  ? `${String(item.PreferredTimeFrom).slice(0, 5)} - ${String(item.PreferredTimeTo).slice(0, 5)}`
                                  : (item.PreferredTime || "Linh hoạt"))}
                            </small>
                          </>
                        )}
                      </td>

                      <td>{item.Reason || item.Note || "Chờ slot trống"}</td>

                      <td>
                        <span className={statusClass(item.Status)}>
                          {statusLabel(item.Status)}
                        </span>
                      </td>

                      <td>{formatDate(item.CreatedAt)}</td>

                      <td>
                        <div className="wl-actions">
                          {["WAITING", "MATCHED"].includes(item.Status) && (
                            <button
                              type="button"
                              className="wl-mini-btn"
                              onClick={() =>
                                updateStatus(item.WaitingId, "NOTIFIED")
                              }
                              disabled={saving}
                            >
                              Đã báo khách
                            </button>
                          )}

                          {["MATCHED", "NOTIFIED"].includes(item.Status) && (
                            <button
                              type="button"
                              className="wl-mini-btn warning"
                              style={{ backgroundColor: "#d97706", color: "#fff" }}
                              onClick={() =>
                                updateStatus(item.WaitingId, "SKIPPED")
                              }
                              disabled={saving}
                            >
                              Bỏ lỡ
                            </button>
                          )}

                          {["WAITING", "NOTIFIED", "MATCHED"].includes(item.Status) && (
                            <button
                              type="button"
                              className="wl-mini-btn primary"
                              onClick={() => openConvertForm(item)}
                              disabled={saving}
                            >
                              Chuyển lịch
                            </button>
                          )}

                          {["WAITING", "NOTIFIED"].includes(item.Status) && (
                            <button
                              type="button"
                              className="wl-mini-btn danger"
                              onClick={() => cancelWaiting(item.WaitingId)}
                              disabled={saving}
                            >
                              Hủy
                            </button>
                          )}

                          {item.Status === "BOOKED" && (
                            <span className="wl-done">Đã tạo lịch</span>
                          )}

                          {item.Status === "CANCELLED" && (
                            <span className="wl-muted">Đã hủy</span>
                          )}

                          {item.Status === "EXPIRED" && (
                            <span className="wl-muted">Hết hạn</span>
                          )}

                          {item.Status === "SKIPPED" && (
                            <span className="wl-muted">Bỏ lỡ</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ReceptionistLayout>
  );
}
