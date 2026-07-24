import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function dateText(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function timeText(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function stars(value) {
  const n = Number(value || 0);
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

function getRatingDesc(rating) {
  const score = Number(rating || 0);
  if (score >= 5) return "Tuyệt vời (5/5)";
  if (score >= 4) return "Rất tốt (4/5)";
  if (score >= 3) return "Bình thường (3/5)";
  if (score >= 2) return "Kém (2/5)";
  return "Rất kém (1/5)";
}

function statusLabel(status) {
  const map = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    HIDDEN: "Đã ẩn",
  };

  return map[status] || status || "-";
}

function statusClass(status) {
  return `rx-badge status-${String(status || "").toLowerCase()}`;
}

export default function ReceptionistReviews() {
  const [data, setData] = useState({
    Summary: {},
    LatestReview: null,
    ServiceStats: [],
    Reviews: [],
  });

  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    rating: "",
    serviceId: "",
    technicianId: "",
    dateFrom: "",
    dateTo: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);

  async function load(nextFilters = filters) {
    try {
      setLoading(true);
      setError("");

      const params = {
        keyword: nextFilters.keyword || undefined,
        status: nextFilters.status || undefined,
        rating: nextFilters.rating || undefined,
        serviceId: nextFilters.serviceId || undefined,
        technicianId: nextFilters.technicianId || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
      };

      const res = await axiosClient.get("/receptionist/reviews", { params });
      const payload = res.data.data || res.data || {};

      setData({
        Summary: payload.Summary || {},
        LatestReview: payload.LatestReview || null,
        ServiceStats: payload.ServiceStats || [],
        Reviews: payload.Reviews || [],
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không tải được danh sách đánh giá từ hệ thống",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDropdowns() {
    try {
      const [serviceRes, techRes] = await Promise.all([
        axiosClient.get("/receptionist/services"),
        axiosClient.get("/receptionist/technicians"),
      ]);

      setServices(serviceRes.data.data || serviceRes.data || []);
      setTechnicians(techRes.data.data || techRes.data || []);
    } catch {
      setServices([]);
      setTechnicians([]);
    }
  }

  useEffect(() => {
    load();
    loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = data.Summary || {};
  const latest = data.LatestReview;
  const reviews = data.Reviews || [];

  const displayAverage = useMemo(() => {
    return Number(summary.AverageRating || 0).toFixed(1);
  }, [summary.AverageRating]);

  function submit(e) {
    e.preventDefault();
    load(filters);
  }

  function resetFilters() {
    const reset = {
      keyword: "",
      status: "",
      rating: "",
      serviceId: "",
      technicianId: "",
      dateFrom: "",
      dateTo: "",
    };

    setFilters(reset);
    load(reset);
  }

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">⭐</div>
            <div>
              <h1 style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>
                Theo dõi Đánh giá Khách hàng
              </h1>
              <p>
                Quản lý phản hồi khách hàng, điểm đánh giá trung bình và các
                nhận xét mới nhất.
              </p>
            </div>
          </div>

          <div className="rx-header-actions">
            <Link className="rx-light-btn" to="/receptionist/customers">
              👥 Khách hàng
            </Link>
            <Link className="rx-primary-btn" to="/receptionist/appointments">
              📅 Lịch hẹn
            </Link>
          </div>
        </div>

        {error && <div className="rx-error">{error}</div>}

        <div className="rx-stat-grid">
          <div className="rx-stat-card pink">
            <span>⭐</span>
            <div>
              <p>Rating trung bình</p>
              <b>{displayAverage}/5</b>
            </div>
          </div>

          <div className="rx-stat-card blue">
            <span>💬</span>
            <div>
              <p>Tổng số đánh giá</p>
              <b>{Number(summary.TotalReviews || 0)}</b>
            </div>
          </div>

          <div className="rx-stat-card green">
            <span>😊</span>
            <div>
              <p>Đánh giá tích cực</p>
              <b>{Number(summary.PositiveReviews || 0)}</b>
            </div>
          </div>

          <div className="rx-stat-card red">
            <span>⚠️</span>
            <div>
              <p>Đánh giá tiêu cực</p>
              <b>{Number(summary.LowReviews || 0)}</b>
            </div>
          </div>
        </div>

        {latest && (
          <section className="rx-table-card" style={{ marginBottom: 24 }}>
            <div className="rx-table-header">
              <div>
                <h2
                  style={{ fontFamily: "var(--font-heading), Georgia, serif" }}
                >
                  Nhận xét mới nhất hôm nay
                </h2>
                <p>Đánh giá gần đây nhất vừa được gửi từ khách hàng</p>
              </div>
            </div>

            <div className="rx-review-latest">
              <img
                className="rx-mini-avatar"
                src={avatarUrl(latest.CustomerAvatarUrl)}
                alt={latest.CustomerName || "Khách hàng"}
              />

              <div>
                <h3>{latest.CustomerName || "-"}</h3>
                <p
                  style={{
                    margin: "4px 0",
                    fontSize: "13px",
                    color: "#8c7b74",
                  }}
                >
                  Dịch vụ: <b>{latest.ServiceName || "-"}</b> • KTV thực hiện:{" "}
                  <b>{latest.TechnicianName || "Chưa có KTV"}</b>
                </p>
                <div className="rx-stars" style={{ margin: "6px 0" }}>
                  {stars(latest.Rating)}
                </div>
                <p
                  style={{
                    fontStyle: "italic",
                    color: "#3d2e26",
                    fontSize: "15px",
                  }}
                >
                  "{latest.Comment || "Không có nội dung đánh giá"}"
                </p>
                {latest.Images && latest.Images.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      margin: "12px 0",
                    }}
                  >
                    {latest.Images.map((img) => (
                      <a
                        key={img.ReviewImageId}
                        href={resolveFileUrl(img.ImageUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={resolveFileUrl(img.ImageUrl)}
                          alt="Latest Review Attachment"
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "1px solid rgba(184, 154, 94, 0.15)",
                            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                )}
                <small style={{ display: "block", marginTop: "6px" }}>
                  Thời gian gửi: {dateText(latest.CreatedAt)}
                </small>
              </div>
            </div>
          </section>
        )}

        <form className="rx-filter-card" onSubmit={submit}>
          <div className="rx-filter-grid">
            <label>
              <span>Tìm kiếm</span>
              <input
                placeholder="Tên khách, SĐT, email, dịch vụ..."
                value={filters.keyword}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, keyword: e.target.value }))
                }
              />
            </label>

            <label>
              <span>Trạng thái duyệt</span>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="HIDDEN">Đã ẩn</option>
              </select>
            </label>

            <label>
              <span>Số sao đánh giá</span>
              <select
                value={filters.rating}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, rating: e.target.value }))
                }
              >
                <option value="">Tất cả số sao</option>
                <option value="5">5 sao ⭐⭐⭐⭐⭐</option>
                <option value="4">4 sao ⭐⭐⭐⭐</option>
                <option value="3">3 sao ⭐⭐⭐</option>
                <option value="2">2 sao ⭐⭐</option>
                <option value="1">1 sao ⭐</option>
              </select>
            </label>

            <label>
              <span>Dịch vụ liên quan</span>
              <select
                value={filters.serviceId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, serviceId: e.target.value }))
                }
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map((s) => (
                  <option key={s.ServiceId} value={s.ServiceId}>
                    {s.ServiceName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Kỹ thuật viên thực hiện</span>
              <select
                value={filters.technicianId}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    technicianId: e.target.value,
                  }))
                }
              >
                <option value="">Tất cả kỹ thuật viên</option>
                {technicians.map((t) => {
                  const id = t.TechnicianId || t.EmployeeId;
                  return (
                    <option key={id} value={id}>
                      {t.FullName || t.TechnicianName}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              <span>Từ ngày</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateFrom: e.target.value }))
                }
              />
            </label>

            <label>
              <span>Đến ngày</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateTo: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="rx-filter-actions">
            <button
              className="rx-outline-pink-btn"
              type="button"
              onClick={resetFilters}
            >
              ↺ Đặt lại bộ lọc
            </button>

            <button className="rx-primary-btn" type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "⌕ Tìm kiếm ngay"}
            </button>
          </div>
        </form>

        <section className="rx-table-card" style={{ marginBottom: 24 }}>
          <div className="rx-table-header">
            <div>
              <h2 style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>
                Thống kê theo dịch vụ thực tế
              </h2>
              <p>
                Thống kê số lượng đánh giá và điểm trung bình cho từng dịch vụ
              </p>
            </div>
          </div>

          <div className="rx-service-review-grid">
            {(data.ServiceStats || []).map((s) => {
              const isActive =
                String(filters.serviceId) === String(s.ServiceId);
              return (
                <div
                  className={`rx-service-review-card ${isActive ? "active" : ""}`}
                  key={s.ServiceId}
                  onClick={() => {
                    const nextServiceId = isActive ? "" : String(s.ServiceId);
                    const nextFilters = {
                      ...filters,
                      serviceId: nextServiceId,
                    };
                    setFilters(nextFilters);
                    load(nextFilters);
                  }}
                >
                  <b>{s.ServiceName}</b>
                  <span>Có {Number(s.ReviewCount || 0)} lượt đánh giá</span>
                  <strong>
                    Trung bình: {Number(s.AverageRating || 0).toFixed(1)} ⭐
                  </strong>
                </div>
              );
            })}
          </div>
        </section>

        <div className="rx-table-card">
          <div className="rx-table-header">
            <div>
              <h2 style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>
                Danh sách tất cả đánh giá
              </h2>
              <p>Hiển thị chi tiết {reviews.length} đánh giá khách hàng</p>
            </div>
          </div>

          <table className="rx-appointment-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>ID</th>
                <th>Khách hàng</th>
                <th>Thông tin dịch vụ</th>
                <th>Kỹ thuật viên</th>
                <th>Điểm đánh giá (Rating)</th>
                <th>Nội dung nhận xét</th>
                <th>Trạng thái</th>
                <th>Ngày đánh giá</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {reviews.map((r) => (
                <tr key={r.ReviewId}>
                  <td>#{r.ReviewId}</td>

                  <td>
                    <div className="rx-customer-cell">
                      <img
                        className="rx-mini-avatar"
                        src={avatarUrl(r.CustomerAvatarUrl)}
                        alt={r.CustomerName || "Khách hàng"}
                      />
                      <div>
                        <b>{r.CustomerName || "-"}</b>
                        <small>{r.CustomerPhone || "-"}</small>
                        <small style={{ color: "#a89a85" }}>
                          {r.CustomerEmail || "-"}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <b>{r.ServiceName || "-"}</b>
                    <small
                      style={{
                        display: "block",
                        color: "#7b7264",
                        marginTop: "2px",
                      }}
                    >
                      Ngày hẹn: {dateText(r.AppointmentDate)}{" "}
                      {timeText(r.StartTime)}
                    </small>
                  </td>

                  <td>{r.TechnicianName || "-"}</td>

                  <td>
                    <div className="rx-stars">{stars(r.Rating)}</div>
                    <small
                      style={{
                        display: "block",
                        color: "#a89a85",
                        marginTop: "2px",
                      }}
                    >
                      KTV: {stars(r.TechnicianRating)}
                    </small>
                  </td>

                  <td>
                    <p
                      className="rx-review-comment"
                      title={r.Comment}
                      style={{
                        marginBottom:
                          r.Images && r.Images.length > 0 ? "6px" : "0",
                      }}
                    >
                      {r.Comment || "Không có nội dung nhận xét."}
                    </p>
                    {r.Images && r.Images.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                          marginTop: "6px",
                        }}
                      >
                        {r.Images.map((img) => (
                          <a
                            key={img.ReviewImageId}
                            href={resolveFileUrl(img.ImageUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <img
                              src={resolveFileUrl(img.ImageUrl)}
                              alt="Attachment"
                              style={{
                                width: "32px",
                                height: "32px",
                                objectFit: "cover",
                                borderRadius: "6px",
                                border: "1px solid rgba(184, 154, 94, 0.15)",
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>

                  <td>
                    <span className={statusClass(r.Status)}>
                      {statusLabel(r.Status)}
                    </span>
                  </td>

                  <td>{dateText(r.CreatedAt)}</td>

                  <td>
                    <div className="rx-action-cell">
                      <button
                        className="rx-icon-btn"
                        onClick={() => setSelectedReview(r)}
                        title="Xem chi tiết nhận xét"
                        type="button"
                        style={{ cursor: "pointer" }}
                      >
                        👁️
                      </button>

                      <Link
                        className="rx-icon-btn"
                        to={`/receptionist/customers/${r.CustomerId}`}
                        title="Xem thông tin chi tiết khách hàng"
                      >
                        👤
                      </Link>

                      <Link
                        className="rx-icon-btn"
                        to={`/receptionist/appointments/${r.AppointmentId}`}
                        title="Xem lịch hẹn chi tiết"
                      >
                        📅
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && reviews.length === 0 && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Hiện chưa có đánh giá nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Đang tải dữ liệu đánh giá từ hệ thống...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedReview && (
          <div
            className="rx-modal-backdrop"
            onClick={() => setSelectedReview(null)}
          >
            <div
              className="rx-modal rx-review-detail-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="rx-modal-close-btn"
                onClick={() => setSelectedReview(null)}
                type="button"
              >
                &times;
              </button>

              <h3
                style={{
                  fontFamily: "var(--font-heading), Georgia, serif",
                  marginBottom: "8px",
                }}
              >
                Chi tiết đánh giá khách hàng #{selectedReview.ReviewId}
              </h3>
              <p
                style={{
                  color: "#7b7264",
                  fontSize: "13px",
                  marginBottom: "20px",
                }}
              >
                Gửi vào lúc{" "}
                {new Date(selectedReview.CreatedAt).toLocaleString("vi-VN")}
              </p>

              <div className="rx-review-stars-section">
                <div className="stars-display" style={{ color: "#b8860b" }}>
                  {stars(selectedReview.Rating)}
                </div>
                <div className="rating-desc">
                  {getRatingDesc(selectedReview.Rating)}
                </div>
              </div>

              <div className="rx-review-quote">
                <p>
                  "
                  {selectedReview.Comment ||
                    "Khách hàng không để lại nhận xét bằng văn bản."}
                  "
                </p>
              </div>

              {selectedReview.Images && selectedReview.Images.length > 0 && (
                <div
                  className="rx-review-images"
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "24px",
                  }}
                >
                  {selectedReview.Images.map((img) => (
                    <a
                      key={img.ReviewImageId}
                      href={resolveFileUrl(img.ImageUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rx-review-image-link"
                    >
                      <img
                        src={resolveFileUrl(img.ImageUrl)}
                        alt="Review Attachment"
                        style={{
                          width: "80px",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "12px",
                          border: "1px solid rgba(184, 154, 94, 0.2)",
                          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.05)",
                          transition: "transform 0.2s ease",
                          cursor: "zoom-in",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.transform = "scale(1.05)")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.transform = "scale(1)")
                        }
                      />
                    </a>
                  ))}
                </div>
              )}

              <div className="rx-detail-grid-modal">
                <div className="rx-detail-col">
                  <h4>👤 Thông tin khách hàng</h4>
                  <div
                    className="rx-user-cell"
                    style={{ marginBottom: "14px" }}
                  >
                    <img
                      className="rx-mini-avatar"
                      src={avatarUrl(selectedReview.CustomerAvatarUrl)}
                      alt={selectedReview.CustomerName}
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                      }}
                    />
                    <div>
                      <b style={{ fontSize: "14px" }}>
                        {selectedReview.CustomerName}
                      </b>
                      <small style={{ display: "block", color: "#7b7264" }}>
                        Mã KH: #{selectedReview.CustomerId}
                      </small>
                    </div>
                  </div>
                  <div className="rx-detail-item">
                    <span>Số điện thoại:</span>
                    <b>{selectedReview.CustomerPhone || "-"}</b>
                  </div>
                  <div className="rx-detail-item">
                    <span>Địa chỉ Email:</span>
                    <b style={{ fontSize: "12px" }}>
                      {selectedReview.CustomerEmail || "-"}
                    </b>
                  </div>
                  <div style={{ marginTop: "16px", textAlign: "right" }}>
                    <Link
                      className="rx-light-btn"
                      style={{
                        height: "36px",
                        padding: "0 14px",
                        fontSize: "12px",
                      }}
                      to={`/receptionist/customers/${selectedReview.CustomerId}`}
                      onClick={() => setSelectedReview(null)}
                    >
                      Xem hồ sơ đầy đủ
                    </Link>
                  </div>
                </div>

                <div className="rx-detail-col">
                  <h4>📅 Chi tiết lịch hẹn & Dịch vụ</h4>
                  <div className="rx-detail-item">
                    <span>Dịch vụ sử dụng:</span>
                    <b>{selectedReview.ServiceName || "-"}</b>
                  </div>
                  <div className="rx-detail-item">
                    <span>Kỹ thuật viên thực hiện:</span>
                    <b>{selectedReview.TechnicianName || "-"}</b>
                  </div>
                  <div className="rx-detail-item">
                    <span>Điểm KTV nhận được:</span>
                    <b style={{ color: "#b57a13" }}>
                      {stars(selectedReview.TechnicianRating)} (
                      {selectedReview.TechnicianRating}/5)
                    </b>
                  </div>
                  <div className="rx-detail-item">
                    <span>Ngày thực hiện hẹn:</span>
                    <b>{dateText(selectedReview.AppointmentDate)}</b>
                  </div>
                  <div className="rx-detail-item">
                    <span>Trạng thái hiển thị:</span>
                    <span className={statusClass(selectedReview.Status)}>
                      {statusLabel(selectedReview.Status)}
                    </span>
                  </div>
                  <div style={{ marginTop: "16px", textAlign: "right" }}>
                    <Link
                      className="rx-light-btn"
                      style={{
                        height: "36px",
                        padding: "0 14px",
                        fontSize: "12px",
                      }}
                      to={`/receptionist/appointments/${selectedReview.AppointmentId}`}
                      onClick={() => setSelectedReview(null)}
                    >
                      Xem lịch hẹn chi tiết
                    </Link>
                  </div>
                </div>
              </div>

              {selectedReview.AdminResponse ? (
                <div className="rx-review-response">
                  <h4>💬 Phản hồi từ Salon</h4>
                  <p>{selectedReview.AdminResponse}</p>
                </div>
              ) : (
                <div
                  className="rx-review-response"
                  style={{ background: "#faf8f5", borderColor: "#eadbc8" }}
                >
                  <h4 style={{ color: "#8b735f" }}>💬 Phản hồi từ Salon</h4>
                  <p style={{ color: "#8a7563", fontStyle: "italic" }}>
                    Chưa có phản hồi chính thức cho đánh giá này.
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "12px",
                }}
              >
                <button
                  className="rx-primary-btn"
                  onClick={() => setSelectedReview(null)}
                  type="button"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
