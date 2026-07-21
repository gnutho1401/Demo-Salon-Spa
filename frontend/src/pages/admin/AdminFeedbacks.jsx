import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const emptyResponse = {
  AdminResponse: "",
  Status: "RESOLVED",
};

function dateText(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleString("vi-VN");
}

function dateOnlyText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(value) {
  return `admin-feedback-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
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
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      const elementPosition = gridRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 180;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const scrollToItem = (id) => {
    setTimeout(() => {
      const element = document.getElementById(`feedback-card-${id}`);
      if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 180;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 25px 6px rgba(214, 181, 126, 0.6)";
        setTimeout(() => {
          element.style.borderColor = "";
          element.style.boxShadow = "";
        }, 3000);
      } else {
        scrollToGrid();
      }
    }, 150);
  };

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
          "Không tải được danh sách phản hồi",
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
  }, [filters.status, filters.fromDate, filters.toDate]);

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
    const wasEmpty = filters.status === "" && filters.fromDate === "" && filters.toDate === "";
    setFilters({
      keyword: "",
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
    const inProgress = items.filter((x) => x.Status === "IN_PROGRESS").length;
    const resolved = items.filter((x) => x.Status === "RESOLVED").length;
    const rejected = items.filter((x) => x.Status === "REJECTED").length;

    return { total, pending, inProgress, resolved, rejected };
  }, [items]);

  function openResponse(item) {
    setResponseModal(item);
    setResponseForm({
      AdminResponse: item.AdminResponse || "",
      Status: item.Status === "PENDING" ? "RESOLVED" : item.Status || "RESOLVED",
    });
    setError("");
    setSuccessMsg("");
  }

  async function applyStatusChange(item, nextStatus) {
    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.patch(`/admin/feedbacks/${item.FeedbackId}/status`, {
        Status: nextStatus,
      });

      setSuccessMsg(`Đã đổi trạng thái feedback #${item.FeedbackId} thành ${nextStatus}!`);
      await load();
      scrollToItem(item.FeedbackId);
      setTimeout(() => setSuccessMsg(""), 4000);
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
      setSuccessMsg("");

      await axiosClient.patch(
        `/admin/feedbacks/${responseModal.FeedbackId}/respond`,
        {
          AdminResponse: responseForm.AdminResponse.trim(),
          Status: responseForm.Status,
        },
      );

      setResponseModal(null);
      await load();
      scrollToItem(responseModal.FeedbackId);
      setSuccessMsg("Cập nhật phản hồi feedback thành công!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu phản hồi thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyRemoveResponse(item) {
    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.patch(
        `/admin/feedbacks/${item.FeedbackId}/remove-response`,
      );

      setSuccessMsg(`Đã xóa phản hồi của feedback #${item.FeedbackId}`);
      await load();
      scrollToItem(item.FeedbackId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa phản hồi thất bại",
      );
    }
  }

  function changeStatus(item, nextStatus) {
    setConfirmAction({ type: "status", item, nextStatus });
  }

  function removeResponse(item) {
    setConfirmAction({ type: "remove-response", item });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.type === "remove-response") {
        await applyRemoveResponse(confirmAction.item);
      } else {
        await applyStatusChange(confirmAction.item, confirmAction.nextStatus);
      }
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="admin-page admin-feedbacks-page">
      <style>{`
        .admin-feedbacks-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-feedbacks-hero {
          padding: 32px;
          border-radius: 24px;
          background: linear-gradient(135deg, #161a1d 0%, #2f3438 100%);
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          box-shadow: 0 12px 30px rgba(22, 26, 29, 0.15);
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(214, 181, 126, 0.2);
        }

        .admin-feedbacks-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-feedbacks-hero p {
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
          color: #161a1d;
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
          background: rgba(255, 255, 255, 0.85);
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(31, 20, 14, 0.04);
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr auto auto;
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

        .admin-feedbacks-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        .luxury-feedback-card {
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

        .luxury-feedback-card:hover {
          box-shadow: 0 16px 36px rgba(48, 30, 15, 0.08);
          border-color: #d6b57e;
        }

        .feedback-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border-bottom: 1px dashed rgba(214, 181, 126, 0.25);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        @media (max-width: 640px) {
          .feedback-card-head {
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

        .feedback-badges-column {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        @media (max-width: 640px) {
          .feedback-badges-column {
            align-items: flex-start;
          }
        }

        .admin-feedback-status {
          padding: 5px 12px;
          border-radius: 50px;
          font-size: 11px;
          font-weight: 700;
        }

        .admin-status-pending {
          background: #fff8e1;
          color: #b78103;
          border: 1px solid rgba(183, 129, 3, 0.2);
        }

        .admin-status-in-progress {
          background: #fff3e0;
          color: #e65100;
          border: 1px solid rgba(230, 81, 0, 0.2);
        }

        .admin-status-resolved {
          background: #e8f7ec;
          color: #107c41;
          border: 1px solid rgba(16, 124, 65, 0.2);
        }

        .admin-status-rejected {
          background: #fdf0f0;
          color: #a80000;
          border: 1px solid rgba(168, 0, 0, 0.2);
        }

        .admin-status-closed {
          background: #f4f6f7;
          color: #5a6b7c;
          border: 1px solid rgba(90, 107, 124, 0.2);
        }

        .feedback-subject-text {
          font-size: 16px;
          font-weight: 700;
          color: #1f140e;
          margin: 0 0 8px 0;
        }

        .feedback-body-text {
          font-size: 14.5px;
          color: #3a2519;
          line-height: 1.6;
          margin: 0 0 16px 0;
          font-style: italic;
        }

        .feedback-connections {
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

        .feedback-card-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid #ebdcc5;
          padding-top: 16px;
          margin-top: 16px;
        }

        .card-btn {
          flex: 1;
          min-width: 100px;
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

        .admin-modal-body {
          padding: 28px;
          overflow-y: auto;
          max-height: calc(85vh - 140px);
        }

        .admin-modal-body.reply-editor {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
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

        .admin-modal-footer {
          padding: 20px 32px;
          background: #faf8f5;
          border-top: 1px solid #ebdcc5;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .admin-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          background: #faf8f5;
          padding: 20px;
          border-radius: 20px;
          border: 1px solid #ebdcc5;
          margin-bottom: 20px;
        }

        @media (max-width: 640px) {
          .admin-detail-grid {
            grid-template-columns: 1fr;
          }
        }

        .admin-detail-grid p {
          margin: 0;
          font-size: 14.5px;
          color: #5c4a3c;
        }

        .admin-detail-grid strong {
          color: #1f140e;
        }

        .feedback-detail-text {
          background: #ffffff;
          padding: 20px;
          border-radius: 20px;
          border: 1px solid #ebdcc5;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.01);
        }

        .feedback-detail-text strong {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
          display: block;
          margin-bottom: 8px;
        }

        .feedback-detail-text p {
          margin: 0;
          font-size: 14.5px;
          color: #3a2519;
          line-height: 1.6;
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
      `}</style>

      {/* Hero Header */}
      <div className="admin-feedbacks-hero">
        <div>
          <div className="admin-eyebrow">Feedbacks Management</div>
          <h1>Quản lý phản hồi khách hàng</h1>
          <p>
            Theo dõi ý kiến đóng góp từ khách hàng, xử lý trạng thái và phản hồi chính thức từ quản trị viên.
          </p>
        </div>
        <button className="admin-refresh-btn" onClick={load}>
          Làm mới
        </button>
      </div>

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">💬</div>
          <div>
            <p>Tổng feedback</p>
            <h3>{stats.total}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Chờ xử lý</p>
            <h3>{stats.pending}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🛠</div>
          <div>
            <p>Đang xử lý</p>
            <h3>{stats.inProgress}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đã giải quyết</p>
            <h3>{stats.resolved}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-panel">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm khách hàng, email, tiêu đề..."
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
        <div className="admin-loading-card">Đang tải danh sách feedbacks...</div>
      ) : (
        <div ref={gridRef} className="admin-feedbacks-grid">
          {items.map((item) => (
            <div key={item.FeedbackId} id={`feedback-card-${item.FeedbackId}`} className="luxury-feedback-card">
              <div className="feedback-card-head">
                <div className="customer-meta">
                  {renderAvatar({ AvatarUrl: item.CustomerAvatar, FullName: item.CustomerName }, 48)}
                  <div className="customer-meta-text">
                    <h4>{item.CustomerName}</h4>
                    <span>{item.CustomerEmail} • {dateText(item.CreatedAt)}</span>
                  </div>
                </div>

                <div className="feedback-badges-column">
                  <span className={statusClass(item.Status)}>
                    {item.Status}
                  </span>
                </div>
              </div>

              <div className="feedback-body">
                <h4 className="feedback-subject-text">Chủ đề: {item.Subject || "Không có tiêu đề"}</h4>
                <p className="feedback-body-text">
                  "{item.Content || "Không có nội dung chi tiết."}"
                </p>

                <div className="feedback-connections">
                  <div className="connection-chip">
                    <span>Mã KH: <strong>{item.CustomerId ? `#${item.CustomerId}` : "N/A"}</strong></span>
                  </div>
                  <div className="connection-chip">
                    <span>Hạng thành viên: <strong>{item.MembershipLevelName || "Standard"}</strong></span>
                  </div>
                  <div className="connection-chip">
                    <span>Điểm loyalty: <strong>{item.LoyaltyPoints || 0}</strong></span>
                  </div>
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

              <div className="feedback-card-footer">
                <button className="card-btn" onClick={() => setSelected(item)}>
                  Chi tiết 👁
                </button>
                <button className="card-btn primary" onClick={() => openResponse(item)}>
                  Phản hồi 💬
                </button>
                {item.Status !== "IN_PROGRESS" && (
                  <button className="card-btn" onClick={() => changeStatus(item, "IN_PROGRESS")}>
                    Đang xử lý 🛠
                  </button>
                )}
                {item.Status !== "RESOLVED" && (
                  <button className="card-btn" onClick={() => changeStatus(item, "RESOLVED")}>
                    Giải quyết ✓
                  </button>
                )}
                <button className="card-btn danger" onClick={() => changeStatus(item, "REJECTED")}>
                  Reject ✖
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
              Không tìm thấy feedback nào phù hợp bộ lọc.
            </div>
          ) : null}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #161a1d 0%, #2f3438 100%)", color: "#fff" }}>
              <h3>Chi tiết feedback #{selected.FeedbackId}</h3>
              <button className="admin-modal-close" onClick={() => setSelected(null)} style={{ color: "#fff" }}>
                &times;
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-detail-grid">
                <p><strong>Feedback ID:</strong> #{selected.FeedbackId}</p>
                <p><strong>Khách hàng:</strong> {selected.CustomerName}</p>
                <p><strong>Email khách hàng:</strong> {selected.CustomerEmail}</p>
                <p><strong>Điện thoại:</strong> {selected.CustomerPhone || "N/A"}</p>
                <p><strong>Hạng thành viên:</strong> {selected.MembershipLevelName || "Standard"}</p>
                <p><strong>Loyalty Points:</strong> {selected.LoyaltyPoints || 0}</p>
                <p><strong>Trạng thái:</strong> <span className={statusClass(selected.Status)} style={{ position: "static" }}>{selected.Status}</span></p>
                <p><strong>Ngày gửi:</strong> {dateText(selected.CreatedAt)}</p>
                <p><strong>Ngày cập nhật:</strong> {dateText(selected.UpdatedAt)}</p>
              </div>

              <div className="feedback-detail-text">
                <strong>Chủ đề</strong>
                <p>{selected.Subject || "Không có tiêu đề"}</p>
              </div>

              <div className="feedback-detail-text">
                <strong>Nội dung phản hồi từ khách</strong>
                <p>{selected.Content || "Không có nội dung."}</p>
              </div>

              <div className="feedback-detail-text">
                <strong>Admin response</strong>
                <p style={{ fontStyle: selected.AdminResponse ? "normal" : "italic", color: selected.AdminResponse ? "#3a2519" : "#8c7e74" }}>
                  {selected.AdminResponse || "Chưa có phản hồi chính thức."}
                </p>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="card-btn primary" onClick={() => { setResponseModal(selected); setSelected(null); openResponse(selected); }}>
                Phản hồi ngay 💬
              </button>
              <button className="card-btn" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSE MODAL */}
      {responseModal && (
        <div className="admin-modal-backdrop" onClick={() => setResponseModal(null)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #161a1d 0%, #2f3438 100%)", color: "#fff" }}>
              <h3>Phản hồi feedback #{responseModal.FeedbackId}</h3>
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
                    placeholder="Chào quý khách, chúng tôi chân thành ghi nhận phản hồi của quý khách..."
                    required
                  />
                </label>

                <label>
                  Trạng thái xử lý phản hồi
                  <select
                    value={responseForm.Status}
                    onChange={(e) => setResponseForm({ ...responseForm, Status: e.target.value })}
                  >
                    <option value="PENDING">PENDING (Đang chờ)</option>
                    <option value="IN_PROGRESS">IN_PROGRESS (Đang xử lý)</option>
                    <option value="RESOLVED">RESOLVED (Đã giải quyết)</option>
                    <option value="REJECTED">REJECTED (Từ chối xử lý)</option>
                    <option value="CLOSED">CLOSED (Đóng phản hồi)</option>
                  </select>
                </label>
              </form>

              {/* Real-time live preview */}
              <div className="preview-pane-column">
                <span className="admin-preview-title">Xem trước hiển thị</span>
                <div
                  className="luxury-feedback-card"
                  style={{ width: "100%", maxWidth: 320, transform: "none", boxShadow: "none" }}
                >
                  <div className="feedback-card-head" style={{ paddingBottom: 10, marginBottom: 10 }}>
                    <div className="customer-meta">
                      {renderAvatar({ AvatarUrl: responseModal.CustomerAvatar, FullName: responseModal.CustomerName }, 40)}
                      <div className="customer-meta-text">
                        <h4 style={{ fontSize: "14.5px" }}>{responseModal.CustomerName}</h4>
                        <span style={{ fontSize: "11.5px" }}>{dateOnlyText(responseModal.CreatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="feedback-body">
                    <h5 style={{ fontSize: "14px", fontWeight: "bold", margin: "0 0 6px 0", color: "#1f140e" }}>
                      Chủ đề: {responseModal.Subject || "Không có tiêu đề"}
                    </h5>
                    <p className="feedback-body-text" style={{ fontSize: "13px", marginBottom: 12 }}>
                      "{responseModal.Content || "Không có nội dung"}"
                    </p>

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
                {saving ? "Đang lưu..." : "Lưu phản hồi & Trạng thái"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "remove-response" ? "Xóa phản hồi của Admin?" : "Cập nhật trạng thái feedback?"}
        description={
          confirmAction?.type === "remove-response"
            ? "Nội dung phản hồi hiện tại của Admin sẽ bị xóa khỏi feedback này."
            : "Trạng thái mới sẽ được dùng để theo dõi tiến độ xử lý ý kiến của khách hàng."
        }
        details={
          confirmAction ? (
            <>
              <strong>Feedback #{confirmAction.item.FeedbackId}</strong>
              <span> · {confirmAction.item.CustomerName || "Khách hàng"}</span>
              {confirmAction.type === "status" ? <span> · Trạng thái mới: {confirmAction.nextStatus}</span> : null}
            </>
          ) : null
        }
        confirmLabel={confirmAction?.type === "remove-response" ? "Xóa phản hồi" : "Cập nhật trạng thái"}
        tone={confirmAction?.type === "remove-response" || confirmAction?.nextStatus === "REJECTED" ? "danger" : "warning"}
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
      />
    </section>
  );
}
