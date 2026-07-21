import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";
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
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleString("vi-VN");
}

function timeText(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusClass(value) {
  return `admin-category-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function stars(value) {
  const n = Number(value || 0);
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

function renderAvatar(item, size = 42) {
  const url = item?.AvatarUrl ? resolveFileUrl(item.AvatarUrl) : "";
  if (url) {
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <img
          src={url}
          alt={item?.FullName || "Customer"}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid #d6b57e",
            boxShadow: "0 2px 8px rgba(120,80,40,0.15)"
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const next = e.currentTarget.nextSibling;
            if (next) next.style.display = "flex";
          }}
        />
        <div
          style={{
            display: "none",
            width: size,
            height: size,
            borderRadius: "50%",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #c39c63, #edd8b8)",
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: size * 0.42,
          }}
        >
          {String(item?.FullName || "?").trim().charAt(0).toUpperCase()}
        </div>
      </div>
    );
  }

  const gradients = [
    "linear-gradient(135deg, #c39c63, #edd8b8)", // Gold
    "linear-gradient(135deg, #8a653a, #3c2412)", // Bronze
    "linear-gradient(135deg, #6e84a3, #2f435e)", // Steel Blue
    "linear-gradient(135deg, #c28ba8, #603a4f)", // Plum Rose
    "linear-gradient(135deg, #bfa88c, #635340)", // Taupe Gold
    "linear-gradient(135deg, #599c8f, #235248)", // Sage Green
  ];
  const charCode = item?.FullName ? item.FullName.charCodeAt(0) : 65;
  const background = gradients[charCode % gradients.length];
  const letter = String(item?.FullName || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: background,
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: size * 0.42,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 3px 10px rgba(120,80,40,0.12)",
        border: "2px solid #ffffff",
        textShadow: "0 1px 2px rgba(0,0,0,0.1)",
        flexShrink: 0
      }}
    >
      {letter}
    </div>
  );
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

  const [responseModal, setResponseModal] = useState(null);
  const [responseForm, setResponseForm] = useState(emptyResponse);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const scrollToItem = (id, type = "review") => {
    let attempts = 0;
    const checkAndScroll = () => {
      const element = document.getElementById(`${type}-card-${id}`);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 25px 6px rgba(214, 181, 126, 0.6)";
        setTimeout(() => {
          element.style.borderColor = "";
          element.style.boxShadow = "";
        }, 3500);
      } else if (attempts < 15) {
        attempts++;
        setTimeout(checkAndScroll, 100);
      } else {
        scrollToGrid();
      }
    };
    setTimeout(checkAndScroll, 100);
  };

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
          "Không tải được danh sách đánh giá",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      load();
      return;
    }
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  }, [filters.rating, filters.status, filters.fromDate, filters.toDate]);

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter") {
      shouldScrollRef.current = true;
      load().then(() => {
        if (shouldScrollRef.current) {
          scrollToGrid();
          shouldScrollRef.current = false;
        }
      });
    }
  };

  const handleFilterClick = () => {
    shouldScrollRef.current = true;
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  };

  const handleClearFilters = () => {
    const wasEmpty = filters.rating === "" && filters.status === "" && filters.fromDate === "" && filters.toDate === "";
    setFilters({
      keyword: "",
      rating: "",
      status: "",
      fromDate: "",
      toDate: "",
    });
    if (wasEmpty) {
      shouldScrollRef.current = true;
      load().then(() => {
        if (shouldScrollRef.current) {
          scrollToGrid();
          shouldScrollRef.current = false;
        }
      });
    } else {
      shouldScrollRef.current = true;
    }
  };

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
    setSuccessMsg("");
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(`Bạn có chắc muốn chuyển review #${item.ReviewId} sang trạng thái ${nextStatus}?`);
    if (!ok) return;

    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.patch(`/admin/reviews/${item.ReviewId}/status`, {
        Status: nextStatus,
      });

      setSuccessMsg(`Đã đổi trạng thái review #${item.ReviewId} thành ${nextStatus}!`);
      await load();
      scrollToItem(item.ReviewId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái review thất bại",
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
      setSuccessMsg("");

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
      scrollToItem(responseModal.ReviewId);
      setSuccessMsg("Cập nhật phản hồi review thành công!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu phản hồi thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeResponse(item) {
    if (!window.confirm(`Bạn muốn xóa phản hồi admin của đánh giá #${item.ReviewId}?`))
      return;

    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.patch(
        `/admin/reviews/${item.ReviewId}/remove-response`,
      );

      setSuccessMsg(`Đã xóa phản hồi của đánh giá #${item.ReviewId}`);
      await load();
      scrollToItem(item.ReviewId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa phản hồi thất bại",
      );
    }
  }

  return (
    <section className="admin-page admin-reviews-page">
      <style>{`
        .admin-reviews-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-reviews-hero {
          padding: 32px;
          border-radius: 24px;
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          box-shadow: 0 12px 30px rgba(31, 20, 14, 0.15);
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(214, 181, 126, 0.2);
        }

        .admin-reviews-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-reviews-hero p {
          margin: 0;
          color: #d8cbb5;
          font-size: 14.5px;
          opacity: 0.9;
          max-width: 600px;
          line-height: 1.5;
        }

        .admin-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #d6b57e;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .admin-refresh-btn {
          border: 0;
          border-radius: 50px;
          padding: 12px 28px;
          font-weight: 700;
          color: #1f140e;
          background: linear-gradient(135deg, #d6b57e, #f0dfbf);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(214, 181, 126, 0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .admin-refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(214, 181, 126, 0.4);
          background: linear-gradient(135deg, #c7a36c, #e2d0ad);
        }

        .admin-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .admin-stat-card {
          background: #ffffff;
          padding: 24px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          gap: 20px;
          border: 1px solid #f0f0f0;
          transition: all 0.3s ease;
        }

        .admin-stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px rgba(31, 20, 14, 0.05);
          border-color: rgba(214, 181, 126, 0.3);
        }

        .admin-stat-icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #fbf9f6;
          font-size: 26px;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.03);
          color: #3a2519;
          border: 1px solid #f0e9df;
        }

        .admin-stat-card p {
          margin: 0;
          font-size: 13px;
          color: #8c7e74;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .admin-stat-card h3 {
          margin: 4px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f140e;
        }

        .admin-filter-panel {
          background: #ffffff;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(31, 20, 14, 0.04);
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(214, 181, 126, 0.15);
          backdrop-filter: blur(8px);
        }

        @media (max-width: 1024px) {
          .admin-filter-panel {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .admin-filter-panel {
            grid-template-columns: 1fr;
          }
        }

        .admin-filter-panel input,
        .admin-filter-panel select {
          padding: 11px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          color: #5c4a3c;
          background: #ffffff;
          outline: none;
          transition: all 0.3s;
        }

        .admin-filter-panel input:focus,
        .admin-filter-panel select:focus {
          border-color: #d6b57e;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.15);
          background: #fdfbf9;
        }

        .admin-reviews-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .luxury-review-card {
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid #eaddca;
          box-shadow: 0 8px 24px rgba(31, 20, 14, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 24px;
        }

        .luxury-review-card:hover {
          box-shadow: 0 16px 36px rgba(48, 30, 15, 0.08);
          border-color: #d6b57e;
        }

        .review-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border-bottom: 1px dashed rgba(214, 181, 126, 0.25);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        @media (max-width: 640px) {
          .review-card-head {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .customer-meta {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .customer-meta-text h4 {
          margin: 0;
          font-size: 16.5px;
          font-weight: 700;
          color: #1f140e;
        }

        .customer-meta-text span {
          font-size: 12.5px;
          color: #8c7e74;
        }

        .review-badges-column {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        @media (max-width: 640px) {
          .review-badges-column {
            align-items: flex-start;
          }
        }

        .review-rating-stars {
          font-size: 16px;
          color: #d6b57e;
          letter-spacing: 1px;
        }

        .review-body-text {
          font-size: 14.5px;
          color: #3a2519;
          line-height: 1.6;
          margin: 0 0 16px 0;
          font-style: italic;
        }

        .review-connections {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }

        .connection-chip {
          background: #faf8f5;
          border: 1px solid #f0e9df;
          border-radius: 12px;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .connection-chip img {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }

        .admin-reply-box {
          background: linear-gradient(135deg, #fcfbf9 0%, #f6f0e5 100%);
          border-left: 4px solid #d6b57e;
          border-radius: 16px;
          padding: 16px 20px;
          margin-top: 8px;
          position: relative;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.01);
        }

        .admin-reply-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .admin-reply-header strong {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
        }

        .admin-reply-header span {
          font-size: 11px;
          color: #a08e84;
        }

        .admin-reply-box p {
          margin: 0;
          font-size: 13.5px;
          color: #5c4a3c;
          line-height: 1.5;
        }

        .review-card-footer {
          display: flex;
          gap: 8px;
          border-top: 1px solid #ebdcc5;
          padding-top: 16px;
          margin-top: 16px;
        }

        .card-btn {
          flex: 1;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          padding: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          background: #ffffff;
          color: #5c4a3c;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .card-btn:hover {
          background: #faf8f5;
          color: #1f140e;
          border-color: #d6b57e;
        }

        .card-btn.primary {
          background: linear-gradient(135deg, #d6b57e, #f0dfbf);
          color: #1f140e;
          border: 0;
        }

        .card-btn.primary:hover {
          background: linear-gradient(135deg, #c7a36c, #e2d0ad);
          box-shadow: 0 4px 12px rgba(214, 181, 126, 0.25);
        }

        .card-btn.danger {
          color: #d83b01;
          border-color: rgba(216, 59, 1, 0.25);
        }

        .card-btn.danger:hover {
          background: #fff4f4;
          border-color: #d83b01;
        }

        /* Modal reply editor split screen */
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(31, 20, 14, 0.6);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }

        .admin-modal-wrapper {
          background: #ffffff;
          border-radius: 28px;
          border: 1px solid #ebdcc5;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(31, 20, 14, 0.25);
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          width: 100%;
          max-width: 800px;
          position: relative;
        }

        .admin-modal-header {
          padding: 24px 32px;
          background: #faf8f5;
          border-bottom: 1px solid #ebdcc5;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .admin-modal-header h3 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          color: #1f140e;
        }

        .admin-modal-close {
          background: transparent;
          border: 0;
          font-size: 24px;
          cursor: pointer;
          color: #8c7e74;
          transition: all 0.2s;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }

        .admin-modal-close:hover {
          background: rgba(31, 20, 14, 0.05);
          color: #1f140e;
          transform: rotate(90deg);
        }

        .admin-modal-body.reply-editor {
          padding: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          overflow-y: auto;
          max-height: calc(85vh - 140px);
        }

        @media (max-width: 768px) {
          .admin-modal-body.reply-editor {
            grid-template-columns: 1fr;
          }
        }

        .reply-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .reply-form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13.5px;
          font-weight: 700;
          color: #5c4a3c;
        }

        .reply-form textarea,
        .reply-form select {
          padding: 12px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          color: #5c4a3c;
          outline: none;
          transition: all 0.3s;
          background: #ffffff;
        }

        .reply-form textarea:focus,
        .reply-form select:focus {
          border-color: #d6b57e;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.15);
          background: #fdfbf9;
        }

        .admin-modal-footer {
          padding: 20px 32px;
          background: #faf8f5;
          border-top: 1px solid #ebdcc5;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .preview-pane-column {
          border-left: 1px solid rgba(214, 181, 126, 0.25);
          padding-left: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        @media (max-width: 768px) {
          .preview-pane-column {
            border-left: 0;
            padding-left: 0;
            border-top: 1px solid rgba(214, 181, 126, 0.25);
            padding-top: 24px;
          }
        }

        .admin-preview-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
        }

        .admin-category-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(31, 20, 14, 0.75);
          backdrop-filter: blur(4px);
          color: #fff;
          padding: 5px 12px;
          border-radius: 50px;
          font-size: 11px;
          font-weight: 700;
          z-index: 2;
        }

        .admin-category-status {
          position: absolute;
          top: 14px;
          left: 14px;
          padding: 4px 10px;
          border-radius: 50px;
          font-size: 10px;
          font-weight: 700;
          z-index: 2;
        }

        .admin-status-pending {
          background: #fff8e1;
          color: #b78103;
          border: 1px solid rgba(183, 129, 3, 0.2);
        }

        .admin-status-approved {
          background: #e8f7ec;
          color: #107c41;
          border: 1px solid rgba(16, 124, 65, 0.2);
        }

        .admin-status-rejected {
          background: #fdf0f0;
          color: #a80000;
          border: 1px solid rgba(168, 0, 0, 0.2);
        }

        .admin-status-hidden {
          background: #f4f6f7;
          color: #5a6b7c;
          border: 1px solid rgba(90, 107, 124, 0.2);
        }

        .admin-clear-btn {
          border: 1px solid #ebdcc5;
          border-radius: 50px;
          padding: 12px 20px;
          font-weight: 700;
          color: #5c4a3c;
          background: #ffffff;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 14px;
        }

        .admin-clear-btn:hover {
          background: #faf8f5;
          border-color: #d6b57e;
        }

        .admin-empty {
          padding: 40px;
          text-align: center;
          color: #8c7e74;
          font-weight: 600;
          font-size: 16px;
          border: 1px solid #f0e9df;
          background: #fffcf8;
          border-radius: 20px;
        }

        .review-customer-photos {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
          margin-bottom: 16px;
        }

        .review-photo-wrapper {
          width: 80px;
          height: 80px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #ebdcc5;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .review-photo-wrapper:hover {
          transform: scale(1.08);
          border-color: #d6b57e;
          box-shadow: 0 6px 15px rgba(214, 181, 126, 0.25);
        }

        .review-photo-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Lightbox modal for full size view */
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 10, 7, 0.9);
          backdrop-filter: blur(8px);
          display: grid;
          place-items: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        .lightbox-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .lightbox-img {
          max-width: 100%;
          max-height: 80vh;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          border: 2px solid rgba(214, 181, 126, 0.3);
        }

        .lightbox-close {
          position: absolute;
          top: -45px;
          right: 0;
          background: transparent;
          border: 0;
          color: #fff;
          font-size: 32px;
          cursor: pointer;
          opacity: 0.8;
          transition: all 0.2s;
        }

        .lightbox-close:hover {
          opacity: 1;
          transform: scale(1.1);
        }
      `}</style>

      {/* Hero Header */}
      <div className="admin-reviews-hero">
        <div>
          <div className="admin-eyebrow">Reviews Management</div>
          <h1>Quản lý đánh giá khách hàng</h1>
          <p>
            Kiểm tra và kiểm duyệt nội dung nhận xét dịch vụ, chấm điểm chuyên viên Spa, đính kèm phản hồi chính thức từ quản trị viên.
          </p>
        </div>
        <button className="admin-refresh-btn" onClick={load}>
          Làm mới
        </button>
      </div>

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">⭐</div>
          <div>
            <p>Tổng review</p>
            <h3>{stats.total}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Chờ duyệt</p>
            <h3>{stats.pending}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đã duyệt hiển thị</p>
            <h3>{stats.approved}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">★</div>
          <div>
            <p>Rating trung bình bộ lọc</p>
            <h3>{stats.avg.toFixed(1)} / 5.0</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-panel">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm theo khách hàng, dịch vụ, comment..."
        />
        <select
          value={filters.rating}
          onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
        >
          <option value="">Tất cả số sao</option>
          <option value="5">5 Sao ⭐⭐⭐⭐⭐</option>
          <option value="4">4 Sao ⭐⭐⭐⭐</option>
          <option value="3">3 Sao ⭐⭐⭐</option>
          <option value="2">2 Sao ⭐⭐</option>
          <option value="1">1 Sao ⭐</option>
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
        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          <span>Lọc</span>
        </button>
        <button className="admin-clear-btn" onClick={handleClearFilters}>
          Xóa
        </button>
      </div>

      {/* Alerts */}
      {error && <div className="admin-error-card" style={{ marginBottom: 20 }}>{error}</div>}
      {successMsg && (
        <div className="admin-loading-card" style={{ marginBottom: 20, color: "#107c41", borderColor: "rgba(16, 124, 65, 0.2)", background: "#e8f7ec" }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách review & rating...</div>
      ) : (
        <div ref={gridRef} className="admin-reviews-grid">
          {items.map((item) => (
            <div key={item.ReviewId} id={`review-card-${item.ReviewId}`} className="luxury-review-card">
              <div className="review-card-head">
                <div className="customer-meta">
                  {renderAvatar({ AvatarUrl: item.CustomerAvatar, FullName: item.CustomerName }, 48)}
                  <div className="customer-meta-text">
                    <h4>{item.CustomerName}</h4>
                    <span>{item.CustomerEmail} • {dateText(item.CreatedAt)}</span>
                  </div>
                </div>

                <div className="review-badges-column">
                  <div className="review-rating-stars">
                    {stars(item.Rating)}
                  </div>
                  {item.TechnicianRating ? (
                    <div style={{ fontSize: "11px", color: "#8c7e74" }}>
                      Chuyên viên: {stars(item.TechnicianRating)}
                    </div>
                  ) : null}
                  <span className={statusClass(item.Status)}>
                    {item.Status}
                  </span>
                </div>
              </div>

              <div className="review-body">
                <p className="review-body-text">
                  "{item.Comment || "Khách hàng không để lại nhận xét chi tiết."}"
                </p>

                {item.ReviewImages && item.ReviewImages.length > 0 ? (
                  <div className="review-customer-photos">
                    {item.ReviewImages.map((img) => (
                      <div
                        key={img.ReviewImageId}
                        className="review-photo-wrapper"
                        onClick={() => setLightboxPhoto(resolveFileUrl(img.ImageUrl))}
                      >
                        <img src={resolveFileUrl(img.ImageUrl)} alt="Customer Upload" />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="review-connections">
                  <div className="connection-chip">
                    <img src={serviceImage(item.ServiceImage)} alt="service" />
                    <span>Dịch vụ: <strong>{item.ServiceName}</strong></span>
                  </div>
                  {item.EmployeeName ? (
                    <div className="connection-chip">
                      <img src={avatar(item.EmployeeAvatar)} alt="tech" />
                      <span>Chuyên viên: <strong>{item.EmployeeName}</strong></span>
                    </div>
                  ) : null}
                </div>

                {item.AdminResponse ? (
                  <div className="admin-reply-box">
                    <div className="admin-reply-header">
                      <strong>Admin Response</strong>
                      <span>Cập nhật: {dateText(item.UpdatedAt)}</span>
                    </div>
                    <p>{item.AdminResponse}</p>
                  </div>
                ) : null}
              </div>

              <div className="review-card-footer">
                <button className="card-btn primary" onClick={() => openResponse(item)}>
                  Phản hồi 💬
                </button>
                <button className="card-btn" onClick={() => changeStatus(item, "APPROVED")}>
                  Duyệt hiển thị ✓
                </button>
                <button className="card-btn danger" onClick={() => changeStatus(item, "REJECTED")}>
                  Từ chối duyệt ✖
                </button>
                {item.AdminResponse ? (
                  <button className="card-btn danger" onClick={() => removeResponse(item)}>
                    Xóa Reply
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {!items.length ? (
            <div className="admin-empty">
              Không tìm thấy đánh giá nào phù hợp bộ lọc.
            </div>
          ) : null}
        </div>
      )}

      {/* RESPONSE MODAL */}
      {responseModal && (
        <div className="admin-modal-backdrop" onClick={() => setResponseModal(null)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
              <h3>Phản hồi đánh giá #{responseModal.ReviewId}</h3>
              <button className="admin-modal-close" onClick={() => setResponseModal(null)} style={{ color: "#fff" }}>
                &times;
              </button>
            </div>
            <div className="admin-modal-body reply-editor">
              <form className="reply-form" onSubmit={submitResponse}>
                <label>
                  Phản hồi của Admin *
                  <textarea
                    rows={6}
                    value={responseForm.AdminResponse}
                    onChange={(e) => setResponseForm({ ...responseForm, AdminResponse: e.target.value })}
                    placeholder="Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ của spa..."
                    required
                  />
                </label>

                <label>
                  Trạng thái kiểm duyệt review
                  <select
                    value={responseForm.Status}
                    onChange={(e) => setResponseForm({ ...responseForm, Status: e.target.value })}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED (Hiển thị công khai)</option>
                    <option value="REJECTED">REJECTED (Bị từ chối)</option>
                    <option value="HIDDEN">HIDDEN (Ẩn tạm thời)</option>
                  </select>
                </label>
              </form>

              {/* Real-time reply live preview */}
              <div className="preview-pane-column">
                <span className="admin-preview-title">Xem trước hiển thị</span>
                <div
                  className="luxury-review-card"
                  style={{ width: "100%", maxWidth: 320, transform: "none", boxShadow: "none" }}
                >
                  <div className="review-card-head" style={{ paddingBottom: 10, marginBottom: 10 }}>
                    <div className="customer-meta">
                      {renderAvatar({ AvatarUrl: responseModal.CustomerAvatar, FullName: responseModal.CustomerName }, 40)}
                      <div className="customer-meta-text">
                        <h4 style={{ fontSize: "14.5px" }}>{responseModal.CustomerName}</h4>
                        <span style={{ fontSize: "11.5px" }}>{dateText(responseModal.CreatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="review-body">
                    <div className="review-rating-stars" style={{ marginBottom: 6 }}>
                      {stars(responseModal.Rating)}
                    </div>
                    <p className="review-body-text" style={{ fontSize: "13px", marginBottom: 12 }}>
                      "{responseModal.Comment || "Không bình luận"}"
                    </p>

                    {responseModal.ReviewImages && responseModal.ReviewImages.length > 0 ? (
                      <div className="review-customer-photos" style={{ gap: 6, marginBottom: 10 }}>
                        {responseModal.ReviewImages.map((img) => (
                          <div
                            key={img.ReviewImageId}
                            className="review-photo-wrapper"
                            style={{ width: 50, height: 50, borderRadius: 8 }}
                            onClick={() => setLightboxPhoto(resolveFileUrl(img.ImageUrl))}
                          >
                            <img src={resolveFileUrl(img.ImageUrl)} alt="Customer Upload" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {responseForm.AdminResponse.trim() ? (
                      <div className="admin-reply-box" style={{ padding: 12, marginTop: 4 }}>
                        <div className="admin-reply-header" style={{ marginBottom: 4 }}>
                          <strong>ADMIN REPLY</strong>
                          <span>Bây giờ</span>
                        </div>
                        <p style={{ fontSize: "12.5px" }}>{responseForm.AdminResponse.trim()}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="card-btn" type="button" onClick={() => setResponseModal(null)}>
                Hủy
              </button>
              <button className="card-btn primary" type="button" onClick={submitResponse} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu phản hồi & Phê duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxPhoto && (
        <div className="lightbox-backdrop" onClick={() => setLightboxPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>
              &times;
            </button>
            <img className="lightbox-img" src={lightboxPhoto} alt="Review Fullsize" />
          </div>
        </div>
      )}
    </section>
  );
}
