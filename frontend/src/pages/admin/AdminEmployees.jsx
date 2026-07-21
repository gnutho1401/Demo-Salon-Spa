import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  roleId: "",
  userStatus: "ACTIVE",
  status: "ACTIVE",
  branchId: "",
  position: "",
  specialization: "",
  salary: "",
  hireDate: "",
  yearsOfExperience: "",
  bio: "",
  avatarUrl: "",
  imageUrl: "",
  password: "",
};

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function AdminEmployees() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Tabs inside detail modal
  const [activeDetailTab, setActiveDetailTab] = useState("general");
  const [scrollTargetId, setScrollTargetId] = useState(null);

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  // Service assignment states
  const [assigningEmployee, setAssigningEmployee] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [savingServices, setSavingServices] = useState(false);

  async function load(isSilent = false) {
    try {
      setError("");
      if (!isSilent && items.length === 0) setLoading(true);

      const [empRes, roleRes, branchRes] = await Promise.all([
        axiosClient.get("/admin/employees", {
          params: {
            keyword: keyword || undefined,
            roleId: roleId || undefined,
            branchId: branchId || undefined,
            status: status || undefined,
          },
        }),
        axiosClient.get("/admin/employees/roles"),
        axiosClient.get("/admin/employees/branches"),
      ]);

      setItems(empRes.data.data || empRes.data || []);
      setRoles(roleRes.data.data || roleRes.data || []);
      setBranches(branchRes.data.data || branchRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách nhân viên",
      );
    } finally {
      setLoading(false);
    }
  }

  const scrollToGrid = () => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  };

  const triggerScrollToItem = (id) => {
    if (!id) return;
    setScrollTargetId(id);
  };

  useLayoutEffect(() => {
    if (!scrollTargetId) return;

    const el = document.getElementById(`employee-card-${scrollTargetId}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });

      el.style.transition = "all 0.3s ease";
      el.style.borderColor = "#d6b57e";
      el.style.boxShadow = "0 0 30px 8px rgba(214, 181, 126, 0.8)";
      el.style.transform = "scale(1.02)";

      const timer = setTimeout(() => {
        el.style.borderColor = "";
        el.style.boxShadow = "";
        el.style.transform = "";
        setScrollTargetId(null);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [items, scrollTargetId]);

  const handleFilter = async () => {
    shouldScrollRef.current = true;
    await load();
    scrollToGrid();
    shouldScrollRef.current = false;
  };

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
  }, [roleId, branchId, status]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.Status === "ACTIVE").length;
    const inactive = items.filter((x) => x.Status === "INACTIVE").length;
    const banned = items.filter((x) => x.Status === "BANNED").length;
    const technician = items.filter((x) => x.RoleName === "TECHNICIAN").length;
    return { total, active, inactive, banned, technician };
  }, [items]);

  function openDetail(item) {
    setSelected(item);
    setActiveDetailTab("general");
    triggerScrollToItem(item.EmployeeId);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setImageFile(null);
    setImagePreview("");
    setShowModal(true);
  }

  function openEdit(item) {
    setEditingId(item.EmployeeId);
    setError("");
    setForm({
      fullName: item.FullName || "",
      email: item.Email || "",
      phone: item.Phone || "",
      roleId: String(item.RoleId || ""),
      userStatus: item.UserStatus || "ACTIVE",
      status: item.Status || "ACTIVE",
      branchId: item.BranchId ? String(item.BranchId) : "",
      position: item.Position || "",
      specialization: item.Specialization || "",
      salary: item.Salary ?? "",
      hireDate: item.HireDate ? String(item.HireDate).slice(0, 10) : "",
      yearsOfExperience: item.YearsOfExperience ?? "",
      bio: item.Bio || "",
      avatarUrl: item.AvatarUrl || "",
      imageUrl: item.ImageUrl || item.AvatarUrl || "",
      password: "",
    });
    setImageFile(null);
    setImagePreview(item.ImageUrl || item.AvatarUrl ? resolveFileUrl(item.ImageUrl || item.AvatarUrl) : "");
    setShowModal(true);
    triggerScrollToItem(item.EmployeeId);
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.fullName.trim()) return setError("Vui lòng nhập họ tên");
    if (!form.email.trim()) return setError("Vui lòng nhập email");
    if (!form.roleId) return setError("Vui lòng chọn vai trò");
    if (!editingId && !form.password.trim()) {
      return setError("Vui lòng nhập mật khẩu khi tạo nhân viên");
    }

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      roleId: Number(form.roleId),
      userStatus: form.userStatus,
      status: form.status,
      branchId: form.branchId ? Number(form.branchId) : null,
      position: form.position.trim() || null,
      specialization: form.specialization.trim() || null,
      salary: form.salary === "" ? null : Number(form.salary),
      hireDate: form.hireDate || null,
      yearsOfExperience:
        form.yearsOfExperience === "" ? 0 : Number(form.yearsOfExperience),
      bio: form.bio.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      imageUrl: form.imageUrl.trim() || form.avatarUrl.trim() || null,
    };

    if (!editingId) payload.password = form.password;

    try {
      setSaving(true);
      setError("");

      let empId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/employees/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/employees", payload);
        const created = res.data.data || res.data;
        empId = created?.EmployeeId || created?.id;
      }

      if (imageFile && empId) {
        const fd = new FormData();
        fd.append("image", imageFile);
        await axiosClient.post(`/admin/employees/${empId}/image`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setShowModal(false);
      setImageFile(null);
      setImagePreview("");
      await load(true);
      if (empId) {
        triggerScrollToItem(empId);
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu nhân viên thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái của nhân viên ${item.FullName} thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/employees/${item.EmployeeId}/status`, {
        status: nextStatus,
      });
      await load(true);
      triggerScrollToItem(item.EmployeeId);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function removeEmployee(item) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa nhân viên "${item.FullName}" (${item.Email})?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/employees/${item.EmployeeId}`);
      await load(true);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa nhân viên thất bại",
      );
    }
  }

  // Open Service Assignment Modal
  const openServiceAssign = async (employee) => {
    setAssigningEmployee(employee);
    triggerScrollToItem(employee.EmployeeId);
    setLoadingServices(true);
    try {
      const res = await axiosClient.get(`/admin/employees/${employee.EmployeeId}/services`);
      const servicesData = res.data.data || res.data || [];
      setAllServices(servicesData);
      setSelectedServices(servicesData.filter(s => s.Assigned === 1).map(s => s.ServiceId));
    } catch (err) {
      console.error("Error loading employee services", err);
      alert("Không tải được danh sách dịch vụ của nhân viên");
    } finally {
      setLoadingServices(false);
    }
  };

  const handleCheckboxChange = (serviceId) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const saveServices = async () => {
    if (!assigningEmployee) return;
    setSavingServices(true);
    try {
      await axiosClient.put(`/admin/employees/${assigningEmployee.EmployeeId}/services`, {
        serviceIds: selectedServices
      });
      const empId = assigningEmployee.EmployeeId;
      setAssigningEmployee(null);
      await load(true);
      triggerScrollToItem(empId);
    } catch (err) {
      console.error("Error saving services", err);
      alert("Lưu phân bổ dịch vụ thất bại");
    } finally {
      setSavingServices(false);
    }
  };

  // Group services by category name
  const groupedServices = useMemo(() => {
    const groups = {};
    allServices.forEach(s => {
      const cat = s.CategoryName || "Khác";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [allServices]);

  return (
    <section className="admin-page admin-employees-page">
      <style>{`
        .admin-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }
        .admin-employee-hero {
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
        .admin-employee-hero::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: rgba(214, 181, 126, 0.1);
          right: -30px;
          bottom: -30px;
        }
        .admin-employee-hero h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .admin-employee-hero p {
          margin: 0;
          color: #f3dfbd;
          font-size: 14px;
          opacity: 0.9;
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
        .stat-card-total { border-left-color: #3b82f6; }
        .stat-card-active { border-left-color: #10b981; }
        .stat-card-technician { border-left-color: #8b5cf6; }
        .stat-card-inactive { border-left-color: #ef4444; }

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

        .admin-filter-panel {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(43, 28, 18, 0.1), 0 8px 10px -6px rgba(43, 28, 18, 0.1);
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(173, 136, 83, 0.15);
        }
        @media (max-width: 900px) {
          .admin-filter-panel {
            grid-template-columns: 1fr;
          }
        }
        .filter-input-text,
        .filter-select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          background: #f8fafc;
          outline: none;
          transition: all 0.2s;
        }
        .filter-input-text:focus,
        .filter-select:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }

        .admin-employee-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .admin-employee-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }
        .admin-employee-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(43, 28, 18, 0.12);
          border-color: #d6b57e;
        }
        .card-header-gradient {
          height: 8px;
          background: linear-gradient(90deg, #d6b57e, #4a3222);
        }
        .admin-employee-card-body {
          padding: 20px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }
        .admin-employee-top {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }
        .admin-employee-top img {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d6b57e;
          box-shadow: 0 4px 10px rgba(0,0,0,0.08);
        }
        .admin-employee-top-info {
          min-width: 0;
        }
        .admin-employee-top-info h3 {
          margin: 0;
          font-size: 16px;
          color: #1e293b;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .admin-employee-top-info p {
          margin: 2px 0 6px 0;
          font-size: 13px;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge-active { background: #dcfce7; color: #15803d; }
        .status-badge-inactive { background: #f1f5f9; color: #475569; }
        .status-badge-banned { background: #fee2e2; color: #b91c1c; }

        .admin-employee-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .info-item {
          background: #f8fafc;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .info-item span {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .info-item strong {
          color: #334155;
          font-size: 12.5px;
        }
        
        .card-btn-action {
          border: 0;
          border-radius: 6px;
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .card-btn-action.btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        .card-btn-action.btn-secondary:hover {
          background: #e2e8f0;
        }
        .card-btn-action.btn-primary {
          background: #a0573a;
          color: #ffffff;
        }
        .card-btn-action.btn-primary:hover {
          background: #8b4a2f;
        }
        .card-btn-action.btn-danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        .card-btn-action.btn-danger:hover {
          background: #fca5a5;
        }

        /* Modal styling */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          width: 90%;
          max-width: 700px;
          position: relative;
        }
        .admin-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          font-size: 20px;
          color: #64748b;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all 0.2s;
        }
        .admin-modal-close:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        
        .modal-title {
          padding: 20px 24px;
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .modal-body {
          padding: 24px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        /* Detail layout */
        .detail-header {
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 20px;
        }
        .detail-header img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #d6b57e;
        }
        .detail-header-info h2 {
          margin: 0;
          font-size: 22px;
          color: #1e293b;
        }
        .detail-header-info p {
          margin: 4px 0;
          color: #64748b;
          font-size: 14px;
        }

        .detail-tabs {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 20px;
        }
        .detail-tab-btn {
          padding: 10px 20px;
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .detail-tab-btn.active {
          color: #a0573a;
          border-bottom-color: #a0573a;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .detail-grid p {
          margin: 0;
          font-size: 14px;
          color: #475569;
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        
        /* Form grid */
        .admin-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .admin-form-grid {
            grid-template-columns: 1fr;
          }
        }
        .form-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
        .form-input {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          transition: all 0.2s;
        }
        .form-input:focus {
          border-color: #a0573a;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }
        .form-wide {
          grid-column: 1 / -1;
        }

        /* Group services grid */
        .category-group-box {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .category-group-header {
          background: #f8fafc;
          padding: 12px 16px;
          font-weight: 700;
          color: #334155;
          font-size: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .services-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          padding: 16px;
        }
        .service-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
          cursor: pointer;
        }
      `}</style>

      {/* Header section */}
      <div className="admin-employee-hero">
        <div>
          <div className="admin-eyebrow" style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontSize: "11px", color: "#d6b57e" }}>
            Hệ thống quản trị
          </div>
          <h1>Quản lý nhân sự</h1>
          <p>
            Quản lý tài khoản nhân viên, vị trí, mức lương, chi nhánh và dịch vụ phụ trách của kỹ thuật viên Spa.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm nhân viên
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      {/* Stats row */}
      <div className="admin-stat-grid">
        <article className="admin-stat-card stat-card-total">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Tổng nhân sự</p>
            <h3>{stats.total}</h3>
            <span>Thành viên trong hệ thống</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-active">
          <div className="admin-stat-icon">🟢</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
            <span>Kênh sẵn sàng làm việc</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-technician">
          <div className="admin-stat-icon">💆</div>
          <div>
            <p>Kỹ thuật viên</p>
            <h3>{stats.technician}</h3>
            <span>Phụ trách trị liệu/spa</span>
          </div>
        </article>

        <article className="admin-stat-card stat-card-inactive">
          <div className="admin-stat-icon">⚠️</div>
          <div>
            <p>Tạm ngưng / Bị khóa</p>
            <h3>{stats.inactive + stats.banned}</h3>
            <span>Tài khoản INACTIVE / BANNED</span>
          </div>
        </article>
      </div>

      {/* Filters bar */}
      <div className="admin-filter-panel">
        <input
          className="filter-input-text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFilter();
            }
          }}
          placeholder="Tìm theo tên, email, số điện thoại..."
        />

        <select
          className="filter-select"
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            shouldScrollRef.current = true;
          }}
        >
          <option value="">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.RoleId} value={r.RoleId}>
              {r.RoleName}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            shouldScrollRef.current = true;
          }}
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.BranchId} value={b.BranchId}>
              {b.BranchName}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            shouldScrollRef.current = true;
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BANNED">BANNED</option>
        </select>

        <button className="admin-refresh-btn" style={{ padding: "10px 20px" }} onClick={handleFilter}>
          Lọc dữ liệu
        </button>
      </div>

      <div ref={gridRef}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            Đang tải danh sách nhân viên...
          </div>
        ) : (
          <div className="admin-employee-grid">
          {items.map((item) => (
            <article className="admin-employee-card" id={`employee-card-${item.EmployeeId}`} key={item.EmployeeId}>
              <div className="card-header-gradient" />
              <div className="admin-employee-card-body">
                <div className="admin-employee-top">
                  <img
                    src={avatar(item.ImageUrl || item.AvatarUrl)}
                    alt={item.FullName}
                  />
                  <div className="admin-employee-top-info">
                    <h3>{item.FullName}</h3>
                    <p>{item.Email}</p>
                    <span className={`status-badge status-badge-${String(item.Status).toLowerCase()}`}>
                      {item.Status}
                    </span>
                  </div>
                </div>

                <div className="admin-employee-info">
                  <div className="info-item">
                    <span>Vai trò</span>
                    <strong>{item.RoleName}</strong>
                  </div>
                  <div className="info-item">
                    <span>Chi nhánh</span>
                    <strong>{item.BranchName || "Chưa có"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Vị trí</span>
                    <strong>{item.Position || "Chưa có"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Chuyên môn</span>
                    <strong>{item.Specialization || "Chưa có"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Mức lương</span>
                    <strong>{money(item.Salary)}</strong>
                  </div>
                  <div className="info-item">
                    <span>Kinh nghiệm</span>
                    <strong>{item.YearsOfExperience || 0} năm</strong>
                  </div>
                  <div className="info-item">
                    <span>Lịch hẹn</span>
                    <strong>{item.TotalAppointments || 0} ca</strong>
                  </div>
                  <div className="info-item">
                    <span>Đánh giá</span>
                    <strong style={{ color: "#eab308" }}>
                      ★ {Number(item.AvgRating || 0).toFixed(1)} ({item.ReviewCount})
                    </strong>
                  </div>
                  <div className="info-item form-wide" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ marginBottom: "0" }}>Dịch vụ phụ trách</span>
                      <strong>{item.ServiceCount || 0} dịch vụ</strong>
                    </div>
                    {item.RoleName === "TECHNICIAN" && (
                      <button
                        className="card-btn-action btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => openServiceAssign(item)}
                      >
                        Phân bổ
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ flexGrow: 1 }} />

                <div style={{ display: "flex", gap: "6px", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "12px", flexWrap: "wrap" }}>
                  <button className="card-btn-action btn-secondary" style={{ flex: "1 1 30%" }} onClick={() => openDetail(item)}>
                    Chi tiết
                  </button>
                  <button className="card-btn-action btn-primary" style={{ flex: "1 1 30%" }} onClick={() => openEdit(item)}>
                    Sửa
                  </button>
                  {item.Status !== "ACTIVE" ? (
                    <button className="card-btn-action btn-secondary" onClick={() => changeStatus(item, "ACTIVE")}>
                      Mở khóa
                    </button>
                  ) : (
                    <button className="card-btn-action btn-secondary" onClick={() => changeStatus(item, "INACTIVE")}>
                      Tạm khóa
                    </button>
                  )}
                  <button className="card-btn-action btn-danger" onClick={() => removeEmployee(item)}>
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length && (
            <div className="admin-empty" style={{ gridColumn: "1 / -1", padding: "40px", background: "#ffffff", borderRadius: "16px" }}>
              Không tìm thấy nhân viên nào phù hợp bộ lọc.
            </div>
          )}
        </div>
      )}
      </div>

      {/* Employee Detail Modal */}
      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            <h3 className="modal-title">Hồ sơ nhân viên chi tiết</h3>
            
            <div className="modal-body">
              <div className="detail-header">
                <img
                  src={avatar(selected.ImageUrl || selected.AvatarUrl)}
                  alt={selected.FullName}
                />
                <div className="detail-header-info">
                  <h2>{selected.FullName}</h2>
                  <p>{selected.Email}</p>
                  <span className={`status-badge status-badge-${String(selected.Status).toLowerCase()}`}>
                    {selected.Status}
                  </span>
                </div>
              </div>

              <div className="detail-tabs">
                <button
                  className={`detail-tab-btn ${activeDetailTab === "general" ? "active" : ""}`}
                  onClick={() => setActiveDetailTab("general")}
                >
                  Thông tin hành chính
                </button>
                <button
                  className={`detail-tab-btn ${activeDetailTab === "bio" ? "active" : ""}`}
                  onClick={() => setActiveDetailTab("bio")}
                >
                  Tiểu sử & Chuyên môn
                </button>
              </div>

              {activeDetailTab === "general" ? (
                <div className="detail-grid">
                  <p><strong>Số điện thoại:</strong> {selected.Phone || "Chưa có"}</p>
                  <p><strong>Vai trò:</strong> {selected.RoleName}</p>
                  <p><strong>Chi nhánh làm việc:</strong> {selected.BranchName || "Chưa gán"}</p>
                  <p><strong>Địa chỉ chi nhánh:</strong> {selected.BranchAddress || "Chưa có"}</p>
                  <p><strong>Vị trí:</strong> {selected.Position || "Chưa có"}</p>
                  <p><strong>Mức lương cơ bản:</strong> {money(selected.Salary)}</p>
                  <p><strong>Ngày gia nhập:</strong> {dateText(selected.HireDate)}</p>
                  <p><strong>Kinh nghiệm:</strong> {selected.YearsOfExperience || 0} năm</p>
                  <p><strong>Tổng lịch hẹn:</strong> {selected.TotalAppointments || 0} ca</p>
                  <p><strong>Hoàn thành:</strong> {selected.CompletedAppointments || 0} ca</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <p><strong>Chuyên môn:</strong> {selected.Specialization || "Chưa cấu hình"}</p>
                    <p><strong>Đánh giá TB:</strong> ⭐ {Number(selected.AvgRating || 0).toFixed(1)} / 5 ({selected.ReviewCount || 0} lượt đánh giá)</p>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <strong style={{ display: "block", color: "#475569", marginBottom: "6px", fontSize: "14px" }}>Giới thiệu tóm tắt</strong>
                    <p style={{ margin: 0, padding: 0, background: "transparent", border: "none", fontSize: "13.5px", lineHeight: "1.6", color: "#334155" }}>
                      {selected.Bio || "Không có giới thiệu nào về nhân viên."}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="card-btn-action btn-secondary" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Create / Edit Form Modal */}
      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "650px" }}
          >
            <button type="button" className="admin-modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="modal-title">{editingId ? "Cập nhật hồ sơ nhân sự" : "Thêm nhân viên mới"}</h3>

            <div className="modal-body">
              <div className="admin-form-grid">
                <label className="form-label">
                  Họ và tên *
                  <input
                    className="form-input"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label">
                  Email liên hệ *
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>

                <label className="form-label">
                  Số điện thoại
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>

                <label className="form-label">
                  Vai trò hệ thống *
                  <select
                    className="form-select"
                    style={{ padding: "10px 12px" }}
                    value={form.roleId}
                    onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                    required
                  >
                    <option value="">Chọn vai trò</option>
                    {roles.map((r) => (
                      <option key={r.RoleId} value={r.RoleId}>
                        {r.RoleName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-label">
                  Trạng thái tài khoản
                  <select
                    className="form-select"
                    style={{ padding: "10px 12px" }}
                    value={form.userStatus}
                    onChange={(e) => setForm({ ...form, userStatus: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                    <option value="INACTIVE">INACTIVE (Tạm dừng)</option>
                    <option value="BANNED">BANNED (Khóa)</option>
                  </select>
                </label>

                <label className="form-label">
                  Trạng thái nhân viên
                  <select
                    className="form-select"
                    style={{ padding: "10px 12px" }}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BANNED">BANNED</option>
                  </select>
                </label>

                <label className="form-label">
                  Chi nhánh trực thuộc
                  <select
                    className="form-select"
                    style={{ padding: "10px 12px" }}
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">Chưa chọn chi nhánh</option>
                    {branches.map((b) => (
                      <option key={b.BranchId} value={b.BranchId}>
                        {b.BranchName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-label">
                  Vị trí công tác
                  <input
                    className="form-input"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="Technician / Receptionist / Manager..."
                  />
                </label>

                <label className="form-label">
                  Lĩnh vực chuyên môn
                  <input
                    className="form-input"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    placeholder="Massage, Skincare, Haircare..."
                  />
                </label>

                <label className="form-label">
                  Mức lương cơ bản
                  <input
                    className="form-input"
                    type="number"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                    placeholder="Ví dụ: 8000000"
                  />
                </label>

                <label className="form-label">
                  Ngày ký hợp đồng
                  <input
                    className="form-input"
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  />
                </label>

                <label className="form-label">
                  Số năm kinh nghiệm
                  <input
                    className="form-input"
                    type="number"
                    value={form.yearsOfExperience}
                    onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })}
                  />
                </label>

                <label className="form-label form-wide">
                  Hình ảnh / Avatar nhân viên *
                  <div
                    style={{
                      border: '2px dashed #ebdcc5',
                      borderRadius: '16px',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#faf8f5',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    onClick={() => document.getElementById('emp-image-input')?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#d6b57e'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = '#ebdcc5'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#ebdcc5';
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  >
                    {(imagePreview || form.imageUrl || form.avatarUrl) ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={imagePreview || resolveFileUrl(form.imageUrl || form.avatarUrl)}
                          alt="Preview"
                          style={{
                            maxHeight: '120px',
                            maxWidth: '100%',
                            borderRadius: '10px',
                            objectFit: 'cover',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageFile(null);
                            setImagePreview('');
                            setForm({ ...form, imageUrl: '', avatarUrl: '' });
                          }}
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#d83b01',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          }}
                        >
                          ×
                        </button>
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#8c7e74' }}>
                          {imageFile ? imageFile.name : 'Nhấn để đổi ảnh mới'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '32px', display: 'block', marginBottom: '4px' }}>👤</span>
                        <p style={{ margin: 0, fontSize: '13px', color: '#5c4a3c', fontWeight: 600 }}>
                          Kéo thả ảnh hoặc nhấn để chọn ảnh nhân viên
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#8c7e74' }}>
                          JPG, PNG, WEBP • Tối đa 5MB
                        </p>
                      </div>
                    )}
                    <input
                      id="emp-image-input"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>
                </label>

                {!editingId && (
                  <label className="form-label">
                    Mật khẩu khởi tạo tài khoản *
                    <input
                      className="form-input"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </label>
                )}

                <label className="form-label form-wide">
                  Tóm tắt tiểu sử bản thân
                  <textarea
                    className="form-input"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    placeholder="Giới thiệu kỹ năng mềm, các chứng chỉ spa đạt được..."
                  />
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="card-btn-action btn-secondary" onClick={() => setShowModal(false)}>
                Hủy bỏ
              </button>
              <button className="card-btn-action btn-primary" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Service Assignments Modal */}
      {assigningEmployee ? (
        <div className="modal-backdrop" onClick={() => setAssigningEmployee(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="admin-modal-close" onClick={() => setAssigningEmployee(null)}>×</button>
            <h3 className="modal-title">Phân bổ dịch vụ trị liệu phụ trách</h3>

            <div className="modal-body">
              <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", background: "#f8fafc", padding: "14px", borderRadius: "10px" }}>
                <img
                  src={avatar(assigningEmployee.ImageUrl || assigningEmployee.AvatarUrl)}
                  alt={assigningEmployee.FullName}
                  style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #d6b57e" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "15px", color: "#1e293b" }}>{assigningEmployee.FullName}</strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Chọn các dịch vụ spa mà nhân viên kỹ thuật này phụ trách phục vụ</span>
                </div>
              </div>

              {loadingServices ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  Đang tải danh sách dịch vụ của Spa...
                </div>
              ) : (
                <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "4px" }}>
                  {Object.keys(groupedServices).map((catName) => (
                    <div className="category-group-box" key={catName}>
                      <div className="category-group-header">{catName}</div>
                      <div className="services-checkbox-grid">
                        {groupedServices[catName].map((srv) => (
                          <label className="service-checkbox-label" key={srv.ServiceId}>
                            <input
                              type="checkbox"
                              style={{ width: "16px", height: "16px", accentColor: "#a0573a", cursor: "pointer" }}
                              checked={selectedServices.includes(srv.ServiceId)}
                              onChange={() => handleCheckboxChange(srv.ServiceId)}
                            />
                            <span>{srv.ServiceName}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {allServices.length === 0 && (
                    <div style={{ textStyle: "center", padding: "20px", color: "#94a3b8" }}>
                      Không tìm thấy dịch vụ hoạt động nào trong hệ thống
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="card-btn-action btn-secondary"
                disabled={savingServices}
                onClick={() => setAssigningEmployee(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="card-btn-action btn-primary"
                disabled={savingServices}
                onClick={saveServices}
              >
                {savingServices ? "Đang lưu..." : "Lưu phân bổ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
