import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    gender: '',
    dateOfBirth: '',
    address: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const redirectUrl = searchParams.get('redirectUrl') || localStorage.getItem('bookingRedirectUrl') || '/customer/booking';
  const serviceId = searchParams.get('serviceId') || localStorage.getItem('bookingServiceId');

  const handleSocialAuthenticated = (data) => {
    login(data);
    localStorage.removeItem('bookingRedirectUrl');
    localStorage.removeItem('bookingServiceId');

    const target = redirectUrl.startsWith('/') ? redirectUrl : '/customer/booking';
    const url = new URL(target, window.location.origin);
    if (serviceId && !url.searchParams.get('serviceId')) {
      url.searchParams.set('serviceId', serviceId);
    }
    navigate(`${url.pathname}${url.search}${url.hash}`);
  };

  const handleSocialError = (errorMessage) => {
    setIsError(Boolean(errorMessage));
    setMessage(errorMessage);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setIsError(false);
      const res = await axiosClient.post('/auth/register', {
        ...form,
        dateOfBirth: form.dateOfBirth || null
      });
      setMessage(res.data.message || 'Đăng ký thành công. Vui lòng xác thực email.');
      localStorage.removeItem('bookingRedirectUrl');
      localStorage.removeItem('bookingServiceId');
      setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`), 900);
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Không thể đăng ký. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background dynamic animated mesh orbs */}
      <div className="auth-bg-decor">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="eyebrow">Create account</div>
        <h2>Đăng ký</h2>
        {message && <p className={isError ? 'auth-error' : 'auth-success'}>{message}</p>}

        <SocialAuthButtons
          intent="register"
          onAuthenticated={handleSocialAuthenticated}
          onError={handleSocialError}
        />

        <div className="auth-divider">
          <span>hoặc đăng ký bằng email</span>
        </div>

        <label htmlFor="register-full-name">Họ tên</label>
        <input id="register-full-name" name="fullName" autoComplete="name" required placeholder="Nhập họ tên của bạn" value={form.fullName} onChange={handleChange} />
        
        <label htmlFor="register-email">Email</label>
        <input id="register-email" name="email" type="email" autoComplete="email" required placeholder="Nhập địa chỉ email" value={form.email} onChange={handleChange} />
        
        <label htmlFor="register-phone">Số điện thoại</label>
        <input id="register-phone" name="phone" type="tel" autoComplete="tel" inputMode="numeric" placeholder="Nhập số điện thoại" value={form.phone} onChange={handleChange} />
        
        <label htmlFor="register-password">Mật khẩu</label>
        <input id="register-password" name="password" autoComplete="new-password" required minLength="6" placeholder="Tạo mật khẩu" type="password" value={form.password} onChange={handleChange} />

        <div className="auth-row">
          <div className="auth-col">
            <label htmlFor="register-gender">Giới tính</label>
            <select id="register-gender" name="gender" value={form.gender} onChange={handleChange}>
              <option value="">Chọn giới tính</option>
              <option value="Male">Nam</option>
              <option value="Female">Nữ</option>
              <option value="Other">Khác</option>
            </select>
          </div>
          <div className="auth-col">
            <label htmlFor="register-birth-date">Ngày sinh</label>
            <input id="register-birth-date" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
          </div>
        </div>

        <label htmlFor="register-address">Địa chỉ</label>
        <input id="register-address" name="address" autoComplete="street-address" placeholder="Nhập địa chỉ" value={form.address} onChange={handleChange} />

        <button className="btn" style={{width:'100%', marginTop:10}} disabled={loading}>
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
        <p className="muted">Đã có tài khoản? <Link className="see-all" to="/login">Đăng nhập</Link></p>
      </form>
    </div>
  );
}
