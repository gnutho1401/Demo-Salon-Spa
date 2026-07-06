import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const STATUS_LABELS = {
  ACTIVE: { text: "Đang hoạt động", color: "#22c55e", bg: "#f0fdf4" },
  FROZEN: { text: "Đang đóng băng", color: "#3b82f6", bg: "#eff6ff" },
  EXPIRED: { text: "Đã hết hạn", color: "#ef4444", bg: "#fef2f2" },
  USED_UP: { text: "Đã hoàn thành", color: "#8b5cf6", bg: "#f5f3ff" },
  COMPLETED: { text: "Đã hoàn thành", color: "#8b5cf6", bg: "#f5f3ff" },
  PENDING_PAYMENT: { text: "Chờ thanh toán", color: "#f59e0b", bg: "#fffbeb" },
  CANCELLED: { text: "Đã hủy", color: "#6b7280", bg: "#f9fafb" },
};

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || { text: status, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: info.color,
        backgroundColor: info.bg,
        border: `1px solid ${info.color}20`,
      }}
    >
      {info.text}
    </span>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleDateString("vi-VN");
}

function formatDateTime(dateValue, timeValue) {
  const dateText = dateValue
    ? new Date(dateValue).toLocaleDateString("vi-VN")
    : "Không rõ ngày";
  
  let timeText = "";
  if (timeValue) {
    if (timeValue instanceof Date || (typeof timeValue === "object" && typeof timeValue.getHours === "function")) {
      const hours = String(timeValue.getHours()).padStart(2, "0");
      const minutes = String(timeValue.getMinutes()).padStart(2, "0");
      timeText = `${hours}:${minutes}`;
    } else if (typeof timeValue === "object") {
      const ms = timeValue.ms !== undefined ? timeValue.ms : timeValue.milliseconds;
      if (typeof ms === "number") {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        timeText = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    } else if (String(timeValue).includes("T")) {
      const parts = String(timeValue).split("T")[1];
      if (parts) timeText = parts.slice(0, 5);
    } else {
      const str = String(timeValue);
      const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
      const match = str.match(timeRegex);
      if (match) {
        timeText = `${match[1]}:${match[2]}`;
      } else {
        timeText = str.slice(0, 5);
      }
    }
  }
  return `${dateText}${timeText ? ` - ${timeText}` : ""}`;
}

function daysLeft(endDate) {
  if (!endDate) return null;
  const diff = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

/* ===== MODAL COMPONENT ===== */
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="pkg-modal-overlay" onClick={onClose}>
      <div className="pkg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pkg-modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="pkg-modal-close">
            ✕
          </button>
        </div>
        <div className="pkg-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ===== PACKAGE DETAIL PANEL ===== */
function PackageDetailPanel({ pkg, onClose, onRefresh }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [usages, setUsages] = useState({ data: [], pagination: {} });
  const [usagePage, setUsagePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Modal states
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({ phoneOrEmail: "", relationship: "" });
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const loadDetail = async () => {
    setLoading(true);
    try {
      const [detailRes, usageRes] = await Promise.all([
        axiosClient.get(`/packages/my/${pkg.CustomerPackageId}/detail`),
        axiosClient.get(`/packages/my/${pkg.CustomerPackageId}/usages-paginated?page=${usagePage}&limit=5`),
      ]);
      setDetail(detailRes.data.data || detailRes.data);
      setUsages(usageRes.data.data || usageRes.data);
    } catch {
      setMessage("Không tải được chi tiết liệu trình");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [pkg.CustomerPackageId, usagePage]);



  const selectMember = (m) => {
    setSelectedMember(m);
    setSearchResults([]);
    setSearchError("");
    setMemberForm((f) => ({ ...f, phoneOrEmail: "" }));
  };

  useEffect(() => {
    if (selectedMember) {
      setSearchResults([]);
      return;
    }

    const query = memberForm.phoneOrEmail ? memberForm.phoneOrEmail.trim() : "";
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await axiosClient.get(`/packages/find-member?q=${encodeURIComponent(query)}`);
        const data = res.data.data || res.data || [];
        setSearchResults(Array.isArray(data) ? data : (data ? [data] : []));
        if (Array.isArray(data) && data.length === 0) {
          setSearchError("Không tìm thấy tài khoản khách hàng phù hợp");
        }
      } catch (err) {
        setSearchError(err.response?.data?.message || "Lỗi tìm kiếm tài khoản");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [memberForm.phoneOrEmail, selectedMember]);

  const handleAddMember = async () => {
    if (!selectedMember) return;
    setActionLoading(true);
    try {
      await axiosClient.post(`/packages/my/${pkg.CustomerPackageId}/members`, {
        phoneOrEmail: selectedMember.Email || selectedMember.Phone,
        relationship: memberForm.relationship
      });
      setMessage("✅ Thêm thành viên gia đình thành công!");
      setShowMemberModal(false);
      setMemberForm({ phoneOrEmail: "", relationship: "" });
      setSelectedMember(null);
      setSearchResults([]);
      setSearchError("");
      loadDetail();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Lỗi thêm thành viên"));
    }
    setActionLoading(false);
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Hủy thêm thành viên này khỏi liệu trình?")) return;
    try {
      await axiosClient.delete(`/packages/my/${pkg.CustomerPackageId}/members/${memberId}`);
      setMessage("✅ Đã hủy thêm thành viên");
      loadDetail();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Lỗi hủy thêm thành viên"));
    }
  };

  const handleRepay = async (customerPackageId) => {
    setActionLoading(true);
    try {
      setMessage("");
      const res = await axiosClient.post(`/packages/my/${customerPackageId}/repay`);
      const data = res.data.data || res.data;
      if (data && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Không nhận được URL thanh toán");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi tạo link thanh toán");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="pkg-detail-panel">
        <div className="pkg-detail-header">
          <h2>Chi tiết liệu trình</h2>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>
        <p className="muted" style={{ textAlign: "center", padding: 40 }}>Đang tải...</p>
      </div>
    );
  }

  const d = detail || pkg;
  const total = Number(d.TotalSessions || 0) || 1;
  const used = Number(d.UsedSessions || 0);
  const left = Number(d.RemainingSessions || 0);
  const percent = Math.max(0, Math.min(100, (used / total) * 100));
  const remaining = daysLeft(d.EndDate);

  return (
    <div className="pkg-detail-panel">
      <div className="pkg-detail-header">
        <div className="pkg-detail-header-info">
          <h2>Chi tiết Combo & Liệu trình</h2>
          <p className="muted">Theo dõi tiến trình sử dụng dịch vụ và quản lý chia sẻ người thân</p>
        </div>
        <button onClick={onClose} className="pkg-back-btn">
          ← Quay lại danh sách
        </button>
      </div>

      {message && (
        <div className={message.includes("✅") ? "alert success" : "alert error"} style={{ margin: "12px 0" }}>
          {message}
          <button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="pkg-detail-grid">
        {/* === COLUMN LEFT: MAIN CONTENT === */}
        <div className="pkg-detail-left">
          
          {/* OVERVIEW CARD */}
          <div className="pkg-overview-card">
            <div className="pkg-overview-banner">
              <img src={resolveFileUrl(d.ImageUrl) || "/vite.svg"} alt={d.PackageName} />
              <div className="pkg-overview-banner-overlay">
                <span className="pkg-overview-category">{d.CategoryName}</span>
                <h3 className="pkg-overview-title">{d.PackageName}</h3>
              </div>
            </div>
            <div className="pkg-overview-content">
              <p className="pkg-overview-desc">{d.Description || "Không có mô tả chi tiết cho liệu trình này."}</p>
              <div className="pkg-overview-meta-list">
                <div className="pkg-overview-meta-item">
                  <span className="pkg-overview-meta-icon">📅</span>
                  <div className="pkg-overview-meta-text">
                    <small>Thời hạn sử dụng</small>
                    <span>{formatDate(d.StartDate)} - {formatDate(d.EndDate)}</span>
                  </div>
                </div>
                <div className="pkg-overview-meta-item">
                  <span className="pkg-overview-meta-icon">💳</span>
                  <div className="pkg-overview-meta-text">
                    <small>Giá mua gói</small>
                    <span>{money(d.PurchasePrice || d.SalePrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SERVICES LIST */}
          <div className="pkg-section">
            <h3>📋 Dịch vụ & Hạn mức chi tiết</h3>
            {detail?.Services && detail.Services.length > 0 ? (
              <div className="pkg-services-list">
                {detail.Services.map((s) => {
                  const sUsed = Number(s.UsedSessions || 0);
                  const sMax = Number(s.MaxSessions || 0);
                  const sLeft = Math.max(0, sMax - sUsed);
                  const sPercent = sMax > 0 ? (sUsed / sMax) * 100 : 0;
                  const isExhausted = sLeft === 0;

                  return (
                    <div
                      key={s.ServiceId}
                      className="pkg-service-card"
                      style={{
                        opacity: isExhausted ? 0.55 : 1,
                        filter: isExhausted ? "grayscale(100%)" : "none",
                      }}
                    >
                      <div className="pkg-service-img-wrap">
                        <img
                          className="pkg-service-img"
                          src={resolveFileUrl(s.ImageUrl) || "/vite.svg"}
                          alt={s.ServiceName}
                        />
                      </div>
                      <div className="pkg-service-info">
                        <div className="pkg-service-header">
                          <h4 className="pkg-service-name">{s.ServiceName}</h4>
                          <span className="pkg-service-badge">
                            Còn {sLeft} / {sMax} buổi
                          </span>
                        </div>
                        <p className="pkg-service-desc">{s.Description || "Chưa có mô tả dịch vụ."}</p>
                        
                        <div className="pkg-service-meta">
                          <span className="pkg-service-duration">
                            🕘 {s.DurationMinutes || 60} phút
                          </span>
                          <span>• Đã dùng {sUsed} buổi</span>
                        </div>

                        <div className="pkg-service-progress-container">
                          <div className="pkg-service-progress-bar">
                            <div
                              className="pkg-service-progress-fill"
                              style={{ width: `${sPercent}%` }}
                            />
                          </div>
                        </div>

                        {s.ActiveBookings > 0 && (
                          <div style={{
                            margin: '8px 0',
                            padding: '6px 10px',
                            backgroundColor: '#fffbeb',
                            border: '1px solid #fef3c7',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            color: '#b45309',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500',
                            lineHeight: '1.4',
                            textAlign: 'left'
                          }}>
                            <span>📅</span>
                            <span>{s.ActiveBookingDetails}</span>
                          </div>
                        )}

                        {d.Status !== "ACTIVE" ? (
                          <div
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              background: "#f1f5f9",
                              color: "#64748b",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            🔒 {d.Status === "PENDING_PAYMENT" ? "Chờ thanh toán để sử dụng" : "Không thể sử dụng"}
                          </div>
                        ) : isExhausted ? (
                          <div
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              background: "#fee2e2",
                              color: "#dc2626",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            🚫 Hết hạn mức buổi sử dụng
                          </div>
                        ) : (
                          <button
                            className="btn primary"
                            style={{
                              width: "100%",
                              padding: "8px",
                              fontSize: "12px",
                              borderRadius: "8px",
                              justifyContent: "center"
                            }}
                            onClick={() => navigate(`/customer/booking?customerPackageId=${d.CustomerPackageId}&serviceId=${s.ServiceId}`)}
                          >
                            📅 Đặt lịch nhanh dịch vụ này
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">{d.ServiceNames}</p>
            )}
          </div>

          {/* TIMELINE USAGE HISTORY */}
          <div className="pkg-section">
            <h3>📜 Lịch sử trị liệu</h3>
            {(usages.data || []).length > 0 ? (
              <>
                <div className="pkg-timeline">
                  {usages.data.map((u) => (
                    <div className="pkg-timeline-item" key={u.UsageId}>
                      <div className="pkg-timeline-badge" />
                      <div className="pkg-timeline-card">
                        <div className="pkg-timeline-details">
                          <h4 className="pkg-timeline-title">{u.ServiceName}</h4>
                          <span className="pkg-timeline-time">{formatDateTime(u.AppointmentDate, u.StartTime)}</span>
                          <div className="pkg-timeline-metadata">
                            <span className="pkg-timeline-ktv">KTV: {u.TechnicianName || "Chưa có"}</span>
                            {u.UsedByName && (
                              <span className="pkg-timeline-user">
                                Người thực hiện: {u.UsedByName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="pkg-timeline-sessions">
                          -{u.SessionsUsed || 1} buổi
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {usages.pagination?.totalPages > 1 && (
                  <div className="pkg-pagination">
                    <button disabled={usagePage <= 1} onClick={() => setUsagePage((p) => p - 1)}>
                      ← Trước
                    </button>
                    <span>
                      Trang {usagePage} / {usages.pagination.totalPages}
                    </span>
                    <button
                      disabled={usagePage >= usages.pagination.totalPages}
                      onClick={() => setUsagePage((p) => p + 1)}
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">
                Chưa có buổi nào hoàn thành. Gói dịch vụ chỉ bị trừ buổi sau khi lịch hẹn hoàn thành.
              </p>
            )}
          </div>

        </div>

        {/* === COLUMN RIGHT: SIDEBAR === */}
        <div className="pkg-detail-right">
          
          {/* GENERAL PROGRESS */}
          <div className="pkg-progress-card">
            <h3>📊 Tiến độ sử dụng chung</h3>
            <div className="pkg-progress-stats" style={{ margin: "20px 0" }}>
              <div>
                <span className="pkg-stat-number">{used}</span>
                <span className="pkg-stat-label">Đã dùng</span>
              </div>
              <div className="pkg-progress-circle">
                <svg viewBox="0 0 100 100" width="90" height="90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#eeded4" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="var(--primary, #8b5cf6)"
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${percent * 2.76} ${276 - percent * 2.76}`}
                    transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dasharray 0.5s ease-in-out" }}
                  />
                </svg>
                <span className="pkg-progress-text">{Math.round(percent)}%</span>
              </div>
              <div>
                <span className="pkg-stat-number">{left}</span>
                <span className="pkg-stat-label">Còn lại</span>
              </div>
            </div>
            <div className="pkg-info-row">
              <StatusBadge status={d.Status} />
              <span style={{ fontWeight: 600, color: remaining >= 0 ? "#16a34a" : "#dc2626" }}>
                {remaining !== null && remaining >= 0
                  ? `Còn ${remaining} ngày (${formatDate(d.EndDate)})`
                  : remaining !== null
                    ? `Đã quá hạn ${Math.abs(remaining)} ngày`
                    : "Không giới hạn"}
              </span>
            </div>
            {d.Status === "PENDING_PAYMENT" && !!d.IsOwner && (
              <button
                className="btn primary"
                style={{ width: "100%", marginTop: "16px", justifyContent: "center" }}
                onClick={() => handleRepay(d.CustomerPackageId)}
                disabled={actionLoading}
              >
                💳 {actionLoading ? "Đang xử lý..." : "Thanh toán ngay qua VNPay"}
              </button>
            )}
          </div>

          {/* QUICK BOOK BUTTON */}
          <div className="pkg-actions-bar" style={{ marginBottom: "24px" }}>
            {d.Status === "ACTIVE" && left > 0 && (
              <button
                className="btn primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => navigate(`/customer/booking?customerPackageId=${d.CustomerPackageId}`)}
              >
                📅 Đặt lịch nhanh toàn gói
              </button>
            )}
          </div>

          {/* FAMILY SHARING DETAILS & SLOTS */}
          <div className="pkg-section">
            <h3>👨‍👩‍👦 Chia sẻ gia đình ({detail?.Members?.length || 0}/2)</h3>
            <p className="muted" style={{ fontSize: "12px", margin: "-6px 0 12px 0", lineHeight: "1.4" }}>
              Chia sẻ quyền sử dụng gói dịch vụ này cho tối đa 2 thành viên trong gia đình bạn.
            </p>
            <div className="pkg-member-grid">
              {Array.from({ length: 2 }).map((_, idx) => {
                const m = detail?.Members?.[idx];
                if (m) {
                  return (
                    <div key={m.PackageMemberId} className="pkg-member-card-premium">
                      <img
                        className="pkg-member-avatar"
                        src={resolveFileUrl(m.AvatarUrl) || "/images/default-avatar.png"}
                        alt={m.FullName}
                      />
                      <div className="pkg-member-info">
                        <h5 className="pkg-member-name">{m.FullName}</h5>
                        <span className="pkg-member-rel">{m.Relationship}</span>
                        <small className="pkg-member-contact">{m.Phone || m.Email}</small>
                      </div>
                      {!!d.IsOwner && (
                        <button
                          className="pkg-member-remove-btn"
                          onClick={() => handleRemoveMember(m.PackageMemberId)}
                          title="Hủy thêm thành viên"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                } else {
                  const canAddMember = !!d.IsOwner && d.Status === "ACTIVE";
                  return canAddMember ? (
                    <div
                      key={`empty-${idx}`}
                      className="pkg-member-slot-empty"
                      onClick={() => setShowMemberModal(true)}
                    >
                      <span className="pkg-member-slot-icon">➕</span>
                      <span className="pkg-member-slot-text">Thêm người thân</span>
                    </div>
                  ) : (
                    <div key={`empty-${idx}`} className="pkg-member-slot-empty" style={{ cursor: "default" }}>
                      <span className="pkg-member-slot-icon" style={{ opacity: 0.4 }}>👤</span>
                      <span className="pkg-member-slot-text" style={{ opacity: 0.5, fontWeight: "normal" }}>
                        {d.Status === "PENDING_PAYMENT" ? "Chờ thanh toán" : "Trống"}
                      </span>
                    </div>
                  );
                }
              })}
            </div>
          </div>

        </div>
      </div>

      {/* === MODALS === */}
      <Modal
        open={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setSelectedMember(null);
          setSearchResults([]);
          setSearchError("");
          setMemberForm((f) => ({ ...f, phoneOrEmail: "" }));
        }}
        title="Thêm thành viên gia đình"
      >
        <div className="pkg-form">
          <p className="muted">
            Thành viên gia đình có thể đặt lịch sử dụng liệu trình này (tối đa 2 người). 
            Nhập Họ tên, Số điện thoại hoặc Email để chọn tài khoản gợi ý bên dưới.
          </p>
          <label style={{ position: "relative", display: "block" }}>
            Tìm kiếm người thân:
            <input
              type="text"
              value={memberForm.phoneOrEmail}
              onChange={(e) => {
                setMemberForm((f) => ({ ...f, phoneOrEmail: e.target.value }));
                if (selectedMember) {
                  setSelectedMember(null);
                }
              }}
              placeholder="Nhập tên, số điện thoại hoặc email..."
              style={{ marginTop: 4, width: "100%" }}
            />
            
            {searching && (
              <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>
                Đang tìm kiếm...
              </p>
            )}
            
            {/* Search Results Dropdown List */}
            {searchResults.length > 0 && (
              <div className="search-results-list">
                {searchResults.map((m) => (
                  <div
                    key={m.CustomerId}
                    onClick={() => selectMember(m)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                  >
                    <img
                      src={resolveFileUrl(m.AvatarUrl) || "/images/default-avatar.png"}
                      alt={m.FullName}
                      style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <b style={{ fontSize: 13, color: "#1e293b", display: "block" }}>{m.FullName}</b>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{m.Email} | {m.Phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </label>
          
          {searchError && (
            <p className="error-text" style={{ color: "#ef4444", fontSize: 12, margin: "8px 0 0 0", fontWeight: 600 }}>
              {searchError}
            </p>
          )}
          
          {/* Selected Member Card */}
          {selectedMember && (
            <div
              className="selected-member-card"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: 12,
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
                margin: "16px 0 12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={resolveFileUrl(selectedMember.AvatarUrl) || "/images/default-avatar.png"}
                  alt={selectedMember.FullName}
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                />
                <div>
                  <b style={{ color: "#166534", fontSize: 14 }}>{selectedMember.FullName}</b>
                  <p style={{ fontSize: 12, color: "#15803d", margin: 0 }}>{selectedMember.Email} | {selectedMember.Phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMember(null);
                  setMemberForm((f) => ({ ...f, phoneOrEmail: "" }));
                }}
                style={{ background: "none", border: "none", color: "#ef4444", fontSize: 18, cursor: "pointer", fontWeight: 700 }}
                title="Bỏ chọn"
              >
                ✕
              </button>
            </div>
          )}

          <label style={{ display: "block", marginTop: 12 }}>
            Mối quan hệ:
            <select
              value={memberForm.relationship}
              onChange={(e) => setMemberForm((f) => ({ ...f, relationship: e.target.value }))}
            >
              <option value="">Chọn mối quan hệ</option>
              <option value="Vợ/Chồng">Vợ/Chồng</option>
              <option value="Con">Con</option>
              <option value="Bố/Mẹ">Bố/Mẹ</option>
              <option value="Anh/Chị/Em">Anh/Chị/Em</option>
              <option value="Bạn bè">Bạn bè</option>
              <option value="Khác">Khác</option>
            </select>
          </label>
          
          <button
            className="btn primary"
            onClick={handleAddMember}
            disabled={actionLoading || !selectedMember || !memberForm.relationship}
            style={{ width: "100%", marginTop: 16 }}
          >
            {actionLoading ? "Đang thêm..." : "Thêm thành viên"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ===== MAIN PAGE ===== */
export default function CustomerPackages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [packages, setPackages] = useState([]);
  const [mine, setMine] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    sort: "newest",
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(
      ([key, value]) => value && params.append(key, value),
    );
    return params.toString();
  }, [filters]);

  const load = async () => {
    setLoading(true);
    const [allRes, myRes, catRes] = await Promise.all([
      axiosClient.get(`/packages?${queryString}`),
      axiosClient.get("/packages/my"),
      axiosClient.get("/packages/categories/list"),
    ]);
    setPackages(allRes.data.data || allRes.data || []);
    setMine(myRes.data.data || myRes.data || []);
    setCategories(catRes.data.data || catRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("paid") === "1")
      setMessage("✅ Thanh toán combo / liệu trình thành công!");
    if (params.get("error")) setMessage("❌ Thanh toán thất bại hoặc đã bị hủy");
  }, [location.search]);

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setMessage("❌ Không tải được combo / liệu trình");
    });
  }, [queryString]);

  const buyVnpay = async (id) => {
    try {
      setMessage("");
      const res = await axiosClient.post(`/packages/${id}/vnpay`);
      const data = res.data.data || res.data;
      window.location.href = data.paymentUrl;
    } catch (err) {
      alert(err.response?.data?.message || "Không tạo được thanh toán VNPay");
    }
  };

  return (
    <CustomerLayout>
      <section className="customer-combo-page">
        <div className="section-head">
          <div>
            <div className="eyebrow">Combo / Liệu trình</div>
            <h2 className="section-title">Quản lý liệu trình của bạn</h2>
            <p className="muted">
              Theo dõi tiến độ, chia sẻ gia đình và đặt lịch
              từ combo.
            </p>
          </div>
          <Link className="btn" to="/packages">
            Xem trang guest
          </Link>
        </div>

        {message && (
          <div
            className={
              message.includes("✅") ? "alert success" : "alert error"
            }
          >
            {message}
            <button
              onClick={() => setMessage("")}
              style={{
                float: "right",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* === MY PACKAGES === */}
        <h3>Liệu trình của tôi</h3>

        {selectedPkg ? (
          <PackageDetailPanel
            pkg={selectedPkg}
            onClose={() => setSelectedPkg(null)}
            onRefresh={load}
          />
        ) : (
          <div className="my-combo-grid">
            {mine.length ? (
              mine.map((p) => {
                const total =
                  Number(p.TotalSessions || 0) ||
                  Number(p.RemainingSessions || 0) ||
                  1;
                const left = Number(p.RemainingSessions || 0);
                const used = Number(p.UsedSessions || 0);
                const percent = Math.max(
                  0,
                  Math.min(100, (used / total) * 100),
                );
                const remaining = daysLeft(p.EndDate);
                return (
                  <article
                    className="my-combo-card"
                    key={p.CustomerPackageId}
                    onClick={() => setSelectedPkg(p)}
                    style={{ cursor: "pointer" }}
                  >
                    <img
                      src={resolveFileUrl(p.ImageUrl) || "/vite.svg"}
                      alt={p.PackageName}
                    />
                    <div>
                      <div className="combo-category">
                        {p.CategoryName}
                        {!p.IsOwner && (
                          <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            Được chia sẻ
                          </span>
                        )}
                      </div>
                      <h3>{p.PackageName}</h3>
                      <p className="muted">{p.ServiceNames}</p>
                      <div className="combo-progress">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <div className="combo-meta">
                        <span>
                          {used}/{total} buổi đã dùng
                        </span>
                        <span>
                          {remaining !== null && remaining >= 0
                            ? `Còn ${remaining} ngày`
                            : remaining !== null
                              ? "Đã hết hạn"
                              : "Chưa kích hoạt"}
                        </span>
                      </div>
                      <div
                        className="combo-meta"
                        style={{ justifyContent: "space-between" }}
                      >
                        <StatusBadge status={p.Status} />
                        <span className="muted" style={{ fontSize: 12 }}>
                          Nhấn để xem chi tiết →
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-card">Bạn chưa mua combo nào.</div>
            )}
          </div>
        )}

        {/* === SHOP === */}
        {!selectedPkg && (
          <>
            <div className="combo-toolbar customer-toolbar">
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, search: e.target.value }))
                }
                placeholder="Tìm combo / liệu trình..."
              />
              <select
                value={filters.category}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, category: e.target.value }))
                }
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.CategoryName} value={c.CategoryName}>
                    {c.CategoryName}
                  </option>
                ))}
              </select>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, sort: e.target.value }))
                }
              >
                <option value="newest">Mới nhất</option>
                <option value="priceAsc">Giá thấp đến cao</option>
                <option value="priceDesc">Giá cao đến thấp</option>
                <option value="sessionsDesc">Nhiều buổi nhất</option>
              </select>
            </div>

            {loading && <p className="muted">Đang tải...</p>}
            <div className="combo-grid">
              {packages.map((p) => (
                <article className="combo-card" key={p.PackageId}>
                  <div className="combo-img-wrap">
                    {Number(p.DiscountPercent || 0) > 0 && (
                      <span className="sale-badge">-{p.DiscountPercent}%</span>
                    )}
                    <img
                      src={resolveFileUrl(p.ImageUrl) || "/vite.svg"}
                      alt={p.PackageName}
                    />
                  </div>
                  <div className="combo-card-body">
                    <div className="combo-category">{p.CategoryName}</div>
                    <h3>{p.PackageName}</h3>
                    <p>{p.Description}</p>
                    <div className="combo-meta">
                      <span>
                        🕘 {p.TotalSessions || p.ServiceCount || 1} buổi
                      </span>
                      <span>📅 {p.ValidityDays || 30} ngày</span>
                    </div>
                    <p className="muted service-names">{p.ServiceNames}</p>
                    <div className="combo-price-row">
                      <b>{money(p.FinalPrice || p.Price)}</b>
                      {Number(p.DiscountPercent || 0) > 0 && (
                        <del>{money(p.Price)}</del>
                      )}
                    </div>
                    <div className="combo-actions">
                      <button
                        className="card-btn"
                        onClick={() => navigate(`/packages/${p.PackageId}`)}
                      >
                        Chi tiết
                      </button>
                      <button
                        className="card-btn primary"
                        onClick={() => buyVnpay(p.PackageId)}
                      >
                        Thanh toán VNPay
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </CustomerLayout>
  );
}
