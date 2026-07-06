import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function date(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("vi-VN");
}

function datetime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
}

function translateRole(role) {
  const map = {
    RECEPTIONIST: "Lễ tân",
    ADMIN: "Quản trị viên",
    MANAGER: "Quản lý",
    TECHNICIAN: "Kỹ thuật viên",
  };
  return map[String(role).toUpperCase()] || role || "Lễ tân";
}

function statusClass(status) {
  return `rc-status-badge rc-status-${String(status || "unknown").toLowerCase()}`;
}

function translateStatus(status) {
  const map = {
    PENDING: "Đang chờ",
    PENDING_PAYMENT: "Chờ thanh toán",
    CONFIRMED: "Đã xác nhận",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
    CHECKED_IN: "Đã đến",
    IN_PROGRESS: "Đang làm",
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
  };
  return map[String(status).toUpperCase()] || status || "Không rõ";
}

export default function ReceptionistProfile() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/receptionist/profile");
      setData(res.data.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được hồ sơ lễ tân");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const recentAppointments = data?.recentAppointments || [];
  const recentInvoices = data?.recentInvoices || [];
  const shifts = data?.shifts || [];

  const avatarUrl = useMemo(() => {
    return avatar(profile.AvatarUrl || profile.ImageUrl);
  }, [profile.AvatarUrl, profile.ImageUrl]);

  return (
    <ReceptionistLayout>
      <div id="rc-profile-container">
        {/* Scoped CSS styling for receptionist profile */}
        <style>{`
          #rc-profile-container {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #1f2937;
            padding: 20px 8px;
            max-width: 1400px;
            margin: 0 auto;
          }

          .rc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }

          .rc-header h1 {
            font-size: 2rem;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.02em;
            margin: 0 0 4px 0;
          }

          .rc-header p {
            color: #6b7280;
            margin: 0;
            font-size: 0.9rem;
          }

          .rc-btn-group {
            display: flex;
            gap: 10px;
          }

          .rc-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 18px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border: none;
            text-decoration: none;
          }

          .rc-btn-primary {
            background: linear-gradient(135deg, #ef4f83 0%, #c9235e 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(239, 79, 131, 0.25);
          }

          .rc-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(239, 79, 131, 0.35);
          }

          .rc-btn-secondary {
            background: white;
            color: #4b5563;
            border: 1px solid #e5e7eb;
          }

          .rc-btn-secondary:hover {
            background: #f9fafb;
            border-color: #d1d5db;
          }

          .rc-hero-banner {
            background: linear-gradient(135deg, #1c1917 0%, #3a322d 100%);
            border-radius: 24px;
            padding: 30px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            box-shadow: 0 8px 24px rgba(45, 33, 22, 0.12);
            position: relative;
            overflow: hidden;
          }

          .rc-hero-banner::after {
            content: "";
            position: absolute;
            top: -60px;
            right: -60px;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: rgba(239, 79, 131, 0.08);
            filter: blur(40px);
            pointer-events: none;
          }

          .rc-hero-left {
            display: flex;
            align-items: center;
            gap: 20px;
          }

          .rc-avatar-container {
            position: relative;
            width: 110px;
            height: 110px;
            flex-shrink: 0;
          }

          .rc-avatar-container img {
            width: 100%;
            height: 100%;
            border-radius: 18px;
            object-fit: cover;
            border: 3px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
          }

          .rc-online-badge {
            position: absolute;
            bottom: -3px;
            right: -3px;
            width: 14px;
            height: 14px;
            background: #10b981;
            border: 2.5px solid #1c1917;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
          }

          .rc-name {
            font-size: 1.5rem;
            font-weight: 800;
            margin: 0 0 4px 0;
            letter-spacing: -0.01em;
          }

          .rc-badge {
            background: rgba(239, 79, 131, 0.2);
            color: #ff7aa6;
            padding: 4px 10px;
            border-radius: 99px;
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: inline-block;
            margin-bottom: 6px;
            border: 1px solid rgba(239, 79, 131, 0.25);
          }

          .rc-title {
            color: #d1d5db;
            font-size: 0.85rem;
            margin: 0 0 14px 0;
            font-weight: 500;
          }

          .rc-contacts {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }

          .rc-contacts span {
            font-size: 0.8rem;
            color: #9ca3af;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 10px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .rc-hero-right {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            min-width: 300px;
            margin-left: 20px;
          }

          .rc-hero-info-box {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 14px;
            padding: 10px 14px;
          }

          .rc-hero-info-box span {
            display: block;
            font-size: 0.7rem;
            color: #9ca3af;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
          }

          .rc-hero-info-box b {
            font-size: 0.85rem;
            color: #f3f4f6;
          }

          .rc-stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }

          .rc-stat-card {
            background: white;
            border: 1px solid #f3f4f6;
            border-radius: 20px;
            padding: 18px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
            transition: all 0.2s ease-in-out;
          }

          .rc-stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.03);
            border-color: #e5e7eb;
          }

          .rc-stat-icon-wrap {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.35rem;
            flex-shrink: 0;
          }

          .rc-stat-card:nth-child(1) .rc-stat-icon-wrap { background: #fef3c7; color: #d97706; }
          .rc-stat-card:nth-child(2) .rc-stat-icon-wrap { background: #d1fae5; color: #059669; }
          .rc-stat-card:nth-child(3) .rc-stat-icon-wrap { background: #e0e7ff; color: #4f46e5; }
          .rc-stat-card:nth-child(4) .rc-stat-icon-wrap { background: #fce7f3; color: #db2777; }

          .rc-stat-info span {
            display: block;
            font-size: 0.75rem;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 2px;
            line-height: 1.2;
          }

          .rc-stat-info b {
            font-size: 1.5rem;
            font-weight: 800;
            color: #111827;
            display: block;
            line-height: 1.1;
          }

          .rc-stat-info small {
            font-size: 0.65rem;
            color: #9ca3af;
          }

          .rc-dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }

          .rc-dashboard-column {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .rc-section-card {
            background: white;
            border: 1px solid #f3f4f6;
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
            display: flex;
            flex-direction: column;
          }

          .rc-section-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            border-bottom: 1px solid #f9fafb;
            padding-bottom: 10px;
          }

          .rc-section-card-header h3 {
            font-size: 1rem;
            font-weight: 700;
            color: #111827;
            margin: 0;
          }

          .rc-section-card-header a {
            font-size: 0.75rem;
            color: #c9235e;
            font-weight: 700;
            text-decoration: none;
          }

          .rc-section-card-header a:hover {
            text-decoration: underline;
          }

          .rc-details-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .rc-details-item {
            background: #fafaf9;
            border: 1px solid #f5f5f4;
            border-radius: 12px;
            padding: 10px 12px;
          }

          .rc-details-item label {
            display: block;
            font-size: 0.65rem;
            color: #78716c;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 2px;
          }

          .rc-details-item b {
            font-size: 0.85rem;
            color: #1c1917;
          }

          .rc-list-items {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .rc-list-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: #fafaf9;
            border: 1px solid #f5f5f4;
            border-radius: 12px;
            text-decoration: none;
            transition: all 0.2s ease-in-out;
          }

          .rc-list-row:hover {
            background: #f5f5f4;
            transform: translateX(4px);
          }

          .rc-row-info b {
            display: block;
            font-size: 0.85rem;
            color: #1c1917;
            margin-bottom: 2px;
          }

          .rc-row-info span {
            font-size: 0.7rem;
            color: #78716c;
          }

          .rc-status-badge {
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 0.65rem;
            font-weight: 750;
            text-transform: uppercase;
          }

          .rc-status-pending_payment,
          .rc-status-unpaid {
            background: #fef3c7;
            color: #d97706;
          }

          .rc-status-confirmed,
          .rc-status-paid {
            background: #d1fae5;
            color: #059669;
          }

          .rc-status-completed {
            background: #e0e7ff;
            color: #4f46e5;
          }

          .rc-status-cancelled {
            background: #fee2e2;
            color: #dc2626;
          }

          .rc-status-checked_in,
          .rc-status-in_progress {
            background: #e0f2fe;
            color: #0284c7;
          }

          .rc-action-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-top: 6px;
          }

          .rc-action-card {
            background: #fafaf9;
            border: 1px solid #f5f5f4;
            border-radius: 16px;
            padding: 16px;
            text-align: center;
            text-decoration: none;
            transition: all 0.2s ease-in-out;
          }

          .rc-action-card:hover {
            background: white;
            border-color: #ef4f83;
            box-shadow: 0 6px 16px rgba(239, 79, 131, 0.08);
            transform: translateY(-4px);
          }

          .rc-action-icon {
            font-size: 1.75rem;
            margin-bottom: 8px;
            display: block;
          }

          .rc-action-card b {
            display: block;
            font-size: 0.85rem;
            color: #1c1917;
            margin-bottom: 2px;
          }

          .rc-action-card p {
            font-size: 0.7rem;
            color: #78716c;
            margin: 0;
            line-height: 1.3;
          }

          .rc-empty {
            font-size: 0.8rem;
            color: #9ca3af;
            text-align: center;
            padding: 20px;
            margin: 0;
          }
        `}</style>

        <header className="rc-header">
          <div>
            <p style={{ color: "#c9235e", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 4px 0" }}>Receptionist Workspace</p>
            <h1>Không gian làm việc Lễ tân</h1>
            <p>Theo dõi thông tin nhân sự, số liệu tiếp đón và xử lý lịch hẹn của khách hàng.</p>
          </div>

          <div className="rc-btn-group">
            <button className="rc-btn rc-btn-secondary" onClick={loadProfile}>
              ↻ Làm mới
            </button>

            <button
              className="rc-btn rc-btn-primary"
              onClick={() => navigate("/receptionist/settings")}
            >
              ⚙ Chỉnh sửa hồ sơ
            </button>
          </div>
        </header>

        {loading && <div className="rc-empty">Đang tải hồ sơ nhân viên...</div>}

        {error && !loading && (
          <div style={{ padding: "30px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "16px", textAlign: "center" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "10px" }}>⚠️</span>
            <b style={{ color: "#991b1b", display: "block", marginBottom: "6px" }}>Không tải được dữ liệu</b>
            <p style={{ color: "#7f1d1d", fontSize: "0.85rem", margin: "0 0 16px 0" }}>{error}</p>
            <button className="rc-btn rc-btn-secondary" onClick={loadProfile}>Thử lại</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 1. HERO WORKSPACE CARD */}
            <section className="rc-hero-banner">
              <div className="rc-hero-left">
                <div className="rc-avatar-container">
                  <img
                    src={avatarUrl}
                    alt={profile.FullName || "Lễ tân"}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <span className="rc-online-badge" />
                </div>

                <div>
                  <span className="rc-badge">
                    {translateRole(profile.RoleName)}
                  </span>

                  <h2 className="rc-name">{profile.FullName || "Chưa thiết lập"}</h2>
                  <p className="rc-title">{profile.Position || "Lễ tân quầy đón tiếp"}</p>

                  <div className="rc-contacts">
                    <span>📧 {profile.Email || "-"}</span>
                    <span>📞 {profile.Phone || "-"}</span>
                    <span>🏢 {profile.BranchName || "Chi nhánh chính"}</span>
                  </div>
                </div>
              </div>

              <div className="rc-hero-right">
                <div className="rc-hero-info-box">
                  <span>Mã nhân viên</span>
                  <b>#{profile.EmployeeId || "N/A"}</b>
                </div>

                <div className="rc-hero-info-box">
                  <span>Chi nhánh trực thuộc</span>
                  <b>{profile.BranchName || "Chi nhánh chính"}</b>
                </div>

                <div className="rc-hero-info-box">
                  <span>Ngày vào làm</span>
                  <b>{date(profile.HireDate)}</b>
                </div>

                <div className="rc-hero-info-box">
                  <span>Trạng thái hoạt động</span>
                  <b style={{ color: "#10b981" }}>● Đang hoạt động</b>
                </div>
              </div>
            </section>

            {/* 2. STATISTICS GRID (Workspace Counters) */}
            <section className="rc-stats-grid">
              <div className="rc-stat-card">
                <div className="rc-stat-icon-wrap">📅</div>
                <div className="rc-stat-info">
                  <span>Hẹn hôm nay</span>
                  <b>{stats.TodayAppointments || 0}</b>
                  <small>Tổng số khách đặt</small>
                </div>
              </div>

              <div className="rc-stat-card">
                <div className="rc-stat-icon-wrap">✅</div>
                <div className="rc-stat-info">
                  <span>Đã check-in</span>
                  <b>{stats.CheckedInToday || 0}</b>
                  <small>Khách đến tiệm</small>
                </div>
              </div>

              <div className="rc-stat-card">
                <div className="rc-stat-icon-wrap">👥</div>
                <div className="rc-stat-info">
                  <span>Khách mới</span>
                  <b>{stats.CustomersCreated || 0}</b>
                  <small>Đăng ký hôm nay</small>
                </div>
              </div>

              <div className="rc-stat-card">
                <div className="rc-stat-icon-wrap">🧾</div>
                <div className="rc-stat-info">
                  <span>Giao dịch hoàn tất</span>
                  <b>{stats.PaidInvoicesToday || 0}</b>
                  <small>Hóa đơn đã thu tiền</small>
                </div>
              </div>
            </section>

            {/* 3. BUSINESS COLUMNS */}
            <section className="rc-dashboard-grid">
              {/* Left Column: HR records, Shift list, & Actions */}
              <div className="rc-dashboard-column">
                <article className="rc-section-card">
                  <div className="rc-section-card-header">
                    <h3>Thông tin nhân sự</h3>
                    <Link to="/receptionist/settings">Cập nhật hồ sơ</Link>
                  </div>

                  <div className="rc-details-list">
                    <div className="rc-details-item">
                      <label>Họ và tên</label>
                      <b>{profile.FullName || "-"}</b>
                    </div>

                    <div className="rc-details-item">
                      <label>Chức vụ cụ thể</label>
                      <b>{profile.Position || "Lễ tân đón tiếp"}</b>
                    </div>

                    <div className="rc-details-item">
                      <label>Mã tài khoản (User)</label>
                      <b>#{profile.UserId || "-"}</b>
                    </div>

                    <div className="rc-details-item">
                      <label>Mã nhân viên (Employee)</label>
                      <b>#{profile.EmployeeId || "-"}</b>
                    </div>

                    <div className="rc-details-item">
                      <label>Ngày tạo tài khoản</label>
                      <b>{date(profile.CreatedAt)}</b>
                    </div>

                    <div className="rc-details-item">
                      <label>Cập nhật lần cuối</label>
                      <b>{datetime(profile.UpdatedAt)}</b>
                    </div>
                  </div>
                </article>

                {/* WORK SHIFTS CARD */}
                <article className="rc-section-card">
                  <div className="rc-section-card-header">
                    <h3>Lịch trực & Ca làm việc</h3>
                  </div>

                  <div className="rc-list-items" style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {shifts.length === 0 ? (
                      <p className="rc-empty">Không có ca trực nào được xếp lịch.</p>
                    ) : (
                      shifts.map((s, idx) => (
                        <div
                          className="rc-list-row"
                          key={s.ShiftId || idx}
                          style={{ cursor: "default", marginBottom: "8px" }}
                        >
                          <div className="rc-row-info">
                            <b>{s.ShiftName}</b>
                            <span>{date(s.ShiftDate)}</span>
                          </div>

                          <span style={{ fontSize: "0.8rem", color: "#c9235e", fontWeight: "700" }}>
                            {s.StartTime} - {s.EndTime}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="rc-section-card">
                  <div className="rc-section-card-header">
                    <h3>Thao tác nghiệp vụ nhanh</h3>
                  </div>

                  <div className="rc-action-grid">
                    <Link className="rc-action-card" to="/receptionist/appointments/create">
                      <span className="rc-action-icon">📅</span>
                      <b>Đặt lịch hẹn</b>
                      <p>Tiếp nhận và đặt chỗ cho khách hàng</p>
                    </Link>

                    <Link className="rc-action-card" to="/receptionist/customers">
                      <span className="rc-action-icon">👥</span>
                      <b>Khách hàng</b>
                      <p>Tra cứu hồ sơ khách tại Salon</p>
                    </Link>

                    <Link className="rc-action-card" to="/receptionist/invoices">
                      <span className="rc-action-icon">🧾</span>
                      <b>Thanh toán</b>
                      <p>Xuất hóa đơn và thu tiền khách hàng</p>
                    </Link>

                    <Link className="rc-action-card" to="/receptionist/waiting-list">
                      <span className="rc-action-icon">⏳</span>
                      <b>Waiting List</b>
                      <p>Sắp xếp khách hàng trong hàng chờ</p>
                    </Link>
                  </div>
                </article>
              </div>

              {/* Right Column: Operations list (Recent appointments & invoices) */}
              <div className="rc-dashboard-column">
                <article className="rc-section-card" style={{ flexGrow: 1 }}>
                  <div className="rc-section-card-header">
                    <h3>Lịch hẹn vừa thao tác</h3>
                    <Link to="/receptionist/appointments">Xem tất cả</Link>
                  </div>

                  <div className="rc-list-items" style={{ maxHeight: "360px", overflowY: "auto" }}>
                    {recentAppointments.length === 0 ? (
                      <p className="rc-empty">Chưa có hoạt động đặt lịch nào.</p>
                    ) : (
                      recentAppointments.map((item) => (
                        <Link
                          className="rc-list-row"
                          to={`/receptionist/appointments/${item.AppointmentId}`}
                          key={item.AppointmentId}
                          style={{ marginBottom: "8px" }}
                        >
                          <div className="rc-row-info">
                            <b>#{item.AppointmentId} - {item.CustomerName || "Khách vãng lai"}</b>
                            <span>
                              {date(item.AppointmentDate)} · {item.StartTime || "--:--"}
                            </span>
                          </div>

                          <span className={statusClass(item.Status)}>
                            {translateStatus(item.Status)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </article>

                <article className="rc-section-card" style={{ flexGrow: 1 }}>
                  <div className="rc-section-card-header">
                    <h3>Hóa đơn vừa giao dịch</h3>
                    <Link to="/receptionist/invoices">Xem tất cả</Link>
                  </div>

                  <div className="rc-list-items" style={{ maxHeight: "360px", overflowY: "auto" }}>
                    {recentInvoices.length === 0 ? (
                      <p className="rc-empty">Chưa có giao dịch thu tiền gần đây.</p>
                    ) : (
                      recentInvoices.map((item) => (
                        <Link
                          className="rc-list-row"
                          to={`/receptionist/invoices/${item.InvoiceId}`}
                          key={item.InvoiceId}
                          style={{ marginBottom: "8px" }}
                        >
                          <div className="rc-row-info">
                            <b>#{item.InvoiceId} - {item.CustomerName || "Khách hàng"}</b>
                            <span>Tổng tiền: <strong style={{ color: "#c9235e" }}>{money(item.FinalAmount)}</strong></span>
                          </div>

                          <span className={statusClass(item.Status)}>
                            {translateStatus(item.Status)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
