import { useEffect, useMemo, useState } from "react";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

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
      const exp = new Date(expiresAt).getTime();
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
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
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
    preferredTime: "",
    reason: "Khách muốn chờ nếu có slot trống",
    note: "",
  });

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
        preferredTime: "",
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
    if (!window.confirm("Bạn chắc chắn muốn hủy yêu cầu chờ này?")) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.delete(`/receptionist/waiting-list/${waitingId}`);

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
    const appointmentDate = item.PreferredDate
      ? String(item.PreferredDate).slice(0, 10)
      : "";

    const technicianId =
      item.PreferredEmployeeId || item.EmployeeId || item.TechnicianId || "";

    const next = {
      waitingId: item.WaitingId,
      technicianId,
      appointmentDate,
      startTime: "",
    };

    setConvertForm(next);
    setAvailableSlots([]);

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
              <span>Giờ mong muốn</span>
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) =>
                  setForm({ ...form, preferredTime: e.target.value })
                }
              />
            </label>

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
                  {technicians.map((t) => {
                    const id = t.EmployeeId || t.TechnicianId;

                    return (
                      <option key={id} value={id}>
                        {t.FullName || t.TechnicianName}
                      </option>
                    );
                  })}
                </select>
              </label>

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
                  value={convertForm.startTime}
                  onChange={(e) =>
                    setConvertForm({
                      ...convertForm,
                      startTime: e.target.value,
                    })
                  }
                  disabled={slotLoading}
                  required
                >
                  <option value="">
                    {slotLoading ? "Đang tải slot..." : "Chọn slot trống"}
                  </option>

                  {availableSlots.map((slot) => (
                    <option
                      key={`${slot.startTime}-${slot.employeeId}`}
                      value={slot.startTime}
                    >
                      {slot.startTime} - {slot.endTime}
                      {slot.technicianName ? ` | ${slot.technicianName}` : ""}
                    </option>
                  ))}
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
                            {(item.CustomerName || "?").charAt(0)}
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
                            <small>
                              {item.PreferredTime ||
                                item.PreferredTimeFrom ||
                                "Linh hoạt"}
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
                          {item.Status === "WAITING" && (
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

                          {["WAITING", "NOTIFIED", "MATCHED", "SKIPPED", "EXPIRED"].includes(item.Status) && (
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
