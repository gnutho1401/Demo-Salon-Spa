import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

export default function CustomerPackages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [packages, setPackages] = useState([]);
  const [mine, setMine] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', category: '', sort: 'newest' });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.append(key, value));
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    const [allRes, myRes, catRes] = await Promise.all([
      axiosClient.get(`/packages?${queryString}`),
      axiosClient.get('/packages/my'),
      axiosClient.get('/packages/categories/list'),
    ]);
    setPackages(allRes.data.data || allRes.data || []);
    setMine(myRes.data.data || myRes.data || []);
    setCategories(catRes.data.data || catRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('paid') === '1') setMessage('Thanh toán combo / liệu trình thành công');
    if (params.get('error')) setMessage('Thanh toán thất bại hoặc đã bị hủy');
  }, [location.search]);

  useEffect(() => { load().catch(() => { setLoading(false); setMessage('Không tải được combo / liệu trình'); }); }, [queryString]);

  const buyVnpay = async (id) => {
    try {
      setMessage('');
      const res = await axiosClient.post(`/packages/${id}/vnpay`);
      const data = res.data.data || res.data;
      window.location.href = data.paymentUrl;
    } catch (err) {
      setMessage(err.response?.data?.message || 'Không tạo được thanh toán VNPay');
    }
  };

  return (
    <CustomerLayout>
      <section className="customer-combo-page">
        <div className="section-head">
          <div>
            <div className="eyebrow">Combo / Liệu trình</div>
            <h2 className="section-title">Quản lý combo và mua liệu trình</h2>
            <p className="muted">Theo dõi số buổi còn lại, hạn dùng và thanh toán online bằng VNPay.</p>
          </div>
          <Link className="btn" to="/packages">Xem trang guest</Link>
        </div>

        {message && <div className={message.includes('thành công') ? 'alert success' : 'alert error'}>{message}</div>}

        <h3>Combo của tôi</h3>
        <div className="my-combo-grid">
          {mine.length ? mine.map((p) => {
            const total = Number(p.TotalSessions || 0) || Number(p.RemainingSessions || 0) || 1;
            const left = Number(p.RemainingSessions || 0);
            const percent = Math.max(0, Math.min(100, (left / total) * 100));
            return (
              <article className="my-combo-card" key={p.CustomerPackageId}>
                <img src={resolveFileUrl(p.ImageUrl) || '/vite.svg'} alt={p.PackageName} />
                <div>
                  <div className="combo-category">{p.CategoryName}</div>
                  <h3>{p.PackageName}</h3>
                  <p className="muted">{p.ServiceNames}</p>
                  <div className="combo-progress"><span style={{ width: `${percent}%` }} /></div>
                  <div className="combo-meta">
                    <span>Còn lại: <b>{left}</b>/{total} buổi</span>
                    <span>Hạn: {p.EndDate ? new Date(p.EndDate).toLocaleDateString('vi-VN') : 'Chưa kích hoạt'}</span>
                  </div>
                  <div className="combo-meta">
                    <span className="status">{p.Status}</span>
                    <span>{p.PaymentStatus ? `Thanh toán: ${p.PaymentStatus}` : ''}</span>
                  </div>
                  {p.Status === 'ACTIVE' && Number(p.RemainingSessions || 0) > 0 && (
                    <button
                      type="button"
                      className="btn"
                      style={{ marginTop: 12 }}
                      onClick={() =>
                        navigate(
                          `/customer/booking?customerPackageId=${p.CustomerPackageId}`,
                        )
                      }
                    >
                      Đặt buổi từ combo
                    </button>
                  )}
                </div>
              </article>
            );
          }) : <div className="empty-card">Bạn chưa mua combo nào.</div>}
        </div>

        <div className="combo-toolbar customer-toolbar">
          <input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Tìm combo / liệu trình..." />
          <select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => <option key={c.CategoryName} value={c.CategoryName}>{c.CategoryName}</option>)}
          </select>
          <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}>
            <option value="newest">Mới nhất</option>
            <option value="priceAsc">Giá thấp đến cao</option>
            <option value="priceDesc">Giá cao đến thấp</option>
            <option value="sessionsDesc">Nhiều buổi nhất</option>
          </select>
        </div>

        {loading && <p className="muted">Đang tải...</p>}
        <div className="combo-grid">
          {packages.map((p) => (
            <article className="combo-card" key={p.PackageId}>
              <div className="combo-img-wrap">
                {Number(p.DiscountPercent || 0) > 0 && <span className="sale-badge">-{p.DiscountPercent}%</span>}
                <img src={resolveFileUrl(p.ImageUrl) || '/vite.svg'} alt={p.PackageName} />
              </div>
              <div className="combo-card-body">
                <div className="combo-category">{p.CategoryName}</div>
                <h3>{p.PackageName}</h3>
                <p>{p.Description}</p>
                <div className="combo-meta"><span>🕘 {p.TotalSessions || p.ServiceCount || 1} buổi</span><span>📅 {p.ValidityDays || 30} ngày</span></div>
                <p className="muted service-names">{p.ServiceNames}</p>
                <div className="combo-price-row"><b>{money(p.FinalPrice || p.Price)}</b>{Number(p.DiscountPercent || 0) > 0 && <del>{money(p.Price)}</del>}</div>
                <div className="combo-actions">
                  <button className="card-btn" onClick={() => navigate(`/packages/${p.PackageId}`)}>Chi tiết</button>
                  <button className="card-btn primary" onClick={() => buyVnpay(p.PackageId)}>Thanh toán VNPay</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </CustomerLayout>
  );
}
