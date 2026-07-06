import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/promotion-default.jpg";

const emptyForm = {
  title: "",
  description: "",
  discountPercent: "",
  imageUrl: "",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
};

function image(url) {
  return resolveFileUrl(url) || DEFAULT_IMAGE;
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminPromotions() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detailServices, setDetailServices] = useState([]);
  const [loadingDetailSvc, setLoadingDetailSvc] = useState(false);

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

  const scrollToItem = (id, type = "promotion") => {
    setTimeout(() => {
      const element = document.getElementById(`${type}-card-${id}`);
      if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 180;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 20px 5px rgba(214, 181, 126, 0.5)";
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

      const [listRes, serviceRes] = await Promise.all([
        axiosClient.get("/admin/promotions", {
          params: {
            keyword: filters.keyword || undefined,
            status: filters.status || undefined,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
          },
        }),
        axiosClient.get("/admin/promotions/services"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setServices(serviceRes.data.data || serviceRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách khuyến mãi",
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

  const handleStatusChange = (statusVal) => {
    setFilters((prev) => ({ ...prev, status: statusVal }));
    shouldScrollRef.current = true;
  };

  const handleFromDateChange = (dateVal) => {
    setFilters((prev) => ({ ...prev, fromDate: dateVal }));
    shouldScrollRef.current = true;
  };

  const handleToDateChange = (dateVal) => {
    setFilters((prev) => ({ ...prev, toDate: dateVal }));
    shouldScrollRef.current = true;
  };

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

  async function openDetail(item) {
    setSelected(item);
    setDetailServices([]);
    setLoadingDetailSvc(true);
    try {
      const res = await axiosClient.get(`/admin/promotions/${item.PromotionId}/services`);
      const assigned = res.data.data || res.data || [];
      setDetailServices(assigned.filter((x) => x.IsAssigned));
    } catch (err) {
      console.error("Failed to load promotion detail services:", err);
    } finally {
      setLoadingDetailSvc(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      running: items.filter((x) => x.RuntimeStatus === "RUNNING").length,
      upcoming: items.filter((x) => x.RuntimeStatus === "UPCOMING").length,
      expired: items.filter((x) => x.RuntimeStatus === "EXPIRED").length,
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedServiceIds([]);
    setShowModal(true);
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.PromotionId);

      setForm({
        title: item.Title || "",
        description: item.Description || "",
        discountPercent: String(item.DiscountPercent ?? ""),
        imageUrl: item.ImageUrl || "",
        startDate: item.StartDate ? String(item.StartDate).slice(0, 10) : "",
        endDate: item.EndDate ? String(item.EndDate).slice(0, 10) : "",
        status: item.Status || "ACTIVE",
      });

      const res = await axiosClient.get(
        `/admin/promotions/${item.PromotionId}/services`,
      );

      const assigned = res.data.data || res.data || [];
      setSelectedServiceIds(
        assigned.filter((x) => x.IsAssigned).map((x) => String(x.ServiceId)),
      );

      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dịch vụ áp dụng",
      );
    }
  }

  function validate() {
    if (!form.title.trim()) throw new Error("Vui lòng nhập tên khuyến mãi");

    const percent = Number(form.discountPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error("Phần trăm giảm giá phải từ 1 đến 100");
    }

    if (!form.startDate) throw new Error("Vui lòng chọn ngày bắt đầu");
    if (!form.endDate) throw new Error("Vui lòng chọn ngày kết thúc");

    if (new Date(form.startDate) > new Date(form.endDate)) {
      throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }
  }

  async function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        discountPercent: Number(form.discountPercent),
        imageUrl: form.imageUrl.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        serviceIds: selectedServiceIds.map(Number),
      };

      let promoId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/promotions/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/promotions", payload);
        const created = res.data.data || res.data;
        promoId = created?.PromotionId || created?.id;
      }

      setShowModal(false);
      await load();
      if (promoId) {
        scrollToItem(promoId, "promotion");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu khuyến mãi thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái "${item.Title}" thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/promotions/${item.PromotionId}/status`, {
        status: nextStatus,
      });
      await load();
      scrollToItem(item.PromotionId, "promotion");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function remove(item) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa khuyến mãi "${item.Title}"?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/promotions/${item.PromotionId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Xóa khuyến mãi thất bại",
      );
    }
  }

  function toggleService(id) {
    const key = String(id);
    setSelectedServiceIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  function clearFilters() {
    handleClearFilters();
  }

  return (
    <section className="admin-page admin-promotions-page">
      <style>{`
        .admin-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }
        .admin-promotions-hero {
          padding: 28px;
          border-radius: 20px;
          background: linear-gradient(135deg, #2b1c12 0%, #4a3222 100%);
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          box-shadow: 0 10px 25px rgba(43, 28, 18, 0.15);
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .admin-promotions-hero::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: rgba(214, 181, 126, 0.1);
          right: -30px;
          bottom: -30px;
        }
        .admin-promotions-hero h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .admin-promotions-hero p {
          margin: 0;
          color: #f3dfbd;
          font-size: 14px;
          opacity: 0.9;
        }
        .admin-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #d6b57e;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .admin-refresh-btn {
          border: 0;
          border-radius: 30px;
          padding: 12px 24px;
          font-weight: 700;
          color: #2b1c12;
          background: linear-gradient(135deg, #d6b57e, #f0dfbf);
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(214, 181, 126, 0.3);
          white-space: nowrap;
        }
        .admin-refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(214, 181, 126, 0.4);
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
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          gap: 16px;
          border-left: 4px solid #cbd5e1;
          transition: all 0.3s ease;
        }
        .admin-stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .admin-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f8fafc;
          font-size: 22px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
        }
        .admin-stat-card p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }
        .admin-stat-card h3 {
          margin: 4px 0;
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }
        .admin-stat-card span {
          font-size: 11px;
          color: #94a3b8;
        }
        
        .admin-filter-panel.admin-promotions-filter {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(43, 28, 18, 0.1), 0 8px 10px -6px rgba(43, 28, 18, 0.1);
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1.2fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(173, 136, 83, 0.15);
        }
        @media (max-width: 900px) {
          .admin-filter-panel.admin-promotions-filter {
            grid-template-columns: 1fr;
          }
        }
        .admin-filter-panel.admin-promotions-filter input,
        .admin-filter-panel.admin-promotions-filter select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s;
          color: #1e293b;
        }
        .admin-filter-panel.admin-promotions-filter input:focus,
        .admin-filter-panel.admin-promotions-filter select:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }

        .admin-promotions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .admin-promotion-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }
        .admin-promotion-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(43, 28, 18, 0.12);
          border-color: #d6b57e;
        }
        .admin-promotion-image {
          position: relative;
          height: 180px;
          overflow: hidden;
        }
        .admin-promotion-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }
        .admin-promotion-card:hover .admin-promotion-image img {
          transform: scale(1.08);
        }
        .admin-promotion-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: linear-gradient(135deg, #a0573a 0%, #cf7b59 100%);
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 4px 6px rgba(0,0,0,0.15);
          z-index: 2;
        }
        .admin-status {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 2;
        }
        .admin-status-running {
          background: #10b981;
          color: #ffffff;
        }
        .admin-status-upcoming {
          background: #3b82f6;
          color: #ffffff;
        }
        .admin-status-expired {
          background: #ef4444;
          color: #ffffff;
        }
        .admin-status-inactive {
          background: #64748b;
          color: #ffffff;
        }

        .admin-promotion-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }
        .admin-promotion-body h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.4;
        }
        .admin-promotion-body p {
          margin: 0 0 16px 0;
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 40px;
        }

        .admin-promotion-date {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12.5px;
          color: #334155;
          margin-bottom: 16px;
        }
        .admin-promotion-date span {
          color: #94a3b8;
        }

        .admin-promotion-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          background: #f8fafc;
          padding: 10px;
          border-radius: 12px;
          margin-bottom: 16px;
          text-align: center;
        }
        .admin-promotion-info div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .admin-promotion-info span {
          font-size: 9px;
          text-transform: uppercase;
          color: #94a3b8;
          font-weight: 600;
        }
        .admin-promotion-info strong {
          font-size: 12px;
          color: #334155;
          font-weight: 700;
        }

        .admin-promotion-services {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-top: 1px solid #f8fafc;
          padding-top: 12px;
        }

        .admin-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: auto;
        }
        .card-btn {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .card-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #1e293b;
        }
        .card-btn.primary {
          background: linear-gradient(135deg, #2b1c12 0%, #4a3222 100%);
          color: #ffffff;
          border: none;
        }
        .card-btn.primary:hover {
          background: linear-gradient(135deg, #3f2a1b 0%, #5d3f2b 100%);
          box-shadow: 0 4px 10px rgba(43, 28, 18, 0.2);
        }
        .card-btn.danger {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
        }
        .card-btn.danger:hover {
          background: #fef2f2;
          border-color: #ef4444;
        }

        /* Modal backdrop & card */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 580px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          position: relative;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .admin-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.05);
          border: 0;
          font-size: 20px;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #475569;
          transition: all 0.2s;
          z-index: 10;
        }
        .admin-modal-close:hover {
          background: rgba(15, 23, 42, 0.1);
          color: #0f172a;
          transform: rotate(90deg);
        }

        /* Detail Modal Styles */
        .admin-promotion-detail-image {
          width: 100%;
          height: 220px;
          object-fit: cover;
          border-bottom: 4px solid #d6b57e;
        }
        .admin-detail-title {
          padding: 20px 24px 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .admin-detail-title span {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
          font-weight: 700;
          display: block;
          margin-bottom: 4px;
        }
        .admin-detail-title h3 {
          margin: 0;
          font-size: 22px;
          color: #1f2937;
          font-weight: 800;
        }
        .admin-promotion-detail-desc {
          padding: 0 24px;
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
        }
        .admin-detail-grid {
          padding: 0 24px 24px 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          border-top: 1px solid #f3f4f6;
          padding-top: 16px;
        }
        .admin-detail-grid p {
          margin: 0;
          font-size: 14px;
          color: #374151;
        }
        .admin-detail-grid strong {
          color: #6b7280;
          font-weight: 600;
          display: inline-block;
          min-width: 110px;
        }

        /* Form Modal Styles */
        .admin-promotion-form {
          padding: 24px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .admin-promotion-form h3 {
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 12px;
        }
        .admin-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .admin-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .admin-form-grid input,
        .admin-form-grid select,
        .admin-form-grid textarea {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 13.5px;
          outline: none;
          background: #f8fafc;
          transition: all 0.2s;
        }
        .admin-form-grid input:focus,
        .admin-form-grid select:focus,
        .admin-form-grid textarea:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }
        .admin-form-wide {
          grid-column: 1 / -1;
        }
        .admin-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        /* Service checklist styles inside form modal */
        .admin-promotion-service-box {
          border: 1px solid #e2e8f0;
          background: #fdfbf7;
          border-radius: 12px;
          padding: 16px;
          margin-top: 20px;
        }
        .admin-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .admin-panel-head h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #2b1c12;
        }
        .admin-panel-head p {
          margin: 2px 0 0 0;
          font-size: 11px;
          color: #64748b;
        }
        .admin-promotion-service-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .admin-promo-service-check {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }
        .admin-promo-service-check:hover {
          border-color: #d6b57e;
          background: #fdfbf7;
        }
        .admin-promo-service-check input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #a0573a;
        }
        .admin-promo-service-check img {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
        }
        .admin-promo-service-check div {
          display: flex;
          flex-direction: column;
        }
        .admin-promo-service-check strong {
          font-size: 12.5px;
          color: #334155;
        }
        .admin-promo-service-check span {
          font-size: 11px;
          color: #64748b;
        }
        
        .admin-empty {
          text-align: center;
          padding: 30px;
          color: #94a3b8;
          font-size: 13.5px;
          grid-column: 1 / -1;
        }
        .admin-loading-card {
          padding: 60px;
          text-align: center;
          color: #64748b;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      <div className="admin-promotions-hero">
        <div>
          <div className="admin-eyebrow">Promotions Management</div>
          <h1>Quản lý khuyến mãi</h1>
          <p>
            Tạo và quản lý chương trình khuyến mãi, thời gian áp dụng, phần trăm
            giảm giá, trạng thái và các dịch vụ được áp dụng.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm khuyến mãi
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card" style={{ borderLeftColor: "#d6b57e" }}>
          <div className="admin-stat-icon">🎁</div>
          <div>
            <p>Tổng khuyến mãi</p>
            <h3>{stats.total}</h3>
            <span>Tất cả promotion</span>
          </div>
        </article>

        <article className="admin-stat-card" style={{ borderLeftColor: "#10b981" }}>
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
            <span>Status ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card" style={{ borderLeftColor: "#cf7b59" }}>
          <div className="admin-stat-icon">🔥</div>
          <div>
            <p>Đang diễn ra</p>
            <h3>{stats.running}</h3>
            <span>Đang chạy thực tế</span>
          </div>
        </article>

        <article className="admin-stat-card" style={{ borderLeftColor: "#3b82f6" }}>
          <div className="admin-stat-icon">⏳</div>
          <div>
            <p>Sắp tới / Hết hạn</p>
            <h3>
              {stats.upcoming} / {stats.expired}
            </h3>
            <span>Theo lịch trình</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-promotions-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm tên hoặc mô tả khuyến mãi..."
        />

        <select
          value={filters.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => handleFromDateChange(e.target.value)}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => handleToDateChange(e.target.value)}
        />

        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          Lọc
        </button>

        <button className="card-btn" onClick={handleClearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">
          Đang tải danh sách khuyến mãi...
        </div>
      ) : null}

      {!loading ? (
        <div ref={gridRef} className="admin-promotions-grid">
          {items.map((item) => (
            <article className="admin-promotion-card" id={`promotion-card-${item.PromotionId}`} key={item.PromotionId}>
              <div className="admin-promotion-image">
                <img src={image(item.ImageUrl)} alt={item.Title} />
                <div className="admin-promotion-badge">
                  -{Number(item.DiscountPercent || 0)}%
                </div>
                <span
                  className={statusClass(item.RuntimeStatus || item.Status)}
                >
                  {item.RuntimeStatus || item.Status}
                </span>
              </div>

              <div className="admin-promotion-body">
                <h3>{item.Title}</h3>
                <p>{item.Description || "Chưa có mô tả khuyến mãi."}</p>

                <div className="admin-promotion-date">
                  <strong>{dateText(item.StartDate)}</strong>
                  <span>→</span>
                  <strong>{dateText(item.EndDate)}</strong>
                </div>

                <div className="admin-promotion-info">
                  <div>
                    <span>Trạng thái</span>
                    <strong>{item.Status}</strong>
                  </div>
                  <div>
                    <span>Dịch vụ áp dụng</span>
                    <strong>{item.ServiceCount || 0}</strong>
                  </div>
                </div>

                <div className="admin-promotion-services">
                  {item.ServiceNames || "Chưa gán dịch vụ"}
                </div>

                <div className="admin-card-actions">
                  <button
                    className="card-btn"
                    onClick={() => openDetail(item)}
                  >
                    Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    Sửa
                  </button>

                  {item.Status === "ACTIVE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      Tắt
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "ACTIVE")}
                    >
                      Bật
                    </button>
                  )}

                  <button
                    className="card-btn danger"
                    onClick={() => remove(item)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có khuyến mãi phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-promotion-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-promotion-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.Title}
            />

            <div className="admin-detail-title">
              <div>
                <span>Promotion</span>
                <h3>{selected.Title}</h3>
              </div>
              <span
                className={statusClass(
                  selected.RuntimeStatus || selected.Status,
                )}
              >
                {selected.RuntimeStatus || selected.Status}
              </span>
            </div>

            <p className="admin-promotion-detail-desc">
              {selected.Description || "Chưa có mô tả khuyến mãi."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Giảm giá:</strong>{" "}
                {Number(selected.DiscountPercent || 0)}%
              </p>
              <p>
                <strong>Trạng thái:</strong> {selected.Status}
              </p>
              <p>
                <strong>Bắt đầu:</strong> {dateText(selected.StartDate)}
              </p>
              <p>
                <strong>Kết thúc:</strong> {dateText(selected.EndDate)}
              </p>
              <p>
                <strong>Số dịch vụ:</strong> {selected.ServiceCount || 0}
              </p>
              <p>
                <strong>Runtime status:</strong> {selected.RuntimeStatus || "N/A"}
              </p>
            </div>

            <div className="admin-detail-services" style={{ padding: "0 24px 24px 24px", borderTop: "1px solid #f3f4f6", paddingTop: "16px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13.5px", fontWeight: "700", color: "#2b1c12" }}>Dịch vụ áp dụng khuyến mãi:</h4>
              {loadingDetailSvc ? (
                <span style={{ fontSize: "12px", color: "#64748b" }}>Đang tải danh sách dịch vụ...</span>
              ) : detailServices.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
                  {detailServices.map((s) => (
                    <div key={s.ServiceId} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "4px 8px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                      <img src={image(s.ImageUrl)} alt={s.ServiceName} style={{ width: "20px", height: "20px", borderRadius: "4px", objectFit: "cover" }} />
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#334155" }}>{s.ServiceName} ({money(s.Price)})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Chưa áp dụng dịch vụ nào.</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-promotion-form"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>

            <h3>{editingId ? "Sửa khuyến mãi" : "Thêm khuyến mãi"}</h3>

            <div className="admin-form-grid">
              <label>
                Tên khuyến mãi *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>

              <label>
                Phần trăm giảm *
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm({ ...form, discountPercent: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Ngày bắt đầu *
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Ngày kết thúc *
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>

              <label>
                ImageUrl
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="/images/promotion-default.jpg"
                />
              </label>

              <label className="admin-form-wide">
                Mô tả
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="admin-promotion-service-box">
              <div className="admin-panel-head">
                <div>
                  <h2>Dịch vụ áp dụng</h2>
                  <p>Chọn các dịch vụ được áp dụng khuyến mãi này.</p>
                </div>
              </div>

              <div className="admin-promotion-service-list">
                {services.map((s) => (
                  <label
                    className="admin-promo-service-check"
                    key={s.ServiceId}
                  >
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(String(s.ServiceId))}
                      onChange={() => toggleService(s.ServiceId)}
                    />

                    <img src={image(s.ImageUrl)} alt={s.ServiceName} />

                    <div>
                      <strong>{s.ServiceName}</strong>
                      <span>
                        {s.CategoryName || "Chưa có danh mục"} •{" "}
                        {money(s.Price)} • {s.DurationMinutes} phút
                      </span>
                    </div>
                  </label>
                ))}

                {!services.length ? (
                  <p className="admin-empty">Chưa có dịch vụ AVAILABLE.</p>
                ) : null}
              </div>
            </div>

            <div className="admin-form-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setShowModal(false)}
              >
                Hủy
              </button>

              <button
                className="card-btn primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu khuyến mãi"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
