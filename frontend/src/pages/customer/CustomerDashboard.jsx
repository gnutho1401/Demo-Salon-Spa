import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

function formatDate(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('vi-VN');
}

export default function CustomerDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosClient.get('/customers/me/dashboard'),
      axiosClient.get('/ai/my/recommendations'),
    ])
      .then(([dashRes, aiRes]) => {
        setDashboard(dashRes.data.data || dashRes.data);
        setRecommendations(aiRes.data.data || aiRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return <CustomerLayout>
    <div className="section-head">
      <div>
        <div className="eyebrow">Customer</div>
        <h2 className="section-title">Tổng quan tài khoản</h2>
      </div>
      <Link className="btn" to="/customer/booking">Đặt lịch ngay</Link>
    </div>

    {loading ? <p>Đang tải dữ liệu...</p> : <>
      <div className="stats">
        <div className="dashboard-card"><h3>Lịch đang hoạt động</h3><strong>{dashboard?.ActiveAppointments || 0}</strong><p className="muted">Chờ xác nhận / đã xác nhận</p></div>
        <div className="dashboard-card"><h3>Điểm thưởng</h3><strong>{dashboard?.LoyaltyPoints || 0}</strong><p className="muted">Hạng {dashboard?.MembershipLevel || 'Normal'}</p></div>
        <div className="dashboard-card"><h3>Combo còn hiệu lực</h3><strong>{dashboard?.ActivePackages || 0}</strong><p className="muted">Đang sử dụng</p></div>
        <div className="dashboard-card"><h3>Thông báo mới</h3><strong>{dashboard?.UnreadNotifications || 0}</strong><p className="muted">Chưa đọc</p></div>
      </div>

      <div className="customer-two-columns">
        <div className="dashboard-card">
          <h3>Lịch hẹn sắp tới</h3>
          {dashboard?.UpcomingAppointments?.length ? dashboard.UpcomingAppointments.map((a) => (
            <div className="mini-item" key={a.AppointmentId}>
              <strong>{a.ServiceNames || 'Dịch vụ'}</strong>
              <span>{formatDate(a.AppointmentDate)} {a.StartTime} - {a.EmployeeName}</span>
            </div>
          )) : <p className="muted">Bạn chưa có lịch hẹn sắp tới.</p>}
          <Link className="card-btn" to="/customer/appointments">Xem lịch hẹn</Link>
        </div>

        <div className="dashboard-card">
          <h3>Gợi ý AI cho bạn</h3>
          {recommendations.slice(0, 3).map((item, index) => (
            <div className="mini-item" key={item.RecommendationId || item.ServiceId || index}>
              <strong>{item.ServiceName || 'Gợi ý dịch vụ'}</strong>
              <span>{item.Reason || item.Description}</span>
            </div>
          ))}
          <Link className="card-btn" to="/customer/ai">Mở AI tư vấn</Link>
        </div>
      </div>
    </>}
  </CustomerLayout>;
}
