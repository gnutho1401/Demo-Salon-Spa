import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const STATUS = [
  "ALL",
  "PENDING_PAYMENT",
  "PENDING",
  "PAID",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "NO_SHOW",
];

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function money(v) {
  return Number(v || 0).toLocaleString("vi-VN") + " VND";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getMiniCalendarDays(dateString) {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7)) - 1;

  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();

  const startOffset = (firstDay.getDay() + 6) % 7;
  const result = [];

  for (let i = 0; i < startOffset; i++) {
    result.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    result.push(day);
  }

  return result;
}

function getWeekRange(base) {
  const d = new Date(base);
  const day = d.getDay() || 7;

  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
}

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

const APPT_STATUS_MAP = {
  ALL: "Tất cả trạng thái",
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  NO_SHOW: "Không đến",
  UNPAID: "Chưa thanh toán",
  PAID_INVOICE: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thất bại",
};

function statusLabel(status) {
  return APPT_STATUS_MAP[status] || status || "Chưa rõ";
}

export default function TechnicianSchedule() {
  const navigate = useNavigate();

  const [view, setView] = useState("week");
  const [baseDate, setBaseDate] = useState(todayISO());
  const [status, setStatus] = useState("ALL");
  const [serviceId, setServiceId] = useState("");
  const [search, setSearch] = useState("");

  const [data, setData] = useState({
    appointments: [],
    services: [],
    shifts: [],
    summary: {},
  });

  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    if (view === "day") {
      return {
        startDate: baseDate,
        endDate: baseDate,
      };
    }

    if (view === "week") {
      return getWeekRange(baseDate);
    }

    const lastDay = daysInMonth(baseDate);

    return {
      startDate: baseDate.slice(0, 8) + "01",
      endDate: baseDate.slice(0, 8) + String(lastDay).padStart(2, "0"),
    };
  }, [view, baseDate]);

  const visibleDays = useMemo(() => {
    if (view === "day") {
      return [baseDate];
    }

    if (view === "week") {
      return Array.from({ length: 7 }, (_, i) => addDays(range.startDate, i));
    }

    const total = daysInMonth(baseDate);
    const start = baseDate.slice(0, 8);

    return Array.from({ length: total }, (_, i) => {
      return start + String(i + 1).padStart(2, "0");
    });
  }, [view, baseDate, range.startDate]);

  const miniCalendarDays = useMemo(
    () => getMiniCalendarDays(baseDate),
    [baseDate],
  );
  const hours = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/technician/schedule", {
        params: {
          startDate: range.startDate,
          endDate: range.endDate,
          status,
          serviceId: serviceId || undefined,
          search: search || undefined,
        },
      });

      const nextData = res.data.data || {
        appointments: [],
        services: [],
        shifts: [],
        summary: {},
      };

      setData(nextData);

      setSelected((current) => {
        if (!current) return nextData.appointments?.[0] || null;

        const updated = nextData.appointments?.find(
          (a) => a.AppointmentId === current.AppointmentId,
        );

        return updated || nextData.appointments?.[0] || null;
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch làm việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSchedule();
    }, 300);

    return () => clearTimeout(timer);
  }, [range.startDate, range.endDate, status, serviceId, search]);

  const byDateHour = (date, hour) => {
    return data.appointments.filter((a) => {
      const appointmentDate = String(a.AppointmentDate).slice(0, 10);
      const startHour = String(a.StartTime).slice(0, 2);

      return appointmentDate === date && startHour === hour.slice(0, 2);
    });
  };

  const shiftByDate = (date) => {
    return (
      data.shifts?.filter((s) => String(s.ShiftDate).slice(0, 10) === date) ||
      []
    );
  };

  const goPrevious = () => {
    if (view === "month") {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() - 1);
      setBaseDate(d.toISOString().slice(0, 10));
      return;
    }

    setBaseDate(addDays(baseDate, view === "week" ? -7 : -1));
  };

  const goNext = () => {
    if (view === "month") {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + 1);
      setBaseDate(d.toISOString().slice(0, 10));
      return;
    }

    setBaseDate(addDays(baseDate, view === "week" ? 7 : 1));
  };

  const resetFilters = () => {
    setStatus("ALL");
    setServiceId("");
    setSearch("");
  };

  const startService = async () => {
    if (!selected) return;

    try {
      setActionLoading(true);
      setError("");

      await axiosClient.patch(
        `/technician/appointments/${selected.AppointmentId}/start`,
      );

      await loadSchedule();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể bắt đầu dịch vụ");
    } finally {
      setActionLoading(false);
    }
  };

  const completeService = async () => {
    if (!selected) return;

    try {
      setActionLoading(true);
      setError("");

      if (selected.CustomerPackageId) {
        // Combo: hoàn thành bước của KTV này
        await axiosClient.patch(
          `/technician/appointments/${selected.AppointmentId}/complete-step`,
        );
        await loadSchedule();
      } else {
        await axiosClient.patch(
          `/technician/appointments/${selected.AppointmentId}/complete`,
        );
        const svcId = selected.ServiceId || "";
        navigate(`/technician/treatment-notes?appointmentId=${selected.AppointmentId}${svcId ? `&serviceId=${svcId}` : ""}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể hoàn thành dịch vụ");
    } finally {
      setActionLoading(false);
    }
  };

  const noShowService = async () => {
    if (!selected) return;

    const ok = window.confirm("Bạn chắc chắn muốn đánh dấu khách không đến?");
    if (!ok) return;

    try {
      setActionLoading(true);
      setError("");

      await axiosClient.patch(
        `/technician/appointments/${selected.AppointmentId}/no-show`,
      );

      await loadSchedule();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đánh dấu No-show");
    } finally {
      setActionLoading(false);
    }
  };

  // Với Combo: canStart = bước của mình còn PENDING và chưa IN_PROGRESS
  // Với lịch thường: dựa vào appointment status
  const canStart = selected && (() => {
    if (selected.CustomerPackageId) {
      // Combo: chỉ có thể bắt đầu nếu bước này còn PENDING
      return selected.MyStepStatus === 'PENDING' && ['CONFIRMED','PAID','CHECKED_IN','IN_PROGRESS'].includes(selected.Status);
    }
    return ['CONFIRMED', 'PAID', 'CHECKED_IN'].includes(selected.Status);
  })();

  const canComplete = selected && (() => {
    if (selected.CustomerPackageId) {
      // Combo: chỉ hoàn thành được khi bước này đang IN_PROGRESS
      return selected.MyStepStatus === 'IN_PROGRESS';
    }
    return selected.Status === 'IN_PROGRESS';
  })();

  const canNoShow = selected && !selected.CustomerPackageId && ['CONFIRMED', 'PAID', 'CHECKED_IN'].includes(selected.Status);

  return (
    <TechnicianLayout>
      <div className="tech-schedule-page">
        <style>{`
          /* Premium Style Upgrades for Technician Schedule */
          .tech-schedule-page {
            font-family: 'Outfit', 'Inter', sans-serif;
            background: #faf6f0;
            padding: 10px;
          }

          .tech-page-head {
            background: #fff;
            padding: 24px 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(165,145,115,0.08);
            border: 1px solid rgba(222, 203, 166, 0.4);
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .tech-page-head h1 {
            font-size: 1.85rem;
            color: #1e351f;
            font-weight: 800;
          }

          .tech-page-head p {
            color: #6b7280;
            margin-top: 4px;
            font-size: 0.9rem;
          }

          .tech-new-btn {
            background: linear-gradient(135deg, #2d6a4f, #1b4332) !important;
            box-shadow: 0 8px 20px rgba(45, 106, 79, 0.25) !important;
            font-weight: 700;
            transition: all 0.25s ease;
          }

          .tech-new-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 24px rgba(45, 106, 79, 0.35) !important;
          }

          .schedule-toolbar {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            background: #fff;
            padding: 14px 20px;
            border-radius: 16px;
            border: 1px solid rgba(222, 203, 166, 0.4);
            box-shadow: 0 6px 20px rgba(165,145,115,0.04);
            margin-bottom: 24px;
            gap: 16px;
          }

          .schedule-tabs {
            background: #f4f1eb !important;
            border-radius: 12px !important;
            padding: 4px !important;
            border: none !important;
          }

          .schedule-tabs button {
            padding: 8px 20px !important;
            font-size: 0.88rem;
            font-weight: 600;
            color: #5c554a;
            border-radius: 8px !important;
            transition: all 0.25s ease;
          }

          .schedule-tabs button.active {
            background: #2d6a4f !important;
            color: #fff !important;
            box-shadow: 0 4px 10px rgba(45, 106, 79, 0.2);
          }

          .schedule-date-nav {
            background: #fff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 12px !important;
            align-items: center;
          }

          .schedule-date-nav button {
            background: #f4f1eb !important;
            color: #2d6a4f !important;
            font-weight: 800;
            width: 38px;
            height: 38px;
            padding: 0 !important;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px !important;
            transition: all 0.2s;
          }

          .schedule-date-nav button:hover {
            background: #2d6a4f !important;
            color: #fff !important;
          }

          .schedule-date-nav span {
            font-weight: 700;
            color: #1e351f;
            font-size: 0.95rem;
            padding: 0 16px !important;
            min-width: auto !important;
          }

          .filter-btn {
            background: #fef2f2 !important;
            border: 1px solid #fecaca !important;
            color: #dc2626 !important;
            font-weight: 700;
            border-radius: 10px !important;
            padding: 8px 16px !important;
            transition: all 0.2s;
          }

          .filter-btn:hover {
            background: #dc2626 !important;
            color: #fff !important;
          }

          /* Left Panel / Mini calendar */
          .schedule-left-panel {
            background: #fff !important;
            border: 1px solid rgba(222, 203, 166, 0.45) !important;
            border-radius: 20px !important;
            padding: 20px !important;
            box-shadow: 0 8px 24px rgba(165,145,115,0.06) !important;
          }

          .mini-calendar {
            background: #fcfbf9 !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 14px !important;
          }

          .mini-calendar h3 {
            font-size: 0.98rem;
            font-weight: 800;
            color: #2d6a4f;
            text-align: center;
            margin-bottom: 12px;
          }

          .mini-weekdays span {
            font-weight: 700;
            color: #9ca3af;
            font-size: 0.78rem;
          }

          .mini-days button {
            width: 30px !important;
            height: 30px !important;
            font-size: 0.85rem !important;
            font-weight: 500;
            transition: all 0.2s;
          }

          .mini-days button.active {
            background: #2d6a4f !important;
            color: #fff !important;
            box-shadow: 0 4px 10px rgba(45, 106, 79, 0.25);
          }

          .shift-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px;
            margin-top: 18px;
          }

          .shift-box h4 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
            font-weight: 800;
          }

          .shift-item {
            background: #fff;
            border-left: 4px solid #3b82f6;
            border-radius: 8px;
            padding: 10px 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.02);
          }

          .shift-item b {
            color: #1e3a8a;
            font-size: 0.88rem;
          }

          .shift-item span {
            color: #4b5563;
            font-size: 0.8rem;
          }

          /* Main Calendar Grid */
          .schedule-calendar {
            background: #fff !important;
            border: 1px solid rgba(222, 203, 166, 0.45) !important;
            border-radius: 20px !important;
            box-shadow: 0 8px 24px rgba(165,145,115,0.06) !important;
            padding: 16px !important;
          }

          .calendar-head {
            border-bottom: 2px solid #f1ece1 !important;
            background: #faf9f6;
            border-radius: 12px 12px 0 0;
          }

          .calendar-head > div {
            border-left: 1px solid #f1ece1 !important;
            padding: 12px 6px !important;
          }

          .calendar-head b {
            font-size: 0.85rem;
            color: #374151;
            text-transform: uppercase;
          }

          .calendar-head span {
            font-size: 0.8rem;
            color: #6b7280;
            margin-top: 2px;
          }

          .calendar-head .today {
            background: #2d6a4f !important;
            color: #fff !important;
            border-radius: 10px !important;
            margin: 4px !important;
          }

          .calendar-head .today span {
            color: rgba(255,255,255,0.85) !important;
          }

          .calendar-row {
            border-bottom: 1px solid #f3ece0 !important;
          }

          .calendar-cell {
            border-left: 1px solid #f3ece0 !important;
            background: #fff;
          }

          .calendar-cell:hover {
            background: #fbfbf9;
          }

          /* Appointment block style */
          .appointment-block {
            border-radius: 10px !important;
            padding: 8px 10px !important;
            border-width: 1px !important;
            border-style: solid !important;
            box-shadow: 0 3px 8px rgba(0,0,0,0.04) !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            gap: 2px !important;
          }

          .appointment-block:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 14px rgba(0,0,0,0.08) !important;
          }

          .appointment-block b {
            font-size: 0.78rem !important;
            font-weight: 800;
          }

          .appointment-block span {
            font-size: 0.82rem !important;
            font-weight: 700 !important;
          }

          .appointment-block small {
            font-size: 0.72rem !important;
            font-weight: 600;
            color: rgba(0,0,0,0.6) !important;
          }

          /* Status colors (Premium palette) */
          .appointment-block.pending {
            background: #fffbeb !important;
            border-color: #fde68a !important;
            color: #b45309 !important;
          }
          .appointment-block.confirmed {
            background: #ecfdf5 !important;
            border-color: #a7f3d0 !important;
            color: #065f46 !important;
          }
          .appointment-block.in_progress {
            background: #eff6ff !important;
            border-color: #bfdbfe !important;
            color: #1e40af !important;
          }
          .appointment-block.completed {
            background: #f5f3ff !important;
            border-color: #ddd6fe !important;
            color: #5b21b6 !important;
          }
          .appointment-block.cancelled {
            background: #f9fafb !important;
            border-color: #e5e7eb !important;
            color: #374151 !important;
            opacity: 0.7;
          }

          /* Month view list grid */
          .month-list {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            margin-top: 10px;
          }

          .month-day-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            min-height: 120px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: #fff;
          }

          .month-day-card.today {
            border-color: #2d6a4f !important;
            box-shadow: 0 0 0 2px rgba(45, 106, 79, 0.2);
          }

          .month-day-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            font-size: 0.8rem;
            background: #f9fafb;
            border-bottom: 1px solid #f3f4f6;
          }

          .month-day-card .appointment-block {
            margin: 4px 6px;
            width: calc(100% - 12px);
          }

          /* Right Panel Detail View */
          .schedule-detail {
            background: #fff !important;
            border: 1px solid rgba(222, 203, 166, 0.45) !important;
            border-radius: 20px !important;
            box-shadow: 0 8px 24px rgba(165,145,115,0.06) !important;
            padding: 24px !important;
          }

          .detail-head h3 {
            font-size: 1.1rem;
            font-weight: 800;
            color: #1e351f;
          }

          .detail-customer {
            background: #faf9f6;
            border: 1px solid rgba(222, 203, 166, 0.35);
            border-radius: 16px;
            padding: 14px;
            margin: 18px 0 !important;
          }

          .detail-customer h3 {
            font-size: 1.05rem;
            font-weight: 800;
            color: #2d6a4f;
          }

          .detail-status {
            font-weight: 700;
            border-radius: 8px !important;
            padding: 4px 8px !important;
            text-transform: uppercase;
            font-size: 0.68rem !important;
            letter-spacing: 0.5px;
          }

          .detail-status.pending { background: #fef3c7; color: #d97706; }
          .detail-status.confirmed { background: #d1fae5; color: #059669; }
          .detail-status.in_progress { background: #dbeafe; color: #2563eb; }
          .detail-status.completed { background: #f3e8ff; color: #7c3aed; }
          .detail-status.cancelled { background: #f3f4f6; color: #4b5563; }

          .detail-list {
            border-color: #f1ece1 !important;
          }

          .detail-list p {
            margin: 12px 0 !important;
            grid-template-columns: 100px 1fr !important;
          }

          .detail-list b {
            font-size: 0.85rem;
            color: #6b7280;
          }

          .detail-list span {
            font-size: 0.88rem;
            font-weight: 600;
            color: #1f2937;
          }

          .detail-actions button {
            border-radius: 12px !important;
            font-weight: 700;
            font-size: 0.88rem;
            transition: all 0.2s ease;
          }

          .detail-actions .start {
            background: #2d6a4f !important;
            box-shadow: 0 4px 12px rgba(45, 106, 79, 0.2);
          }

          .detail-actions .start:hover {
            background: #1b4332 !important;
            transform: translateY(-1px);
          }

          .detail-actions .note {
            background: #fffbeb !important;
            border: 1.5px solid #fde68a !important;
            color: #b45309 !important;
          }

          .detail-actions .note:hover {
            background: #fef3c7 !important;
          }

          .detail-actions .complete {
            background: #2d6a4f !important;
            color: #fff !important;
            border: none !important;
            box-shadow: 0 4px 12px rgba(45, 106, 79, 0.2);
          }

          .detail-actions .complete:hover {
            background: #1b4332 !important;
          }

          .detail-actions .danger {
            background: #fef2f2 !important;
            border: 1.5px solid #fecaca !important;
            color: #dc2626 !important;
          }

          .detail-actions .danger:hover {
            background: #fee2e2 !important;
          }
        `}</style>

        <header className="tech-page-head">

          <div>
            <h1>Lịch trình của tôi 🗓️</h1>
            <p>Quản lý các ca trực và lịch hẹn trị liệu của bạn</p>
          </div>

          <div className="tech-search">
            <input
              placeholder="Tìm tên khách, số điện thoại, dịch vụ, mã lịch hẹn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="tech-new-btn"
            onClick={() => navigate("/technician/appointments")}
          >
            Xem các lịch hẹn
          </button>
        </header>

        <div className="schedule-toolbar">
          <div className="schedule-tabs">
            <button
              className={view === "day" ? "active" : ""}
              onClick={() => setView("day")}
            >
              Ngày
            </button>

            <button
              className={view === "week" ? "active" : ""}
              onClick={() => setView("week")}
            >
              Tuần
            </button>

            <button
              className={view === "month" ? "active" : ""}
              onClick={() => setView("month")}
            >
              Tháng
            </button>
          </div>

          <div className="schedule-date-nav">
            <button onClick={goPrevious}>‹</button>

            <span>
              {range.startDate} → {range.endDate}
            </span>

            <button onClick={goNext}>›</button>

            <button onClick={() => setBaseDate(todayISO())}>Hôm nay</button>
          </div>

          <button className="filter-btn" onClick={resetFilters}>
            Xóa bộ lọc
          </button>
        </div>

        {loading && <p className="tech-loading">Đang tải lịch làm việc...</p>}
        {error && <p className="tech-error">{error}</p>}

        <section className="schedule-layout">
          <aside className="schedule-left-panel">
            <div className="mini-calendar">
              <h3>{baseDate.slice(0, 7)}</h3>

              <div className="mini-weekdays">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="mini-days">
                {miniCalendarDays.map((day, index) => {
                  if (!day) {
                    return (
                      <span key={`empty-${index}`} className="mini-empty" />
                    );
                  }

                  const dateValue = `${baseDate.slice(0, 7)}-${String(day).padStart(2, "0")}`;

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      className={baseDate === dateValue ? "active" : ""}
                      onClick={() => setBaseDate(dateValue)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="shift-box">
              <h4>Ca làm việc phân công</h4>

              {shiftByDate(baseDate).length === 0 ? (
                <p className="shift-empty">Không có ca làm việc nào</p>
              ) : (
                shiftByDate(baseDate).map((shift) => (
                  <div key={shift.ShiftId} className="shift-item">
                    <div>
                      <b>
                        {shift.IsDayOff
                          ? "Ngày nghỉ"
                          : shift.ShiftType || "Ca làm việc"}
                      </b>
                      <span>
                        {shift.IsDayOff
                          ? "Không có ca trực hôm nay"
                          : `${shift.StartTime} - ${shift.EndTime}`}
                      </span>
                    </div>

                    {shift.Notes && <small>{shift.Notes}</small>}
                  </div>
                ))
              )}
            </div>
            <div className="schedule-filter">
              <h4>Lọc theo trạng thái</h4>

              {STATUS.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    checked={status === s}
                    onChange={() => setStatus(s)}
                  />
                  {statusLabel(s)}
                </label>
              ))}

              <h4>Lọc theo dịch vụ</h4>

              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Tất cả dịch vụ</option>

                {data.services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName}
                  </option>
                ))}
              </select>
            </div>

            <button className="export-btn" onClick={() => window.print()}>
              In lịch trình
            </button>
          </aside>

          <main
            className={
              view === "month"
                ? "schedule-calendar schedule-calendar-month"
                : "schedule-calendar"
            }
          >
            <div
              className="calendar-grid calendar-head"
              style={{
                gridTemplateColumns: `70px repeat(${visibleDays.length}, minmax(120px, 1fr))`,
              }}
            >
              <div></div>

              {visibleDays.map((d) => {
                const isSelectedDay = baseDate === d;
                return (
                  <div
                    key={d}
                    className={`${d === todayISO() ? "today" : ""} ${isSelectedDay ? "active-col-day" : ""}`}
                    onClick={() => setBaseDate(d)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: isSelectedDay ? "rgba(45, 106, 79, 0.15)" : "transparent",
                      transition: "all 0.2s"
                    }}
                  >
                    <b style={{ color: isSelectedDay ? "#2d6a4f" : undefined }}>
                      {new Date(d).toLocaleDateString("vi-VN", {
                        weekday: view === "month" ? "short" : "long",
                      })}
                    </b>
                    <span style={{
                      fontWeight: isSelectedDay ? 700 : 400,
                      color: isSelectedDay ? "#2d6a4f" : undefined,
                      textDecoration: isSelectedDay ? "underline" : "none"
                    }}>{d}</span>
                  </div>
                );
              })}
            </div>


            {view === "month" ? (
              <div className="month-list">
                {visibleDays.map((d) => {
                  const dayAppointments = data.appointments.filter(
                    (a) => String(a.AppointmentDate).slice(0, 10) === d,
                  );
                  const isSelectedDay = baseDate === d;

                  return (
                    <div
                      key={d}
                      className={`${d === todayISO() ? "month-day-card today" : "month-day-card"}`}
                      onClick={() => setBaseDate(d)}
                      style={{
                        cursor: "pointer",
                        border: isSelectedDay ? "2px solid #2d6a4f" : "1px solid #e5e7eb",
                        boxShadow: isSelectedDay ? "0 4px 12px rgba(45, 106, 79, 0.15)" : "none",
                        background: isSelectedDay ? "#f4fcf9" : undefined,
                        transition: "all 0.2s"
                      }}
                    >
                      <div className="month-day-head" style={{
                        background: isSelectedDay ? "#2d6a4f" : undefined,
                        color: isSelectedDay ? "#fff" : undefined,
                        padding: "6px 8px",
                        borderRadius: isSelectedDay ? "4px 4px 0 0" : undefined
                      }}>
                        <b style={{ color: isSelectedDay ? "#fff" : undefined }}>{d.slice(8, 10)}</b>
                        <span style={{ color: isSelectedDay ? "#fff" : undefined }}>
                          {new Date(d).toLocaleDateString("vi-VN", {
                            weekday: "short",
                          })}
                        </span>
                      </div>

                      {dayAppointments.length === 0 ? (
                        <p className="month-empty">Không có lịch hẹn</p>
                      ) : (
                        dayAppointments.map((a) => (
                          <button
                            key={a.AppointmentServiceId ? `${a.AppointmentId}-${a.AppointmentServiceId}` : a.AppointmentId}
                            className={`appointment-block ${String(
                              a.CustomerPackageId ? (a.MyStepStatus || a.Status) : a.Status,
                            ).toLowerCase()}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(a);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/technician/appointments/${a.AppointmentId}`,
                              );
                            }}
                          >
                            <b>{a.StartTime}</b>
                            <span>{a.CustomerName}</span>
                            <small>{a.MyStepServiceName || a.ServiceName}</small>
                            {a.CustomerPackageId && <small style={{color:'#ec4899'}}>📦 Combo</small>}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>

            ) : (
              <>
                {hours.map((hour) => (
                  <div
                    className="calendar-grid calendar-row"
                    key={hour}
                    style={{
                      gridTemplateColumns: `70px repeat(${visibleDays.length}, minmax(120px, 1fr))`,
                    }}
                  >
                    <div className="calendar-hour">{hour}</div>

                    {visibleDays.map((d) => (
                      <div className="calendar-cell" key={d + hour}>
                        {byDateHour(d, hour).map((a) => (
                          <button
                            key={a.AppointmentServiceId ? `${a.AppointmentId}-${a.AppointmentServiceId}` : a.AppointmentId}
                            className={`appointment-block ${String(
                              a.CustomerPackageId ? (a.MyStepStatus || a.Status) : a.Status,
                            ).toLowerCase()}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(a);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/technician/appointments/${a.AppointmentId}`,
                              );
                            }}
                          >
                            <b>{a.StartTime}</b>
                            <span>{a.CustomerName}</span>
                            <small>{a.MyStepServiceName || a.ServiceName}</small>
                            {a.CustomerPackageId && <small style={{color:'#ec4899'}}>📦 Combo</small>}
                          </button>
                        ))}
                      </div>

                    ))}
                  </div>
                ))}

                {data.appointments.length === 0 && !loading && (
                  <p className="tech-empty">Không có lịch hẹn nào trong lịch trình</p>
                )}
              </>
            )}

            <div className="schedule-legend">
              {STATUS.filter((s) => s !== "ALL").map((s) => (
                <span key={s}>
                  <i className={s.toLowerCase()} /> {statusLabel(s)}
                </span>
              ))}
            </div>
          </main>

          <aside className="schedule-detail">
            <div className="detail-head">
              <h3>Chi tiết lịch hẹn</h3>
              <button onClick={() => setSelected(null)}>×</button>
            </div>

            {selected ? (
              <>
                <div className="detail-customer">
                  <img
                    className="detail-avatar"
                    src={avatar(selected.CustomerAvatar)}
                    alt={selected.CustomerName || "Khách hàng"}
                  />

                  <div>
                    <h3>{selected.CustomerName}</h3>
                    <p>{selected.CustomerPhone || "Chưa có SĐT"}</p>
                    <small>{selected.AppointmentCode}</small>
                  </div>

                  <span
                    className={`detail-status ${String(
                      selected.Status,
                    ).toLowerCase()}`}
                  >
                    {statusLabel(selected.Status)}
                  </span>
                </div>

                <div className="detail-list">
                  <p>
                    <b>Dịch vụ</b>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {selected.MyStepServiceName || selected.ServiceName || "Không có dịch vụ"}
                      {selected.CustomerPackageId && (
                        <span style={{ background: '#fce7f3', color: '#831843', borderRadius: '6px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 700 }}>📦 Gói Combo</span>
                      )}
                      {selected.CustomerPackageId && selected.MyStepStatus && (
                        <span style={{
                          background: selected.MyStepStatus === 'COMPLETED' ? '#dcfce7' : selected.MyStepStatus === 'IN_PROGRESS' ? '#fef9c3' : '#f1f5f9',
                          color: selected.MyStepStatus === 'COMPLETED' ? '#15803d' : selected.MyStepStatus === 'IN_PROGRESS' ? '#92400e' : '#64748b',
                          borderRadius: '6px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 700
                        }}>
                          {selected.MyStepStatus === 'COMPLETED' ? '✓ Bước hoàn thành' : selected.MyStepStatus === 'IN_PROGRESS' ? '▶ Đang thực hiện' : '○ Chờ thực hiện'}
                        </span>
                      )}
                    </span>
                  </p>

                  <p>
                    <b>Ngày & Giờ</b>
                    <span
                      onClick={() => setBaseDate(String(selected.AppointmentDate).slice(0, 10))}
                      style={{
                        cursor: "pointer",
                        color: "#2d6a4f",
                        fontWeight: 600,
                        textDecoration: "underline"
                      }}
                      title="Click để nhảy đến ngày này"
                    >
                      {String(selected.AppointmentDate).slice(0, 10)} •{" "}
                      {selected.StartTime}
                    </span>
                  </p>

                  <p>
                    <b>Thời lượng</b>
                    <span>
                      {selected.StartTime} - {selected.EndTime}
                      {selected.DurationMinutes
                        ? ` • ${selected.DurationMinutes} phút`
                        : ""}
                    </span>
                  </p>

                  <p>
                    <b>Phòng</b>
                    <span>{selected.RoomName || "Chưa có phòng"}</span>
                  </p>

                  <p>
                    <b>Đơn giá</b>
                    <span>
                      {money(selected.FinalAmount || selected.TotalPrice)}
                    </span>
                  </p>

                  <p>
                    <b>Thanh toán</b>
                    <span>{statusLabel(selected.PaymentStatus || "UNPAID")}</span>
                  </p>

                  <p>
                    <b>Ghi chú</b>
                    <span>{selected.Notes || "Không có ghi chú"}</span>
                  </p>
                </div>

                <div className="detail-actions">
                  {canStart && (
                    <button
                      onClick={startService}
                      className="start"
                      disabled={actionLoading}
                    >
                      ▷ Bắt đầu trị liệu
                    </button>
                  )}

                  {canNoShow && (
                    <button
                      onClick={noShowService}
                      className="danger"
                      disabled={actionLoading}
                    >
                      Đánh dấu vắng mặt
                    </button>
                  )}

                  <button
                    className="note"
                    disabled={selected.CustomerPackageId
                      ? !['IN_PROGRESS','COMPLETED'].includes(selected.MyStepStatus || '')
                      : !["IN_PROGRESS", "COMPLETED"].includes(String(selected?.Status).toUpperCase())}
                    onClick={() => {
                      const ok = selected.CustomerPackageId
                        ? ['IN_PROGRESS','COMPLETED'].includes(selected.MyStepStatus || '')
                        : ["IN_PROGRESS", "COMPLETED"].includes(String(selected?.Status).toUpperCase());
                      if (!ok) {
                        alert("Chỉ được viết và xem ghi chú điều trị khi bước dịch vụ đang thực hiện hoặc hoàn thành.");
                        return;
                      }
                      const svcId = selected.ServiceId || "";
                      navigate(`/technician/treatment-notes?appointmentId=${selected.AppointmentId}${svcId ? `&serviceId=${svcId}` : ""}`);
                    }}
                    style={(() => {
                      const disabled = selected.CustomerPackageId
                        ? !['IN_PROGRESS','COMPLETED'].includes(selected.MyStepStatus || '')
                        : !["IN_PROGRESS", "COMPLETED"].includes(String(selected?.Status).toUpperCase());
                      return disabled ? { opacity: 0.5, cursor: "not-allowed" } : {};
                    })()}
                    title={!["IN_PROGRESS", "COMPLETED"].includes(String(selected?.Status).toUpperCase()) ? "Chỉ khả dụng khi lịch hẹn Đang thực hiện hoặc Hoàn thành" : ""}
                  >
                    📝 Ghi chú điều trị
                  </button>

                  {canComplete && (
                    <button
                      onClick={completeService}
                      className="complete"
                      disabled={actionLoading}
                    >
                      {selected.CustomerPackageId
                        ? "✓ Xác nhận xong bước này"
                        : "✓ Hoàn thành ca"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-detail">
                Chọn một lịch hẹn để xem chi tiết
              </p>
            )}
          </aside>
        </section>

        <section className="schedule-bottom">
          <div className="bottom-card">
            <h3>Lịch hẹn tiếp theo ({data.appointments.length})</h3>

            <div className="upcoming-list">
              {data.appointments.slice(0, 3).map((a) => (
                <button
                  key={a.AppointmentId}
                  type="button"
                  onClick={() => setSelected(a)}
                >
                  <b>{a.CustomerName}</b>
                  <p>
                    {String(a.AppointmentDate).slice(0, 10)} • {a.StartTime}
                  </p>
                  <span>{a.ServiceName}</span>
                </button>
              ))}

              {data.appointments.length === 0 && (
                <p className="tech-empty">Không có lịch hẹn sắp tới</p>
              )}
            </div>
          </div>

          <div className="bottom-card summary-card">
            <h3>Tóm tắt lịch trình</h3>

            <div>
              <p>
                <b>{data.summary?.totalAppointments || 0}</b>
                <span>Tổng số buổi</span>
              </p>

              <p>
                <b>{data.summary?.inProgress || 0}</b>
                <span>Đang thực hiện</span>
              </p>

              <p>
                <b>{data.summary?.completed || 0}</b>
                <span>Đã hoàn thành</span>
              </p>

              <p>
                <b>{data.summary?.noShow || 0}</b>
                <span>Vắng mặt</span>
              </p>

              <p>
                <b>{money(data.summary?.revenue)}</b>
                <span>Doanh thu dự kiến</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </TechnicianLayout>
  );
}
