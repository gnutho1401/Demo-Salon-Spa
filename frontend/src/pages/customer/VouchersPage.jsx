import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

function money(v) { return Number(v || 0).toLocaleString('vi-VN'); }
function date(v) { return v ? new Date(v).toLocaleDateString('vi-VN') : 'Không giới hạn'; }
function discountText(v) { return v.DiscountType === 'PERCENT' ? `${v.DiscountValue}%` : `${money(v.DiscountValue)}đ`; }

export default function VouchersPage() {
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
        {mine.length ? mine.map((v) => <div className={`voucher-card ${v.UsedStatus ? 'used' : ''}`} key={v.VoucherId}>
          <div><span className="voucher-code">{v.Code}</span><h3>Giảm {discountText(v)}</h3><p>Hạn dùng: {date(v.EndDate)}</p></div>
          <span className="status">{v.UsedStatus ? 'Đã dùng' : 'Có thể dùng'}</span>
        </div>) : <div className="dashboard-card"><p className="muted">Bạn chưa lưu voucher nào.</p></div>}
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
