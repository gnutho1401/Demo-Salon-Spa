import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

export default function PackageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [method, setMethod] = useState('VNPAY');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axiosClient.get(`/packages/${id}`)
      .then((res) => setItem(res.data.data || res.data))
      .catch(() => setMessage('Không tìm thấy combo / liệu trình'))
      .finally(() => setLoading(false));
  }, [id]);

  const buy = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setPaying(true);
    setMessage('');
    try {
      if (method === 'VNPAY') {
        const res = await axiosClient.post(`/packages/${id}/vnpay`);
        const data = res.data.data || res.data;
        window.location.href = data.paymentUrl;
        return;
      }
      await axiosClient.post(`/packages/${id}/buy`, { paymentMethod: method });
      navigate('/customer/packages?paid=1');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Không mua được combo / liệu trình');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <section className="section container"><p className="muted">Đang tải chi tiết...</p></section>;
  if (!item) return <section className="section container"><div className="alert error">{message}</div></section>;

  return (
    <section className="combo-detail-page">
      <div className="combo-detail-card">
        <div className="combo-detail-img">
          {Number(item.DiscountPercent || 0) > 0 && <span className="sale-badge">-{item.DiscountPercent}%</span>}
          <img src={resolveFileUrl(item.ImageUrl) || '/vite.svg'} alt={item.PackageName} />
        </div>
        <div className="combo-detail-info">
          <div className="combo-category">{item.CategoryName}</div>
          <h1>{item.PackageName}</h1>
          <p className="muted">{item.Description}</p>
          <div className="combo-price-row big">
            <b>{money(item.FinalPrice || item.Price)}</b>
            {Number(item.DiscountPercent || 0) > 0 && <del>{money(item.Price)}</del>}
          </div>
          <div className="combo-stat-grid">
            <div><b>{item.TotalSessions || item.Services?.length || 1}</b><span>Buổi sử dụng</span></div>
            <div><b>{item.ValidityDays || 30}</b><span>Ngày hiệu lực</span></div>
            <div><b>{item.Services?.length || 0}</b><span>Dịch vụ gồm có</span></div>
          </div>

          <div className="payment-box">
            <h3>Chọn phương thức thanh toán</h3>
            <label><input type="radio" checked={method === 'VNPAY'} onChange={() => setMethod('VNPAY')} /> Thanh toán online VNPay</label>
            <label><input type="radio" checked={method === 'CASH'} onChange={() => setMethod('CASH')} /> Thanh toán tại quầy</label>
            {message && <div className="alert error">{message}</div>}
            <button className="btn" disabled={paying} onClick={buy}>{paying ? 'Đang xử lý...' : method === 'VNPAY' ? 'Thanh toán VNPay' : 'Mua liệu trình'}</button>
          </div>
        </div>
      </div>

      <div className="combo-services-section">
        <h2>Dịch vụ trong liệu trình</h2>
        <div className="combo-service-list">
          {(item.Services || []).map((s) => (
            <div className="combo-service-item" key={s.ServiceId}>
              <img src={resolveFileUrl(s.ImageUrl) || '/vite.svg'} alt={s.ServiceName} />
              <div>
                <h3>{s.ServiceName}</h3>
                <p>{s.Description}</p>
                <span>{s.DurationMinutes || 60} phút • {money(s.Price)}</span>
              </div>
            </div>
          ))}
        </div>
        <Link className="card-btn" to="/packages">← Quay lại danh sách combo</Link>
      </div>
    </section>
  );
}
