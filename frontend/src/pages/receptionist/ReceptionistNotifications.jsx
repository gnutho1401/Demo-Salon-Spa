import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

export default function ReceptionistNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, UNREAD, READ
  const [categoryType, setCategoryType] = useState("ALL"); // ALL, APPOINTMENT, PAYMENT, WAITING, SYSTEM

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get("/receptionist/notifications");
      const data = res.data.data || res.data;
      setNotifications(data.Items || []);
      setUnreadCount(data.UnreadCount || 0);
    } catch (err) {
      setError("Không thể tải danh sách thông báo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id) {
    try {
      await axiosClient.put(`/receptionist/notifications/${id}/read`);
      // Update local state directly for responsive micro-interactions!
      setNotifications(prev =>
        prev.map(n => (n.NotificationId === id ? { ...n, IsRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  }

  async function handleMarkAllRead() {
    try {
      await axiosClient.put("/receptionist/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      setUnreadCount(0);
    } catch (_) {}
  }

  // Helper to map notification type to icon and badge color
  function getNotificationMeta(type) {
    const t = String(type || "").toUpperCase();
    if (t.includes("APPOINTMENT") || t.includes("BOOK") || t.includes("SCHEDULE")) {
      return { icon: "📅", label: "Lịch hẹn", color: "#3182ce", type: "APPOINTMENT" };
    }
    if (t.includes("PAY") || t.includes("INVOICE") || t.includes("REFUND")) {
      return { icon: "💳", label: "Thanh toán", color: "#e53e3e", type: "PAYMENT" };
    }
    if (t.includes("WAIT") || t.includes("HOLD") || t.includes("QUEUE")) {
      return { icon: "⏳", label: "Hàng chờ", color: "#dd6b20", type: "WAITING" };
    }
    return { icon: "⚙️", label: "Hệ thống", color: "#4a5568", type: "SYSTEM" };
  }

  // Filter notifications based on filterType and categoryType
  const filteredNotifications = notifications.filter(n => {
    const meta = getNotificationMeta(n.Type);
    
    // Filter read/unread status
    if (filterType === "UNREAD" && n.IsRead) return false;
    if (filterType === "READ" && !n.IsRead) return false;

    // Filter category
    if (categoryType !== "ALL" && meta.type !== categoryType) return false;

    return true;
  });

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <ReceptionistLayout>
      <div className="rx-noti-page" style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#1a202c", margin: 0 }}>Trung tâm thông báo</h1>
            <p style={{ color: "#718096", margin: "4px 0 0 0" }}>
              Quản lý các thông báo về hoạt động của salon, yêu cầu khách hàng và hệ thống.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn outline" onClick={loadNotifications} disabled={loading} style={{ padding: "8px 16px" }}>
              🔄 Làm mới
            </button>
            {unreadCount > 0 && (
              <button className="btn" onClick={handleMarkAllRead} style={{ padding: "8px 16px", backgroundColor: "#c9235e", borderColor: "#c9235e" }}>
                ✓ Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ padding: "12px", backgroundColor: "#fff5f5", color: "#e53e3e", borderRadius: "8px", marginBottom: "20px" }}>{error}</div>}

        {/* Dashboard Tabs & Categories */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" }}>
          
          {/* Sidebar Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Status Filter */}
            <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 12px 0", color: "#4a5568" }}>Trạng thái</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={() => setFilterType("ALL")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: filterType === "ALL" ? "#f7fafc" : "transparent",
                    color: filterType === "ALL" ? "#c9235e" : "#4a5568",
                    fontWeight: filterType === "ALL" ? "bold" : "normal",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Tất cả</span>
                  <span style={{ fontSize: "12px", backgroundColor: "#e2e8f0", padding: "2px 8px", borderRadius: "10px", color: "#4a5568" }}>
                    {notifications.length}
                  </span>
                </button>
                <button
                  onClick={() => setFilterType("UNREAD")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: filterType === "UNREAD" ? "#f7fafc" : "transparent",
                    color: filterType === "UNREAD" ? "#c9235e" : "#4a5568",
                    fontWeight: filterType === "UNREAD" ? "bold" : "normal",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Chưa đọc</span>
                  <span style={{ fontSize: "12px", backgroundColor: "#fed7d7", padding: "2px 8px", borderRadius: "10px", color: "#c53030", fontWeight: "bold" }}>
                    {unreadCount}
                  </span>
                </button>
                <button
                  onClick={() => setFilterType("READ")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: filterType === "READ" ? "#f7fafc" : "transparent",
                    color: filterType === "READ" ? "#c9235e" : "#4a5568",
                    fontWeight: filterType === "READ" ? "bold" : "normal",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>Đã đọc</span>
                  <span style={{ fontSize: "12px", backgroundColor: "#e2e8f0", padding: "2px 8px", borderRadius: "10px", color: "#4a5568" }}>
                    {notifications.filter(n => n.IsRead).length}
                  </span>
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 12px 0", color: "#4a5568" }}>Phân loại</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { key: "ALL", label: "Tất cả danh mục", icon: "📦" },
                  { key: "APPOINTMENT", label: "Lịch hẹn", icon: "📅" },
                  { key: "PAYMENT", label: "Thanh toán", icon: "💳" },
                  { key: "WAITING", label: "Hàng chờ", icon: "⏳" },
                  { key: "SYSTEM", label: "Hệ thống", icon: "⚙️" },
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCategoryType(cat.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: categoryType === cat.key ? "#f7fafc" : "transparent",
                      color: categoryType === cat.key ? "#c9235e" : "#4a5568",
                      fontWeight: categoryType === cat.key ? "bold" : "normal",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "12px" }}>
                <p style={{ color: "#718096" }}>Đang tải thông báo...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <p style={{ color: "#a0aec0", fontSize: "16px" }}>Chưa có thông báo nào trong mục này.</p>
              </div>
            ) : (
              filteredNotifications.map(n => {
                const meta = getNotificationMeta(n.Type);
                return (
                  <div
                    key={n.NotificationId}
                    style={{
                      backgroundColor: n.IsRead ? "#fff" : "#fffbfe",
                      borderLeft: `4px solid ${n.IsRead ? "#e2e8f0" : "#c9235e"}`,
                      padding: "16px 20px",
                      borderRadius: "0 12px 12px 0",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                      <div
                        style={{
                          fontSize: "20px",
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: `${meta.color}10`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: meta.color,
                        }}
                      >
                        {meta.icon}
                      </div>
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "12px", color: meta.color, backgroundColor: `${meta.color}10`, padding: "2px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                            {meta.label}
                          </span>
                          {!n.IsRead && (
                            <span style={{ fontSize: "10px", color: "#fff", backgroundColor: "#e53e3e", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                              MỚI
                            </span>
                          )}
                          <span style={{ fontSize: "12px", color: "#a0aec0" }}>{formatTime(n.CreatedAt)}</span>
                        </div>
                        <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", margin: "8px 0 4px 0" }}>{n.Title}</h4>
                        <p style={{ fontSize: "14px", color: "#4a5568", margin: 0, lineHeight: "1.5" }}>{n.Content}</p>
                      </div>
                    </div>

                    {!n.IsRead && (
                      <button
                        className="btn outline small"
                        onClick={() => handleMarkRead(n.NotificationId)}
                        style={{
                          fontSize: "12px",
                          padding: "6px 12px",
                          color: "#c9235e",
                          borderColor: "#c9235e",
                        }}
                      >
                        Đã đọc
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </ReceptionistLayout>
  );
}
