import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";

const DEFAULT_IMAGE = "/images/services/skincare.png";

const emptyForm = {
  CategoryName: "",
  Description: "",
  ImageUrl: "",
  Status: "ACTIVE",
};

function image(url) {
  return resolveFileUrl(url) || DEFAULT_IMAGE;
}

function statusClass(value) {
  return `admin-category-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminServiceCategories() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
      const element = document.getElementById(`category-card-${id}`);
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

      const res = await axiosClient.get("/admin/service-categories", {
        params: {
          keyword: filters.keyword || undefined,
          status: filters.status || undefined,
        },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh mục dịch vụ",
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
  }, [filters.status]);

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
    const wasEmpty = filters.status === "";
    setFilters({
      keyword: "",
      status: "",
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
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      inactive: items.filter((x) => x.Status === "INACTIVE").length,
      services: items.reduce(
        (sum, x) => sum + Number(x.ServiceCount || 0),
        0,
      ),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
    setError("");
  }

  function openEdit(item) {
    setError("");
    setEditingId(item.CategoryId);
    setForm({
      CategoryName: item.CategoryName || "",
      Description: item.Description || "",
      ImageUrl: item.ImageUrl || "",
      Status: item.Status || "ACTIVE",
    });
    setShowModal(true);
  }

  function validate() {
    if (!form.CategoryName.trim()) {
      throw new Error("Vui lòng nhập tên danh mục");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        CategoryName: form.CategoryName.trim(),
        Description: form.Description.trim() || null,
        ImageUrl: form.ImageUrl.trim() || null,
        Status: form.Status,
      };

      let catId = editingId;

      if (editingId) {
        const res = await axiosClient.put(`/admin/service-categories/${editingId}`, payload);
        const updated = res.data.data || res.data;
        catId = updated?.CategoryId || editingId;
      } else {
        const res = await axiosClient.post("/admin/service-categories", payload);
        const created = res.data.data || res.data;
        catId = created?.CategoryId || created?.id;
      }

      setShowModal(false);
      await load();
      if (catId) {
        scrollToItem(catId);
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu danh mục thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    try {
      setError("");
      await axiosClient.patch(`/admin/service-categories/${item.CategoryId}/toggle-active`);
      await load();
      scrollToItem(item.CategoryId);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function applyRemove(item) {
    try {
      setError("");
      await axiosClient.delete(`/admin/service-categories/${item.CategoryId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa danh mục thất bại",
      );
    }
  }

  function remove(item) {
    setConfirmAction({ type: "delete", item });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      await applyRemove(confirmAction.item);
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="admin-page admin-categories-page">
      <style>{`
        .admin-categories-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-categories-hero {
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

        .admin-categories-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-categories-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-categories-hero p {
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
          grid-template-columns: 2.5fr 1.5fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(214, 181, 126, 0.15);
          backdrop-filter: blur(8px);
        }

        @media (max-width: 768px) {
          .admin-filter-panel {
            grid-template-columns: 1fr;
          }
        }

        .admin-filter-panel input,
        .admin-filter-panel select {
          padding: 11px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          font-size: 14.5px;
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

        .admin-category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .admin-category-card {
          background: #ffffff;
          border-radius: 22px;
          border: 1px solid #eaddca;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(31, 20, 14, 0.04);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .admin-category-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 16px 36px rgba(48, 30, 15, 0.08);
          border-color: #d6b57e;
        }

        .admin-category-img-container {
          height: 200px;
          overflow: hidden;
          position: relative;
          background: #faf8f5;
          border-bottom: 2px solid rgba(214, 181, 126, 0.15);
        }

        .admin-category-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .admin-category-card:hover .admin-category-img {
          transform: scale(1.08);
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
          letter-spacing: 0.5px;
          z-index: 2;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .admin-category-status {
          position: absolute;
          top: 14px;
          left: 14px;
          padding: 5px 12px;
          border-radius: 50px;
          font-size: 11px;
          font-weight: 700;
          z-index: 2;
        }

        .admin-status-active {
          background: #e8f7ec;
          color: #107c41;
          border: 1px solid rgba(16, 124, 65, 0.2);
        }

        .admin-status-inactive {
          background: #fdf0f0;
          color: #a80000;
          border: 1px solid rgba(168, 0, 0, 0.2);
        }

        .admin-category-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .admin-category-body h4 {
          margin: 0 0 10px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f140e;
          letter-spacing: -0.3px;
        }

        .admin-category-body p {
          margin: 0 0 20px 0;
          color: #8c7e74;
          font-size: 14px;
          line-height: 1.6;
          flex-grow: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .admin-category-footer {
          display: flex;
          gap: 8px;
          border-top: 1px solid #ebdcc5;
          padding: 16px 24px;
          background: #fdfbf9;
        }

        .card-btn {
          flex: 1;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          padding: 10px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          background: #ffffff;
          color: #5c4a3c;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
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
          position: relative;
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
          padding: 32px;
          overflow-y: auto;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 32px;
        }

        @media (max-width: 768px) {
          .admin-modal-body {
            grid-template-columns: 1fr;
          }
        }

        .admin-modal-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .admin-modal-form label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13.5px;
          font-weight: 700;
          color: #5c4a3c;
        }

        .admin-modal-form input,
        .admin-modal-form select,
        .admin-modal-form textarea {
          padding: 12px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          font-size: 14.5px;
          font-family: inherit;
          color: #5c4a3c;
          outline: none;
          transition: all 0.3s;
        }

        .admin-modal-form input:focus,
        .admin-modal-form select:focus,
        .admin-modal-form textarea:focus {
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

        .admin-preview-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          border-left: 1px solid rgba(214, 181, 126, 0.2);
          padding-left: 32px;
        }

        @media (max-width: 768px) {
          .admin-preview-section {
            border-left: 0;
            padding-left: 0;
            border-top: 1px solid rgba(214, 181, 126, 0.2);
            padding-top: 24px;
          }
        }

        .admin-preview-title {
          align-self: flex-start;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
        }

        .admin-empty-card {
          border: 2px dashed #ebdcc5;
          border-radius: 22px;
          height: 380px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #bfaea3;
          font-weight: 600;
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

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Hero Header */}
      <div className="admin-categories-hero">
        <div>
          <div className="admin-eyebrow">Services Categories</div>
          <h1>Quản lý Danh mục Dịch vụ</h1>
          <p>
            Tạo lập và thiết kế các danh mục trị liệu, chăm sóc da mặt, cơ thể giúp khách hàng dễ dàng tìm kiếm dịch vụ spa của bạn.
          </p>
        </div>
        <button className="admin-refresh-btn" onClick={openCreate}>
          <span>+ Thêm danh mục</span>
        </button>
      </div>

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📂</div>
          <div>
            <p>Tổng danh mục</p>
            <h3>{stats.total}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🟢</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">🔴</div>
          <div>
            <p>Tạm ngưng</p>
            <h3>{stats.inactive}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">✨</div>
          <div>
            <p>Số dịch vụ liên kết</p>
            <h3>{stats.services}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-panel">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm kiếm danh mục theo tên hoặc mô tả..."
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          <span>Lọc</span>
        </button>
        <button className="admin-clear-btn" onClick={handleClearFilters}>
          Xóa
        </button>
      </div>

      {/* Error & Loading cards */}
      {error && <div className="admin-error-card" style={{ marginBottom: 20 }}>{error}</div>}

      {loading ? (
        <div className="admin-loading-card">Đang tải danh mục dịch vụ spa...</div>
      ) : (
        <div ref={gridRef} className="admin-category-grid">
          {items.map((item) => (
            <div
              key={item.CategoryId}
              id={`category-card-${item.CategoryId}`}
              className="admin-category-card"
            >
              <div className="admin-category-img-container">
                <img
                  className="admin-category-img"
                  src={image(item.ImageUrl)}
                  alt={item.CategoryName}
                />
                <span className="admin-category-badge">{item.ServiceCount} dịch vụ</span>
                <span className={statusClass(item.Status)}>
                  {item.Status}
                </span>
              </div>
              <div className="admin-category-body">
                <h4>{item.CategoryName}</h4>
                <p>{item.Description || "Chưa có mô tả chi tiết cho danh mục dịch vụ spa này."}</p>
              </div>
              <div className="admin-category-footer">
                <button className="card-btn primary" onClick={() => openEdit(item)}>
                  Sửa
                </button>
                <button className="card-btn" onClick={() => toggleStatus(item)}>
                  Bật/Tắt
                </button>
                <button className="card-btn danger" onClick={() => remove(item)}>
                  Xóa
                </button>
              </div>
            </div>
          ))}

          {!items.length ? (
            <div className="admin-empty" style={{ gridColumn: "1/-1" }}>
              Không tìm thấy danh mục dịch vụ nào phù hợp với bộ lọc.
            </div>
          ) : null}
        </div>
      )}

      {/* Editor Modal */}
      {showModal ? (
        <div className="admin-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingId ? "Cập nhật Danh mục" : "Tạo Danh mục mới"}</h3>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <div className="admin-modal-body">
              <form className="admin-modal-form" onSubmit={submit}>
                <label>
                  Tên danh mục *
                  <input
                    value={form.CategoryName}
                    onChange={(e) => setForm({ ...form, CategoryName: e.target.value })}
                    placeholder="Massage mặt chuyên sâu"
                    required
                  />
                </label>
                <label>
                  Đường dẫn ảnh (ImageUrl)
                  <input
                    value={form.ImageUrl}
                    onChange={(e) => setForm({ ...form, ImageUrl: e.target.value })}
                    placeholder="/images/services/facial.png"
                  />
                </label>
                <label>
                  Trạng thái hoạt động
                  <select
                    value={form.Status}
                    onChange={(e) => setForm({ ...form, Status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
                <label>
                  Mô tả chi tiết
                  <textarea
                    rows={4}
                    value={form.Description}
                    onChange={(e) => setForm({ ...form, Description: e.target.value })}
                    placeholder="Giới thiệu về gói dịch vụ spa..."
                  />
                </label>
              </form>

              {/* Real-time Live Preview */}
              <div className="admin-preview-section">
                <span className="admin-preview-title">Xem trước thẻ hiển thị</span>
                <div
                  className="admin-category-card"
                  style={{ width: "100%", maxWidth: 300, minHeight: 360, transform: "none", boxShadow: "none" }}
                >
                  <div className="admin-category-img-container">
                    <img
                      className="admin-category-img"
                      src={image(form.ImageUrl)}
                      alt="Preview"
                    />
                    <span className="admin-category-badge">
                      {editingId
                        ? items.find((x) => x.CategoryId === editingId)?.ServiceCount || 0
                        : 0}{" "}
                      dịch vụ
                    </span>
                    <span className={statusClass(form.Status)}>
                      {form.Status}
                    </span>
                  </div>
                  <div className="admin-category-body">
                    <h4>{form.CategoryName || "Tên danh mục hiển thị"}</h4>
                    <p>{form.Description || "Mô tả chi tiết về danh mục spa này sẽ được cập nhật tại đây khi bạn nhập văn bản..."}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="card-btn" type="button" onClick={() => setShowModal(false)}>
                Hủy
              </button>
              <button className="card-btn primary" type="button" onClick={submit} disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo mới"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(confirmAction)}
        title="Xóa danh mục dịch vụ?"
        description="Chỉ có thể xóa danh mục trống. Nếu danh mục đang chứa dịch vụ, hệ thống sẽ từ chối để bảo vệ dữ liệu liên quan."
        details={confirmAction ? <strong>{confirmAction.item.CategoryName}</strong> : null}
        confirmLabel="Xóa danh mục"
        tone="danger"
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
      />
    </section>
  );
}
