import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const emptyForm = {
  FullName: "",
  Email: "",
  Phone: "",
  Password: "",
  RoleId: "",
  AvatarUrl: "",
  Status: "ACTIVE",
  IsVerified: true,
  // Customer properties
  Gender: "Khác",
  DateOfBirth: "",
  Address: "",
  LoyaltyPoints: 0,
  MembershipLevelId: "",
  // Employee properties
  BranchId: "",
  Position: "",
  Specialization: "",
  Salary: "",
  HireDate: "",
  YearsOfExperience: 0,
  Bio: "",
};

function renderAvatar(item, size = 42) {
  const url = item?.AvatarUrl ? resolveFileUrl(item.AvatarUrl) : "";
  if (url) {
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <img
          src={url}
          alt={item?.FullName || "User"}
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

  // Generate color gradient from name char code to look premium and consistent
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

function InfoRow({ label, value, valueColor = "#3f2817" }) {
  return (
    <div className="luxury-info-row">
      <span>{label}</span>
      <strong style={{ color: valueColor }}>{value}</strong>
    </div>
  );
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
}

function dateTimeText(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleString("vi-VN");
}

function statusClass(value) {
  return `admin-category-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [membershipLevels, setMembershipLevels] = useState([]);

  const [filters, setFilters] = useState({
    keyword: "",
    roleId: "",
    status: "",
    isVerified: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
      const element = document.getElementById(`user-card-${id}`);
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

      const [userRes, roleRes, branchRes, mlRes] = await Promise.all([
        axiosClient.get("/admin/users", {
          params: {
            keyword: filters.keyword || undefined,
            roleId: filters.roleId || undefined,
            status: filters.status || undefined,
            isVerified: filters.isVerified || undefined,
          },
        }),
        axiosClient.get("/admin/users/roles"),
        axiosClient.get("/admin/employees/branches"),
        axiosClient.get("/admin/customers/memberships"),
      ]);

      setItems(userRes.data.data || userRes.data || []);
      setRoles(roleRes.data.data || roleRes.data || []);
      setBranches(branchRes.data.data || branchRes.data || []);
      setMembershipLevels(mlRes.data.data || mlRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách người dùng",
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
  }, [filters.roleId, filters.status, filters.isVerified]);

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
    const wasEmpty = filters.roleId === "" && filters.status === "" && filters.isVerified === "";
    setFilters({
      keyword: "",
      roleId: "",
      status: "",
      isVerified: "",
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
      banned: items.filter((x) => x.Status === "BANNED").length,
      verified: items.filter((x) => x.IsVerified).length,
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
    setError("");
    setSuccessMsg("");
  }

  function openEdit(item) {
    setError("");
    setSuccessMsg("");
    setEditingId(item.UserId);
    setForm({
      FullName: item.FullName || "",
      Email: item.Email || "",
      Phone: item.Phone || "",
      RoleId: String(item.RoleId || ""),
      AvatarUrl: item.AvatarUrl || "",
      Status: item.Status || "ACTIVE",
      IsVerified: !!item.IsVerified,
      Password: "",
      // Customer
      Gender: item.Gender || "Khác",
      DateOfBirth: item.DateOfBirth ? item.DateOfBirth.slice(0, 10) : "",
      Address: item.Address || "",
      LoyaltyPoints: item.LoyaltyPoints || 0,
      MembershipLevelId: item.MembershipLevelId ? String(item.MembershipLevelId) : "",
      // Employee
      BranchId: item.BranchId ? String(item.BranchId) : "",
      Position: item.Position || "",
      Specialization: item.Specialization || "",
      Salary: item.Salary ?? "",
      HireDate: item.HireDate ? item.HireDate.slice(0, 10) : "",
      YearsOfExperience: item.YearsOfExperience || 0,
      Bio: item.Bio || "",
    });
    setShowModal(true);
  }

  function validate() {
    if (!form.FullName.trim()) throw new Error("Vui lòng nhập họ tên");
    if (!form.Email.trim()) throw new Error("Vui lòng nhập email");
    if (!form.RoleId) throw new Error("Vui lòng chọn vai trò");
    if (!editingId && !form.Password.trim()) {
      throw new Error("Vui lòng nhập mật khẩu khởi tạo");
    }
    if (!editingId && form.Password.length < 6) {
      throw new Error("Mật khẩu phải từ 6 ký tự trở lên");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");
      setSuccessMsg("");

      const selectedRole = roles.find((r) => String(r.RoleId) === String(form.RoleId));
      const roleName = selectedRole?.RoleName;

      const payload = {
        FullName: form.FullName.trim(),
        Email: form.Email.trim(),
        Phone: form.Phone.trim() || null,
        RoleId: Number(form.RoleId),
        AvatarUrl: form.AvatarUrl.trim() || null,
        Status: form.Status,
        IsVerified: form.IsVerified ? 1 : 0,
      };

      if (!editingId) {
        payload.Password = form.Password;
      }

      if (roleName === "CUSTOMER") {
        payload.Gender = form.Gender;
        payload.DateOfBirth = form.DateOfBirth || null;
        payload.Address = form.Address.trim() || null;
        payload.LoyaltyPoints = Number(form.LoyaltyPoints || 0);
        payload.MembershipLevelId = form.MembershipLevelId ? Number(form.MembershipLevelId) : null;
      } else {
        payload.BranchId = form.BranchId ? Number(form.BranchId) : null;
        payload.Position = form.Position.trim() || null;
        payload.Specialization = form.Specialization.trim() || null;
        payload.Salary = form.Salary !== "" ? Number(form.Salary) : null;
        payload.HireDate = form.HireDate || null;
        payload.YearsOfExperience = Number(form.YearsOfExperience || 0);
        payload.Bio = form.Bio.trim() || null;
      }

      let uId = editingId;

      if (editingId) {
        const res = await axiosClient.put(`/admin/users/${editingId}`, payload);
        const updated = res.data.data || res.data;
        uId = updated?.UserId || editingId;
      } else {
        const res = await axiosClient.post("/admin/users", payload);
        const created = res.data.data || res.data;
        uId = created?.UserId || created?.id;
      }

      setShowModal(false);
      await load();
      if (uId) {
        scrollToItem(uId);
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu tài khoản thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    try {
      setError("");
      setSuccessMsg("");
      const next = item.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await axiosClient.patch(`/admin/users/${item.UserId}/status`, { status: next });
      await load();
      scrollToItem(item.UserId);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Đổi trạng thái thất bại",
      );
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu mới phải từ 6 ký tự");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.patch(`/admin/users/${passwordModal.UserId}/password`, {
        password: newPassword,
      });

      setSuccessMsg(`Đặt lại mật khẩu thành công cho ${passwordModal.Email}`);
      setPasswordModal(null);
      setNewPassword("");
      scrollToItem(passwordModal.UserId);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Đặt lại mật khẩu thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  const currentRoleName = useMemo(() => {
    const r = roles.find((x) => String(x.RoleId) === String(form.RoleId));
    return r ? r.RoleName : "";
  }, [roles, form.RoleId]);

  const selectedRoleObject = useMemo(() => {
    const selectedRole = roles.find((r) => String(r.RoleId) === String(form.RoleId));
    return selectedRole;
  }, [roles, form.RoleId]);

  return (
    <section className="admin-page admin-users-page">
      <style>{`
        .admin-users-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-users-hero {
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

        .admin-users-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-users-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-users-hero p {
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
          grid-template-columns: 2fr 1fr 1fr 1fr auto auto;
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

        .admin-user-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        .admin-user-card {
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid #eaddca;
          box-shadow: 0 8px 24px rgba(31, 20, 14, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .admin-user-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 36px rgba(48, 30, 15, 0.07);
          border-color: #d6b57e;
        }

        /* VIP background highlight decorations */
        .admin-user-card.customer-vip-gold::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
          background: linear-gradient(180deg, #d6b57e, #f0dfbf);
        }

        .admin-user-card.employee-staff::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
          background: linear-gradient(180deg, #4b3525, #84603c);
        }

        .admin-user-card-header {
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: center;
          border-bottom: 1px dashed rgba(214, 181, 126, 0.25);
        }

        .admin-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .admin-user-info h4 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1f140e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-user-info span {
          font-size: 13px;
          color: #8c7e74;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .admin-role-badge {
          align-self: flex-start;
          padding: 3px 10px;
          border-radius: 50px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-top: 4px;
          display: inline-block;
        }

        .role-customer {
          background: #fdf5e6;
          color: #b8860b;
          border: 1px solid rgba(184, 134, 11, 0.25);
        }

        .role-staff {
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid rgba(79, 70, 229, 0.25);
        }

        .admin-user-card-body {
          padding: 20px 24px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .luxury-info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13.5px;
          border-bottom: 1px solid #fcfaf7;
          padding-bottom: 8px;
        }

        .luxury-info-row span {
          color: #8c7e74;
          font-weight: 500;
        }

        .luxury-info-row strong {
          color: #1f140e;
          font-weight: 700;
        }

        .admin-user-card-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          border-top: 1px solid #ebdcc5;
          padding: 16px 24px;
          background: #fdfbf9;
        }

        .card-btn {
          flex: 1;
          min-width: 60px;
          border: 1px solid #ebdcc5;
          border-radius: 12px;
          padding: 8px;
          font-size: 12.5px;
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

        /* Detail Modal layout */
        .admin-profile-header {
          padding: 24px 32px;
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 20px;
          border-bottom: 3px solid #d6b57e;
        }

        .admin-profile-header h3 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-profile-body {
          padding: 32px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          overflow-y: auto;
          max-height: calc(85vh - 160px);
        }

        @media (max-width: 768px) {
          .admin-profile-body {
            grid-template-columns: 1fr;
          }
        }

        .admin-profile-section {
          background: #faf8f5;
          padding: 24px;
          border-radius: 20px;
          border: 1px solid #ebdcc5;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .admin-profile-section h4 {
          margin: 0 0 10px 0;
          font-size: 16px;
          font-weight: 700;
          color: #3f2817;
          border-bottom: 2px solid #ecd8b8;
          padding-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Live Preview split editor */
        .admin-modal-body.user-editor {
          padding: 28px;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 28px;
          overflow-y: auto;
          max-height: calc(85vh - 140px);
        }

        @media (max-width: 768px) {
          .admin-modal-body.user-editor {
            grid-template-columns: 1fr;
          }
        }

        .admin-editor-preview-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          border-left: 1px solid rgba(214, 181, 126, 0.25);
          padding-left: 28px;
        }

        @media (max-width: 768px) {
          .admin-editor-preview-column {
            border-left: 0;
            padding-left: 0;
            border-top: 1px solid rgba(214, 181, 126, 0.25);
            padding-top: 24px;
          }
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

        .admin-status-banned {
          background: #333333;
          color: #ffffff;
          border: 1px solid #000000;
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
      `}</style>

      {/* Hero Header */}
      <div className="admin-users-hero">
        <div>
          <div className="admin-eyebrow">User Accounts</div>
          <h1>Quản lý Tài khoản & Phân quyền</h1>
          <p>
            Quản trị và thiết lập thông tin đăng nhập, phân vai trò Khách hàng, Nhân viên, Kỹ thuật viên Spa cùng các cơ chế bảo mật hệ thống.
          </p>
        </div>
        <button className="admin-refresh-btn" onClick={openCreate}>
          <span>+ Thêm thành viên</span>
        </button>
      </div>

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Tổng tài khoản</p>
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
          <div className="admin-stat-icon">🚫</div>
          <div>
            <p>Tài khoản bị cấm</p>
            <h3>{stats.banned}</h3>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đã xác minh</p>
            <h3>{stats.verified}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-panel">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm theo họ tên, email, sđt..."
        />
        <select
          value={filters.roleId}
          onChange={(e) => setFilters({ ...filters, roleId: e.target.value })}
        >
          <option value="">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.RoleId} value={r.RoleId}>
              {r.RoleName}
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
          <option value="BANNED">BANNED</option>
        </select>
        <select
          value={filters.isVerified}
          onChange={(e) => setFilters({ ...filters, isVerified: e.target.value })}
        >
          <option value="">Trạng thái xác minh</option>
          <option value="1">Đã xác minh</option>
          <option value="0">Chưa xác minh</option>
        </select>
        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          <span>Lọc</span>
        </button>
        <button className="admin-clear-btn" onClick={handleClearFilters}>
          Xóa
        </button>
      </div>

      {/* Success/Error Alerts */}
      {error && <div className="admin-error-card" style={{ marginBottom: 20 }}>{error}</div>}
      {successMsg && (
        <div className="admin-loading-card" style={{ marginBottom: 20, color: "#107c41", borderColor: "rgba(16, 124, 65, 0.2)", background: "#e8f7ec" }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách tài khoản spa...</div>
      ) : (
        <div ref={gridRef} className="admin-user-grid">
          {items.map((item) => {
            const isCustomer = item.RoleName === "CUSTOMER";
            const cardClass = `admin-user-card ${isCustomer ? "customer-vip-gold" : "employee-staff"}`;

            return (
              <div key={item.UserId} id={`user-card-${item.UserId}`} className={cardClass}>
                <div className="admin-user-card-header">
                  {renderAvatar(item, 56)}
                  <div className="admin-user-info">
                    <h4>{item.FullName}</h4>
                    <span>{item.Email}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`admin-role-badge ${isCustomer ? "role-customer" : "role-staff"}`}>
                        {item.RoleName}
                      </span>
                      <span className={statusClass(item.Status)}>
                        {item.Status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="admin-user-card-body">
                  {isCustomer ? (
                    <>
                      <InfoRow label="Hạng thành viên" value={item.MembershipLevelName || "Standard"} valueColor="#b8860b" />
                      <InfoRow label="Điểm tích lũy" value={`${item.LoyaltyPoints || 0} điểm`} />
                      <InfoRow label="Tổng chi tiêu" value={money(item.TotalPaid)} valueColor="#107c41" />
                      <InfoRow label="Lịch hẹn tham gia" value={`${item.AppointmentCount || 0} cuộc`} />
                    </>
                  ) : (
                    <>
                      <InfoRow label="Chức vụ" value={item.Position || "Nhân viên Spa"} />
                      <InfoRow label="Chi nhánh" value={item.BranchName || "Chưa phân công"} />
                      <InfoRow label="Kinh nghiệm" value={`${item.YearsOfExperience || 0} năm`} />
                      <InfoRow label="Lịch hẹn trị liệu" value={`${item.AppointmentCount || 0} ca`} />
                    </>
                  )}
                </div>

                <div className="admin-user-card-footer">
                  <button className="card-btn primary" onClick={() => setSelected(item)}>
                    Hồ sơ
                  </button>
                  <button className="card-btn" onClick={() => openEdit(item)}>
                    Sửa
                  </button>
                  <button className="card-btn" onClick={() => setPasswordModal(item)}>
                    Pass 🔑
                  </button>
                  <button className="card-btn danger" onClick={() => toggleStatus(item)}>
                    Khóa/Mở
                  </button>
                </div>
              </div>
            );
          })}

          {!items.length ? (
            <div className="admin-empty" style={{ gridColumn: "1/-1" }}>
              Không tìm thấy tài khoản người dùng nào phù hợp bộ lọc.
            </div>
          ) : null}
        </div>
      )}

      {/* DETAIL MODAL (React Portal) */}
      {selected && createPortal(
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-modal-wrapper admin-user-detail-modal" style={{ maxWidth: 750 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-profile-header">
              {renderAvatar(selected, 64)}
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#d6b57e", fontWeight: "700" }}>
                  Chi tiết tài khoản #{selected.UserId}
                </span>
                <h3>{selected.FullName}</h3>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: "13.5px", opacity: 0.85 }}>{selected.Email}</span>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#d6b57e" }}></span>
                  <span className={`admin-role-badge ${selected.RoleName === "CUSTOMER" ? "role-customer" : "role-staff"}`}>
                    {selected.RoleName}
                  </span>
                  <span className={statusClass(selected.Status)}>
                    {selected.Status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelected(null)}
                style={{ position: "absolute", top: 20, right: 20, color: "#fff" }}
              >
                &times;
              </button>
            </div>

            <div className="admin-profile-body">
              <div className="admin-profile-section">
                <h4>👤 Thông tin tài khoản</h4>
                <InfoRow label="Số điện thoại" value={selected.Phone || "Chưa cập nhật"} />
                <InfoRow
                  label="Xác minh email"
                  value={selected.IsVerified ? "Đã xác minh ✓" : "Chưa xác minh ✖"}
                  valueColor={selected.IsVerified ? "#107c41" : "#a80000"}
                />
                <InfoRow label="Đăng nhập Google" value={selected.GoogleId ? "Có" : "Không"} />
                <InfoRow label="Ngày tạo tài khoản" value={dateText(selected.CreatedAt)} />
                <InfoRow label="Lần cập nhật cuối" value={dateTimeText(selected.UpdatedAt)} />
              </div>

              <div className="admin-profile-section">
                {selected.RoleName === "CUSTOMER" ? (
                  <>
                    <h4>💎 Chi tiết khách hàng</h4>
                    <InfoRow label="Mã khách hàng" value={`#${selected.CustomerId}`} />
                    <InfoRow label="Hạng thành viên" value={selected.MembershipLevelName || "Standard"} valueColor="#b8860b" />
                    <InfoRow label="Điểm tích lũy" value={`${selected.LoyaltyPoints || 0} điểm`} />
                    <InfoRow label="Tổng tiền đã trả" value={money(selected.TotalPaid)} valueColor="#107c41" />
                    <InfoRow label="Giới tính" value={selected.Gender || "Khác"} />
                    <InfoRow label="Ngày sinh nhật" value={dateText(selected.DateOfBirth)} />
                    <div style={{ fontSize: "13px", color: "#8c7e74", borderTop: "1px solid #ebdcc5", paddingTop: 10, marginTop: 4 }}>
                      <strong>Địa chỉ:</strong> {selected.Address || "Chưa thiết lập"}
                    </div>
                  </>
                ) : (
                  <>
                    <h4>💼 Chi tiết nhân viên</h4>
                    <InfoRow label="Mã nhân viên" value={`#${selected.EmployeeId}`} />
                    <InfoRow label="Vị trí đảm nhiệm" value={selected.Position || "Nhân viên"} />
                    <InfoRow label="Chi nhánh phân công" value={selected.BranchName || "Chưa phân công"} />
                    <InfoRow label="Kinh nghiệm thực tế" value={`${selected.YearsOfExperience || 0} năm`} />
                    <InfoRow label="Mức lương cơ bản" value={selected.Salary ? money(selected.Salary) : "Chưa thiết lập"} valueColor="#107c41" />
                    <InfoRow label="Chuyên môn" value={selected.Specialization || "Chưa cập nhật"} />
                    <InfoRow label="Ngày gia nhập spa" value={dateText(selected.HireDate)} />
                    <div style={{ fontSize: "13px", color: "#8c7e74", borderTop: "1px solid #ebdcc5", paddingTop: 10, marginTop: 4 }}>
                      <strong>Bio giới thiệu:</strong>
                      <p style={{ margin: "4px 0 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                        {selected.Bio || "Không có bio mô tả."}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: "16px 32px", background: "#faf8f5", borderTop: "1px solid #ebdcc5", display: "flex", justifyContent: "flex-end" }}>
              <button className="card-btn primary" style={{ maxWidth: 120 }} onClick={() => setSelected(null)}>
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE/EDIT MODAL (React Portal) */}
      {showModal && createPortal(
        <div className="admin-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
              <div>
                <span style={{ color: "#d6b57e", textTransform: "uppercase", fontSize: "11px", fontWeight: "700", letterSpacing: "1px" }}>
                  {editingId ? "Cấu hình tài khoản" : "Tài khoản mới"}
                </span>
                <h3 style={{ color: "#ffffff", marginTop: 4 }}>{editingId ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"}</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowModal(false)} style={{ color: "#fff" }}>
                &times;
              </button>
            </div>

            <div className="admin-modal-body user-editor">
              <form className="admin-modal-form" onSubmit={submit}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ background: "#3f2817", color: "#f2d9a6", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "800", fontSize: "12px" }}>
                    1
                  </span>
                  <h4 style={{ margin: 0, fontWeight: "800", color: "#3f2817", fontSize: "14.5px" }}>Thông tin tài khoản chung</h4>
                </div>

                <label>
                  Họ và tên *
                  <input
                    value={form.FullName}
                    onChange={(e) => setForm({ ...form, FullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </label>
                <label>
                  Email đăng nhập *
                  <input
                    type="email"
                    value={form.Email}
                    onChange={(e) => setForm({ ...form, Email: e.target.value })}
                    placeholder="nguyenvana@gmail.com"
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={form.Phone}
                    onChange={(e) => setForm({ ...form, Phone: e.target.value })}
                    placeholder="0912345678"
                  />
                </label>
                <label>
                  Vai trò tài khoản *
                  <select
                    value={form.RoleId}
                    onChange={(e) => setForm({ ...form, RoleId: e.target.value })}
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
                <label>
                  Trạng thái
                  <select
                    value={form.Status}
                    onChange={(e) => setForm({ ...form, Status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BANNED">BANNED</option>
                  </select>
                </label>
                <label>
                  Xác minh Email
                  <select
                    value={form.IsVerified ? "1" : "0"}
                    onChange={(e) => setForm({ ...form, IsVerified: e.target.value === "1" })}
                  >
                    <option value="1">Đã xác minh</option>
                    <option value="0">Chưa xác minh</option>
                  </select>
                </label>
                {!editingId ? (
                  <label>
                    Mật khẩu khởi tạo *
                    <input
                      type="password"
                      value={form.Password}
                      onChange={(e) => setForm({ ...form, Password: e.target.value })}
                      placeholder="Mật khẩu từ 6 ký tự trở lên"
                      required
                    />
                  </label>
                ) : null}
                <label>
                  Đường dẫn avatar
                  <input
                    value={form.AvatarUrl}
                    onChange={(e) => setForm({ ...form, AvatarUrl: e.target.value })}
                    placeholder="/uploads/avatars/user-1.png"
                  />
                </label>

                {/* Sub-form fields */}
                {currentRoleName === "CUSTOMER" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12, borderTop: "2px solid #ecd8b8", paddingTop: 18 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ background: "#3f2817", color: "#f2d9a6", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "800", fontSize: "12px" }}>
                        2
                      </span>
                      <h4 style={{ margin: 0, fontWeight: "800", color: "#3f2817", fontSize: "14.5px" }}>Chi tiết thông tin khách hàng</h4>
                    </div>
                    <label>
                      Giới tính
                      <select value={form.Gender} onChange={(e) => setForm({ ...form, Gender: e.target.value })}>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </label>
                    <label>
                      Ngày sinh
                      <input
                        type="date"
                        value={form.DateOfBirth}
                        onChange={(e) => setForm({ ...form, DateOfBirth: e.target.value })}
                      />
                    </label>
                    <label>
                      Địa chỉ liên hệ
                      <input
                        value={form.Address}
                        onChange={(e) => setForm({ ...form, Address: e.target.value })}
                        placeholder="Số 12, Đường số 5, Q.7, TP.HCM"
                      />
                    </label>
                    <label>
                      Điểm tích lũy loyalty
                      <input
                        type="number"
                        min="0"
                        value={form.LoyaltyPoints}
                        onChange={(e) => setForm({ ...form, LoyaltyPoints: e.target.value })}
                      />
                    </label>
                    <label>
                      Hạng thành viên
                      <select
                        value={form.MembershipLevelId}
                        onChange={(e) => setForm({ ...form, MembershipLevelId: e.target.value })}
                      >
                        <option value="">Mặc định hệ thống</option>
                        {membershipLevels.map((ml) => (
                          <option key={ml.MembershipLevelId} value={ml.MembershipLevelId}>
                            {ml.LevelName} (từ {ml.MinPoints}đ)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : currentRoleName !== "" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12, borderTop: "2px solid #ecd8b8", paddingTop: 18 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ background: "#3f2817", color: "#f2d9a6", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "800", fontSize: "12px" }}>
                        2
                      </span>
                      <h4 style={{ margin: 0, fontWeight: "800", color: "#3f2817", fontSize: "14.5px" }}>Chi tiết thông tin nhân sự</h4>
                    </div>
                    <label>
                      Chi nhánh làm việc
                      <select
                        value={form.BranchId}
                        onChange={(e) => setForm({ ...form, BranchId: e.target.value })}
                      >
                        <option value="">Chọn chi nhánh</option>
                        {branches.map((b) => (
                          <option key={b.BranchId} value={b.BranchId}>
                            {b.BranchName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Chức danh công việc
                      <input
                        value={form.Position}
                        onChange={(e) => setForm({ ...form, Position: e.target.value })}
                        placeholder="Kỹ thuật viên chăm sóc da"
                      />
                    </label>
                    <label>
                      Lĩnh vực chuyên môn
                      <input
                        value={form.Specialization}
                        onChange={(e) => setForm({ ...form, Specialization: e.target.value })}
                        placeholder="Trị mụn chuyên sâu, Massage đá nóng"
                      />
                    </label>
                    <label>
                      Mức lương cơ bản (VND)
                      <input
                        type="number"
                        min="0"
                        value={form.Salary}
                        onChange={(e) => setForm({ ...form, Salary: e.target.value })}
                        placeholder="8000000"
                      />
                    </label>
                    <label>
                      Ngày vào làm việc
                      <input
                        type="date"
                        value={form.HireDate}
                        onChange={(e) => setForm({ ...form, HireDate: e.target.value })}
                      />
                    </label>
                    <label>
                      Số năm kinh nghiệm
                      <input
                        type="number"
                        min="0"
                        value={form.YearsOfExperience}
                        onChange={(e) => setForm({ ...form, YearsOfExperience: e.target.value })}
                      />
                    </label>
                    <label>
                      Bio giới thiệu bản thân
                      <textarea
                        rows={3}
                        value={form.Bio}
                        onChange={(e) => setForm({ ...form, Bio: e.target.value })}
                        placeholder="Mô tả kỹ năng, thái độ phục vụ khách hàng..."
                      />
                    </label>
                  </div>
                ) : null}
              </form>

              {/* Real-time Profile Live Preview */}
              <div className="admin-editor-preview-column">
                <span className="admin-preview-title">Xem trước hồ sơ thẻ</span>
                <div
                  className={`admin-category-card admin-user-card ${
                    currentRoleName === "CUSTOMER" ? "customer-vip-gold" : "employee-staff"
                  }`}
                  style={{ width: "100%", maxWidth: 300, minHeight: 320, transform: "none", boxShadow: "none" }}
                >
                  <div className="admin-user-card-header">
                    {renderAvatar(form, 52)}
                    <div className="admin-user-info">
                      <h4>{form.FullName || "Tên hiển thị"}</h4>
                      <span>{form.Email || "email@example.com"}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          className={`admin-role-badge ${
                            currentRoleName === "CUSTOMER" ? "role-customer" : "role-staff"
                          }`}
                        >
                          {selectedRoleObject?.RoleName || "CHƯA CHỌN"}
                        </span>
                        <span className={statusClass(form.Status)}>
                          {form.Status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-user-card-body">
                    {currentRoleName === "CUSTOMER" ? (
                      <>
                        <InfoRow
                          label="Hạng thành viên"
                          value={
                            membershipLevels.find((ml) => String(ml.MembershipLevelId) === String(form.MembershipLevelId))
                              ?.LevelName || "Standard"
                          }
                          valueColor="#b8860b"
                        />
                        <InfoRow label="Điểm tích lũy" value={`${form.LoyaltyPoints || 0} điểm`} />
                        <InfoRow label="Tổng chi tiêu" value={money(0)} valueColor="#107c41" />
                        <InfoRow label="Lịch hẹn tham gia" value="0 cuộc" />
                      </>
                    ) : (
                      <>
                        <InfoRow label="Chức vụ" value={form.Position || "Nhân viên Spa"} />
                        <InfoRow
                          label="Chi nhánh"
                          value={
                            branches.find((b) => String(b.BranchId) === String(form.BranchId))?.BranchName || "Chưa phân công"
                          }
                        />
                        <InfoRow label="Kinh nghiệm" value={`${form.YearsOfExperience || 0} năm`} />
                        <InfoRow label="Lịch hẹn trị liệu" value="0 ca" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="card-btn" type="button" onClick={() => setShowModal(false)}>
                Hủy
              </button>
              <button className="card-btn primary" type="button" onClick={submit} disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Cập nhật tài khoản" : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RESET PASSWORD MODAL (React Portal) */}
      {passwordModal && createPortal(
        <div className="admin-modal-backdrop" onClick={() => setPasswordModal(null)}>
          <div className="admin-modal-wrapper" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleResetPassword}>
              <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
                <h3>Đặt lại mật khẩu</h3>
                <button type="button" className="admin-modal-close" onClick={() => setPasswordModal(null)} style={{ color: "#fff" }}>
                  &times;
                </button>
              </div>

              <div style={{ padding: "24px 32px" }}>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#8c7e74" }}>
                  Bạn đang đổi mật khẩu cho tài khoản <strong>{passwordModal.Email}</strong>. Nhập mật khẩu mới bên dưới.
                </p>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "13.5px", fontWeight: "700", color: "#5c4a3c" }}>
                  Mật khẩu mới *
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập tối thiểu 6 ký tự..."
                    required
                    style={{ padding: "12px 16px", border: "1px solid #ebdcc5", borderRadius: 12, outline: "none", fontSize: "14px" }}
                  />
                </label>
              </div>

              <div className="admin-modal-footer">
                <button className="card-btn" type="button" onClick={() => setPasswordModal(null)}>
                  Hủy
                </button>
                <button className="card-btn primary" type="submit" disabled={saving}>
                  {saving ? "Đang đặt lại..." : "Xác nhận đặt lại"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
