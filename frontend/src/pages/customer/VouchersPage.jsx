import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

function money(v) { return Number(v || 0).toLocaleString('vi-VN'); }
function date(v) { return v ? new Date(v).toLocaleDateString('vi-VN') : 'Không giới hạn'; }
function discountText(v) { return v.DiscountType === 'PERCENT' ? `${v.DiscountValue}%` : `${money(v.DiscountValue)}đ`; }

export default function VouchersPage() {
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [allRes, myRes] = await Promise.all([
      axiosClient.get('/vouchers'),
      axiosClient.get('/vouchers/my'),
    ]);
    setAll(allRes.data.data || allRes.data || []);
    setMine(myRes.data.data || myRes.data || []);
  };

  useEffect(() => { load().catch(() => setMessage('Không tải được voucher')).finally(() => setLoading(false)); }, []);

  const save = async (id) => {
    try {
      await axiosClient.post(`/vouchers/${id}/save`);
      setMessage('Lưu voucher thành công');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Lưu voucher thất bại');
    }
  };

  return <CustomerLayout>
    <div className="section-head">
      <div><div className="eyebrow">Voucher</div><h2 className="section-title">Voucher của tôi</h2></div>
    </div>
    {message && <div className="alert success">{message}</div>}
    {loading ? <p>Đang tải voucher...</p> : <>
      <h3>Voucher đã lưu</h3>
      <div className="voucher-grid">
        {mine.length ? mine.map((v) => {
          const personalRemaining = 1 - (v.UseCount || 0);
          const unpaidUsages = v.Usages ? v.Usages.filter(u => u.PaymentStatus !== 'PAID') : [];
          const isFullyUsed = v.UsedStatus || v.UseCount >= 1;
          
          return (
            <div className={`voucher-card ${isFullyUsed ? 'used' : ''}`} key={v.VoucherId} style={{ display: 'flex', flexDirection: 'column', height: 'auto', gap: 10 }}>
              <div>
                <span className="voucher-code">{v.Code}</span>
                <h3>Giảm {discountText(v)}</h3>
                <p>Số lượng tổng còn lại: {v.Quantity}</p>
                <p>Hạn dùng: {date(v.EndDate)}</p>
                <p style={{ fontWeight: 'bold', color: isFullyUsed ? '#ef4444' : '#10b981', marginTop: 4 }}>
                  Số lượt dùng cá nhân còn lại: {isFullyUsed ? 'Hết lượt (1/1)' : `${personalRemaining}/1 lần`}
                </p>
              </div>

              {/* Chi tiết lịch sử hoặc trạng thái sử dụng của voucher */}
              {v.Usages && v.Usages.length > 0 && (
                <div style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 6, width: '100%' }}>
                  <b style={{ color: '#475569', display: 'block', marginBottom: 4 }}>Lịch sử sử dụng:</b>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {v.Usages.map(usage => (
                      <li key={usage.AppointmentId} style={{ color: '#64748b' }}>
                        <span>Lịch hẹn #{usage.AppointmentId} ({usage.ServiceNames || 'Dịch vụ'}): </span>
                        <b style={{ color: usage.PaymentStatus === 'PAID' ? '#10b981' : '#f59e0b' }}>
                          {usage.PaymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nút chuyển hướng thanh toán cho từng lịch hẹn chưa thanh toán đang giữ voucher */}
              {unpaidUsages.map(usage => (
                <div key={usage.AppointmentId} style={{ marginTop: 6, width: '100%', borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: 6 }}>
                  <div style={{ color: '#f59e0b', fontSize: '0.82rem', marginBottom: 6, fontWeight: 600 }}>
                    ⚠️ Đang giữ chỗ cho lịch hẹn #{usage.AppointmentId} ({usage.ServiceNames || 'Dịch vụ'}) chưa thanh toán!
                  </div>
                  <button 
                    className="card-btn" 
                    style={{ background: '#f59e0b', color: '#fff', width: '100%', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => navigate(`/customer/payment/${usage.AppointmentId}`)}
                  >
                    💳 Đi đến thanh toán lịch hẹn #{usage.AppointmentId}
                  </button>
                </div>
              ))}
            </div>
          );
        }) : <div className="dashboard-card"><p className="muted">Bạn chưa lưu voucher nào.</p></div>}
      </div>

      <h3 style={{ marginTop: 28 }}>Voucher đang có</h3>
      <div className="voucher-grid">
        {all.map((v) => <div className="voucher-card glow-card" key={v.VoucherId}>
          <div><span className="voucher-code">{v.Code}</span><h3>Giảm {discountText(v)}</h3><p>Số lượng còn: {v.Quantity}</p><p>Hạn dùng: {date(v.EndDate)}</p></div>
          <button className="card-btn" onClick={() => save(v.VoucherId)}>Lưu voucher</button>
        </div>)}
      </div>
    </>}
  </CustomerLayout>;
}
