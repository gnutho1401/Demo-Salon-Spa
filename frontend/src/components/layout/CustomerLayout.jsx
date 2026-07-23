import { useEffect, useState, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { useAuth } from "../../context/AuthContext";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const menuGroups = [
  {
    title: "Tổng quan",
    items: [
      { to: "/customer", icon: "🏠", label: "Tổng quan", end: true },
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
      { to: "/customer/notifications", icon: "🔔", label: "Thông báo" },
      { to: "/customer/ai", icon: "✨", label: "AI tư vấn" },
      { to: "/customer/stylist-advisor", icon: "💇", label: "AI Stylist" },
      { to: "/customer/skin-analyzer", icon: "🧬", label: "AI Phân tích da" },
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    if (!mediaQuery.matches) setMenuOpen(false);
    const handleViewportChange = (event) => {
      if (!event.matches) setMenuOpen(false);
    };
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

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

  const getPageClass = () => {
    const path = location.pathname;
    if (path === '/customer') return 'anim-overview';
    if (path.startsWith('/customer/booking')) return 'anim-booking';
    if (path.startsWith('/customer/appointments')) return 'anim-appointments';
    if (path.startsWith('/customer/service-history')) return 'anim-history';
    if (path.startsWith('/customer/payments')) return 'anim-payments';
    if (path.startsWith('/customer/packages')) return 'anim-packages';
    if (path.startsWith('/customer/membership')) return 'anim-membership';
    if (path.startsWith('/customer/vouchers')) return 'anim-vouchers';
    if (path.startsWith('/customer/waiting-list')) return 'anim-waiting';
    if (path.startsWith('/customer/notifications')) return 'anim-notifications';
    if (path.startsWith('/customer/ai') || path.startsWith('/customer/stylist-advisor') || path.startsWith('/customer/skin-analyzer')) return 'anim-ai';
    if (path.startsWith('/customer/feedback')) return 'anim-feedback';
    if (path.startsWith('/customer/reviews')) return 'anim-reviews';
    if (path.startsWith('/customer/profile')) return 'anim-profile';
    return 'anim-default';
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <GuestLayout>
      <div className="customer-pink-shell">
        <button
          type="button"
          className={`customer-pink-sidebar-overlay${menuOpen ? " is-visible" : ""}`}
          aria-label="Đóng menu và quay lại nội dung"
          onClick={() => setMenuOpen(false)}
        />
        <aside 
          ref={sidebarRef}
          onScroll={handleSidebarScroll}
          className={`customer-pink-sidebar${menuOpen ? " is-open" : ""}`}
          id="customer-account-navigation"
        >
          <button
            type="button"
            className="customer-pink-sidebar-close"
            aria-label="Đóng menu tài khoản"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
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

        <section className="customer-pink-content" inert={menuOpen ? true : undefined}>
          <header className="customer-pink-topbar">
            <div className="customer-pink-topbar-intro">
              <button
                type="button"
                className="customer-pink-mobile-menu"
                aria-label="Mở menu tài khoản"
                aria-controls="customer-account-navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
              <div>
                <span>Xin chào, {displayName}</span>
                <h1>Không gian chăm sóc sắc đẹp của bạn</h1>
              </div>
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

          <main className={`customer-pink-main ${getPageClass()}`} key={location.pathname}>{children}</main>
        </section>
      </div>
    </GuestLayout>
  );
}
