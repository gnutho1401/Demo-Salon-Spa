import { useEffect, useState, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { useAuth } from "../../context/AuthContext";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const menuGroups = [
  {
    title: "Tổng quan",
    items: [
      { to: "/customer", icon: "🏠", label: "Dashboard", end: true },
      { to: "/customer/booking", icon: "📅", label: "Đặt lịch hẹn" },
      { to: "/customer/appointments", icon: "🧾", label: "Lịch hẹn của tôi" },
      { to: "/customer/service-history", icon: "💆", label: "Lịch sử dịch vụ" },
    ],
  },
  {
    title: "Thanh toán & ưu đãi",
    items: [
      { to: "/customer/payments", icon: "💳", label: "Thanh toán" },
      { to: "/customer/packages", icon: "🎁", label: "Combo / liệu trình" },
      { to: "/customer/membership", icon: "💎", label: "Điểm thưởng" },
      { to: "/customer/vouchers", icon: "🏷️", label: "Voucher" },
    ],
  },
  {
    title: "Chăm sóc khách hàng",
    items: [
      { to: "/customer/waiting-list", icon: "⏳", label: "Hàng chờ" },
      { to: "/customer/notifications", icon: "🔔", label: "Thông báo" },
      { to: "/customer/ai", icon: "✨", label: "AI tư vấn" },
      { to: "/customer/stylist-advisor", icon: "💇", label: "AI Stylist" },
      { to: "/customer/feedback", icon: "💌", label: "Phản hồi" },
      { to: "/customer/reviews", icon: "⭐", label: "Đánh giá" },
    ],
  },
  {
    title: "Tài khoản",
    items: [
      { to: "/customer/profile", icon: "👤", label: "Hồ sơ cá nhân" },
      { to: "/customer/profile?tab=password", icon: "🔒", label: "Đổi mật khẩu" },
    ],
  },
];

export default function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const sidebarRef = useRef(null);

  useEffect(() => {
    const savedScrollTop = sessionStorage.getItem("customer-sidebar-scroll");
    if (savedScrollTop && sidebarRef.current) {
      sidebarRef.current.scrollTop = Number(savedScrollTop);
    } else {
      const activeLink = sidebarRef.current?.querySelector(".customer-pink-nav-link.active");
      if (activeLink) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [location.pathname]);

  const handleSidebarScroll = (e) => {
    sessionStorage.setItem("customer-sidebar-scroll", e.currentTarget.scrollTop);
  };

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchNotifications = async () => {
      try {
        const res = await axiosClient.get("/notifications/my");
        const list = res.data?.data || res.data || [];
        const count = list.filter((n) => !n.IsRead).length;
        if (active) {
          setUnreadCount(count);
        }
      } catch (err) {
        console.error("Error loading notifications:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // 15 seconds interval
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, location.pathname]);

  const displayName =
    user?.FullName ||
    user?.fullName ||
    user?.Name ||
    user?.name ||
    "Khách hàng";

  const email = user?.Email || user?.email || "customer@beautyms.com";
  const avatar = user?.AvatarUrl || user?.avatarUrl || user?.Avatar || "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "K";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <GuestLayout>
      <div className="customer-pink-shell">
        <aside 
          ref={sidebarRef}
          onScroll={handleSidebarScroll}
          className="customer-pink-sidebar"
        >
          <Link to="/customer" className="customer-pink-brand">
            <div className="customer-pink-brand-icon">🌸</div>
            <div>
              <strong>BeautyMS</strong>
              <span>Customer Portal</span>
            </div>
          </Link>

          <div className="customer-pink-user">
            <div className="customer-pink-avatar">
              {avatar ? <img src={resolveFileUrl(avatar)} alt={displayName} /> : initial}
            </div>

            <div>
              <h3>{displayName}</h3>
              <p>{email}</p>
            </div>
          </div>

          <nav className="customer-pink-nav">
            {menuGroups.map((group) => {
              return (
                <div className="customer-pink-nav-group" key={group.title}>
                  <p>{group.title}</p>
  
                  {group.items.map((item) => {
                    const isProfileLink = item.to.startsWith("/customer/profile");
                    
                    const isLinkActive = isProfileLink
                      ? (item.to.includes("tab=password")
                          ? location.search.includes("tab=password")
                          : !location.search.includes("tab=password") && location.pathname === "/customer/profile")
                      : location.pathname === item.to;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={
                          isLinkActive
                            ? "customer-pink-nav-link active"
                            : "customer-pink-nav-link"
                        }
                      >
                        <span>{item.icon}</span>
                        <b>{item.label}</b>
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="customer-pink-sidebar-bottom">
            <Link to="/customer/booking" className="customer-pink-booking-box">
              <span>Đặt lịch nhanh</span>
              <strong>Chọn dịch vụ yêu thích</strong>
            </Link>

            <button type="button" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </aside>

        <section className="customer-pink-content">
          <header className="customer-pink-topbar">
            <div>
              <span>Xin chào, {displayName}</span>
              <h1>Không gian chăm sóc sắc đẹp của bạn</h1>
            </div>

            <div className="customer-pink-top-actions">
              <Link to="/customer/notifications" className="customer-pink-bell-link">
                🔔
                {unreadCount > 0 && (
                  <span className="customer-pink-bell-badge">{unreadCount}</span>
                )}
              </Link>
              <Link to="/customer/profile" className="customer-pink-profile">
                {initial}
              </Link>
            </div>
          </header>

          <main className="customer-pink-main">{children}</main>
        </section>
      </div>
    </GuestLayout>
  );
}
