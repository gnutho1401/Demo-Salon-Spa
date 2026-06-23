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

const DEFAULT_AVATAR = "/images/default-avatar.png";

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

      await axiosClient.patch(
        `/technician/appointments/${selected.AppointmentId}/complete`,
      );

      await loadSchedule();
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

  const canStart = selected && ["CONFIRMED", "PAID", "CHECKED_IN"].includes(selected.Status);
  const canComplete = selected && selected.Status === "IN_PROGRESS";
  const canNoShow = selected && ["CONFIRMED", "PAID", "CHECKED_IN"].includes(selected.Status);

  return (
    <TechnicianLayout>
      <div className="tech-schedule-page">
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
                gridTemplateColumns: `70px repeat(${visibleDays.length}, 1fr)`,
              }}
            >
              <div></div>

              {visibleDays.map((d) => (
                <div key={d} className={d === todayISO() ? "today" : ""}>
                  <b>
                    {new Date(d).toLocaleDateString("vi-VN", {
                      weekday: view === "month" ? "short" : "long",
                    })}
                  </b>
                  <span>{d}</span>
                </div>
              ))}
            </div>

            {view === "month" ? (
              <div className="month-list">
                {visibleDays.map((d) => {
                  const dayAppointments = data.appointments.filter(
                    (a) => String(a.AppointmentDate).slice(0, 10) === d,
                  );

                  return (
                    <div
                      key={d}
                      className={
                        d === todayISO()
                          ? "month-day-card today"
                          : "month-day-card"
                      }
                    >
                      <div className="month-day-head">
                        <b>{d.slice(8, 10)}</b>
                        <span>
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
                            key={a.AppointmentId}
                            className={`appointment-block ${String(
                              a.Status,
                            ).toLowerCase()}`}
                            onClick={() => setSelected(a)}
                            onDoubleClick={() =>
                              navigate(
                                `/technician/appointments/${a.AppointmentId}`,
                              )
                            }
                          >
                            <b>{a.StartTime}</b>
                            <span>{a.CustomerName}</span>
                            <small>{a.ServiceName}</small>
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
                      gridTemplateColumns: `70px repeat(${visibleDays.length}, 1fr)`,
                    }}
                  >
                    <div className="calendar-hour">{hour}</div>

                    {visibleDays.map((d) => (
                      <div className="calendar-cell" key={d + hour}>
                        {byDateHour(d, hour).map((a) => (
                          <button
                            key={a.AppointmentId}
                            className={`appointment-block ${String(
                              a.Status,
                            ).toLowerCase()}`}
                            onClick={() => setSelected(a)}
                            onDoubleClick={() =>
                              navigate(
                                `/technician/appointments/${a.AppointmentId}`,
                              )
                            }
                          >
                            <b>{a.StartTime}</b>
                            <span>{a.CustomerName}</span>
                            <small>{a.ServiceName}</small>
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
                    <span>{selected.ServiceName || "Không có dịch vụ"}</span>
                  </p>

                  <p>
                    <b>Ngày & Giờ</b>
                    <span>
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
                    onClick={() =>
                      navigate(
                        `/technician/appointments/${selected.AppointmentId}`,
                      )
                    }
                  >
                    ✎ Thêm ghi chú
                  </button>

                  {canComplete && (
                    <button
                      onClick={completeService}
                      className="complete"
                      disabled={actionLoading}
                    >
                      ✓ Hoàn thành ca
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
