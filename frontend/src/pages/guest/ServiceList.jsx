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
    if (!user) return setError("Vui lòng đăng nhập để yêu thích dịch vụ");
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
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Danh sách dịch vụ</div>
          <h2 className="section-title">Chọn dịch vụ phù hợp</h2>
        </div>

        <Link className="btn" to="/customer/booking">
          Đặt lịch ngay
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm kiếm dịch vụ..."
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "ALL" ? "Tất cả danh mục" : c}
            </option>
          ))}
        </select>

        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        >
          <option value="ALL">Tất cả giá</option>
          <option value="UNDER_300">Dưới 300.000đ</option>
          <option value="300_700">300.000đ - 700.000đ</option>
          <option value="OVER_700">Trên 700.000đ</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        >
          <option value="DEFAULT">Sắp xếp mặc định</option>
          <option value="PRICE_ASC">Giá thấp đến cao</option>
          <option value="PRICE_DESC">Giá cao đến thấp</option>
          <option value="DURATION_ASC">Thời lượng ngắn nhất</option>
        </select>
      </div>

      {error && <p className="muted">{error}</p>}

      {loading ? (
        <p>Đang tải dịch vụ...</p>
      ) : filteredServices.length === 0 ? (
        <div className="dashboard-card">
          <h3>Không tìm thấy dịch vụ</h3>
          <p className="muted">Thử đổi từ khóa hoặc bộ lọc khác.</p>
        </div>
      ) : (
        <div className="grid">
          {filteredServices.map((s) => {
            const isFavorite = favoriteIds.has(Number(s.ServiceId));
            return (
            <div className="service-card" key={s.ServiceId} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => toggleFavoriteService(s.ServiceId)}
                aria-label={isFavorite ? "Bỏ yêu thích" : "Yêu thích dịch vụ"}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  zIndex: 2,
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  border: "none",
                  background: isFavorite ? "#ff4f92" : "rgba(255,255,255,.95)",
                  color: isFavorite ? "#fff" : "#ff4f92",
                  boxShadow: "0 10px 24px rgba(255, 79, 146, .2)",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                {isFavorite ? "❤" : "♡"}
              </button>
              <img src={resolveFileUrl(s.ImageUrl)} alt={s.ServiceName} />

              <div className="service-body">
                <p className="eyebrow">{s.CategoryName}</p>
                <h3>{s.ServiceName}</h3>

                <p className="muted">
                  {s.DurationMinutes} phút
                  <span className="price" style={{ float: "right" }}>
                    {formatMoney(s.Price)}
                  </span>
                </p>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => toggleFavoriteService(s.ServiceId)}
                    aria-label={favoriteIds.has(Number(s.ServiceId)) ? "Bỏ yêu thích" : "Yêu thích"}
                    className="card-btn"
                    style={{ width: 48, minWidth: 48, padding: 0, fontSize: 20 }}
                  >
                    {favoriteIds.has(Number(s.ServiceId)) ? "♥" : "♡"}
                  </button>

                  <Link to={`/services/${s.ServiceId}`} style={{ flex: 1 }}>
                    <button className="card-btn" style={{ width: "100%" }}>
                      Xem chi tiết
                    </button>
                  </Link>

                  <button
                    type="button"
                    className="card-btn primary"
                    style={{ width: "100%", flex: 1 }}
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
          );})}
        </div>
      )}
    </section>
  );
}
