import { useEffect, useMemo, useState, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import "../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const menuGroups = [
  {
    title: "",
    items: [{ to: "/technician", icon: "🏠", label: "Trang chủ", end: true }],
  },
  {
    title: "LỊCH LÀM VIỆC",
    items: [
      { to: "/technician/schedule", icon: "📅", label: "Lịch làm việc" },
      { to: "/technician/appointments", icon: "🧾", label: "Lịch hẹn của tôi" },
    ],
  },
  {
    title: "KHÁCH HÀNG",
    items: [
      { to: "/technician/customers", icon: "👥", label: "Khách hàng" },
      { to: "/technician/reviews", icon: "⭐", label: "Đánh giá" },
    ],
  },
  {
    title: "THU NHẬP",
    items: [{ to: "/technician/earnings", icon: "💰", label: "Doanh thu" }],
  },
  {
    title: "PHÁC ĐỒ & GHI CHÚ",
    items: [
      {
        to: "/technician/treatment-notes",
        icon: "📝",
        label: "Ghi chú trị liệu",
      },
    ],
  },
  {
    title: "THIẾT LẬP",
    items: [
      { to: "/technician/profile", icon: "👤", label: "Hồ sơ cá nhân" },
      { to: "/technician/settings", icon: "⚙️", label: "Cài đặt" },
      { to: "/technician/notifications", icon: "🔔", label: "Thông báo" },
    ],
  },
];

export default function TechnicianLayout({ children }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const sidebarRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadUnreadCount() {
    try {
      const res = await axiosClient.get("/notifications/my");
      const list = res.data?.data || [];
      const count = list.filter((n) => !n.IsRead).length;
      setUnreadCount(count);
    } catch (_) {}
  }

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    // Restore sidebar scroll position
    const savedScrollTop = sessionStorage.getItem("tech-sidebar-scroll");
    if (savedScrollTop && sidebarRef.current) {
      sidebarRef.current.scrollTop = Number(savedScrollTop);
    } else {
      const activeLink = sidebarRef.current?.querySelector(
        ".tech-nav-link.active",
      );
      if (activeLink) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [location.pathname]);

  const handleSidebarScroll = (e) => {
    sessionStorage.setItem("tech-sidebar-scroll", e.currentTarget.scrollTop);
  };

  useEffect(() => {
    let ignore = false;

    async function loadProfileAvatar() {
      try {
        const res = await axiosClient.get("/technician/profile");
        const profileData = res.data?.data?.profile || null;

        if (!ignore && profileData) {
          setProfile(profileData);

          if (typeof updateUser === "function") {
            updateUser({
              ...user,
              FullName: profileData.FullName || user?.FullName,
              AvatarUrl: profileData.AvatarUrl || user?.AvatarUrl,
              ImageUrl: profileData.ImageUrl || user?.ImageUrl,
            });
          }
        }
      } catch (_) {
        // Fallback to user context in localStorage
      }
    }

    loadProfileAvatar();

    return () => {
      ignore = true;
    };
  }, []);

  const displayName =
    profile?.FullName || user?.FullName || user?.fullName || "Kỹ thuật viên";

  const displayRole =
    profile?.Position || profile?.Specialization || "Kỹ thuật viên";

  const avatarUrl = useMemo(() => {
    return (
      resolveFileUrl(profile?.ImageUrl) ||
      resolveFileUrl(profile?.AvatarUrl) ||
      resolveFileUrl(user?.ImageUrl) ||
      resolveFileUrl(user?.AvatarUrl) ||
      DEFAULT_AVATAR
    );
  }, [profile, user]);

  return (
    <div className="tech-shell">
      <aside
        ref={sidebarRef}
        onScroll={handleSidebarScroll}
        className="tech-sidebar"
      >
        <div className="tech-brand">
          <div className="tech-logo">✿</div>
          <h2>LUNA SALON</h2>
          <span>KỸ THUẬT VIÊN</span>
        </div>

        <nav className="tech-menu">
          {menuGroups.map((group) => (
            <div className="tech-menu-group" key={group.title}>
              <p className="tech-menu-group-title">{group.title}</p>
              <div style={{ display: "grid", gap: "6px" }}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? "tech-nav-link active" : "tech-nav-link"
                    }
                  >
                    <span className="tech-nav-icon">{item.icon}</span>
                    <b className="tech-nav-label">
                      {item.label}
                      {item.to === "/technician/notifications" &&
                        unreadCount > 0 && (
                          <span
                            style={{
                              backgroundColor: "#e53e3e",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              marginLeft: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            {unreadCount}
                          </span>
                        )}
                    </b>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="tech-user-card">
          <div className="tech-user-row">
            <img
              className="tech-user-avatar"
              src={avatarUrl}
              alt={displayName}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />

            <div className="tech-user-text">
              <b>{displayName}</b>
              <span>{displayRole}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="tech-logout-btn"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="tech-main">{children}</main>
    </div>
  );
}
