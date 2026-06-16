import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

const emptyResponse = {
  AdminResponse: "",
  Status: "RESOLVED",
};

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("vi-VN");
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminFeedbacks() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
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

      const res = await axiosClient.get("/admin/feedbacks", {
        params: {
          keyword: filters.keyword || undefined,
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
          "Không tải được feedbacks",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((x) => x.Status === "PENDING").length,
      inProgress: items.filter((x) => x.Status === "IN_PROGRESS").length,
      resolved: items.filter((x) => x.Status === "RESOLVED").length,
    };
  }, [items]);

  function openResponse(item) {
    setResponseModal(item);
    setResponseForm({
      AdminResponse: item.AdminResponse || "",
      Status:
        item.Status === "PENDING" ? "RESOLVED" : item.Status || "RESOLVED",
    });
    setError("");
  }

  async function changeStatus(item, nextStatus) {
    if (
      !window.confirm(
        `Đổi trạng thái feedback #${item.FeedbackId} thành ${nextStatus}?`,
      )
    ) {
      return;
    }

    try {
      setError("");
      await axiosClient.patch(`/admin/feedbacks/${item.FeedbackId}/status`, {
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
        `/admin/feedbacks/${responseModal.FeedbackId}/respond`,
        {
          AdminResponse: responseForm.AdminResponse.trim(),
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
    if (
      !window.confirm(`Xóa phản hồi admin của feedback #${item.FeedbackId}?`)
    ) {
      return;
    }

    try {
      setError("");
      await axiosClient.patch(
        `/admin/feedbacks/${item.FeedbackId}/remove-response`,
      );
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa phản hồi thất bại",
      );
    }
  }

  return (
    <section className="admin-page admin-feedbacks-page">
      <div className="admin-feedbacks-hero">
        <div>
          <div className="admin-eyebrow">Feedbacks Management</div>
          <h1>Quản lý phản hồi khách hàng</h1>
          <p>
            Theo dõi feedback từ khách hàng, xử lý trạng thái và phản hồi chính
            thức từ admin.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={load}>
          Làm mới
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">💬</div>
          <div>
            <p>Tổng feedback</p>
            <h3>{stats.total}</h3>
            <span>Tất cả phản hồi</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Pending</p>
            <h3>{stats.pending}</h3>
            <span>Chờ xử lý</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🛠</div>
          <div>
            <p>In progress</p>
            <h3>{stats.inProgress}</h3>
            <span>Đang xử lý</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Resolved</p>
            <h3>{stats.resolved}</h3>
            <span>Đã phản hồi/xử lý</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-feedbacks-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm khách hàng, email, tiêu đề, nội dung..."
        />

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">PENDING</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CLOSED">CLOSED</option>
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
        <div className="admin-loading-card">Đang tải feedbacks...</div>
      ) : null}

      {!loading ? (
        <div className="admin-feedbacks-grid">
          {items.map((item) => (
            <article className="admin-feedback-card-v2" key={item.FeedbackId}>
              <div className="admin-feedback-top">
                <img
                  src={avatar(item.CustomerAvatar)}
                  alt={item.CustomerName}
                />

                <div>
                  <h3>{item.Subject || "No subject"}</h3>
                  <p>
                    {item.CustomerName || "Customer"} •{" "}
                    {item.CustomerEmail || "No email"}
                  </p>
                </div>

                <span className={statusClass(item.Status)}>{item.Status}</span>
              </div>

              <p className="admin-feedback-content">
                {item.Content || "Không có nội dung feedback."}
              </p>

              <div className="admin-feedback-info">
                <div>
                  <span>CustomerId</span>
                  <strong>
                    {item.CustomerId ? `#${item.CustomerId}` : "N/A"}
                  </strong>
                </div>
                <div>
                  <span>Membership</span>
                  <strong>{item.MembershipLevelName || "No"}</strong>
                </div>
                <div>
                  <span>Loyalty</span>
                  <strong>{item.LoyaltyPoints || 0}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{dateText(item.CreatedAt)}</strong>
                </div>
              </div>

              {item.AdminResponse ? (
                <div className="admin-feedback-response-box">
                  <strong>Admin response</strong>
                  <p>{item.AdminResponse}</p>
                </div>
              ) : null}

              <div className="admin-card-actions">
                <button className="card-btn" onClick={() => setSelected(item)}>
                  Chi tiết
                </button>

                <button
                  className="card-btn primary"
                  onClick={() => openResponse(item)}
                >
                  Phản hồi
                </button>

                {item.Status !== "IN_PROGRESS" ? (
                  <button
                    className="card-btn"
                    onClick={() => changeStatus(item, "IN_PROGRESS")}
                  >
                    Process
                  </button>
                ) : null}

                {item.Status !== "RESOLVED" ? (
                  <button
                    className="card-btn"
                    onClick={() => changeStatus(item, "RESOLVED")}
                  >
                    Resolve
                  </button>
                ) : null}

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
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có feedback phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-feedback-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="feedback-detail-banner">
              <img
                src={avatar(selected.CustomerAvatar)}
                alt={selected.CustomerName}
              />

              <div>
                <span>Feedback Detail</span>
                <h3>{selected.Subject}</h3>
                <strong>{selected.CustomerName || "Customer"}</strong>
              </div>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>FeedbackId:</strong> #{selected.FeedbackId}
              </p>
              <p>
                <strong>CustomerId:</strong> #{selected.CustomerId}
              </p>
              <p>
                <strong>Customer:</strong> {selected.CustomerName}
              </p>
              <p>
                <strong>Email:</strong> {selected.CustomerEmail}
              </p>
              <p>
                <strong>Phone:</strong> {selected.CustomerPhone || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {selected.Status}
              </p>
              <p>
                <strong>Membership:</strong>{" "}
                {selected.MembershipLevelName || "No"}
              </p>
              <p>
                <strong>Loyalty:</strong> {selected.LoyaltyPoints || 0}
              </p>
              <p>
                <strong>Created:</strong> {dateText(selected.CreatedAt)}
              </p>
              <p>
                <strong>Updated:</strong> {dateText(selected.UpdatedAt)}
              </p>
            </div>

            <div className="feedback-detail-text">
              <strong>Nội dung feedback</strong>
              <p>{selected.Content || "Không có nội dung."}</p>
            </div>

            <div className="feedback-detail-text">
              <strong>Admin response</strong>
              <p>{selected.AdminResponse || "Chưa có phản hồi."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {responseModal ? (
        <div className="modal-backdrop" onClick={() => setResponseModal(null)}>
          <form
            className="modal-card admin-feedback-response-form luxury-feedback-editor"
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

            <div className="feedback-editor-head">
              <div>
                <span>Feedback Response</span>
                <h3>Phản hồi feedback</h3>
                <p>
                  Nhập phản hồi chính thức cho khách hàng và cập nhật trạng thái
                  xử lý.
                </p>
              </div>

              <div className="feedback-preview-card">
                <img
                  src={avatar(responseModal.CustomerAvatar)}
                  alt={responseModal.CustomerName}
                />
                <strong>{responseModal.CustomerName || "Customer"}</strong>
                <span>{responseModal.Subject || "Feedback"}</span>
                <b>{responseForm.Status}</b>
              </div>
            </div>

            <div className="feedback-editor-layout">
              <div className="feedback-editor-main">
                <div className="feedback-section-title">
                  <span>01</span>
                  <div>
                    <h4>Feedback của khách</h4>
                    <p>Xem nội dung feedback trước khi phản hồi.</p>
                  </div>
                </div>

                <div className="feedback-original-box">
                  <strong>{responseModal.Subject}</strong>
                  <p>
                    {responseModal.Content || "Không có nội dung feedback."}
                  </p>
                  <small>
                    {responseModal.CustomerName} •{" "}
                    {dateText(responseModal.CreatedAt)}
                  </small>
                </div>

                <div className="feedback-section-title">
                  <span>02</span>
                  <div>
                    <h4>Phản hồi admin</h4>
                    <p>Nội dung này lưu vào AdminResponse.</p>
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
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="CLOSED">CLOSED</option>
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
                      placeholder="Cảm ơn bạn đã gửi phản hồi..."
                      required
                    />
                  </label>
                </div>
              </div>

              <aside className="feedback-editor-side">
                <h4>Tóm tắt</h4>

                <div className="feedback-summary-card">
                  <span>Customer</span>
                  <strong>{responseModal.CustomerName || "N/A"}</strong>
                </div>

                <div className="feedback-summary-card">
                  <span>Email</span>
                  <strong>{responseModal.CustomerEmail || "N/A"}</strong>
                </div>

                <div className="feedback-summary-card">
                  <span>Subject</span>
                  <strong>{responseModal.Subject || "N/A"}</strong>
                </div>

                <div className="feedback-summary-card">
                  <span>Current status</span>
                  <strong>{responseModal.Status}</strong>
                </div>

                <div className="feedback-summary-card">
                  <span>Next status</span>
                  <strong>{responseForm.Status}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions feedback-editor-actions">
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
