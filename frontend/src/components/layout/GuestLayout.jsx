import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AiChatFloatingWidget from "./AiChatFloatingWidget";

export default function GuestLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const headerClass = `header-wrapper ${!isHome || scrolled ? "is-scrolled" : "is-transparent"}`;

  return (
    <>
      <div className={headerClass}>
        <div className="topbar">
          <div className="topbar-promo">
            <span className="promo-tag">Ưu đãi</span>
            <span>Giảm ngay 20% cho tất cả dịch vụ đặt lịch hôm nay!</span>
          </div>
          <div className="topbar-info">
            <span>
              📞 Hotline: <strong>0123 456 789</strong>
            </span>
            <span>
              📍 Chi nhánh: <strong>Hải Châu, Đà Nẵng</strong>
            </span>
            <span>
              🕒 Mở cửa: <strong>08:00 - 20:00</strong>
            </span>
          </div>
        </div>

        <header className="navbar">
          <Link to="/" className="logo">
            <span className="logo-icon">🌸</span>
            <div>
              Beauty<span>Salon & Spa</span>
            </div>
          </Link>

          <nav className="nav-links">
            <NavLink to="/">Trang chủ</NavLink>
            <NavLink to="/services">Dịch vụ</NavLink>
            <NavLink to="/packages">Combo / Liệu trình</NavLink>
            <NavLink to="/promotions">Khuyến mãi</NavLink>
            <NavLink to="/technicians">Kỹ thuật viên</NavLink>
            <a href="/#about">Về chúng tôi</a>
            <NavLink to="/contact">Liên hệ</NavLink>

            {user ? (
              <>
                <Link className="btn btn-outline" to="/customer">
                  Tài khoản
                </Link>
                <button className="btn" type="button" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline" to="/login">
                  Đăng nhập
                </Link>
                <Link className="btn" to="/register">
                  Đăng ký
                </Link>
              </>
            )}
          </nav>
        </header>
      </div>

      {children}

      {![
        "/login",
        "/register",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
      ].includes(location.pathname) && <AiChatFloatingWidget />}
    </>
  );
}
