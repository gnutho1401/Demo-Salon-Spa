import { useEffect, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function getAvatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function TechnicianReviews() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    reviews: [],
    services: [],
    summary: {
      TotalCount: 0,
      AvgRating: 0,
      Stars5: 0,
      Stars4: 0,
      Stars3: 0,
      Stars2: 0,
      Stars1: 0,
    },
    monthlyStats: [],
  });

  const [ratingFilter, setRatingFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all", "positive" (4-5), "critical" (1-2)

  async function loadReviews() {
    try {
      setLoading(true);
      const params = {};
      if (ratingFilter) params.rating = ratingFilter;
      if (serviceFilter) params.serviceId = serviceFilter;

      const res = await axiosClient.get("/technician/reviews", { params });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [ratingFilter, serviceFilter]);

  const { reviews, services, summary, monthlyStats } = data;

  // Filter reviews by active tabs client-side as well
  const filteredReviews = reviews.filter((r) => {
    if (activeTab === "positive") return r.Rating >= 4;
    if (activeTab === "critical") return r.Rating <= 2;
    return true;
  });

  // Calculate percentages for rating bars
  const totalRatings = summary.TotalCount || 1;
  const getPercentage = (count) =>
    Math.round(((count || 0) / totalRatings) * 100);

  // Helper to render stars
  const renderStars = (rating) => {
    const goldStars = "★".repeat(rating);
    const grayStars = "☆".repeat(5 - rating);
    return (
      <span className="star-rating">
        <span className="gold-stars">{goldStars}</span>
        <span className="gray-stars">{grayStars}</span>
      </span>
    );
  };

  return (
    <TechnicianLayout>
      <div id="tech-reviews-page">
        <style>{`
          #tech-reviews-page {
            font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #FAF8F5;
            color: #242019;
            padding: 24px;
            min-height: 100vh;
          }

          .header-section {
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .header-section h1 {
            font-family: Georgia, serif;
            font-size: 2.2rem;
            color: #1e3a29;
            margin: 0;
            font-weight: 800;
          }

          .header-section p {
            color: #718096;
            margin: 4px 0 0 0;
            font-size: 0.95rem;
          }

          /* Summary Grid */
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1.2fr 1.8fr;
            gap: 20px;
            margin-bottom: 28px;
          }

          .stat-card {
            background: #ffffff;
            border: 1px solid #e2dcd0;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 10px 25px rgba(47, 89, 58, 0.02);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }

          .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 30px rgba(47, 89, 58, 0.05);
          }

          /* Avg Rating Big Card */
          .avg-score-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
          }

          .big-score {
            font-size: 4rem;
            font-weight: 900;
            color: #2f593a;
            line-height: 1;
            font-family: Georgia, serif;
          }

          .big-stars {
            font-size: 1.5rem;
            color: #ecc94b;
            margin: 10px 0 4px 0;
            letter-spacing: 2px;
          }

          .total-lbl {
            font-size: 0.85rem;
            color: #718096;
            font-weight: 600;
          }

          /* Distribution Card */
          .dist-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #1e3a29;
            margin: 0 0 16px 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .dist-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 0.85rem;
          }

          .dist-label {
            width: 40px;
            font-weight: 700;
            color: #4a5568;
            text-align: right;
          }

          .dist-bar-bg {
            flex-grow: 1;
            height: 8px;
            background: #edf2f7;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
          }

          .dist-bar-fill {
            height: 100%;
            border-radius: 4px;
            background: linear-gradient(90deg, #d4a94f, #ecc94b);
            transition: width 1s ease-in-out;
          }

          .dist-percent {
            width: 35px;
            text-align: right;
            font-weight: 700;
            color: #718096;
          }

          /* Interactive Graph Card */
          .trend-chart-card {
            display: flex;
            flex-direction: column;
          }

          .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .chart-body {
            flex-grow: 1;
            display: flex;
            align-items: flex-end;
            justify-content: space-around;
            height: 140px;
            padding-top: 15px;
            border-bottom: 2px solid #e2dcd0;
          }

          .chart-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 14%;
            height: 100%;
            justify-content: flex-end;
            position: relative;
            cursor: pointer;
          }

          .chart-bar-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            position: relative;
          }

          .chart-bar {
            width: 24px;
            background: linear-gradient(180deg, #38a169, #2f593a);
            border-radius: 6px 6px 0 0;
            transition: height 0.5s ease, opacity 0.2s ease;
            position: relative;
          }

          .chart-col:hover .chart-bar {
            opacity: 0.85;
            background: linear-gradient(180deg, #d4a94f, #2f593a);
          }

          .chart-tooltip {
            position: absolute;
            top: -24px;
            background: #1e3a29;
            color: #ffffff;
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
            pointer-events: none;
            opacity: 0;
            transform: translateY(4px);
            transition: all 0.2s ease;
            white-space: nowrap;
            z-index: 10;
          }

          .chart-col:hover .chart-tooltip {
            opacity: 1;
            transform: translateY(0);
          }

          .chart-lbl {
            font-size: 0.7rem;
            font-weight: 700;
            color: #718096;
            margin-top: 8px;
            text-align: center;
            width: 100%;
          }

          /* Filter Toolbar */
          .toolbar {
            background: #ffffff;
            border: 1px solid #e2dcd0;
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(47, 89, 58, 0.01);
          }

          .tab-group {
            display: flex;
            gap: 8px;
          }

          .tab-btn {
            background: transparent;
            border: 1px solid #e2dcd0;
            color: #4a5568;
            padding: 8px 16px;
            font-size: 0.85rem;
            font-weight: 700;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .tab-btn:hover {
            background: #f7fafc;
            border-color: #cbd5e0;
          }

          .tab-btn-active {
            background: #2f593a;
            border-color: #2f593a;
            color: #ffffff;
          }

          .tab-btn-active:hover {
            background: #1e3a29;
            color: #ffffff;
          }

          .filter-group {
            display: flex;
            gap: 12px;
          }

          .filter-select {
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid #e2dcd0;
            background: #ffffff;
            font-size: 0.85rem;
            color: #4a5568;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .filter-select:focus {
            border-color: #2f593a;
            box-shadow: 0 0 0 3px rgba(47, 89, 58, 0.1);
          }

          /* Review List */
          .reviews-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .review-card {
            background: #ffffff;
            border: 1px solid #e2dcd0;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(47, 89, 58, 0.01);
            animation: slideUp 0.4s ease-out;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          .review-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(47, 89, 58, 0.03);
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
          }

          .customer-profile {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .cust-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #e2dcd0;
          }

          .cust-name {
            font-weight: 700;
            font-size: 0.95rem;
            color: #1e3a29;
            margin: 0;
          }

          .review-date {
            font-size: 0.75rem;
            color: #a0aec0;
            margin: 2px 0 0 0;
          }

          .rating-badge-col {
            text-align: right;
          }

          .star-rating {
            font-size: 0.95rem;
            letter-spacing: 1px;
          }

          .gold-stars {
            color: #ecc94b;
          }

          .gray-stars {
            color: #cbd5e0;
          }

          .service-tag {
            display: inline-block;
            background: #f0fdf4;
            color: #2f593a;
            font-size: 0.7rem;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            margin-top: 4px;
            border: 1px solid #dcfce7;
          }

          .review-body {
            font-size: 0.9rem;
            line-height: 1.55;
            color: #4a5568;
            margin: 12px 0 0 0;
            padding-left: 2px;
          }

          /* Reply / Response View Box */
          .reply-container {
            margin-top: 14px;
            padding: 12px 16px;
            background: #faf8f5;
            border-left: 3px solid #d4a94f;
            border-radius: 0 12px 12px 0;
            font-size: 0.85rem;
          }

          .reply-header {
            font-weight: 700;
            color: #d4a94f;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .reply-content {
            color: #718096;
            margin: 0;
            line-height: 1.45;
          }

          .empty-state {
            text-align: center;
            padding: 60px 40px;
            background: #ffffff;
            border: 1px solid #e2dcd0;
            border-radius: 20px;
            color: #718096;
          }

          .empty-icon {
            font-size: 3rem;
            margin-bottom: 12px;
          }

          .empty-state h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1e3a29;
            margin: 0 0 6px 0;
          }

          .empty-state p {
            font-size: 0.85rem;
            margin: 0;
          }

          /* Loading Spinner */
          .loading-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 250px;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(47, 89, 58, 0.1);
            border-top-color: #2f593a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .review-photos-grid {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 12px;
          }

          .review-photo-link {
            border-radius: 12px;
            overflow: hidden;
            border: 1.5px solid #e2dcd0;
            transition: all 0.2s ease;
            display: block;
          }

          .review-photo-link:hover {
            transform: scale(1.05);
            border-color: #d4a94f;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
          }

          .review-photo-img {
            width: 80px;
            height: 80px;
            object-fit: cover;
            display: block;
          }
        `}</style>

        <header className="header-section">
          <div>
            <h1>Đánh giá khách hàng</h1>
            <p>
              Theo dõi chất lượng tay nghề và các ý kiến đóng góp từ khách hàng
              của bạn.
            </p>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          {/* Card 1: Score */}
          <section className="stat-card">
            <div className="avg-score-wrapper">
              <div className="big-score">
                {Number(summary.AvgRating || 0).toFixed(1)}
              </div>
              <div className="big-stars">
                {"★".repeat(Math.round(summary.AvgRating || 0))}
              </div>
              <div className="total-lbl">
                {summary.TotalCount} lượt đánh giá
              </div>
            </div>
          </section>

          {/* Card 2: Breakdown */}
          <section className="stat-card">
            <h4 className="dist-title">Phân bố xếp hạng</h4>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary[`Stars${stars}`] || 0;
              const pct = getPercentage(count);
              return (
                <div key={stars} className="dist-row">
                  <span className="dist-label">{stars} ★</span>
                  <div className="dist-bar-bg">
                    <div
                      className="dist-bar-fill"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <span className="dist-percent">{pct}%</span>
                </div>
              );
            })}
          </section>

          {/* Card 3: Monthly Trend Visual Graph */}
          <section className="stat-card trend-chart-card">
            <div className="chart-header">
              <h4 className="dist-title" style={{ margin: 0 }}>
                Xu hướng 6 tháng qua
              </h4>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  color: "#2f593a",
                }}
              >
                Rating TB theo tháng
              </span>
            </div>

            <div className="chart-body">
              {monthlyStats.length === 0 ? (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#a0aec0",
                    margin: "auto",
                  }}
                >
                  Chưa có dữ liệu xu hướng
                </div>
              ) : (
                monthlyStats.map((item, idx) => {
                  const barHeight = Math.min(
                    100,
                    Math.round((item.AvgRating / 5) * 100),
                  );
                  return (
                    <div key={idx} className="chart-col">
                      <div className="chart-tooltip">
                        ⭐ {Number(item.AvgRating).toFixed(1)} (
                        {item.ReviewCount} lượt)
                      </div>
                      <div className="chart-bar-wrapper">
                        <div
                          className="chart-bar"
                          style={{ height: `${barHeight}%` }}
                        ></div>
                      </div>
                      <div className="chart-lbl">T.{item.MonthVal}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Filters Toolbar */}
        <div className="toolbar">
          <div className="tab-group">
            <button
              className={`tab-btn ${activeTab === "all" ? "tab-btn-active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              Tất cả
            </button>
            <button
              className={`tab-btn ${activeTab === "positive" ? "tab-btn-active" : ""}`}
              onClick={() => setActiveTab("positive")}
            >
              Tích cực (4-5★)
            </button>
            <button
              className={`tab-btn ${activeTab === "critical" ? "tab-btn-active" : ""}`}
              onClick={() => setActiveTab("critical")}
            >
              Cần cải thiện (1-2★)
            </button>
          </div>

          <div className="filter-group">
            <select
              className="filter-select"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="">Lọc số sao: Tất cả</option>
              <option value="5">5 Sao ★★★★★</option>
              <option value="4">4 Sao ★★★★☆</option>
              <option value="3">3 Sao ★★★☆☆</option>
              <option value="2">2 Sao ★★☆☆☆</option>
              <option value="1">1 Sao ★☆☆☆☆</option>
            </select>

            <select
              className="filter-select"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="">Lọc dịch vụ: Tất cả</option>
              {services.map((s) => (
                <option key={s.ServiceId} value={s.ServiceId}>
                  {s.ServiceName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Feed */}
        {loading ? (
          <div className="loading-wrapper">
            <div className="spinner"></div>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>Không tìm thấy đánh giá nào</h3>
            <p>Không tìm thấy nhận xét nào tương ứng với bộ lọc của bạn.</p>
          </div>
        ) : (
          <div className="reviews-list">
            {filteredReviews.map((rev) => (
              <article key={rev.ReviewId} className="review-card">
                <div className="card-header">
                  <div className="customer-profile">
                    <img
                      className="cust-avatar"
                      src={getAvatarUrl(rev.CustomerAvatar)}
                      alt={rev.CustomerName}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div>
                      <h4 className="cust-name">{rev.CustomerName}</h4>
                      <p className="review-date">
                        {new Date(rev.CreatedAt).toLocaleDateString("vi-VN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="rating-badge-col">
                    {renderStars(rev.Rating)}
                    <div>
                      <span className="service-tag">
                        {rev.ServiceName || "Dịch vụ"}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="review-body">
                  &ldquo;
                  {rev.Comment ||
                    "Khách hàng không để lại nhận xét bằng lời, chỉ đánh giá xếp hạng."}
                  &rdquo;
                </p>

                {rev.Images && rev.Images.length > 0 && (
                  <div className="review-photos-grid">
                    {rev.Images.map((img) => (
                      <a
                        key={img.ReviewImageId}
                        href={resolveFileUrl(img.ImageUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="review-photo-link"
                      >
                        <img
                          src={resolveFileUrl(img.ImageUrl)}
                          alt="Customer Upload"
                          className="review-photo-img"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* If there is detailed technician rating score available, show it as subtext */}
                {rev.TechnicianRating && (
                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "0.75rem",
                      color: "#718096",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <span>
                      Tay nghề KTV: <b>{rev.TechnicianRating}/5 ★</b>
                    </span>
                  </div>
                )}

                {/* Mock Salon Manager Interaction Feedback to wowed the user */}
                {rev.Rating <= 3 && (
                  <div className="reply-container">
                    <div className="reply-header">
                      <span>✦ Phản hồi từ Quản lý chi nhánh:</span>
                    </div>
                    <p className="reply-content">
                      Cảm ơn bạn đã phản hồi về dịch vụ. Chúng tôi đã ghi nhận
                      phản ánh và sẽ phối hợp với KTV để nâng cao chất lượng
                      dịch vụ cho các lần tiếp theo.
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
