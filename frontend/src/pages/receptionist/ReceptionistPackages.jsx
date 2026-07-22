import { useState, useEffect } from "react";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const money = (val) => `${Number(val || 0).toLocaleString("vi-VN")} đ`;

function formatDate(dateValue) {
  if (!dateValue) return "—";
  if (typeof dateValue === "string" && dateValue.includes("T")) {
    dateValue = dateValue.split("T")[0];
  }
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [y, m, d] = dateValue.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(dateValue).toLocaleDateString("vi-VN");
}

export default function ReceptionistPackages() {
  const [activeTab, setActiveTab] = useState("approvals"); // 'approvals' | 'shop' | 'bookings'
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  // Customer search state for counter selling / booking
  const [custSearch, setCustSearch] = useState("");
  const [custResults, setCustResults] = useState([]);
  const [selectedCust, setSelectedCust] = useState(null);
  const [searchingCust, setSearchingCust] = useState(false);

  // Sell Package Modal
  const [sellModalPkg, setSellModalPkg] = useState(null);
  const [payMethod, setPayMethod] = useState("CASH");
  const [submitting, setSubmitting] = useState(false);

  // Book Combo for customer Modal
  const [bookModalPkg, setBookModalPkg] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: "09:00",
    notes: ""
  });
  const [customerPackages, setCustomerPackages] = useState([]);
  const [loadingCustPackages, setLoadingCustPackages] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState("");

  // Dedicated Combo Approvals State
  const [comboAppts, setComboAppts] = useState([]);
  const [loadingComboAppts, setLoadingComboAppts] = useState(false);
  const [apptStatusFilter, setApptStatusFilter] = useState("ALL"); // ALL | CONFIRMED | CHECKED_IN | IN_PROGRESS | COMPLETED | CANCELLED
  const [apptSearch, setApptSearch] = useState("");

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/packages");
      setPackages(res.data.data || res.data || []);
    } catch (err) {
      setMessage("❌ Không tải được danh sách gói Combo");
    } finally {
      setLoading(false);
    }
  };

  const loadComboAppointments = async () => {
    setLoadingComboAppts(true);
    try {
      const res = await axiosClient.get("/receptionist/appointments?isCombo=1");
      const list = res.data.data || res.data || [];
      // Filter for appointments that belong to a CustomerPackage
      const filtered = Array.isArray(list) ? list.filter(a => a.CustomerPackageId || a.CustomerPackageName) : [];
      setComboAppts(filtered);
    } catch (err) {
      setMessage("❌ Không tải được danh sách duyệt Combo");
      setComboAppts([]);
    } finally {
      setLoadingComboAppts(false);
    }
  };

  useEffect(() => {
    loadPackages();
    loadComboAppointments();
  }, []);

  // Customer Search debounce
  useEffect(() => {
    if (!custSearch || custSearch.trim().length < 2) {
      setCustResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCust(true);
      try {
        const res = await axiosClient.get(`/receptionist/customers?search=${encodeURIComponent(custSearch.trim())}`);
        const data = res.data.data || res.data || [];
        setCustResults(Array.isArray(data) ? data : (data.items || []));
      } catch (_) {
        setCustResults([]);
      } finally {
        setSearchingCust(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [custSearch]);

  const loadCustomerPackages = async (customerId) => {
    setLoadingCustPackages(true);
    try {
      const res = await axiosClient.get(`/packages/my?customerId=${customerId}`);
      setCustomerPackages(res.data.data || res.data || []);
    } catch (err) {
      setCustomerPackages([]);
    } finally {
      setLoadingCustPackages(false);
    }
  };

  const selectCustomer = (c) => {
    setSelectedCust(c);
    setCustSearch("");
    setCustResults([]);
    loadCustomerPackages(c.CustomerId);
  };

  const handleSellPackage = async () => {
    if (!selectedCust) {
      alert("Vui lòng chọn khách hàng mua gói!");
      return;
    }
    if (!sellModalPkg) return;

    setSubmitting(true);
    try {
      await axiosClient.post(`/packages/${sellModalPkg.PackageId}/buy`, {
        customerId: selectedCust.CustomerId,
        paymentMethod: payMethod
      });
      setMessage(`✅ Bán gói Combo "${sellModalPkg.PackageName}" cho khách hàng ${selectedCust.FullName} thành công!`);
      setSellModalPkg(null);
      loadCustomerPackages(selectedCust.CustomerId);
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi tạo giao dịch bán Combo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookComboForCustomer = async () => {
    if (!bookModalPkg) return;
    setSubmitting(true);
    setBookingError("");
    try {
      const res = await axiosClient.post(`/packages/my/${bookModalPkg.CustomerPackageId}/book`, {
        ...bookingForm,
        customerId: selectedCust?.CustomerId
      });
      const data = res.data.data || res.data;
      setBookingSuccess(data);
      setMessage(`✅ Đặt lịch Combo thành công cho khách hàng ${selectedCust?.FullName || ""}`);
      if (selectedCust) loadCustomerPackages(selectedCust.CustomerId);
      loadComboAppointments();
    } catch (err) {
      setBookingError(err.response?.data?.message || "Lỗi đặt lịch Combo giúp khách");
    } finally {
      setSubmitting(false);
    }
  };

  // Receptionist Actions for Combo Appointments
  const handleCheckIn = async (appointmentId) => {
    try {
      await axiosClient.put(`/receptionist/appointments/${appointmentId}/check-in`);
      setMessage(`✅ Đã Check-in đón khách làm Combo #${appointmentId}. Các bước dịch vụ đã được mở khóa theo thứ tự!`);
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi Check-in cuộc hẹn Combo");
    }
  };

  const handleComplete = async (appointmentId) => {
    try {
      await axiosClient.put(`/receptionist/appointments/${appointmentId}/complete`);
      setMessage(`✅ Đã xác nhận HOÀN THÀNH cuộc hẹn Combo #${appointmentId}`);
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi hoàn thành cuộc hẹn Combo");
    }
  };

  const handleCancel = async (appointmentId) => {
    if (!window.confirm(`Hủy cuộc hẹn Combo #${appointmentId}? Số lượt sử dụng sẽ được hoàn trả lại cho khách.`)) return;
    try {
      await axiosClient.put(`/receptionist/appointments/${appointmentId}/cancel`, { cancelReason: "Lễ tân hủy giúp khách" });
      setMessage(`✅ Đã hủy cuộc hẹn Combo #${appointmentId}`);
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi hủy cuộc hẹn Combo");
    }
  };

  const handleMarkNoShow = async (appointmentId) => {
    if (!window.confirm(`Xác nhận đánh dấu VẮNG MẶT (No-Show) cho cuộc hẹn Combo #${appointmentId}? Hệ thống sẽ gửi email & thông báo web cho khách hàng!`)) return;
    try {
      await axiosClient.put(`/receptionist/appointments/${appointmentId}/no-show`);
      setMessage(`✅ Đã đánh dấu VẮNG MẶT cho cuộc hẹn Combo #${appointmentId}. Đã tự động gửi thông báo qua Web & Email cho khách hàng!`);
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi đánh dấu vắng mặt khách hàng");
    }
  };

  const handleUpdateStepStatus = async (appointmentServiceId, newStatus) => {
    try {
      const res = await axiosClient.put(`/receptionist/appointment-services/${appointmentServiceId}/status`, { status: newStatus });
      if (res.data?.data?.allCompleted) {
        setMessage("🎉 Tất cả các bước dịch vụ đã hoàn thành! Cuộc hẹn đã tự động hoàn thành.");
      } else {
        setMessage("✅ Đã xác nhận xong bước dịch vụ! Bước tiếp theo đã mở khóa.");
      }
      loadComboAppointments();
    } catch (err) {
      alert(err.response?.data?.message || "Lỗi cập nhật bước dịch vụ");
    }
  };

  const filteredPkgs = packages.filter(p =>
    (p.PackageName || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.CategoryName || "").toLowerCase().includes(search.toLowerCase())
  );

  const displayedComboAppts = comboAppts.filter(a => {
    const matchStatus = apptStatusFilter === "ALL" || (a.Status || "").toUpperCase() === apptStatusFilter;
    const matchKeyword = !apptSearch ||
      (a.CustomerName || "").toLowerCase().includes(apptSearch.toLowerCase()) ||
      (a.CustomerPhone || "").toLowerCase().includes(apptSearch.toLowerCase()) ||
      (a.CustomerPackageName || "").toLowerCase().includes(apptSearch.toLowerCase()) ||
      String(a.AppointmentId).includes(apptSearch);
    return matchStatus && matchKeyword;
  });

  return (
    <ReceptionistLayout>
      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
        
        {/* HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          background: "linear-gradient(135deg, #0d9488 0%, #115e59 100%)",
          padding: "24px 32px",
          borderRadius: 16,
          color: "#fff",
          boxShadow: "0 10px 25px rgba(13, 148, 136, 0.25)",
          flexWrap: "wrap",
          gap: 16
        }}>
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.85, fontWeight: 700 }}>
              Khu vực Lễ tân Salon
            </div>
            <h1 style={{ margin: "4px 0 0 0", fontSize: 24, fontWeight: 800 }}>Quản Lý & Duyệt Đặt Lịch Gói Combo</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.9 }}>
              Duyệt lịch hẹn Combo, đón khách check-in tại quầy, quản lý KTV rảnh & bán gói tại quầy
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                fontWeight: 800,
                cursor: "pointer",
                background: activeTab === "approvals" ? "#ffffff" : "rgba(255,255,255,0.18)",
                color: activeTab === "approvals" ? "#0d9488" : "#ffffff",
                boxShadow: activeTab === "approvals" ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                transition: "all 0.2s"
              }}
              onClick={() => setActiveTab("approvals")}
            >
              📋 Duyệt & Đón Khách Combo ({comboAppts.length})
            </button>
            <button
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                fontWeight: 800,
                cursor: "pointer",
                background: activeTab === "shop" ? "#ffffff" : "rgba(255,255,255,0.18)",
                color: activeTab === "shop" ? "#0d9488" : "#ffffff",
                boxShadow: activeTab === "shop" ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                transition: "all 0.2s"
              }}
              onClick={() => setActiveTab("shop")}
            >
              🏷️ Combo Bán Tại Quầy
            </button>
            <button
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                fontWeight: 800,
                cursor: "pointer",
                background: activeTab === "bookings" ? "#ffffff" : "rgba(255,255,255,0.18)",
                color: activeTab === "bookings" ? "#0d9488" : "#ffffff",
                boxShadow: activeTab === "bookings" ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                transition: "all 0.2s"
              }}
              onClick={() => setActiveTab("bookings")}
            >
              📅 Đặt Lịch Cho Khách
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: message.includes("✅") || message.includes("🎉") ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${message.includes("✅") || message.includes("🎉") ? "#bbf7d0" : "#fecaca"}`,
            color: message.includes("✅") || message.includes("🎉") ? "#166534" : "#991b1b",
            marginBottom: 20,
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{message}</span>
            <button onClick={() => setMessage("")} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* TAB 1: DEDICATED RECEPTIONIST COMBO APPROVALS & CHECK-IN */}
        {activeTab === "approvals" && (
          <div>
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                
                {/* STATUS FILTER PILLS */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "ALL", label: "Tất cả" },
                    { key: "CONFIRMED", label: "Chờ đón khách (CONFIRMED)" },
                    { key: "CHECKED_IN", label: "Đã Check-in" },
                    { key: "IN_PROGRESS", label: "Đang làm spa" },
                    { key: "COMPLETED", label: "Hoàn thành" },
                    { key: "CANCELLED", label: "Đã hủy" }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setApptStatusFilter(tab.key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "1px solid",
                        borderColor: apptStatusFilter === tab.key ? "#0d9488" : "#cbd5e1",
                        background: apptStatusFilter === tab.key ? "#0d9488" : "#f8fafc",
                        color: apptStatusFilter === tab.key ? "#ffffff" : "#475569",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* SEARCH INPUT */}
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Tìm theo Tên khách, SĐT, Mã hẹn..."
                    value={apptSearch}
                    onChange={(e) => setApptSearch(e.target.value)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", width: 260, fontSize: 13 }}
                  />
                  <button onClick={loadComboAppointments} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    🔄 Tải lại
                  </button>
                </div>

              </div>
            </div>

            {loadingComboAppts ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: 30 }}>Đang tải danh sách lịch hẹn Combo...</p>
            ) : displayedComboAppts.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", border: "1px dashed #cbd5e1", color: "#64748b" }}>
                Không tìm thấy cuộc hẹn Combo phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {displayedComboAppts.map(a => {
                  const servicesList = typeof a.ServicesJson === 'string' ? JSON.parse(a.ServicesJson) : (a.ServicesJson || []);
                  const isCheckInDone = a.Status !== "CONFIRMED";

                  return (
                    <div key={a.AppointmentId} style={{
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
                      padding: 20,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16
                    }}>
                      {/* TOP SECTION */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                        {/* LEFT INFO */}
                        <div style={{ flex: 1, minWidth: 300 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ background: "#0d9488", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>
                              #HẸN {a.AppointmentId}
                            </span>
                            <span style={{ background: "#ccfbf1", color: "#0f766e", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>
                              📦 {a.CustomerPackageName || "Gói Combo Trọn Gói"}
                            </span>
                            <span style={{
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 800,
                              background: a.Status === "COMPLETED" ? "#f5f3ff" : a.Status === "CONFIRMED" ? "#eff6ff" : a.Status === "CHECKED_IN" ? "#ecfdf5" : "#fef2f2",
                              color: a.Status === "COMPLETED" ? "#7c3aed" : a.Status === "CONFIRMED" ? "#2563eb" : a.Status === "CHECKED_IN" ? "#059669" : "#dc2626"
                            }}>
                              {a.Status}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <img
                              src={resolveFileUrl(a.CustomerAvatarUrl) || "/images/avatars/default-avatar.png"}
                              alt={a.CustomerName}
                              style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "1px solid #cbd5e1" }}
                            />
                            <div>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{a.CustomerName}</h4>
                              <span style={{ fontSize: 12, color: "#64748b" }}>📞 SĐT: <b>{a.CustomerPhone || "N/A"}</b> | Email: {a.CustomerEmail || "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        {/* MID TIME & TECH INFO */}
                        <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", minWidth: 260 }}>
                          <div style={{ fontSize: 12, color: "#0f766e", fontWeight: 700, marginBottom: 4 }}>
                            📅 Ngày Hẹn: <b>{formatDate(a.AppointmentDate)}</b>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>
                            ⏰ Khung giờ: {a.StartTime?.slice(0,5)} - {a.EndTime?.slice(0,5)}
                          </div>
                          <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>✂️ Trưởng nhóm KTV:</span>
                            <b>{a.TechnicianName || "Tự động phân công"}</b>
                          </div>
                        </div>

                        {/* RIGHT ACTIONS */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
                          {a.Status === "CONFIRMED" && (
                            <button
                              onClick={() => handleCheckIn(a.AppointmentId)}
                              style={{
                                padding: "10px 18px",
                                borderRadius: 8,
                                border: "none",
                                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: 13,
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(5,150,105,0.25)"
                              }}
                            >
                              ✅ Check-in (Đón Khách)
                            </button>
                          )}

                          {/* COMPLETE BUTTON: DISABLED UNTIL CHECKED IN, HIDDEN FOR CANCELLED & NO_SHOW */}
                          {a.Status !== "COMPLETED" && a.Status !== "CANCELLED" && a.Status !== "NO_SHOW" && (
                            <button
                              onClick={() => {
                                if (!isCheckInDone) return;
                                handleComplete(a.AppointmentId);
                              }}
                              disabled={!isCheckInDone}
                              title={!isCheckInDone ? "Cần Check-in đón khách trước khi hoàn thành" : ""}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: "none",
                                background: isCheckInDone ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#cbd5e1",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: isCheckInDone ? "pointer" : "not-allowed",
                                opacity: isCheckInDone ? 1 : 0.65
                              }}
                            >
                              {!isCheckInDone ? "🔒 Chờ Check-in" : "✨ Hoàn Thành Cuộc Hẹn"}
                            </button>
                          )}

                          {a.Status !== "COMPLETED" && a.Status !== "CANCELLED" && a.Status !== "NO_SHOW" && (
                            <button
                              onClick={() => handleCancel(a.AppointmentId)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#dc2626",
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: "pointer"
                              }}
                            >
                              ❌ Hủy Hẹn
                            </button>
                          )}

                          {["CONFIRMED", "BOOKED", "PENDING"].includes(a.Status) && (
                            <button
                              onClick={() => handleMarkNoShow(a.AppointmentId)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "1px solid #fda4af",
                                background: "#fff1f2",
                                color: "#be123c",
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: "pointer"
                              }}
                            >
                              🚨 Khách Vắng Mặt (No-Show)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* BOTTOM SERVICE STEPS BREAKDOWN */}
                      {servicesList.length > 0 && (
                        <div style={{ marginTop: 8, borderTop: "1px dashed #cbd5e1", paddingTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>✂️ Danh sách bước dịch vụ Combo ({servicesList.filter(s => s.Status === 'COMPLETED').length}/{servicesList.length} bước xong)</span>
                            {a.Status === "NO_SHOW" ? (
                              <span style={{ fontSize: 11, color: "#be123c", fontWeight: 700, background: "#fff1f2", padding: "3px 10px", borderRadius: 8, border: "1px solid #fecdd3" }}>
                                🚨 Khách vắng mặt (No-Show) - Đã khóa toàn bộ dịch vụ
                              </span>
                            ) : !isCheckInDone && (
                              <span style={{ fontSize: 11, color: "#d97706", fontWeight: 700, background: "#fef3c7", padding: "3px 10px", borderRadius: 8 }}>
                                🔒 Cần bấm "Check-in (Đón Khách)" để mở khóa làm dịch vụ
                              </span>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                            {servicesList.map((svcStep, idx) => {
                              const prevStepsCompleted = servicesList.slice(0, idx).every(prev => prev.Status === 'COMPLETED');
                              const isNoShowOrCancelled = ["NO_SHOW", "CANCELLED"].includes(a.Status);
                              const isUnlocked = isCheckInDone && prevStepsCompleted && !isNoShowOrCancelled;
                              const isCompleted = svcStep.Status === 'COMPLETED';
                              const isInProgress = svcStep.Status === 'IN_PROGRESS';

                              return (
                                <div
                                  key={svcStep.AppointmentServiceId || idx}
                                  style={{
                                    background: isCompleted ? "#f1f5f9" : isUnlocked ? "#ffffff" : "#f8fafc",
                                    borderRadius: 12,
                                    border: `1.5px solid ${isCompleted ? "#cbd5e1" : isInProgress ? "#0284c7" : isUnlocked ? "#0d9488" : "#e2e8f0"}`,
                                    padding: 12,
                                    opacity: isCompleted ? 0.75 : isUnlocked ? 1 : 0.45,
                                    filter: !isUnlocked && !isCompleted ? "grayscale(0.6)" : "none",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between"
                                  }}
                                >
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                      <b style={{ color: isCompleted ? "#64748b" : "#1e293b", fontSize: 13 }}>
                                        {idx + 1}. {svcStep.ServiceName}
                                      </b>
                                      <span style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: "2px 6px",
                                        borderRadius: 6,
                                        background: isCompleted ? "#dcfce7" : isNoShowOrCancelled ? "#ffe4e6" : isInProgress ? "#e0f2fe" : isUnlocked ? "#fef3c7" : "#e2e8f0",
                                        color: isCompleted ? "#15803d" : isNoShowOrCancelled ? "#e11d48" : isInProgress ? "#0369a1" : isUnlocked ? "#b45309" : "#64748b"
                                      }}>
                                        {isCompleted ? "✓ ĐÃ XONG" : isNoShowOrCancelled ? "🚨 VẮNG MẶT" : isInProgress ? "▶️ ĐANG LÀM" : isUnlocked ? "⏳ CHỜ LÀM" : "🔒 KHÓA"}
                                      </span>
                                    </div>

                                    <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                      <span>⏱ {svcStep.DurationMinutes || 30} phút</span>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: isUnlocked ? "#f0fdf4" : "#f1f5f9", padding: "6px 8px", borderRadius: 8 }}>
                                      <img
                                        src={resolveFileUrl(svcStep.TechnicianAvatar) || "/images/avatars/default-avatar.png"}
                                        alt={svcStep.TechnicianName}
                                        style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "1px solid #cbd5e1" }}
                                      />
                                      <div>
                                        <span style={{ fontSize: 10, color: "#64748b", display: "block" }}>KTV Phụ trách:</span>
                                        <b style={{ fontSize: 11, color: "#0f766e" }}>{svcStep.TechnicianName || "KTV Rảnh"}</b>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ACTION BUTTON FOR THIS STEP */}
                                  <div style={{ marginTop: 10 }}>
                                    {isCompleted ? (
                                      <div style={{ textAlign: "center", fontSize: 11, color: "#166534", fontWeight: 700, padding: 4 }}>
                                        ✅ Đã hoàn thành bước này
                                      </div>
                                    ) : (
                                      <button
                                        disabled={!isUnlocked}
                                        onClick={() => handleUpdateStepStatus(svcStep.AppointmentServiceId, 'COMPLETED')}
                                        style={{
                                          width: "100%",
                                          padding: "8px",
                                          borderRadius: 8,
                                          border: "none",
                                          background: isUnlocked ? "linear-gradient(135deg, #0d9488 0%, #059669 100%)" : "#cbd5e1",
                                          color: "#ffffff",
                                          fontSize: 12,
                                          fontWeight: 800,
                                          cursor: isUnlocked ? "pointer" : "not-allowed"
                                        }}
                                      >
                                        {isNoShowOrCancelled ? "🚨 Khách Vắng Mặt" : !isCheckInDone ? "🔒 Cần Check-in trước" : !prevStepsCompleted ? `🔒 Chờ xong bước ${idx}` : "✓ Xác Nhận Xong Bước Này"}
                                      </button>
                                    )}
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CUSTOMER SELECTION BAR FOR TAB SHOP & BOOKINGS */}
        {activeTab !== "approvals" && (
          <div style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            marginBottom: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: "#0f766e", fontSize: 14 }}>👤 Chọn Khách Hàng Thao Tác:</span>

              {selectedCust ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#ccfbf1",
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: "1px solid #5eead4"
                }}>
                  <b style={{ color: "#0f766e", fontSize: 13 }}>{selectedCust.FullName}</b>
                  <span style={{ fontSize: 12, color: "#115e59" }}>({selectedCust.Phone || selectedCust.Email})</span>
                  <button
                    onClick={() => {
                      setSelectedCust(null);
                      setCustomerPackages([]);
                    }}
                    style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 800, cursor: "pointer" }}
                  >
                    ✕ Bỏ chọn
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
                  <input
                    type="text"
                    placeholder="Nhập Tên, Số điện thoại hoặc Email khách hàng..."
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13
                    }}
                  />
                  {searchingCust && <span style={{ position: "absolute", right: 10, top: 8, fontSize: 12, color: "#94a3b8" }}>Tìm...</span>}

                  {custResults.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      marginTop: 4,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      zIndex: 99,
                      maxHeight: 220,
                      overflowY: "auto"
                    }}>
                      {custResults.map(c => (
                        <div
                          key={c.CustomerId}
                          onClick={() => selectCustomer(c)}
                          style={{
                            padding: "10px 14px",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f0fdf4"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                        >
                          <b style={{ color: "#1e293b", fontSize: 13, display: "block" }}>{c.FullName}</b>
                          <span style={{ fontSize: 11, color: "#64748b" }}>SĐT: {c.Phone || "N/A"} | Email: {c.Email || "N/A"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COMBO SHOP */}
        {activeTab === "shop" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f766e", margin: 0 }}>
                Bảng Giá Danh Sách Gói Combo ({filteredPkgs.length})
              </h2>
              <input
                type="text"
                placeholder="Lọc tên Combo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", width: 250, fontSize: 13 }}
              />
            </div>

            {loading ? (
              <p style={{ color: "#64748b" }}>Đang tải gói Combo...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {filteredPkgs.map(p => (
                  <div key={p.PackageId} style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
                  }}>
                    <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
                      <img
                        src={resolveFileUrl(p.ImageUrl) || "/images/services/default-service.png"}
                        alt={p.PackageName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <span style={{
                        position: "absolute",
                        top: 10, right: 10,
                        background: "rgba(13, 148, 136, 0.9)",
                        color: "#fff",
                        padding: "3px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {p.CategoryName || "Gói Combo"}
                      </span>
                    </div>

                    <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{p.PackageName}</h3>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px 0", lineHeight: 1.4 }}>{p.Description}</p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#0f766e", background: "#f0fdf4", padding: "6px 10px", borderRadius: 6 }}>
                          ✨ Dịch vụ: {p.ServiceNames}
                        </p>
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "12px 0" }}>
                          <b style={{ fontSize: 18, color: "#0d9488", fontWeight: 800 }}>{money(p.FinalPrice || p.Price)}</b>
                          {Number(p.DiscountPercent || 0) > 0 && (
                            <del style={{ fontSize: 12, color: "#94a3b8" }}>{money(p.Price)}</del>
                          )}
                        </div>

                        <button
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: 8,
                            border: "none",
                            background: "#0d9488",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                          onClick={() => {
                            if (!selectedCust) {
                              alert("Vui lòng chọn khách hàng ở thanh tìm kiếm bên trên trước khi bán gói!");
                              return;
                            }
                            setSellModalPkg(p);
                          }}
                        >
                          💳 Bán Gói Cho Khách
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOMER PACKAGES & BOOKING */}
        {activeTab === "bookings" && (
          <div>
            {!selectedCust ? (
              <div style={{ background: "#fff", padding: 32, textAlign: "center", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
                <h3 style={{ color: "#0f766e", margin: 0 }}>Chưa chọn khách hàng nào</h3>
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Vui lòng nhập Tên/SĐT khách hàng ở ô tìm kiếm phía trên để xem các Combo của khách & hỗ trợ đặt lịch!
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f766e", marginBottom: 16 }}>
                  Danh Sách Gói Combo Đã Mua Của: {selectedCust.FullName}
                </h2>

                {loadingCustPackages ? (
                  <p style={{ color: "#64748b" }}>Đang tải gói của khách...</p>
                ) : customerPackages.length === 0 ? (
                  <div style={{ background: "#fff", padding: 24, textAlign: "center", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <p style={{ color: "#64748b", margin: 0 }}>Khách hàng này chưa có gói Combo nào.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
                    {customerPackages.map(cp => (
                      <div key={cp.CustomerPackageId} style={{
                        background: "#fff",
                        borderRadius: 14,
                        border: "1px solid #e2e8f0",
                        padding: 20,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{cp.PackageName}</h3>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: cp.Status === "ACTIVE" ? "#f0fdf4" : "#fef2f2",
                            color: cp.Status === "ACTIVE" ? "#166534" : "#991b1b"
                          }}>
                            {cp.Status}
                          </span>
                        </div>

                        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px 0" }}>
                          Gồm: <strong>{cp.ServiceNames || "Các dịch vụ spa"}</strong>
                        </p>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 16 }}>
                          <span>Lượt dùng: <b>{cp.UsedSessions || 0}/{cp.TotalSessions || 1}</b></span>
                          <span>Còn lại: <b style={{ color: "#0d9488" }}>{cp.RemainingSessions || 0} lượt</b></span>
                        </div>

                        {cp.Status === "ACTIVE" && Number(cp.RemainingSessions || 0) > 0 && (
                          <button
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: 8,
                              border: "none",
                              background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            onClick={() => {
                              setBookModalPkg(cp);
                              setBookingSuccess(null);
                              setBookingError("");
                            }}
                          >
                            ✨ 📅 Đặt Lịch Hẹn Combo Cho Khách
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: SELL PACKAGE */}
        {sellModalPkg && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999
          }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 450, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#0f766e", fontSize: 18 }}>💳 Xác Nhận Bán Combo Tại Quầy</h3>
              
              <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <b style={{ color: "#166534", fontSize: 14 }}>Khách hàng: {selectedCust?.FullName}</b>
                <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#15803d" }}>SĐT: {selectedCust?.Phone || selectedCust?.Email}</p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <small style={{ color: "#64748b" }}>Tên Combo:</small>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{sellModalPkg.PackageName}</div>
                <div style={{ color: "#0d9488", fontWeight: 800, fontSize: 18, marginTop: 4 }}>
                  {money(sellModalPkg.FinalPrice || sellModalPkg.Price)}
                </div>
              </div>

              <label style={{ display: "block", marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Phương thức thu tiền:</span>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  style={{ width: "100%", padding: "10px", marginTop: 4, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  <option value="CASH">💵 Tiền Mặt Tại Quầy</option>
                  <option value="BANK_TRANSFER">🏦 Chuyển Khoản Ngân Hàng</option>
                </select>
              </label>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setSellModalPkg(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSellPackage}
                  disabled={submitting}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                >
                  {submitting ? "Đang xử lý..." : "Xác Nhận Thu Tiền"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: BOOK COMBO FOR CUSTOMER */}
        {bookModalPkg && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999
          }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#0f766e", fontSize: 18 }}>✨ Đặt Lịch Dùng Combo Cho Khách</h3>

              {bookingSuccess ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                  <h4 style={{ color: "#0d9488", margin: 0 }}>ĐẶT LỊCH THÀNH CÔNG!</h4>
                  <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 16px 0" }}>
                    Đơn đặt lịch đã được khởi tạo và tự động gán KTV rảnh cho khách hàng!
                  </p>

                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 14, borderRadius: 10, textAlign: "left", marginBottom: 16 }}>
                    <div><b>KTV Được Tự Động Gán:</b> {bookingSuccess.technician?.fullName} (SĐT: {bookingSuccess.technician?.phone || "N/A"})</div>
                    <div style={{ marginTop: 4 }}><b>Khung Giờ:</b> {bookingSuccess.appointmentDate} ({bookingSuccess.startTime?.slice(0,5)} - {bookingSuccess.endTime?.slice(0,5)})</div>
                  </div>

                  <button
                    onClick={() => {
                      setBookModalPkg(null);
                      setBookingSuccess(null);
                    }}
                    style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                  >
                    Đóng
                  </button>
                </div>
              ) : (
                <div>
                  {bookingError && (
                    <div style={{ background: "#fef2f2", color: "#991b1b", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                      {bookingError}
                    </div>
                  )}

                  <div style={{ background: "#ccfbf1", padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13, color: "#115e59" }}>
                    <b>Gói:</b> {bookModalPkg.PackageName}
                  </div>

                  <label style={{ display: "block", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>📅 Ngày Hẹn:</span>
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={bookingForm.appointmentDate}
                      onChange={(e) => setBookingForm(f => ({ ...f, appointmentDate: e.target.value }))}
                      style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>⏰ Giờ Bắt Đầu:</span>
                    <select
                      value={bookingForm.startTime}
                      onChange={(e) => setBookingForm(f => ({ ...f, startTime: e.target.value }))}
                      style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    >
                      <option value="08:30">08:30 sáng</option>
                      <option value="09:00">09:00 sáng</option>
                      <option value="09:30">09:30 sáng</option>
                      <option value="10:00">10:00 sáng</option>
                      <option value="10:30">10:30 sáng</option>
                      <option value="11:00">11:00 sáng</option>
                      <option value="13:30">13:30 chiều</option>
                      <option value="14:00">14:00 chiều</option>
                      <option value="14:30">14:30 chiều</option>
                      <option value="15:00">15:00 chiều</option>
                      <option value="15:30">15:30 chiều</option>
                      <option value="16:00">16:00 chiều</option>
                      <option value="16:30">16:30 chiều</option>
                      <option value="17:00">17:00 chiều</option>
                    </select>
                  </label>

                  <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                    ℹ️ Hệ thống sẽ tự động xếp KTV rảnh nhất trong ca làm việc để phục vụ cuộc hẹn Combo này.
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setBookModalPkg(null)}
                      style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      onClick={handleBookComboForCustomer}
                      disabled={submitting}
                      style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                    >
                      {submitting ? "Đang xử lý..." : "Xác Nhận Đặt Lịch"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </ReceptionistLayout>
  );
}
