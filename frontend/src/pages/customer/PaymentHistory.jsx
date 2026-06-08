import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axiosClient.get('/payments/my')
      .then((res) => setPayments(res.data.data || res.data || []))
      .catch((err) => setMessage(err.response?.data?.message || 'Không tải được lịch sử thanh toán'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CustomerLayout>
      <h2 className="section-title">Lịch sử thanh toán</h2>
      {message && <p className="muted">{message}</p>}

      {loading ? (
        <p>Đang tải lịch sử thanh toán...</p>
      ) : payments.length === 0 ? (
        <div className="dashboard-card">
          <h3>Chưa có thanh toán</h3>
          <p className="muted">Khi bạn thanh toán dịch vụ, thông tin sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Dịch vụ</th>
              <th>Số tiền</th>
              <th>Phương thức</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.PaymentId}>
                <td>INV{String(p.InvoiceId).padStart(3, '0')}</td>
                <td>{p.ServiceNames || '-'}</td>
                <td>{Number(p.Amount || 0).toLocaleString('vi-VN')}đ</td>
                <td>{p.PaymentMethod || '-'}</td>
                <td><span className="status">{p.Status || 'PENDING'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CustomerLayout>
  );
}
