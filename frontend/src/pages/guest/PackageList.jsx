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
    try {
      const [pkgRes, catRes] = await Promise.all([
        axiosClient.get(`/packages?${queryString}`),
        axiosClient.get('/packages/categories/list'),
      ]);
      setPackages(pkgRes.data.data || pkgRes.data || []);
      setCategories(catRes.data.data || catRes.data || []);
      setMessage('');
    } catch (err) {
      setMessage('Không tải được danh sách combo / liệu trình');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => { 
      setLoading(false); 
      setMessage('Không tải được danh sách combo / liệu trình'); 
    });
  }, [queryString]);

  const buyNow = async (packageId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/packages/${packageId}`);
  };

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilters({ search: '', category: '', sort: 'newest', minPrice: '', maxPrice: '' });
  };

  return (
    <section className="combo-page-premium">
      <style>{`
        .combo-page-premium {
          padding: 40px 24px 80px;
          background: linear-gradient(180deg, #fffafc 0%, #ffffff 50%, #fffbfd 100%);
          min-height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .premium-hero {
          max-width: 1200px;
          margin: 0 auto 40px;
          background: radial-gradient(circle at 90% 10%, rgba(255, 228, 236, 0.6), transparent 45%),
                      linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 242, 246, 0.8) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 32px;
          padding: 40px;
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
          align-items: center;
          box-shadow: 0 20px 60px rgba(255, 83, 130, 0.07);
        }

        .premium-hero-left h1 {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 900;
          color: #1a0b14;
          margin: 0 0 16px;
          line-height: 1.25;
          letter-spacing: -0.5px;
        }

        .premium-hero-left p {
          font-size: 15.5px;
          color: #6d5c68;
          line-height: 1.8;
          max-width: 650px;
          margin-bottom: 24px;
        }

        .premium-benefits-list {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .premium-benefit-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 71, 120, 0.15);
          color: #ff4778;
          font-weight: 800;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(255, 71, 120, 0.04);
          transition: all 0.3s ease;
        }

        .premium-benefit-pill:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 71, 120, 0.4);
          box-shadow: 0 6px 16px rgba(255, 71, 120, 0.08);
        }

        .premium-hero-right-card {
          background: linear-gradient(135deg, #1c0915 0%, #3e162d 100%);
          padding: 32px;
          border-radius: 28px;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 15px 40px rgba(62, 22, 45, 0.2);
          position: relative;
          overflow: hidden;
        }

        .premium-hero-right-card h4 {
          font-size: 18px;
          font-weight: 800;
          color: #ffd2e0;
          margin: 0 0 10px;
          letter-spacing: 0.5px;
        }

        .premium-hero-right-card p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
          margin: 0 0 20px;
        }

        .premium-hero-right-card .btn-vip {
          width: 100%;
          padding: 14px;
          border-radius: 99px;
          background: linear-gradient(135deg, #ff5ea8, #ef4f83);
          color: #fff;
          font-weight: 800;
          font-size: 13.5px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 6px 20px rgba(239, 79, 131, 0.4);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .premium-hero-right-card .btn-vip:hover {
          background: linear-gradient(135deg, #ff7dbd, #ff5ea8);
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(239, 79, 131, 0.55);
        }

        .premium-layout-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 290px 1fr;
          gap: 30px;
        }

        .premium-sidebar-card {
          background: #ffffff;
          border: 1px solid rgba(255, 224, 235, 0.7);
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 12px 40px rgba(226, 59, 117, 0.03);
          margin-bottom: 24px;
        }

        .premium-sidebar-card h3 {
          font-size: 15px;
          font-weight: 800;
          color: #1a0b14;
          margin: 0 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #fff0f5;
          padding-bottom: 10px;
        }

        .category-filter-btn {
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          padding: 12px 16px;
          border-radius: 16px;
          cursor: pointer;
          color: #4a3e47;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .category-filter-btn:hover {
          background: #fff5f8;
          color: #ff4778;
          transform: translateX(4px);
        }

        .category-filter-btn.active {
          background: linear-gradient(90deg, #fff0f5 0%, #fff7f9 100%);
          color: #ff4778;
          font-weight: 800;
          border-left: 4px solid #ff4778;
          padding-left: 12px;
        }

        .category-filter-btn small {
          font-weight: 700;
          opacity: 0.8;
          background: rgba(255, 71, 120, 0.08);
          color: #ff4778;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 11px;
        }

        .price-filter-inputs {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .price-filter-inputs input {
          width: 100%;
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 13.5px;
          outline: none;
          background: #fffdfd;
          color: #1a0b14;
          box-sizing: border-box;
          transition: all 0.3s ease;
        }

        .price-filter-inputs input:focus {
          border-color: #ff4778;
          box-shadow: 0 0 0 4px rgba(255, 71, 120, 0.1);
          background: #fff;
        }

        .premium-toolbar {
          display: grid;
          grid-template-columns: 1fr 200px;
          gap: 16px;
          margin-bottom: 24px;
        }

        .premium-search-box {
          position: relative;
        }

        .premium-search-box input {
          width: 100%;
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 20px;
          padding: 14px 20px 14px 46px;
          font-size: 14.5px;
          outline: none;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(226, 59, 117, 0.03);
          box-sizing: border-box;
          transition: all 0.3s ease;
        }

        .premium-search-box input:focus {
          border-color: #ff4778;
          box-shadow: 0 10px 30px rgba(255, 71, 120, 0.08);
        }

        .premium-search-box::before {
          content: '🔍';
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          opacity: 0.6;
        }

        .premium-sort-select {
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 20px;
          padding: 14px 20px;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          background: #ffffff;
          color: #4a3e47;
          box-shadow: 0 8px 24px rgba(226, 59, 117, 0.03);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .premium-sort-select:focus {
          border-color: #ff4778;
        }

        .premium-combo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
          gap: 24px;
        }

        .premium-combo-card {
          background: #ffffff;
          border: 1px solid rgba(255, 224, 235, 0.6);
          border-radius: 28px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          box-shadow: 0 12px 36px rgba(226, 59, 117, 0.04);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .premium-combo-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 45px rgba(226, 59, 117, 0.12);
          border-color: rgba(255, 71, 120, 0.25);
        }

        .premium-combo-img-container {
          position: relative;
          height: 200px;
          overflow: hidden;
          background: #fff0f5;
        }

        .premium-combo-img-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .premium-combo-card:hover .premium-combo-img-container img {
          transform: scale(1.08);
        }

        .premium-sale-badge {
          background: linear-gradient(135deg, #ff2a70 0%, #ff659f 100%);
          color: #fff;
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 900;
          position: absolute;
          top: 12px;
          right: 12px;
          left: auto;
          z-index: 2;
          box-shadow: 0 4px 10px rgba(255, 42, 112, 0.35);
        }

        .premium-combo-card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .premium-combo-tag {
          font-size: 11px;
          font-weight: 800;
          color: #ff4778;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 8px;
        }

        .premium-combo-card-body h3 {
          font-size: 17px;
          font-weight: 800;
          color: #1a0b14;
          margin: 0 0 10px;
          line-height: 1.4;
          height: 48px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .premium-combo-card-body p.desc {
          font-size: 13px;
          color: #6d5d67;
          line-height: 1.6;
          margin: 0 0 16px;
          height: 62px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .premium-combo-meta-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .premium-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 10px;
          background: #fff6f8;
          color: #e03763;
          font-size: 12px;
          font-weight: 700;
        }

        .premium-services-list {
          background: #faf7f8;
          border-radius: 16px;
          padding: 12px 14px;
          margin-bottom: 20px;
        }

        .premium-services-title {
          font-size: 11px;
          font-weight: 800;
          color: #8c7a85;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .premium-services-tags-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-height: 52px;
          overflow: hidden;
          position: relative;
        }

        .premium-service-tag-item {
          font-size: 11.5px;
          background: #ffffff;
          border: 1px solid rgba(255, 71, 120, 0.08);
          color: #5a4b54;
          padding: 4px 8px;
          border-radius: 8px;
          white-space: nowrap;
          font-weight: 600;
        }

        .premium-combo-price-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px dashed #fff0f5;
          margin-bottom: 18px;
        }

        .premium-price-row-main {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
        }

        .premium-price-final {
          font-size: 21px;
          font-weight: 900;
          color: #ef4f83;
        }

        .premium-price-original {
          font-size: 13.5px;
          color: #8c7c85;
          text-decoration: line-through;
        }

        .premium-price-save-badge {
          align-self: flex-start;
          font-size: 11px;
          font-weight: 800;
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
          padding: 4px 8px;
          border-radius: 8px;
          display: inline-block;
          margin-top: 2px;
        }

        .premium-combo-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .premium-btn-action {
          padding: 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
          text-decoration: none;
          box-sizing: border-box;
        }

        .premium-btn-action.secondary {
          background: #ffffff;
          border: 1px solid rgba(255, 71, 120, 0.2);
          color: #ff4778;
        }

        .premium-btn-action.secondary:hover {
          background: #fff8fa;
          border-color: #ff4778;
        }

        .premium-btn-action.primary {
          background: linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 14px rgba(239, 79, 131, 0.25);
        }

        .premium-btn-action.primary:hover {
          background: linear-gradient(135deg, #ff7dbd 0%, #ff5ea8 100%);
          box-shadow: 0 6px 18px rgba(239, 79, 131, 0.4);
        }

        .premium-clear-btn {
          border: none;
          background: none;
          color: #8c7c85;
          font-size: 12px;
          font-weight: 600;
          text-decoration: underline;
          cursor: pointer;
        }

        .premium-clear-btn:hover {
          color: #ff4778;
        }

        .premium-empty-card {
          padding: 60px 40px;
          text-align: center;
          background: #fff;
          border-radius: 28px;
          border: 1px dashed rgba(255, 71, 120, 0.2);
          color: #8c7c85;
          font-size: 15px;
        }

        @media (max-width: 990px) {
          .premium-hero {
            grid-template-columns: 1fr;
            padding: 30px;
          }
          
          .premium-layout-grid {
            grid-template-columns: 1fr;
          }
          
          .premium-sidebar-card {
            margin-bottom: 16px;
          }

          .premium-toolbar {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Hero Section */}
      <div className="premium-hero">
        <div className="premium-hero-left">
          <div style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 800, color: '#ff4778', letterSpacing: '1.5px', marginBottom: '8px' }}>
            Combo / Liệu Trình Cao Cấp
          </div>
          <h1>Gói dịch vụ chăm sóc chuyên sâu</h1>
          <p>Các liệu trình thiết kế khoa học theo từng nhu cầu riêng biệt của làn da và vóc dáng, tối ưu hiệu quả và tiết kiệm chi phí vượt trội so với dịch vụ lẻ.</p>
          <div className="premium-benefits-list">
            <span className="premium-benefit-pill">💗 Tiết kiệm đến 22%</span>
            <span className="premium-benefit-pill">🛡️ Cam kết hiệu quả</span>
            <span className="premium-benefit-pill">🏥 Liệu trình chuẩn y khoa</span>
          </div>
        </div>
        <div className="premium-hero-right-card">
          <h4>Đặc quyền hội viên</h4>
          <p>Mua các gói liệu trình tiết kiệm và theo dõi chi tiết số buổi đã sử dụng trực quan ngay trong tài khoản.</p>
          <Link className="btn-vip" to={user ? '/customer/packages' : '/login'}>
            {user ? '💎 Combo của tôi' : 'Đăng nhập ngay'}
          </Link>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="premium-layout-grid">
        {/* Sidebar */}
        <aside className="premium-sidebar">
          <div className="premium-sidebar-card">
            <h3>
              <span>Danh mục combo</span>
              {(filters.category || filters.search || filters.minPrice || filters.maxPrice) && (
                <button className="premium-clear-btn" onClick={clearFilters}>Xóa lọc</button>
              )}
            </h3>
            <button 
              className={`category-filter-btn ${!filters.category ? 'active' : ''}`} 
              onClick={() => setFilter('category', '')}
            >
              <span>Tất cả</span>
              <small>{packages.length + (filters.category ? 1 : 0)}</small>
            </button>
            {categories.map((c) => (
              <button 
                key={c.CategoryName} 
                className={`category-filter-btn ${filters.category === c.CategoryName ? 'active' : ''}`} 
                onClick={() => setFilter('category', c.CategoryName)}
              >
                <span>{c.CategoryName}</span>
                <small>{c.Total}</small>
              </button>
            ))}
          </div>

          <div className="premium-sidebar-card">
            <h3>Lọc theo giá</h3>
            <div className="price-filter-inputs">
              <input 
                type="number" 
                placeholder="Giá từ (đ)" 
                value={filters.minPrice} 
                onChange={(e) => setFilter('minPrice', e.target.value)} 
              />
              <input 
                type="number" 
                placeholder="Đến (đ)" 
                value={filters.maxPrice} 
                onChange={(e) => setFilter('maxPrice', e.target.value)} 
              />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="premium-main-content">
          {/* Toolbar */}
          <div className="premium-toolbar">
            <div className="premium-search-box">
              <input 
                type="text" 
                value={filters.search} 
                onChange={(e) => setFilter('search', e.target.value)} 
                placeholder="Tìm kiếm liệu trình, combo trị liệu..." 
              />
            </div>
            <select 
              className="premium-sort-select" 
              value={filters.sort} 
              onChange={(e) => setFilter('sort', e.target.value)}
            >
              <option value="newest">Mới nhất</option>
              <option value="priceAsc">Giá: Thấp đến Cao</option>
              <option value="priceDesc">Giá: Cao đến Thấp</option>
              <option value="sessionsDesc">Số buổi: Nhiều nhất</option>
            </select>
          </div>

          {message && <div className="alert error" style={{ borderRadius: '20px', marginBottom: '24px' }}>{message}</div>}
          
          {loading ? (
            <p className="muted" style={{ textAlign: 'center', padding: '40px 0' }}>Đang tải liệu trình...</p>
          ) : (
            <div className="premium-combo-grid">
              {packages.map((p) => {
                const origPrice = Number(p.Price || 0);
                const salePrice = Number(p.FinalPrice || p.SalePrice || 0);
                const hasDiscount = origPrice > salePrice;
                const discPercent = p.DiscountPercent || (origPrice > 0 ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0);
                const saveAmount = origPrice - salePrice;

                return (
                  <article className="premium-combo-card" key={p.PackageId}>
                    <div className="premium-combo-img-container">
                      {hasDiscount && (
                        <span className="premium-sale-badge">
                          -{discPercent}%
                        </span>
                      )}
                      <img src={resolveFileUrl(p.ImageUrl) || '/vite.svg'} alt={p.PackageName} />
                    </div>

                    <div className="premium-combo-card-body">
                      <div className="premium-combo-tag">{p.CategoryName}</div>
                      <h3>{p.PackageName}</h3>
                      <p className="desc">{p.Description}</p>

                      <div className="premium-combo-meta-badges">
                        <span className="premium-meta-badge">🕘 {p.TotalSessions || 1} buổi</span>
                        <span className="premium-meta-badge">📅 {p.ValidityDays || 30} ngày</span>
                      </div>

                      {/* Display sub-services nicely parsed from p.ServiceNames */}
                      {p.ServiceNames && (
                        <div className="premium-services-list">
                          <div className="premium-services-title">Dịch vụ đi kèm</div>
                          <div className="premium-services-tags-grid">
                            {p.ServiceNames.split(',').map((s, idx) => (
                              <span className="premium-service-tag-item" key={idx}>
                                {s.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Price box with clear savings */}
                      <div className="premium-combo-price-block">
                        <div className="premium-price-row-main">
                          <span className="premium-price-final">{money(salePrice)}</span>
                          {hasDiscount && <span className="premium-price-original">{money(origPrice)}</span>}
                        </div>
                        {saveAmount > 0 && (
                          <span className="premium-price-save-badge">
                            Tiết kiệm {money(saveAmount)}
                          </span>
                        )}
                      </div>

                      <div className="premium-combo-actions">
                        <Link className="premium-btn-action secondary" to={`/packages/${p.PackageId}`}>
                          Chi tiết
                        </Link>
                        <button className="premium-btn-action primary" onClick={() => buyNow(p.PackageId)}>
                          Mua ngay
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && packages.length === 0 && (
            <div className="premium-empty-card">
              Không tìm thấy combo hoặc liệu trình phù hợp với tiêu chí lọc.
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
