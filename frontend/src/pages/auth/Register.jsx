import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function Register() {
  const navigate = useNavigate();
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
      setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(form.email)}`), 900);
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Không thể đăng ký. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="eyebrow">Create account</div>
      <h2>Đăng ký</h2>
      {message && <p className={isError ? 'auth-error' : 'auth-success'}>{message}</p>}

      <input name="fullName" placeholder="Họ tên" value={form.fullName} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
      <input name="phone" placeholder="Số điện thoại" value={form.phone} onChange={handleChange} />
      <input name="password" placeholder="Mật khẩu" type="password" value={form.password} onChange={handleChange} />

      <select name="gender" value={form.gender} onChange={handleChange}>
        <option value="">Chọn giới tính</option>
        <option value="Male">Nam</option>
        <option value="Female">Nữ</option>
        <option value="Other">Khác</option>
      </select>

      <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
      <input name="address" placeholder="Địa chỉ" value={form.address} onChange={handleChange} />

      <button className="btn" style={{width:'100%',marginTop:10}} disabled={loading}>
        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
      </button>
      <p className="muted">Đã có tài khoản? <Link className="see-all" to="/login">Đăng nhập</Link></p>
    </form>
  </div>;
}
