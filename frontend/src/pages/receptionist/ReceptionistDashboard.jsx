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

function translateStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMED") return "Đã xác nhận";
  if (s === "COMPLETED") return "Đã hoàn thành";
  if (s === "CHECKED_IN") return "Đã check-in";
  if (s === "PENDING") return "Chờ xác nhận";
  if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (s === "CANCELLED") return "Đã hủy";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  return status;
}

function Badge({ status }) {
  const s = String(status || "").toUpperCase();
  let label = translateStatus(s);
  let className = s.toLowerCase();
  
  return <span className={`spa-badge spa-badge-${className}`}>{label}</span>;
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
  const typeClass = type === "gold" ? "spa-stat-gold" : type === "red" ? "spa-stat-red" : "";
  const noteClass = type === "red" ? "trend-red" : type === "gold" ? "trend-orange" : "trend-green";
  return (
    <div className="spa-stat-card">
      <div className="spa-stat-header">
        <span className="spa-stat-title">{title}</span>
        <div className={`spa-stat-icon ${typeClass}`}>{icon}</div>
      </div>
      <div className="spa-stat-body">
        <h2>{value}</h2>
      </div>
      <div className={`spa-stat-footer ${noteClass}`}>
        {note}
      </div>
    </div>
  );
}

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
          err.response?.data?.message || "Không tải được dữ liệu bảng điều khiển lễ tân",
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  const appointments = useMemo(() => {
    let list = stats?.todayAppointments || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (a) =>
          a.CustomerName?.toLowerCase().includes(q) ||
          a.ServiceName?.toLowerCase().includes(q) ||
          (a.TechnicianName && a.TechnicianName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [stats, searchQuery]);

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
              Bảng điều khiển lễ tân <span>🍃</span>
            </h1>
            <p>Dữ liệu thực tế ngày hôm nay: {todayText}</p>
          </div>

          <div className="spa-search">
            <span>⌕</span>
            <input
              placeholder="Tìm khách hàng, lịch hẹn, dịch vụ hôm nay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="spa-top-actions">
            <Link className="spa-circle-btn" to="/receptionist/profile" title="Hồ sơ cá nhân">
              👤
            </Link>

            <Link className="spa-circle-btn" to="/receptionist/appointments" title="Xem lịch hẹn">
              📅
            </Link>

            <Link
              className="spa-new-btn"
              to="/receptionist/appointments/create"
            >
              + Tạo lịch hẹn mới
            </Link>
          </div>
        </header>

        {error && <div className="spa-error">{error}</div>}

        {!stats ? (
          <div className="spa-loading">Đang tải dữ liệu bảng điều khiển...</div>
        ) : (
          <>
            <section className="spa-stats">
              <StatCard
                icon="📅"
                title="Lịch Hẹn Hôm Nay"
                value={stats.todayAppointmentsCount || 0}
                note={`${stats.pendingCount || 0} yêu cầu chờ xác nhận`}
              />

              <StatCard
                icon="✅"
                title="Đã Check-in"
                value={stats.checkedInCount || 0}
                note={`${stats.confirmedCount || 0} khách sẵn sàng chờ dịch vụ`}
                type="gold"
              />

              <StatCard
                icon="💆"
                title="Đang Phục Vụ"
                value={stats.inProgressCount || 0}
                note={`${stats.completedCount || 0} khách đã hoàn thành xong`}
              />

              <StatCard
                icon="💰"
                title="Doanh Thu Hôm Nay"
                value={money(stats.todayRevenue)}
                note={`${stats.paidInvoiceCount || 0} hóa đơn đã thanh toán`}
                type="gold"
              />

              <StatCard
                icon="↩"
                title="Yêu Cầu Hoàn Tiền"
                value={stats.refundPendingCount || 0}
                note={`${stats.waitingListCount || 0} khách trong hàng đợi`}
                type="red"
              />
            </section>

            <section className="spa-stats-title-section" style={{ marginTop: '32px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#2d2430', display: 'flex', alignItems: 'center', fontFamily: 'var(--font-heading), Georgia, serif' }}>
                <span style={{ marginRight: '10px' }}>⏳</span> Hệ Thống Hàng Chờ Thông Minh (Smart Waiting List)
              </h3>
            </section>
            <section className="spa-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <StatCard
                icon="⏳"
                title="Khách Đang Chờ"
                value={stats.waitingTodayCount || 0}
                note="Đang chờ khớp khung giờ trống"
                type="gold"
              />
              <StatCard
                icon="⚡"
                title="Đã Khớp Khung Giờ"
                value={stats.matchedTodayCount || 0}
                note="Đang giữ chỗ tạm thời (15p)"
                type="green"
              />
              <StatCard
                icon="✅"
                title="Đã Đặt Lịch Thành Công"
                value={stats.bookedTodayCount || 0}
                note="Đã chuyển thành công từ hàng chờ"
                type="green"
              />
              <StatCard
                icon="📆"
                title="Hết Hạn / Bỏ Lỡ"
                value={stats.expiredTodayCount || 0}
                note="Hệ thống tự động hủy lúc 23:59:59"
                type="red"
              />
            </section>

            <section className="spa-main-grid">
              <div className="spa-card spa-appointments-card">
                <div className="spa-card-head">
                  <h3>Lịch hẹn trong ngày</h3>
                  <Link to="/receptionist/appointments">Xem toàn bộ</Link>
                </div>

                <div className="spa-timeline">
                  {appointments.length === 0 ? (
                    <p className="spa-empty">Không tìm thấy lịch hẹn nào hôm nay.</p>
                  ) : (
                    appointments.map((a) => (
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
                            {a.TechnicianName || "Chưa phân bổ"}
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
                  <h3>Khách chờ check-in</h3>
                  <Link to="/receptionist/appointments?status=CONFIRMED">
                    Danh sách
                  </Link>
                </div>

                <div className="spa-queue">
                  {checkInQueue.length === 0 ? (
                    <p className="spa-empty">
                      Hiện tại không có khách nào đang chờ check-in.
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
                            Khung giờ: {a.StartTime} - {a.EndTime}
                          </small>
                        </div>

                        <div className="spa-room">
                          <b>{a.TotalDuration || 0} phút</b>
                          <span>{translateStatus(a.Status)}</span>
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
                  <h3>Lịch tháng</h3>
                  <span>
                    Tháng {today.getMonth() + 1} / {today.getFullYear()}
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
                <h3>Hoạt động vừa diễn ra</h3>

                <div className="spa-queue" style={{ maxHeight: "250px" }}>
                  {recentCheckIns.length === 0 ? (
                    <p className="spa-empty">Chưa có hoạt động check-in nào.</p>
                  ) : (
                    recentCheckIns.slice(0, 4).map((item) => (
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
                            {item.ServiceName} · {translateStatus(item.Status)}
                          </p>
                        </div>

                        <small>{item.StartTime}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="spa-card spa-revenue-card">
                <div className="spa-card-head">
                  <h3>Doanh thu theo hóa đơn</h3>
                  <Link to="/receptionist/invoices">Hóa đơn</Link>
                </div>

                <h2>{money(stats.todayRevenue)}</h2>
                <p className="trend-green" style={{ fontSize: '13px' }}>
                  Tổng doanh thu từ các giao dịch thành công.
                </p>

                <div className="spa-line-chart">
                  <div className="spa-line-path" />
                  <div className="spa-chart-days">
                    <span>Đã thu</span>
                    <span>{paidInvoiceCount}</span>
                    <span>Chưa thu</span>
                    <span>{unpaidInvoiceCount}</span>
                    <span>Hoàn tiền</span>
                    <span>{refundPendingCount}</span>
                  </div>
                </div>
              </div>

              <div className="spa-card spa-services-card">
                <div className="spa-card-head">
                  <h3>Dịch vụ được chọn nhiều</h3>
                  <Link to="/receptionist/appointments">Chi tiết</Link>
                </div>

                {popularServices.length === 0 ? (
                  <p className="spa-empty">Chưa có số liệu thống kê dịch vụ.</p>
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
                  <h3>Tổng quan hóa đơn hôm nay</h3>
                  <Link to="/receptionist/invoices">Xem tất cả</Link>
                </div>

                <div className="spa-invoice-row">
                  <span>🧾 Tổng số lượng hóa đơn</span>
                  <b>{invoiceCount}</b>
                </div>

                <div className="spa-invoice-row">
                  <span>✅ Hóa đơn đã thanh toán</span>
                  <b>
                    {paidInvoiceCount}{" "}
                    <small>{percent(paidInvoiceCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>📄 Hóa đơn chưa thanh toán</span>
                  <b>
                    {unpaidInvoiceCount}{" "}
                    <small>{percent(unpaidInvoiceCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-invoice-row">
                  <span>↩ Hóa đơn chờ hoàn tiền</span>
                  <b>
                    {refundPendingCount}{" "}
                    <small>{percent(refundPendingCount, invoiceCount)}%</small>
                  </b>
                </div>

                <div className="spa-total-row">
                  <span>Tổng doanh thu thực tế</span>
                  <strong>{money(stats.todayRevenue)}</strong>
                </div>
              </div>

              <div className="spa-card spa-profile-card">
                <h3>Khách hàng nổi bật gần đây</h3>

                <Avatar
                  className="spa-profile-avatar"
                  src={highlightedCustomer?.AvatarUrl}
                  name={highlightedCustomer?.FullName}
                />

                <h2>{highlightedCustomer?.FullName || "Chưa có thông tin"}</h2>

                <ul>
                  <li>☎ Điện thoại: {highlightedCustomer?.Phone || "Chưa cập nhật"}</li>
                  <li>✉ Email: {highlightedCustomer?.Email || "Chưa cập nhật"}</li>
                  <li>
                    📅 Tổng lịch hẹn: {highlightedCustomer?.TotalAppointments || 0} lần
                  </li>
                  <li>
                    💰 Tổng tích lũy chi tiêu: {money(highlightedCustomer?.TotalSpent)}
                  </li>
                  <li>
                    ♕ Ngày tham gia:{" "}
                    {highlightedCustomer?.MemberSince
                      ? new Date(
                          highlightedCustomer.MemberSince,
                        ).toLocaleDateString("vi-VN")
                      : "Chưa cập nhật"}
                  </li>
                </ul>

                <Link to="/receptionist/customers" className="spa-profile-btn">
                  Xem chi tiết khách hàng
                </Link>
              </div>

              <div className="spa-card spa-recent-card">
                <div className="spa-card-head">
                  <h3>Lịch hẹn mới đặt</h3>
                  <Link to="/receptionist/appointments">Xem tất cả</Link>
                </div>

                {appointments.length === 0 ? (
                  <p className="spa-empty">Chưa có lịch hẹn nào mới.</p>
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
                          Thời gian: {a.StartTime} · {a.ServiceName}
                        </p>
                      </div>

                      <Badge status={a.Status} />
                    </div>
                  ))
                )}
              </div>

              <div className="spa-card spa-actions-card">
                <h3>Thao tác nhanh thường dùng</h3>

                <div className="spa-actions">
                  <Link to="/receptionist/appointments/create">
                    📅
                    <span>Đặt lịch hẹn</span>
                  </Link>

                  <Link to="/receptionist/appointments?status=CONFIRMED">
                    ✅
                    <span>Check-in</span>
                  </Link>

                  <Link to="/receptionist/appointments/create?walkin=1">
                    🚶
                    <span>Khách Walk-in</span>
                  </Link>

                  <Link to="/receptionist/invoices">
                    🧾
                    <span>Hóa đơn</span>
                  </Link>

                  <Link to="/receptionist/waiting-list">
                    ⏳
                    <span>Hàng chờ</span>
                  </Link>
                </div>
              </div>

              <div className="spa-promo-card">
                <div>
                  <h3>Quản lý danh sách hàng chờ</h3>
                  <p>
                    Hiện tại đang có {stats.waitingListCount || 0} khách hàng nằm trong danh sách chờ. 
                    Bạn có thể theo dõi và xếp slot lịch hẹn trống ngay lập tức khi có kỹ thuật viên rảnh.
                  </p>

                  <Link to="/receptionist/waiting-list">Xem hàng chờ ngay</Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}

