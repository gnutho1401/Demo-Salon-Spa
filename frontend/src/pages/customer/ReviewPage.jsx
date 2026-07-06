import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function imageUrl(value) {
  if (!value) return "";
  if (String(value).startsWith("http")) return value;
  return resolveFileUrl(value);
}

function renderNewStars(value, onChange) {
  const rating = Number(value || 0);

  return (
    <div className="rev-stars-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={`rev-star-btn ${star <= rating ? "active" : ""}`}
          onClick={() => onChange?.(star)}
        >
          <svg className="rev-star-svg" viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function renderStarsDisplay(value) {
  const rating = Number(value || 0);
  return (
    <span className="rev-score-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} style={{ color: star <= rating ? "var(--rev-star-active)" : "#e5dada", marginRight: "2px" }}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewPage() {
  const [searchParams] = useSearchParams();

  const [reviews, setReviews] = useState([]);
  const [reviewableServices, setReviewableServices] = useState([]);

  const [form, setForm] = useState({
    appointmentId: "",
    serviceId: "",
    serviceRating: 5,
    technicianRating: 5,
    comment: "",
  });

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [keyword, setKeyword] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Lightbox Image Zoomer state
  const [lightbox, setLightbox] = useState({
    isOpen: false,
    images: [],
    index: 0,
  });

  const openLightbox = (images, index) => {
    setLightbox({
      isOpen: true,
      images: images || [],
      index: index || 0,
    });
  };

  const closeLightbox = () => {
    setLightbox({
      isOpen: false,
      images: [],
      index: 0,
    });
  };

  const nextLightboxImage = () => {
    if (lightbox.images.length === 0) return;
    setLightbox((prev) => ({
      ...prev,
      index: (prev.index + 1) % prev.images.length,
    }));
  };

  const prevLightboxImage = () => {
    if (lightbox.images.length === 0) return;
    setLightbox((prev) => ({
      ...prev,
      index: (prev.index - 1 + prev.images.length) % prev.images.length,
    }));
  };

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [reviewRes, reviewableRes] = await Promise.all([
        axiosClient.get("/customers/me/reviews"),
        axiosClient.get("/customers/me/reviewable-services"),
      ]);

      const reviewItems = reviewRes.data?.data || reviewRes.data || [];
      const reviewableItems =
        reviewableRes.data?.data || reviewableRes.data || [];

      setReviews(reviewItems);
      setReviewableServices(reviewableItems);

      const appointmentId = searchParams.get("appointmentId");
      const serviceId = searchParams.get("serviceId");

      if (appointmentId) {
        const matched =
          reviewableItems.find(
            (item) =>
              String(item.AppointmentId) === String(appointmentId) &&
              (!serviceId || String(item.ServiceId) === String(serviceId)),
          ) || null;

        if (matched) {
          setForm((prev) => ({
            ...prev,
            appointmentId: String(matched.AppointmentId),
            serviceId: String(matched.ServiceId),
          }));
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được dữ liệu đánh giá.",
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const selectedService = useMemo(() => {
    return reviewableServices.find(
      (item) =>
        String(item.AppointmentId) === String(form.appointmentId) &&
        String(item.ServiceId) === String(form.serviceId),
    );
  }, [reviewableServices, form.appointmentId, form.serviceId]);

  const groupedReviewable = useMemo(() => {
    const map = new Map();

    reviewableServices.forEach((item) => {
      if (!map.has(item.AppointmentId)) {
        map.set(item.AppointmentId, []);
      }

      map.get(item.AppointmentId).push(item);
    });

    return Array.from(map.entries());
  }, [reviewableServices]);

  const summary = useMemo(() => {
    const total = reviews.length;
    const avgService =
      total === 0
        ? 0
        : reviews.reduce((sum, item) => sum + Number(item.Rating || 0), 0) /
          total;

    const avgTech =
      total === 0
        ? 0
        : reviews.reduce(
            (sum, item) =>
              sum + Number(item.TechnicianRating || item.Rating || 0),
            0,
          ) / total;

    return {
      total,
      waiting: reviewableServices.length,
      avgService: avgService.toFixed(1),
      avgTech: avgTech.toFixed(1),
      fiveStar: reviews.filter((x) => Number(x.Rating) === 5).length,
    };
  }, [reviews, reviewableServices]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((item) => {
      const text = `
        ${item.ServiceName || ""}
        ${item.EmployeeName || ""}
        ${item.Comment || ""}
        ${item.AdminResponse || ""}
      `.toLowerCase();

      const matchKeyword = text.includes(keyword.trim().toLowerCase());

      const matchRating =
        ratingFilter === "ALL" ||
        Number(item.Rating || 0) === Number(ratingFilter);

      const matchStatus =
        statusFilter === "ALL" ||
        String(item.Status || "APPROVED").toUpperCase() === statusFilter;

      return matchKeyword && matchRating && matchStatus;
    });
  }, [reviews, keyword, ratingFilter, statusFilter]);

  function chooseReviewable(appointmentId, serviceId) {
    setForm((prev) => ({
      ...prev,
      appointmentId: String(appointmentId),
      serviceId: String(serviceId),
    }));

    window.scrollTo({ top: 380, behavior: "smooth" });
  }

  function handleFiles(e) {
    const selected = Array.from(e.target.files || []).slice(0, 6);

    setFiles(selected);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
  }

  function removeFile(indexToRemove) {
    setFiles((prevFiles) => prevFiles.filter((_, idx) => idx !== indexToRemove));
    setPreviews((prevPreviews) => {
      URL.revokeObjectURL(prevPreviews[indexToRemove]);
      return prevPreviews.filter((_, idx) => idx !== indexToRemove);
    });
  }

  async function submitReview(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.appointmentId || !form.serviceId) {
      setError("Vui lòng chọn dịch vụ đã hoàn thành để đánh giá.");
      return;
    }

    if (!form.comment.trim() || form.comment.trim().length < 5) {
      setError("Nội dung đánh giá phải có ít nhất 5 ký tự.");
      return;
    }

    try {
      setSubmitting(true);

      const body = new FormData();
      body.append("appointmentId", form.appointmentId);
      body.append("serviceId", form.serviceId);
      body.append("serviceRating", form.serviceRating);
      body.append("technicianRating", form.technicianRating);
      body.append("comment", form.comment.trim());

      files.forEach((file) => body.append("images", file));

      await axiosClient.post("/customers/me/reviews", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("Gửi đánh giá thành công.");
      setForm({
        appointmentId: "",
        serviceId: "",
        serviceRating: 5,
        technicianRating: 5,
        comment: "",
      });

      setFiles([]);
      setPreviews([]);

      await loadReviews();
    } catch (err) {
      setError(err.response?.data?.message || "Gửi đánh giá thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerLayout>
      <div className="rev-page">
        {/* Ambient background decoration */}
        <div className="rev-ambient-bg">
          <div className="rev-blob rev-blob-1"></div>
          <div className="rev-blob rev-blob-2"></div>
          <div className="rev-blob rev-blob-3"></div>
        </div>

        {/* Hero Section */}
        <section className="rev-glass-panel rev-hero">
          <div className="rev-hero-left">
            <span className="rev-kicker">Trải nghiệm dịch vụ</span>
            <h1>Đánh giá chất lượng dịch vụ</h1>
            <p>
              Ý kiến của bạn là động lực giúp salon nâng cao chất lượng dịch vụ mỗi ngày. 
              Hãy chấm sao dịch vụ, kỹ thuật viên phụ trách và gửi hình ảnh thực tế từ lịch hẹn đã hoàn thành của bạn.
            </p>
            <div className="rev-hero-actions">
              <Link to="/customer/feedback" className="rev-btn rev-btn-secondary">
                💬 Gửi phản hồi / khiếu nại
              </Link>
              <button
                type="button"
                className="rev-btn rev-btn-primary"
                onClick={() =>
                  window.scrollTo({ top: 620, behavior: "smooth" })
                }
              >
                ✍️ Viết đánh giá mới
              </button>
            </div>
          </div>

          <div className="rev-hero-score-wrapper">
            <div className="rev-score-circle">
              <span className="rev-score-num">{summary.avgService}</span>
              <span className="rev-score-label">Điểm trung bình</span>
              <span className="rev-score-total">{summary.total} đánh giá</span>
            </div>
          </div>
        </section>

        {/* System Messages */}
        {message && (
          <div className="rev-alert rev-alert-success">
            <span>✨</span> {message}
          </div>
        )}
        {error && (
          <div className="rev-alert rev-alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Dash Statistics Cards */}
        <section className="rev-stats-row">
          <div className="rev-stat-card">
            <div className="rev-stat-header">
              <span className="rev-stat-label">Tổng số đã gửi</span>
              <span className="rev-stat-icon">📝</span>
            </div>
            <span className="rev-stat-value">{summary.total}</span>
          </div>

          <div className="rev-stat-card">
            <div className="rev-stat-header">
              <span className="rev-stat-label">Đang chờ đánh giá</span>
              <span className="rev-stat-icon">⏳</span>
            </div>
            <span className="rev-stat-value highlight">{summary.waiting}</span>
          </div>

          <div className="rev-stat-card">
            <div className="rev-stat-header">
              <span className="rev-stat-label">Điểm dịch vụ</span>
              <span className="rev-stat-icon">💆</span>
            </div>
            <span className="rev-stat-value">{summary.avgService}/5</span>
          </div>

          <div className="rev-stat-card">
            <div className="rev-stat-header">
              <span className="rev-stat-label">Điểm kỹ thuật viên</span>
              <span className="rev-stat-icon">✂️</span>
            </div>
            <span className="rev-stat-value">{summary.avgTech}/5</span>
          </div>

          <div className="rev-stat-card">
            <div className="rev-stat-header">
              <span className="rev-stat-label">Đánh giá 5 sao</span>
              <span className="rev-stat-icon">⭐</span>
            </div>
            <span className="rev-stat-value">{summary.fiveStar}</span>
          </div>
        </section>

        {/* Main Grid: Forms & Sidebar */}
        <section className="rev-grid-layout" id="write-review-section">
          {/* Write New Review Card */}
          <form className="rev-glass-panel rev-form-container" onSubmit={submitReview}>
            <div className="rev-section-title">
              <div className="rev-title-badge">01</div>
              <div className="rev-title-content">
                <h2>Viết đánh giá của bạn</h2>
                <p>Chia sẻ cảm nhận thật và đính kèm hình ảnh thực tế.</p>
              </div>
            </div>

            <div className="rev-form-fields">
              <label className="rev-label">
                Chọn dịch vụ hoàn thành cần đánh giá
                <select
                  className="rev-select"
                  value={
                    form.appointmentId && form.serviceId
                      ? `${form.appointmentId}|${form.serviceId}`
                      : ""
                  }
                  onChange={(e) => {
                    const [appointmentId, serviceId] = e.target.value.split("|");
                    setForm({ ...form, appointmentId, serviceId });
                  }}
                >
                  <option value="">Chọn một dịch vụ...</option>
                  {reviewableServices.map((item) => (
                    <option
                      key={`${item.AppointmentId}-${item.ServiceId}`}
                      value={`${item.AppointmentId}|${item.ServiceId}`}
                    >
                      #{item.AppointmentId} - {item.ServiceName} ({formatDate(item.AppointmentDate)})
                    </option>
                  ))}
                </select>
              </label>

              {/* Selected service details display card */}
              {selectedService && (
                <div className="rev-context-card">
                  <div className="rev-context-thumb">
                    {selectedService.ServiceImageUrl ? (
                      <img
                        src={imageUrl(selectedService.ServiceImageUrl)}
                        alt={selectedService.ServiceName}
                      />
                    ) : (
                      <span>💆</span>
                    )}
                  </div>

                  <div className="rev-context-info">
                    <h3>{selectedService.ServiceName}</h3>
                    <p className="rev-context-desc">
                      {selectedService.ServiceDescription || "Dịch vụ làm đẹp cao cấp từ chuyên gia chăm sóc sắc đẹp."}
                    </p>
                    <div className="rev-context-tags">
                      <span className="rev-badge">Mã #{selectedService.AppointmentId}</span>
                      <span className="rev-badge">{formatDate(selectedService.AppointmentDate)}</span>
                      <span className="rev-badge">{selectedService.StartTime} - {selectedService.EndTime}</span>
                      <span className="rev-badge rev-badge-price">{money(selectedService.Price)}</span>
                      {selectedService.EmployeeName && (
                        <span className="rev-badge rev-badge-tech">💇 KTV: {selectedService.EmployeeName}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Double stars ratings */}
              <div className="rev-rating-grid">
                <div className="rev-rating-box">
                  <span className="rev-rating-title">Chất lượng dịch vụ</span>
                  {renderNewStars(form.serviceRating, (value) =>
                    setForm({ ...form, serviceRating: value }),
                  )}
                  <span className="rev-rating-hint">{form.serviceRating} / 5 sao</span>
                </div>

                <div className="rev-rating-box">
                  <span className="rev-rating-title">Kỹ thuật viên phụ trách</span>
                  {renderNewStars(form.technicianRating, (value) =>
                    setForm({ ...form, technicianRating: value }),
                  )}
                  <span className="rev-rating-hint">{form.technicianRating} / 5 sao</span>
                </div>
              </div>

              <label className="rev-label">
                Nội dung nhận xét & góp ý
                <textarea
                  className="rev-textarea"
                  rows="4"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Hài lòng của bạn là gì? Thái độ phục vụ của nhân viên ra sao? Chia sẻ trải nghiệm thực tế để salon hoàn thiện hơn nhé..."
                />
                <span className="rev-input-limit">{form.comment.length} / 500 ký tự</span>
              </label>

              <label className="rev-label">
                Đăng tải hình ảnh thực tế
                <div className="rev-upload-zone">
                  <span className="rev-upload-icon">📸</span>
                  <span className="rev-upload-title">Nhấp để tải ảnh lên</span>
                  <span className="rev-upload-subtitle">Định dạng JPG, PNG, WEBP. Chọn tối đa 6 hình ảnh thực tế.</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFiles}
                  />
                </div>
              </label>

              {/* Image previews with delete buttons */}
              {previews.length > 0 && (
                <div className="rev-previews-grid">
                  {previews.map((url, index) => (
                    <div className="rev-preview-item" key={url}>
                      <img src={url} alt="Preview" />
                      <button
                        type="button"
                        className="rev-preview-remove"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button className="rev-btn rev-btn-primary" style={{ width: "100%", height: "50px", marginTop: "10px" }} disabled={submitting}>
                {submitting ? "Đang gửi đánh giá của bạn..." : "Gửi Đánh Giá Trải Nghiệm"}
              </button>
            </div>
          </form>

          {/* Sidebar Waiting Reviews */}
          <aside className="rev-glass-panel rev-sidebar">
            <h3>Dịch vụ chờ đánh giá</h3>

            {groupedReviewable.length === 0 ? (
              <div className="rev-empty" style={{ padding: "40px 20px" }}>
                <span className="rev-empty-icon">✨</span>
                <h4>Tuyệt vời!</h4>
                <p>Bạn đã hoàn thành việc đánh giá tất cả các lịch hẹn gần đây.</p>
              </div>
            ) : (
              <div className="rev-waiting-scroller">
                {groupedReviewable.map(([appointmentId, services]) => (
                  <div className="rev-waiting-card" key={appointmentId}>
                    <div className="rev-waiting-header">
                      <span className="rev-waiting-id">Lịch hẹn #{appointmentId}</span>
                      <span className="rev-waiting-date">{formatDate(services[0].AppointmentDate)}</span>
                    </div>
                    <div className="rev-waiting-list-services">
                      {services.map((item) => (
                        <button
                          type="button"
                          className="rev-waiting-btn"
                          key={`${item.AppointmentId}-${item.ServiceId}`}
                          onClick={() =>
                            chooseReviewable(item.AppointmentId, item.ServiceId)
                          }
                        >
                          <span className="rev-waiting-btn-name">{item.ServiceName}</span>
                          <span className="rev-waiting-btn-action">Đánh giá</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </section>

        {/* History Reviews Card List */}
        <section className="rev-glass-panel rev-history-section">
          <div className="rev-section-title">
            <div className="rev-title-badge">02</div>
            <div className="rev-title-content">
              <h2>Lịch sử đánh giá của bạn</h2>
              <p>Danh sách các đánh giá thật bạn đã đóng góp cho salon.</p>
            </div>
          </div>

          {/* Filtering Tools toolbar */}
          <div className="rev-toolbar">
            <input
              className="rev-search-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="🔍 Tìm kiếm theo tên dịch vụ, kỹ thuật viên, nhận xét..."
            />

            <select
              className="rev-select"
              style={{ height: "48px" }}
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="ALL">Tất cả sao</option>
              <option value="5">5 Sao ⭐⭐⭐⭐⭐</option>
              <option value="4">4 Sao ⭐⭐⭐⭐</option>
              <option value="3">3 Sao ⭐⭐⭐</option>
              <option value="2">2 Sao ⭐⭐</option>
              <option value="1">1 Sao ⭐</option>
            </select>

            <select
              className="rev-select"
              style={{ height: "48px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PENDING">Đang chờ</option>
              <option value="HIDDEN">Đã ẩn</option>
            </select>
          </div>

          {/* Review List items */}
          {loading ? (
            <div className="rev-empty">
              <span className="rev-empty-icon">⏳</span>
              <h4>Đang tải dữ liệu</h4>
              <p>Vui lòng chờ giây lát trong khi chúng tôi chuẩn bị lịch sử đánh giá của bạn.</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rev-empty">
              <span className="rev-empty-icon">📭</span>
              <h4>Không tìm thấy kết quả</h4>
              <p>Chưa có lịch sử đánh giá nào phù hợp với bộ lọc tìm kiếm của bạn.</p>
            </div>
          ) : (
            <div className="rev-review-list">
              {filteredReviews.map((review) => (
                <article className="rev-card" key={review.ReviewId}>
                  {/* Left part: Service & technician info context */}
                  <div className="rev-card-service">
                    <div className="rev-card-service-top">
                      <div className="rev-card-service-img">
                        {review.ServiceImageUrl ? (
                          <img
                            src={imageUrl(review.ServiceImageUrl)}
                            alt={review.ServiceName}
                          />
                        ) : (
                          <span>💆</span>
                        )}
                      </div>
                      <div className="rev-card-service-meta">
                        <h4>{review.ServiceName || "Dịch vụ"}</h4>
                        <span className="rev-card-service-id">Mã đánh giá #{review.ReviewId}</span>
                      </div>
                    </div>

                    <div className="rev-meta-list">
                      <div className="rev-meta-item">
                        <span className="rev-meta-icon">🔑</span>
                        <span>Lịch hẹn #{review.AppointmentId}</span>
                      </div>
                      <div className="rev-meta-item">
                        <span className="rev-meta-icon">📅</span>
                        <span>{formatDate(review.AppointmentDate || review.CreatedAt)}</span>
                      </div>
                      <div className="rev-meta-item">
                        <span className="rev-meta-icon">🕒</span>
                        <span>{review.StartTime ? `${review.StartTime} - ${review.EndTime}` : "Thời gian làm"}</span>
                      </div>
                      <div className="rev-meta-item" style={{ fontWeight: "700", color: "var(--rev-primary)" }}>
                        <span className="rev-meta-icon">💰</span>
                        <span>{money(review.Price)}</span>
                      </div>
                    </div>

                    {/* Technician details */}
                    <div className="rev-card-tech">
                      <div className="rev-tech-avatar">
                        {review.EmployeeImageUrl ? (
                          <img src={imageUrl(review.EmployeeImageUrl)} alt={review.EmployeeName} />
                        ) : (
                          <span>💇</span>
                        )}
                      </div>
                      <div className="rev-tech-details">
                        <span className="rev-tech-label">Kỹ thuật viên</span>
                        <span className="rev-tech-name">{review.EmployeeName || "Chưa phân công"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right part: Ratings & review contents */}
                  <div className="rev-card-body">
                    <div className="rev-card-body-header">
                      <div className="rev-scores-row">
                        <div className="rev-card-score-item">
                          <span className="rev-score-title">Dịch vụ:</span>
                          {renderStarsDisplay(review.Rating)}
                        </div>
                        <div className="rev-card-score-item">
                          <span className="rev-score-title">Kỹ thuật viên:</span>
                          {renderStarsDisplay(review.TechnicianRating || review.Rating)}
                        </div>
                      </div>

                      <span className={`rev-status-pill ${String(review.Status || "approved").toLowerCase()}`}>
                        {review.Status === "APPROVED" ? "Đã duyệt" : review.Status === "PENDING" ? "Đang chờ" : "Đã ẩn"}
                      </span>
                    </div>

                    {review.Comment && (
                      <p className="rev-comment-text">“ {review.Comment} ”</p>
                    )}

                    {/* Real images gallery inside history card */}
                    {review.Images?.length > 0 && (
                      <div className="rev-card-gallery">
                        {review.Images.map((img, imgIndex) => (
                          <div
                            className="rev-gallery-thumbnail"
                            key={img.ReviewImageId || img.ImageUrl}
                            onClick={() => openLightbox(review.Images, imgIndex)}
                          >
                            <img
                              src={imageUrl(img.ImageUrl)}
                              alt="Real review"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Admin response dialogue bubble */}
                    {review.AdminResponse && (
                      <div className="rev-admin-bubble">
                        <div className="rev-admin-bubble-header">
                          <span>🌸 Phản hồi chính thức từ Salon</span>
                        </div>
                        <p>{review.AdminResponse}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="rev-card-footer">
                      <span>Thời gian gửi: {formatDateTime(review.CreatedAt)}</span>
                      <button
                        type="button"
                        className="rev-footer-btn"
                        onClick={() => setDetail(review)}
                      >
                        📄 Chi tiết đánh giá
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Item Detail Modal overlay */}
        {detail && (
          <div className="rev-lightbox-backdrop" onClick={() => setDetail(null)}>
            <div
              className="rev-glass-panel"
              style={{ width: "min(600px, 100%)", maxHeight: "90vh", overflowY: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="rev-lightbox-close"
                style={{ top: "16px", right: "16px" }}
                onClick={() => setDetail(null)}
              >
                ×
              </button>

              <h2 style={{ fontSize: "22px", fontWeight: "900", color: "var(--rev-primary)", marginBottom: "20px" }}>
                Chi tiết đánh giá
              </h2>

              <div className="rev-context-card" style={{ marginBottom: "20px" }}>
                <div className="rev-context-thumb">
                  {detail.ServiceImageUrl ? (
                    <img src={imageUrl(detail.ServiceImageUrl)} alt={detail.ServiceName} />
                  ) : (
                    <span>💆</span>
                  )}
                </div>
                <div className="rev-context-info">
                  <h3>{detail.ServiceName}</h3>
                  <p className="rev-context-desc">{detail.ServiceDescription || "Dịch vụ làm đẹp cao cấp từ chuyên gia chăm sóc sắc đẹp."}</p>
                </div>
              </div>

              <div className="rev-rating-grid" style={{ marginBottom: "20px" }}>
                <div className="rev-rating-box">
                  <span className="rev-rating-title">Dịch vụ</span>
                  {renderStarsDisplay(detail.Rating)}
                  <span className="rev-rating-hint">{detail.Rating}/5 sao</span>
                </div>
                <div className="rev-rating-box">
                  <span className="rev-rating-title">Kỹ thuật viên</span>
                  {renderStarsDisplay(detail.TechnicianRating || detail.Rating)}
                  <span className="rev-rating-hint">{(detail.TechnicianRating || detail.Rating)}/5 sao</span>
                </div>
              </div>

              <div className="rev-form-fields" style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(138, 91, 112, 0.12)", paddingBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "var(--rev-text-muted)" }}>Mã lịch hẹn:</span>
                  <span style={{ fontWeight: "800" }}>#{detail.AppointmentId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(138, 91, 112, 0.12)", paddingBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "var(--rev-text-muted)" }}>Ngày thực hiện:</span>
                  <span style={{ fontWeight: "800" }}>{formatDate(detail.AppointmentDate)}</span>
                </div>
                {detail.EmployeeName && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(138, 91, 112, 0.12)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "700", color: "var(--rev-text-muted)" }}>Kỹ thuật viên:</span>
                    <span style={{ fontWeight: "800", color: "var(--rev-secondary)" }}>{detail.EmployeeName}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(138, 91, 112, 0.12)", paddingBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "var(--rev-text-muted)" }}>Thời gian gửi:</span>
                  <span style={{ fontWeight: "800" }}>{formatDateTime(detail.CreatedAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(138, 91, 112, 0.12)", paddingBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "var(--rev-text-muted)" }}>Trạng thái:</span>
                  <span className={`rev-status-pill ${String(detail.Status || "APPROVED").toLowerCase()}`}>
                    {detail.Status === "APPROVED" ? "Đã duyệt" : detail.Status === "PENDING" ? "Đang chờ" : "Đã ẩn"}
                  </span>
                </div>
              </div>

              {detail.Comment && (
                <div style={{ marginBottom: "20px" }}>
                  <label className="rev-label" style={{ marginBottom: "8px" }}>Nhận xét khách hàng</label>
                  <p className="rev-comment-text">{detail.Comment}</p>
                </div>
              )}

              {detail.AdminResponse && (
                <div className="rev-admin-bubble">
                  <div className="rev-admin-bubble-header">
                    <span>🌸 Phản hồi từ salon</span>
                  </div>
                  <p>{detail.AdminResponse}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Real-Images Lightbox slider modal */}
        {lightbox.isOpen && lightbox.images.length > 0 && (
          <div className="rev-lightbox-backdrop" onClick={closeLightbox}>
            <div className="rev-lightbox-container" onClick={(e) => e.stopPropagation()}>
              <button className="rev-lightbox-close" onClick={closeLightbox}>
                ×
              </button>

              <div className="rev-lightbox-img-wrapper">
                {/* Navigation arrows (if multiple images) */}
                {lightbox.images.length > 1 && (
                  <button className="rev-lightbox-nav rev-lightbox-prev" onClick={prevLightboxImage}>
                    ‹
                  </button>
                )}

                <img
                  className="rev-lightbox-img"
                  src={imageUrl(lightbox.images[lightbox.index].ImageUrl)}
                  alt={`Real photo ${lightbox.index + 1}`}
                />

                {lightbox.images.length > 1 && (
                  <button className="rev-lightbox-nav rev-lightbox-next" onClick={nextLightboxImage}>
                    ›
                  </button>
                )}
              </div>

              {/* Bottom Thumbnail Strip Indicator */}
              {lightbox.images.length > 1 && (
                <div className="rev-lightbox-carousel">
                  {lightbox.images.map((img, dotIdx) => (
                    <div
                      key={img.ReviewImageId || img.ImageUrl}
                      className={`rev-lightbox-dot ${dotIdx === lightbox.index ? "active" : ""}`}
                      onClick={() => setLightbox((prev) => ({ ...prev, index: dotIdx }))}
                    >
                      <img src={imageUrl(img.ImageUrl)} alt={`Thumbnail ${dotIdx + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
