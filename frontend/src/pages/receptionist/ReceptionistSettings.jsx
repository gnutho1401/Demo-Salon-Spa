import { useEffect, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function ReceptionistSettings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    bio: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get("/receptionist/settings");
      const payload = res.data.data;
      const profile = payload.profile || {};

      setData(payload);
      setForm({
        fullName: profile.FullName || "",
        email: profile.Email || "",
        phone: profile.Phone || "",
        position: profile.Position || "Receptionist",
        bio: profile.Bio || "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const res = await axiosClient.put("/receptionist/settings", {
        fullName: form.fullName,
        phone: form.phone,
        position: form.position,
        bio: form.bio,
      });

      setData(res.data.data);
      setMessage("Đã lưu thay đổi.");
    } catch (err) {
      setError(err.response?.data?.message || "Không lưu được thay đổi");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Chỉ được chọn file ảnh.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await axiosClient.put("/receptionist/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setData(res.data.data);
      setMessage("Đã cập nhật avatar.");
    } catch (err) {
      setError(err.response?.data?.message || "Không upload được avatar");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const profile = data?.profile || {};

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <header className="rx-page-header">
          <div>
            <h1>Receptionist Settings</h1>
            <p>Cập nhật thông tin cá nhân và avatar thật.</p>
          </div>
        </header>

        {loading && <div className="rx-empty-card">Đang tải settings...</div>}
        {error && <div className="rx-alert-error">{error}</div>}
        {message && <div className="rx-alert-success">{message}</div>}

        {!loading && (
          <section className="rx-settings-grid">
            <aside className="rx-card rx-settings-avatar-card">
              <img
                src={avatar(profile.AvatarUrl || profile.ImageUrl)}
                alt={profile.FullName || "Receptionist"}
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />

              <h3>{profile.FullName || "N/A"}</h3>
              <p>{profile.Email || "N/A"}</p>

              <label className="rx-primary-btn">
                {uploading ? "Uploading..." : "Change Avatar"}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                />
              </label>
            </aside>

            <form className="rx-card rx-settings-form" onSubmit={saveSettings}>
              <h3>Profile Information</h3>

              <label>
                Full Name
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Email
                <input value={form.email} disabled />
              </label>

              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label>
                Position
                <input
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                />
              </label>

              <label>
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  maxLength={500}
                />
              </label>

              <button className="rx-primary-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>
        )}
      </div>
    </ReceptionistLayout>
  );
}
