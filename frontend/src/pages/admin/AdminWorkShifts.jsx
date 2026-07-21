import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const PRESET_SHIFTS = [
  { name: "Ca sáng", startTime: "08:00", endTime: "12:00" },
  { name: "Ca chiều", startTime: "12:00", endTime: "18:00" },
  { name: "Ca tối", startTime: "18:00", endTime: "22:00" },
  { name: "Cả ngày", startTime: "08:00", endTime: "22:00" },
];

const emptyForm = {
  shiftName: "Ca sáng",
  shiftDate: new Date().toISOString().slice(0, 10),
  startTime: "08:00",
  endTime: "12:00",
  maxTechnicians: 6,
  status: "OPEN",
};

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function formatDateFull(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusBadge(status) {
  const s = String(status || "OPEN").toUpperCase();
  if (s === "OPEN") return { text: "MỞ ĐĂNG KÝ", class: "badge-open", color: "#10b981", bg: "#dcfce7" };
  if (s === "FULL") return { text: "ĐÃ ĐẦY KTV", class: "badge-full", color: "#f59e0b", bg: "#fef3c7" };
  return { text: "ĐÃ ĐÓNG", class: "badge-closed", color: "#ef4444", bg: "#fee2e2" };
}

export default function AdminWorkShifts() {
  const [items, setItems] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [filters, setFilters] = useState({
    shiftDate: "",
    status: "",
    keyword: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [scrollTargetId, setScrollTargetId] = useState(null);

  // Registration modal states
  const [assignShift, setAssignShift] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  };

  const triggerScrollToItem = (id) => {
    if (!id) return;
    setScrollTargetId(id);
  };

  useLayoutEffect(() => {
    if (!scrollTargetId) return;

    const el = document.getElementById(`shift-card-${scrollTargetId}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });

      el.style.transition = "all 0.3s ease";
      el.style.borderColor = "#d6b57e";
      el.style.boxShadow = "0 0 30px 8px rgba(214, 181, 126, 0.8)";
      el.style.transform = "scale(1.02)";

      const timer = setTimeout(() => {
        el.style.borderColor = "";
        el.style.boxShadow = "";
        el.style.transform = "";
        setScrollTargetId(null);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [items, scrollTargetId]);

  async function load(isSilent = false) {
    try {
      setError("");
      if (!isSilent && items.length === 0) setLoading(true);

      const [listRes, techRes] = await Promise.all([
        axiosClient.get("/admin/work-shifts", {
          params: {
            shiftDate: filters.shiftDate || undefined,
            status: filters.status || undefined,
            keyword: filters.keyword || undefined,
          },
        }),
        axiosClient.get("/admin/work-shifts/technicians"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setTechnicians(techRes.data.data || techRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Không tải được danh sách ca làm",
      );
    } finally {
      setLoading(false);
    }
  }

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
  }, [filters.shiftDate, filters.status]);

  const stats = useMemo(() => {
    const total = items.length;
    const open = items.filter((x) => x.Status === "OPEN").length;
    const full = items.filter((x) => x.Status === "FULL").length;
    const closed = items.filter((x) => x.Status === "CLOSED").length;
    const totalRegs = items.reduce((sum, x) => sum + Number(x.RegisteredCount || 0), 0);
    return { total, open, full, closed, totalRegs };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
    setError("");
  }

  function openEdit(item) {
    setEditingId(item.ShiftId);
    setForm({
      shiftName: item.ShiftName || "Ca sáng",
      shiftDate: item.ShiftDate ? String(item.ShiftDate).slice(0, 10) : "",
      startTime: item.StartTime || "08:00",
      endTime: item.EndTime || "12:00",
      maxTechnicians: item.MaxTechnicians || 6,
      status: item.Status || "OPEN",
    });
    setShowModal(true);
    triggerScrollToItem(item.ShiftId);
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.shiftName.trim()) return setError("Vui lòng nhập tên ca làm");
    if (!form.shiftDate) return setError("Vui lòng chọn ngày làm");
    if (!form.startTime || !form.endTime) return setError("Vui lòng chọn giờ bắt đầu và kết thúc");

    try {
      setSaving(true);
      setError("");

      let shiftId = editingId;
      if (editingId) {
        await axiosClient.put(`/admin/work-shifts/${editingId}`, form);
      } else {
        const res = await axiosClient.post("/admin/work-shifts", form);
        const created = res.data.data || res.data;
        shiftId = created?.ShiftId || created?.id;
      }

      setShowModal(false);
      await load(true);
      if (shiftId) {
        triggerScrollToItem(shiftId);
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

  async function toggleStatus(item) {
    const nextStatus = item.Status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      setError("");
      await axiosClient.put(`/admin/work-shifts/${item.ShiftId}`, {
        ...item,
        status: nextStatus,
      });
      await load(true);
      triggerScrollToItem(item.ShiftId);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Cập nhật trạng thái thất bại");
    }
  }

  async function remove(item) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa ca làm "${item.ShiftName}" ngày ${formatDateFull(item.ShiftDate)}?`,
    );

    if (!ok) return;

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

  // Open Shift Registration & Assignment Modal
  async function openAssignModal(shift) {
    setAssignShift(shift);
    setSelectedTechId("");
    setLoadingRegs(true);
    triggerScrollToItem(shift.ShiftId);

    try {
      const res = await axiosClient.get(`/admin/work-shifts/${shift.ShiftId}/registrations`);
      setRegistrations(res.data.data || res.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách phân ca", err);
      alert("Không tải được danh sách phân ca của KTV");
    } finally {
      setLoadingRegs(false);
    }
  }

  async function handleAssignTech() {
    if (!selectedTechId || !assignShift) return;
    try {
      setAssigning(true);
      const res = await axiosClient.post(`/admin/work-shifts/${assignShift.ShiftId}/assign`, {
        technicianId: Number(selectedTechId),
      });
      setRegistrations(res.data.data || res.data || []);
      setSelectedTechId("");
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Phân ca cho KTV thất bại");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveReg(regId) {
    if (!window.confirm("Bỏ phân công KTV này khỏi ca làm?")) return;
    try {
      await axiosClient.delete(`/admin/work-shifts/registrations/${regId}`);
      setRegistrations((prev) => prev.filter((r) => r.RegistrationId !== regId));
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Xóa phân ca thất bại");
    }
  }

  async function handleUpdateRegStatus(regId, newStatus) {
    try {
      await axiosClient.patch(`/admin/work-shifts/registrations/${regId}/status`, { status: newStatus });
      setRegistrations((prev) =>
        prev.map((r) => (r.RegistrationId === regId ? { ...r, Status: newStatus } : r))
      );
      await load();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Cập nhật trạng thái thất bại");
    }
  }

  function handleFilterClick() {
    shouldScrollRef.current = true;
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  }

  function clearFilters() {
    setFilters({ shiftDate: "", status: "", keyword: "" });
    shouldScrollRef.current = true;
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  }

  function applyQuickDate(daysOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = d.toISOString().slice(0, 10);
    setFilters((prev) => ({ ...prev, shiftDate: dateStr }));
    shouldScrollRef.current = true;
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
          font-size: 14px;
        }
        .admin-refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(214, 181, 126, 0.4);
          background: linear-gradient(135deg, #c7a36c, #e2d0ad);
        }

        /* Stat Grid */
        .admin-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        .stat-card-open { border-left-color: #10b981; }
        .stat-card-full { border-left-color: #f59e0b; }
        .stat-card-regs { border-left-color: #8b5cf6; }

        .admin-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f8fafc;
          font-size: 22px;
        }
        .admin-stat-card p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }
        .admin-stat-card h3 {
          margin: 4px 0 0 0;
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }

        /* Filter Panel */
        .admin-filter-panel {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(43, 28, 18, 0.08);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          border: 1px solid rgba(173, 136, 83, 0.15);
        }
        .filter-input-date,
        .filter-select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s;
        }
        .filter-input-date:focus,
        .filter-select:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }
        .quick-date-btn {
          padding: 8px 14px;
          border-radius: 20px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }
        .quick-date-btn:hover {
          border-color: #a0573a;
          color: #a0573a;
          background: #fdf8f6;
        }

        /* Grid */
        .admin-shift-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .admin-shift-card {
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }
        .admin-shift-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 25px -5px rgba(43, 28, 18, 0.12);
          border-color: #d6b57e;
        }
        .card-shift-header {
          padding: 16px 20px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-shift-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }
        .shift-status-pill {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .admin-shift-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .shift-info-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: #475569;
        }
        .shift-info-row strong {
          color: #1e293b;
        }

        /* Capacity bar */
        .capacity-box {
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .capacity-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
        }
        .capacity-bar-bg {
          height: 8px;
          background: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }
        .capacity-bar-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.4s ease;
        }

        .tech-avatars-row {
          display: flex;
          align-items: center;
          gap: -8px;
          margin-top: 4px;
        }
        .tech-avatar-img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-right: -8px;
        }

        .card-btn-action {
          border: 0;
          border-radius: 8px;
          padding: 9px 14px;
          font-weight: 700;
          font-size: 12.5px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary { background: #f1f5f9; color: #475569; }
        .btn-secondary:hover { background: #e2e8f0; }
        .btn-primary { background: #a0573a; color: #ffffff; }
        .btn-primary:hover { background: #8b4a2f; }
        .btn-danger { background: #fee2e2; color: #b91c1c; }
        .btn-danger:hover { background: #fca5a5; }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          width: 90%;
          max-width: 620px;
          position: relative;
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
        .admin-modal-close {
          position: absolute;
          top: 16px; right: 16px;
          width: 32px; height: 32px;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          font-size: 20px;
          color: #64748b;
          cursor: pointer;
          display: grid;
          place-items: center;
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

        .admin-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .form-input, .form-select {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
        }
        .form-wide { grid-column: 1 / -1; }

        .preset-btn-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .preset-chip {
          padding: 6px 12px;
          border-radius: 16px;
          border: 1px solid #d6b57e;
          background: #fefcf9;
          font-size: 12px;
          font-weight: 700;
          color: #a0573a;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-chip:hover {
          background: #a0573a;
          color: #ffffff;
        }

        .reg-item-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border-radius: 12px;
          margin-bottom: 10px;
          border: 1px solid #e2e8f0;
        }
        .reg-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .reg-user-info img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d6b57e;
        }
      `}</style>

      {/* Hero section */}
      <div className="admin-workshift-hero">
        <div>
          <div className="admin-eyebrow">Quản lý Ca làm việc</div>
          <h1>Phân ca & Quản lý Ca làm</h1>
          <p>Tạo lập lịch làm việc, giới hạn số lượng KTV và phân công kỹ thuật viên phụ trách dịch vụ Spa.</p>
        </div>
        <button className="admin-refresh-btn" onClick={openCreate}>
          + Tạo ca làm mới
        </button>
      </div>

      {error ? <div className="admin-error-card" style={{ marginBottom: "20px", padding: "14px", background: "#fee2e2", color: "#b91c1c", borderRadius: "12px" }}>{error}</div> : null}

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <article className="admin-stat-card stat-card-total">
          <div className="admin-stat-icon">📅</div>
          <div>
            <p>Tổng ca làm</p>
            <h3>{stats.total}</h3>
          </div>
        </article>

        <article className="admin-stat-card stat-card-open">
          <div className="admin-stat-icon">🟢</div>
          <div>
            <p>Ca đang mở</p>
            <h3>{stats.open}</h3>
          </div>
        </article>

        <article className="admin-stat-card stat-card-full">
          <div className="admin-stat-icon">🟡</div>
          <div>
            <p>Ca đã đầy</p>
            <h3>{stats.full}</h3>
          </div>
        </article>

        <article className="admin-stat-card stat-card-regs">
          <div className="admin-stat-icon">💆‍♀️</div>
          <div>
            <p>Lượt phân ca KTV</p>
            <h3>{stats.totalRegs}</h3>
          </div>
        </article>
      </div>

      {/* Filter panel */}
      <div className="admin-filter-panel">
        <label style={{ fontSize: "13px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: "8px" }}>
          Lọc ngày:
          <input
            type="date"
            className="filter-input-date"
            value={filters.shiftDate}
            onChange={(e) => setFilters({ ...filters, shiftDate: e.target.value })}
          />
        </label>

        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">OPEN (Đang mở)</option>
          <option value="FULL">FULL (Đã đầy)</option>
          <option value="CLOSED">CLOSED (Đã đóng)</option>
        </select>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button type="button" className="quick-date-btn" onClick={() => applyQuickDate(0)}>Hôm nay</button>
          <button type="button" className="quick-date-btn" onClick={() => applyQuickDate(1)}>Ngày mai</button>
          <button type="button" className="quick-date-btn" onClick={clearFilters}>Xóa lọc</button>
        </div>
      </div>

      {/* Grid listing */}
      <div ref={gridRef}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "16px" }}>
            Đang tải danh sách ca làm việc...
          </div>
        ) : (
          <div className="admin-shift-grid">
            {items.map((item) => {
              const b = statusBadge(item.Status);
              const max = Number(item.MaxTechnicians || 6);
              const reg = Number(item.RegisteredCount || 0);
              const pct = Math.min(100, Math.round((reg / max) * 100));
              const fillColor = pct >= 100 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "#10b981";

              return (
                <article className="admin-shift-card" id={`shift-card-${item.ShiftId}`} key={item.ShiftId}>
                  <div className="card-shift-header">
                    <h3>{item.ShiftName}</h3>
                    <span className="shift-status-pill" style={{ color: b.color, background: b.bg }}>
                      {b.text}
                    </span>
                  </div>

                  <div className="admin-shift-body">
                    <div className="shift-info-row">
                      <span>📆</span>
                      <strong>{formatDateFull(item.ShiftDate)}</strong>
                    </div>

                    <div className="shift-info-row">
                      <span>⏰</span>
                      <strong>{item.StartTime} - {item.EndTime}</strong>
                    </div>

                    {/* Capacity box */}
                    <div className="capacity-box">
                      <div className="capacity-header">
                        <span>Sức chứa KTV</span>
                        <span>{reg} / {max} nhân sự</span>
                      </div>
                      <div className="capacity-bar-bg">
                        <div
                          className="capacity-bar-fill"
                          style={{ width: `${pct}%`, background: fillColor }}
                        />
                      </div>
                    </div>

                    <div style={{ flexGrow: 1 }} />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                      <button
                        className="card-btn-action btn-primary"
                        onClick={() => openAssignModal(item)}
                      >
                        👥 Phân ca ({reg})
                      </button>
                      <button
                        className="card-btn-action btn-secondary"
                        onClick={() => openEdit(item)}
                      >
                        ✏️ Sửa ca
                      </button>
                      <button
                        className="card-btn-action btn-secondary"
                        onClick={() => toggleStatus(item)}
                      >
                        {item.Status === "OPEN" ? "🔒 Đóng ca" : "🔓 Mở ca"}
                      </button>
                      <button
                        className="card-btn-action btn-danger"
                        onClick={() => remove(item)}
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {!items.length && (
              <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", background: "#ffffff", borderRadius: "16px", color: "#64748b" }}>
                Không tìm thấy ca làm việc nào phù hợp với bộ lọc.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Create / Edit Shift */}
      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form className="modal-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="modal-title">{editingId ? "Cập nhật ca làm việc" : "Tạo ca làm việc mới"}</h3>

            <div className="modal-body">
              <div className="admin-form-grid">
                <div className="form-wide">
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                    Chọn mẫu ca có sẵn:
                  </span>
                  <div className="preset-btn-row">
                    {PRESET_SHIFTS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="preset-chip"
                        onClick={() => {
                          setForm({
                            ...form,
                            shiftName: p.name,
                            startTime: p.startTime,
                            endTime: p.endTime,
                          });
                        }}
                      >
                        {p.name} ({p.startTime}-{p.endTime})
                      </button>
                    ))}
                  </div>
                </div>

                <label className="form-label form-wide">
                  Tên ca làm *
                  <input
                    className="form-input"
                    value={form.shiftName}
                    onChange={(e) => setForm({ ...form, shiftName: e.target.value })}
                    placeholder="Ca sáng / Ca chiều / Ca ca gãy..."
                    required
                  />
                </label>

                <label className="form-label">
                  Ngày làm việc *
                  <input
                    className="form-input"
                    type="date"
                    value={form.shiftDate}
                    onChange={(e) => setForm({ ...form, shiftDate: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label">
                  Sức chứa KTV tối đa *
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={30}
                    value={form.maxTechnicians}
                    onChange={(e) => setForm({ ...form, maxTechnicians: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label">
                  Giờ bắt đầu *
                  <input
                    className="form-input"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label">
                  Giờ kết thúc *
                  <input
                    className="form-input"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label form-wide">
                  Trạng thái ca làm
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="OPEN">OPEN (Cho phép đăng ký)</option>
                    <option value="FULL">FULL (Đã đầy số lượng)</option>
                    <option value="CLOSED">CLOSED (Khóa không cho đăng ký)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="card-btn-action btn-secondary" onClick={() => setShowModal(false)}>
                Hủy bỏ
              </button>
              <button type="submit" className="card-btn-action btn-primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu ca làm"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal 2: Manage Shift Registrations / Assign Technicians */}
      {assignShift ? (
        <div className="modal-backdrop" onClick={() => setAssignShift(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px" }}>
            <button className="admin-modal-close" onClick={() => setAssignShift(null)}>×</button>
            <h3 className="modal-title">Phân ca KTV • {assignShift.ShiftName}</h3>

            <div className="modal-body">
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "15px", color: "#1e293b", display: "block" }}>
                    {formatDateFull(assignShift.ShiftDate)}
                  </strong>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Thời gian: {assignShift.StartTime} - {assignShift.EndTime}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#a0573a" }}>
                    {registrations.filter((r) => r.Status === "APPROVED").length} / {assignShift.MaxTechnicians} KTV
                  </span>
                </div>
              </div>

              {/* Direct Assign Section */}
              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #cbd5e1", marginBottom: "20px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: "8px" }}>
                  ➕ Trực tiếp thêm/phân công KTV vào ca này:
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select
                    className="form-select"
                    style={{ flexGrow: 1 }}
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                  >
                    <option value="">-- Chọn Kỹ thuật viên Spa --</option>
                    {technicians.map((t) => (
                      <option key={t.EmployeeId} value={t.EmployeeId}>
                        {t.FullName} ({t.Specialization || t.Position || "KTV"})
                      </option>
                    ))}
                  </select>
                  <button
                    className="card-btn-action btn-primary"
                    disabled={!selectedTechId || assigning}
                    onClick={handleAssignTech}
                  >
                    {assigning ? "Đang thêm..." : "+ Thêm KTV"}
                  </button>
                </div>
              </div>

              {/* List of Registrations */}
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "10px" }}>
                Danh sách KTV đã đăng ký/phân ca ({registrations.length}):
              </span>

              {loadingRegs ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>Đang tải danh sách KTV...</div>
              ) : (
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {registrations.map((reg) => (
                    <div className="reg-item-card" key={reg.RegistrationId}>
                      <div className="reg-user-info">
                        <img src={avatar(reg.ImageUrl || reg.AvatarUrl)} alt={reg.FullName} />
                        <div>
                          <strong style={{ fontSize: "14.5px", color: "#1e293b", display: "block" }}>{reg.FullName}</strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {reg.Specialization || reg.Position || "Kỹ thuật viên"} • {reg.Phone || reg.Email}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: reg.Status === "APPROVED" ? "#dcfce7" : "#fef3c7",
                            color: reg.Status === "APPROVED" ? "#15803d" : "#b45309",
                          }}
                        >
                          {reg.Status}
                        </span>

                        {reg.Status !== "APPROVED" && (
                          <button
                            className="card-btn-action btn-primary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleUpdateRegStatus(reg.RegistrationId, "APPROVED")}
                          >
                            Duyệt
                          </button>
                        )}

                        <button
                          className="card-btn-action btn-danger"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleRemoveReg(reg.RegistrationId)}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}

                  {registrations.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", background: "#f8fafc", borderRadius: "10px" }}>
                      Chưa có KTV nào đăng ký hoặc được phân công cho ca làm này.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="card-btn-action btn-secondary" onClick={() => setAssignShift(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
