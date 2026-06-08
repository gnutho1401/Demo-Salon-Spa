import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

function formatDate(value) { return value ? new Date(value).toLocaleDateString('vi-VN') : '-'; }

export default function WaitingListPage() {
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ serviceId: '', preferredDate: '', preferredTime: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [serviceRes, waitRes] = await Promise.all([
      axiosClient.get('/services'),
      axiosClient.get('/waiting-list/my'),
    ]);
    setServices(serviceRes.data.data || serviceRes.data || []);
    setItems(waitRes.data.data || waitRes.data || []);
  };

  useEffect(() => { load().catch(() => setMessage('Không tải được hàng chờ')); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/waiting-list', form);
      setMessage('Đã thêm vào hàng chờ');
      setForm({ serviceId: '', preferredDate: '', preferredTime: '' });
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Thêm hàng chờ thất bại');
    }
  };

  const cancel = async (id) => {
    try {
      await axiosClient.delete(`/waiting-list/${id}`);
      setMessage('Đã hủy hàng chờ');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Hủy thất bại');
    }
  };

  return <CustomerLayout>
    <div className="section-head"><div><div className="eyebrow">Waiting List</div><h2 className="section-title">Hàng chờ lịch hẹn</h2></div></div>
    {message && <div className="alert success">{message}</div>}

    <form className="dashboard-card profile-form animated-panel" onSubmit={submit}>
      <h3>Vào hàng chờ khi chưa có lịch phù hợp</h3>
      <div className="form-row">
        <div className="form-group"><label>Dịch vụ</label><select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}><option value="">Chọn dịch vụ</option>{services.map((s) => <option key={s.ServiceId} value={s.ServiceId}>{s.ServiceName}</option>)}</select></div>
        <div className="form-group"><label>Ngày mong muốn</label><input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></div>
        <div className="form-group"><label>Giờ mong muốn</label><input type="time" value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} /></div>
      </div>
      <button className="btn">Thêm vào hàng chờ</button>
    </form>

    <div className="dashboard-card" style={{ marginTop: 20 }}>
      <h3>Danh sách hàng chờ của tôi</h3>
      {items.length ? <table className="table"><thead><tr><th>Dịch vụ</th><th>Ngày</th><th>Giờ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map((w) => <tr key={w.WaitingId}><td>{w.ServiceName}</td><td>{formatDate(w.PreferredDate)}</td><td>{w.PreferredTime || '-'}</td><td><span className="status">{w.Status}</span></td><td>{w.Status === 'WAITING' && <button className="card-btn" onClick={() => cancel(w.WaitingId)}>Hủy</button>}</td></tr>)}</tbody></table> : <p className="muted">Bạn chưa có yêu cầu hàng chờ.</p>}
    </div>
  </CustomerLayout>;
}
