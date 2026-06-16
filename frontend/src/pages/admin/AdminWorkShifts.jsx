import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

const emptyForm = {
  employeeId: "",
  shiftDate: "",
  startTime: "08:00",
  endTime: "17:00",
  shiftType: "NORMAL",
  isDayOff: false,
  notes: "",
};

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function timeText(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusClass(status) {
  return `admin-status admin-status-${String(status || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminWorkShifts() {
  const [items, setItems] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    employeeId: "",
    fromDate: "",
    toDate: "",
    status: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);

      const [listRes, techRes] = await Promise.all([
        axiosClient.get("/admin/work-shifts", {
          params: {
            keyword: filters.keyword || undefined,
            employeeId: filters.employeeId || undefined,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
            status: filters.status || undefined,
          },
        }),
        axiosClient.get("/admin/work-shifts/technicians"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setTechnicians(techRes.data.data || techRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách ca làm",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const working = items.filter((x) => !x.IsDayOff).length;
    const dayOff = items.filter((x) => x.IsDayOff).length;
    const appointments = items.reduce(
      (sum, x) => sum + Number(x.AppointmentCount || 0),
      0,
    );

    return { total, working, dayOff, appointments };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item) {
    const isDayOff = !!item.IsDayOff;

    setEditingId(item.ShiftId);
    setForm({
      employeeId: String(item.EmployeeId || ""),
      shiftDate: String(item.ShiftDate || "").slice(0, 10),
      startTime: isDayOff ? "08:00" : timeText(item.StartTime),
      endTime: isDayOff ? "17:00" : timeText(item.EndTime),
      shiftType: item.ShiftType || (isDayOff ? "DAY_OFF" : "NORMAL"),
      isDayOff,
      notes: item.Notes || "",
    });

    setShowModal(true);
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.employeeId) return setError("Vui lòng chọn nhân viên");
    if (!form.shiftDate) return setError("Vui lòng chọn ngày làm");
    if (!form.isDayOff && (!form.startTime || !form.endTime)) {
      return setError("Vui lòng nhập giờ bắt đầu và kết thúc");
    }

    const payload = {
      employeeId: Number(form.employeeId),
      shiftDate: form.shiftDate,
      startTime: form.isDayOff ? null : form.startTime,
      endTime: form.isDayOff ? null : form.endTime,
      shiftType: form.isDayOff ? "DAY_OFF" : form.shiftType || "NORMAL",
      isDayOff: form.isDayOff ? 1 : 0,
      notes: form.notes || null,
    };

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await axiosClient.put(`/admin/work-shifts/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/work-shifts", payload);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu ca làm thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa ca làm của ${item.EmployeeName} ngày ${dateText(
        item.ShiftDate,
      )}?`,
    );

    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/work-shifts/${item.ShiftId}`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa ca làm thất bại",
      );
    }
  }

  function clearFilters() {
    setFilters({
      keyword: "",
      employeeId: "",
      fromDate: "",
      toDate: "",
      status: "",
    });
  }

  return (
    <section className="admin-page admin-workshift-page">
      <div className="admin-workshift-hero">
        <div>
          <div className="admin-eyebrow">Work Shifts Management</div>
          <h1>Quản lý ca làm</h1>
          <p>
            Tạo, sửa, lọc và quản lý lịch làm việc/ngày nghỉ cho nhân viên. Hệ
            thống tự kiểm tra trùng ca và không cho đặt ngày nghỉ nếu đã có lịch
            hẹn.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm ca làm
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div>
            <p>Tổng ca</p>
            <h3>{stats.total}</h3>
            <span>Theo bộ lọc hiện tại</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Ca làm việc</p>
            <h3>{stats.working}</h3>
            <span>Không tính ngày nghỉ</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">☕</div>
          <div>
            <p>Ngày nghỉ</p>
            <h3>{stats.dayOff}</h3>
            <span>IsDayOff = true</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🧾</div>
          <div>
            <p>Lịch hẹn liên quan</p>
            <h3>{stats.appointments}</h3>
            <span>Appointment trong ngày ca</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-workshift-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm kỹ thuật viên, email, chuyên môn..."
        />

        <select
          value={filters.employeeId}
          onChange={(e) =>
            setFilters({ ...filters, employeeId: e.target.value })
          }
        >
          <option value="">Tất cả kỹ thuật viên</option>
          {technicians.map((t) => (
            <option key={t.EmployeeId} value={t.EmployeeId}>
              {t.FullName}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        />

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="WORKING">WORKING</option>
          <option value="DAY_OFF">DAY_OFF</option>
        </select>

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button className="card-btn" onClick={clearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách ca làm...</div>
      ) : null}

      {!loading ? (
        <div className="admin-workshift-grid">
          {items.map((item) => (
            <article
              className={`admin-workshift-card ${
                item.IsDayOff ? "is-day-off" : ""
              }`}
              key={item.ShiftId}
            >
              <div className="admin-workshift-top">
                <img
                  src={avatar(item.ImageUrl || item.AvatarUrl)}
                  alt={item.EmployeeName}
                />

                <div>
                  <h3>{item.EmployeeName}</h3>
                  <p>{item.Specialization || item.Position || "Employee"}</p>
                  <span
                    className={statusClass(
                      item.IsDayOff ? "DAY_OFF" : "WORKING",
                    )}
                  >
                    {item.IsDayOff ? "DAY_OFF" : "WORKING"}
                  </span>
                </div>
              </div>

              <div className="admin-workshift-time">
                <strong>{dateText(item.ShiftDate)}</strong>
                <span>
                  {item.IsDayOff
                    ? "Nghỉ cả ngày"
                    : `${timeText(item.StartTime)} - ${timeText(item.EndTime)}`}
                </span>
              </div>

              <div className="admin-workshift-info">
                <div>
                  <span>Loại ca</span>
                  <strong>{item.ShiftType || "NORMAL"}</strong>
                </div>
                <div>
                  <span>Chi nhánh</span>
                  <strong>{item.BranchName || "Chưa có"}</strong>
                </div>
                <div>
                  <span>Lịch hẹn</span>
                  <strong>{item.AppointmentCount || 0}</strong>
                </div>
                <div>
                  <span>Trạng thái NV</span>
                  <strong>{item.EmployeeStatus || "N/A"}</strong>
                </div>
              </div>

              <p className="admin-workshift-note">
                {item.Notes || "Không có ghi chú."}
              </p>

              <div className="admin-card-actions">
                <button className="card-btn" onClick={() => setSelected(item)}>
                  Chi tiết
                </button>
                <button
                  className="card-btn primary"
                  onClick={() => openEdit(item)}
                >
                  Sửa
                </button>
                <button
                  className="card-btn danger"
                  onClick={() => remove(item)}
                >
                  Xóa
                </button>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có ca làm phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-workshift-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="admin-detail-head">
              <img
                src={avatar(selected.ImageUrl || selected.AvatarUrl)}
                alt={selected.EmployeeName}
              />

              <div>
                <h3>{selected.EmployeeName}</h3>
                <p>{selected.Email}</p>
                <span
                  className={statusClass(
                    selected.IsDayOff ? "DAY_OFF" : "WORKING",
                  )}
                >
                  {selected.IsDayOff ? "DAY_OFF" : "WORKING"}
                </span>
              </div>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>Ngày:</strong> {dateText(selected.ShiftDate)}
              </p>
              <p>
                <strong>Thời gian:</strong>{" "}
                {selected.IsDayOff
                  ? "Nghỉ cả ngày"
                  : `${timeText(selected.StartTime)} - ${timeText(selected.EndTime)}`}
              </p>
              <p>
                <strong>Loại ca:</strong> {selected.ShiftType || "NORMAL"}
              </p>
              <p>
                <strong>Chi nhánh:</strong> {selected.BranchName || "Chưa có"}
              </p>
              <p>
                <strong>Vị trí:</strong> {selected.Position || "Chưa có"}
              </p>
              <p>
                <strong>Chuyên môn:</strong>{" "}
                {selected.Specialization || "Chưa có"}
              </p>
              <p>
                <strong>SĐT:</strong> {selected.Phone || "Chưa có"}
              </p>
              <p>
                <strong>Lịch hẹn trong ngày:</strong>{" "}
                {selected.AppointmentCount || 0}
              </p>
            </div>

            <div className="admin-detail-bio">
              <strong>Ghi chú</strong>
              <p>{selected.Notes || "Không có ghi chú."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-workshift-form"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>

            <h3>{editingId ? "Sửa ca làm" : "Thêm ca làm"}</h3>

            <div className="admin-form-grid">
              <label>
                Kỹ thuật viên *
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm({ ...form, employeeId: e.target.value })
                  }
                  required
                >
                  <option value="">Chọn nhân viên</option>
                  {technicians.map((t) => (
                    <option key={t.EmployeeId} value={t.EmployeeId}>
                      {t.FullName} -{" "}
                      {t.Specialization || t.Position || "Employee"}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ngày làm *
                <input
                  type="date"
                  value={form.shiftDate}
                  onChange={(e) =>
                    setForm({ ...form, shiftDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Giờ bắt đầu
                <input
                  type="time"
                  value={form.startTime}
                  disabled={form.isDayOff}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </label>

              <label>
                Giờ kết thúc
                <input
                  type="time"
                  value={form.endTime}
                  disabled={form.isDayOff}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </label>

              <label>
                Loại ca
                <select
                  value={form.shiftType}
                  disabled={form.isDayOff}
                  onChange={(e) =>
                    setForm({ ...form, shiftType: e.target.value })
                  }
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="MORNING">MORNING</option>
                  <option value="AFTERNOON">AFTERNOON</option>
                  <option value="EVENING">EVENING</option>
                  <option value="OVERTIME">OVERTIME</option>
                </select>
              </label>

              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isDayOff}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isDayOff: e.target.checked,
                      shiftType: e.target.checked ? "DAY_OFF" : "NORMAL",
                    })
                  }
                />
                Đánh dấu ngày nghỉ
              </label>

              <label className="admin-form-wide">
                Ghi chú
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={4}
                  placeholder="Ví dụ: nghỉ phép, đổi ca, làm thêm..."
                />
              </label>
            </div>

            <div className="admin-form-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setShowModal(false)}
              >
                Hủy
              </button>

              <button
                className="card-btn primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu ca làm"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
