import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function GuestLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return <>
    <div className="topbar">
      <div>🎁 Ưu đãi tháng 5: Giảm 20% tất cả dịch vụ</div>
      <div>☎ Hotline: 0123 456 789 &nbsp;&nbsp;&nbsp; 📍 Tìm chi nhánh</div>
    </div>
    <header className="navbar">
      <Link to="/" className="logo"><span className="logo-icon">🌸</span><div>Beauty<span>Salon & Spa</span></div></Link>
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
            <Link className="btn btn-outline" to="/customer">Tài khoản</Link>
            <button className="btn" type="button" onClick={handleLogout}>Đăng xuất</button>
          </>
        ) : (
          <>
            <Link className="btn btn-outline" to="/login">Đăng nhập</Link>
            <Link className="btn" to="/register">Đăng ký</Link>
          </>
        )}
      </nav>
    </header>
    {children}
  </>;
}
