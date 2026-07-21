import { useEffect, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function dateText(value) {
  if (!value) return "N/A";

  const raw = String(value).trim();

  if (
    !raw ||
    raw === "Invalid Date" ||
    raw === "null" ||
    raw === "undefined" ||
    raw.startsWith("0000")
  ) {
    return "N/A";
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusText(status) {
  if (!status) return "Đang hoạt động";
  if (status === "ACTIVE") return "Đang hoạt động";
  if (status === "INACTIVE") return "Ngưng hoạt động";
  if (status === "OFFLINE") return "Ngoại tuyến";
  return status;
}

export default function TechnicianSettings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    specialization: "",
    bio: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/technician/settings");
      const payload = res.data?.data || {};
      const profile = payload.profile || {};

      setData(payload);
      setForm({
        fullName: profile.FullName || "",
        email: profile.Email || "",
        phone: profile.Phone || "",
        specialization: profile.Specialization || "",
        bio: profile.Bio || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được thông tin cài đặt",
      );
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      await axiosClient.put("/technician/settings", {
        fullName: form.fullName,
        phone: form.phone,
        specialization: form.specialization,
        bio: form.bio,
      });

      alert("Đã lưu thay đổi thành công");
      await loadSettings();
    } catch (err) {
      alert(err.response?.data?.message || "Không lưu được thay đổi");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh hợp lệ");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Dung lượng ảnh tối đa là 2MB");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await axiosClient.put("/technician/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const payload = res.data?.data || {};
      const profile = payload.profile || {};

      setData(payload);
      setForm({
        fullName: profile.FullName || "",
        email: profile.Email || "",
        phone: profile.Phone || "",
        specialization: profile.Specialization || "",
        bio: profile.Bio || "",
      });

      alert("Đã cập nhật ảnh đại diện thành công");
    } catch (err) {
      alert(err.response?.data?.message || "Không tải lên được ảnh đại diện");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const profile = data?.profile || {};
  const employeeStatus = profile.EmployeeStatus || profile.Status;

  return (
    <TechnicianLayout>
      <div className="tech-settings-page">
        <header className="profile-header">
          <div>
            <h1>
              Cài đặt tài khoản <span>⚙</span>
            </h1>
            <p>Quản lý thông tin hồ sơ cá nhân và ảnh đại diện của bạn</p>
          </div>
        </header>

        {loading && (
          <div className="profile-card profile-loading">
            Đang tải cài đặt tài khoản...
          </div>
        )}

        {!loading && error && (
          <div className="profile-card profile-error">
            <p>{error}</p>
            <button type="button" onClick={loadSettings}>
              Tải lại
            </button>
          </div>
        )}

        {!loading && !error && (
          <section className="settings-layout">
            <aside className="settings-menu">
              <button type="button" className="active">
                ☰ Thông tin chung
              </button>
            </aside>

            <main className="settings-main-card">
              <section>
                <div className="settings-card-head">
                  <h3>Thông tin cá nhân</h3>

                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving}
                  >
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>

                <div className="settings-form-grid">
                  <label>
                    Họ và tên
                    <input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                      placeholder="Nhập họ và tên của bạn"
                    />
                  </label>

                  <label>
                    Địa chỉ Email
                    <input value={form.email} disabled title="Không thể thay đổi email đăng nhập" style={{ cursor: "not-allowed" }} />
                  </label>

                  <label>
                    Số điện thoại
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder="Nhập số điện thoại liên lạc"
                    />
                  </label>

                  <label>
                    Chuyên môn dịch vụ
                    <input
                      value={form.specialization}
                      onChange={(e) =>
                        setForm({ ...form, specialization: e.target.value })
                      }
                      placeholder="Ví dụ: Massage, Làm móng, Chăm sóc da mặt..."
                    />
                  </label>
                </div>

                <label className="settings-bio">
                  Giới thiệu bản thân
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    maxLength={300}
                    placeholder="Viết một đoạn giới thiệu ngắn gọn về thế mạnh và chuyên môn của bạn..."
                  />
                  <small>{form.bio.length}/300 ký tự</small>
                </label>

                <div className="settings-photo">
                  <img
                    src={avatar(profile.AvatarUrl || profile.ImageUrl)}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                    alt={profile.FullName || "Kỹ thuật viên"}
                  />

                  <div>
                    <label className="quick-setting-btn">
                      📷 {uploading ? "Đang tải ảnh..." : "Thay đổi ảnh đại diện"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={uploading}
                        onChange={(e) => uploadAvatar(e.target.files?.[0])}
                      />
                    </label>

                    <p>Chấp nhận JPG, PNG hoặc WEBP. Dung lượng tối đa 2MB</p>
                  </div>
                </div>
              </section>
            </main>

            <aside className="settings-right">
              <div className="settings-side-card">
                <h3>Tóm tắt tài khoản</h3>

                <p>
                  <span>Mã kỹ thuật viên</span>
                  <b>{profile.TechnicianCode || "N/A"}</b>
                </p>

                <p>
                  <span>Thành viên từ</span>
                  <b>{dateText(profile.HireDate || profile.CreatedAt)}</b>
                </p>

                <p>
                  <span>Trạng thái hoạt động</span>
                  <b className="active-status">{statusText(employeeStatus)}</b>
                </p>

                <p>
                  <span>Trạng thái xác minh</span>
                  <b>{profile.IsVerified === false ? "Chưa xác minh" : "Đã xác minh"}</b>
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </TechnicianLayout>
  );
}
