import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialEmail = useMemo(() => params.get('email') || '', [params]);
  const [form, setForm] = useState({ email: initialEmail, code: '' });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const verify = async (e) => {
    e.preventDefault();
    try {
      setIsError(false);
      const res = await axiosClient.post('/auth/verify-email', form);
      setMessage(res.data.message || 'Xác thực thành công');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Xác thực thất bại');
    }
  };

  const resend = async () => {
    try {
      setIsError(false);
      const res = await axiosClient.post('/auth/resend-verify-code', { email: form.email });
      setMessage(res.data.message || 'Đã gửi lại mã xác thực');
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Không thể gửi lại mã');
    }
  };

  return <div className="auth-page">
    <form className="auth-card" onSubmit={verify}>
      <div className="eyebrow">Email verification</div>
      <h2>Xác thực email</h2>
      {message && <p className={isError ? 'auth-error' : 'auth-success'}>{message}</p>}

      <label>Email</label>
      <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Nhập email" />

      <label>Mã xác thực</label>
      <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Nhập mã 6 số" />

      <button className="btn" style={{width:'100%',marginTop:10}}>Xác thực</button>
      <button type="button" className="btn outline" style={{width:'100%',marginTop:10}} onClick={resend}>Gửi lại mã</button>
      <p className="muted"><Link className="see-all" to="/login">Quay lại đăng nhập</Link></p>
    </form>
  </div>;
}
