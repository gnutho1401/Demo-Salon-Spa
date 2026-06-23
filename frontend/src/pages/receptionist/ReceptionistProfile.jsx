import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
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

function statusClass(status) {
  return `rxp-status rxp-status-${String(status || "unknown").toLowerCase()}`;
}

function StatBox({ icon, label, value, note }) {
  return (
    <article className="rxp-stat-box">
      <div className="rxp-stat-icon">{icon}</div>
      <div>
        <b>{value}</b>
        <span>{label}</span>
        {note && <small>{note}</small>}
      </div>
    </article>
  );
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

  const avatarUrl = useMemo(() => {
    return avatar(profile.AvatarUrl || profile.ImageUrl);
  }, [profile.AvatarUrl, profile.ImageUrl]);

  return (
    <ReceptionistLayout>
      <div className="rxp-page">
        <header className="rxp-header">
          <div>
            <p className="rxp-eyebrow">Receptionist Workspace</p>
            <h1>Hồ sơ lễ tân</h1>
            <span>
              Theo dõi thông tin cá nhân, hiệu suất làm việc và hoạt động gần
              đây.
            </span>
          </div>

          <div className="rxp-header-actions">
            <button className="rxp-light-btn" onClick={loadProfile}>
              Làm mới
            </button>

            <button
              className="rxp-primary-btn"
              onClick={() => navigate("/receptionist/settings")}
            >
              Chỉnh sửa hồ sơ
            </button>
          </div>
        </header>

        {loading && <div className="rxp-loading">Đang tải hồ sơ...</div>}

        {error && !loading && (
          <div className="rxp-error">
            <b>Không tải được dữ liệu</b>
            <p>{error}</p>
            <button onClick={loadProfile}>Thử lại</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="rxp-hero">
              <div className="rxp-hero-left">
                <div className="rxp-avatar-wrap">
                  <img
                    src={avatarUrl}
                    alt={profile.FullName || "Receptionist"}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />

                  <span className="rxp-online-dot" />
                </div>

                <div className="rxp-identity">
                  <span className="rxp-role">
                    {profile.RoleName || "Receptionist"}
                  </span>

                  <h2>{profile.FullName || "Chưa có tên"}</h2>

                  <p>{profile.Position || "Receptionist"}</p>

                  <div className="rxp-contact-list">
                    <span>📧 {profile.Email || "Chưa có email"}</span>
                    <span>📞 {profile.Phone || "Chưa có số điện thoại"}</span>
                    <span>🏢 {profile.Department || "Front Desk"}</span>
                  </div>
                </div>
              </div>

              <div className="rxp-hero-right">
                <div>
                  <span>Trạng thái tài khoản</span>
                  <b>{profile.Status || "ACTIVE"}</b>
                </div>

                <div>
                  <span>Trạng thái nhân viên</span>
                  <b>{profile.EmployeeStatus || "ACTIVE"}</b>
                </div>

                <div>
                  <span>Ngày vào làm</span>
                  <b>{date(profile.HireDate)}</b>
                </div>

                <div>
                  <span>Ngày tạo tài khoản</span>
                  <b>{date(profile.CreatedAt)}</b>
                </div>
              </div>
            </section>

            <section className="rxp-stats-grid">
              <StatBox
                icon="📅"
                label="Lịch hẹn hôm nay"
                value={stats.TodayAppointments || 0}
                note="Tổng lịch trong ngày"
              />

              <StatBox
                icon="✅"
                label="Khách đã check-in"
                value={stats.CheckedInToday || 0}
                note="CHECKED_IN / IN_PROGRESS / COMPLETED"
              />

              <StatBox
                icon="👥"
                label="Khách mới hôm nay"
                value={stats.CustomersCreated || 0}
                note="Khách được tạo trong ngày"
              />

              <StatBox
                icon="🧾"
                label="Hóa đơn đã thanh toán"
                value={stats.PaidInvoicesToday || 0}
                note="Invoice PAID trong ngày"
              />
            </section>

            <section className="rxp-content-grid">
              <article className="rxp-card rxp-about-card">
                <div className="rxp-card-head">
                  <h3>Thông tin chuyên môn</h3>
                  <Link to="/receptionist/settings">Cập nhật</Link>
                </div>

                <p className="rxp-bio">
                  {profile.Bio ||
                    "Chưa có mô tả cá nhân. Bạn có thể cập nhật phần giới thiệu trong trang Settings."}
                </p>

                <div className="rxp-info-grid">
                  <div>
                    <span>Mã User</span>
                    <b>#{profile.UserId || "-"}</b>
                  </div>

                  <div>
                    <span>Mã nhân viên</span>
                    <b>#{profile.EmployeeId || "-"}</b>
                  </div>

                  <div>
                    <span>Xác thực</span>
                    <b>
                      {profile.IsVerified ? "Đã xác thực" : "Chưa xác thực"}
                    </b>
                  </div>

                  <div>
                    <span>Cập nhật gần nhất</span>
                    <b>{datetime(profile.UpdatedAt)}</b>
                  </div>
                </div>
              </article>

              <article className="rxp-card">
                <div className="rxp-card-head">
                  <h3>Lịch hẹn gần đây</h3>
                  <Link to="/receptionist/appointments">Xem tất cả</Link>
                </div>

                <div className="rxp-list">
                  {recentAppointments.length === 0 ? (
                    <p className="rxp-empty">Chưa có lịch hẹn gần đây.</p>
                  ) : (
                    recentAppointments.map((item) => (
                      <Link
                        className="rxp-row"
                        to={`/receptionist/appointments/${item.AppointmentId}`}
                        key={item.AppointmentId}
                      >
                        <div className="rxp-row-main">
                          <b>
                            #{item.AppointmentId} -{" "}
                            {item.CustomerName || "Khách hàng"}
                          </b>
                          <span>
                            {date(item.AppointmentDate)} ·{" "}
                            {item.StartTime || "--:--"}
                          </span>
                        </div>

                        <span className={statusClass(item.Status)}>
                          {item.Status || "UNKNOWN"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </article>

              <article className="rxp-card">
                <div className="rxp-card-head">
                  <h3>Hóa đơn gần đây</h3>
                  <Link to="/receptionist/invoices">Xem tất cả</Link>
                </div>

                <div className="rxp-list">
                  {recentInvoices.length === 0 ? (
                    <p className="rxp-empty">Chưa có hóa đơn gần đây.</p>
                  ) : (
                    recentInvoices.map((item) => (
                      <Link
                        className="rxp-row"
                        to={`/receptionist/invoices/${item.InvoiceId}`}
                        key={item.InvoiceId}
                      >
                        <div className="rxp-row-main">
                          <b>
                            #{item.InvoiceId} -{" "}
                            {item.CustomerName || "Khách hàng"}
                          </b>
                          <span>{money(item.FinalAmount)}</span>
                        </div>

                        <span className={statusClass(item.Status)}>
                          {item.Status || "UNPAID"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </article>

              <article className="rxp-card rxp-action-card">
                <h3>Thao tác nhanh</h3>

                <div className="rxp-actions">
                  <Link to="/receptionist/appointments/create">
                    <span>📅</span>
                    <b>Tạo lịch hẹn</b>
                    <small>Đặt lịch cho khách</small>
                  </Link>

                  <Link to="/receptionist/customers">
                    <span>👥</span>
                    <b>Quản lý khách hàng</b>
                    <small>Xem hồ sơ khách</small>
                  </Link>

                  <Link to="/receptionist/invoices">
                    <span>🧾</span>
                    <b>Quản lý hóa đơn</b>
                    <small>Thanh toán / hoàn tiền</small>
                  </Link>

                  <Link to="/receptionist/waiting-list">
                    <span>⏳</span>
                    <b>Waiting List</b>
                    <small>Xử lý khách chờ</small>
                  </Link>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
