import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

const emptyForm = {
  FullName: "",
  Email: "",
  Phone: "",
  RoleId: "",
  AvatarUrl: "",
  Status: "ACTIVE",
  IsVerified: true,
  Password: "",
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
  if (!value) return "N/A";
  return new Date(value).toLocaleString("vi-VN");
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
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

  async function load() {
    try {
      setError("");
      setLoading(true);

      const [userRes, roleRes] = await Promise.all([
        axiosClient.get("/admin/users", {
          params: {
            keyword: filters.keyword || undefined,
            roleId: filters.roleId || undefined,
            status: filters.status || undefined,
            isVerified: filters.isVerified || undefined,
          },
        }),
        axiosClient.get("/admin/users/roles"),
      ]);

      setItems(userRes.data.data || userRes.data || []);
      setRoles(roleRes.data.data || roleRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách user",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
  }

  function openEdit(item) {
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
    });
    setShowModal(true);
    setError("");
  }

  function validate() {
    if (!form.FullName.trim()) throw new Error("Vui lòng nhập họ tên");
    if (!form.Email.trim()) throw new Error("Vui lòng nhập email");
    if (!form.RoleId) throw new Error("Vui lòng chọn role");
    if (!editingId && !form.Password.trim()) {
      throw new Error("Vui lòng nhập mật khẩu khi tạo user");
    }
    if (!editingId && form.Password.length < 6) {
      throw new Error("Mật khẩu phải từ 6 ký tự");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        FullName: form.FullName.trim(),
        Email: form.Email.trim().toLowerCase(),
        Phone: form.Phone.trim() || null,
        RoleId: Number(form.RoleId),
        AvatarUrl: form.AvatarUrl.trim() || null,
        Status: form.Status,
        IsVerified: form.IsVerified ? 1 : 0,
      };

      if (!editingId) payload.Password = form.Password;

      if (editingId) {
        await axiosClient.put(`/admin/users/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/users", payload);
      }

      setShowModal(false);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu user thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, nextStatus) {
    if (!window.confirm(`Đổi trạng thái "${item.Email}" thành ${nextStatus}?`))
      return;

    try {
      setError("");
      await axiosClient.patch(`/admin/users/${item.UserId}/status`, {
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

  async function resetPassword(e) {
    e.preventDefault();
    if (!passwordModal) return;

    try {
      if (newPassword.length < 6) throw new Error("Mật khẩu phải từ 6 ký tự");

      setSaving(true);
      setError("");

      await axiosClient.patch(`/admin/users/${passwordModal.UserId}/password`, {
        Password: newPassword,
      });

      setPasswordModal(null);
      setNewPassword("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Reset password thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-page admin-users-page">
      <div className="admin-users-hero">
        <div>
          <div className="admin-eyebrow">Users Management</div>
          <h1>Quản lý tài khoản</h1>
          <p>
            Quản lý user, role, trạng thái, xác minh tài khoản, avatar và reset
            mật khẩu cho toàn hệ thống.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm user
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Tổng user</p>
            <h3>{stats.total}</h3>
            <span>Tất cả tài khoản</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Active</p>
            <h3>{stats.active}</h3>
            <span>Tài khoản đang hoạt động</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🔒</div>
          <div>
            <p>Banned</p>
            <h3>{stats.banned}</h3>
            <span>Tài khoản bị khóa</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✉</div>
          <div>
            <p>Verified</p>
            <h3>{stats.verified}</h3>
            <span>Đã xác minh email</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-users-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          placeholder="Tìm tên, email, số điện thoại..."
        />

        <select
          value={filters.roleId}
          onChange={(e) => setFilters({ ...filters, roleId: e.target.value })}
        >
          <option value="">Tất cả role</option>
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
          onChange={(e) =>
            setFilters({ ...filters, isVerified: e.target.value })
          }
        >
          <option value="">Tất cả verify</option>
          <option value="1">Verified</option>
          <option value="0">Not verified</option>
        </select>

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button
          className="card-btn"
          onClick={() =>
            setFilters({
              keyword: "",
              roleId: "",
              status: "",
              isVerified: "",
            })
          }
        >
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải users...</div>
      ) : null}

      {!loading ? (
        <div className="admin-users-grid">
          {items.map((item) => (
            <article className="admin-user-card" key={item.UserId}>
              <div className="admin-user-top">
                <img src={avatar(item.AvatarUrl)} alt={item.FullName} />

                <div>
                  <h3>{item.FullName}</h3>
                  <p>{item.Email}</p>
                  <div className="admin-user-badges">
                    <span className={statusClass(item.Status)}>
                      {item.Status}
                    </span>
                    <span className="admin-status">{item.RoleName}</span>
                    {item.IsVerified ? (
                      <span className="admin-status admin-status-active">
                        VERIFIED
                      </span>
                    ) : (
                      <span className="admin-status admin-status-pending">
                        NOT VERIFIED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-user-info">
                <div>
                  <span>Phone</span>
                  <strong>{item.Phone || "Chưa có"}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{item.RoleName}</strong>
                </div>
                <div>
                  <span>Customer</span>
                  <strong>
                    {item.CustomerId ? `#${item.CustomerId}` : "No"}
                  </strong>
                </div>
                <div>
                  <span>Employee</span>
                  <strong>
                    {item.EmployeeId ? `#${item.EmployeeId}` : "No"}
                  </strong>
                </div>
                <div>
                  <span>Appointments</span>
                  <strong>{item.AppointmentCount || 0}</strong>
                </div>
                <div>
                  <span>Total paid</span>
                  <strong>{money(item.TotalPaid)}</strong>
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

                <button
                  className="card-btn"
                  onClick={() => {
                    setPasswordModal(item);
                    setNewPassword("");
                  }}
                >
                  Reset pass
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
            <div className="admin-empty">Không có user phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-user-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="admin-detail-head">
              <img src={avatar(selected.AvatarUrl)} alt={selected.FullName} />
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
                <strong>UserId:</strong> #{selected.UserId}
              </p>
              <p>
                <strong>Phone:</strong> {selected.Phone || "Chưa có"}
              </p>
              <p>
                <strong>Role:</strong> {selected.RoleName}
              </p>
              <p>
                <strong>Verified:</strong> {selected.IsVerified ? "Yes" : "No"}
              </p>
              <p>
                <strong>Google:</strong>{" "}
                {selected.GoogleId ? "Connected" : "No"}
              </p>
              <p>
                <strong>Created:</strong> {dateText(selected.CreatedAt)}
              </p>
              <p>
                <strong>Updated:</strong> {dateText(selected.UpdatedAt)}
              </p>
              <p>
                <strong>CustomerId:</strong> {selected.CustomerId || "No"}
              </p>
              <p>
                <strong>Membership:</strong>{" "}
                {selected.MembershipLevelName || "No"}
              </p>
              <p>
                <strong>Loyalty:</strong> {selected.LoyaltyPoints || 0}
              </p>
              <p>
                <strong>EmployeeId:</strong> {selected.EmployeeId || "No"}
              </p>
              <p>
                <strong>Position:</strong> {selected.Position || "No"}
              </p>
              <p>
                <strong>Specialization:</strong>{" "}
                {selected.Specialization || "No"}
              </p>
              <p>
                <strong>Branch:</strong> {selected.BranchName || "No"}
              </p>
              <p>
                <strong>Appointments:</strong> {selected.AppointmentCount || 0}
              </p>
              <p>
                <strong>Total paid:</strong> {money(selected.TotalPaid)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-user-form luxury-user-editor"
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

            <div className="user-editor-head">
              <div>
                <span>{editingId ? "Edit User" : "Create User"}</span>
                <h3>{editingId ? "Sửa tài khoản" : "Thêm tài khoản mới"}</h3>
                <p>
                  Cập nhật thông tin user, role, trạng thái, xác minh và avatar.
                </p>
              </div>

              <div className="user-preview-card">
                <img src={avatar(form.AvatarUrl)} alt={form.FullName} />
                <strong>{form.FullName || "New User"}</strong>
                <span>{form.Email || "email@example.com"}</span>
                <b>{form.Status}</b>
              </div>
            </div>

            <div className="user-editor-layout">
              <div className="user-editor-main">
                <div className="user-section-title">
                  <span>01</span>
                  <div>
                    <h4>Thông tin cơ bản</h4>
                    <p>Thông tin đăng nhập và liên hệ.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Họ tên *
                    <input
                      value={form.FullName}
                      onChange={(e) =>
                        setForm({ ...form, FullName: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Email *
                    <input
                      type="email"
                      value={form.Email}
                      onChange={(e) =>
                        setForm({ ...form, Email: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Phone
                    <input
                      value={form.Phone}
                      onChange={(e) =>
                        setForm({ ...form, Phone: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Role *
                    <select
                      value={form.RoleId}
                      onChange={(e) =>
                        setForm({ ...form, RoleId: e.target.value })
                      }
                      required
                    >
                      <option value="">Chọn role</option>
                      {roles.map((r) => (
                        <option key={r.RoleId} value={r.RoleId}>
                          {r.RoleName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={form.Status}
                      onChange={(e) =>
                        setForm({ ...form, Status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="BANNED">BANNED</option>
                    </select>
                  </label>

                  <label>
                    IsVerified
                    <select
                      value={form.IsVerified ? "1" : "0"}
                      onChange={(e) =>
                        setForm({ ...form, IsVerified: e.target.value === "1" })
                      }
                    >
                      <option value="1">Verified</option>
                      <option value="0">Not verified</option>
                    </select>
                  </label>

                  {!editingId ? (
                    <label>
                      Password *
                      <input
                        type="password"
                        value={form.Password}
                        onChange={(e) =>
                          setForm({ ...form, Password: e.target.value })
                        }
                        required
                      />
                    </label>
                  ) : null}

                  <label className="admin-form-wide">
                    AvatarUrl
                    <input
                      value={form.AvatarUrl}
                      onChange={(e) =>
                        setForm({ ...form, AvatarUrl: e.target.value })
                      }
                      placeholder="/uploads/avatar.png"
                    />
                  </label>
                </div>
              </div>

              <aside className="user-editor-side">
                <h4>Tóm tắt user</h4>

                <div className="user-summary-card">
                  <span>Họ tên</span>
                  <strong>{form.FullName || "Chưa nhập"}</strong>
                </div>

                <div className="user-summary-card">
                  <span>Email</span>
                  <strong>{form.Email || "Chưa nhập"}</strong>
                </div>

                <div className="user-summary-card">
                  <span>Role</span>
                  <strong>
                    {roles.find((r) => String(r.RoleId) === String(form.RoleId))
                      ?.RoleName || "Chưa chọn"}
                  </strong>
                </div>

                <div className="user-summary-card">
                  <span>Status</span>
                  <strong>{form.Status}</strong>
                </div>

                <div className="user-summary-card">
                  <span>Verify</span>
                  <strong>
                    {form.IsVerified ? "Verified" : "Not verified"}
                  </strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions user-editor-actions">
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
                    ? "Cập nhật user"
                    : "Tạo user"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {passwordModal ? (
        <div className="modal-backdrop" onClick={() => setPasswordModal(null)}>
          <form
            className="modal-card admin-password-form"
            onSubmit={resetPassword}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setPasswordModal(null)}
            >
              ×
            </button>

            <h3>Reset password</h3>
            <p>
              User: <strong>{passwordModal.Email}</strong>
            </p>

            <label>
              Mật khẩu mới
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                required
              />
            </label>

            <div className="admin-form-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setPasswordModal(null)}
              >
                Hủy
              </button>
              <button className="card-btn primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Reset"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
