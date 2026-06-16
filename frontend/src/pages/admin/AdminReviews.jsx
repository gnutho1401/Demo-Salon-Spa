import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";
const DEFAULT_SERVICE = "/images/services/skincare.png";

const emptyResponse = {
  AdminResponse: "",
  Status: "APPROVED",
};

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function serviceImage(url) {
  return resolveFileUrl(url) || DEFAULT_SERVICE;
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("vi-VN");
}

function timeText(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function stars(value) {
  const n = Number(value || 0);
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

export default function AdminReviews() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    rating: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  const [selected, setSelected] = useState(null);
  const [responseModal, setResponseModal] = useState(null);
  const [responseForm, setResponseForm] = useState(emptyResponse);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await axiosClient.get("/admin/reviews", {
        params: {
          keyword: filters.keyword || undefined,
          rating: filters.rating || undefined,
          status: filters.status || undefined,
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được reviews",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((x) => x.Status === "PENDING").length;
    const approved = items.filter((x) => x.Status === "APPROVED").length;
    const rejected = items.filter((x) => x.Status === "REJECTED").length;
    const avg =
      total > 0
        ? items.reduce((sum, x) => sum + Number(x.Rating || 0), 0) / total
        : 0;

    return { total, pending, approved, rejected, avg };
  }, [items]);

  function openResponse(item) {
    setResponseModal(item);
    setResponseForm({
      AdminResponse: item.AdminResponse || "",
      Status: item.Status || "APPROVED",
    });
    setError("");
  }

  async function changeStatus(item, nextStatus) {
    if (
      !window.confirm(
        `Đổi trạng thái review #${item.ReviewId} thành ${nextStatus}?`,
      )
    ) {
      return;
    }

    try {
      setError("");
      await axiosClient.patch(`/admin/reviews/${item.ReviewId}/status`, {
        Status: nextStatus,
      });
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function submitResponse(e) {
    e.preventDefault();

    if (!responseModal) return;

    try {
      if (!responseForm.AdminResponse.trim()) {
        throw new Error("Vui lòng nhập phản hồi admin");
      }

      setSaving(true);
      setError("");

      await axiosClient.patch(
        `/admin/reviews/${responseModal.ReviewId}/respond`,
        {
          AdminResponse: responseForm.AdminResponse.trim(),
        },
      );

      await axiosClient.patch(
        `/admin/reviews/${responseModal.ReviewId}/status`,
        {
          Status: responseForm.Status,
        },
      );

      setResponseModal(null);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu phản hồi thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeResponse(item) {
    if (!window.confirm(`Xóa phản hồi admin của review #${item.ReviewId}?`))
      return;

    try {
      setError("");
      await axiosClient.patch(
        `/admin/reviews/${item.ReviewId}/remove-response`,
      );
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa phản hồi thất bại",
      );
    }
  }

  return (
    <section className="admin-page admin-reviews-page">
      <div className="admin-reviews-hero">
        <div>
          <div className="admin-eyebrow">Reviews Management</div>
          <h1>Quản lý đánh giá</h1>
          <p>
            Theo dõi review khách hàng, rating dịch vụ, rating kỹ thuật viên,
            phản hồi admin và trạng thái hiển thị.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={load}>
          Làm mới
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">⭐</div>
          <div>
            <p>Tổng review</p>
            <h3>{stats.total}</h3>
            <span>Tất cả đánh giá</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Chờ duyệt</p>
            <h3>{stats.pending}</h3>
            <span>Status PENDING</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Approved</p>
            <h3>{stats.approved}</h3>
            <span>Đang được hiển thị</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">★</div>
          <div>
            <p>Rating trung bình</p>
            <h3>{stats.avg.toFixed(1)}</h3>
            <span>Trung bình theo bộ lọc</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-reviews-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm khách hàng, dịch vụ, technician, comment..."
        />

        <select
          value={filters.rating}
          onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
        >
          <option value="">Tất cả rating</option>
          <option value="5">5 sao</option>
          <option value="4">4 sao</option>
          <option value="3">3 sao</option>
          <option value="2">2 sao</option>
          <option value="1">1 sao</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="HIDDEN">HIDDEN</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        />

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button
          className="card-btn"
          onClick={() =>
            setFilters({
              keyword: "",
              rating: "",
              status: "",
              fromDate: "",
              toDate: "",
            })
          }
        >
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải reviews...</div>
      ) : null}

      {!loading ? (
        <div className="admin-reviews-grid">
          {items.map((item) => (
            <article className="admin-review-admin-card" key={item.ReviewId}>
              <div className="admin-review-cover">
                <img
                  src={serviceImage(item.ServiceImage)}
                  alt={item.ServiceName}
                />
                <span className={statusClass(item.Status)}>{item.Status}</span>
              </div>

              <div className="admin-review-content">
                <div className="admin-review-user">
                  <img
                    src={avatar(item.CustomerAvatar)}
                    alt={item.CustomerName}
                  />
                  <div>
                    <h3>{item.CustomerName || "Customer"}</h3>
                    <p>{item.CustomerEmail || "No email"}</p>
                  </div>
                </div>

                <div className="admin-review-stars">
                  <strong>{stars(item.Rating)}</strong>
                  <span>{Number(item.Rating || 0)}/5 service</span>
                </div>

                <p className="admin-review-comment">
                  {item.Comment || "Không có nội dung review."}
                </p>

                <div className="admin-review-info">
                  <div>
                    <span>Dịch vụ</span>
                    <strong>{item.ServiceName || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Technician</span>
                    <strong>{item.EmployeeName || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Tech rating</span>
                    <strong>{Number(item.TechnicianRating || 0)}/5</strong>
                  </div>
                  <div>
                    <span>Ngày hẹn</span>
                    <strong>
                      {item.AppointmentDate
                        ? `${new Date(item.AppointmentDate).toLocaleDateString(
                            "vi-VN",
                          )} ${timeText(item.StartTime)}`
                        : "N/A"}
                    </strong>
                  </div>
                </div>

                {item.AdminResponse ? (
                  <div className="admin-response-box">
                    <strong>Admin response</strong>
                    <p>{item.AdminResponse}</p>
                  </div>
                ) : null}

                <div className="admin-card-actions">
                  <button
                    className="card-btn"
                    onClick={() => setSelected(item)}
                  >
                    Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openResponse(item)}
                  >
                    Phản hồi
                  </button>

                  {item.Status !== "APPROVED" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "APPROVED")}
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "HIDDEN")}
                    >
                      Hide
                    </button>
                  )}

                  <button
                    className="card-btn danger"
                    onClick={() => changeStatus(item, "REJECTED")}
                  >
                    Reject
                  </button>

                  {item.AdminResponse ? (
                    <button
                      className="card-btn"
                      onClick={() => removeResponse(item)}
                    >
                      Xóa response
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có review phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-review-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="review-detail-banner">
              <img
                src={serviceImage(selected.ServiceImage)}
                alt={selected.ServiceName}
              />
              <div>
                <span>Review Detail</span>
                <h3>{selected.ServiceName}</h3>
                <strong>{stars(selected.Rating)}</strong>
              </div>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>ReviewId:</strong> #{selected.ReviewId}
              </p>
              <p>
                <strong>AppointmentId:</strong> #{selected.AppointmentId}
              </p>
              <p>
                <strong>Customer:</strong> {selected.CustomerName}
              </p>
              <p>
                <strong>Email:</strong> {selected.CustomerEmail}
              </p>
              <p>
                <strong>Service:</strong> {selected.ServiceName}
              </p>
              <p>
                <strong>Technician:</strong> {selected.EmployeeName || "N/A"}
              </p>
              <p>
                <strong>Service rating:</strong> {selected.Rating}/5
              </p>
              <p>
                <strong>Technician rating:</strong>{" "}
                {selected.TechnicianRating || 0}/5
              </p>
              <p>
                <strong>Status:</strong> {selected.Status}
              </p>
              <p>
                <strong>Appointment status:</strong>{" "}
                {selected.AppointmentStatus}
              </p>
              <p>
                <strong>Created:</strong> {dateText(selected.CreatedAt)}
              </p>
              <p>
                <strong>Updated:</strong> {dateText(selected.UpdatedAt)}
              </p>
            </div>

            <div className="review-detail-text">
              <strong>Comment</strong>
              <p>{selected.Comment || "Không có nội dung."}</p>
            </div>

            <div className="review-detail-text">
              <strong>Admin response</strong>
              <p>{selected.AdminResponse || "Chưa có phản hồi."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {responseModal ? (
        <div className="modal-backdrop" onClick={() => setResponseModal(null)}>
          <form
            className="modal-card admin-review-response-form luxury-review-editor"
            onSubmit={submitResponse}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setResponseModal(null)}
            >
              ×
            </button>

            <div className="review-editor-head">
              <div>
                <span>Review Response</span>
                <h3>Phản hồi review</h3>
                <p>
                  Duyệt trạng thái review và nhập phản hồi chính thức từ admin.
                </p>
              </div>

              <div className="review-preview-card">
                <img
                  src={avatar(responseModal.CustomerAvatar)}
                  alt={responseModal.CustomerName}
                />
                <strong>{responseModal.CustomerName || "Customer"}</strong>
                <span>{stars(responseModal.Rating)}</span>
                <b>{responseForm.Status}</b>
              </div>
            </div>

            <div className="review-editor-layout">
              <div className="review-editor-main">
                <div className="review-section-title">
                  <span>01</span>
                  <div>
                    <h4>Review của khách</h4>
                    <p>Xem lại nội dung trước khi phản hồi.</p>
                  </div>
                </div>

                <div className="review-original-box">
                  <strong>{responseModal.ServiceName}</strong>
                  <p>{responseModal.Comment || "Không có nội dung review."}</p>
                  <small>
                    {responseModal.CustomerName} •{" "}
                    {dateText(responseModal.CreatedAt)}
                  </small>
                </div>

                <div className="review-section-title">
                  <span>02</span>
                  <div>
                    <h4>Phản hồi admin</h4>
                    <p>Nội dung này sẽ lưu vào AdminResponse.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Trạng thái sau phản hồi
                    <select
                      value={responseForm.Status}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          Status: e.target.value,
                        })
                      }
                    >
                      <option value="APPROVED">APPROVED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="HIDDEN">HIDDEN</option>
                    </select>
                  </label>

                  <label className="admin-form-wide">
                    Admin response *
                    <textarea
                      rows={6}
                      value={responseForm.AdminResponse}
                      onChange={(e) =>
                        setResponseForm({
                          ...responseForm,
                          AdminResponse: e.target.value,
                        })
                      }
                      placeholder="Cảm ơn bạn đã đánh giá dịch vụ..."
                      required
                    />
                  </label>
                </div>
              </div>

              <aside className="review-editor-side">
                <h4>Tóm tắt</h4>

                <div className="review-summary-card">
                  <span>Customer</span>
                  <strong>{responseModal.CustomerName || "N/A"}</strong>
                </div>

                <div className="review-summary-card">
                  <span>Service</span>
                  <strong>{responseModal.ServiceName || "N/A"}</strong>
                </div>

                <div className="review-summary-card">
                  <span>Technician</span>
                  <strong>{responseModal.EmployeeName || "N/A"}</strong>
                </div>

                <div className="review-summary-card">
                  <span>Rating</span>
                  <strong>{responseModal.Rating}/5</strong>
                </div>

                <div className="review-summary-card">
                  <span>Status</span>
                  <strong>{responseForm.Status}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions review-editor-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setResponseModal(null)}
              >
                Hủy
              </button>

              <button
                className="card-btn primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu phản hồi"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
