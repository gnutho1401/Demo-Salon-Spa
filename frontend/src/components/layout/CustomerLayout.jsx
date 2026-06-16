import { Link, useNavigate } from "react-router-dom";
import GuestLayout from "./GuestLayout";
import { useAuth } from "../../context/AuthContext";

export default function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <GuestLayout>
      <div className="customer-shell">
        <aside className="customer-sidebar">
          <h3>Tài khoản khách hàng</h3>
          <Link to="/customer">Tổng quan</Link>
          <Link to="/customer/booking">Đặt lịch hẹn</Link>
          <Link to="/customer/appointments">Lịch hẹn của tôi</Link>
          <Link to="/customer/service-history">Lịch sử dịch vụ</Link>
          <Link to="/customer/payments">Lịch sử thanh toán</Link>
          <Link to="/customer/packages">Combo / liệu trình</Link>
          <Link to="/customer/membership">Điểm thưởng</Link>
          <Link to="/customer/vouchers">Voucher của tôi</Link>
          <Link to="/customer/waiting-list">Hàng chờ</Link>
          <Link to="/customer/notifications">Thông báo</Link>
          <Link to="/customer/ai">AI tư vấn</Link>
          <Link to="/customer/feedback">Phản hồi</Link>
          <Link to="/customer/reviews">Đánh giá dịch vụ</Link>
          <Link to="/customer/profile">Hồ sơ cá nhân</Link>
          <Link to="/customer/change-password">Đổi mật khẩu</Link>

          <button
            className="btn"
            type="button"
            onClick={handleLogout}
            style={{ marginTop: 16 }}
          >
            Đăng xuất
          </button>
        </aside>

        <main className="customer-main">{children}</main>
      </div>
    </GuestLayout>
  );
}
