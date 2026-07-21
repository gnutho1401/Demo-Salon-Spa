import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

export default function ServiceList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("ALL");
  const [priceFilter, setPriceFilter] = useState("ALL");
  const [sort, setSort] = useState("DEFAULT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [servicesRes, favRes] = await Promise.all([
          axiosClient.get("/services"),
          user ? axiosClient.get("/customers/me/favorites/services") : Promise.resolve({ data: { data: [] } }),
        ]);
        setServices(servicesRes.data.data || servicesRes.data || []);
        setFavoriteIds(new Set((favRes.data.data || []).map((item) => Number(item.ServiceId))));
        setError("");
      } catch {
        setError("Không tải được danh sách dịch vụ");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const categories = useMemo(() => {
    return [
      "ALL",
      ...new Set(services.map((s) => s.CategoryName).filter(Boolean)),
    ];
  }, [services]);

  async function toggleFavoriteService(serviceId) {
    if (!user) {
      setError("Vui lòng đăng nhập để yêu thích dịch vụ");
      setTimeout(() => setError(""), 3000);
      return;
    }
    try {
      const res = await axiosClient.post("/customers/me/favorites/services/toggle", { serviceId });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (res.data.data?.favorited) next.add(Number(serviceId));
        else next.delete(Number(serviceId));
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không cập nhật được yêu thích");
      setTimeout(() => setError(""), 3000);
    }
  }

  const filteredServices = useMemo(() => {
    let result = [...services];

    const text = keyword.trim().toLowerCase();

    if (text) {
      result = result.filter(
        (s) =>
          String(s.ServiceName || "")
            .toLowerCase()
            .includes(text) ||
          String(s.Description || "")
            .toLowerCase()
            .includes(text) ||
          String(s.CategoryName || "")
            .toLowerCase()
            .includes(text),
      );
    }

    if (category !== "ALL") {
      result = result.filter((s) => s.CategoryName === category);
    }

    if (priceFilter === "UNDER_300") {
      result = result.filter((s) => Number(s.Price || 0) < 300000);
    }

    if (priceFilter === "300_700") {
      result = result.filter((s) => {
        const price = Number(s.Price || 0);
        return price >= 300000 && price <= 700000;
      });
    }

    if (priceFilter === "OVER_700") {
      result = result.filter((s) => Number(s.Price || 0) > 700000);
    }

    if (sort === "PRICE_ASC") {
      result.sort((a, b) => Number(a.Price || 0) - Number(b.Price || 0));
    }

    if (sort === "PRICE_DESC") {
      result.sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0));
    }

    if (sort === "DURATION_ASC") {
      result.sort(
        (a, b) =>
          Number(a.DurationMinutes || 0) - Number(b.DurationMinutes || 0),
      );
    }

    return result;
  }, [services, keyword, category, priceFilter, sort]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
  }

  return (
    <section className="services-page-premium">
      <style>{`
        .services-page-premium {
          padding: 40px 24px 80px;
          background: linear-gradient(180deg, #fffafc 0%, #ffffff 50%, #fffbfd 100%);
          min-height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .services-hero {
          max-width: 1200px;
          margin: 0 auto 36px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #fff0f5;
          padding-bottom: 24px;
        }

        .services-hero h1 {
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 900;
          color: #1a0b14;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .services-hero p {
          font-size: 15px;
          color: #6d5c68;
          margin: 0;
        }

        .services-hero .btn-book-top {
          padding: 14px 28px;
          border-radius: 99px;
          background: linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 14px;
          text-decoration: none;
          box-shadow: 0 6px 20px rgba(239, 79, 131, 0.3);
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .services-hero .btn-book-top:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(239, 79, 131, 0.5);
        }

        .services-filter-bar {
          max-width: 1200px;
          margin: 0 auto 36px;
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 16px;
          background: #ffffff;
          padding: 20px;
          border-radius: 24px;
          border: 1px solid rgba(255, 224, 235, 0.8);
          box-shadow: 0 10px 30px rgba(226, 59, 117, 0.03);
        }

        .services-filter-input {
          width: 100%;
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 16px;
          padding: 14px 16px 14px 44px;
          font-size: 14px;
          outline: none;
          background: #fffdfd;
          color: #1a0b14;
          box-sizing: border-box;
          transition: all 0.3s ease;
          position: relative;
        }

        .services-search-wrapper {
          position: relative;
        }

        .services-search-wrapper::before {
          content: '🔍';
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 15px;
          opacity: 0.6;
          z-index: 1;
        }

        .services-filter-input:focus,
        .services-filter-select:focus {
          border-color: #ff4778;
          box-shadow: 0 0 0 4px rgba(255, 71, 120, 0.1);
          background: #ffffff;
        }

        .services-filter-select {
          width: 100%;
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          background: #ffffff;
          color: #4a3e47;
          cursor: pointer;
          box-sizing: border-box;
          transition: all 0.3s ease;
        }

        .services-grid-container {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
          gap: 28px;
        }

        .services-premium-card {
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

        .services-premium-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 45px rgba(226, 59, 117, 0.12);
          border-color: rgba(255, 71, 120, 0.25);
        }

        .services-card-img-wrap {
          position: relative;
          height: 210px;
          overflow: hidden;
          background: #fff0f5;
        }

        .services-card-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .services-premium-card:hover .services-card-img-wrap img {
          transform: scale(1.08);
        }

        .btn-fav-floating {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 2;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(255, 79, 146, 0.25);
        }

        .btn-fav-floating.active {
          background: #ff4f92;
          color: #ffffff;
        }

        .btn-fav-floating.inactive {
          background: rgba(255, 255, 255, 0.95);
          color: #ff4f92;
        }

        .btn-fav-floating:hover {
          transform: scale(1.1);
        }

        .services-card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .services-card-tag {
          font-size: 11px;
          font-weight: 800;
          color: #ff4778;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 8px;
          background: #fff0f5;
          padding: 4px 10px;
          border-radius: 8px;
          align-self: flex-start;
        }

        .services-card-body h3 {
          font-size: 17px;
          font-weight: 800;
          color: #1a0b14;
          margin: 0 0 10px;
          line-height: 1.45;
          height: 50px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .services-card-body p.desc {
          font-size: 13px;
          color: #6d5d67;
          line-height: 1.6;
          margin: 0 0 16px;
          height: 60px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .services-card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px dashed #fff0f5;
          margin-bottom: 18px;
        }

        .services-card-duration {
          font-size: 13px;
          color: #8c7c85;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }

        .services-card-price {
          font-size: 20px;
          font-weight: 900;
          color: #ef4f83;
        }

        .services-card-actions {
          display: flex;
          gap: 8px;
        }

        .btn-card-action {
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

        .btn-card-action.fav {
          width: 46px;
          min-width: 46px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          background: #ffffff;
          border: 1px solid rgba(255, 71, 120, 0.2);
          color: #ff4778;
        }

        .btn-card-action.fav:hover {
          background: #fff8fa;
          border-color: #ff4778;
        }

        .btn-card-action.secondary {
          flex: 1;
          background: #ffffff;
          border: 1px solid rgba(255, 71, 120, 0.2);
          color: #ff4778;
        }

        .btn-card-action.secondary:hover {
          background: #fff8fa;
          border-color: #ff4778;
        }

        .btn-card-action.primary {
          flex: 1.2;
          background: linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 14px rgba(239, 79, 131, 0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-card-action.primary:hover {
          background: linear-gradient(135deg, #ff7dbd 0%, #ff5ea8 100%);
          box-shadow: 0 6px 18px rgba(239, 79, 131, 0.4);
        }

        .services-empty-card {
          padding: 60px 40px;
          text-align: center;
          background: #fff;
          border-radius: 28px;
          border: 1px dashed rgba(255, 71, 120, 0.2);
          color: #8c7c85;
          font-size: 15px;
          max-width: 600px;
          margin: 40px auto;
        }

        @media (max-width: 820px) {
          .services-filter-bar {
            grid-template-columns: 1fr;
            padding: 16px;
          }
          
          .services-hero {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
        }
      `}</style>

      {/* Hero Section */}
      <div className="services-hero">
        <div>
          <div style={{ textTransform: "uppercase", fontSize: "12px", fontWeight: 800, color: "#ff4778", letterSpacing: "1.5px", marginBottom: "8px" }}>
            Trị Liệu & Làm Đẹp
          </div>
          <h1>Chọn dịch vụ phù hợp</h1>
          <p>Khám phá hệ thống các liệu pháp chăm sóc da, phục hồi tóc, nail nghệ thuật chuẩn y khoa.</p>
        </div>

        <Link className="btn-book-top" to="/customer/booking">
          📅 Đặt lịch ngay
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="services-filter-bar">
        <div className="services-search-wrapper">
          <input
            type="text"
            className="services-filter-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm kiếm dịch vụ trị liệu..."
          />
        </div>

        <select
          className="services-filter-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "ALL" ? "Tất cả danh mục" : c}
            </option>
          ))}
        </select>

        <select
          className="services-filter-select"
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
        >
          <option value="ALL">Tất cả giá</option>
          <option value="UNDER_300">Dưới 300.000đ</option>
          <option value="300_700">300.000đ - 700.000đ</option>
          <option value="OVER_700">Trên 700.000đ</option>
        </select>

        <select
          className="services-filter-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="DEFAULT">Sắp xếp mặc định</option>
          <option value="PRICE_ASC">Giá: Thấp đến Cao</option>
          <option value="PRICE_DESC">Giá: Cao đến Thấp</option>
          <option value="DURATION_ASC">Thời lượng ngắn nhất</option>
        </select>
      </div>

      {error && <div className="alert error" style={{ maxWidth: 1200, margin: "0 auto 24px", borderRadius: "16px" }}>{error}</div>}

      {/* Main Grid content */}
      {loading ? (
        <p style={{ textAlign: "center", padding: "40px 0", color: "#8c7c85" }}>Đang tải dịch vụ...</p>
      ) : filteredServices.length === 0 ? (
        <div className="services-empty-card">
          <h3>Không tìm thấy dịch vụ nào</h3>
          <p className="muted">Thử thay đổi từ khóa hoặc thiết lập bộ lọc khác.</p>
        </div>
      ) : (
        <div className="services-grid-container">
          {filteredServices.map((s) => {
            const isFavorite = favoriteIds.has(Number(s.ServiceId));
            return (
              <div className="services-premium-card" key={s.ServiceId}>
                <div className="services-card-img-wrap">
                  <button
                    type="button"
                    onClick={() => toggleFavoriteService(s.ServiceId)}
                    aria-label={isFavorite ? "Bỏ yêu thích" : "Yêu thích dịch vụ"}
                    className={`btn-fav-floating ${isFavorite ? "active" : "inactive"}`}
                  >
                    {isFavorite ? "❤" : "♡"}
                  </button>
                  <img src={resolveFileUrl(s.ImageUrl)} alt={s.ServiceName} />
                </div>

                <div className="services-card-body">
                  <div className="services-card-tag">{s.CategoryName}</div>
                  <h3>{s.ServiceName}</h3>
                  <p className="desc">{s.Description || "Không có mô tả chi tiết."}</p>

                  <div className="services-card-meta">
                    <span className="services-card-duration">
                      🕘 {s.DurationMinutes} phút
                    </span>
                    <span className="services-card-price">
                      {formatMoney(s.Price)}
                    </span>
                  </div>

                  <div className="services-card-actions">
                    <button
                      type="button"
                      onClick={() => toggleFavoriteService(s.ServiceId)}
                      aria-label={isFavorite ? "Bỏ yêu thích" : "Yêu thích"}
                      className="btn-card-action fav"
                    >
                      {isFavorite ? "♥" : "♡"}
                    </button>

                    <Link to={`/services/${s.ServiceId}`} style={{ flex: 1, display: "flex" }}>
                      <button className="btn-card-action secondary" style={{ width: "100%" }}>
                        Chi tiết
                      </button>
                    </Link>

                    <button
                      type="button"
                      className="btn-card-action primary"
                      onClick={() => {
                        if (!user) {
                          localStorage.setItem("bookingServiceId", String(s.ServiceId));
                          localStorage.setItem("bookingRedirectUrl", `/customer/booking?serviceId=${s.ServiceId}`);
                          navigate(`/login?redirectUrl=${encodeURIComponent(`/customer/booking?serviceId=${s.ServiceId}`)}&serviceId=${s.ServiceId}`);
                          return;
                        }
                        navigate(`/customer/booking?serviceId=${s.ServiceId}`);
                      }}
                    >
                      Đặt lịch
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
