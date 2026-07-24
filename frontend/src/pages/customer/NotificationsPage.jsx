import { useEffect, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  const load = () =>
    axiosClient
      .get("/notifications/my")
      .then((res) => setItems(res.data.data || res.data || []))
      .catch(() => setMessage("Không tải được thông báo"));

  useEffect(() => {
    load();
  }, []);

  const read = async (id) => {
    await axiosClient.put(`/notifications/my/${id}/read`);
    load();
  };

  const readAll = async () => {
    await axiosClient.put("/notifications/my/read-all");
    load();
  };

  const getNotificationIcon = (type) => {
    const t = String(type || "").toUpperCase();
    if (t.includes("APPOINTMENT") || t.includes("BOOKING")) return "📅";
    if (t.includes("VOUCHER") || t.includes("DISCOUNT")) return "🏷️";
    if (t.includes("PACKAGE") || t.includes("COMBO")) return "🎁";
    return "📢";
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <CustomerLayout>
      <div className="notifications-page-container">
        {/* Section Head */}
        <div
          className="section-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div className="eyebrow">Notifications</div>
            <h2 className="section-title" style={{ margin: "4px 0 0 0" }}>
              Thông báo của tôi
            </h2>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={readAll}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                background: "linear-gradient(135deg, #ff4778, #e8396c)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(255, 71, 120, 0.2)",
              }}
            >
              ✓ Đánh dấu đã đọc tất cả
            </button>
          )}
        </div>

        {message && (
          <p className="muted" style={{ color: "#e8396c", fontWeight: 600 }}>
            {message}
          </p>
        )}

        {/* Notifications List */}
        <div className="notification-list" style={{ display: "grid", gap: 16 }}>
          {items.length > 0 ? (
            items.map((n) => (
              <div
                className={`notification-card ${n.IsRead ? "read" : "unread"}`}
                key={n.NotificationId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px",
                  borderRadius: "16px",
                  background: n.IsRead ? "#ffffff" : "#fff9fa",
                  border: "1px solid",
                  borderColor: n.IsRead ? "#f3e6e8" : "#ffdce3",
                  boxShadow: "0 4px 15px rgba(232, 57, 108, 0.02)",
                  transition: "all 0.25s ease",
                  position: "relative",
                }}
              >
                {/* Left side details */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flex: 1,
                  }}
                >
                  {/* Icon Wrapper */}
                  <div
                    className="notification-icon-wrapper"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      background: n.IsRead ? "#fbf6f7" : "#ffeef2",
                      flexShrink: 0,
                      border: "1px solid",
                      borderColor: n.IsRead ? "#eddfe1" : "#ffccd7",
                    }}
                  >
                    {getNotificationIcon(n.Type)}
                  </div>

                  {/* Text contents */}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: n.IsRead ? "600" : "800",
                        color: "#2d2430",
                      }}
                    >
                      {n.Title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13.5px",
                        color: "#675464",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.Content}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#a38f9d",
                          fontWeight: 500,
                        }}
                      >
                        🕒 {formatDateTime(n.CreatedAt)}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background: n.IsRead ? "#f1eaed" : "#ffe3e8",
                          color: n.IsRead ? "#7d6776" : "#e8396c",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {n.Type || "SYSTEM"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side status indicator / button */}
                <div style={{ marginLeft: 16 }}>
                  {!n.IsRead ? (
                    <button
                      className="notification-read-btn"
                      onClick={() => read(n.NotificationId)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#ff4778",
                        background: "#ffeef2",
                        border: "1px solid #ffccd7",
                        borderRadius: "20px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "#ff4778";
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "#ffeef2";
                        e.currentTarget.style.color = "#ff4778";
                      }}
                    >
                      ✓ Đã đọc
                    </button>
                  ) : (
                    <span
                      style={{
                        color: "#b9a8b4",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      Đã xem
                    </span>
                  )}
                </div>

                {/* Unread indicator dot */}
                {!n.IsRead && (
                  <span
                    className="notification-unread-dot"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ff3366",
                      boxShadow: "0 0 6px #ff3366",
                    }}
                  />
                )}
              </div>
            ))
          ) : (
            <div
              className="dashboard-card empty-notifications"
              style={{
                textAlign: "center",
                padding: "48px 24px",
                borderRadius: "16px",
                border: "1px dashed #f5cbd5",
                background: "#fffbfc",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔕</div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "16px",
                  color: "#ff4778",
                  fontWeight: 700,
                }}
              >
                Không có thông báo nào
              </h3>
              <p
                className="muted"
                style={{ margin: 0, fontSize: "13px", color: "#a38f9d" }}
              >
                Bạn hiện tại không có thông báo mới nào từ salon.
              </p>
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
