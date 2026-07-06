import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/pages/admin.css";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/employees", label: "Employees" },
  { to: "/admin/work-shifts", label: "Work Shifts" },
  { to: "/admin/services", label: "Services" },
  { to: "/admin/promotions", label: "Promotions" },
  { to: "/admin/vouchers", label: "Vouchers" },
  { to: "/admin/memberships", label: "Membership" },
  { to: "/admin/packages", label: "Packages" },
  { to: "/admin/service-categories", label: "Service Categories" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/ai-crm", label: "AI CRM / Churn" },
  { to: "/admin/reviews", label: "Reviews" },
  { to: "/admin/feedbacks", label: "Feedbacks" },
  { to: "/admin/refunds", label: "Refunds" },
  { to: "/admin/system-logs", label: "System Logs" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/package-reports", label: "Package Reports" },
  { to: "/admin/ai-monitoring", label: "AI Monitoring" },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">BS</div>
          <div>
            <p className="admin-kicker">Luxury Spa Admin</p>
            <h2>Beauty Salon</h2>
          </div>
        </div>

        <div className="admin-sidebar-user-card">
          <span>Xin chào</span>
          <strong>{user?.FullName || user?.fullName || "Administrator"}</strong>
          <small>{user?.RoleName || "ADMIN"}</small>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="admin-logout" type="button" onClick={handleLogout}>
          Đăng xuất
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-main-inner">{children}</div>
      </main>
    </div>
  );
}
