import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');

  const load = () => axiosClient.get('/notifications/my')
    .then((res) => setItems(res.data.data || res.data || []))
    .catch(() => setMessage('Không tải được thông báo'));

  useEffect(() => { load(); }, []);

  const read = async (id) => {
    await axiosClient.put(`/notifications/my/${id}/read`);
    load();
  };

  const readAll = async () => {
    await axiosClient.put('/notifications/my/read-all');
    load();
  };

  return <CustomerLayout>
    <div className="section-head">
      <div><div className="eyebrow">Notifications</div><h2 className="section-title">Thông báo của tôi</h2></div>
      <button className="btn" onClick={readAll}>Đánh dấu đã đọc tất cả</button>
    </div>
    {message && <p className="muted">{message}</p>}
    <div className="notification-list">
      {items.length ? items.map((n) => <div className={`dashboard-card notification-item ${n.IsRead ? '' : 'unread'}`} key={n.NotificationId}>
        <div>
          <h3>{n.Title}</h3>
          <p className="muted">{n.Content}</p>
          <span className="status">{n.Type || 'SYSTEM'}</span>
        </div>
        {!n.IsRead && <button className="card-btn" onClick={() => read(n.NotificationId)}>Đã đọc</button>}
      </div>) : <div className="dashboard-card"><p className="muted">Chưa có thông báo.</p></div>}
    </div>
  </CustomerLayout>;
}
