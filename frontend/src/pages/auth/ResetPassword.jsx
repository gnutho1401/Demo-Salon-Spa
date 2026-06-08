import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      setIsError(false);
      const res = await axiosClient.post('/auth/reset-password', { token, newPassword });
      setMessage(res.data.message || 'Đặt lại mật khẩu thành công');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Không thể đặt lại mật khẩu');
    }
  };

  return <div className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="eyebrow">New password</div>
      <h2>Đặt lại mật khẩu</h2>
      {message && <p className={isError ? 'auth-error' : 'auth-success'}>{message}</p>}

      <label>Mật khẩu mới</label>
      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nhập mật khẩu mới" />

      <label>Nhập lại mật khẩu mới</label>
      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới" />

      <button className="btn" style={{width:'100%',marginTop:10}}>Đặt lại mật khẩu</button>
      <p className="muted"><Link className="see-all" to="/login">Quay lại đăng nhập</Link></p>
    </form>
  </div>;
}
