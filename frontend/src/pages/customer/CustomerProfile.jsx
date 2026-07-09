import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function CustomerProfile() {
  const { login, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  // Tab control: 'profile' or 'password'
  const [activeTab, setActiveTab] = useState(tabParam === 'password' ? 'password' : 'profile');

  // Sync activeTab when query param tab changes dynamically
  useEffect(() => {
    if (tabParam === 'password') {
      setActiveTab('password');
    } else {
      setActiveTab('profile');
    }
  }, [tabParam]);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    loyaltyPoints: 0,
    membershipLevel: 'Normal'
  });

  // Password change states
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const formatDate = (value) => value ? value.substring(0, 10) : '';

  const mapProfileToForm = (profile) => ({
    fullName: profile.FullName || '',
    email: profile.Email || '',
    phone: profile.Phone || '',
    avatarUrl: profile.AvatarUrl || '',
    gender: profile.Gender || '',
    dateOfBirth: formatDate(profile.DateOfBirth),
    address: profile.Address || '',
    loyaltyPoints: profile.LoyaltyPoints || 0,
    membershipLevel: profile.MembershipLevel || 'Normal'
  });

  const syncAuthUser = (profile) => {
    const newUser = {
      UserId: profile.UserId,
      FullName: profile.FullName,
      Email: profile.Email,
      Phone: profile.Phone,
      AvatarUrl: profile.AvatarUrl,
      RoleName: profile.RoleName,
      RoleId: profile.RoleId
    };

    const token = localStorage.getItem('token');
    if (token) login({ token, user: newUser });
    else updateUser(newUser);
  };

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setError('');
        const res = await axiosClient.get('/customers/me/profile');
        const profile = res.data.data || res.data;
        setForm(mapProfileToForm(profile));
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải hồ sơ cá nhân');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      setMessage('');
      const data = new FormData();
      data.append('avatar', file);
      const res = await axiosClient.put('/customers/me/avatar', data);
      const profile = res.data.data || res.data;
      setForm(mapProfileToForm(profile));
      syncAuthUser(profile);
      setMessage('Cập nhật ảnh đại diện thành công');
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật ảnh đại diện thất bại');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const res = await axiosClient.put('/customers/me/profile', {
        fullName: form.fullName,
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || null,
        address: form.address
      });

      const updatedProfile = res.data.data || res.data;
      setForm(mapProfileToForm(updatedProfile));
      syncAuthUser(updatedProfile);
      setMessage('Cập nhật hồ sơ thành công');
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật hồ sơ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await axiosClient.put('/auth/change-password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage(res.data.message || 'Đổi mật khẩu thành công');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setChangingPassword(false);
    }
  };

  const avatarSrc = form.avatarUrl ? resolveFileUrl(form.avatarUrl) : '';



  return (
    <CustomerLayout>
      <div className="prof-page">
        {/* Ambient background glow blooms */}
        <div className="prof-ambient-bg">
          <div className="prof-blob prof-blob-1"></div>
          <div className="prof-blob prof-blob-2"></div>
        </div>

        {/* Section Title */}
        <div className="section-head" style={{ border: 'none', padding: 0, margin: 0, position: 'relative', zIndex: 1 }}>
          <div>
            <div className="eyebrow">Quản lý tài khoản</div>
            <h2 className="section-title">Hồ sơ cá nhân</h2>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-card" style={{ position: 'relative', zIndex: 1, padding: '36px', textAlign: 'center' }}>
            ⏳ Đang tải thông tin hồ sơ cá nhân...
          </div>
        ) : (
          <div className="prof-grid">
            {/* Left Panel: VIP Card, Loyalty points and tab selectors */}
            <div className="prof-left-panel">
              <div className={`premium-member-card ${String(form.membershipLevel || "normal").toLowerCase()}`} style={{ width: '100%', maxWidth: '380px', height: '230px', margin: '0 auto 20px' }}>
                <div className="card-glass-shine" />
                <div className="card-chip" />
                <div className="card-header">
                  <span className="card-brand">🌟 PREMIUM MEMBER</span>
                  <span className="card-vip-badge">{form.membershipLevel || "MEMBER"}</span>
                </div>

                <div className="card-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '-10px 0' }}>
                  <label className="prof-vip-avatar-container" style={{ margin: 0, position: 'relative', zIndex: 3 }}>
                    <div className="prof-vip-avatar">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="Avatar" />
                      ) : (
                        form.fullName ? form.fullName.charAt(0).toUpperCase() : 'K'
                      )}
                    </div>
                    <div className="prof-avatar-overlay">
                      {uploading ? '⏳' : '📸'}
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>

                <div className="card-footer">
                  <div className="card-holder">
                    <span>Chủ thẻ</span>
                    <strong>{form.fullName || "QUÝ KHÁCH"}</strong>
                  </div>
                  <div className="card-discount">
                    <span>Điểm tích lũy</span>
                    <strong>{form.loyaltyPoints || 0} PTS</strong>
                  </div>
                </div>
              </div>

              {/* Loyalty points info card */}
              <div className="prof-points-card">
                <div className="prof-points-left">
                  <span className="prof-points-icon">👑</span>
                  <div className="prof-points-info">
                    <span className="prof-points-label">Điểm tích lũy</span>
                    <span className="prof-points-value">{form.loyaltyPoints} PTS</span>
                  </div>
                </div>
                {form.membershipLevel !== 'Normal' && (
                  <span className="prof-discount-tag">VIP Member</span>
                )}
              </div>

              {/* Tab Navigation Menu */}
              <div className="prof-nav-menu">
                <button
                  type="button"
                  className={`prof-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('profile');
                    setMessage('');
                    setError('');
                  }}
                >
                  <span>👤</span> Hồ sơ của tôi
                </button>
                <button
                  type="button"
                  className={`prof-nav-btn ${activeTab === 'password' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('password');
                    setPasswordMessage('');
                    setPasswordError('');
                  }}
                >
                  <span>🔒</span> Bảo mật tài khoản
                </button>
              </div>
            </div>

            {/* Right Panel Workspace content */}
            {activeTab === 'profile' ? (
              <div className="prof-right-panel">
                <div className="prof-section-header">
                  <h2>Thông tin cá nhân</h2>
                  <p>Quản lý thông tin cá nhân của bạn để nhận dịch vụ chăm sóc tốt nhất từ chúng tôi.</p>
                </div>

                <form className="prof-form" onSubmit={handleSubmit}>
                  {message && <div className="prof-alert prof-alert-success">✨ {message}</div>}
                  {error && <div className="prof-alert prof-alert-error">⚠️ {error}</div>}

                  <div className="prof-form-row">
                    <div className="prof-form-group">
                      <label>Họ và tên</label>
                      <input
                        className="prof-input"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleChange}
                        placeholder="Nhập họ và tên của bạn"
                        required
                      />
                    </div>
                    <div className="prof-form-group">
                      <label>Địa chỉ email</label>
                      <input
                        className="prof-input"
                        name="email"
                        value={form.email}
                        disabled
                        placeholder="chua_co_email@domain.com"
                      />
                    </div>
                  </div>

                  <div className="prof-form-row">
                    <div className="prof-form-group">
                      <label>Số điện thoại</label>
                      <input
                        className="prof-input"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="Nhập số điện thoại liên lạc"
                      />
                    </div>
                    <div className="prof-form-group">
                      <label>Giới tính</label>
                      <select
                        className="prof-select"
                        name="gender"
                        value={form.gender}
                        onChange={handleChange}
                      >
                        <option value="">Chọn giới tính</option>
                        <option value="Male">Nam</option>
                        <option value="Female">Nữ</option>
                        <option value="Other">Khác</option>
                      </select>
                    </div>
                  </div>

                  <div className="prof-form-row">
                    <div className="prof-form-group">
                      <label>Ngày sinh</label>
                      <input
                        type="date"
                        className="prof-input"
                        name="dateOfBirth"
                        value={form.dateOfBirth}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="prof-form-group">
                      <label>Địa chỉ thường trú</label>
                      <input
                        className="prof-input"
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        placeholder="Nhập địa chỉ nhà riêng của bạn"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="prof-submit-btn"
                    disabled={saving}
                  >
                    {saving ? '⏳ Đang lưu...' : '💾 Lưu thông tin'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="prof-right-panel">
                <div className="prof-section-header">
                  <h2>Bảo mật tài khoản</h2>
                  <p>Cập nhật mật khẩu thường xuyên để bảo vệ an toàn thông tin tài khoản.</p>
                </div>

                <form className="prof-form" onSubmit={handlePasswordSubmit}>
                  {passwordMessage && <div className="prof-alert prof-alert-success">✨ {passwordMessage}</div>}
                  {passwordError && <div className="prof-alert prof-alert-error">⚠️ {passwordError}</div>}

                  <div className="prof-form-group">
                    <label>Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      className="prof-input"
                      value={passwordForm.oldPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      placeholder="Nhập mật khẩu hiện tại đang sử dụng"
                      required
                    />
                  </div>

                  <div className="prof-form-row">
                    <div className="prof-form-group">
                      <label>Mật khẩu mới</label>
                      <input
                        type="password"
                        className="prof-input"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        required
                      />
                    </div>
                    <div className="prof-form-group">
                      <label>Xác nhận mật khẩu mới</label>
                      <input
                        type="password"
                        className="prof-input"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Nhập lại mật khẩu mới để xác nhận"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="prof-submit-btn"
                    disabled={changingPassword}
                  >
                    {changingPassword ? '⏳ Đang lưu...' : '🔑 Đổi mật khẩu'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
