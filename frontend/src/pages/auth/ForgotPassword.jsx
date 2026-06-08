import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setIsError(false);
      const res = await axiosClient.post('/auth/forgot-password', { email });
      setMessage(res.data.message || 'Vui lòng kiểm tra email để đặt lại mật khẩu');
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Không thể gửi yêu cầu quên mật khẩu');
    }
  };

  return <div className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="eyebrow">Password recovery</div>
      <h2>Quên mật khẩu</h2>
      {message && <p className={isError ? 'auth-error' : 'auth-success'}>{message}</p>}

      <label>Email</label>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email tài khoản" />

      <button className="btn" style={{width:'100%',marginTop:10}}>Gửi link đặt lại</button>
      <p className="muted"><Link className="see-all" to="/login">Quay lại đăng nhập</Link></p>
    </form>
  </div>;
}
