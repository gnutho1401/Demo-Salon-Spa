import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/services/skincare.png";

const emptyForm = {
  categoryId: "",
  serviceName: "",
  description: "",
  durationMinutes: "",
  price: "",
  status: "AVAILABLE",
  imageUrl: "",
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

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminServices() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState([]);
  const [statusTab, setStatusTab] = useState("ALL"); // ALL, AVAILABLE, INACTIVE, HIDDEN
  const [filters, setFilters] = useState({
    keyword: "",
    categoryId: "",
  });

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTech, setSavingTech] = useState(false);
  const [error, setError] = useState("");

  const [detailTechnicians, setDetailTechnicians] = useState([]);
  const [loadingDetailTech, setLoadingDetailTech] = useState(false);

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

  const scrollToItem = (id, type = "service") => {
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

      const [listRes, categoryRes] = await Promise.all([
        axiosClient.get("/admin/services", {
          params: {
            keyword: filters.keyword || undefined,
            categoryId: filters.categoryId || undefined,
          },
        }),
        axiosClient.get("/admin/services/categories"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setCategories(categoryRes.data.data || categoryRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách dịch vụ",
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
  }, [filters.categoryId]);

  const handleCategoryChange = (catId) => {
    setFilters((prev) => ({ ...prev, categoryId: catId }));
    shouldScrollRef.current = true;
  };

  const handleTabChange = (tab) => {
    setStatusTab(tab);
    setTimeout(scrollToGrid, 50);
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
    const wasEmpty = filters.categoryId === "";
    setFilters({ keyword: "", categoryId: "" });
    setStatusTab("ALL");
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
    setDetailTechnicians([]);
    setLoadingDetailTech(true);
    try {
      const assignedRes = await axiosClient.get(
        `/admin/service-assignments/${item.ServiceId}/technicians`,
      );
      const assigned = assignedRes.data.data || assignedRes.data || [];
      setDetailTechnicians(assigned.filter((x) => x.IsAssigned));
    } catch (err) {
      console.error("Failed to load detail technicians:", err);
    } finally {
      setLoadingDetailTech(false);
    }
  }

  const activeItems = useMemo(() => {
    return items.filter((x) => x.Status !== "UNAVAILABLE");
  }, [items]);

  const stats = useMemo(() => {
    return {
      total: activeItems.length,
      available: activeItems.filter((x) => x.Status === "AVAILABLE").length,
      inactive: activeItems.filter((x) => x.Status === "INACTIVE").length,
      hidden: activeItems.filter((x) => x.Status === "HIDDEN").length,
      appointments: activeItems.reduce(
        (sum, x) => sum + Number(x.AppointmentCount || 0),
        0,
      ),
    };
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (statusTab === "ALL") return true;
      return String(item.Status).toUpperCase() === statusTab.toUpperCase();
    });
  }, [activeItems, statusTab]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTechnicians([]);
    setSelectedTechnicianIds([]);
    setShowModal(true);
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.ServiceId);
      setForm({
        categoryId: String(item.CategoryId || ""),
        serviceName: item.ServiceName || "",
        description: item.Description || "",
        durationMinutes: String(item.DurationMinutes || ""),
        price: String(item.Price || ""),
        status: item.Status || "AVAILABLE",
        imageUrl: item.ImageUrl || "",
      });

      const assignedRes = await axiosClient.get(
        `/admin/service-assignments/${item.ServiceId}/technicians`,
      );

      const assigned = assignedRes.data.data || assignedRes.data || [];
      setTechnicians(assigned);
      setSelectedTechnicianIds(
        assigned.filter((x) => x.IsAssigned).map((x) => String(x.EmployeeId)),
      );

      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được technician của dịch vụ",
      );
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.categoryId) return setError("Vui lòng chọn danh mục");
    if (!form.serviceName.trim()) return setError("Vui lòng nhập tên dịch vụ");
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) {
      return setError("Thời lượng phải lớn hơn 0");
    }
    if (form.price === "" || Number(form.price) < 0) {
      return setError("Giá dịch vụ không hợp lệ");
    }

    const payload = {
      categoryId: Number(form.categoryId),
      serviceName: form.serviceName.trim(),
      description: form.description.trim() || null,
      durationMinutes: Number(form.durationMinutes),
      price: Number(form.price),
      status: form.status,
      imageUrl: form.imageUrl.trim() || null,
    };

    try {
      setSaving(true);
      setError("");

      let serviceId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/services/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/services", payload);
        const created = res.data.data || res.data;
        serviceId = created.ServiceId;
      }

      if (serviceId && selectedTechnicianIds.length > 0) {
        await axiosClient.put(
          `/admin/service-assignments/${serviceId}/technicians`,
          {
            employeeIds: selectedTechnicianIds.map(Number),
          },
        );
      }

      setShowModal(false);
      await load();
      if (serviceId) {
        scrollToItem(serviceId, "service");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu dịch vụ thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTechnicians() {
    if (!editingId) return;

    try {
      setSavingTech(true);
      setError("");

      await axiosClient.put(
        `/admin/service-assignments/${editingId}/technicians`,
        {
          employeeIds: selectedTechnicianIds.map(Number),
        },
      );

      await load();
      setShowModal(false);
      scrollToItem(editingId, "service");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu technician thất bại",
      );
    } finally {
      setSavingTech(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái dịch vụ "${item.ServiceName}" thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/services/${item.ServiceId}/status`, {
        status: nextStatus,
      });
      await load();
      scrollToGrid();
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
      `Bạn chắc chắn muốn xóa dịch vụ "${item.ServiceName}"?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/services/${item.ServiceId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa dịch vụ thất bại",
      );
    }
  }

  function toggleTechnician(id) {
    const key = String(id);
    setSelectedTechnicianIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  function clearFilters() {
    setFilters({ keyword: "", categoryId: "" });
    setStatusTab("ALL");
  }

  return (
    <section className="admin-page admin-services-page">
      <style>{`
        .admin-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }
        .admin-services-hero {
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
        .admin-services-hero::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: rgba(214, 181, 126, 0.1);
          right: -30px;
          bottom: -30px;
        }
        .admin-services-hero h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .admin-services-hero p {
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
        .admin-stat-card.active {
          border: 2px solid #d6b57e !important;
          box-shadow: 0 10px 20px rgba(214, 181, 126, 0.15) !important;
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
        
        .admin-filter-panel.admin-services-filter {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(43, 28, 18, 0.1), 0 8px 10px -6px rgba(43, 28, 18, 0.1);
          display: grid;
          grid-template-columns: 2fr 1.5fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(173, 136, 83, 0.15);
        }
        @media (max-width: 900px) {
          .admin-filter-panel.admin-services-filter {
            grid-template-columns: 1fr;
          }
        }
        .admin-filter-panel.admin-services-filter input,
        .admin-filter-panel.admin-services-filter select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s;
          color: #1e293b;
        }
        .admin-filter-panel.admin-services-filter input:focus,
        .admin-filter-panel.admin-services-filter select:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }

        .refund-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .refund-tab-btn {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .refund-tab-btn:hover {
          border-color: #d6b57e;
          color: #2b1c12;
          background: #fdfbf7;
        }
        .refund-tab-btn.active {
          background: linear-gradient(135deg, #2b1c12 0%, #4a3222 100%);
          color: #ffffff;
          border-color: #2b1c12;
          box-shadow: 0 4px 10px rgba(43, 28, 18, 0.15);
        }

        .admin-services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }
        .admin-service-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }
        .admin-service-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(43, 28, 18, 0.12);
          border-color: #d6b57e;
        }
        .admin-service-image {
          position: relative;
          height: 180px;
          overflow: hidden;
        }
        .admin-service-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }
        .admin-service-card:hover .admin-service-image img {
          transform: scale(1.08);
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
        .admin-status-available {
          background: #10b981;
          color: #ffffff;
        }
        .admin-status-inactive {
          background: #64748b;
          color: #ffffff;
        }
        .admin-status-hidden {
          background: #f59e0b;
          color: #ffffff;
        }

        .admin-service-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }
        .admin-service-category {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .admin-service-body h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.4;
        }
        .admin-service-body p {
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
        .admin-service-price {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-top: auto;
          margin-bottom: 16px;
          padding-top: 12px;
          border-top: 1px solid #f8fafc;
        }
        .admin-service-price strong {
          font-size: 18px;
          color: #a0573a;
          font-weight: 700;
        }
        .admin-service-price span {
          font-size: 13px;
          color: #64748b;
        }

        .admin-service-info {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          padding: 10px;
          border-radius: 12px;
          margin-bottom: 16px;
          text-align: center;
        }
        .admin-service-info div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .admin-service-info span {
          font-size: 9px;
          text-transform: uppercase;
          color: #94a3b8;
          font-weight: 600;
        }
        .admin-service-info strong {
          font-size: 12px;
          color: #334155;
          font-weight: 700;
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
        .admin-service-detail-image {
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
        .admin-service-detail-desc {
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
        .admin-service-form {
          padding: 24px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .admin-service-form h3 {
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

        /* Tech box styles */
        .admin-technician-box {
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
        .admin-technician-checks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .admin-tech-check {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }
        .admin-tech-check:hover {
          border-color: #d6b57e;
          background: #fdfbf7;
        }
        .admin-tech-check input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #a0573a;
        }
        .admin-tech-check img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid #cbd5e1;
        }
        .admin-tech-check div {
          display: flex;
          flex-direction: column;
        }
        .admin-tech-check strong {
          font-size: 12px;
          color: #334155;
        }
        .admin-tech-check span {
          font-size: 10px;
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

      <div className="admin-services-hero">
        <div>
          <div className="admin-eyebrow">Services Management</div>
          <h1>Quản lý dịch vụ</h1>
          <p>
            Quản lý dịch vụ spa/salon, danh mục, giá, thời lượng, trạng thái,
            ảnh hiển thị, rating, lịch hẹn và technician phụ trách.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm dịch vụ
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article 
          className={`admin-stat-card ${statusTab === "ALL" ? "active" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleTabChange("ALL")}
        >
          <div className="admin-stat-icon">✨</div>
          <div>
            <p>Tổng dịch vụ</p>
            <h3>{stats.total}</h3>
            <span>Tất cả dịch vụ trong hệ thống</span>
          </div>
        </article>

        <article 
          className={`admin-stat-card ${statusTab === "AVAILABLE" ? "active" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleTabChange("AVAILABLE")}
        >
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang bán</p>
            <h3>{stats.available}</h3>
            <span>Status AVAILABLE</span>
          </div>
        </article>

        <article 
          className={`admin-stat-card ${statusTab === "INACTIVE" || statusTab === "HIDDEN" ? "active" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleTabChange(statusTab === "INACTIVE" ? "HIDDEN" : "INACTIVE")}
        >
          <div className="admin-stat-icon">⏸</div>
          <div>
            <p>Inactive / Hidden</p>
            <h3>
              {stats.inactive} / {stats.hidden}
            </h3>
            <span>Click để đổi bộ lọc</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div>
            <p>Lịch hẹn liên quan</p>
            <h3>{stats.appointments}</h3>
            <span>Tổng appointment services</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-services-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm tên dịch vụ, mô tả, danh mục..."
        />

        <select
          value={filters.categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.CategoryId} value={c.CategoryId}>
              {c.CategoryName}
            </option>
          ))}
        </select>

        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          Lọc
        </button>

        <button className="card-btn" onClick={handleClearFilters}>
          Xóa lọc
        </button>
      </div>

      {/* Tabs Phân loại trạng thái */}
      <div className="refund-tabs" style={{ display: "flex", gap: "8px" }}>
        <button 
          className={`refund-tab-btn ${statusTab === "ALL" ? "active" : ""}`}
          onClick={() => handleTabChange("ALL")}
          type="button"
        >
          Tất cả ({stats.total})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "AVAILABLE" ? "active" : ""}`}
          onClick={() => handleTabChange("AVAILABLE")}
          type="button"
        >
          Đang bán AVAILABLE ({stats.available})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "INACTIVE" ? "active" : ""}`}
          onClick={() => handleTabChange("INACTIVE")}
          type="button"
        >
          Tạm ngưng INACTIVE ({stats.inactive})
        </button>
        <button 
          className={`refund-tab-btn ${statusTab === "HIDDEN" ? "active" : ""}`}
          onClick={() => handleTabChange("HIDDEN")}
          type="button"
        >
          Đang ẩn HIDDEN ({stats.hidden})
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card" style={{ marginTop: "20px" }}>Đang tải danh sách dịch vụ...</div>
      ) : null}

      {!loading ? (
        <div ref={gridRef} className="admin-services-grid" style={{ marginTop: "20px" }}>
          {filteredItems.map((item) => (
            <article className="admin-service-card" id={`service-card-${item.ServiceId}`} key={item.ServiceId}>
              <div className="admin-service-image">
                <img src={image(item.ImageUrl)} alt={item.ServiceName} />
                <span className={statusClass(item.Status)}>{item.Status}</span>
              </div>

              <div className="admin-service-body">
                <div className="admin-service-category">
                  {item.CategoryName || "Chưa có danh mục"}
                </div>
                <h3>{item.ServiceName}</h3>
                <p>{item.Description || "Chưa có mô tả dịch vụ."}</p>

                <div className="admin-service-price">
                  <strong>{money(item.Price)}</strong>
                  <span>{item.DurationMinutes} phút</span>
                </div>

                <div className="admin-service-info">
                  <div>
                    <span>Lịch hẹn</span>
                    <strong>{item.AppointmentCount || 0}</strong>
                  </div>
                  <div>
                    <span>Hoàn thành</span>
                    <strong>{item.CompletedCount || 0}</strong>
                  </div>
                  <div>
                    <span>Rating</span>
                    <strong>{Number(item.AvgRating || 0).toFixed(1)} ★</strong>
                  </div>
                  <div>
                    <span>Technician</span>
                    <strong>{item.TechnicianCount || 0}</strong>
                  </div>
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

                  {item.Status !== "AVAILABLE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "AVAILABLE")}
                    >
                      Mở bán
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      Tạm ngưng
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

          {!filteredItems.length ? (
            <div className="admin-empty">Không có dịch vụ phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-service-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-service-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.ServiceName}
            />

            <div className="admin-detail-title">
              <div>
                <span>{selected.CategoryName || "Chưa có danh mục"}</span>
                <h3>{selected.ServiceName}</h3>
              </div>
              <span className={statusClass(selected.Status)}>
                {selected.Status}
              </span>
            </div>

            <p className="admin-service-detail-desc">
              {selected.Description || "Chưa có mô tả dịch vụ."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Giá:</strong> {money(selected.Price)}
              </p>
              <p>
                <strong>Thời lượng:</strong> {selected.DurationMinutes} phút
              </p>
              <p>
                <strong>Tổng lịch hẹn:</strong> {selected.AppointmentCount || 0} ca
              </p>
              <p>
                <strong>Hoàn thành:</strong> {selected.CompletedCount || 0} ca
              </p>
              <p>
                <strong>Đánh giá:</strong> {selected.ReviewCount || 0} lượt
              </p>
              <p>
                <strong>Rating TB:</strong>{" "}
                ⭐ {Number(selected.AvgRating || 0).toFixed(1)} / 5
              </p>
              <p>
                <strong>Kỹ thuật viên:</strong> {selected.TechnicianCount || 0} người
              </p>
              <p>
                <strong>Trạng thái danh mục:</strong>{" "}
                {selected.CategoryStatus || "N/A"}
              </p>
            </div>

            <div className="admin-detail-technicians" style={{ padding: "0 24px 24px 24px", borderTop: "1px solid #f3f4f6", paddingTop: "16px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13.5px", fontWeight: "700", color: "#2b1c12" }}>Nhân viên kỹ thuật phụ trách:</h4>
              {loadingDetailTech ? (
                <span style={{ fontSize: "12px", color: "#64748b" }}>Đang tải danh sách nhân viên...</span>
              ) : detailTechnicians.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {detailTechnicians.map((t) => (
                    <div key={t.EmployeeId} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "4px 8px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                      <img src={image(t.ImageUrl || t.AvatarUrl)} alt={t.FullName} style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" }} />
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#334155" }}>{t.FullName} ({t.Specialization || t.Position || "KTV"})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Chưa phân bổ nhân viên kỹ thuật nào.</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-service-form"
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

            <h3>{editingId ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h3>

            <div className="admin-form-grid">
              <label>
                Danh mục *
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((c) => (
                    <option key={c.CategoryId} value={c.CategoryId}>
                      {c.CategoryName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </label>

              <label>
                Tên dịch vụ *
                <input
                  value={form.serviceName}
                  onChange={(e) =>
                    setForm({ ...form, serviceName: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Thời lượng phút *
                <input
                  type="number"
                  min="1"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Giá *
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </label>

              <label>
                ImageUrl
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="/images/services/skincare.png"
                />
              </label>

              <label className="admin-form-wide">
                Mô tả
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={4}
                />
              </label>
            </div>

            {editingId ? (
              <div className="admin-technician-box">
                <div className="admin-panel-head">
                  <div>
                    <h2>Technician phụ trách</h2>
                    <p>Chọn technician có thể thực hiện dịch vụ này.</p>
                  </div>

                  <button
                    type="button"
                    className="card-btn primary"
                    onClick={saveTechnicians}
                    disabled={savingTech}
                  >
                    {savingTech ? "Đang lưu..." : "Lưu technician"}
                  </button>
                </div>

                <div className="admin-technician-checks">
                  {technicians.map((t) => (
                    <label className="admin-tech-check" key={t.EmployeeId}>
                      <input
                        type="checkbox"
                        checked={selectedTechnicianIds.includes(
                          String(t.EmployeeId),
                        )}
                        onChange={() => toggleTechnician(t.EmployeeId)}
                      />
                      <img
                        src={image(t.ImageUrl || t.AvatarUrl)}
                        alt={t.FullName}
                      />
                      <div>
                        <strong>{t.FullName}</strong>
                        <span>
                          {t.Specialization || t.Position || "Technician"}
                        </span>
                      </div>
                    </label>
                  ))}

                  {!technicians.length ? (
                    <p className="admin-empty">Chưa có technician active.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

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
                {saving ? "Đang lưu..." : "Lưu dịch vụ"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
