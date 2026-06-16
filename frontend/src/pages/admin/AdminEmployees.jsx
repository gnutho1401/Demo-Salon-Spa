import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
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

  async function load() {
    try {
      setError("");
      setLoading(true);

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

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.Status === "ACTIVE").length;
    const inactive = items.filter((x) => x.Status === "INACTIVE").length;
    const banned = items.filter((x) => x.Status === "BANNED").length;
    const technician = items.filter((x) => x.RoleName === "TECHNICIAN").length;
    return { total, active, inactive, banned, technician };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item) {
    setEditingId(item.EmployeeId);
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
    setShowModal(true);
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

      if (editingId) {
        await axiosClient.put(`/admin/employees/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/employees", payload);
      }

      setShowModal(false);
      await load();
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
      `Bạn muốn đổi trạng thái ${item.FullName} thành ${nextStatus}?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.patch(`/admin/employees/${item.EmployeeId}/status`, {
        status: nextStatus,
      });
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  return (
    <section className="admin-page admin-employees-page">
      <div className="admin-employee-hero">
        <div>
          <div className="admin-eyebrow">Employees Management</div>
          <h1>Quản lý nhân viên</h1>
          <p>
            Quản lý tài khoản nhân viên, vai trò, chi nhánh, trạng thái, lương,
            kinh nghiệm, chuyên môn và hiệu suất làm việc.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm nhân viên
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Tổng nhân viên</p>
            <h3>{stats.total}</h3>
            <span>Tất cả nhân viên trong hệ thống</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
            <span>Tài khoản ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">💆</div>
          <div>
            <p>Technician</p>
            <h3>{stats.technician}</h3>
            <span>Nhân viên kỹ thuật</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">!</div>
          <div>
            <p>Inactive / Banned</p>
            <h3>
              {stats.inactive} / {stats.banned}
            </h3>
            <span>Cần admin theo dõi</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm theo tên, email, số điện thoại..."
        />

        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.RoleId} value={r.RoleId}>
              {r.RoleName}
            </option>
          ))}
        </select>

        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.BranchId} value={b.BranchId}>
              {b.BranchName}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BANNED">BANNED</option>
        </select>

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">
          Đang tải danh sách nhân viên...
        </div>
      ) : null}

      {!loading ? (
        <div className="admin-employee-grid">
          {items.map((item) => (
            <article className="admin-employee-card" key={item.EmployeeId}>
              <div className="admin-employee-top">
                <img
                  src={avatar(item.ImageUrl || item.AvatarUrl)}
                  alt={item.FullName}
                />

                <div>
                  <h3>{item.FullName}</h3>
                  <p>{item.Email}</p>
                  <span className={statusClass(item.Status)}>
                    {item.Status}
                  </span>
                </div>
              </div>

              <div className="admin-employee-info">
                <div>
                  <span>Vai trò</span>
                  <strong>{item.RoleName}</strong>
                </div>
                <div>
                  <span>Chi nhánh</span>
                  <strong>{item.BranchName || "Chưa có"}</strong>
                </div>
                <div>
                  <span>Vị trí</span>
                  <strong>{item.Position || "Chưa có"}</strong>
                </div>
                <div>
                  <span>Chuyên môn</span>
                  <strong>{item.Specialization || "Chưa có"}</strong>
                </div>
                <div>
                  <span>Lương</span>
                  <strong>{money(item.Salary)}</strong>
                </div>
                <div>
                  <span>Kinh nghiệm</span>
                  <strong>{item.YearsOfExperience || 0} năm</strong>
                </div>
                <div>
                  <span>Lịch hẹn</span>
                  <strong>{item.TotalAppointments || 0}</strong>
                </div>
                <div>
                  <span>Rating</span>
                  <strong>
                    {Number(item.AvgRating || 0).toFixed(1)} ★ /{" "}
                    {item.ReviewCount || 0} review
                  </strong>
                </div>
              </div>

              <div className="admin-card-actions">
                <button className="card-btn" onClick={() => setSelected(item)}>
                  Chi tiết
                </button>
                <button
                  className="card-btn primary"
                  onClick={() => openEdit(item)}
                >
                  Sửa
                </button>
                {item.Status !== "ACTIVE" ? (
                  <button
                    className="card-btn"
                    onClick={() => changeStatus(item, "ACTIVE")}
                  >
                    Active
                  </button>
                ) : (
                  <button
                    className="card-btn"
                    onClick={() => changeStatus(item, "INACTIVE")}
                  >
                    Inactive
                  </button>
                )}
                {item.Status !== "BANNED" ? (
                  <button
                    className="card-btn danger"
                    onClick={() => changeStatus(item, "BANNED")}
                  >
                    Ban
                  </button>
                ) : null}
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có nhân viên phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-employee-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="admin-detail-head">
              <img
                src={avatar(selected.ImageUrl || selected.AvatarUrl)}
                alt={selected.FullName}
              />
              <div>
                <h3>{selected.FullName}</h3>
                <p>{selected.Email}</p>
                <span className={statusClass(selected.Status)}>
                  {selected.Status}
                </span>
              </div>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>SĐT:</strong> {selected.Phone || "Chưa có"}
              </p>
              <p>
                <strong>Vai trò:</strong> {selected.RoleName}
              </p>
              <p>
                <strong>Chi nhánh:</strong> {selected.BranchName || "Chưa có"}
              </p>
              <p>
                <strong>Địa chỉ CN:</strong>{" "}
                {selected.BranchAddress || "Chưa có"}
              </p>
              <p>
                <strong>Vị trí:</strong> {selected.Position || "Chưa có"}
              </p>
              <p>
                <strong>Chuyên môn:</strong>{" "}
                {selected.Specialization || "Chưa có"}
              </p>
              <p>
                <strong>Lương:</strong> {money(selected.Salary)}
              </p>
              <p>
                <strong>Ngày vào làm:</strong> {dateText(selected.HireDate)}
              </p>
              <p>
                <strong>Kinh nghiệm:</strong> {selected.YearsOfExperience || 0}{" "}
                năm
              </p>
              <p>
                <strong>Dịch vụ phụ trách:</strong> {selected.ServiceCount || 0}
              </p>
              <p>
                <strong>Tổng lịch:</strong> {selected.TotalAppointments || 0}
              </p>
              <p>
                <strong>Hoàn thành:</strong>{" "}
                {selected.CompletedAppointments || 0}
              </p>
              <p>
                <strong>Rating:</strong>{" "}
                {Number(selected.AvgRating || 0).toFixed(1)} ★
              </p>
              <p>
                <strong>Số review:</strong> {selected.ReviewCount || 0}
              </p>
            </div>

            <div className="admin-detail-bio">
              <strong>Bio</strong>
              <p>{selected.Bio || "Chưa có mô tả."}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-employee-form"
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

            <h3>{editingId ? "Sửa nhân viên" : "Thêm nhân viên"}</h3>

            <div className="admin-form-grid">
              <label>
                Họ tên *
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </label>

              <label>
                Email *
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label>
                Số điện thoại
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label>
                Vai trò *
                <select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
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
                Trạng thái tài khoản
                <select
                  value={form.userStatus}
                  onChange={(e) =>
                    setForm({ ...form, userStatus: e.target.value })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </label>

              <label>
                Trạng thái nhân viên
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </label>

              <label>
                Chi nhánh
                <select
                  value={form.branchId}
                  onChange={(e) =>
                    setForm({ ...form, branchId: e.target.value })
                  }
                >
                  <option value="">Chưa chọn</option>
                  {branches.map((b) => (
                    <option key={b.BranchId} value={b.BranchId}>
                      {b.BranchName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vị trí
                <input
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  placeholder="Technician / Receptionist / Manager..."
                />
              </label>

              <label>
                Chuyên môn
                <input
                  value={form.specialization}
                  onChange={(e) =>
                    setForm({ ...form, specialization: e.target.value })
                  }
                  placeholder="Hair, Nail, Spa..."
                />
              </label>

              <label>
                Lương
                <input
                  type="number"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                />
              </label>

              <label>
                Ngày vào làm
                <input
                  type="date"
                  value={form.hireDate}
                  onChange={(e) =>
                    setForm({ ...form, hireDate: e.target.value })
                  }
                />
              </label>

              <label>
                Số năm kinh nghiệm
                <input
                  type="number"
                  value={form.yearsOfExperience}
                  onChange={(e) =>
                    setForm({ ...form, yearsOfExperience: e.target.value })
                  }
                />
              </label>

              <label>
                AvatarUrl
                <input
                  value={form.avatarUrl}
                  onChange={(e) =>
                    setForm({ ...form, avatarUrl: e.target.value })
                  }
                />
              </label>

              <label>
                ImageUrl
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                />
              </label>

              {!editingId ? (
                <label>
                  Mật khẩu *
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </label>
              ) : null}

              <label className="admin-form-wide">
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={4}
                />
              </label>
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
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
