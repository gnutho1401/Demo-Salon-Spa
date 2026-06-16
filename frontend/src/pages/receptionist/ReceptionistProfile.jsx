import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
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
      setData(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được hồ sơ receptionist",
      );
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

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <header className="rx-page-header">
          <div>
            <h1>Receptionist Profile</h1>
            <p>Thông tin cá nhân, vai trò và hoạt động gần đây.</p>
          </div>

          <button
            className="rx-primary-btn"
            onClick={() => navigate("/receptionist/settings")}
          >
            Edit Profile
          </button>
        </header>

        {loading && <div className="rx-empty-card">Đang tải hồ sơ...</div>}
        {error && <div className="rx-empty-card">{error}</div>}

        {!loading && !error && (
          <>
            <section className="rx-profile-hero">
              <img
                className="rx-profile-avatar"
                src={avatar(profile.AvatarUrl || profile.ImageUrl)}
                alt={profile.FullName || "Receptionist"}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />

              <div>
                <h2>{profile.FullName || "N/A"}</h2>
                <p>{profile.Position || "Receptionist"}</p>
                <p>{profile.Email || "N/A"}</p>
                <p>{profile.Phone || "N/A"}</p>
              </div>
            </section>

            <section className="rx-profile-stats-grid">
              <article>
                <b>{stats.TodayAppointments || 0}</b>
                <span>Today Appointments</span>
              </article>

              <article>
                <b>{stats.CheckedInToday || 0}</b>
                <span>Checked-in Today</span>
              </article>

              <article>
                <b>{stats.CustomersCreated || 0}</b>
                <span>Customers Created</span>
              </article>

              <article>
                <b>{stats.PaidInvoicesToday || 0}</b>
                <span>Paid Invoices Today</span>
              </article>
            </section>

            <section className="rx-profile-grid">
              <div className="rx-card">
                <h3>Professional Summary</h3>
                <p>{profile.Bio || "Chưa có mô tả."}</p>
              </div>

              <div className="rx-card">
                <h3>Recent Appointments</h3>

                {recentAppointments.length === 0 && <p>Chưa có lịch hẹn.</p>}

                {recentAppointments.map((item) => (
                  <Link
                    className="rx-mini-row"
                    to={`/receptionist/appointments/${item.AppointmentId}`}
                    key={item.AppointmentId}
                  >
                    <b>#{item.AppointmentId}</b>
                    <span>{item.CustomerName || "N/A"}</span>
                    <small>{item.Status}</small>
                  </Link>
                ))}
              </div>

              <div className="rx-card">
                <h3>Recent Invoices</h3>

                {recentInvoices.length === 0 && <p>Chưa có hóa đơn.</p>}

                {recentInvoices.map((item) => (
                  <Link
                    className="rx-mini-row"
                    to={`/receptionist/invoices/${item.InvoiceId}`}
                    key={item.InvoiceId}
                  >
                    <b>#{item.InvoiceId}</b>
                    <span>{item.CustomerName || "N/A"}</span>
                    <small>{item.Status}</small>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
