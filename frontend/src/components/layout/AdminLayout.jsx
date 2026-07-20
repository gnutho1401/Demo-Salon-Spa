import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/pages/admin.css";

const navGroups = [
  {
    label: "Tổng quan",
    items: [{ to: "/admin", label: "Bảng điều khiển", icon: "overview", end: true }],
  },
  {
    label: "Vận hành",
    items: [
      { to: "/admin/work-shifts", label: "Ca làm việc", icon: "calendar" },
      { to: "/admin/services", label: "Dịch vụ", icon: "service" },
      { to: "/admin/service-categories", label: "Danh mục dịch vụ", icon: "category" },
      { to: "/admin/packages", label: "Gói dịch vụ", icon: "package" },
    ],
  },
  {
    label: "Khách hàng & tăng trưởng",
    items: [
      { to: "/admin/customers", label: "Khách hàng", icon: "customers" },
      { to: "/admin/memberships", label: "Hạng thành viên", icon: "membership" },
      { to: "/admin/vouchers", label: "Voucher", icon: "voucher" },
      { to: "/admin/promotions", label: "Khuyến mãi", icon: "promotion" },
      { to: "/admin/reviews", label: "Đánh giá", icon: "review" },
      { to: "/admin/feedbacks", label: "Phản hồi", icon: "feedback" },
      { to: "/admin/ai-crm", label: "AI CRM & Churn", icon: "spark" },
    ],
  },
  {
    label: "Nhân sự & quyền truy cập",
    items: [{ to: "/admin/employees", label: "Nhân viên", icon: "employees" }],
  },
  {
    label: "Tài chính & kiểm soát",
    items: [
      { to: "/admin/refunds", label: "Hoàn tiền", icon: "refund" },
      { to: "/admin/reports", label: "Báo cáo", icon: "report" },
      { to: "/admin/package-reports", label: "Báo cáo gói", icon: "chart" },
      { to: "/admin/system-logs", label: "Nhật ký hệ thống", icon: "log" },
      { to: "/admin/ai-monitoring", label: "Giám sát AI", icon: "monitor" },
    ],
  },
];

const iconPaths = {
  overview: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
  service: "M12 3c3 3 5 5.3 5 8a5 5 0 0 1-10 0c0-2.7 2-5 5-8Zm-7 16c2-2 4.3-3 7-3s5 1 7 3",
  category: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  package: "m4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8m-8 4v8",
  customers: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9m-2-12a4 4 0 0 1 0 7.8",
  membership: "m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 3Z",
  voucher: "M4 7a2 2 0 0 0 0 4v6h16v-6a2 2 0 0 0 0-4V5H4v2Zm8-2v12",
  promotion: "m5 19 14-14M7.5 7.5h.01m8.99 9h.01M9 7.5A1.5 1.5 0 1 1 6 7.5a1.5 1.5 0 0 1 3 0Zm9 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  review: "M12 3 15 9l6 .9-4.5 4.4 1.1 6.2L12 17.6l-5.6 2.9 1.1-6.2L3 9.9 9 9l3-6Z",
  feedback: "M4 4h16v12H8l-4 4V4Zm4 5h8m-8 3h5",
  spark: "m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z",
  employees: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-4h6m-3-3v6M2 21v-3a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v3",
  refund: "M4 10a8 8 0 1 1 2 7m-2 0v-5h5m3-5v10m-3-3 3 3 3-3",
  report: "M5 3h10l4 4v14H5V3Zm10 0v5h4M9 13h6m-6 4h6",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  log: "M5 4h14v16H5V4Zm4 5h6m-6 4h6m-6 4h4",
  monitor: "M3 4h18v12H3V4Zm6 16h6m-3-4v4M7 11l3-3 3 3 4-4",
};

function NavIcon({ name }) {
  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const allNavItems = navGroups.flatMap((group) => group.items);
  const currentPage =
    allNavItems
      .filter((item) =>
        item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
      )
      .sort((a, b) => b.to.length - a.to.length)[0]?.label || "Quản trị hệ thống";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="admin-shell">
      <button
        className={`admin-sidebar-overlay${menuOpen ? " is-visible" : ""}`}
        type="button"
        aria-label="Đóng menu quản trị"
        onClick={() => setMenuOpen(false)}
      />

      <aside
        id="admin-navigation"
        className={`admin-sidebar${menuOpen ? " is-open" : ""}`}
        aria-label="Điều hướng quản trị"
      >
        <div className="admin-brand-row">
          <div className="admin-brand">
            <div className="admin-brand-mark">BS</div>
            <div>
              <p className="admin-kicker">Salon operations</p>
              <h2>Beauty Salon</h2>
            </div>
          </div>
          <button
            className="admin-sidebar-close"
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="admin-sidebar-user-card">
          <span>Đang đăng nhập</span>
          <strong>{user?.FullName || user?.fullName || "Administrator"}</strong>
          <small>{user?.RoleName || "ADMIN"}</small>
        </div>

        <nav className="admin-nav">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <p className="admin-nav-group-label">{group.label}</p>
              <div className="admin-nav-group-links">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `admin-nav-link${isActive ? " active" : ""}`
                    }
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <button className="admin-logout" type="button" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 5H5v14h5m4-4 4-3-4-3m4 3H9" />
          </svg>
          Đăng xuất
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-mobile-header">
          <button
            className="admin-menu-trigger"
            type="button"
            aria-label="Mở menu quản trị"
            aria-controls="admin-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <div>
            <span>Quản trị</span>
            <strong>{currentPage}</strong>
          </div>
          <div className="admin-mobile-avatar" aria-hidden="true">
            {(user?.FullName || user?.fullName || "A").trim().charAt(0).toUpperCase()}
          </div>
        </header>
        <div className="admin-main-inner">{children}</div>
      </main>
    </div>
  );
}
