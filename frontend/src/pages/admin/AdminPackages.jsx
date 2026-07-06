import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_IMAGE = "/images/packages/acne-package.png";

const emptyForm = {
  PackageCategoryId: "",
  PackageName: "",
  Description: "",
  OriginalPrice: "",
  SalePrice: "",
  TotalSessions: "1",
  ValidityDays: "30",
  ImageUrl: "",
  IsHot: false,
  Status: "ACTIVE",
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

export default function AdminPackages() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState({});
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    packageCategoryId: "",
    isHot: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const scrollToItem = (id, type = "package") => {
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

      const [listRes, categoryRes, serviceRes] = await Promise.all([
        axiosClient.get("/admin/packages", {
          params: {
            keyword: filters.keyword || undefined,
            status: filters.status || undefined,
            packageCategoryId: filters.packageCategoryId || undefined,
            isHot: filters.isHot || undefined,
          },
        }),
        axiosClient.get("/admin/packages/categories"),
        axiosClient.get("/admin/packages/services"),
      ]);

      setItems(listRes.data.data || listRes.data || []);
      setCategories(categoryRes.data.data || categoryRes.data || []);
      setServices(serviceRes.data.data || serviceRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được packages",
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
  }, [filters.status, filters.packageCategoryId, filters.isHot]);

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
    const wasEmpty = filters.status === "" && filters.packageCategoryId === "" && filters.isHot === "";
    setFilters({
      keyword: "",
      status: "",
      packageCategoryId: "",
      isHot: "",
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

  const selectedServiceList = useMemo(() => {
    return services
      .filter((s) => selectedServices[String(s.ServiceId)])
      .map((s) => ({
        ...s,
        SessionCount: Number(selectedServices[String(s.ServiceId)] || 1),
      }));
  }, [services, selectedServices]);

  const preview = useMemo(() => {
    const totalPrice = selectedServiceList.reduce(
      (sum, s) => sum + Number(s.Price || 0) * Number(s.SessionCount || 1),
      0,
    );

    const totalDuration = selectedServiceList.reduce(
      (sum, s) =>
        sum + Number(s.DurationMinutes || 0) * Number(s.SessionCount || 1),
      0,
    );

    const salePrice = Number(form.SalePrice || 0);
    const save = Math.max(totalPrice - salePrice, 0);

    return { totalPrice, totalDuration, save };
  }, [selectedServiceList, form.SalePrice]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      hot: items.filter((x) => x.IsHot).length,
      customers: items.reduce(
        (sum, x) => sum + Number(x.CustomerCount || 0),
        0,
      ),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedServices({});
    setShowModal(true);
    setError("");
  }

  async function openEdit(item) {
    try {
      setError("");
      setEditingId(item.PackageId);

      setForm({
        PackageCategoryId: item.PackageCategoryId
          ? String(item.PackageCategoryId)
          : "",
        PackageName: item.PackageName || "",
        Description: item.Description || "",
        OriginalPrice: String(item.OriginalPrice ?? ""),
        SalePrice: String(item.SalePrice ?? ""),
        TotalSessions: String(item.TotalSessions ?? "1"),
        ValidityDays: String(item.ValidityDays ?? "30"),
        ImageUrl: item.ImageUrl || "",
        IsHot: !!item.IsHot,
        Status: item.Status || "ACTIVE",
      });

      const res = await axiosClient.get(
        `/admin/packages/${item.PackageId}/services`,
      );

      const assigned = res.data.data || res.data || [];
      const next = {};

      assigned.forEach((s) => {
        if (s.IsAssigned) {
          next[String(s.ServiceId)] = Number(s.SessionCount || 1);
        }
      });

      setSelectedServices(next);
      setShowModal(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dịch vụ package",
      );
    }
  }

  function validate() {
    if (!form.PackageName.trim()) throw new Error("Vui lòng nhập tên package");

    if (form.OriginalPrice === "" || Number(form.OriginalPrice) < 0) {
      throw new Error("OriginalPrice không hợp lệ");
    }

    if (form.SalePrice === "" || Number(form.SalePrice) < 0) {
      throw new Error("SalePrice không hợp lệ");
    }

    if (Number(form.SalePrice) > Number(form.OriginalPrice)) {
      throw new Error("SalePrice không được lớn hơn OriginalPrice");
    }

    if (Number(form.TotalSessions) <= 0) {
      throw new Error("TotalSessions phải lớn hơn 0");
    }

    if (Number(form.ValidityDays) <= 0) {
      throw new Error("ValidityDays phải lớn hơn 0");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const servicesPayload = Object.entries(selectedServices).map(
        ([serviceId, sessionCount]) => ({
          serviceId: Number(serviceId),
          sessionCount: Number(sessionCount || 1),
        }),
      );

      const payload = {
        PackageCategoryId: form.PackageCategoryId
          ? Number(form.PackageCategoryId)
          : null,
        PackageName: form.PackageName.trim(),
        Description: form.Description.trim() || null,
        OriginalPrice: Number(form.OriginalPrice || 0),
        SalePrice: Number(form.SalePrice || 0),
        TotalSessions: Number(form.TotalSessions || 1),
        ValidityDays: Number(form.ValidityDays || 30),
        ImageUrl: form.ImageUrl.trim() || null,
        IsHot: form.IsHot ? 1 : 0,
        Status: form.Status,
        services: servicesPayload,
      };

      let pId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/packages/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/packages", payload);
        const created = res.data.data || res.data;
        pId = created?.PackageId || created?.id;
      }

      setShowModal(false);
      await load();
      if (pId) {
        scrollToItem(pId, "package");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu package thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    if (
      !window.confirm(
        `Đổi trạng thái "${item.PackageName}" thành ${nextStatus}?`,
      )
    )
      return;

    try {
      setError("");
      await axiosClient.patch(`/admin/packages/${item.PackageId}/status`, {
        status: nextStatus,
      });
      await load();
      scrollToItem(item.PackageId, "package");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function remove(item) {
    if (
      !window.confirm(`Bạn chắc chắn muốn xóa package "${item.PackageName}"?`)
    )
      return;

    try {
      setError("");
      await axiosClient.delete(`/admin/packages/${item.PackageId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa package thất bại",
      );
    }
  }

  function toggleService(id) {
    const key = String(id);

    setSelectedServices((prev) => {
      const next = { ...prev };

      if (next[key]) delete next[key];
      else next[key] = 1;

      return next;
    });
  }

  function changeServiceSession(id, value) {
    const key = String(id);
    const session = Math.max(1, Number(value || 1));

    setSelectedServices((prev) => ({
      ...prev,
      [key]: session,
    }));
  }

  return (
    <section className="admin-page admin-packages-page">
      <style>{`
        .admin-packages-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-packages-hero {
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

        .admin-packages-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-packages-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-packages-hero p {
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

        .admin-stat-card span {
          font-size: 12px;
          color: #bfaea3;
        }

        .admin-filter-panel.admin-packages-filter {
          background: #ffffff;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(31, 20, 14, 0.04);
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1.2fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(214, 181, 126, 0.15);
          backdrop-filter: blur(8px);
        }

        @media (max-width: 1024px) {
          .admin-filter-panel.admin-packages-filter {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .admin-filter-panel.admin-packages-filter {
            grid-template-columns: 1fr;
          }
        }

        .admin-filter-panel.admin-packages-filter input,
        .admin-filter-panel.admin-packages-filter select {
          padding: 11px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 10px;
          font-size: 14.5px;
          background: #fdfcfb;
          outline: none;
          transition: all 0.2s;
          color: #3a2519;
        }

        .admin-filter-panel.admin-packages-filter input:focus,
        .admin-filter-panel.admin-packages-filter select:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.15);
        }

        .admin-packages-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 30px;
        }

        @media (min-width: 992px) {
          .admin-packages-grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        /* Package Card Premium Layout */
        .admin-package-card {
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid #f0e9df;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 0 6px 15px rgba(0,0,0,0.02);
          position: relative;
        }

        .admin-package-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 15px 35px rgba(31, 20, 14, 0.1);
          border-color: #d6b57e;
        }

        .admin-package-image {
          position: relative;
          height: 200px;
          overflow: hidden;
          border-bottom: 3px solid #fcfaf7;
        }

        .admin-package-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .admin-package-card:hover .admin-package-image img {
          transform: scale(1.06);
        }

        .package-hot-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);
          color: #ffffff;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          box-shadow: 0 4px 10px rgba(185, 28, 28, 0.3);
          z-index: 2;
          animation: pulseGlow 2s infinite;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(185, 28, 28, 0); }
          100% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0); }
        }

        .admin-status {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 4px 12px;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          z-index: 2;
        }

        .admin-status-active { background: #dcfce7; color: #15803d; }
        .admin-status-inactive { background: #f1f5f9; color: #475569; }
        .admin-status-hidden { background: #ffedd5; color: #c2410c; }

        .admin-package-body {
          padding: 24px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .admin-package-tag {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #c7a36c;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .admin-package-body h3 {
          margin: 0 0 10px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f140e;
          line-height: 1.3;
        }

        .admin-package-body p {
          margin: 0 0 16px 0;
          font-size: 13.5px;
          color: #8c7e74;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 40px;
        }

        .admin-package-price {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          background: #faf8f5;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid #f5ede2;
        }

        .admin-package-price div {
          display: flex;
          flex-direction: column;
        }

        .admin-package-price span {
          font-size: 9px;
          text-transform: uppercase;
          color: #bfaea3;
          font-weight: 700;
        }

        .admin-package-price strong {
          font-size: 20px;
          color: #1f140e;
          font-weight: 800;
        }

        .admin-package-price del {
          font-size: 14px;
          color: #bfaea3;
          font-weight: 600;
        }

        .admin-package-info {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 18px;
          text-align: center;
        }

        .admin-package-info div {
          display: flex;
          flex-direction: column;
          background: #fbf9f6;
          padding: 8px 4px;
          border-radius: 10px;
          border: 1px solid #f5ede2;
        }

        .admin-package-info span {
          font-size: 8px;
          text-transform: uppercase;
          color: #bfaea3;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .admin-package-info strong {
          font-size: 13px;
          color: #3a2519;
          font-weight: 700;
        }

        .admin-package-services {
          font-size: 12.5px;
          color: #8c7e74;
          margin-bottom: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-top: 1px solid #f5ede2;
          padding-top: 12px;
          font-style: italic;
        }

        .admin-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
        }

        .card-btn {
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid #ebdcc5;
          background: #ffffff;
          color: #5c4a3c;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .card-btn:hover {
          background: #fbf9f6;
          border-color: #c7a36c;
          color: #1f140e;
        }

        .card-btn.primary {
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          border: none;
        }

        .card-btn.primary:hover {
          background: linear-gradient(135deg, #322117 0%, #4f3323 100%);
          box-shadow: 0 4px 10px rgba(31, 20, 14, 0.2);
        }

        .card-btn.danger {
          color: #b91c1c;
          border-color: #fee2e2;
        }

        .card-btn.danger:hover {
          background: #fef2f2;
          border-color: #b91c1c;
        }

        /* Modal Layouts */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(31, 20, 14, 0.6);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 24px;
          width: 100%;
          max-width: 620px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(214, 181, 126, 0.2);
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
          top: 18px;
          right: 18px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(31, 20, 14, 0.05);
          border: 0;
          font-size: 22px;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #5c4a3c;
          transition: all 0.2s;
          z-index: 10;
        }

        .admin-modal-close:hover {
          background: rgba(31, 20, 14, 0.1);
          color: #1f140e;
          transform: rotate(90deg);
        }

        /* Detail Modal layout */
        .admin-package-detail-image {
          width: 100%;
          height: 240px;
          object-fit: cover;
          border-bottom: 4px solid #d6b57e;
        }

        .admin-detail-title {
          padding: 24px 24px 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .admin-detail-title h3 {
          margin: 4px 0 0 0;
          font-size: 24px;
          font-weight: 700;
          color: #1f140e;
        }

        .admin-detail-title span {
          font-size: 11px;
          text-transform: uppercase;
          color: #c7a36c;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .admin-package-detail-desc {
          padding: 0 24px 16px 24px;
          margin: 0;
          font-size: 14px;
          color: #8c7e74;
          line-height: 1.6;
        }

        .admin-detail-grid {
          padding: 0 24px 24px 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          overflow-y: auto;
        }

        .admin-detail-grid p {
          margin: 0;
          background: #fdfcfb;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #f5ede2;
          font-size: 13.5px;
          color: #5c4a3c;
        }

        .admin-detail-grid strong {
          color: #bfaea3;
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          margin-bottom: 4px;
          font-weight: 700;
        }

        /* Luxury Package Editor layout */
        .luxury-package-editor {
          max-width: 840px;
        }

        .package-editor-head {
          padding: 24px;
          background: #faf8f5;
          border-bottom: 1px solid #ebdcc5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .package-editor-head {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .package-editor-head h3 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f140e;
        }

        .package-editor-head p {
          margin: 0;
          font-size: 12.5px;
          color: #8c7e74;
        }

        .package-preview-card {
          background: linear-gradient(135deg, #1f140e 0%, #3e271a 100%);
          border-radius: 18px;
          width: 300px;
          min-width: 300px;
          padding: 20px;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 8px 20px rgba(31, 20, 14, 0.15);
          border: 1px solid rgba(214, 181, 126, 0.25);
        }

        .package-preview-card small {
          font-size: 8px;
          font-weight: 700;
          color: #d6b57e;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .package-preview-card strong {
          font-size: 16px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .package-preview-card b {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
        }

        .package-preview-card span {
          font-size: 11px;
          color: #bfaea3;
        }

        .package-editor-layout {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 24px;
          padding: 24px;
          overflow-y: auto;
          flex-grow: 1;
        }

        @media (max-width: 768px) {
          .package-editor-layout {
            grid-template-columns: 1fr;
          }
        }

        .package-section-title {
          display: flex;
          gap: 12px;
          align-items: center;
          margin: 16px 0 12px 0;
          border-bottom: 1px solid #f5ede2;
          padding-bottom: 8px;
        }

        .package-section-title:first-of-type {
          margin-top: 0;
        }

        .package-section-title span {
          font-size: 16px;
          font-weight: 800;
          color: #d6b57e;
          background: #fbf9f6;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1px solid #ebdcc5;
        }

        .package-section-title h4 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #1f140e;
        }

        .package-section-title p {
          margin: 0;
          font-size: 11px;
          color: #8c7e74;
        }

        .admin-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .admin-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #5c4a3c;
        }

        .admin-form-grid label.admin-form-wide {
          grid-column: 1 / -1;
        }

        .admin-form-grid input,
        .admin-form-grid select,
        .admin-form-grid textarea {
          padding: 10px 14px;
          border: 1px solid #ebdcc5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #fdfcfb;
          transition: all 0.2s;
          color: #1f140e;
        }

        .admin-form-grid input:focus,
        .admin-form-grid select:focus,
        .admin-form-grid textarea:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.1);
        }

        .package-service-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 280px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .package-service-check {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #fbf9f6;
          border-radius: 12px;
          border: 1px solid #f5ede2;
          transition: all 0.2s ease;
        }

        .package-service-check.checked {
          background: #ffffff;
          border-color: #d6b57e;
        }

        .package-service-check img {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          object-fit: cover;
        }

        .package-service-check div {
          flex-grow: 1;
        }

        .package-service-check strong {
          font-size: 13.5px;
          color: #1f140e;
          display: block;
        }

        .package-service-check span {
          font-size: 11px;
          color: #8c7e74;
        }

        .package-session-input {
          width: 60px;
          padding: 6px 8px;
          border: 1px solid #ebdcc5;
          border-radius: 6px;
          font-size: 13px;
          text-align: center;
          outline: none;
        }

        .package-session-input:focus {
          border-color: #c7a36c;
        }

        .package-editor-side {
          background: #faf8f5;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #ebdcc5;
          align-self: start;
        }

        .package-editor-side h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 700;
          color: #1f140e;
          border-bottom: 1px solid #ebdcc5;
          padding-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .package-summary-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dashed #f5ede2;
          font-size: 13px;
        }

        .package-summary-card:last-child {
          border-bottom: none;
        }

        .package-summary-card span {
          color: #8c7e74;
        }

        .package-summary-card strong {
          color: #1f140e;
          font-weight: 700;
          max-width: 60%;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .package-editor-actions {
          padding: 20px 24px;
          border-top: 1px solid #ebdcc5;
          background: #faf8f5;
          margin-top: 0;
        }

        .admin-empty {
          text-align: center;
          padding: 40px;
          background: #ffffff;
          border-radius: 16px;
          color: #8c7e74;
          border: 1px dashed #ebdcc5;
          font-weight: 600;
        }

        .admin-loading-card {
          text-align: center;
          padding: 30px;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #f0e9df;
          color: #d6b57e;
          font-weight: 700;
        }

        .admin-error-card {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 14px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>

      <div className="admin-packages-hero">
        <div>
          <div className="admin-eyebrow">Packages Management</div>
          <h1>Quản lý gói dịch vụ</h1>
          <p>
            Quản lý combo, liệu trình trị liệu dài ngày. Thiết lập OriginalPrice, SalePrice,
            TotalSessions, ValidityDays, IsHot và gán số lượng buổi cho từng dịch vụ con của Luxury Spa.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          <span>➕</span> Thêm package
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">📦</div>
          <div>
            <p>Tổng package</p>
            <h3>{stats.total}</h3>
            <span>Tất cả gói dịch vụ</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
            <span>Status ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🔥</div>
          <div>
            <p>Gói Hot</p>
            <h3>{stats.hot}</h3>
            <span>IsHot = true</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Đã bán</p>
            <h3>{stats.customers}</h3>
            <span>Tổng lượt mua thực tế</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-packages-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm tên package hoặc mô tả..."
        />

        <select
          value={filters.packageCategoryId}
          onChange={(e) =>
            setFilters({ ...filters, packageCategoryId: e.target.value })
          }
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.PackageCategoryId} value={c.PackageCategoryId}>
              {c.CategoryName}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="HIDDEN">HIDDEN</option>
        </select>

        <select
          value={filters.isHot}
          onChange={(e) => setFilters({ ...filters, isHot: e.target.value })}
        >
          <option value="">Tất cả độ hot</option>
          <option value="1">Hot</option>
          <option value="0">Bình thường</option>
        </select>

        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          Lọc
        </button>

        <button className="card-btn" onClick={handleClearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách packages...</div>
      ) : null}

      {!loading ? (
        <div className="admin-packages-grid" ref={gridRef}>
          {items.map((item) => (
            <article 
              className="admin-package-card" 
              id={`package-card-${item.PackageId}`} 
              key={item.PackageId}
            >
              <div className="admin-package-image">
                <img src={image(item.ImageUrl)} alt={item.PackageName} />
                <span className={statusClass(item.Status)}>{item.Status}</span>
                {item.IsHot ? <span className="package-hot-badge">🔥 HOT</span> : null}
              </div>

              <div className="admin-package-body">
                <div className="admin-package-tag">
                  {item.PackageCategoryName || "Package"}
                </div>

                <h3>{item.PackageName}</h3>
                <p>{item.Description || "Chưa có mô tả chi tiết cho gói combo này."}</p>

                <div className="admin-package-price">
                  <div>
                    <span>Sale Price</span>
                    <strong>{money(item.SalePrice)}</strong>
                  </div>
                  <del>{money(item.OriginalPrice)}</del>
                </div>

                <div className="admin-package-info">
                  <div>
                    <span>Số buổi</span>
                    <strong>{item.TotalSessions || 0}</strong>
                  </div>
                  <div>
                    <span>Thời hạn</span>
                    <strong>{item.ValidityDays || 0} ngày</strong>
                  </div>
                  <div>
                    <span>Dịch vụ con</span>
                    <strong>{item.ServiceCount || 0}</strong>
                  </div>
                  <div>
                    <span>Khách mua</span>
                    <strong>{item.CustomerCount || 0}</strong>
                  </div>
                </div>

                <div className="admin-package-services">
                  {item.ServiceNames || "Chưa gán dịch vụ con"}
                </div>

                <div className="admin-card-actions">
                  <button
                    className="card-btn"
                    onClick={() => setSelected(item)}
                  >
                    💡 Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    ✏️ Sửa
                  </button>

                  {item.Status === "ACTIVE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      🔕 Tắt
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "ACTIVE")}
                    >
                      <span>🔔</span> Bật
                    </button>
                  )}

                  <button
                    className="card-btn danger"
                    onClick={() => remove(item)}
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có package phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-package-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <img
              className="admin-package-detail-image"
              src={image(selected.ImageUrl)}
              alt={selected.PackageName}
            />

            <div className="admin-detail-title">
              <div>
                <span>{selected.PackageCategoryName || "PACKAGE"}</span>
                <h3>{selected.PackageName}</h3>
              </div>
              <span className={statusClass(selected.Status)}>
                {selected.Status}
              </span>
            </div>

            <p className="admin-package-detail-desc">
              {selected.Description || "Chưa có mô tả package."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Giá gốc niêm yết</strong>
                {money(selected.OriginalPrice)}
              </p>
              <p>
                <strong>Giá khuyến mãi combo</strong>
                {money(selected.SalePrice)}
              </p>
              <p>
                <strong>Tiết kiệm khi mua combo</strong>
                {money(
                  Number(selected.OriginalPrice || 0) -
                    Number(selected.SalePrice || 0),
                )}
              </p>
              <p>
                <strong>Tổng số buổi trị liệu</strong>
                {selected.TotalSessions || 0} buổi
              </p>
              <p>
                <strong>Thời hạn liệu trình</strong>
                {selected.ValidityDays || 0} ngày
              </p>
              <p>
                <strong>Gói ưu tiên Hot</strong>
                {selected.IsHot ? "Có" : "Không"}
              </p>
              <p>
                <strong>Số lượng dịch vụ con</strong>
                {selected.ServiceCount || 0} dịch vụ
              </p>
              <p>
                <strong>Tổng số khách hàng mua</strong>
                {selected.CustomerCount || 0} khách
              </p>
              <p>
                <strong>Số khách đang kích hoạt</strong>
                {selected.ActiveCustomerCount || 0} khách
              </p>
              <p>
                <strong>Tổng giá trị dịch vụ lẻ</strong>
                {money(selected.TotalServicePrice)}
              </p>
              <p>
                <strong>Tổng thời gian liệu trình</strong>
                {selected.TotalDurationMinutes || 0} phút
              </p>
              <p className="admin-form-wide">
                <strong>Danh sách chi tiết dịch vụ đi kèm</strong>
                {selected.ServiceNames || "Chưa gán dịch vụ"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-package-form luxury-package-editor"
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

            <div className="package-editor-head">
              <div>
                <span>{editingId ? "Edit Package" : "Create Package"}</span>
                <h3>{editingId ? "Sửa package" : "Thêm package mới"}</h3>
                <p>
                  Thiết lập combo trị liệu: OriginalPrice, SalePrice, TotalSessions,
                  ValidityDays và session cho từng dịch vụ.
                </p>
              </div>

              <div className="package-preview-card">
                <small>LIVE PREVIEW</small>
                <strong>{form.PackageName || "LUXURY SPA COMBO"}</strong>
                <b>{money(form.SalePrice || 0)}</b>
                <span>
                  {Object.keys(selectedServices).length} dịch vụ con •{" "}
                  {form.ValidityDays || 0} ngày sử dụng
                </span>
              </div>
            </div>

            <div className="package-editor-layout">
              <div className="package-editor-main">
                <div className="package-section-title">
                  <span>1</span>
                  <div>
                    <h4>Thông tin package</h4>
                    <p>Nhập đúng các cột đang có trong bảng Packages.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Danh mục package
                    <select
                      value={form.PackageCategoryId}
                      onChange={(e) =>
                        setForm({ ...form, PackageCategoryId: e.target.value })
                      }
                    >
                      <option value="">Chưa chọn</option>
                      {categories.map((c) => (
                        <option
                          key={c.PackageCategoryId}
                          value={c.PackageCategoryId}
                        >
                          {c.CategoryName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Trạng thái
                    <select
                      value={form.Status}
                      onChange={(e) =>
                        setForm({ ...form, Status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="HIDDEN">HIDDEN</option>
                    </select>
                  </label>

                  <label className="admin-form-wide">
                    Tên package *
                    <input
                      value={form.PackageName}
                      onChange={(e) =>
                        setForm({ ...form, PackageName: e.target.value })
                      }
                      placeholder="Combo Nâng Cơ Trị Mụn Chuyên Sâu"
                      required
                    />
                  </label>

                  <label>
                    IsHot
                    <select
                      value={form.IsHot ? "1" : "0"}
                      onChange={(e) =>
                        setForm({ ...form, IsHot: e.target.value === "1" })
                      }
                    >
                      <option value="0">Bình thường</option>
                      <option value="1">Gói Hot 🔥</option>
                    </select>
                  </label>

                  <label>
                    OriginalPrice *
                    <input
                      type="number"
                      min="0"
                      value={form.OriginalPrice}
                      onChange={(e) =>
                        setForm({ ...form, OriginalPrice: e.target.value })
                      }
                      placeholder="1200000"
                      required
                    />
                  </label>

                  <label>
                    SalePrice *
                    <input
                      type="number"
                      min="0"
                      value={form.SalePrice}
                      onChange={(e) =>
                        setForm({ ...form, SalePrice: e.target.value })
                      }
                      placeholder="850000"
                      required
                    />
                  </label>

                  <label>
                    TotalSessions *
                    <input
                      type="number"
                      min="1"
                      value={form.TotalSessions}
                      onChange={(e) =>
                        setForm({ ...form, TotalSessions: e.target.value })
                      }
                      placeholder="5"
                      required
                    />
                  </label>

                  <label>
                    ValidityDays *
                    <input
                      type="number"
                      min="1"
                      value={form.ValidityDays}
                      onChange={(e) =>
                        setForm({ ...form, ValidityDays: e.target.value })
                      }
                      placeholder="30"
                      required
                    />
                  </label>

                  <label className="admin-form-wide">
                    ImageUrl
                    <input
                      value={form.ImageUrl}
                      onChange={(e) =>
                        setForm({ ...form, ImageUrl: e.target.value })
                      }
                      placeholder="/images/packages/acne-package.png"
                    />
                  </label>

                  <label className="admin-form-wide">
                    Mô tả
                    <textarea
                      rows={4}
                      value={form.Description}
                      onChange={(e) =>
                        setForm({ ...form, Description: e.target.value })
                      }
                      placeholder="Nhập mô tả quyền lợi của gói combo trị liệu..."
                    />
                  </label>
                </div>

                <div className="package-section-title">
                  <span>2</span>
                  <div>
                    <h4>Dịch vụ trong package</h4>
                    <p>Chọn dịch vụ và nhập số buổi cho từng dịch vụ.</p>
                  </div>
                </div>

                <div className="package-service-list">
                  {services.map((s) => {
                    const checked = !!selectedServices[String(s.ServiceId)];

                    return (
                      <div
                        className={`package-service-check ${checked ? "checked" : ""}`}
                        key={s.ServiceId}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(s.ServiceId)}
                        />

                        <img src={image(s.ImageUrl)} alt={s.ServiceName} />

                        <div>
                          <strong>{s.ServiceName}</strong>
                          <span>
                            {s.CategoryName || "No category"} • {money(s.Price)}{" "}
                            • {s.DurationMinutes} phút
                          </span>
                        </div>

                        {checked ? (
                          <input
                            className="package-session-input"
                            type="number"
                            min="1"
                            value={selectedServices[String(s.ServiceId)]}
                            onChange={(e) =>
                              changeServiceSession(s.ServiceId, e.target.value)
                            }
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  {!services.length ? (
                    <p className="admin-empty">Chưa có service AVAILABLE.</p>
                  ) : null}
                </div>
              </div>

              <aside className="package-editor-side">
                <h4>Tóm tắt package</h4>

                <div className="package-summary-card">
                  <span>Tên gói</span>
                  <strong>{form.PackageName || "Chưa nhập"}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Giá niêm yết</span>
                  <strong>{money(form.OriginalPrice || 0)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Giá bán Combo</span>
                  <strong>{money(form.SalePrice || 0)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Giảm trực tiếp</span>
                  <strong>
                    {money(
                      Math.max(
                        Number(form.OriginalPrice || 0) -
                          Number(form.SalePrice || 0),
                        0,
                      ),
                    )}
                  </strong>
                </div>

                <div className="package-summary-card">
                  <span>Tổng giá dịch vụ lẻ</span>
                  <strong>{money(preview.totalPrice)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Tiết kiệm so với mua lẻ</span>
                  <strong>{money(preview.save)}</strong>
                </div>

                <div className="package-summary-card">
                  <span>Tổng thời lượng</span>
                  <strong>{preview.totalDuration} phút</strong>
                </div>

                <div className="package-summary-card">
                  <span>Dịch vụ đã chọn</span>
                  <strong>{Object.keys(selectedServices).length} dịch vụ</strong>
                </div>

                <div className="package-summary-card">
                  <span>Gói ưu tiên Hot</span>
                  <strong>{form.IsHot ? "Có" : "Không"}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions package-editor-actions">
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
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Cập nhật package"
                    : "Tạo package"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
