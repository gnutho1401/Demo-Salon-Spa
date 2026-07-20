import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

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
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      const elementPosition = gridRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 180;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const scrollToItem = (id, type = "shift") => {
    setTimeout(() => {
      const element = document.getElementById(`${type}-card-${id}`);
      if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 180;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 20px 5px rgba(214, 181, 126, 0.5)";
        setTimeout(() => {
          element.style.borderColor = "";
          element.style.boxShadow = "";
        }, 3000);
      } else {
        scrollToGrid();
      }
    }, 150);
  };

  const handleFilter = async () => {
    shouldScrollRef.current = true;
    await load();
    scrollToGrid();
    shouldScrollRef.current = false;
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      load();
      return;
    }
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  }, [filters.employeeId, filters.fromDate, filters.toDate, filters.status]);

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

      let shiftId = editingId;
      if (editingId) {
        await axiosClient.put(`/admin/work-shifts/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/work-shifts", payload);
        const created = res.data.data || res.data;
        shiftId = created?.ShiftId || created?.id;
      }

      setShowModal(false);
      await load();
      if (shiftId) {
        scrollToItem(shiftId, "shift");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu ca làm thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyRemove(item) {
    try {
      setError("");
      await axiosClient.delete(`/admin/work-shifts/${item.ShiftId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa ca làm thất bại",
      );
    }
  }

  function remove(item) {
    setConfirmAction({ type: "delete", item });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      await applyRemove(confirmAction.item);
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  function clearFilters() {
    shouldScrollRef.current = true;
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
      <style>{`
        .admin-workshift-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }
        .admin-workshift-hero {
          padding: 28px;
          border-radius: 20px;
          background: linear-gradient(135deg, #2b1c12 0%, #4a3222 100%);
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          box-shadow: 0 10px 25px rgba(43, 28, 18, 0.15);
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .admin-workshift-hero::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: rgba(214, 181, 126, 0.1);
          right: -30px;
          bottom: -30px;
        }
        .admin-workshift-hero h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .admin-workshift-hero p {
          margin: 0;
          color: #f3dfbd;
          font-size: 14px;
          opacity: 0.9;
        }
        .admin-workshift-hero .admin-eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
          font-size: 11px;
          color: #d6b57e;
          margin-bottom: 4px;
        }
        .admin-refresh-btn {
          border: 0;
          border-radius: 30px;
          padding: 12px 24px;
          font-weight: 700;
          color: #2b1c12;
          background: linear-gradient(135deg, #d6b57e, #f0dfbf);
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(214, 181, 126, 0.3);
          white-space: nowrap;
        }
        .admin-refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(214, 181, 126, 0.4);
          background: linear-gradient(135deg, #c7a36c, #e2d0ad);
        }
        
        /* Stats styles */
        .admin-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .admin-stat-card {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          gap: 16px;
          border-left: 4px solid #cbd5e1;
          transition: all 0.3s ease;
        }
        .admin-stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .stat-card-total { border-left-color: #3b82f6; }
        .stat-card-working { border-left-color: #10b981; }
        .stat-card-dayoff { border-left-color: #ef4444; }
        .stat-card-appointments { border-left-color: #8b5cf6; }

        .admin-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f8fafc;
          font-size: 22px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
        }
        .admin-stat-card p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }
        .admin-stat-card h3 {
          margin: 4px 0;
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }
        .admin-stat-card span {
          font-size: 11px;
          color: #94a3b8;
        }

        /* Workshift Grid & Card styling */
        .admin-workshift-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .admin-workshift-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .admin-workshift-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 8px;
          background: linear-gradient(90deg, #d6b57e, #4a3222);
        }
        .admin-workshift-card.is-day-off::before {
          background: linear-gradient(90deg, #94a3b8, #475569);
        }
        .admin-workshift-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(43, 28, 18, 0.12);
          border-color: #d6b57e;
        }
        .admin-workshift-card-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          margin-top: 8px;
        }
        .admin-workshift-top {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }
        .admin-workshift-top img {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d6b57e;
          box-shadow: 0 4px 10px rgba(0,0,0,0.08);
        }
        .admin-workshift-card.is-day-off img {
          border-color: #cbd5e1;
        }
        .admin-workshift-top-info {
          min-width: 0;
        }
        .admin-workshift-top-info h3 {
          margin: 0;
          font-size: 16px;
          color: #1e293b;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .admin-workshift-top-info p {
          margin: 2px 0 6px 0;
          font-size: 13px;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge-working { background: #dcfce7; color: #15803d; }
        .status-badge-day-off { background: #f1f5f9; color: #475569; }

        .admin-workshift-time {
          background: #f8fafc;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .admin-workshift-time strong {
          color: #1e293b;
        }
        .admin-workshift-time span {
          color: #a0573a;
          font-weight: 700;
        }
        .is-day-off .admin-workshift-time span {
          color: #64748b;
        }

        .admin-workshift-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .info-item {
          background: #f8fafc;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .info-item span {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .info-item strong {
          color: #334155;
          font-size: 12.5px;
        }

        .admin-workshift-note {
          margin: 0 0 16px 0;
          font-size: 13px;
          color: #475569;
          background: #fdfbf7;
          padding: 10px 12px;
          border-radius: 8px;
          border-left: 3px solid #d6b57e;
          font-style: italic;
        }
        .is-day-off .admin-workshift-note {
          border-left-color: #94a3b8;
          background: #f8fafc;
        }

        /* Buttons and actions */
        .admin-card-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
        }
        .card-btn-action {
          border: 0;
          border-radius: 6px;
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .card-btn-action.btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        .card-btn-action.btn-secondary:hover {
          background: #e2e8f0;
        }
        .card-btn-action.btn-primary {
          background: #a0573a;
          color: #ffffff;
        }
        .card-btn-action.btn-primary:hover {
          background: #8b4a2f;
        }
        .card-btn-action.btn-danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        .card-btn-action.btn-danger:hover {
          background: #fca5a5;
        }

        /* Modals and Forms */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          width: 90%;
          max-width: 600px;
          position: relative;
        }
        .admin-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          font-size: 20px;
          color: #64748b;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all 0.2s;
        }
        .admin-modal-close:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        .modal-title {
          padding: 20px 24px;
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-body {
          padding: 24px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        /* Detail Modal layout */
        .detail-header {
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 20px;
        }
        .detail-header img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #d6b57e;
        }
        .detail-header-info h2 {
          margin: 0;
          font-size: 22px;
          color: #1e293b;
        }
        .detail-header-info p {
          margin: 4px 0;
          color: #64748b;
          font-size: 14px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .detail-grid p {
          margin: 0;
          font-size: 14px;
          color: #475569;
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }

        /* Form styling */
        .admin-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .admin-form-grid {
            grid-template-columns: 1fr;
          }
        }
        .admin-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .admin-form-grid input,
        .admin-form-grid select,
        .admin-form-grid textarea {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          transition: all 0.2s;
          width: 100%;
        }
        .admin-form-grid input:focus,
        .admin-form-grid select:focus,
        .admin-form-grid textarea:focus {
          border-color: #a0573a;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }
        .admin-form-wide {
          grid-column: 1 / -1;
        }
        .admin-checkbox-label {
          flex-direction: row !important;
          align-items: center;
          gap: 10px !important;
          cursor: pointer;
          user-select: none;
          margin-top: 8px;
        }
        .admin-checkbox-label input {
          width: 18px !important;
          height: 18px !important;
          accent-color: #a0573a;
          cursor: pointer;
        }
        .admin-empty {
          grid-column: 1 / -1;
          padding: 40px;
          background: #ffffff;
          border-radius: 16px;
          text-align: center;
          color: #64748b;
          font-size: 15px;
          border: 1px dashed rgba(173, 136, 83, 0.3);
        }
      `}</style>

      <div className="admin-workshift-hero">
        <div>
          <div className="admin-eyebrow">Work Shifts Management</div>
          <h1>Quản lý ca làm</h1>
          <p>
            Tạo, sửa, lọc và quản lý lịch làm việc/ngày nghỉ cho nhân viên Spa. Hệ thống tự động kiểm tra trùng ca làm.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm ca làm
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card stat-card-total">
          <div className="admin-stat-icon">📅</div>
          <div>
            <p>Tổng ca</p>
            <h3>{stats.total}</h3>
            <span>Ca làm trong bộ lọc</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-working">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Ca làm việc</p>
            <h3>{stats.working}</h3>
            <span>KTV trực tiếp phục vụ</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-dayoff">
          <div className="admin-stat-icon">☕</div>
          <div>
            <p>Ngày nghỉ</p>
            <h3>{stats.dayOff}</h3>
            <span>Ngày đăng ký nghỉ phép</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-appointments">
          <div className="admin-stat-icon">🧾</div>
          <div>
            <p>Lịch hẹn liên quan</p>
            <h3>{stats.appointments}</h3>
            <span>Tổng lịch trong ngày ca</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-workshift-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFilter();
            }
          }}
          placeholder="Tìm kỹ thuật viên, email, chuyên môn..."
        />

        <select
          value={filters.employeeId}
          onChange={(e) => {
            setFilters({ ...filters, employeeId: e.target.value });
            shouldScrollRef.current = true;
          }}
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
          onChange={(e) => {
            setFilters({ ...filters, fromDate: e.target.value });
            shouldScrollRef.current = true;
          }}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => {
            setFilters({ ...filters, toDate: e.target.value });
            shouldScrollRef.current = true;
          }}
        />

        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            shouldScrollRef.current = true;
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="WORKING">WORKING</option>
          <option value="DAY_OFF">DAY_OFF</option>
        </select>

        <button className="admin-refresh-btn" style={{ padding: "10px 20px" }} onClick={handleFilter}>
          Lọc
        </button>

        <button className="card-btn-action btn-secondary" onClick={clearFilters}>
          Xóa lọc
        </button>
      </div>

      <div ref={gridRef}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            Đang tải danh sách ca làm...
          </div>
        ) : (
          <div className="admin-workshift-grid">
            {items.map((item) => (
              <article
                className={`admin-workshift-card ${item.IsDayOff ? "is-day-off" : ""}`}
                id={`shift-card-${item.ShiftId}`}
                key={item.ShiftId}
              >
                <div className="admin-workshift-card-body">
                  <div className="admin-workshift-top">
                    <img
                      src={avatar(item.ImageUrl || item.AvatarUrl)}
                      alt={item.EmployeeName}
                    />

                    <div className="admin-workshift-top-info">
                      <h3>{item.EmployeeName}</h3>
                      <p>{item.Specialization || item.Position || "Employee"}</p>
                      <span className={`status-badge status-badge-${item.IsDayOff ? "day-off" : "working"}`}>
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
                    <div className="info-item">
                      <span>Loại ca</span>
                      <strong>{item.ShiftType || "NORMAL"}</strong>
                    </div>
                    <div className="info-item">
                      <span>Chi nhánh</span>
                      <strong>{item.BranchName || "Chưa có"}</strong>
                    </div>
                    <div className="info-item">
                      <span>Lịch hẹn</span>
                      <strong>{item.AppointmentCount || 0} ca</strong>
                    </div>
                    <div className="info-item">
                      <span>Trạng thái NV</span>
                      <strong>{item.EmployeeStatus || "N/A"}</strong>
                    </div>
                  </div>

                  <p className="admin-workshift-note">
                    {item.Notes || "Không có ghi chú."}
                  </p>

                  <div className="admin-card-actions">
                    <button className="card-btn-action btn-secondary" style={{ flexGrow: 1 }} onClick={() => setSelected(item)}>
                      Chi tiết
                    </button>
                    <button
                      className="card-btn-action btn-primary"
                      style={{ flexGrow: 1 }}
                      onClick={() => openEdit(item)}
                    >
                      Sửa
                    </button>
                    <button
                      className="card-btn-action btn-danger"
                      onClick={() => remove(item)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!items.length ? (
              <div className="admin-empty">Không tìm thấy ca làm phù hợp bộ lọc.</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            <h3 className="modal-title">Chi tiết ca làm việc</h3>

            <div className="modal-body">
              <div className="detail-header">
                <img
                  src={avatar(selected.ImageUrl || selected.AvatarUrl)}
                  alt={selected.EmployeeName}
                />
                <div className="detail-header-info">
                  <h2>{selected.EmployeeName}</h2>
                  <p>{selected.Email}</p>
                  <span className={`status-badge status-badge-${selected.IsDayOff ? "day-off" : "working"}`}>
                    {selected.IsDayOff ? "DAY_OFF" : "WORKING"}
                  </span>
                </div>
              </div>

              <div className="detail-grid">
                <p><strong>Ngày trực:</strong> {dateText(selected.ShiftDate)}</p>
                <p>
                  <strong>Thời gian ca:</strong>{" "}
                  {selected.IsDayOff
                    ? "Nghỉ phép cả ngày"
                    : `${timeText(selected.StartTime)} - ${timeText(selected.EndTime)}`}
                </p>
                <p><strong>Loại ca làm:</strong> {selected.ShiftType || "NORMAL"}</p>
                <p><strong>Cơ sở trực:</strong> {selected.BranchName || "Chưa có"}</p>
                <p><strong>Vị trí công tác:</strong> {selected.Position || "Chưa có"}</p>
                <p><strong>Lĩnh vực:</strong> {selected.Specialization || "Chưa có"}</p>
                <p><strong>Liên hệ (SĐT):</strong> {selected.Phone || "Chưa có"}</p>
                <p><strong>Lịch hẹn phụ trách:</strong> {selected.AppointmentCount || 0} ca</p>
              </div>

              <div style={{ marginTop: "16px", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <strong style={{ display: "block", color: "#475569", marginBottom: "6px", fontSize: "14px" }}>Ghi chú ca làm</strong>
                <p style={{ margin: 0, padding: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#334155" }}>
                  {selected.Notes || "Không có ghi chú nào."}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="card-btn-action btn-secondary" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add / Edit Form Modal */}
      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "550px" }}
          >
            <button type="button" className="admin-modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="modal-title">{editingId ? "Cập nhật ca làm việc" : "Thêm ca làm việc mới"}</h3>

            <div className="modal-body">
              <div className="admin-form-grid">
                <label className="admin-form-wide">
                  Kỹ thuật viên phụ trách *
                  <select
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    required
                  >
                    <option value="">Chọn nhân viên</option>
                    {technicians.map((t) => (
                      <option key={t.EmployeeId} value={t.EmployeeId}>
                        {t.FullName} - {t.Specialization || t.Position || "Kỹ thuật viên"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-form-wide">
                  Ngày làm việc *
                  <input
                    type="date"
                    value={form.shiftDate}
                    onChange={(e) => setForm({ ...form, shiftDate: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Giờ bắt đầu
                  <input
                    type="time"
                    value={form.startTime}
                    disabled={form.isDayOff}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </label>

                <label>
                  Giờ kết thúc
                  <input
                    type="time"
                    value={form.endTime}
                    disabled={form.isDayOff}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </label>

                <label className="admin-form-wide">
                  Phân loại ca trực
                  <select
                    value={form.shiftType}
                    disabled={form.isDayOff}
                    onChange={(e) => setForm({ ...form, shiftType: e.target.value })}
                  >
                    <option value="NORMAL">NORMAL (Ca thường)</option>
                    <option value="MORNING">MORNING (Ca sáng)</option>
                    <option value="AFTERNOON">AFTERNOON (Ca chiều)</option>
                    <option value="EVENING">EVENING (Ca tối)</option>
                    <option value="OVERTIME">OVERTIME (Tăng ca)</option>
                  </select>
                </label>

                <label className="admin-checkbox-label admin-form-wide">
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
                  Ghi chú ca trực
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="Ví dụ: nghỉ phép, đổi ca, làm thêm..."
                  />
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="card-btn-action btn-secondary" onClick={() => setShowModal(false)}>
                Hủy bỏ
              </button>
              <button className="card-btn-action btn-primary" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu ca làm"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(confirmAction)}
        title="Xóa ca làm việc?"
        description="Ca làm sẽ biến mất khỏi lịch phân công. Hãy kiểm tra nhân viên và ngày làm trước khi tiếp tục."
        details={
          confirmAction ? (
            <>
              <strong>{confirmAction.item.EmployeeName}</strong>
              <span> · {dateText(confirmAction.item.ShiftDate)}</span>
            </>
          ) : null
        }
        confirmLabel="Xóa ca làm"
        tone="danger"
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
      />
    </section>
  );
}
