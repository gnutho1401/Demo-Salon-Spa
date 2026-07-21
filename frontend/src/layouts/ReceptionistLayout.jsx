import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function ReceptionistLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
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

  async function syncProfile() {
    try {
      const res = await axiosClient.get("/receptionist/profile");
      const profileData = res.data?.data?.profile || res.data?.profile || res.data;
      if (profileData && typeof updateUser === "function") {
        updateUser({
          ...user,
          FullName: profileData.FullName || user?.FullName,
          AvatarUrl: profileData.AvatarUrl || user?.AvatarUrl,
        });
      }
    } catch (_) {}
  }

  useEffect(() => {
    loadNotifications();
    syncProfile();
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
          <div className="rx-menu-group">
            <p className="rx-menu-group-title">Nghiệp vụ Salon</p>
            <NavLink to="/receptionist/dashboard">📊 Tổng quan</NavLink>
            <NavLink to="/receptionist/appointments">📅 Lịch hẹn</NavLink>
            <NavLink to="/receptionist/packages">📦 Quản lý Combo</NavLink>

            {/* <NavLink to="/receptionist/dispatch">⚡ Điều phối KTV</NavLink> */}
            <NavLink to="/receptionist/appointments/create">
              ➕ Tạo lịch hẹn mới
            </NavLink>
            {/* <NavLink to="/receptionist/waiting-list">⏳ Hàng chờ</NavLink> */}
            <NavLink to="/receptionist/reschedule-requests">📅 Duyệt đổi lịch</NavLink>
          </div>

          <div className="rx-menu-group">
            <p className="rx-menu-group-title">Khách hàng & Hóa đơn</p>
            <NavLink to="/receptionist/customers">👥 Khách hàng</NavLink>
            <NavLink to="/receptionist/invoices">🧾 Hóa đơn</NavLink>
          </div>

          <div className="rx-menu-group">
            <p className="rx-menu-group-title">Tương tác khách hàng</p>
            <NavLink to="/receptionist/reviews">⭐ Đánh giá</NavLink>
            <NavLink to="/receptionist/notifications">
              🔔 Thông báo {unreadCount > 0 && <span style={{ backgroundColor: "#e53e3e", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", marginLeft: "6px" }}>{unreadCount}</span>}
            </NavLink>
          </div>

          <div className="rx-menu-group">
            <p className="rx-menu-group-title">Cài đặt & Cá nhân</p>
            <NavLink to="/receptionist/profile">👤 Hồ sơ cá nhân</NavLink>
            <NavLink to="/receptionist/settings">⚙️ Cấu hình hệ thống</NavLink>
          </div>
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
            onClick={() => navigate("/receptionist/notifications")}
          >
            🔔
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
