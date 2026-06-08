import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

export default function PackageList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ search: '', category: '', sort: 'newest', minPrice: '', maxPrice: '' });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) params.append(key, value);
    });
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    const [pkgRes, catRes] = await Promise.all([
      axiosClient.get(`/packages?${queryString}`),
      axiosClient.get('/packages/categories/list'),
    ]);
    setPackages(pkgRes.data.data || pkgRes.data || []);
    setCategories(catRes.data.data || catRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => { setLoading(false); setMessage('Không tải được danh sách combo / liệu trình'); }); }, [queryString]);

  const buyNow = async (packageId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/packages/${packageId}`);
  };

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="combo-page">
      <div className="combo-hero">
        <div>
          <div className="eyebrow">Combo / Liệu trình</div>
          <h1>Gói dịch vụ chăm sóc chuyên sâu</h1>
          <p>Các liệu trình được thiết kế theo từng nhu cầu, có giá ưu đãi và số buổi rõ ràng.</p>
          <div className="combo-benefits">
            <span>💗 Tiết kiệm hơn</span>
            <span>🛡️ Cam kết kết quả</span>
            <span>🧴 Dịch vụ thật từ database</span>
          </div>
        </div>
        <div className="combo-hero-card">
          <b>Ưu đãi thành viên</b>
          <p>Đăng nhập để mua liệu trình và theo dõi số buổi còn lại.</p>
          <Link className="btn" to={user ? '/customer/packages' : '/login'}>{user ? 'Combo của tôi' : 'Đăng nhập'}</Link>
        </div>
      </div>

      <div className="combo-layout">
        <aside className="combo-sidebar">
          <div className="filter-card">
            <h3>Danh mục combo</h3>
            <button className={!filters.category ? 'active' : ''} onClick={() => setFilter('category', '')}>Tất cả</button>
            {categories.map((c) => (
              <button key={c.CategoryName} className={filters.category === c.CategoryName ? 'active' : ''} onClick={() => setFilter('category', c.CategoryName)}>
                {c.CategoryName} <small>({c.Total})</small>
              </button>
            ))}
          </div>

          <div className="filter-card">
            <h3>Khoảng giá</h3>
            <input placeholder="Từ" value={filters.minPrice} onChange={(e) => setFilter('minPrice', e.target.value)} />
            <input placeholder="Đến" value={filters.maxPrice} onChange={(e) => setFilter('maxPrice', e.target.value)} />
          </div>
        </aside>

        <main className="combo-main">
          <div className="combo-toolbar">
            <input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Tìm kiếm combo, liệu trình..." />
            <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="priceAsc">Giá thấp đến cao</option>
              <option value="priceDesc">Giá cao đến thấp</option>
              <option value="sessionsDesc">Nhiều buổi nhất</option>
            </select>
          </div>

          {message && <div className="alert error">{message}</div>}
          {loading && <p className="muted">Đang tải combo / liệu trình...</p>}

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
                  <div className="combo-meta">
                    <span>🕘 {p.TotalSessions || p.ServiceCount || 1} buổi</span>
                    <span>📅 {p.ValidityDays || 30} ngày</span>
                  </div>
                  <p className="muted service-names">{p.ServiceNames}</p>
                  <div className="combo-price-row">
                    <b>{money(p.FinalPrice || p.Price)}</b>
                    {Number(p.DiscountPercent || 0) > 0 && <del>{money(p.Price)}</del>}
                  </div>
                  <div className="combo-actions">
                    <Link className="card-btn" to={`/packages/${p.PackageId}`}>Xem chi tiết</Link>
                    <button className="card-btn primary" onClick={() => buyNow(p.PackageId)}>Mua ngay</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!loading && packages.length === 0 && <div className="empty-card">Không có combo phù hợp.</div>}
        </main>
      </div>
    </section>
  );
}
