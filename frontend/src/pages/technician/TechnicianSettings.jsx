import { useEffect, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusText(status) {
  if (!status) return "Active";
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  if (status === "OFFLINE") return "Offline";
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

      alert("Đã lưu thay đổi");
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
      alert("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Ảnh tối đa 2MB");
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

      alert("Đã cập nhật ảnh đại diện");
    } catch (err) {
      alert(err.response?.data?.message || "Không upload được ảnh");
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
              Settings <span>⚙</span>
            </h1>
            <p>Manage your profile information and avatar</p>
          </div>
        </header>

        {loading && (
          <div className="profile-card profile-loading">
            Loading settings...
          </div>
        )}

        {!loading && error && (
          <div className="profile-card profile-error">
            <p>{error}</p>
            <button type="button" onClick={loadSettings}>
              Reload
            </button>
          </div>
        )}

        {!loading && !error && (
          <section className="settings-layout">
            <aside className="settings-menu">
              <button type="button" className="active">
                ☰ General
              </button>
            </aside>

            <main className="settings-main-card">
              <section>
                <div className="settings-card-head">
                  <h3>Profile Information</h3>

                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>

                <div className="settings-form-grid">
                  <label>
                    Full Name
                    <input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                      placeholder="Enter full name"
                    />
                  </label>

                  <label>
                    Email
                    <input value={form.email} disabled />
                  </label>

                  <label>
                    Phone Number
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      placeholder="Enter phone number"
                    />
                  </label>

                  <label>
                    Specialization
                    <input
                      value={form.specialization}
                      onChange={(e) =>
                        setForm({ ...form, specialization: e.target.value })
                      }
                      placeholder="Massage, Hair, Nails..."
                    />
                  </label>
                </div>

                <label className="settings-bio">
                  Bio
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    maxLength={300}
                    placeholder="Write a short professional introduction"
                  />
                  <small>{form.bio.length}/300</small>
                </label>

                <div className="settings-photo">
                  <img
                    src={avatar(profile.AvatarUrl)}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                    alt={profile.FullName || "Technician avatar"}
                  />

                  <div>
                    <label className="quick-setting-btn">
                      📷 {uploading ? "Uploading..." : "Change Photo"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={uploading}
                        onChange={(e) => uploadAvatar(e.target.files?.[0])}
                      />
                    </label>

                    <p>JPG, PNG or WEBP. Max size 2MB</p>
                  </div>
                </div>
              </section>
            </main>

            <aside className="settings-right">
              <div className="settings-side-card">
                <h3>Account Summary</h3>

                <p>
                  <span>Technician ID</span>
                  <b>{profile.TechnicianCode || "N/A"}</b>
                </p>

                <p>
                  <span>Member Since</span>
                  <b>{dateText(profile.HireDate || profile.CreatedAt)}</b>
                </p>

                <p>
                  <span>Account Status</span>
                  <b className="active-status">{statusText(employeeStatus)}</b>
                </p>

                <p>
                  <span>Verified</span>
                  <b>{profile.IsVerified === false ? "No" : "Yes"}</b>
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </TechnicianLayout>
  );
}
