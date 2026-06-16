import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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
        err.response?.data?.message || "Không tải được danh sách đánh giá",
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
              <h1>Customer Review Tracking</h1>
              <p>
                Theo dõi đánh giá khách hàng, rating trung bình và review mới
                nhất.
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
            <p>Rating trung bình</p>
            <b>{displayAverage}/5</b>
          </div>

          <div className="rx-stat-card blue">
            <span>💬</span>
            <p>Số review</p>
            <b>{Number(summary.TotalReviews || 0)}</b>
          </div>

          <div className="rx-stat-card green">
            <span>😊</span>
            <p>Review tích cực</p>
            <b>{Number(summary.PositiveReviews || 0)}</b>
          </div>

          <div className="rx-stat-card red">
            <span>⚠️</span>
            <p>Review thấp</p>
            <b>{Number(summary.LowReviews || 0)}</b>
          </div>
        </div>

        {latest && (
          <section className="rx-table-card" style={{ marginBottom: 18 }}>
            <div className="rx-table-header">
              <div>
                <h2>Review mới nhất</h2>
                <p>Đánh giá gần đây nhất từ khách hàng</p>
              </div>
            </div>

            <div className="rx-review-latest">
              <img
                className="rx-mini-avatar"
                src={avatarUrl(latest.CustomerAvatarUrl)}
                alt={latest.CustomerName || "Customer"}
              />

              <div>
                <h3>{latest.CustomerName || "-"}</h3>
                <p>
                  <b>{latest.ServiceName || "-"}</b> •{" "}
                  {latest.TechnicianName || "Chưa có KTV"}
                </p>
                <div className="rx-stars">{stars(latest.Rating)}</div>
                <p>{latest.Comment || "Không có nội dung đánh giá"}</p>
                <small>{dateText(latest.CreatedAt)}</small>
              </div>
            </div>
          </section>
        )}

        <form className="rx-filter-card" onSubmit={submit}>
          <div className="rx-filter-grid">
            <label>
              <span>Tìm kiếm</span>
              <input
                placeholder="Tên khách, SĐT, email, dịch vụ, nội dung..."
                value={filters.keyword}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, keyword: e.target.value }))
                }
              />
            </label>

            <label>
              <span>Trạng thái</span>
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
              <span>Rating</span>
              <select
                value={filters.rating}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, rating: e.target.value }))
                }
              >
                <option value="">Tất cả rating</option>
                <option value="5">5 sao</option>
                <option value="4">4 sao</option>
                <option value="3">3 sao</option>
                <option value="2">2 sao</option>
                <option value="1">1 sao</option>
              </select>
            </label>

            <label>
              <span>Dịch vụ</span>
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
              <span>Kỹ thuật viên</span>
              <select
                value={filters.technicianId}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    technicianId: e.target.value,
                  }))
                }
              >
                <option value="">Tất cả KTV</option>
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
              ↺ Đặt lại
            </button>

            <button className="rx-primary-btn" type="submit" disabled={loading}>
              {loading ? "Đang lọc..." : "⌕ Lọc review"}
            </button>
          </div>
        </form>

        <section className="rx-table-card" style={{ marginBottom: 18 }}>
          <div className="rx-table-header">
            <div>
              <h2>Thống kê theo dịch vụ</h2>
              <p>Dịch vụ nào nhận nhiều review và rating tốt nhất</p>
            </div>
          </div>

          <div className="rx-service-review-grid">
            {(data.ServiceStats || []).map((s) => (
              <div className="rx-service-review-card" key={s.ServiceId}>
                <b>{s.ServiceName}</b>
                <span>{Number(s.ReviewCount || 0)} review</span>
                <strong>{Number(s.AverageRating || 0).toFixed(1)} ⭐</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="rx-table-card">
          <div className="rx-table-header">
            <div>
              <h2>Danh sách review</h2>
              <p>Hiển thị {reviews.length} đánh giá</p>
            </div>
          </div>

          <table className="rx-appointment-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Khách hàng</th>
                <th>Dịch vụ</th>
                <th>KTV</th>
                <th>Rating</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Liên kết</th>
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
                        src={avatarUrl(latest.CustomerAvatarUrl)}
                        alt={latest.CustomerName || "Customer"}
                      />
                      <div>
                        <b>{r.CustomerName || "-"}</b>
                        <small>{r.CustomerPhone || "-"}</small>
                        <small>{r.CustomerEmail || "-"}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <b>{r.ServiceName || "-"}</b>
                    <small>
                      {dateText(r.AppointmentDate)} {timeText(r.StartTime)}
                    </small>
                  </td>

                  <td>{r.TechnicianName || "-"}</td>

                  <td>
                    <div className="rx-stars">{stars(r.Rating)}</div>
                    <small>KTV: {stars(r.TechnicianRating)}</small>
                  </td>

                  <td>
                    <p className="rx-review-comment">
                      {r.Comment || "Không có nội dung"}
                    </p>
                  </td>

                  <td>
                    <span className={statusClass(r.Status)}>
                      {statusLabel(r.Status)}
                    </span>
                  </td>

                  <td>{dateText(r.CreatedAt)}</td>

                  <td>
                    <div className="rx-action-cell">
                      <Link
                        className="rx-icon-btn"
                        to={`/receptionist/customers/${r.CustomerId}`}
                        title="Xem khách hàng"
                      >
                        👤
                      </Link>

                      <Link
                        className="rx-icon-btn"
                        to={`/receptionist/appointments/${r.AppointmentId}`}
                        title="Xem lịch hẹn"
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
                    Chưa có review phù hợp
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="9" className="rx-empty">
                    Đang tải review...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReceptionistLayout>
  );
}
