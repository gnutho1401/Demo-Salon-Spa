import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

export default function ReceptionistRescheduleRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING, HISTORY

  // Rejection modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");
      const res = await axiosClient.get(
        "/reschedule/receptionist/reschedule-requests",
      );
      setRequests(res.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không tải được danh sách yêu cầu đổi lịch",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleApprove(id) {
    const ok = window.confirm(
      "Bạn có chắc chắn muốn duyệt và cập nhật lịch hẹn sang thời gian mới?",
    );
    if (!ok) return;

    try {
      setSubmitting(true);
      await axiosClient.put(
        `/reschedule/receptionist/reschedule-requests/${id}/approve`,
      );
      alert("Đã duyệt yêu cầu đổi lịch thành công!");
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác phê duyệt thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectNotes.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      setSubmitting(true);
      await axiosClient.put(
        `/reschedule/receptionist/reschedule-requests/${selectedRequest.RequestId}/reject`,
        {
          notes: rejectNotes,
        },
      );
      alert("Đã từ chối yêu cầu đổi lịch thành công!");
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectNotes("");
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác từ chối thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingRequests = requests.filter((r) => r.Status === "PENDING");
  const historyRequests = requests.filter((r) => r.Status !== "PENDING");
  const displayedRequests =
    activeTab === "PENDING" ? pendingRequests : historyRequests;

  const countPending = pendingRequests.length;
  const countApproved = requests.filter((r) => r.Status === "APPROVED").length;
  const countRejected = requests.filter((r) => r.Status === "REJECTED").length;

  return (
    <ReceptionistLayout>
      <div
        className="rx-resched-page"
        style={{ padding: "24px", fontFamily: "var(--font-body, sans-serif)" }}
      >
        {/* Style block for local styling overrides */}
        <style>{`
          .rx-resched-page h1 {
            font-family: var(--font-heading, serif);
            font-size: 2rem;
            color: #1e3a29;
            margin: 0 0 6px 0;
            font-weight: 700;
          }
          .rx-resched-page p {
            color: #718096;
            margin: 0 0 24px 0;
            font-size: 0.95rem;
          }
          
          /* Stats Grid */
          .rx-stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .rx-stat-card {
            background: #ffffff;
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
            border: 1px solid rgba(0, 0, 0, 0.05);
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .rx-stat-icon {
            font-size: 2rem;
            width: 50px;
            height: 50px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rx-stat-val {
            font-size: 1.5rem;
            font-weight: 800;
            color: #1e3a29;
            line-height: 1.2;
          }
          .rx-stat-lbl {
            font-size: 0.8rem;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Tabs Control */
          .rx-tabs {
            display: flex;
            gap: 12px;
            border-bottom: 2px solid #e2e8f0;
            margin-bottom: 24px;
          }
          .rx-tab-btn {
            background: none;
            border: none;
            padding: 12px 20px;
            font-size: 0.95rem;
            font-weight: 600;
            color: #718096;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
          }
          .rx-tab-btn.active {
            color: #1e3a29;
          }
          .rx-tab-btn.active::after {
            content: "";
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background-color: #1e3a29;
          }
          .rx-badge-count {
            background: #e2e8f0;
            color: #4a5568;
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: 6px;
          }
          .rx-tab-btn.active .rx-badge-count {
            background: #1e3a29;
            color: #ffffff;
          }

          /* Request Cards list */
          .rx-cards-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .rx-card {
            background: #ffffff;
            border-radius: 16px;
            border: 1.5px solid #edf2f7;
            padding: 24px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.02);
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
          }
          .rx-card:hover {
            border-color: #cbd5e0;
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.04);
          }
          .rx-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
          }
          .rx-card-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1e3a29;
            margin: 0;
          }
          .rx-card-badge {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 12px;
            text-transform: uppercase;
          }
          .rx-badge-pending { background: #feebc8; color: #c05621; }
          .rx-badge-approved { background: #c6f6d5; color: #22543d; }
          .rx-badge-rejected { background: #fed7d7; color: #9b2c2c; }
          .rx-badge-awaiting-customer { background: #dbeafe; color: #1e40af; }
          .rx-badge-customer-rejected { background: #fde8e8; color: #991b1b; }
          .rx-badge-system-cancelled { background: #fee2e2; color: #991b1b; }

          /* Details Columns */
          .rx-card-body {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .rx-time-comparison {
            background: #f7fafc;
            border-radius: 12px;
            padding: 14px;
            border: 1px dashed #e2e8f0;
          }
          .rx-time-item {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            margin-bottom: 6px;
          }
          .rx-time-item:last-child {
            margin-bottom: 0;
          }
          .rx-reason-box {
            font-size: 0.9rem;
            color: #4a5568;
            line-height: 1.5;
          }
          .rx-reason-box strong {
            display: block;
            margin-bottom: 4px;
            color: #1e3a29;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Buttons */
          .rx-card-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            border-top: 1px solid #edf2f7;
            padding-top: 16px;
          }
          .rx-btn {
            padding: 8px 18px;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .rx-btn-secondary {
            background: #ffffff;
            border: 1.5px solid #cbd5e0;
            color: #4a5568;
          }
          .rx-btn-secondary:hover {
            background: #f7fafc;
            border-color: #a0aec0;
          }
          .rx-btn-primary {
            background: #2f593a;
            border: none;
            color: #ffffff;
          }
          .rx-btn-primary:hover {
            background: #1e3a29;
            transform: translateY(-1px);
          }
          .rx-btn-danger {
            background: #e53e3e;
            border: none;
            color: #ffffff;
          }
          .rx-btn-danger:hover {
            background: #c53030;
            transform: translateY(-1px);
          }
        `}</style>

        <header>
          <h1>Duyệt yêu cầu đổi lịch</h1>
          <p>
            Danh sách các yêu cầu dời lịch hẹn, đổi giờ làm việc từ đội ngũ kỹ
            thuật viên.
          </p>
        </header>

        {/* Stats Row */}
        <section className="rx-stats-row">
          <div className="rx-stat-card">
            <div
              className="rx-stat-icon"
              style={{ background: "#feebc8", color: "#dd6b20" }}
            >
              📅
            </div>
            <div>
              <div className="rx-stat-val">{countPending}</div>
              <div className="rx-stat-lbl">Chờ phê duyệt</div>
            </div>
          </div>

          <div className="rx-stat-card">
            <div
              className="rx-stat-icon"
              style={{ background: "#c6f6d5", color: "#38a169" }}
            >
              ✓
            </div>
            <div>
              <div className="rx-stat-val">{countApproved}</div>
              <div className="rx-stat-lbl">Đã đồng ý</div>
            </div>
          </div>

          <div className="rx-stat-card">
            <div
              className="rx-stat-icon"
              style={{ background: "#fed7d7", color: "#e53e3e" }}
            >
              ✕
            </div>
            <div>
              <div className="rx-stat-val">{countRejected}</div>
              <div className="rx-stat-lbl">Đã từ chối</div>
            </div>
          </div>
        </section>

        {/* Tabs Control */}
        <nav className="rx-tabs">
          <button
            type="button"
            className={`rx-tab-btn ${activeTab === "PENDING" ? "active" : ""}`}
            onClick={() => setActiveTab("PENDING")}
          >
            Đang chờ duyệt{" "}
            <span className="rx-badge-count">{countPending}</span>
          </button>
          <button
            type="button"
            className={`rx-tab-btn ${activeTab === "HISTORY" ? "active" : ""}`}
            onClick={() => setActiveTab("HISTORY")}
          >
            Lịch sử đã duyệt/từ chối{" "}
            <span className="rx-badge-count">
              {countApproved + countRejected}
            </span>
          </button>
        </nav>

        {/* Main Content Area */}
        {loading ? (
          <div
            style={{ textAlign: "center", padding: "50px 0", color: "#718096" }}
          >
            Đang tải danh sách yêu cầu...
          </div>
        ) : error ? (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fed7d7",
              color: "#c53030",
              padding: "16px",
              borderRadius: "12px",
            }}
          >
            {error}
          </div>
        ) : displayedRequests.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                fontSize: "2.5rem",
                display: "block",
                marginBottom: "12px",
              }}
            >
              📂
            </span>
            <h4
              style={{
                margin: "0 0 6px 0",
                color: "#4a5568",
                fontWeight: "700",
              }}
            >
              Không tìm thấy yêu cầu nào
            </h4>
            <p style={{ margin: 0 }}>Danh sách hiện đang trống.</p>
          </div>
        ) : (
          <div className="rx-cards-list">
            {displayedRequests.map((req) => {
              const reqDate = new Date(req.RequestedDate).toLocaleDateString(
                "vi-VN",
              );
              const origDate = new Date(req.OriginalDate).toLocaleDateString(
                "vi-VN",
              );
              const createdAtDate = new Date(req.CreatedAt).toLocaleString(
                "vi-VN",
              );

              return (
                <article key={req.RequestId} className="rx-card">
                  <div className="rx-card-header">
                    <div>
                      <h3 className="rx-card-title">
                        Yêu cầu đổi lịch #{req.RequestId}
                      </h3>
                      <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
                        Gửi lúc: {createdAtDate}
                      </span>
                    </div>

                    <span
                      className={`rx-card-badge rx-badge-${String(req.Status).toLowerCase().replaceAll("_", "-")}`}
                    >
                      {req.Status === "PENDING"
                        ? "Chờ duyệt"
                        : req.Status === "APPROVED"
                          ? "Đã duyệt"
                          : req.Status === "AWAITING_CUSTOMER"
                            ? "Chờ KH xác nhận"
                            : req.Status === "CUSTOMER_REJECTED"
                              ? "KH từ chối"
                              : req.Status === "SYSTEM_CANCELLED"
                                ? "Tự động hủy (Trùng lịch)"
                                : "Bị từ chối"}
                    </span>
                  </div>

                  <div className="rx-card-body">
                    <div className="rx-time-comparison">
                      <div className="rx-time-item">
                        <span style={{ color: "#718096" }}>Khách hàng:</span>
                        <strong style={{ color: "#2d3748" }}>
                          {req.CustomerName}
                        </strong>
                      </div>
                      <div className="rx-time-item">
                        <span style={{ color: "#718096" }}>Kỹ thuật viên:</span>
                        <strong style={{ color: "#2d3748" }}>
                          {req.TechName}
                        </strong>
                      </div>
                      <div
                        className="rx-time-item"
                        style={{
                          borderTop: "1px solid #e2e8f0",
                          paddingTop: "6px",
                          marginTop: "6px",
                        }}
                      >
                        <span style={{ color: "#718096" }}>Thời gian gốc:</span>
                        <strong style={{ color: "#718096" }}>
                          {origDate} {req.OriginalStartTime}
                        </strong>
                      </div>
                      <div className="rx-time-item">
                        <span style={{ color: "#1e3a29", fontWeight: "600" }}>
                          Đề xuất mới:
                        </span>
                        <strong style={{ color: "#2f593a", fontWeight: "700" }}>
                          {reqDate} {req.RequestedStartTime} -{" "}
                          {req.RequestedEndTime}
                        </strong>
                      </div>
                    </div>

                    <div className="rx-reason-box">
                      <strong>Lý do từ KTV:</strong>
                      <p
                        style={{
                          margin: "0 0 12px 0",
                          fontStyle: "italic",
                          color: "#4a5568",
                        }}
                      >
                        &ldquo;{req.Reason || "Không có lý do chi tiết."}&rdquo;
                      </p>

                      {req.Notes && (
                        <div
                          style={{
                            marginTop: "12px",
                            background: "#f7fafc",
                            padding: "10px",
                            borderRadius: "8px",
                            borderLeft: "3px solid #cbd5e0",
                          }}
                        >
                          <strong
                            style={{
                              margin: 0,
                              fontSize: "0.75rem",
                              color: "#718096",
                            }}
                          >
                            Phản hồi từ lễ tân:
                          </strong>
                          <p
                            style={{
                              margin: "2px 0 0 0",
                              fontSize: "0.85rem",
                              color: "#4a5568",
                            }}
                          >
                            {req.Notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {req.Status === "PENDING" && (
                    <div className="rx-card-actions">
                      <button
                        type="button"
                        className="rx-btn rx-btn-secondary"
                        disabled={submitting}
                        onClick={() => {
                          setSelectedRequest(req);
                          setShowRejectModal(true);
                        }}
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        className="rx-btn rx-btn-primary"
                        disabled={submitting}
                        onClick={() => handleApprove(req.RequestId)}
                      >
                        Đồng ý duyệt
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Reject Dialog Modal */}
        {showRejectModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                padding: "24px",
                width: "100%",
                maxWidth: "420px",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px 0",
                  color: "#1e3a29",
                  fontWeight: "700",
                }}
              >
                Từ chối yêu cầu đổi lịch
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#718096",
                  margin: "0 0 16px 0",
                }}
              >
                Vui lòng nhập phản hồi hoặc lý do từ chối cho KTV biết lý do
                không đồng ý đề xuất này.
              </p>

              <form onSubmit={handleRejectSubmit}>
                <textarea
                  required
                  placeholder="Lý do từ chối (ví dụ: Trùng lịch, không đủ phòng trống...)"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e0",
                    outline: "none",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    resize: "none",
                    marginBottom: "20px",
                    boxSizing: "border-box",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="rx-btn rx-btn-secondary"
                    disabled={submitting}
                    onClick={() => {
                      setShowRejectModal(false);
                      setSelectedRequest(null);
                      setRejectNotes("");
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rx-btn rx-btn-danger"
                    disabled={submitting}
                  >
                    {submitting ? "Đang xử lý..." : "Từ chối yêu cầu"}
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
