import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const emptyForm = {
  FullName: "",
  Email: "",
  Phone: "",
  Password: "",
  Gender: "Khác",
  DateOfBirth: "",
  Address: "",
  Status: "ACTIVE",
  IsVerified: true,
  MembershipLevelId: "",
};

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleString("vi-VN");
}

function statusClass(status) {
  return `admin-category-status admin-status-${String(status || "default")
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

export default function AdminCustomers() {
  const [items, setItems] = useState([]);
  const [membershipLevels, setMembershipLevels] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    membershipLevelId: "",
    gender: "",
    status: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [selected, setSelected] = useState(null); // Detailed customer object
  const [activeTab, setActiveTab] = useState("profile"); // Tab: profile, appointments, packages, history

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // UserId of the editing customer
  const [form, setForm] = useState(emptyForm);

  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsForm, setPointsForm] = useState({
    points: 100,
    note: "",
    isEarn: true,
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const [showChurnModal, setShowChurnModal] = useState(false);
  const [churnData, setChurnData] = useState(null);
  const [loadingChurn, setLoadingChurn] = useState(false);
  const [churnFilter, setChurnFilter] = useState("");
  const [selectedChurnCust, setSelectedChurnCust] = useState(null);

  const handleOpenChurn = async () => {
    setShowChurnModal(true);
    setLoadingChurn(true);
    setError("");
    try {
      const res = await axiosClient.get("/ai/customers/churn-prediction");
      const fetchedData = res.data.data || res.data || {};
      setChurnData(fetchedData);
      if (fetchedData.customers && fetchedData.customers.length > 0) {
        setSelectedChurnCust(fetchedData.customers[0]);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Không thể tải dự báo rủi ro churn từ AI"
      );
    } finally {
      setLoadingChurn(false);
    }
  };

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
      const element = document.getElementById(`customer-card-${id}`);
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

  // Load Membership levels once on mount
  useEffect(() => {
    async function init() {
      try {
        const res = await axiosClient.get("/admin/customers/memberships");
        setMembershipLevels(res.data.data || res.data || []);
      } catch (err) {
        console.error("Lỗi khi tải danh sách hạng thành viên", err);
      }
    }
    init();
  }, []);

  // Main list fetch
  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await axiosClient.get("/admin/customers", {
        params: {
          keyword: filters.keyword || undefined,
          membershipLevelId: filters.membershipLevelId || undefined,
          gender: filters.gender || undefined,
          status: filters.status || undefined,
        },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách khách hàng",
      );
    } finally {
      setLoading(false);
    }
  }

  // Load on filter apply or mount
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
  }, [filters.membershipLevelId, filters.gender, filters.status]);

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

  const handleResetFilters = () => {
    const wasEmpty = filters.membershipLevelId === "" && filters.gender === "" && filters.status === "";
    setFilters({
      keyword: "",
      membershipLevelId: "",
      gender: "",
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

  // Detailed view fetch
  async function fetchDetails(userId) {
    try {
      setError("");
      const res = await axiosClient.get(`/admin/customers/${userId}`);
      setSelected(res.data.data || res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được chi tiết khách hàng",
      );
    }
  }

  const handleOpenDetail = (userId) => {
    setActiveTab("profile");
    setSelected(null);
    fetchDetails(userId);
  };

  // Create or Update
  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccessMsg("");
    setShowFormModal(true);
  };

  const handleOpenEdit = (customerRow) => {
    setEditingId(customerRow.UserId);
    setForm({
      FullName: customerRow.FullName || "",
      Email: customerRow.Email || "",
      Phone: customerRow.Phone || "",
      Password: "", // Empty for edit
      Gender: customerRow.Gender || "Khác",
      DateOfBirth: customerRow.DateOfBirth ? customerRow.DateOfBirth.slice(0, 10) : "",
      Address: customerRow.Address || "",
      Status: customerRow.Status || "ACTIVE",
      IsVerified: !!customerRow.IsVerified,
      MembershipLevelId: customerRow.MembershipLevelId ? String(customerRow.MembershipLevelId) : "",
    });
    setError("");
    setSuccessMsg("");
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!form.FullName.trim()) return setError("Họ tên không được bỏ trống");
    if (!form.Email.trim()) return setError("Email không được bỏ trống");
    if (!editingId && !form.Password) return setError("Mật khẩu bắt buộc khi tạo tài khoản");

    const payload = {
      FullName: form.FullName.trim(),
      Email: form.Email.trim().toLowerCase(),
      Phone: form.Phone.trim() || null,
      Gender: form.Gender,
      DateOfBirth: form.DateOfBirth || null,
      Address: form.Address.trim() || null,
      Status: form.Status,
      IsVerified: form.IsVerified ? 1 : 0,
      MembershipLevelId: form.MembershipLevelId ? Number(form.MembershipLevelId) : null,
    };

    if (!editingId) {
      payload.Password = form.Password;
    }

    try {
      setSaving(true);
      setError("");

      let uId = editingId;

      if (editingId) {
        const res = await axiosClient.put(`/admin/customers/${editingId}`, payload);
        const updated = res.data.data || res.data;
        uId = updated?.profile?.UserId || editingId;
        setSuccessMsg("Cập nhật thông tin khách hàng thành công!");
      } else {
        const res = await axiosClient.post("/admin/customers", payload);
        const created = res.data.data || res.data;
        uId = created?.profile?.UserId || created?.UserId || created?.id;
        setSuccessMsg("Tạo mới tài khoản khách hàng thành công!");
      }

      setShowFormModal(false);
      await load();
      if (uId) {
        scrollToItem(uId);
      } else {
        scrollToGrid();
      }

      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không lưu được thông tin khách hàng",
      );
    } finally {
      setSaving(false);
    }
  };

  // Adjust loyalty points
  const handleOpenPoints = (customerRow) => {
    setEditingId(customerRow.UserId);
    setPointsForm({
      points: 100,
      note: "",
      isEarn: true,
    });
    setError("");
    setSuccessMsg("");
    setShowPointsModal(true);
  };

  const handlePointsSubmit = async (e) => {
    e.preventDefault();

    const delta = Number(pointsForm.points);
    if (!delta || delta <= 0) return setError("Vui lòng nhập số điểm hợp lệ lớn hơn 0");

    const finalDelta = pointsForm.isEarn ? delta : -delta;

    try {
      setSaving(true);
      setError("");

      await axiosClient.patch(`/admin/customers/${editingId}/points`, {
        Points: finalDelta,
        Note: pointsForm.note.trim() || undefined,
      });

      setSuccessMsg("Điều chỉnh điểm thưởng và cập nhật hạng thành công!");
      setShowPointsModal(false);
      await load();

      if (selected && selected.profile.UserId === editingId) {
        fetchDetails(editingId);
      }

      scrollToItem(editingId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không điều chỉnh được điểm tích lũy",
      );
    } finally {
      setSaving(false);
    }
  };

  // Change Status
  const handleChangeStatus = async (customerRow) => {
    const nextStatus = customerRow.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const ok = window.confirm(
      `Bạn muốn đổi trạng thái tài khoản ${customerRow.Email} thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/customers/${customerRow.UserId}/status`, {
        status: nextStatus,
      });

      setSuccessMsg(`Đã đổi trạng thái tài khoản ${customerRow.FullName} thành ${nextStatus}!`);
      await load();
      scrollToItem(customerRow.UserId);

      if (selected && selected.profile.UserId === customerRow.UserId) {
        fetchDetails(customerRow.UserId);
      }

      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thay đổi được trạng thái tài khoản",
      );
    }
  };

  // Reset Password
  const handleOpenPassword = (customerRow) => {
    setEditingId(customerRow.UserId);
    setNewPassword("");
    setError("");
    setSuccessMsg("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      return setError("Mật khẩu mới phải từ 6 ký tự trở lên");
    }

    try {
      setSaving(true);
      setError("");

      await axiosClient.patch(`/admin/customers/${editingId}/password`, {
        password: newPassword,
      });

      setSuccessMsg("Đặt lại mật khẩu tài khoản khách hàng thành công!");
      setShowPasswordModal(false);
      scrollToItem(editingId);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không đổi được mật khẩu khách hàng",
      );
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      banned: items.filter((x) => x.Status === "BANNED").length,
      points: items.reduce((sum, x) => sum + Number(x.LoyaltyPoints || 0), 0),
    };
  }, [items]);

  const selectedML = useMemo(() => {
    const ml = membershipLevels.find((x) => String(x.MembershipLevelId) === String(form.MembershipLevelId));
    return ml;
  }, [membershipLevels, form.MembershipLevelId]);

  // Premium VIP background styling depending on level selected
  const vipCardBackground = useMemo(() => {
    const name = selectedML?.LevelName || "";
    if (name.toUpperCase().includes("GOLD")) {
      return "linear-gradient(135deg, #d6b57e 0%, #f0dfbf 100%)";
    } else if (name.toUpperCase().includes("DIAMOND")) {
      return "linear-gradient(135deg, #4a4e69 0%, #9a8c98 100%)";
    } else if (name.toUpperCase().includes("SILVER")) {
      return "linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)";
    } else if (name.toUpperCase().includes("BRONZE")) {
      return "linear-gradient(135deg, #a86c3b 0%, #68300b 100%)";
    }
    return "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)";
  }, [selectedML]);

  const vipCardTextColor = useMemo(() => {
    const name = selectedML?.LevelName || "";
    if (name.toUpperCase().includes("GOLD") || name.toUpperCase().includes("DIAMOND") || name.toUpperCase().includes("SILVER")) {
      return "#1f140e";
    }
    return "#ffffff";
  }, [selectedML]);

  return (
    <section className="admin-page admin-customers-page">
      <style>{`
        .admin-customers-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-customers-hero {
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

        .admin-customers-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-customers-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-customers-hero p {
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
          grid-template-columns: repeat(auto-fill, minmax(345px, 1fr));
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

        .admin-user-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
          background: linear-gradient(180deg, #d6b57e, #f0dfbf);
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
          background: #fdf5e6;
          color: #b8860b;
          border: 1px solid rgba(184, 134, 11, 0.25);
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

        /* Detail Modal layout with Tabs */
        .admin-profile-header {
          padding: 24px 32px;
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 20px;
          border-bottom: 3px solid #d6b57e;
          position: relative;
        }

        .admin-profile-header h3 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
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

        .admin-tabs-nav {
          display: flex;
          background: #faf8f5;
          border-bottom: 1px solid #ebdcc5;
          padding: 0 24px;
        }

        .admin-tab-btn {
          padding: 16px 20px;
          background: transparent;
          border: 0;
          font-size: 14px;
          font-weight: 700;
          color: #8c7e74;
          cursor: pointer;
          transition: all 0.3s;
          border-bottom: 3px solid transparent;
          font-family: inherit;
        }

        .admin-tab-btn:hover,
        .admin-tab-btn.active {
          color: #3a2519;
          border-bottom-color: #d6b57e;
        }

        .admin-profile-body {
          padding: 28px;
          overflow-y: auto;
          max-height: calc(85vh - 200px);
        }

        .admin-profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .admin-profile-grid {
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
          gap: 12px;
        }

        .admin-profile-section h4 {
          margin: 0 0 8px 0;
          font-size: 15.5px;
          font-weight: 700;
          color: #3f2817;
          border-bottom: 2px solid #ecd8b8;
          padding-bottom: 6px;
        }

        /* Detail tab tables */
        .luxury-table-wrapper {
          border: 1px solid #ebdcc5;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.01);
          background: #ffffff;
        }

        .luxury-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13.5px;
        }

        .luxury-table th {
          background: #faf8f5;
          padding: 14px 18px;
          font-weight: 700;
          color: #5c4a3c;
          border-bottom: 1px solid #ebdcc5;
        }

        .luxury-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #f9f5f0;
          color: #3a2519;
        }

        .luxury-table tr:last-child td {
          border-bottom: 0;
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
          background: #ffffff;
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

        .admin-preview-title {
          align-self: flex-start;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c7a36c;
        }

        /* VIP Card Preview Design */
        .vip-preview-card {
          width: 100%;
          max-width: 300px;
          height: 185px;
          border-radius: 20px;
          padding: 24px;
          color: #ffffff;
          position: relative;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
        }

        .vip-preview-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, rgba(255,255,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .vip-card-chip {
          width: 42px;
          height: 32px;
          background: linear-gradient(135deg, #ecd6b3 0%, #b89b72 100%);
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.25);
        }

        .category-gold-glow {
          border-color: #d6b57e !important;
          box-shadow: 0 0 25px 6px rgba(214, 181, 126, 0.6) !important;
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
      <div className="admin-customers-hero">
        <div>
          <div className="admin-eyebrow">Customer Members</div>
          <h1>Quản lý Khách hàng & Loyalty</h1>
          <p>
            Theo dõi hồ sơ trị liệu, doanh thu thực tế, lịch sử sử dụng combo của khách hàng cùng hệ thống tự động thăng hạng Loyalty Points.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            className="admin-refresh-btn" 
            style={{ background: "linear-gradient(135deg, #1f140e, #3a2519)", color: "#fff", border: "1px solid #ebdcc5" }}
            onClick={handleOpenChurn}
          >
            <span>🔮 Dự báo Churn (AI)</span>
          </button>
          <button className="admin-refresh-btn" onClick={handleOpenCreate}>
            <span>+ Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Tổng khách hàng</p>
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
          <div className="admin-stat-icon">💎</div>
          <div>
            <p>Tổng điểm loyalty</p>
            <h3>{stats.points}</h3>
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
          value={filters.membershipLevelId}
          onChange={(e) => setFilters({ ...filters, membershipLevelId: e.target.value })}
        >
          <option value="">Tất cả hạng VIP</option>
          {membershipLevels.map((lvl) => (
            <option key={lvl.MembershipLevelId} value={lvl.MembershipLevelId}>
              {lvl.LevelName}
            </option>
          ))}
        </select>
        <select
          value={filters.gender}
          onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
        >
          <option value="">Tất cả giới tính</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
          <option value="Khác">Khác</option>
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
        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          <span>Lọc</span>
        </button>
        <button className="admin-clear-btn" onClick={handleResetFilters}>
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
        <div className="admin-loading-card">Đang tải danh sách khách hàng spa...</div>
      ) : (
        <div ref={gridRef} className="admin-user-grid">
          {items.map((item) => (
            <div key={item.UserId} id={`customer-card-${item.UserId}`} className="admin-user-card">
              <div className="admin-user-card-header">
                {renderAvatar(item, 56)}
                <div className="admin-user-info">
                  <h4>{item.FullName}</h4>
                  <span>{item.Email}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="admin-role-badge">
                      {item.MembershipLevelName || "Standard Member"}
                    </span>
                    <span className={statusClass(item.Status)}>
                      {item.Status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-user-card-body">
                <InfoRow label="Số điện thoại" value={item.Phone || "Chưa thiết lập"} />
                <InfoRow label="Giới tính" value={item.Gender || "Khác"} />
                <InfoRow label="Điểm tích lũy" value={`${item.LoyaltyPoints || 0} điểm`} valueColor="#b8860b" />
                <InfoRow label="Lịch hẹn trị liệu" value={`${item.AppointmentCount || 0} cuộc`} />
                <InfoRow label="Tổng chi tiêu" value={formatMoney(item.TotalPaid)} valueColor="#107c41" />
              </div>

              <div className="admin-user-card-footer">
                <button className="card-btn primary" onClick={() => handleOpenDetail(item.UserId)}>
                  Hồ sơ
                </button>
                <button className="card-btn" onClick={() => handleOpenEdit(item)}>
                  Sửa
                </button>
                <button className="card-btn" onClick={() => handleOpenPoints(item)}>
                  Điểm 💎
                </button>
                <button className="card-btn" onClick={() => handleOpenPassword(item)}>
                  Pass 🔑
                </button>
                <button className="card-btn danger" onClick={() => handleChangeStatus(item)}>
                  Khóa/Mở
                </button>
              </div>
            </div>
          ))}

          {!items.length ? (
            <div className="admin-empty" style={{ gridColumn: "1/-1" }}>
              Không tìm thấy khách hàng nào phù hợp bộ lọc.
            </div>
          ) : null}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-profile-header">
              {renderAvatar(selected.profile, 64)}
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#d6b57e", fontWeight: "700" }}>
                  Mã khách hàng #{selected.profile.CustomerId}
                </span>
                <h3>{selected.profile.FullName}</h3>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: "13.5px", opacity: 0.85 }}>{selected.profile.Email}</span>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#d6b57e" }}></span>
                  <span className="admin-role-badge" style={{ marginTop: 0 }}>
                    {selected.profile.MembershipLevelName || "Standard Member"}
                  </span>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setSelected(null)} style={{ position: "absolute", top: 20, right: 20, color: "#fff" }}>
                &times;
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="admin-tabs-nav">
              <button className={`admin-tab-btn ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
                Hồ sơ thông tin
              </button>
              <button className={`admin-tab-btn ${activeTab === "appointments" ? "active" : ""}`} onClick={() => setActiveTab("appointments")}>
                Lịch hẹn ({selected.appointments.length})
              </button>
              <button className={`admin-tab-btn ${activeTab === "packages" ? "active" : ""}`} onClick={() => setActiveTab("packages")}>
                Gói Combo ({selected.packages.length})
              </button>
              <button className={`admin-tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
                Nhận xét & Feedback ({selected.history.length})
              </button>
            </div>

            <div className="admin-profile-body">
              {activeTab === "profile" && (
                <div className="admin-profile-grid">
                  <div className="admin-profile-section">
                    <h4>👤 Thông tin chung</h4>
                    <InfoRow label="Số điện thoại" value={selected.profile.Phone || "Chưa cập nhật"} />
                    <InfoRow label="Giới tính" value={selected.profile.Gender || "Khác"} />
                    <InfoRow label="Ngày sinh nhật" value={formatDate(selected.profile.DateOfBirth)} />
                    <InfoRow label="Xác minh email" value={selected.profile.IsVerified ? "Đã xác minh ✓" : "Chưa xác minh ✖"} valueColor={selected.profile.IsVerified ? "#107c41" : "#a80000"} />
                  </div>
                  <div className="admin-profile-section">
                    <h4>💎 Tình trạng Loyalty</h4>
                    <InfoRow label="Điểm tích lũy hiện tại" value={`${selected.profile.LoyaltyPoints || 0} điểm`} valueColor="#b8860b" />
                    <InfoRow label="Tổng chi tiêu đã trả" value={formatMoney(selected.profile.TotalPaid)} valueColor="#107c41" />
                    <div style={{ fontSize: "13px", color: "#8c7e74", borderTop: "1px solid #ebdcc5", paddingTop: 10, marginTop: 4 }}>
                      <strong>Địa chỉ giao dịch:</strong> {selected.profile.Address || "Chưa thiết lập"}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "appointments" && (
                <div className="luxury-table-wrapper">
                  <table className="luxury-table">
                    <thead>
                      <tr>
                        <th>Ngày hẹn</th>
                        <th>Khung giờ</th>
                        <th>Chuyên viên phục vụ</th>
                        <th>Hóa đơn</th>
                        <th>Lịch hẹn</th>
                        <th>Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.appointments.map((a) => (
                        <tr key={a.AppointmentId}>
                          <td>{formatDate(a.AppointmentDate)}</td>
                          <td>{a.StartTime.slice(0, 5)} - {a.EndTime.slice(0, 5)}</td>
                          <td>{a.EmployeeName || "Chưa gán"}</td>
                          <td>{formatMoney(a.FinalAmount || 0)}</td>
                          <td>
                            <span className={statusClass(a.Status)} style={{ position: "static", fontSize: "11px", padding: "2px 8px" }}>
                              {a.Status}
                            </span>
                          </td>
                          <td>
                            <span className={statusClass(a.PaymentStatus)} style={{ position: "static", fontSize: "11px", padding: "2px 8px" }}>
                              {a.PaymentStatus || "PENDING"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!selected.appointments.length ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", color: "#8c7e74" }}>Khách hàng chưa thực hiện cuộc hẹn nào.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "packages" && (
                <div className="luxury-table-wrapper">
                  <table className="luxury-table">
                    <thead>
                      <tr>
                        <th>Tên Combo</th>
                        <th>Tổng buổi</th>
                        <th>Còn lại</th>
                        <th>Ngày mua</th>
                        <th>Hạn dùng</th>
                        <th>Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.packages.map((p) => (
                        <tr key={p.CustomerPackageId}>
                          <td><strong>{p.PackageName}</strong></td>
                          <td>{p.TotalSessions} buổi</td>
                          <td><strong style={{ color: p.SessionsLeft > 0 ? "#107c41" : "#8c7e74" }}>{p.SessionsLeft} buổi</strong></td>
                          <td>{formatDate(p.BoughtAt)}</td>
                          <td>{formatDate(p.ExpiryDate)}</td>
                          <td>
                            <span className={statusClass(p.PaymentStatus)} style={{ position: "static", fontSize: "11px", padding: "2px 8px" }}>
                              {p.PaymentStatus || "PAID"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!selected.packages.length ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", color: "#8c7e74" }}>Khách hàng chưa đăng ký mua gói combo nào.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "history" && (
                <div className="luxury-table-wrapper">
                  <table className="luxury-table">
                    <thead>
                      <tr>
                        <th>Phân loại</th>
                        <th>Nội dung đóng góp</th>
                        <th>Điểm số</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.history.map((h, index) => (
                        <tr key={index}>
                          <td>
                            <span className="admin-role-badge" style={{ background: h.ItemType === "review" ? "#eef2ff" : "#fff0f0", color: h.ItemType === "review" ? "#4f46e5" : "#d83b01", border: "0" }}>
                              {h.ItemType.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                              <strong>{h.TargetName}</strong>: {h.Comment || "Không nhập comment"}
                            </div>
                          </td>
                          <td>
                            {h.Score !== null ? (
                              <strong style={{ color: "#b8860b" }}>{h.Score} ⭐</strong>
                            ) : (
                              <span style={{ color: "#8c7e74" }}>-</span>
                            )}
                          </td>
                          <td>{formatDateTime(h.CreatedAt)}</td>
                        </tr>
                      ))}
                      {!selected.history.length ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center", color: "#8c7e74" }}>Khách hàng chưa có nhận xét hay feedback nào.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 32px", background: "#faf8f5", borderTop: "1px solid #ebdcc5", display: "flex", justifyContent: "flex-end" }}>
              <button className="card-btn primary" style={{ maxWidth: 120 }} onClick={() => setSelected(null)}>
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {showFormModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowFormModal(false)}>
          <div className="admin-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
              <div>
                <span style={{ color: "#d6b57e", textTransform: "uppercase", fontSize: "11px", fontWeight: "700", letterSpacing: "1px" }}>
                  {editingId ? "Cập nhật hồ sơ" : "Thành viên mới"}
                </span>
                <h3 style={{ color: "#ffffff", marginTop: 4 }}>{editingId ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"}</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowFormModal(false)} style={{ color: "#fff" }}>
                &times;
              </button>
            </div>

            <div className="admin-modal-body user-editor">
              <form className="admin-modal-form" onSubmit={handleFormSubmit}>
                <label>
                  Họ và tên *
                  <input
                    value={form.FullName}
                    onChange={(e) => setForm({ ...form, FullName: e.target.value })}
                    placeholder="Nguyễn Thị B"
                    required
                  />
                </label>
                <label>
                  Email đăng nhập *
                  <input
                    type="email"
                    value={form.Email}
                    onChange={(e) => setForm({ ...form, Email: e.target.value })}
                    placeholder="nguyenthib@gmail.com"
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={form.Phone}
                    onChange={(e) => setForm({ ...form, Phone: e.target.value })}
                    placeholder="0932145678"
                  />
                </label>
                {!editingId ? (
                  <label>
                    Mật khẩu đăng nhập *
                    <input
                      type="password"
                      value={form.Password}
                      onChange={(e) => setForm({ ...form, Password: e.target.value })}
                      placeholder="Mật khẩu từ 6 ký tự..."
                      required
                    />
                  </label>
                ) : null}
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
                  Hạng VIP Loyalty
                  <select value={form.MembershipLevelId} onChange={(e) => setForm({ ...form, MembershipLevelId: e.target.value })}>
                    <option value="">Standard (Mặc định)</option>
                    {membershipLevels.map((lvl) => (
                      <option key={lvl.MembershipLevelId} value={lvl.MembershipLevelId}>
                        {lvl.LevelName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Trạng thái hoạt động
                  <select value={form.Status} onChange={(e) => setForm({ ...form, Status: e.target.value })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BANNED">BANNED</option>
                  </select>
                </label>
                <label>
                  Xác minh Email
                  <select value={form.IsVerified ? "1" : "0"} onChange={(e) => setForm({ ...form, IsVerified: e.target.value === "1" })}>
                    <option value="1">Đã xác minh</option>
                    <option value="0">Chưa xác minh</option>
                  </select>
                </label>
                <label>
                  Địa chỉ thường trú
                  <textarea
                    rows={2}
                    value={form.Address}
                    onChange={(e) => setForm({ ...form, Address: e.target.value })}
                    placeholder="Số 88, Đường Võ Văn Kiệt, Q.1, TP.HCM"
                  />
                </label>
              </form>

              {/* Real-time VIP Card Preview */}
              <div className="admin-editor-preview-column">
                <span className="admin-preview-title">Thẻ VIP Live Preview</span>
                <div
                  className="vip-preview-card"
                  style={{ background: vipCardBackground, color: vipCardTextColor }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <small style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.8 }}>
                        Spa Member VIP Card
                      </small>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "800" }}>
                        {selectedML?.LevelName || "Standard Member"}
                      </h4>
                    </div>
                    <div style={{ fontSize: "20px" }}>🏆</div>
                  </div>

                  <div className="vip-card-chip"></div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "14px", letterSpacing: "0.5px" }}>
                        {form.FullName || "HỌ VÀ TÊN KHÁCH"}
                      </strong>
                      <span style={{ fontSize: "11px", opacity: 0.85 }}>{form.Email || "customer@example.com"}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "9px", display: "block", opacity: 0.8 }}>LOYALTY POINTS</span>
                      <strong style={{ fontSize: "14px" }}>0 pts</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="card-btn" type="button" onClick={() => setShowFormModal(false)}>
                Hủy
              </button>
              <button className="card-btn primary" type="button" onClick={handleFormSubmit} disabled={saving}>
                {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST LOYALTY POINTS MODAL */}
      {showPointsModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowPointsModal(false)}>
          <div className="admin-modal-wrapper" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handlePointsSubmit}>
              <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
                <h3>Điều chỉnh điểm Loyalty</h3>
                <button type="button" className="admin-modal-close" onClick={() => setShowPointsModal(false)} style={{ color: "#fff" }}>
                  &times;
                </button>
              </div>

              <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "13.5px", fontWeight: "700", color: "#5c4a3c" }}>
                  Loại điều chỉnh
                  <select
                    value={pointsForm.isEarn ? "1" : "0"}
                    onChange={(e) => setPointsForm({ ...pointsForm, isEarn: e.target.value === "1" })}
                  >
                    <option value="1">Cộng thêm điểm (+)</option>
                    <option value="0">Khấu trừ điểm (-)</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "13.5px", fontWeight: "700", color: "#5c4a3c" }}>
                  Số điểm điều chỉnh *
                  <input
                    type="number"
                    min="1"
                    value={pointsForm.points}
                    onChange={(e) => setPointsForm({ ...pointsForm, points: e.target.value })}
                    required
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "13.5px", fontWeight: "700", color: "#5c4a3c" }}>
                  Lý do ghi nhận
                  <textarea
                    rows={3}
                    value={pointsForm.note}
                    onChange={(e) => setPointsForm({ ...pointsForm, note: e.target.value })}
                    placeholder="Nhập lý do thay đổi điểm thưởng của khách..."
                  />
                </label>
              </div>

              <div className="admin-modal-footer">
                <button className="card-btn" type="button" onClick={() => setShowPointsModal(false)}>
                  Hủy
                </button>
                <button className="card-btn primary" type="submit" disabled={saving}>
                  {saving ? "Đang lưu..." : "Xác nhận đổi điểm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="admin-modal-wrapper" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handlePasswordSubmit}>
              <div className="admin-modal-header" style={{ background: "linear-gradient(135deg, #1f140e 0%, #3a2519 100%)", color: "#fff" }}>
                <h3>Đặt lại mật khẩu</h3>
                <button type="button" className="admin-modal-close" onClick={() => setShowPasswordModal(false)} style={{ color: "#fff" }}>
                  &times;
                </button>
              </div>

              <div style={{ padding: "24px 32px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "13.5px", fontWeight: "700", color: "#5c4a3c" }}>
                  Mật khẩu mới *
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập tối thiểu 6 ký tự..."
                    required
                  />
                </label>
              </div>

              <div className="admin-modal-footer">
                <button className="card-btn" type="button" onClick={() => setShowPasswordModal(false)}>
                  Hủy
                </button>
                <button className="card-btn primary" type="submit" disabled={saving}>
                  {saving ? "Đang cập nhật..." : "Xác nhận đặt lại"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHURN PREDICTION MODAL */}
      {showChurnModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowChurnModal(false)}>
          <div className="admin-modal-wrapper" style={{ maxWidth: 950, width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-profile-header" style={{ background: "linear-gradient(135deg, #1b130f 0%, #2f1d13 100%)" }}>
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#d6b57e", fontWeight: "700" }}>
                  Hệ thống phân tích & cảnh báo
                </span>
                <h3>🔮 AI Customer Churn Analyzer</h3>
              </div>
              <button className="admin-modal-close" onClick={() => setShowChurnModal(false)} style={{ position: "absolute", top: 20, right: 20, color: "#fff" }}>
                &times;
              </button>
            </div>

            {loadingChurn ? (
              <div style={{ padding: 40, textAlign: "center", color: "#8c7e74" }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🤖</div>
                <div style={{ fontWeight: 700 }}>AI đang phân tích hành vi khách hàng và tính toán rủi ro...</div>
                <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>Vui lòng đợi trong giây lát</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
                {/* Summary banner */}
                <div style={{ padding: "16px 28px", background: "#fcfaf7", borderBottom: "1px solid #ebdcc5", fontSize: "13.5px", color: "#5c4a3c", lineHeight: "1.5" }}>
                  <strong>Tổng quan từ AI:</strong> {churnData?.summary || "Không có tóm tắt phân tích."}
                </div>

                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                  {/* Left Column - Customer List */}
                  <div style={{ width: "42%", borderRight: "1px solid #ebdcc5", display: "flex", flexDirection: "column", background: "#faf8f5" }}>
                    {/* Filter tabs */}
                    <div style={{ display: "flex", padding: 8, gap: 4, background: "#f5ece1", borderBottom: "1px solid #ebdcc5" }}>
                      {["ALL", "HIGH_RISK", "MEDIUM_RISK", "LOW_RISK"].map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            setChurnFilter(lvl === "ALL" ? "" : lvl);
                          }}
                          style={{
                            flex: 1,
                            padding: "6px 2px",
                            fontSize: "11px",
                            fontWeight: "700",
                            borderRadius: "6px",
                            border: "none",
                            cursor: "pointer",
                            background: (churnFilter === lvl || (lvl === "ALL" && !churnFilter)) ? "#3a2519" : "transparent",
                            color: (churnFilter === lvl || (lvl === "ALL" && !churnFilter)) ? "#fff" : "#8c7e74",
                            transition: "all 0.2s"
                          }}
                        >
                          {lvl === "ALL" ? "Tất cả" : lvl === "HIGH_RISK" ? "Cao" : lvl === "MEDIUM_RISK" ? "Vừa" : "Thấp"}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable list */}
                    <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                      {(churnData?.customers || [])
                        .filter(c => !churnFilter || c.risk_level === churnFilter)
                        .map(c => {
                          const isSelected = selectedChurnCust?.customer_id === c.customer_id;
                          return (
                            <div
                              key={c.customer_id}
                              onClick={() => setSelectedChurnCust(c)}
                              style={{
                                padding: "12px 16px",
                                borderRadius: "12px",
                                border: "1px solid",
                                borderColor: isSelected ? "#d6b57e" : "#f0dfbf",
                                background: isSelected ? "#fffbf2" : "#ffffff",
                                marginBottom: 8,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                boxShadow: isSelected ? "0 4px 12px rgba(214,181,126,0.15)" : "none"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <strong style={{ fontSize: "14px", color: "#1f140e" }}>{c.name}</strong>
                                <span style={{
                                  fontSize: "9px",
                                  fontWeight: "800",
                                  padding: "3px 8px",
                                  borderRadius: "50px",
                                  background: c.risk_level === "HIGH_RISK" ? "#fdf0f0" : c.risk_level === "MEDIUM_RISK" ? "#fff4e6" : "#e8f7ec",
                                  color: c.risk_level === "HIGH_RISK" ? "#a80000" : c.risk_level === "MEDIUM_RISK" ? "#b86a00" : "#107c41",
                                  border: "1px solid",
                                  borderColor: c.risk_level === "HIGH_RISK" ? "rgba(168,0,0,0.15)" : c.risk_level === "MEDIUM_RISK" ? "rgba(184,106,0,0.15)" : "rgba(16,124,65,0.15)"
                                }}>
                                  {c.risk_level}
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#8c7e74" }}>
                                <span>Mã KH #{c.customer_id}</span>
                                <strong>Điểm rủi ro: {c.risk_score}/100</strong>
                              </div>
                              {/* Risk bar */}
                              <div style={{ width: "100%", height: 5, background: "#f0ece6", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                                <div style={{
                                  width: `${c.risk_score}%`,
                                  height: "100%",
                                  background: c.risk_level === "HIGH_RISK" ? "#d83b01" : c.risk_level === "MEDIUM_RISK" ? "#ff8c00" : "#107c41"
                                }}></div>
                              </div>
                            </div>
                          );
                        })}

                      {!(churnData?.customers || []).filter(c => !churnFilter || c.risk_level === churnFilter).length && (
                        <div style={{ textAlign: "center", padding: 24, fontSize: "13px", color: "#8c7e74" }}>
                          Không có khách hàng nào thuộc bộ lọc này.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - AI Insights Details */}
                  <div style={{ width: "58%", padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", background: "#ffffff" }}>
                    {selectedChurnCust ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Selected Customer Header */}
                        <div style={{ borderBottom: "2px solid #ecd8b8", paddingBottom: 12 }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#d6b57e", textTransform: "uppercase" }}>
                            Phân tích chi tiết hành vi
                          </span>
                          <h3 style={{ margin: "4px 0", fontSize: "20px", color: "#1f140e" }}>{selectedChurnCust.name}</h3>
                          <p style={{ margin: 0, fontSize: "13px", color: "#8c7e74" }}>
                            Mã khách hàng: #{selectedChurnCust.customer_id} {selectedChurnCust.phone ? `| SĐT: ${selectedChurnCust.phone}` : ""}
                          </p>
                        </div>

                        {/* Score stats */}
                        <div style={{ display: "flex", gap: 16 }}>
                          <div style={{ flex: 1, padding: 14, borderRadius: 16, background: selectedChurnCust.risk_level === "HIGH_RISK" ? "#fff0f0" : selectedChurnCust.risk_level === "MEDIUM_RISK" ? "#fff9f2" : "#f2faf4", border: "1px solid", borderColor: selectedChurnCust.risk_level === "HIGH_RISK" ? "#fcd4d4" : selectedChurnCust.risk_level === "MEDIUM_RISK" ? "#ffe5cc" : "#d4ecd9", textAlign: "center" }}>
                            <div style={{ fontSize: "12px", color: "#8c7e74", fontWeight: "600", textTransform: "uppercase" }}>Mức độ rủi ro</div>
                            <strong style={{ fontSize: "18px", color: selectedChurnCust.risk_level === "HIGH_RISK" ? "#a80000" : selectedChurnCust.risk_level === "MEDIUM_RISK" ? "#b86a00" : "#107c41" }}>
                              {selectedChurnCust.risk_level === "HIGH_RISK" ? "⚠️ HIGH RISK" : selectedChurnCust.risk_level === "MEDIUM_RISK" ? "⚡ MEDIUM RISK" : "✅ LOW RISK"}
                            </strong>
                          </div>
                          <div style={{ flex: 1, padding: 14, borderRadius: 16, background: "#fcfaf7", border: "1px solid #ebdcc5", textAlign: "center" }}>
                            <div style={{ fontSize: "12px", color: "#8c7e74", fontWeight: "600", textTransform: "uppercase" }}>Điểm rủi ro (Risk Score)</div>
                            <strong style={{ fontSize: "18px", color: "#1f140e" }}>{selectedChurnCust.risk_score} / 100</strong>
                          </div>
                        </div>

                        {/* Reasons block */}
                        <div>
                          <h4 style={{ fontSize: "14.5px", color: "#3f2817", margin: "0 0 10px 0", fontWeight: "700" }}>⚠️ Dấu hiệu rủi ro phát hiện:</h4>
                          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: "13.5px", color: "#5c4a3c", lineHeight: "1.4" }}>
                            {(selectedChurnCust.reason || []).map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Recommendations block */}
                        <div style={{ background: "#fdfcfb", border: "1px solid #ebdcc5", borderRadius: 16, padding: 18 }}>
                          <h4 style={{ fontSize: "14.5px", color: "#8a653a", margin: "0 0 10px 0", fontWeight: "700" }}>💡 Khuyến nghị giữ chân (AI Suggested):</h4>
                          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: "13.5px", color: "#5c4a3c", lineHeight: "1.4" }}>
                            {(selectedChurnCust.recommended_action || []).map((a, i) => (
                              <li key={i} style={{ color: "#5c4a3c" }}>{a}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Call to action buttons */}
                        <div style={{ display: "flex", gap: 12, marginTop: 10, borderTop: "1px solid #ebdcc5", paddingTop: 16 }}>
                          {selectedChurnCust.phone && (
                            <a
                              href={`tel:${selectedChurnCust.phone}`}
                              className="card-btn primary"
                              style={{ textDecoration: "none", flex: 1, textAlign: "center" }}
                            >
                              📞 Gọi điện chăm sóc
                            </a>
                          )}
                          <a
                            href="/admin/promotions"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowChurnModal(false);
                              alert(`Chuyển đến màn hình Voucher để thiết lập quà tặng giữ chân cho ${selectedChurnCust.name}`);
                            }}
                            className="card-btn"
                            style={{ textDecoration: "none", flex: 1, textAlign: "center" }}
                          >
                            🎁 Gửi tặng Voucher
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#8c7e74" }}>
                        <span style={{ fontSize: 48, marginBottom: 12 }}>🔮</span>
                        <div style={{ fontWeight: 700 }}>AI Churn Analyzer Dashboard</div>
                        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>Vui lòng chọn một khách hàng ở danh sách bên trái để xem phân tích hành vi và gợi ý giữ chân từ AI.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button className="admin-clear-btn" type="button" onClick={() => setShowChurnModal(false)}>
                    Đóng báo cáo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
