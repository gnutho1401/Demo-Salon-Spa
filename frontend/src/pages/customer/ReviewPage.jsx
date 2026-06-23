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

function renderStars(value, onChange) {
  const rating = Number(value || 0);

  return (
    <div className="crf-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= rating ? "active" : ""}
          onClick={() => onChange?.(star)}
        >
          ★
        </button>
      ))}
    </div>
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
      <div className="crf-page">
        <section className="crf-hero review">
          <div>
            <span className="crf-kicker">SERVICE REVIEW</span>
            <h1>Đánh giá dịch vụ</h1>
            <p>
              Chỉ các lịch hẹn đã hoàn thành mới được đánh giá. Bạn có thể chấm
              sao dịch vụ, kỹ thuật viên, viết nhận xét và gửi hình ảnh thực tế.
            </p>
            <div className="crf-hero-actions">
              <Link to="/customer/feedback">Gửi phản hồi / khiếu nại</Link>
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({ top: 420, behavior: "smooth" })
                }
              >
                Viết đánh giá
              </button>
            </div>
          </div>

          <div className="crf-hero-score">
            <strong>{summary.avgService}</strong>
            <span>điểm dịch vụ trung bình</span>
            <small>{summary.total} đánh giá đã gửi</small>
          </div>
        </section>

        {message && <div className="crf-alert success">{message}</div>}
        {error && <div className="crf-alert error">{error}</div>}

        <section className="crf-stats">
          <div>
            <span>Đã đánh giá</span>
            <b>{summary.total}</b>
          </div>
          <div>
            <span>Chờ đánh giá</span>
            <b>{summary.waiting}</b>
          </div>
          <div>
            <span>Điểm dịch vụ</span>
            <b>{summary.avgService}/5</b>
          </div>
          <div>
            <span>Điểm kỹ thuật viên</span>
            <b>{summary.avgTech}/5</b>
          </div>
          <div>
            <span>5 sao</span>
            <b>{summary.fiveStar}</b>
          </div>
        </section>

        <section className="crf-grid">
          <form className="crf-form-card" onSubmit={submitReview}>
            <div className="crf-section-title">
              <span>01</span>
              <div>
                <h2>Viết đánh giá mới</h2>
                <p>Chọn dịch vụ đã hoàn thành và gửi trải nghiệm thật.</p>
              </div>
            </div>

            <label>
              Dịch vụ cần đánh giá
              <select
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
                <option value="">Chọn dịch vụ đã hoàn thành</option>
                {reviewableServices.map((item) => (
                  <option
                    key={`${item.AppointmentId}-${item.ServiceId}`}
                    value={`${item.AppointmentId}|${item.ServiceId}`}
                  >
                    #{item.AppointmentId} - {item.ServiceName} -{" "}
                    {formatDate(item.AppointmentDate)}
                  </option>
                ))}
              </select>
            </label>

            {selectedService && (
              <div className="crf-selected-service">
                <div className="crf-thumb">
                  {selectedService.ServiceImageUrl ? (
                    <img
                      src={imageUrl(selectedService.ServiceImageUrl)}
                      alt={selectedService.ServiceName}
                    />
                  ) : (
                    <span>💆</span>
                  )}
                </div>

                <div>
                  <h3>{selectedService.ServiceName}</h3>
                  <p>
                    {selectedService.ServiceDescription || "Chưa có mô tả."}
                  </p>
                  <div className="crf-mini-tags">
                    <span>Lịch #{selectedService.AppointmentId}</span>
                    <span>{formatDate(selectedService.AppointmentDate)}</span>
                    <span>
                      {selectedService.StartTime} - {selectedService.EndTime}
                    </span>
                    <span>{money(selectedService.Price)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="crf-rating-box">
              <div>
                <span>Đánh giá dịch vụ</span>
                {renderStars(form.serviceRating, (value) =>
                  setForm({ ...form, serviceRating: value }),
                )}
                <small>{form.serviceRating}/5 sao</small>
              </div>

              <div>
                <span>Đánh giá kỹ thuật viên</span>
                {renderStars(form.technicianRating, (value) =>
                  setForm({ ...form, technicianRating: value }),
                )}
                <small>{form.technicianRating}/5 sao</small>
              </div>
            </div>

            <label>
              Nội dung đánh giá
              <textarea
                rows="5"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Chia sẻ trải nghiệm thật của bạn về dịch vụ, thái độ phục vụ, kỹ thuật viên..."
              />
              <small>{form.comment.length}/500 ký tự</small>
            </label>

            <label>
              Hình ảnh trải nghiệm
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFiles}
              />
              <small>Tối đa 6 ảnh, JPG/PNG/WEBP.</small>
            </label>

            {previews.length > 0 && (
              <div className="crf-preview-grid">
                {previews.map((url) => (
                  <img src={url} key={url} alt="Preview" />
                ))}
              </div>
            )}

            <button className="crf-primary" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </form>

          <aside className="crf-side-card">
            <h3>Dịch vụ chờ đánh giá</h3>

            {groupedReviewable.length === 0 ? (
              <div className="crf-empty small">
                Bạn chưa có dịch vụ nào cần đánh giá.
              </div>
            ) : (
              <div className="crf-reviewable-list">
                {groupedReviewable.map(([appointmentId, services]) => (
                  <div className="crf-reviewable-group" key={appointmentId}>
                    <strong>Lịch #{appointmentId}</strong>
                    {services.map((item) => (
                      <button
                        type="button"
                        key={`${item.AppointmentId}-${item.ServiceId}`}
                        onClick={() =>
                          chooseReviewable(item.AppointmentId, item.ServiceId)
                        }
                      >
                        <span>{item.ServiceName}</span>
                        <small>{formatDate(item.AppointmentDate)}</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </section>

        <section className="crf-list-card">
          <div className="crf-section-title">
            <span>02</span>
            <div>
              <h2>Lịch sử đánh giá</h2>
              <p>Toàn bộ đánh giá thật của bạn sau khi sử dụng dịch vụ.</p>
            </div>
          </div>

          <div className="crf-toolbar">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo dịch vụ, kỹ thuật viên, bình luận..."
            />

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="ALL">Tất cả sao</option>
              <option value="5">5 sao</option>
              <option value="4">4 sao</option>
              <option value="3">3 sao</option>
              <option value="2">2 sao</option>
              <option value="1">1 sao</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PENDING">Đang chờ</option>
              <option value="HIDDEN">Đã ẩn</option>
            </select>
          </div>

          {loading ? (
            <div className="crf-empty">Đang tải dữ liệu đánh giá...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="crf-empty">Chưa có đánh giá phù hợp.</div>
          ) : (
            <div className="crf-review-list">
              {filteredReviews.map((review) => (
                <article className="crf-review-card" key={review.ReviewId}>
                  <div className="crf-review-top">
                    <div className="crf-thumb">
                      {review.ServiceImageUrl ? (
                        <img
                          src={imageUrl(review.ServiceImageUrl)}
                          alt={review.ServiceName}
                        />
                      ) : (
                        <span>💆</span>
                      )}
                    </div>

                    <div>
                      <h3>{review.ServiceName || "Dịch vụ"}</h3>
                      <p>
                        Lịch #{review.AppointmentId} •{" "}
                        {formatDate(review.AppointmentDate || review.CreatedAt)}
                      </p>
                      <div className="crf-mini-tags">
                        <span>KTV: {review.EmployeeName || "Chưa có"}</span>
                        <span>{money(review.Price)}</span>
                        <span>{review.Status || "APPROVED"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="crf-rating-lines">
                    <div>
                      <span>Dịch vụ</span>
                      <b>{"★".repeat(Number(review.Rating || 0))}</b>
                      <small>{review.Rating}/5</small>
                    </div>

                    <div>
                      <span>Kỹ thuật viên</span>
                      <b>
                        {"★".repeat(
                          Number(review.TechnicianRating || review.Rating || 0),
                        )}
                      </b>
                      <small>
                        {review.TechnicianRating || review.Rating}/5
                      </small>
                    </div>
                  </div>

                  {review.Comment && (
                    <p className="crf-comment">{review.Comment}</p>
                  )}

                  {review.Images?.length > 0 && (
                    <div className="crf-history-images">
                      {review.Images.map((img) => (
                        <img
                          key={img.ReviewImageId || img.ImageUrl}
                          src={imageUrl(img.ImageUrl)}
                          alt="Review"
                        />
                      ))}
                    </div>
                  )}

                  {review.AdminResponse && (
                    <div className="crf-admin-box">
                      <strong>Phản hồi từ salon</strong>
                      <p>{review.AdminResponse}</p>
                    </div>
                  )}

                  <div className="crf-card-footer">
                    <span>Mã đánh giá #{review.ReviewId}</span>
                    <span>{formatDateTime(review.CreatedAt)}</span>
                    <button type="button" onClick={() => setDetail(review)}>
                      Xem chi tiết
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {detail && (
          <div className="crf-modal-backdrop" onClick={() => setDetail(null)}>
            <div className="crf-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="crf-modal-close"
                onClick={() => setDetail(null)}
              >
                ×
              </button>

              <h2>Chi tiết đánh giá</h2>

              <div className="crf-modal-main">
                <h3>{detail.ServiceName}</h3>
                <p>{detail.Comment}</p>
              </div>

              <div className="crf-modal-grid">
                <div>
                  <span>Mã đánh giá</span>
                  <b>#{detail.ReviewId}</b>
                </div>
                <div>
                  <span>Mã lịch hẹn</span>
                  <b>#{detail.AppointmentId}</b>
                </div>
                <div>
                  <span>Dịch vụ</span>
                  <b>{detail.Rating}/5</b>
                </div>
                <div>
                  <span>Kỹ thuật viên</span>
                  <b>{detail.TechnicianRating || detail.Rating}/5</b>
                </div>
                <div>
                  <span>Tên KTV</span>
                  <b>{detail.EmployeeName || "-"}</b>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <b>{detail.Status || "APPROVED"}</b>
                </div>
                <div>
                  <span>Ngày lịch hẹn</span>
                  <b>{formatDate(detail.AppointmentDate)}</b>
                </div>
                <div>
                  <span>Ngày đánh giá</span>
                  <b>{formatDateTime(detail.CreatedAt)}</b>
                </div>
              </div>

              {detail.AdminResponse && (
                <div className="crf-admin-box">
                  <strong>Phản hồi từ salon</strong>
                  <p>{detail.AdminResponse}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
