import { useEffect, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function ReceptionistSettings() {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    bio: "",
  });

  // Local preferences states saved to localStorage
  const [language, setLanguage] = useState(() => localStorage.getItem("rc_lang") || "vi");
  const [timezone, setTimezone] = useState(() => localStorage.getItem("rc_tz") || "gmt_7");
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem("rc_date_fmt") || "dd_mm_yyyy");
  const [timeFormat, setTimeFormat] = useState(() => localStorage.getItem("rc_time_fmt") || "24h");
  const [theme, setTheme] = useState(() => localStorage.getItem("rc_theme") || "light");
  const [twoFA, setTwoFA] = useState(() => localStorage.getItem("rc_2fa") === "true");
  
  // Notification states
  const [notifEmail, setNotifEmail] = useState(() => localStorage.getItem("rc_notif_email") !== "false");
  const [notifSMS, setNotifSMS] = useState(() => localStorage.getItem("rc_notif_sms") !== "false");
  const [notifSystem, setNotifSystem] = useState(() => localStorage.getItem("rc_notif_sys") !== "false");
  const [notifAppointment, setNotifAppointment] = useState(() => localStorage.getItem("rc_notif_appt") !== "false");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Change password modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPw: "", newPw: "", confirmPw: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

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
        position: profile.Position || "Lễ tân",
        bio: profile.Bio || "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được cấu hình tài khoản từ hệ thống");
    } finally {
      setLoading(false);
    }
  }

  // Restore/Undo changes
  function handleUndo() {
    if (!data) return;
    const profile = data.profile || {};
    setForm({
      fullName: profile.FullName || "",
      email: profile.Email || "",
      phone: profile.Phone || "",
      position: profile.Position || "Lễ tân",
      bio: profile.Bio || "",
    });
    setMessage("Đã hoàn tác dữ liệu chưa lưu.");
  }

  async function saveSettings(e) {
    if (e) e.preventDefault();

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

      const updatedData = res.data.data;
      setData(updatedData);

      if (updatedData && updatedData.profile && typeof updateUser === "function") {
        updateUser({
          ...user,
          FullName: updatedData.profile.FullName || user?.FullName,
        });
      }
      
      // Save local preferences
      localStorage.setItem("rc_lang", language);
      localStorage.setItem("rc_tz", timezone);
      localStorage.setItem("rc_date_fmt", dateFormat);
      localStorage.setItem("rc_time_fmt", timeFormat);
      localStorage.setItem("rc_theme", theme);
      localStorage.setItem("rc_2fa", String(twoFA));
      
      localStorage.setItem("rc_notif_email", String(notifEmail));
      localStorage.setItem("rc_notif_sms", String(notifSMS));
      localStorage.setItem("rc_notif_sys", String(notifSystem));
      localStorage.setItem("rc_notif_appt", String(notifAppointment));

      setMessage("Cập nhật thông tin hệ thống và tùy chọn cá nhân thành công!");
    } catch (err) {
      setError(err.response?.data?.message || "Không lưu được thay đổi cấu hình");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp hình ảnh hợp lệ (jpg, png, webp...).");
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

      const updatedData = res.data.data;
      setData(updatedData);

      if (updatedData && updatedData.profile && typeof updateUser === "function") {
        updateUser({
          ...user,
          AvatarUrl: updatedData.profile.AvatarUrl || user?.AvatarUrl,
        });
      }
      setMessage("Cập nhật ảnh đại diện thành công!");
    } catch (err) {
      setError(err.response?.data?.message || "Không tải lên được ảnh đại diện mới");
    } finally {
      setUploading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirmPw) {
      setPwErr("Mật khẩu mới không trùng khớp.");
      return;
    }
    try {
      setPwSaving(true);
      setPwErr("");
      setPwMsg("");
      await axiosClient.put("/auth/change-password", {
        oldPassword: pwForm.oldPw,
        newPassword: pwForm.newPw,
      });
      setPwMsg("Thay đổi mật khẩu đăng nhập thành công!");
      setPwForm({ oldPw: "", newPw: "", confirmPw: "" });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      setPwErr(err.response?.data?.message || "Mật khẩu cũ không chính xác.");
    } finally {
      setPwSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const profile = data?.profile || {};

  return (
    <ReceptionistLayout>
      <div id="rc-settings-container">
        {/* Scoped design CSS matching the layout mockup exactly */}
        <style>{`
          #rc-settings-container {
            font-family: var(--font-body), sans-serif;
            color: var(--text);
            padding: 24px 12px;
            min-height: 100vh;
            position: relative;
          }

          .settings-header {
            margin-bottom: 28px;
            position: relative;
          }

          .settings-header h1 {
            font-family: var(--font-heading), Georgia, serif;
            font-size: 2.15rem;
            font-weight: 800;
            color: var(--text);
            margin: 0 0 6px 0;
          }

          .settings-header p {
            color: var(--muted);
            font-size: 0.9rem;
            margin: 0;
          }

          /* Grid Layout matching mockup */
          .settings-grid {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 24px;
            align-items: start;
            margin-bottom: 24px;
          }

          .settings-card {
            background: #FFFFFF;
            border: 1px solid #EBE4D8;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(139, 110, 82, 0.02);
          }

          .card-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: #2D2013;
            margin: 0 0 20px 0;
            border-bottom: 1px solid #F3EDE3;
            padding-bottom: 10px;
          }

          /* Profile info block */
          .profile-info-layout {
            display: flex;
            gap: 24px;
          }

          .avatar-upload-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 140px;
            flex-shrink: 0;
          }

          .avatar-wrapper {
            position: relative;
            width: 110px;
            height: 110px;
            margin-bottom: 14px;
          }

          .avatar-img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid #FAF6F0;
            box-shadow: 0 4px 14px rgba(139, 110, 82, 0.12);
          }

          .camera-badge {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 32px;
            height: 32px;
            background: #7A5E44;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: all 0.2s;
            font-size: 0.9rem;
          }

          .camera-badge:hover {
            transform: scale(1.1);
            background: #5C4631;
          }

          .avatar-help-text {
            font-size: 0.7rem;
            color: #8C7D6C;
            text-align: center;
            line-height: 1.35;
          }

          .avatar-help-text b {
            display: block;
            font-size: 0.75rem;
            color: #2D2013;
            margin-bottom: 2px;
          }

          .form-inputs-col {
            flex-grow: 1;
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .form-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .form-field label {
            font-size: 0.75rem;
            font-weight: 700;
            color: #4A3E30;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .form-field input,
          .form-field textarea,
          .form-field select {
            font-family: inherit;
            font-size: 0.85rem;
            padding: 10px 14px;
            border-radius: 10px;
            border: 1px solid #DED7CB;
            background: #FFFFFF;
            color: #2D2013;
            outline: none;
            transition: all 0.2s;
          }

          .form-field input:focus,
          .form-field textarea:focus,
          .form-field select:focus {
            border-color: #7A5E44;
            box-shadow: 0 0 0 3px rgba(122, 94, 68, 0.1);
          }

          .form-field input:disabled {
            background: #FAF8F5;
            color: #8C7D6C;
            cursor: not-allowed;
            border-color: #E6DFD5;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 10px;
          }

          .btn-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 20px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            text-decoration: none;
          }

          .btn-save {
            background: #7A5E44;
            color: white;
            box-shadow: 0 4px 12px rgba(122, 94, 68, 0.15);
          }

          .btn-save:hover {
            background: #5C4631;
            transform: translateY(-1px);
          }

          .btn-undo {
            background: white;
            border: 1px solid #7A5E44;
            color: #7A5E44;
          }

          .btn-undo:hover {
            background: #FAF6F0;
            transform: translateY(-1px);
          }

          /* Quick actions lists */
          .settings-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: #FAF8F5;
            border: 1px solid #F0ECE6;
            border-radius: 14px;
            text-decoration: none;
            transition: all 0.2s;
            cursor: pointer;
          }

          .list-item-hoverable:hover {
            background: #F3EDE3;
            transform: translateX(4px);
          }

          .list-item-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .icon-wrapper {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #F0ECE6;
            color: #7A5E44;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.05rem;
            flex-shrink: 0;
          }

          .item-info b {
            display: block;
            font-size: 0.8rem;
            color: #2D2013;
            margin-bottom: 2px;
          }

          .item-info span {
            font-size: 0.7rem;
            color: #7D6B58;
          }

          .arrow-right {
            color: #A89A85;
            font-size: 0.8rem;
          }

          /* Preferences layouts */
          .pref-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
          }

          .theme-selector {
            display: flex;
            gap: 10px;
            margin-top: 10px;
          }

          .theme-card {
            flex: 1;
            background: #FAF8F5;
            border: 1px solid #F0ECE6;
            border-radius: 12px;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            position: relative;
          }

          .theme-card:hover {
            background: #F3EDE3;
            border-color: #DED7CB;
          }

          .theme-card-selected {
            background: #FFFFFF;
            border-color: #7A5E44;
            box-shadow: 0 0 0 1px #7A5E44;
          }

          .theme-card-selected::after {
            content: "✓";
            position: absolute;
            top: 4px;
            right: 8px;
            color: #7A5E44;
            font-size: 0.75rem;
            font-weight: bold;
          }

          .theme-card span {
            font-size: 0.7rem;
            font-weight: 700;
            color: #2D2013;
          }

          .theme-icon {
            font-size: 1.15rem;
          }

          /* Toggle switch button components */
          .switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
          }

          .switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }

          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #E6DFD5;
            transition: .3s;
            border-radius: 24px;
          }

          .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
          }

          input:checked + .slider {
            background-color: #7A5E44;
          }

          input:checked + .slider:before {
            transform: translateX(20px);
          }

          /* Notification bottom row */
          .notif-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-top: 10px;
          }

          .notif-box {
            background: #FFFFFF;
            border: 1px solid #EBE4D8;
            border-radius: 16px;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .notif-info b {
            display: block;
            font-size: 0.8rem;
            color: #2D2013;
            margin-bottom: 2px;
          }

          .notif-info span {
            font-size: 0.7rem;
            color: #7D6B58;
          }

          .btn-security-action {
            padding: 6px 12px;
            background: white;
            border: 1px solid #7A5E44;
            color: #7A5E44;
            font-weight: 700;
            font-size: 0.75rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-security-action:hover {
            background: #FAF6F0;
          }

          /* Password Modal styling */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .modal-content {
            background: white;
            border-radius: 20px;
            padding: 24px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }

          /* Alert notification blocks */
          .rc-alert {
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .rc-alert-success {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #a7f3d0;
          }

          .rc-alert-error {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
          }

          /* Footer standard styling */
          .settings-footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #EBE4D8;
          }

          .footer-secure {
            font-size: 0.8rem;
            font-weight: 700;
            color: #7A5E44;
            margin-bottom: 4px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          .footer-copyright {
            font-size: 0.7rem;
            color: #8C7D6C;
          }

          .rc-empty {
            font-size: 0.85rem;
            color: #9ca3af;
            text-align: center;
            padding: 30px;
          }
        `}</style>

        {/* Header matching mockup */}
        <header className="settings-header">
          <h1>Cài đặt hệ thống</h1>
          <p>Quản lý thông tin tài khoản và các tùy chọn cá nhân của bạn.</p>
        </header>

        {error && <div className="rc-alert rc-alert-error"><span>⚠️</span> {error}</div>}
        {message && <div className="rc-alert rc-alert-success"><span>✓</span> {message}</div>}

        {loading && <div className="rc-empty">Đang tải thông tin cấu hình...</div>}

        {!loading && (
          <>
            <div className="settings-grid">
              {/* TOP LEFT BOX: "Thông tin hồ sơ" */}
              <section className="settings-card">
                <h3 className="card-title">Thông tin hồ sơ</h3>
                <div className="profile-info-layout">
                  {/* Left inside: Avatar Upload */}
                  <div className="avatar-upload-col">
                    <div className="avatar-wrapper">
                      <img
                        className="avatar-img"
                        src={avatar(profile.AvatarUrl || profile.ImageUrl)}
                        alt={profile.FullName || "Lễ tân"}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                      <label className="camera-badge">
                        📷
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          disabled={uploading}
                          onChange={(e) => uploadAvatar(e.target.files?.[0])}
                        />
                      </label>
                    </div>
                    <div className="avatar-help-text">
                      <b>Đổi ảnh đại diện</b>
                      <span>JPG, PNG tối đa 5MB</span>
                    </div>
                  </div>

                  {/* Right inside: Form inputs */}
                  <div className="form-inputs-col">
                    <div className="form-field">
                      <label>Họ và tên *</label>
                      <input
                        value={form.fullName}
                        placeholder="Nhập họ và tên..."
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Email</label>
                      <input value={form.email} disabled title="Địa chỉ email tài khoản không thể sửa đổi" />
                    </div>

                    <div className="form-field">
                      <label>Số điện thoại liên hệ</label>
                      <input
                        value={form.phone}
                        placeholder="Số điện thoại..."
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Vị trí / Chức vụ</label>
                      <input
                        value={form.position}
                        placeholder="Chức danh công tác..."
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                      />
                    </div>

                    {/* Actions Inside Profile Info */}
                    <div className="form-actions">
                      <button className="btn-action btn-save" onClick={saveSettings} disabled={saving}>
                        {saving ? "Đang lưu..." : "✓ Lưu thay đổi"}
                      </button>
                      <button className="btn-action btn-undo" type="button" onClick={handleUndo}>
                        ↺ Hoàn tác
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* TOP RIGHT BOX: "Thao tác nhanh" */}
              <section className="settings-card">
                <h3 className="card-title">Thao tác nhanh</h3>
                <div className="settings-list">
                  <div className="list-item list-item-hoverable" onClick={() => setShowPasswordModal(true)}>
                    <div className="list-item-left">
                      <div className="icon-wrapper">🔑</div>
                      <div className="item-info">
                        <b>Đổi mật khẩu</b>
                        <span>Cập nhật mật khẩu đăng nhập</span>
                      </div>
                    </div>
                    <span className="arrow-right">›</span>
                  </div>

                  <div className="list-item list-item-hoverable">
                    <div className="list-item-left">
                      <div className="icon-wrapper">🔔</div>
                      <div className="item-info">
                        <b>Cài đặt thông báo</b>
                        <span>Quản lý thông báo qua email, SMS</span>
                      </div>
                    </div>
                    <span className="arrow-right">›</span>
                  </div>

                  <div className="list-item list-item-hoverable">
                    <div className="list-item-left">
                      <div className="icon-wrapper">📅</div>
                      <div className="item-info">
                        <b>Đồng bộ lịch</b>
                        <span>Kết nối với Google Calendar</span>
                      </div>
                    </div>
                    <span className="arrow-right">›</span>
                  </div>

                  <div className="list-item list-item-hoverable">
                    <div className="list-item-left">
                      <div className="icon-wrapper">🌐</div>
                      <div className="item-info">
                        <b>Ngôn ngữ & khu vực</b>
                        <span>Cài đặt ngôn ngữ và múi giờ</span>
                      </div>
                    </div>
                    <span className="arrow-right">›</span>
                  </div>
                </div>
              </section>

              {/* MIDDLE LEFT BOX: "Tùy chọn cá nhân" */}
              <section className="settings-card">
                <h3 className="card-title">Tùy chọn cá nhân</h3>
                <div className="form-field">
                  <label>Giới thiệu bản thân / Tiểu sử</label>
                  <textarea
                    value={form.bio}
                    placeholder="Viết một mô tả ngắn về bản thân..."
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    maxLength={500}
                    rows={3}
                  />
                </div>

                <div className="pref-grid">
                  <div className="form-field">
                    <label>Ngôn ngữ hiển thị</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="vi">🌐 Tiếng Việt</option>
                      <option value="en">🌐 English</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Múi giờ</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option value="gmt_7">⏰ (GMT+07:00) Bangkok, Hanoi</option>
                      <option value="gmt_8">⏰ (GMT+08:00) Singapore, Beijing</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Định dạng ngày</label>
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                      <option value="dd_mm_yyyy">📅 DD/MM/YYYY</option>
                      <option value="mm_dd_yyyy">📅 MM/DD/YYYY</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Định dạng giờ</label>
                    <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>
                      <option value="24h">24 giờ (14:30)</option>
                      <option value="12h">12 giờ (02:30 PM)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "14px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4A3E30", textTransform: "uppercase", letterSpacing: "0.02em" }}>Chủ đề giao diện</label>
                  <div className="theme-selector">
                    <div
                      className={`theme-card ${theme === "light" ? "theme-card-selected" : ""}`}
                      onClick={() => setTheme("light")}
                    >
                      <span className="theme-icon">☀️</span>
                      <span>Giao diện sáng</span>
                    </div>

                    <div
                      className={`theme-card ${theme === "dark" ? "theme-card-selected" : ""}`}
                      onClick={() => setTheme("dark")}
                    >
                      <span className="theme-icon">🌙</span>
                      <span>Giao diện tối</span>
                    </div>

                    <div
                      className={`theme-card ${theme === "system" ? "theme-card-selected" : ""}`}
                      onClick={() => setTheme("system")}
                    >
                      <span className="theme-icon">🖥️</span>
                      <span>Theo hệ thống</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* MIDDLE RIGHT BOX: "Bảo mật tài khoản" */}
              <section className="settings-card">
                <h3 className="card-title">Bảo mật tài khoản</h3>
                <div className="settings-list">
                  <div className="list-item">
                    <div className="list-item-left">
                      <div className="icon-wrapper">🔒</div>
                      <div className="item-info">
                        <b>Mật khẩu</b>
                        <span>Cập nhật lần cuối: 15/05/2024</span>
                      </div>
                    </div>
                    <button className="btn-security-action" onClick={() => setShowPasswordModal(true)}>
                      Đổi mật khẩu
                    </button>
                  </div>

                  <div className="list-item">
                    <div className="list-item-left">
                      <div className="icon-wrapper">🛡️</div>
                      <div className="item-info">
                        <b>Xác thực 2 lớp (2FA)</b>
                        <span>Tăng cường bảo mật cho tài khoản</span>
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={twoFA}
                        onChange={(e) => setTwoFA(e.target.checked)}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="list-item list-item-hoverable">
                    <div className="list-item-left">
                      <div className="icon-wrapper">💻</div>
                      <div className="item-info">
                        <b>Thiết bị đăng nhập</b>
                        <span>Quản lý các thiết bị đã đăng nhập</span>
                      </div>
                    </div>
                    <span className="arrow-right">›</span>
                  </div>
                </div>
              </section>
            </div>

            {/* BOTTOM CARD: "Cài đặt thông báo" */}
            <section className="settings-card" style={{ marginBottom: "30px" }}>
              <h3 className="card-title">Cài đặt thông báo</h3>
              <div className="notif-row">
                <div className="notif-box">
                  <div className="notif-info">
                    <b>Email</b>
                    <span>Nhận thông báo qua email</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notifEmail}
                      onChange={(e) => setNotifEmail(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="notif-box">
                  <div className="notif-info">
                    <b>SMS</b>
                    <span>Nhận thông báo qua SMS</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notifSMS}
                      onChange={(e) => setNotifSMS(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="notif-box">
                  <div className="notif-info">
                    <b>Thông báo hệ thống</b>
                    <span>Hiển thị thông báo trên hệ thống</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notifSystem}
                      onChange={(e) => setNotifSystem(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="notif-box">
                  <div className="notif-info">
                    <b>Thông báo lịch hẹn</b>
                    <span>Nhắc lịch hẹn sắp tới</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={notifAppointment}
                      onChange={(e) => setNotifAppointment(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="settings-footer">
              <div className="footer-secure">
                <span>🛡️</span> Dữ liệu của bạn được bảo mật tuyệt đối
              </div>
              <div className="footer-copyright">
                © 2024 Beauty Salon. All rights reserved.
              </div>
            </footer>
          </>
        )}

        {/* Change Password Inline Modal */}
        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 className="card-title" style={{ borderBottom: "none", marginBottom: "14px" }}>Thay đổi mật khẩu đăng nhập</h3>
              
              {pwErr && <div className="rc-alert rc-alert-error" style={{ padding: "8px 12px", fontSize: "0.8rem", marginBottom: "12px" }}>{pwErr}</div>}
              {pwMsg && <div className="rc-alert rc-alert-success" style={{ padding: "8px 12px", fontSize: "0.8rem", marginBottom: "12px" }}>{pwMsg}</div>}

              <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-field">
                  <label>Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    required
                    value={pwForm.oldPw}
                    onChange={(e) => setPwForm({ ...pwForm, oldPw: e.target.value })}
                    placeholder="Nhập mật khẩu cũ..."
                  />
                </div>

                <div className="form-field">
                  <label>Mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    value={pwForm.newPw}
                    onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự..."
                  />
                </div>

                <div className="form-field">
                  <label>Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    value={pwForm.confirmPw}
                    onChange={(e) => setPwForm({ ...pwForm, confirmPw: e.target.value })}
                    placeholder="Nhập lại mật khẩu mới..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button className="btn-action btn-undo" type="button" onClick={() => setShowPasswordModal(false)}>
                    Hủy bỏ
                  </button>
                  <button className="btn-action btn-save" type="submit" disabled={pwSaving}>
                    {pwSaving ? "Đang lưu..." : "Xác nhận"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
