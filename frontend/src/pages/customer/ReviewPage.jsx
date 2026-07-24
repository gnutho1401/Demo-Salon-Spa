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
        <span
          key={star}
          style={{
            color: star <= rating ? "var(--rev-star-active)" : "#e5dada",
            marginRight: "2px",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewPage() {
  const [searchParams] = useSearchParams();

  const initialTabParam = (
    searchParams.get("type") ||
    searchParams.get("tab") ||
    ""
  ).toLowerCase();
  const [activeReviewTab, setActiveReviewTab] = useState(
    ["combo", "package"].includes(initialTabParam) ? "combo" : "retail",
  );

  const [reviews, setReviews] = useState([]);
  const [reviewableServices, setReviewableServices] = useState([]);

  // RETAIL FORM STATE
  const [form, setForm] = useState({
    appointmentId: "",
    serviceId: "",
    serviceRating: 5,
    technicianRating: 5,
    comment: "",
  });

  // COMBO FORM STATE
  const [comboForm, setComboForm] = useState({
    appointmentId: "",
    overallRating: 5,
    overallComment: "",
    stepRatings: {},
  });

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [keyword, setKeyword] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL"); // ALL | RETAIL | COMBO

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

  // Group reviewables by type
  const retailReviewables = useMemo(() => {
    return reviewableServices.filter(
      (item) => !item.CustomerPackageId && !item.PackageName,
    );
  }, [reviewableServices]);

  const comboReviewables = useMemo(() => {
    const map = new Map();
    reviewableServices.forEach((item) => {
      if (item.CustomerPackageId || item.PackageName) {
        if (!map.has(item.AppointmentId)) {
          map.set(item.AppointmentId, {
            appointmentId: item.AppointmentId,
            appointmentDate: item.AppointmentDate,
            packageName: item.PackageName || "Gói Combo Spa",
            customerPackageId: item.CustomerPackageId,
            services: [],
          });
        }
        map.get(item.AppointmentId).services.push(item);
      }
    });
    return Array.from(map.values());
  }, [reviewableServices]);

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
          if (matched.CustomerPackageId || matched.PackageName) {
            setActiveReviewTab("combo");
            // Auto select combo appointment
            const comboAppt = reviewableItems.filter(
              (x) => String(x.AppointmentId) === String(appointmentId),
            );
            const initialSteps = {};
            comboAppt.forEach((s) => {
              initialSteps[s.ServiceId] = {
                serviceId: s.ServiceId,
                employeeId: s.StepEmployeeId || s.EmployeeId,
                serviceName: s.ServiceName,
                technicianName:
                  s.StepTechnicianName || s.EmployeeName || "KTV Salon",
                technicianAvatar:
                  s.StepTechnicianAvatar || s.EmployeeImageUrl || "",
                rating: 5,
                comment: "",
              };
            });
            setComboForm({
              appointmentId: String(appointmentId),
              overallRating: 5,
              overallComment: "",
              stepRatings: initialSteps,
            });
          } else {
            setActiveReviewTab("retail");
            setForm((prev) => ({
              ...prev,
              appointmentId: String(matched.AppointmentId),
              serviceId: String(matched.ServiceId),
            }));
          }
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
    return retailReviewables.find(
      (item) =>
        String(item.AppointmentId) === String(form.appointmentId) &&
        String(item.ServiceId) === String(form.serviceId),
    );
  }, [retailReviewables, form.appointmentId, form.serviceId]);

  const selectedComboAppt = useMemo(() => {
    if (!comboForm.appointmentId) return null;
    return (
      comboReviewables.find(
        (c) => String(c.appointmentId) === String(comboForm.appointmentId),
      ) || null
    );
  }, [comboReviewables, comboForm.appointmentId]);

  const handleSelectComboAppt = (apptId) => {
    const group = comboReviewables.find(
      (g) => String(g.appointmentId) === String(apptId),
    );
    if (!group) return;
    const initialSteps = {};
    group.services.forEach((s) => {
      initialSteps[s.ServiceId] = {
        serviceId: s.ServiceId,
        employeeId: s.StepEmployeeId || s.EmployeeId,
        serviceName: s.ServiceName,
        technicianName: s.StepTechnicianName || s.EmployeeName || "KTV Salon",
        technicianAvatar: s.StepTechnicianAvatar || s.EmployeeImageUrl || "",
        rating: 5,
        comment: "",
      };
    });
    setComboForm({
      appointmentId: String(apptId),
      overallRating: 5,
      overallComment: "",
      stepRatings: initialSteps,
    });
  };

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
        ${item.PackageName || ""}
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

      const isCombo = Boolean(item.CustomerPackageId || item.PackageName);
      const matchCategory =
        categoryFilter === "ALL" ||
        (categoryFilter === "COMBO" && isCombo) ||
        (categoryFilter === "RETAIL" && !isCombo);

      return matchKeyword && matchRating && matchStatus && matchCategory;
    });
  }, [reviews, keyword, ratingFilter, statusFilter, categoryFilter]);

  // Group combo reviews by appointmentId for clean history cards
  const groupedHistoryReviews = useMemo(() => {
    const retailItems = [];
    const comboMap = new Map();

    filteredReviews.forEach((item) => {
      if (item.CustomerPackageId || item.PackageName) {
        if (!comboMap.has(item.AppointmentId)) {
          comboMap.set(item.AppointmentId, {
            AppointmentId: item.AppointmentId,
            AppointmentDate: item.AppointmentDate,
            PackageName: item.PackageName || "Gói Combo Spa",
            CustomerPackageId: item.CustomerPackageId,
            PackageImageUrl: item.PackageImageUrl || item.ServiceImageUrl,
            CreatedAt: item.CreatedAt,
            Status: item.Status,
            AdminResponse: item.AdminResponse,
            Rating: item.Rating,
            Comment: item.Comment,
            Images: item.Images || [],
            steps: [],
          });
        }
        comboMap.get(item.AppointmentId).steps.push(item);
      } else {
        retailItems.push(item);
      }
    });

    return {
      retail: retailItems,
      combo: Array.from(comboMap.values()),
    };
  }, [filteredReviews]);

  function chooseReviewable(appointmentId, serviceId) {
    setActiveReviewTab("retail");
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
    setFiles((prevFiles) =>
      prevFiles.filter((_, idx) => idx !== indexToRemove),
    );
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
      setError("Vui lòng chọn dịch vụ lẻ đã hoàn thành để đánh giá.");
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

      setMessage("Gửi đánh giá dịch vụ lẻ thành công.");
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

  async function handleComboSubmit(e) {
    e.preventDefault();
    if (!comboForm.appointmentId) {
      setError("Vui lòng chọn ca hẹn Combo hoàn thành để đánh giá.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const stepReviews = Object.values(comboForm.stepRatings);

      const body = new FormData();
      body.append("appointmentId", comboForm.appointmentId);
      body.append("overallRating", comboForm.overallRating);
      body.append("overallComment", comboForm.overallComment);
      body.append("stepReviews", JSON.stringify(stepReviews));

      files.forEach((file) => body.append("images", file));

      await axiosClient.post("/packages/my/combo-review", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("🎉 Cảm ơn bạn đã gửi đánh giá Gói Combo & Kỹ thuật viên!");
      setComboForm({
        appointmentId: "",
        overallRating: 5,
        overallComment: "",
        stepRatings: {},
      });
      setFiles([]);
      setPreviews([]);
      await loadReviews();
    } catch (err) {
      setError(err.response?.data?.message || "Gửi đánh giá Combo thất bại.");
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
              Ý kiến của bạn là động lực giúp salon nâng cao chất lượng dịch vụ
              mỗi ngày. Hãy chấm sao dịch vụ, kỹ thuật viên phụ trách và gửi
              hình ảnh thực tế từ lịch hẹn đã hoàn thành của bạn.
            </p>
            <div className="rev-hero-actions">
              <Link
                to="/customer/feedback"
                className="rev-btn rev-btn-secondary"
              >
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
          <div className="rev-glass-panel rev-form-container">
            <div className="rev-section-title">
              <div className="rev-title-badge">01</div>
              <div className="rev-title-content">
                <h2>Viết đánh giá của bạn</h2>
                <p>Chia sẻ cảm nhận thật và đính kèm hình ảnh thực tế.</p>
              </div>
            </div>

            {/* MAIN REVIEW TABS */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 20,
                borderBottom: "2px solid #fce7f3",
                paddingBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveReviewTab("retail")}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "none",
                  background:
                    activeReviewTab === "retail"
                      ? "linear-gradient(135deg, #ec4899, #db2777)"
                      : "#f1f5f9",
                  color: activeReviewTab === "retail" ? "#ffffff" : "#475569",
                  boxShadow:
                    activeReviewTab === "retail"
                      ? "0 4px 12px rgba(236,72,153,0.3)"
                      : "none",
                }}
              >
                💇 Đánh Giá Dịch Vụ Lẻ ({retailReviewables.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveReviewTab("combo")}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "none",
                  background:
                    activeReviewTab === "combo"
                      ? "linear-gradient(135deg, #ec4899, #db2777)"
                      : "#f1f5f9",
                  color: activeReviewTab === "combo" ? "#ffffff" : "#475569",
                  boxShadow:
                    activeReviewTab === "combo"
                      ? "0 4px 12px rgba(236,72,153,0.3)"
                      : "none",
                }}
              >
                📦 Đánh Giá Gói Combo & KTV ({comboReviewables.length})
              </button>
            </div>

            {/* TAB 1: FORM ĐÁNH GIÁ DỊCH VỤ LẺ */}
            {activeReviewTab === "retail" ? (
              <form onSubmit={submitReview} className="rev-form-fields">
                <label className="rev-label">
                  Chọn dịch vụ lẻ hoàn thành cần đánh giá
                  <select
                    className="rev-select"
                    value={
                      form.appointmentId && form.serviceId
                        ? `${form.appointmentId}|${form.serviceId}`
                        : ""
                    }
                    onChange={(e) => {
                      const [appointmentId, serviceId] =
                        e.target.value.split("|");
                      setForm({ ...form, appointmentId, serviceId });
                    }}
                  >
                    <option value="">Chọn một dịch vụ lẻ...</option>
                    {retailReviewables.map((item) => (
                      <option
                        key={`${item.AppointmentId}-${item.ServiceId}`}
                        value={`${item.AppointmentId}|${item.ServiceId}`}
                      >
                        💇 #{item.AppointmentId} - {item.ServiceName} (
                        {formatDate(item.AppointmentDate)})
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
                        {selectedService.ServiceDescription ||
                          "Dịch vụ làm đẹp cao cấp từ chuyên gia chăm sóc sắc đẹp."}
                      </p>
                      <div className="rev-context-tags">
                        <span className="rev-badge">
                          Mã #{selectedService.AppointmentId}
                        </span>
                        <span className="rev-badge">
                          {formatDate(selectedService.AppointmentDate)}
                        </span>
                        <span className="rev-badge">
                          {selectedService.StartTime} -{" "}
                          {selectedService.EndTime}
                        </span>
                        <span className="rev-badge rev-badge-price">
                          {money(selectedService.Price)}
                        </span>
                        {selectedService.EmployeeName && (
                          <span className="rev-badge rev-badge-tech">
                            💇 KTV: {selectedService.EmployeeName}
                          </span>
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
                    <span className="rev-rating-hint">
                      {form.serviceRating} / 5 sao
                    </span>
                  </div>

                  <div className="rev-rating-box">
                    <span className="rev-rating-title">
                      Kỹ thuật viên phụ trách
                    </span>
                    {renderNewStars(form.technicianRating, (value) =>
                      setForm({ ...form, technicianRating: value }),
                    )}
                    <span className="rev-rating-hint">
                      {form.technicianRating} / 5 sao
                    </span>
                  </div>
                </div>

                <label className="rev-label">
                  Nội dung nhận xét & góp ý
                  <textarea
                    className="rev-textarea"
                    rows="4"
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                    placeholder="Hài lòng của bạn là gì? Thái độ phục vụ của nhân viên ra sao? Chia sẻ trải nghiệm thực tế để salon hoàn thiện hơn nhé..."
                  />
                  <span className="rev-input-limit">
                    {form.comment.length} / 500 ký tự
                  </span>
                </label>

                <label className="rev-label">
                  Đăng tải hình ảnh thực tế
                  <div className="rev-upload-zone">
                    <span className="rev-upload-icon">📸</span>
                    <span className="rev-upload-title">
                      Nhấp để tải ảnh lên
                    </span>
                    <span className="rev-upload-subtitle">
                      Định dạng JPG, PNG, WEBP. Chọn tối đa 6 hình ảnh thực tế.
                    </span>
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

                <button
                  className="rev-btn rev-btn-primary"
                  style={{ width: "100%", height: "50px", marginTop: "10px" }}
                  disabled={submitting}
                >
                  {submitting
                    ? "Đang gửi đánh giá của bạn..."
                    : "Gửi Đánh Giá Dịch Vụ Lẻ"}
                </button>
              </form>
            ) : (
              /* TAB 2: FORM ĐÁNH GIÁ COMBO & TAY NGHỀ KTV */
              <form onSubmit={handleComboSubmit} className="rev-form-fields">
                <label className="rev-label">
                  Chọn ca hẹn Combo hoàn thành cần đánh giá
                  <select
                    className="rev-select"
                    value={comboForm.appointmentId}
                    onChange={(e) => handleSelectComboAppt(e.target.value)}
                  >
                    <option value="">Chọn ca hẹn Combo hoàn thành...</option>
                    {comboReviewables.map((c) => (
                      <option key={c.appointmentId} value={c.appointmentId}>
                        📦 Combo #{c.appointmentId} - {c.packageName} (
                        {formatDate(c.appointmentDate)})
                      </option>
                    ))}
                  </select>
                </label>

                {selectedComboAppt && (
                  <div
                    style={{
                      background: "#fdf2f8",
                      border: "1px solid #fbcfe8",
                      borderRadius: 14,
                      padding: 14,
                      margin: "10px 0",
                    }}
                  >
                    <b
                      style={{
                        color: "#be185d",
                        fontSize: 13,
                        display: "block",
                        marginBottom: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      ✂️ CHẤM SAO VÀ NHẬN XÉT TAY NGHỀ TỪNG KỸ THUẬT VIÊN:
                    </b>
                    {selectedComboAppt.services.map((s, idx) => {
                      const stepInfo = comboForm.stepRatings[s.ServiceId] || {};
                      const ratingVal = stepInfo.rating || 5;
                      const commentVal = stepInfo.comment || "";
                      const techName =
                        s.StepTechnicianName || s.EmployeeName || "KTV Salon";
                      const techAvatar =
                        s.StepTechnicianAvatar || s.EmployeeImageUrl || "";

                      return (
                        <div
                          key={idx}
                          style={{
                            background: "#ffffff",
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid #fbcfe8",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <b style={{ color: "#831843", fontSize: 13 }}>
                              {idx + 1}. {s.ServiceName}
                            </b>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: "#fdf2f8",
                                padding: "3px 10px",
                                borderRadius: 12,
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              <img
                                src={imageUrl(techAvatar)}
                                alt={techName}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                              <b style={{ fontSize: 11, color: "#be185d" }}>
                                KTV: {techName}
                              </b>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              Chấm tay nghề:
                            </span>
                            {renderNewStars(ratingVal, (val) => {
                              setComboForm((f) => ({
                                ...f,
                                stepRatings: {
                                  ...f.stepRatings,
                                  [s.ServiceId]: {
                                    ...f.stepRatings[s.ServiceId],
                                    rating: val,
                                  },
                                },
                              }));
                            })}
                          </div>

                          <input
                            type="text"
                            placeholder={`Ghi chú nhận xét riêng cho KTV ${techName}...`}
                            value={commentVal}
                            onChange={(e) => {
                              setComboForm((f) => ({
                                ...f,
                                stepRatings: {
                                  ...f.stepRatings,
                                  [s.ServiceId]: {
                                    ...f.stepRatings[s.ServiceId],
                                    comment: e.target.value,
                                  },
                                },
                              }));
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              fontSize: 12,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="rev-rating-grid">
                  <div
                    className="rev-rating-box"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <span className="rev-rating-title">
                      Chấm sao tổng thể trải nghiệm Ca hẹn Combo này
                    </span>
                    {renderNewStars(comboForm.overallRating, (value) =>
                      setComboForm({ ...comboForm, overallRating: value }),
                    )}
                    <span className="rev-rating-hint">
                      {comboForm.overallRating} / 5 sao
                    </span>
                  </div>
                </div>

                <label className="rev-label">
                  Nội dung nhận xét tổng thể Gói Combo
                  <textarea
                    className="rev-textarea"
                    rows="4"
                    value={comboForm.overallComment}
                    onChange={(e) =>
                      setComboForm({
                        ...comboForm,
                        overallComment: e.target.value,
                      })
                    }
                    placeholder="Chia sẻ trải nghiệm tổng thể khi làm gói Combo tại salon..."
                  />
                </label>

                <label className="rev-label">
                  Đăng tải hình ảnh thực tế
                  <div className="rev-upload-zone">
                    <span className="rev-upload-icon">📸</span>
                    <span className="rev-upload-title">
                      Nhấp để tải ảnh thực tế lên
                    </span>
                    <span className="rev-upload-subtitle">
                      Định dạng JPG, PNG, WEBP. Chọn tối đa 6 hình ảnh thực tế.
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFiles}
                    />
                  </div>
                </label>

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

                <button
                  className="rev-btn rev-btn-primary"
                  style={{
                    width: "100%",
                    height: "50px",
                    marginTop: "10px",
                    background:
                      "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                  }}
                  disabled={submitting}
                >
                  {submitting
                    ? "Đang gửi đánh giá..."
                    : "🚀 Gửi Đánh Giá Gói Combo & KTV"}
                </button>
              </form>
            )}
          </div>

          {/* Sidebar Waiting Reviews */}
          <aside className="rev-glass-panel rev-sidebar">
            <h3>
              {activeReviewTab === "combo"
                ? "Ca hẹn Combo chờ đánh giá"
                : "Dịch vụ lẻ chờ đánh giá"}
            </h3>

            {activeReviewTab === "retail" ? (
              retailReviewables.length === 0 ? (
                <div className="rev-empty" style={{ padding: "40px 20px" }}>
                  <span className="rev-empty-icon">✨</span>
                  <h4>Tuyệt vời!</h4>
                  <p>Bạn đã hoàn thành việc đánh giá tất cả các dịch vụ lẻ.</p>
                </div>
              ) : (
                <div className="rev-waiting-scroller">
                  {retailReviewables.map((item) => (
                    <div
                      className="rev-waiting-card"
                      key={`${item.AppointmentId}-${item.ServiceId}`}
                    >
                      <div className="rev-waiting-header">
                        <span className="rev-waiting-id">
                          Ca hẹn #{item.AppointmentId}
                        </span>
                        <span className="rev-waiting-date">
                          {formatDate(item.AppointmentDate)}
                        </span>
                      </div>
                      <div className="rev-waiting-list-services">
                        <button
                          type="button"
                          className="rev-waiting-btn"
                          onClick={() =>
                            chooseReviewable(item.AppointmentId, item.ServiceId)
                          }
                        >
                          <span className="rev-waiting-btn-name">
                            {item.ServiceName}
                          </span>
                          <span className="rev-waiting-btn-action">
                            Đánh giá
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : comboReviewables.length === 0 ? (
              <div className="rev-empty" style={{ padding: "40px 20px" }}>
                <span className="rev-empty-icon">✨</span>
                <h4>Tuyệt vời!</h4>
                <p>Bạn đã hoàn thành việc đánh giá tất cả các ca hẹn Combo.</p>
              </div>
            ) : (
              <div className="rev-waiting-scroller">
                {comboReviewables.map((c) => (
                  <div
                    className="rev-waiting-card combo-waiting-card"
                    key={c.appointmentId}
                    style={{
                      background:
                        "linear-gradient(135deg, #fff5f8 0%, #fdf2f8 100%)",
                      border: "1.5px solid #fbcfe8",
                      borderRadius: 14,
                      padding: "12px 14px",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      className="rev-waiting-header"
                      style={{
                        marginBottom: 6,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        className="rev-waiting-id"
                        style={{ color: "#db2777", fontWeight: 800 }}
                      >
                        📦 Combo #{c.appointmentId}
                      </span>
                      <span className="rev-waiting-date">
                        {formatDate(c.appointmentDate)}
                      </span>
                    </div>
                    <b
                      style={{
                        color: "#831843",
                        fontSize: 13,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {c.packageName}
                    </b>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      gồm {c.services.length} bước dịch vụ & KTV phụ trách
                    </span>
                    <button
                      type="button"
                      className="btn-review-combo-direct"
                      style={{
                        width: "100%",
                        background:
                          "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        boxShadow: "0 4px 10px rgba(236,72,153,0.25)",
                      }}
                      onClick={() => {
                        handleSelectComboAppt(c.appointmentId);
                        window.scrollTo({ top: 380, behavior: "smooth" });
                      }}
                    >
                      ⭐ Đánh Giá Combo Này →
                    </button>
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
            <select
              className="rev-select"
              style={{ height: "48px", fontWeight: 800 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Tất cả danh mục (Dịch vụ & Combo)</option>
              <option value="RETAIL">💇 Dịch vụ lẻ</option>
              <option value="COMBO">📦 Gói Combo Spa</option>
            </select>

            <input
              className="rev-search-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="🔍 Tìm kiếm theo tên dịch vụ, gói combo, kỹ thuật viên..."
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
              <p>
                Vui lòng chờ giây lát trong khi chúng tôi chuẩn bị lịch sử đánh
                giá của bạn.
              </p>
            </div>
          ) : groupedHistoryReviews.retail.length === 0 &&
            groupedHistoryReviews.combo.length === 0 ? (
            <div className="rev-empty">
              <span className="rev-empty-icon">📭</span>
              <h4>Không tìm thấy kết quả</h4>
              <p>
                Chưa có lịch sử đánh giá nào phù hợp với bộ lọc tìm kiếm của
                bạn.
              </p>
            </div>
          ) : (
            <div className="rev-review-list">
              {/* COMBO HISTORY CARDS */}
              {(categoryFilter === "ALL" || categoryFilter === "COMBO") &&
                groupedHistoryReviews.combo.map((cGroup) => (
                  <article
                    className="rev-card combo-history-card"
                    key={`combo-${cGroup.AppointmentId}`}
                    style={{
                      border: "1.5px solid #fbcfe8",
                      background: "#fffdfd",
                    }}
                  >
                    <div className="rev-card-service">
                      <div className="rev-card-service-top">
                        <div className="rev-card-service-img">
                          <img
                            src={imageUrl(cGroup.PackageImageUrl)}
                            alt={cGroup.PackageName}
                          />
                        </div>
                        <div className="rev-card-service-meta">
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#be185d",
                              background: "#fdf2f8",
                              padding: "2px 8px",
                              borderRadius: 10,
                              display: "inline-block",
                              marginBottom: 4,
                            }}
                          >
                            📦 GÓI COMBO SPA
                          </span>
                          <h4 style={{ color: "#831843" }}>
                            {cGroup.PackageName}
                          </h4>
                          <span className="rev-card-service-id">
                            Mã ca hẹn #{cGroup.AppointmentId}
                          </span>
                        </div>
                      </div>

                      <div className="rev-meta-list">
                        <div className="rev-meta-item">
                          <span className="rev-meta-icon">📅</span>
                          <span>
                            {formatDate(
                              cGroup.AppointmentDate || cGroup.CreatedAt,
                            )}
                          </span>
                        </div>
                        <div className="rev-meta-item">
                          <span className="rev-meta-icon">✂️</span>
                          <span>Gồm {cGroup.steps.length} bước liệu trình</span>
                        </div>
                      </div>
                    </div>

                    <div className="rev-card-body">
                      <div className="rev-card-body-header">
                        <div className="rev-scores-row">
                          <div className="rev-card-score-item">
                            <span className="rev-score-title">Điểm Combo:</span>
                            {renderStarsDisplay(cGroup.Rating)}
                          </div>
                        </div>
                        <span
                          className={`rev-status-pill ${String(cGroup.Status || "approved").toLowerCase()}`}
                        >
                          {cGroup.Status === "APPROVED"
                            ? "Đã duyệt"
                            : cGroup.Status === "PENDING"
                              ? "Đang chờ"
                              : "Đã ẩn"}
                        </span>
                      </div>

                      {/* STEP BREAKDOWN & TECHNICIAN RATINGS */}
                      <div
                        style={{
                          background: "#fdf2f8",
                          borderRadius: 12,
                          padding: "10px 14px",
                          margin: "10px 0",
                          border: "1px solid #fbcfe8",
                        }}
                      >
                        <b
                          style={{
                            fontSize: 11,
                            color: "#be185d",
                            textTransform: "uppercase",
                            display: "block",
                            marginBottom: 8,
                          }}
                        >
                          ✂️ ĐÁNH GIÁ TAY NGHỀ KTV THEO TỪNG BƯỚC:
                        </b>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {cGroup.steps.map((st, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                background: "#ffffff",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              <b
                                style={{
                                  fontSize: 12,
                                  color: "#831843",
                                  display: "block",
                                }}
                              >
                                {sIdx + 1}. {st.ServiceName}
                              </b>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: 4,
                                }}
                              >
                                <span
                                  style={{ fontSize: 11, color: "#64748b" }}
                                >
                                  👤 {st.EmployeeName || "KTV Salon"}
                                </span>
                                {renderStarsDisplay(
                                  st.TechnicianRating || st.Rating,
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {cGroup.Comment && (
                        <p className="rev-comment-text">“ {cGroup.Comment} ”</p>
                      )}

                      {cGroup.Images?.length > 0 && (
                        <div className="rev-card-gallery">
                          {cGroup.Images.map((img, imgIndex) => (
                            <div
                              className="rev-gallery-thumbnail"
                              key={img.ReviewImageId || img.ImageUrl}
                              onClick={() =>
                                openLightbox(cGroup.Images, imgIndex)
                              }
                            >
                              <img
                                src={imageUrl(img.ImageUrl)}
                                alt="Real review"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {cGroup.AdminResponse && (
                        <div className="rev-admin-bubble">
                          <div className="rev-admin-bubble-header">
                            <span>🌸 Phản hồi chính thức từ Salon</span>
                          </div>
                          <p>{cGroup.AdminResponse}</p>
                        </div>
                      )}

                      <div className="rev-card-footer">
                        <span>
                          Thời gian gửi: {formatDateTime(cGroup.CreatedAt)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}

              {/* RETAIL HISTORY CARDS */}
              {(categoryFilter === "ALL" || categoryFilter === "RETAIL") &&
                groupedHistoryReviews.retail.map((review) => (
                  <article className="rev-card" key={review.ReviewId}>
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
                          <span className="rev-card-service-id">
                            Mã đánh giá #{review.ReviewId}
                          </span>
                        </div>
                      </div>

                      <div className="rev-meta-list">
                        <div className="rev-meta-item">
                          <span className="rev-meta-icon">🔑</span>
                          <span>Lịch hẹn #{review.AppointmentId}</span>
                        </div>
                        <div className="rev-meta-item">
                          <span className="rev-meta-icon">📅</span>
                          <span>
                            {formatDate(
                              review.AppointmentDate || review.CreatedAt,
                            )}
                          </span>
                        </div>
                        <div className="rev-meta-item">
                          <span className="rev-meta-icon">🕒</span>
                          <span>
                            {review.StartTime
                              ? `${review.StartTime} - ${review.EndTime}`
                              : "Thời gian làm"}
                          </span>
                        </div>
                        <div
                          className="rev-meta-item"
                          style={{
                            fontWeight: "700",
                            color: "var(--rev-primary)",
                          }}
                        >
                          <span className="rev-meta-icon">💰</span>
                          <span>{money(review.Price)}</span>
                        </div>
                      </div>

                      <div className="rev-card-tech">
                        <div className="rev-tech-avatar">
                          {review.EmployeeImageUrl ? (
                            <img
                              src={imageUrl(review.EmployeeImageUrl)}
                              alt={review.EmployeeName}
                            />
                          ) : (
                            <span>💇</span>
                          )}
                        </div>
                        <div className="rev-tech-details">
                          <span className="rev-tech-label">Kỹ thuật viên</span>
                          <span className="rev-tech-name">
                            {review.EmployeeName || "Chưa phân công"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rev-card-body">
                      <div className="rev-card-body-header">
                        <div className="rev-scores-row">
                          <div className="rev-card-score-item">
                            <span className="rev-score-title">Dịch vụ:</span>
                            {renderStarsDisplay(review.Rating)}
                          </div>
                          <div className="rev-card-score-item">
                            <span className="rev-score-title">
                              Kỹ thuật viên:
                            </span>
                            {renderStarsDisplay(
                              review.TechnicianRating || review.Rating,
                            )}
                          </div>
                        </div>

                        <span
                          className={`rev-status-pill ${String(review.Status || "approved").toLowerCase()}`}
                        >
                          {review.Status === "APPROVED"
                            ? "Đã duyệt"
                            : review.Status === "PENDING"
                              ? "Đang chờ"
                              : "Đã ẩn"}
                        </span>
                      </div>

                      {review.Comment && (
                        <p className="rev-comment-text">“ {review.Comment} ”</p>
                      )}

                      {review.Images?.length > 0 && (
                        <div className="rev-card-gallery">
                          {review.Images.map((img, imgIndex) => (
                            <div
                              className="rev-gallery-thumbnail"
                              key={img.ReviewImageId || img.ImageUrl}
                              onClick={() =>
                                openLightbox(review.Images, imgIndex)
                              }
                            >
                              <img
                                src={imageUrl(img.ImageUrl)}
                                alt="Real review"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {review.AdminResponse && (
                        <div className="rev-admin-bubble">
                          <div className="rev-admin-bubble-header">
                            <span>🌸 Phản hồi chính thức từ Salon</span>
                          </div>
                          <p>{review.AdminResponse}</p>
                        </div>
                      )}

                      <div className="rev-card-footer">
                        <span>
                          Thời gian gửi: {formatDateTime(review.CreatedAt)}
                        </span>
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
          <div
            className="rev-lightbox-backdrop"
            onClick={() => setDetail(null)}
          >
            <div
              className="rev-glass-panel"
              style={{
                width: "min(600px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="rev-lightbox-close"
                style={{ top: "16px", right: "16px" }}
                onClick={() => setDetail(null)}
              >
                ×
              </button>

              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: "900",
                  color: "var(--rev-primary)",
                  marginBottom: "20px",
                }}
              >
                Chi tiết đánh giá
              </h2>

              <div
                className="rev-context-card"
                style={{ marginBottom: "20px" }}
              >
                <div className="rev-context-thumb">
                  {detail.ServiceImageUrl ? (
                    <img
                      src={imageUrl(detail.ServiceImageUrl)}
                      alt={detail.ServiceName}
                    />
                  ) : (
                    <span>💆</span>
                  )}
                </div>
                <div className="rev-context-info">
                  <h3>{detail.ServiceName}</h3>
                  <p className="rev-context-desc">
                    {detail.ServiceDescription ||
                      "Dịch vụ làm đẹp cao cấp từ chuyên gia chăm sóc sắc đẹp."}
                  </p>
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
                  <span className="rev-rating-hint">
                    {detail.TechnicianRating || detail.Rating}/5 sao
                  </span>
                </div>
              </div>

              <div
                className="rev-form-fields"
                style={{ display: "grid", gap: "12px", marginBottom: "20px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px dashed rgba(138, 91, 112, 0.12)",
                    paddingBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "700",
                      color: "var(--rev-text-muted)",
                    }}
                  >
                    Mã lịch hẹn:
                  </span>
                  <span style={{ fontWeight: "800" }}>
                    #{detail.AppointmentId}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px dashed rgba(138, 91, 112, 0.12)",
                    paddingBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "700",
                      color: "var(--rev-text-muted)",
                    }}
                  >
                    Ngày thực hiện:
                  </span>
                  <span style={{ fontWeight: "800" }}>
                    {formatDate(detail.AppointmentDate)}
                  </span>
                </div>
                {detail.EmployeeName && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px dashed rgba(138, 91, 112, 0.12)",
                      paddingBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "700",
                        color: "var(--rev-text-muted)",
                      }}
                    >
                      Kỹ thuật viên:
                    </span>
                    <span
                      style={{
                        fontWeight: "800",
                        color: "var(--rev-secondary)",
                      }}
                    >
                      {detail.EmployeeName}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px dashed rgba(138, 91, 112, 0.12)",
                    paddingBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "700",
                      color: "var(--rev-text-muted)",
                    }}
                  >
                    Thời gian gửi:
                  </span>
                  <span style={{ fontWeight: "800" }}>
                    {formatDateTime(detail.CreatedAt)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px dashed rgba(138, 91, 112, 0.12)",
                    paddingBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "700",
                      color: "var(--rev-text-muted)",
                    }}
                  >
                    Trạng thái:
                  </span>
                  <span
                    className={`rev-status-pill ${String(detail.Status || "APPROVED").toLowerCase()}`}
                  >
                    {detail.Status === "APPROVED"
                      ? "Đã duyệt"
                      : detail.Status === "PENDING"
                        ? "Đang chờ"
                        : "Đã ẩn"}
                  </span>
                </div>
              </div>

              {detail.Comment && (
                <div style={{ marginBottom: "20px" }}>
                  <label className="rev-label" style={{ marginBottom: "8px" }}>
                    Nhận xét khách hàng
                  </label>
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
            <div
              className="rev-lightbox-container"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="rev-lightbox-close" onClick={closeLightbox}>
                ×
              </button>

              <div className="rev-lightbox-img-wrapper">
                {/* Navigation arrows (if multiple images) */}
                {lightbox.images.length > 1 && (
                  <button
                    className="rev-lightbox-nav rev-lightbox-prev"
                    onClick={prevLightboxImage}
                  >
                    ‹
                  </button>
                )}

                <img
                  className="rev-lightbox-img"
                  src={imageUrl(lightbox.images[lightbox.index].ImageUrl)}
                  alt={`Real photo ${lightbox.index + 1}`}
                />

                {lightbox.images.length > 1 && (
                  <button
                    className="rev-lightbox-nav rev-lightbox-next"
                    onClick={nextLightboxImage}
                  >
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
                      onClick={() =>
                        setLightbox((prev) => ({ ...prev, index: dotIdx }))
                      }
                    >
                      <img
                        src={imageUrl(img.ImageUrl)}
                        alt={`Thumbnail ${dotIdx + 1}`}
                      />
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
