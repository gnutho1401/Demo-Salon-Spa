import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

function formatDate(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

function renderStars(value) {
  const rating = Number(value || 0);
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export default function ReviewPage() {
  const navigate = useNavigate();
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [reviewRes, reviewableRes] = await Promise.all([
        axiosClient.get("/customers/me/reviews"),
        axiosClient.get("/customers/me/reviewable-services"),
      ]);

      const reviewItems = reviewRes.data.data || reviewRes.data || [];
      const reviewableItems =
        reviewableRes.data.data || reviewableRes.data || [];

      setReviews(reviewItems);
      setReviewableServices(reviewableItems);

      const appointmentId = searchParams.get("appointmentId");
      const serviceId = searchParams.get("serviceId");

      let matched = null;

      if (appointmentId && serviceId) {
        matched = reviewableItems.find(
          (item) =>
            String(item.AppointmentId) === String(appointmentId) &&
            String(item.ServiceId) === String(serviceId),
        );
      }

      if (!matched && appointmentId) {
        matched = reviewableItems.find(
          (item) => String(item.AppointmentId) === String(appointmentId),
        );
      }

      if (matched) {
        setForm((prev) => ({
          ...prev,
          appointmentId: String(matched.AppointmentId),
          serviceId: String(matched.ServiceId),
        }));
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được dữ liệu đánh giá",
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

  const summary = useMemo(() => {
    const avgService =
      reviews.length === 0
        ? 0
        : reviews.reduce((sum, item) => sum + Number(item.Rating || 0), 0) /
          reviews.length;

    const avgTech =
      reviews.length === 0
        ? 0
        : reviews.reduce(
            (sum, item) =>
              sum + Number(item.TechnicianRating || item.Rating || 0),
            0,
          ) / reviews.length;

    return {
      total: reviews.length,
      waiting: reviewableServices.length,
      avgService,
      avgTech,
    };
  }, [reviews, reviewableServices]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((item) => {
      const text = `${item.ServiceName || ""} ${item.EmployeeName || ""} ${
        item.Comment || ""
      }`.toLowerCase();

      const matchKeyword = text.includes(keyword.trim().toLowerCase());

      const matchRating =
        ratingFilter === "ALL" ||
        Number(item.Rating || 0) === Number(ratingFilter);

      return matchKeyword && matchRating;
    });
  }, [reviews, keyword, ratingFilter]);

  const handleFilesChange = (e) => {
    setError("");

    const selectedFiles = Array.from(e.target.files || []);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    const validFiles = selectedFiles.filter((file) => {
      if (!allowedTypes.has(file.type)) return false;
      if (file.size > 5 * 1024 * 1024) return false;
      return true;
    });

    const finalFiles = validFiles.slice(0, 6);

    if (selectedFiles.length !== finalFiles.length) {
      setError(
        "Chỉ được upload tối đa 6 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5MB",
      );
    }

    previews.forEach((url) => URL.revokeObjectURL(url));

    setFiles(finalFiles);
    setPreviews(finalFiles.map((file) => URL.createObjectURL(file)));
  };

  const removePreview = (index) => {
    const nextFiles = files.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);

    URL.revokeObjectURL(previews[index]);

    setFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      if (!selectedService) {
        throw new Error("Vui lòng chọn dịch vụ đã hoàn thành để đánh giá");
      }

      if (!form.comment.trim()) {
        throw new Error("Vui lòng nhập nội dung đánh giá");
      }

      if (form.comment.trim().length < 5) {
        throw new Error("Nội dung đánh giá phải có ít nhất 5 ký tự");
      }

      const formData = new FormData();
      formData.append("appointmentId", form.appointmentId);
      formData.append("serviceId", form.serviceId);
      formData.append("serviceRating", Number(form.serviceRating));
      formData.append("technicianRating", Number(form.technicianRating));
      formData.append("comment", form.comment.trim());

      files.forEach((file) => {
        formData.append("images", file);
      });

      await axiosClient.post("/customers/me/reviews", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Gửi đánh giá thành công");

      previews.forEach((url) => URL.revokeObjectURL(url));

      setFiles([]);
      setPreviews([]);
      setForm({
        appointmentId: "",
        serviceId: "",
        serviceRating: 5,
        technicianRating: 5,
        comment: "",
      });

      await loadReviews();

      setTimeout(() => {
        navigate("/customer/service-history");
      }, 600);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Gửi đánh giá thất bại",
      );
    }
  };

  return (
    <CustomerLayout>
      <div className="review-feedback-hero review-hero">
        <div>
          <div className="eyebrow">Service Review</div>
          <h2>Đánh giá dịch vụ</h2>
          <p>
            Chỉ đánh giá được dịch vụ trong lịch hẹn đã hoàn thành. Mỗi dịch vụ
            chỉ được đánh giá một lần.
          </p>
        </div>
        <div className="review-feedback-hero-badge">
          <strong>{summary.waiting}</strong>
          <span>dịch vụ chờ đánh giá</span>
        </div>
      </div>

      {loading && <p className="muted">Đang tải dữ liệu...</p>}
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="rf-stats">
        <div className="rf-stat-card">
          <span>Đã đánh giá</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="rf-stat-card">
          <span>Chờ đánh giá</span>
          <strong>{summary.waiting}</strong>
        </div>
        <div className="rf-stat-card">
          <span>TB dịch vụ</span>
          <strong>{summary.avgService.toFixed(1)}</strong>
        </div>
        <div className="rf-stat-card">
          <span>TB kỹ thuật viên</span>
          <strong>{summary.avgTech.toFixed(1)}</strong>
        </div>
      </div>

      <div className="rf-layout">
        <form
          className="dashboard-card profile-form rf-form-card"
          onSubmit={submitReview}
        >
          <h3>Gửi đánh giá mới</h3>
          <p className="muted">
            Đánh giá này dùng để ghi nhận chất lượng dịch vụ và kỹ thuật viên.
          </p>

          <div className="form-group">
            <label>Dịch vụ đã hoàn thành</label>
            <select
              value={`${form.appointmentId}|${form.serviceId}`}
              onChange={(e) => {
                const [appointmentId, serviceId] = e.target.value.split("|");
                setForm({
                  ...form,
                  appointmentId,
                  serviceId,
                });
              }}
            >
              <option value="|">Chọn dịch vụ cần đánh giá</option>
              {reviewableServices.map((item) => (
                <option
                  key={`${item.AppointmentId}-${item.ServiceId}`}
                  value={`${item.AppointmentId}|${item.ServiceId}`}
                >
                  #{item.AppointmentId} - {item.ServiceName} -{" "}
                  {item.EmployeeName} - {formatDate(item.AppointmentDate)}
                </option>
              ))}
            </select>
          </div>

          {selectedService && (
            <div className="rf-selected-service">
              <strong>{selectedService.ServiceName}</strong>
              <span>Kỹ thuật viên: {selectedService.EmployeeName}</span>
              <span>
                Ngày hẹn: {formatDate(selectedService.AppointmentDate)} •{" "}
                {selectedService.StartTime} - {selectedService.EndTime}
              </span>
              <span>
                Giá dịch vụ:{" "}
                {Number(selectedService.Price || 0).toLocaleString("vi-VN")}đ
              </span>
            </div>
          )}

          <div className="rf-rating-row">
            <div className="form-group">
              <label>Đánh giá dịch vụ</label>
              <select
                value={form.serviceRating}
                onChange={(e) =>
                  setForm({
                    ...form,
                    serviceRating: e.target.value,
                  })
                }
              >
                {[5, 4, 3, 2, 1].map((number) => (
                  <option key={number} value={number}>
                    {number} sao
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Đánh giá kỹ thuật viên</label>
              <select
                value={form.technicianRating}
                onChange={(e) =>
                  setForm({
                    ...form,
                    technicianRating: e.target.value,
                  })
                }
              >
                {[5, 4, 3, 2, 1].map((number) => (
                  <option key={number} value={number}>
                    {number} sao
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Bình luận</label>
            <textarea
              value={form.comment}
              onChange={(e) =>
                setForm({
                  ...form,
                  comment: e.target.value,
                })
              }
              placeholder="Ví dụ: Dịch vụ tốt, kỹ thuật viên tư vấn nhiệt tình..."
              rows={6}
            />
          </div>

          <div className="form-group">
            <label>Ảnh đánh giá</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFilesChange}
            />
            <small className="muted">
              Không bắt buộc. Tối đa 6 ảnh JPG, PNG, WEBP. Mỗi ảnh tối đa 5MB.
            </small>
          </div>

          {previews.length > 0 && (
            <div className="rf-image-grid">
              {previews.map((src, index) => (
                <div className="rf-image-box" key={src}>
                  <img src={src} alt={`Preview ${index + 1}`} />
                  <button type="button" onClick={() => removePreview(index)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={reviewableServices.length === 0}
          >
            {reviewableServices.length === 0
              ? "Không có dịch vụ đủ điều kiện"
              : "Gửi đánh giá"}
          </button>

          {reviewableServices.length === 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              Bạn có thể kiểm tra lại trong{" "}
              <Link to="/customer/service-history">Lịch sử dịch vụ</Link>.
            </p>
          )}
        </form>

        <div className="dashboard-card rf-list-card">
          <div className="rf-card-head">
            <div>
              <h3>Đánh giá đã gửi</h3>
              <p className="muted">Danh sách đánh giá dịch vụ của bạn.</p>
            </div>
          </div>

          <div className="rf-toolbar">
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
          </div>

          {filteredReviews.length === 0 ? (
            <div className="rf-empty">
              <strong>Chưa có đánh giá phù hợp</strong>
              <span>Hoàn thành dịch vụ để có thể gửi đánh giá.</span>
            </div>
          ) : (
            <div className="rf-list">
              {filteredReviews.map((review) => {
                const images = Array.isArray(review.Images)
                  ? review.Images
                  : [];
                const serviceRating = Number(review.Rating || 0);
                const techRating = Number(
                  review.TechnicianRating || review.Rating || 0,
                );

                return (
                  <div className="rf-item" key={review.ReviewId}>
                    <div className="rf-item-top">
                      <div>
                        <strong>
                          {review.ServiceName || `Dịch vụ #${review.ServiceId}`}
                        </strong>
                        <span>
                          Lịch #{review.AppointmentId} •{" "}
                          {formatDate(review.CreatedAt)}
                        </span>
                      </div>
                      <span className="rf-status approved">
                        {review.Status || "APPROVED"}
                      </span>
                    </div>

                    <div className="rf-review-lines">
                      <span>
                        Dịch vụ: <b>{renderStars(serviceRating)}</b> (
                        {serviceRating}/5)
                      </span>
                      <span>
                        Kỹ thuật viên: <b>{renderStars(techRating)}</b> (
                        {techRating}/5)
                      </span>
                    </div>

                    {review.Comment && <p>{review.Comment}</p>}

                    {review.AdminResponse && (
                      <div className="rf-admin-response">
                        <strong>Phản hồi từ salon</strong>
                        <span>{review.AdminResponse}</span>
                      </div>
                    )}

                    {images.length > 0 && (
                      <div className="rf-image-grid history">
                        {images.map((img) => (
                          <div
                            className="rf-image-box"
                            key={img.ReviewImageId || img.ImageUrl}
                          >
                            <img
                              src={resolveFileUrl(img.ImageUrl)}
                              alt="Review"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rf-meta">
                      <span>Mã đánh giá: #{review.ReviewId}</span>
                      <span>Ngày tạo: {formatDate(review.CreatedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
