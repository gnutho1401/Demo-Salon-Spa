import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const STATUS_COLORS = {
  PENDING: { bg: "#fffbeb", color: "#f59e0b", text: "Chờ duyệt" },
  APPROVED: { bg: "#f0fdf4", color: "#22c55e", text: "Đã duyệt" },
  REJECTED: { bg: "#fef2f2", color: "#ef4444", text: "Đã từ chối" },
  UNFROZEN: { bg: "#eff6ff", color: "#3b82f6", text: "Đã hủy đóng băng" },
};

function Badge({ status }) {
  const info = STATUS_COLORS[status] || {
    bg: "#f3f4f6",
    color: "#6b7280",
    text: status,
  };
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
        border: `1px solid ${info.color}30`,
      }}
    >
      {info.text}
    </span>
  );
}

function formatDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("vi-VN");
}

function formatDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("vi-VN");
}

export default function PackageApprovalPage() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/packages/approvals?status=${filter}`);
      setRequests(res.data.data || res.data || []);
    } catch (err) {
      setMessage(
        "❌ " +
          (err.response?.data?.message || "Không tải được danh sách yêu cầu"),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleProcess = async (requestType, requestId, action) => {
    const actionText = action === "APPROVED" ? "duyệt" : "từ chối";
    if (!window.confirm(`Bạn chắc chắn muốn ${actionText} yêu cầu này?`))
      return;

    setProcessingId(requestId);
    try {
      await axiosClient.post(`/packages/approvals/${requestId}/process`, {
        requestType,
        action,
      });
      setMessage(`✅ Đã ${actionText} yêu cầu thành công!`);
      load();
    } catch (err) {
      setMessage(
        "❌ " + (err.response?.data?.message || `Lỗi ${actionText} yêu cầu`),
      );
    }
    setProcessingId(null);
  };

  const pendingCount = requests.filter((r) => r.Status === "PENDING").length;

  return (
    <ReceptionistLayout>
      <div className="spa-dashboard">
        <header className="spa-topbar">
          <div>
            <h1>
              Duyệt yêu cầu liệu trình <span>📋</span>
            </h1>
            <p>
              Quản lý các yêu cầu gia hạn và đóng băng liệu trình từ khách hàng
            </p>
          </div>
        </header>

        {message && (
          <div
            className={message.includes("✅") ? "spa-success" : "spa-error"}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              marginBottom: 16,
              background: message.includes("✅") ? "#f0fdf4" : "#fef2f2",
              color: message.includes("✅") ? "#16a34a" : "#dc2626",
              border: `1px solid ${message.includes("✅") ? "#bbf7d0" : "#fecaca"}`,
            }}
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

        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "PENDING", label: "Chờ duyệt" },
            { value: "APPROVED", label: "Đã duyệt" },
            { value: "REJECTED", label: "Đã từ chối" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border:
                  filter === tab.value
                    ? "2px solid #a0573a"
                    : "1px solid #d4c4b8",
                background: filter === tab.value ? "#fffaf5" : "#fff",
                color: filter === tab.value ? "#a0573a" : "#3d2e26",
                fontWeight: filter === tab.value ? 700 : 500,
                cursor: "pointer",
                fontSize: "0.85rem",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
              {tab.value === "PENDING" && pendingCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "50%",
                    padding: "2px 7px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Request cards */}
        {loading ? (
          <p style={{ color: "#7c6f68", textAlign: "center", padding: 40 }}>
            Đang tải...
          </p>
        ) : requests.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "#7c6f68",
              background: "#fffcf9",
              borderRadius: 14,
              border: "1px solid #f4e7dd",
            }}
          >
            <p style={{ fontSize: "2rem", marginBottom: 8 }}>📭</p>
            <p>Không có yêu cầu nào trong mục này</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {requests.map((r) => (
              <div
                key={`${r.RequestType}-${r.RequestId}`}
                style={{
                  background: "#fff",
                  border: "1px solid #f4e7dd",
                  borderRadius: 14,
                  padding: "18px 20px",
                  display: "grid",
                  gap: 12,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: "1.3rem" }}>
                      {r.RequestType === "EXTENSION" ? "📐" : "❄️"}
                    </span>
                    <div>
                      <b style={{ color: "#3d2e26" }}>
                        {r.RequestType === "EXTENSION"
                          ? `Gia hạn ${r.DaysToExtend} ngày`
                          : `Đóng băng từ ${formatDate(r.FreezeStartDate)}`}
                      </b>
                      <br />
                      <small style={{ color: "#7c6f68" }}>
                        Gửi lúc: {formatDateTime(r.RequestedAt)}
                      </small>
                    </div>
                  </div>
                  <Badge status={r.Status} />
                </div>

                {/* Package info */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 10,
                    padding: "12px 14px",
                    background: "#fffcf9",
                    borderRadius: 10,
                    border: "1px solid #f4e7dd",
                  }}
                >
                  <div>
                    <small style={{ color: "#7c6f68" }}>Liệu trình</small>
                    <br />
                    <b style={{ color: "#3d2e26" }}>{r.PackageName}</b>
                  </div>
                  <div>
                    <small style={{ color: "#7c6f68" }}>Khách hàng</small>
                    <br />
                    <b style={{ color: "#3d2e26" }}>{r.CustomerName}</b>
                    <br />
                    <small style={{ color: "#7c6f68" }}>
                      {r.CustomerPhone} | {r.CustomerEmail}
                    </small>
                  </div>
                  <div>
                    <small style={{ color: "#7c6f68" }}>Tiến độ</small>
                    <br />
                    <b style={{ color: "#3d2e26" }}>
                      {r.UsedSessions}/{r.TotalSessions} buổi
                    </b>
                    <br />
                    <small style={{ color: "#7c6f68" }}>
                      Hạn: {formatDate(r.EndDate)}
                    </small>
                  </div>
                </div>

                {/* Reason */}
                {r.Reason && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#fffaf5",
                      borderRadius: 8,
                      borderLeft: "3px solid #a0573a",
                      color: "#5a4a42",
                      fontSize: "0.85rem",
                    }}
                  >
                    <b>Lý do:</b> {r.Reason}
                  </div>
                )}

                {/* Actions */}
                {r.Status === "PENDING" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={() =>
                        handleProcess(r.RequestType, r.RequestId, "REJECTED")
                      }
                      disabled={processingId === r.RequestId}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 10,
                        border: "1px solid #fecaca",
                        background: "#fff",
                        color: "#dc2626",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() =>
                        handleProcess(r.RequestType, r.RequestId, "APPROVED")
                      }
                      disabled={processingId === r.RequestId}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      {processingId === r.RequestId
                        ? "Đang xử lý..."
                        : "✓ Duyệt"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
