import { useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function ChangePassword() {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setIsError(true);
      setMessage('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setSaving(true);
      setIsError(false);
      const res = await axiosClient.put('/auth/change-password', {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      setMessage(res.data.message || 'Đổi mật khẩu thành công');
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return <CustomerLayout>
    <div className="section-head">
      <div>
        <div className="eyebrow">Security</div>
        <h2 className="section-title">Đổi mật khẩu</h2>
      </div>
    </div>

    <form className="profile-form dashboard-card" onSubmit={submit}>
      {message && <div className={isError ? 'alert error' : 'alert success'}>{message}</div>}

      <div className="form-group">
        <label>Mật khẩu hiện tại</label>
        <input type="password" value={form.oldPassword} onChange={e => setForm({ ...form, oldPassword: e.target.value })} />
      </div>

      <div className="form-group">
        <label>Mật khẩu mới</label>
        <input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
      </div>

      <div className="form-group">
        <label>Nhập lại mật khẩu mới</label>
        <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
      </div>

      <button className="btn primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
    </form>
  </CustomerLayout>;
}
