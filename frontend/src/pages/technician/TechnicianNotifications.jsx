import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

export default function TechnicianNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, UNREAD, READ
  const [categoryType, setCategoryType] = useState("ALL"); // ALL, APPOINTMENT, SYSTEM, BONUS, NOTE

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get("/notifications/my");
      const list = res.data?.data || res.data || [];
      setNotifications(list);
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
      await axiosClient.put(`/notifications/my/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.NotificationId === id ? { ...n, IsRead: true } : n))
      );
    } catch (_) {}
  }

  async function handleMarkAllRead() {
    try {
      await axiosClient.put("/notifications/my/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, IsRead: true })));
    } catch (_) {}
  }

  function getNotificationMeta(type) {
    const t = String(type || "").toUpperCase();
    if (t.includes("APPOINTMENT") || t.includes("BOOK") || t.includes("SCHEDULE")) {
      return { icon: "📅", label: "Lịch hẹn", color: "#2d6a4f", bg: "rgba(45, 106, 79, 0.08)", type: "APPOINTMENT" };
    }
    if (t.includes("BONUS") || t.includes("EARN") || t.includes("PAY") || t.includes("COMMISSION")) {
      return { icon: "💰", label: "Thu nhập", color: "#d8b56d", bg: "rgba(216, 181, 109, 0.1)", type: "BONUS" };
    }
    if (t.includes("NOTE") || t.includes("TREATMENT") || t.includes("RECORD")) {
      return { icon: "📝", label: "Ghi chú", color: "#3182ce", bg: "rgba(49, 130, 206, 0.08)", type: "NOTE" };
    }
    return { icon: "⚙️", label: "Hệ thống", color: "#4a5568", bg: "rgba(74, 85, 104, 0.08)", type: "SYSTEM" };
  }

  const filteredNotifications = notifications.filter((n) => {
    const meta = getNotificationMeta(n.Type);

    if (filterType === "UNREAD" && n.IsRead) return false;
    if (filterType === "READ" && !n.IsRead) return false;
    if (categoryType !== "ALL" && meta.type !== categoryType) return false;

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.IsRead).length;

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
    });
  }

  return (
    <TechnicianLayout>
      <div style={{ padding: "20px 30px", maxWidth: "1000px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
        
        {/* Header Block */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
          borderBottom: "1px solid rgba(226, 220, 208, 0.6)",
          paddingBottom: "20px"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 800,
              color: "#0e2013",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              Thông báo cá nhân 🔔
            </h1>
            <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "#4e5a52" }}>
              Xem các cập nhật về lịch hẹn mới, đánh giá và chia sẻ hoa hồng doanh thu
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              style={{
                backgroundColor: "#0e2013",
                color: "#eed39b",
                border: "1px solid #d8b56d",
                padding: "10px 18px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#1b4332";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#0e2013";
                e.currentTarget.style.color = "#eed39b";
              }}
            >
              ✓ Đã đọc tất cả
            </button>
            
            <button
              onClick={loadNotifications}
              disabled={loading}
              style={{
                backgroundColor: "rgba(226, 220, 208, 0.4)",
                color: "#0e2013",
                border: "1px solid rgba(226, 220, 208, 0.8)",
                padding: "10px 18px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🔄 Tải lại
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px"
        }}>
          {/* Status Tabs */}
          <div style={{
            display: "flex",
            background: "rgba(226, 220, 208, 0.3)",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid rgba(226, 220, 208, 0.5)"
          }}>
            {[
              { id: "ALL", label: `Tất cả (${notifications.length})` },
              { id: "UNREAD", label: `Chưa đọc (${unreadCount})` },
              { id: "READ", label: "Đã đọc" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                style={{
                  border: "none",
                  background: filterType === tab.id ? "#0e2013" : "transparent",
                  color: filterType === tab.id ? "#eed39b" : "#4e5a52",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#4e5a52" }}>Lọc loại:</span>
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(226, 220, 208, 0.8)",
                background: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                color: "#0e2013",
                outline: "none"
              }}
            >
              <option value="ALL">Tất cả nhóm</option>
              <option value="APPOINTMENT">Lịch hẹn 📅</option>
              <option value="BONUS">Thu nhập 💰</option>
              <option value="NOTE">Ghi chú trị liệu 📝</option>
              <option value="SYSTEM">Hệ thống ⚙️</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: "rgba(220, 38, 38, 0.08)",
            color: "#dc2626",
            padding: "12px 18px",
            borderRadius: "12px",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            marginBottom: "20px",
            fontSize: "14px"
          }}>{error}</div>
        )}

        {/* Notifications List Card */}
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid rgba(226, 220, 208, 0.6)",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(80, 60, 20, 0.03)"
        }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#8c9c90" }}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>📭</span>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Không tìm thấy thông báo nào</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredNotifications.map((n) => {
                const meta = getNotificationMeta(n.Type);
                return (
                  <div
                    key={n.NotificationId}
                    onClick={() => !n.IsRead && handleMarkRead(n.NotificationId)}
                    style={{
                      display: "flex",
                      gap: "16px",
                      padding: "16px",
                      borderRadius: "14px",
                      backgroundColor: n.IsRead ? "#ffffff" : "rgba(45, 106, 79, 0.03)",
                      border: n.IsRead ? "1px solid rgba(226, 220, 208, 0.4)" : "1px solid rgba(45, 106, 79, 0.2)",
                      cursor: n.IsRead ? "default" : "pointer",
                      transition: "all 0.2s ease",
                      position: "relative"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 14px rgba(80, 60, 20, 0.05)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Unread Indicator Dot */}
                    {!n.IsRead && (
                      <span style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#2e7d32"
                      }} />
                    )}

                    {/* Icon wrapper */}
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: "20px",
                      backgroundColor: meta.bg,
                      color: meta.color,
                      flexShrink: 0
                    }}>
                      {meta.icon}
                    </div>

                    {/* Details content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: n.IsRead ? 600 : 800,
                          color: "#0e2013"
                        }}>{n.Title}</h4>
                        <span style={{ fontSize: "11px", color: "#8c9c90", fontWeight: 600 }}>{formatTime(n.CreatedAt)}</span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: "13.5px",
                        color: "#4e5a52",
                        lineHeight: "1.4",
                        wordBreak: "break-word"
                      }}>{n.Content}</p>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </TechnicianLayout>
  );
}
