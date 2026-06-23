import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 100);
}

function Badge({ status }) {
  const s = String(status || "UNKNOWN").toUpperCase();
  return <span className={`spa-badge spa-badge-${s.toLowerCase()}`}>{s}</span>;
}

function Avatar({ src, name, className = "spa-avatar" }) {
  const url = src ? resolveFileUrl(src) : "";
  const letter = String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  if (url) {
    return (
      <img
        className={className}
        src={url}
        alt={name || "avatar"}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return <div className={className}>{letter || "?"}</div>;
}

function StatCard({ icon, title, value, note, type = "green" }) {
  return (
    <div className="spa-stat-card">
      <div className={`spa-stat-icon spa-stat-${type}`}>{icon}</div>

      <div className="spa-stat-content">
        <p>{title}</p>
        <h2>{value}</h2>
        <span className={type === "red" ? "trend-red" : "trend-green"}>
          {note}
        </span>
      </div>

      <div className={`spa-spark spa-spark-${type}`} />
    </div>
  );
}

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    axiosClient
      .get("/receptionist/dashboard")
      .then((res) => {
        if (!mounted) return;
        setStats(res.data.data || res.data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err.response?.data?.message || "Không tải được dashboard lễ tân",
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  const appointments = useMemo(() => {
    return stats?.todayAppointments || [];
  }, [stats]);

  const checkInQueue = useMemo(() => {
    return stats?.checkInQueue || [];
  }, [stats]);

  const recentCheckIns = useMemo(() => {
    return stats?.recentCheckIns || [];
  }, [stats]);

  const popularServices = useMemo(() => {
    return stats?.popularServices || [];
  }, [stats]);

  const highlightedCustomer = stats?.highlightedCustomer || null;

  const invoiceCount = Number(stats?.invoiceCount || 0);
  const paidInvoiceCount = Number(stats?.paidInvoiceCount || 0);
  const unpaidInvoiceCount = Number(stats?.unpaidInvoiceCount || 0);
  const refundPendingCount = Number(stats?.refundPendingCount || 0);

  const today = new Date();
  const todayText = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <ReceptionistLayout>
      <div className="spa-dashboard">
        <header className="spa-topbar">
          <div>
            <h1>
              Dashboard lễ tân <span>🍃</span>
            </h1>
            <p>Dữ liệu thật trong ngày: {todayText}</p>
          </div>

          <div className="spa-search">
            <span>⌕</span>
            <input placeholder="Tìm khách hàng, lịch hẹn, dịch vụ..." />
          </div>

          <div className="spa-top-actions">
            <Link className="spa-circle-btn" to="/receptionist/notifications">
              🔔
            </Link>

            <Link className="spa-circle-btn" to="/receptionist/appointments">
              📅
            </Link>

            <Link
              className="spa-new-btn"
              to="/receptionist/appointments/create"
            >
              + Tạo lịch hẹn
            </Link>
          </div>
        </header>

        {error && <div className="spa-error">{error}</div>}

        {!stats ? (
          <div className="spa-loading">Đang tải dashboard...</div>
        ) : (
          <>
            <section className="spa-stats">
              <StatCard
                icon="📅"
                title="Lịch hẹn hôm nay"
                value={stats.todayAppointmentsCount || 0}
                note={`${stats.pendingCount || 0} chờ xác nhận`}
              />

              <StatCard
                icon="✅"
                title="Đã check-in"
                value={stats.checkedInCount || 0}
                note={`${stats.confirmedCount || 0} khách chờ check-in`}
                type="gold"
              />

              <StatCard
                icon="💆"
                title="Đang phục vụ"
                value={stats.inProgressCount || 0}
                note={`${stats.completedCount || 0} đã hoàn thành`}
              />

              <StatCard
                icon="💰"
                title="Doanh thu hôm nay"
                value={money(stats.todayRevenue)}
                note={`${stats.paidInvoiceCount || 0} hóa đơn đã thanh toán`}
                type="gold"
              />

              <StatCard
                icon="↩"
                title="Hoàn tiền chờ xử lý"
                value={stats.refundPendingCount || 0}
                note={`${stats.waitingListCount || 0} khách trong hàng chờ`}
                type="red"
              />
            </section>

            <section className="spa-stats-title-section" style={{ marginTop: '24px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#2d2430', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>⏳</span> Smart Waiting List Hôm Nay
              </h3>
            </section>
            <section className="spa-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <StatCard
                icon="⏳"
                title="Khách đang chờ"
                value={stats.waitingTodayCount || 0}
                note="Chờ khớp khung giờ trống"
                type="gold"
              />
              <StatCard
                icon="⚡"
                title="Đã khớp slot"
                value={stats.matchedTodayCount || 0}
                note="Đang trong 15p giữ chỗ"
                type="green"
              />
              <StatCard
                icon="✅"
                title="Đã đặt lịch thành công"
                value={stats.bookedTodayCount || 0}
                note="Từ hàng chờ chuyển sang"
                type="green"
              />
              <StatCard
                icon="📆"
                title="Đã hết hạn/Bỏ lỡ"
                value={stats.expiredTodayCount || 0}
                note="Tự động hủy lúc 23:59:59"
                type="red"
              />
            </section>

            <section className="spa-main-grid">
              <div className="spa-card spa-appointments-card">
                <div className="spa-card-head">
                  <h3>Lịch hẹn hôm nay</h3>
                  <Link to="/receptionist/appointments">Xem tất cả</Link>
                </div>

                <div className="spa-timeline">
                  {appointments.length === 0 ? (
                    <p className="spa-empty">Hôm nay chưa có lịch hẹn.</p>
                  ) : (
                    appointments.slice(0, 6).map((a) => (
                      <div className="spa-timeline-row" key={a.AppointmentId}>
                        <span className="spa-time">{a.StartTime}</span>
                        <div className="spa-dot" />

                        <Avatar
                          src={a.CustomerAvatarUrl}
                          name={a.CustomerName}
                        />

                        <div className="spa-info">
                          <h4>{a.CustomerName}</h4>
                          <p>
                            {a.ServiceName} · KTV:{" "}
                            {a.TechnicianName || "Chưa có"}
                          </p>
                        </div>

                        <Badge status={a.Status} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="spa-card spa-checkin-card">
                <div className="spa-card-head">
                  <h3>Hàng chờ check-in</h3>
                  <Link to="/receptionist/appointments?status=CONFIRMED">
                    Xem tất cả
                  </Link>
                </div>

                <div className="spa-queue">
                  {checkInQueue.length === 0 ? (
                    <p className="spa-empty">
                      Không có khách đang chờ check-in.
                    </p>
                  ) : (
                    checkInQueue.slice(0, 5).map((a) => (
                      <div
                        className="spa-queue-row"
                        key={`queue-${a.AppointmentId}`}
                      >
                        <Avatar
                          src={a.CustomerAvatarUrl}
                          name={a.CustomerName}
                        />

                        <div>
                          <h4>{a.CustomerName}</h4>
                          <p>{a.ServiceName}</p>
                          <small>
                            {a.StartTime} - {a.EndTime}
                          </small>
                        </div>

                        <div className="spa-room">
                          <b>{a.TotalDuration || 0} phút</b>
                          <span>{a.Status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Link
                  className="spa-checkin-btn"
                  to="/receptionist/appointments?status=CONFIRMED"
                >
                  Check-in khách tiếp theo →
                </Link>
              </div>

              <div className="spa-card spa-calendar-card">
                <div className="spa-card-head">
                  <h3>Lịch nhanh</h3>
                  <span>
                    {today.toLocaleDateString("vi-VN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="spa-calendar">
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                    <b key={d}>{d}</b>
                  ))}

                  {Array.from({ length: 35 }).map((_, index) => {
                    const day = index + 1;
                    return (
                      <span
                        key={index}
                        className={day === today.getDate() ? "active" : ""}
                      >
                        {day <= 31 ? day : ""}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="spa-card spa-reminder-card">
                <h3>Hoạt động gân đây</h3>

                {recentCheckIns.length === 0 ? (
                  <p className="spa-empty">Chưa có hoạt động check-in.</p>
                ) : (
                  recentCheckIns.slice(0, 3).map((item) => (
                    <div
                      className="spa-reminder"
                      key={`recent-checkin-${item.AppointmentId}`}
                    >
                      <Avatar
                        src={item.CustomerAvatarUrl}
                        name={item.CustomerName}
                      />

                      <div>
                        <b>{item.CustomerName}</b>
                        <p>
                          {item.ServiceName} · {item.Status}
                        </p>
                      </div>

                      <small>{item.StartTime}</small>
                    </div>
                  ))
                )}
              </div>

              <div className="spa-card spa-revenue-card">
                <div className="spa-card-head">
                  <h3>Doanh thu hôm nay</h3>
                  <Link to="/receptionist/invoices">Hóa đơn</Link>
                </div>

                <h2>{money(stats.todayRevenue)}</h2>
                <p className="trend-green">
                  Dựa trên các payment PAID trong ngày.
                </p>

                <div className="spa-line-chart">
                  <div className="spa-line-path" />
                  <div className="spa-chart-days">
                    <span>Paid</span>
                    <span>{paidInvoiceCount}</span>
                    <span>Unpaid</span>
                    <span>{unpaidInvoiceCount}</span>
                    <span>Refund</span>
                    <span>{refundPendingCount}</span>
                  </div>
                </div>
              </div>

              <div className="spa-card spa-services-card">
                <div className="spa-card-head">
                  <h3>Dịch vụ phổ biến hôm nay</h3>
                  <Link to="/receptionist/appointments">Xem lịch hẹn</Link>
                </div>

                {popularServices.length === 0 ? (
                  <p className="spa-empty">Chưa có dữ liệu dịch vụ hôm nay.</p>
                ) : (
                  popularServices.map((s) => {
                    const max = Math.max(
                      ...popularServices.map((x) =>
                        Number(x.BookingCount || 0),
                      ),
                      1,
                    );
                    const width = Math.round(
                      (Number(s.BookingCount || 0) / max) * 100,
                    );

                    return (
                      <div className="spa-service-progress" key={s.ServiceId}>
                        <div>
                          <span>{s.ServiceName}</span>
                          <b>{s.BookingCount} lượt</b>
                        </div>
                        <p>
                          <i style={{ width: `${width}%` }} />
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="spa-card spa-invoice-card">
                <div className="spa-card-head">
                  <h3>Tổng quan hóa đơn</h3>
                  <Link to="/receptionist/invoices">Xem tất cả</Link>
                </div>

                <div className="spa-invoice-row">
                  <span>🧾 Tổng hóa đơn</span>
                  <b>{invoiceCount}</b>
                </div>

                <div className="spa-invoice-row">
                  <span>✅ Đã thanh toán</span>
                  <b>
                    {paidInvoiceCount}{" "}
                    <small>{percent(paidInvoiceCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>📄 Chưa thanh toán</span>
                  <b>
                    {unpaidInvoiceCount}{" "}
                    <small>{percent(unpaidInvoiceCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>↩ Hoàn tiền</span>
                  <b>
                    {refundPendingCount}{" "}
                    <small>{percent(refundPendingCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-total-row">
                  <span>Doanh thu hôm nay</span>
                  <strong>{money(stats.todayRevenue)}</strong>
                </div>
              </div>

              <div className="spa-card spa-profile-card">
                <h3>Khách hàng gần đây</h3>

                <Avatar
                  className="spa-profile-avatar"
                  src={highlightedCustomer?.AvatarUrl}
                  name={highlightedCustomer?.FullName}
                />

                <h2>{highlightedCustomer?.FullName || "Chưa có khách hàng"}</h2>

                <ul>
                  <li>☎ {highlightedCustomer?.Phone || "Chưa có SĐT"}</li>
                  <li>✉ {highlightedCustomer?.Email || "Chưa có email"}</li>
                  <li>
                    📅 {highlightedCustomer?.TotalAppointments || 0} lịch hẹn
                  </li>
                  <li>
                    💰 Tổng chi tiêu: {money(highlightedCustomer?.TotalSpent)}
                  </li>
                  <li>
                    ♕ Thành viên từ:{" "}
                    {highlightedCustomer?.MemberSince
                      ? new Date(
                          highlightedCustomer.MemberSince,
                        ).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </li>
                </ul>

                <Link to="/receptionist/customers" className="spa-profile-btn">
                  Xem khách hàng
                </Link>
              </div>

              <div className="spa-card spa-recent-card">
                <div className="spa-card-head">
                  <h3>Lịch hẹn gần nhất</h3>
                  <Link to="/receptionist/appointments">Xem tất cả</Link>
                </div>

                {appointments.length === 0 ? (
                  <p className="spa-empty">Chưa có lịch hẹn hôm nay.</p>
                ) : (
                  appointments.slice(0, 4).map((a) => (
                    <div
                      className="spa-recent-row"
                      key={`recent-${a.AppointmentId}`}
                    >
                      <Avatar src={a.CustomerAvatarUrl} name={a.CustomerName} />

                      <div>
                        <h4>{a.CustomerName}</h4>
                        <p>
                          {a.StartTime} · {a.ServiceName}
                        </p>
                      </div>

                      <Badge status={a.Status} />
                    </div>
                  ))
                )}
              </div>

              <div className="spa-card spa-actions-card">
                <h3>Thao tác nhanh</h3>

                <div className="spa-actions">
                  <Link to="/receptionist/appointments/create">
                    📅
                    <span>Tạo lịch hẹn</span>
                  </Link>

                  <Link to="/receptionist/appointments?status=CONFIRMED">
                    ✅<span>Check-in khách</span>
                  </Link>

                  <Link to="/receptionist/appointments/create?walkin=1">
                    🚶
                    <span>Khách walk-in</span>
                  </Link>

                  <Link to="/receptionist/invoices">
                    🧾
                    <span>Quản lý hóa đơn</span>
                  </Link>

                  <Link to="/receptionist/waiting-list">
                    ⏳<span>Hàng chờ</span>
                  </Link>
                </div>
              </div>

              <div className="spa-promo-card">
                <div>
                  <h3>Hàng chờ hôm nay</h3>
                  <p>
                    Hiện có {stats.waitingListCount || 0} khách đang trong hàng
                    chờ. Lễ tân có thể chuyển khách sang lịch hẹn khi có slot
                    trống.
                  </p>

                  <Link to="/receptionist/waiting-list">Xem waiting list</Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
