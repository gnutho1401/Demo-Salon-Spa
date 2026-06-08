import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function ServiceList() {
  const [services, setServices] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("ALL");
  const [priceFilter, setPriceFilter] = useState("ALL");
  const [sort, setSort] = useState("DEFAULT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axiosClient
      .get("/services")
      .then((res) => setServices(res.data.data || res.data || []))
      .catch(() => setError("Không tải được danh sách dịch vụ"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    return [
      "ALL",
      ...new Set(services.map((s) => s.CategoryName).filter(Boolean)),
    ];
  }, [services]);

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
          {filteredServices.map((s) => (
            <div className="service-card" key={s.ServiceId}>
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

                <div style={{ display: "flex", gap: 8 }}>
                  <Link to={`/services/${s.ServiceId}`} style={{ flex: 1 }}>
                    <button className="card-btn" style={{ width: "100%" }}>
                      Xem chi tiết
                    </button>
                  </Link>

                  <Link
                    to={`/customer/booking?serviceId=${s.ServiceId}`}
                    style={{ flex: 1 }}
                  >
                    <button
                      className="card-btn primary"
                      style={{ width: "100%" }}
                    >
                      Đặt lịch
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
