import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import "../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

export default function TechnicianLayout({ children }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
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
        // Nếu không tải được profile thì vẫn dùng user trong localStorage.
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
      <aside className="tech-sidebar">
        <div className="tech-brand">
          <div className="tech-logo">✿</div>
          <h2>LUNA SALON</h2>
          <span>KỸ THUẬT VIÊN</span>
        </div>

        <nav className="tech-menu">
          <NavLink to="/technician" end>
            Trang chủ
          </NavLink>
          <NavLink to="/technician/schedule">Lịch làm việc</NavLink>
          <NavLink to="/technician/appointments">Lịch hẹn</NavLink>
          <NavLink to="/technician/customers">Khách hàng</NavLink>
          <NavLink to="/technician/treatment-notes">Lịch sử điều trị</NavLink>
          <NavLink to="/technician/earnings">Báo cáo thu nhập</NavLink>
          <NavLink to="/technician/profile">Hồ sơ cá nhân</NavLink>
          <NavLink to="/technician/settings">Cài đặt</NavLink>
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
