import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function ReceptionistLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    try {
      const res = await axiosClient.get("/receptionist/notifications");
      const data = res.data.data || res.data;
      setNotifications(data.Items || []);
      setUnreadCount(data.UnreadCount || 0);
    } catch (_) {}
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  async function readNotification(n) {
    try {
      if (!n.IsRead) {
        await axiosClient.put(
          `/receptionist/notifications/${n.NotificationId}/read`,
        );
        await loadNotifications();
      }
    } catch (_) {}
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="rx-shell">
      <aside className="rx-sidebar">
        <div className="rx-brand">
          <div className="rx-logo">✦</div>
          <div>
            <h2>LUNA SALON</h2>
            <span>RECEPTIONIST</span>
          </div>
        </div>

        <nav className="rx-menu">
          <NavLink to="/receptionist/dashboard">📊 Dashboard</NavLink>
          <NavLink to="/receptionist/appointments">📅 Appointments</NavLink>
          <NavLink to="/receptionist/appointments/create">
            ➕ New Appointment
          </NavLink>
          <NavLink to="/receptionist/customers">👥 Customers</NavLink>
          <NavLink to="/receptionist/waiting-list">⏳ Waiting List</NavLink>
          <NavLink to="/receptionist/invoices">🧾 Invoices</NavLink>
          <NavLink to="/receptionist/reviews">⭐ Reviews</NavLink>
          <NavLink to="/receptionist/profile">👤 Profile</NavLink>
          <NavLink to="/receptionist/settings">⚙ Settings</NavLink>
        </nav>

        <button
          className="rx-profile rx-profile-link"
          type="button"
          onClick={() => navigate("/receptionist/profile")}
        >
          <img
            className="rx-avatar"
            src={avatarUrl(user?.AvatarUrl)}
            alt={user?.FullName || "Receptionist"}
          />
          <div>
            <b>{user?.FullName || "Linh Receptionist"}</b>
            <span>Receptionist</span>
          </div>
        </button>

        <button className="rx-logout" onClick={handleLogout}>
          Đăng xuất
        </button>
      </aside>

      <main className="rx-main">
        <div className="rx-topbar">
          <button
            className="rx-noti-btn"
            onClick={() => setNotiOpen(!notiOpen)}
          >
            🔔
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>

          {notiOpen && (
            <div className="rx-noti-panel">
              <h3>Thông báo</h3>

              {notifications.length === 0 && (
                <p className="rx-noti-empty">Chưa có thông báo</p>
              )}

              {notifications.map((n) => (
                <button
                  key={n.NotificationId}
                  className={`rx-noti-item ${n.IsRead ? "" : "unread"}`}
                  onClick={() => readNotification(n)}
                >
                  <b>{n.Title}</b>
                  <p>{n.Content}</p>
                  <small>{String(n.CreatedAt || "").slice(0, 19)}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}
