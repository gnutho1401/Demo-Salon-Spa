import React, { useState, useEffect, useMemo } from "react";
import axiosClient from "../../api/axiosClient";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";
import "../../styles/pages/admin.css";

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
}

export default function AdminRefunds() {
  const [allRefunds, setAllRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PENDING, COMPLETED, REJECTED
  const [keyword, setKeyword] = useState("");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRefundId, setSelectedRefundId] = useState(null);

  const [toast, setToast] = useState({ open: false, message: "", type: "success" });
  const [confirmRefund, setConfirmRefund] = useState(null);
  const [processingRefund, setProcessingRefund] = useState(false);

  function showToast(message, type = "success") {
    setToast({ open: true, message, type });
    setTimeout(() => {
      setToast({ open: false, message: "", type: "success" });
    }, 3000);
  }

  async function loadRefunds() {
    try {
      setLoading(true);
      setError("");
      // Fetch all refunds at once to compute stats locally
      const res = await axiosClient.get("/admin/refunds?status=");
      setAllRefunds(res.data?.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách hoàn tiền");
      showToast(err.response?.data?.message || "Không thể tải danh sách hoàn tiền", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRefunds();
  }, []);

  // Compute statistics locally
  const stats = useMemo(() => {
    let pendingCount = 0;
    let pendingSum = 0;
    let completedCount = 0;
    let completedSum = 0;
    let rejectedCount = 0;
    let rejectedSum = 0;

    allRefunds.forEach((r) => {
      const amt = Number(r.RefundAmount || 0);
      const status = String(r.RefundStatus || "").toUpperCase();
      if (status === "PENDING") {
        pendingCount++;
        pendingSum += amt;
      } else if (status === "COMPLETED") {
        completedCount++;
        completedSum += amt;
      } else if (status === "REJECTED") {
        rejectedCount++;
        rejectedSum += amt;
      }
    });

    return {
      pending: { count: pendingCount, sum: pendingSum },
      completed: { count: completedCount, sum: completedSum },
      rejected: { count: rejectedCount, sum: rejectedSum },
    };
  }, [allRefunds]);

  // Compute filtered refunds
  const filteredRefunds = useMemo(() => {
    return allRefunds.filter((r) => {
      const matchStatus =
        statusFilter === "ALL" ||
        String(r.RefundStatus).toUpperCase() === statusFilter.toUpperCase();

      const term = keyword.toLowerCase().trim();
      const matchKeyword =
        !term ||
        String(r.CustomerName || "").toLowerCase().includes(term) ||
        String(r.CustomerPhone || "").toLowerCase().includes(term) ||
        String(r.TransactionCode || "").toLowerCase().includes(term) ||
        String(r.RefundId || "").toLowerCase().includes(term) ||
        String(r.PayosPayoutId || "").toLowerCase().includes(term) ||
        String(r.AccountNumber || "").toLowerCase().includes(term);

      return matchStatus && matchKeyword;
    });
  }, [allRefunds, statusFilter, keyword]);

  async function processRefund(id, manual = false) {
    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.post(`/admin/refunds/${id}/process`, { manual });
      const successText = manual 
        ? "Đã duyệt xác nhận hoàn tiền thủ công!" 
        : "Hoàn tiền tự động qua PayOS thành công!";
      setSuccessMsg(successText);
      showToast(successText, "success");
      loadRefunds();
    } catch (err) {
      const errText = err.response?.data?.message || "Xử lý hoàn tiền thất bại";
      setError(errText);
      showToast(errText, "error");
    }
  }

  function requestRefund(refund, manual) {
    setConfirmRefund({ refund, manual });
  }

  async function handleConfirmRefund() {
    if (!confirmRefund) return;
    setProcessingRefund(true);
    try {
      await processRefund(confirmRefund.refund.RefundId, confirmRefund.manual);
      setConfirmRefund(null);
    } finally {
      setProcessingRefund(false);
    }
  }

  function openRejectModal(id) {
    setSelectedRefundId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function handleReject(e) {
    e.preventDefault();
    if (!rejectReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối", "error");
      return;
    }

    try {
      setError("");
      setSuccessMsg("");
      await axiosClient.post(`/admin/refunds/${selectedRefundId}/reject`, { reason: rejectReason });
      showToast("Đã từ chối yêu cầu hoàn tiền!", "success");
      setRejectModalOpen(false);
      loadRefunds();
    } catch (err) {
      const errText = err.response?.data?.message || "Từ chối hoàn tiền thất bại";
      setError(errText);
      showToast(errText, "error");
    }
  }

  function handleCopy(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, "success");
  }

  return (
    <div className="refund-hub-container">
        {/* Header wrapper */}
        <div className="refund-header-wrapper">
          <div className="refund-header-title">
            <h1>Trung tâm Hoàn tiền</h1>
            <p>Xử lý, đối soát và hoàn tiền tự động hoặc thủ công cho khách hàng</p>
          </div>
          <button className="refund-refresh-btn" onClick={loadRefunds}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Làm mới dữ liệu
          </button>
        </div>

        {/* Stats Grid */}
        <div className="refund-stats-grid">
          <div 
            className={`refund-stat-card-custom pending ${statusFilter === "PENDING" ? "active-filter" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
          >
            <div className="refund-stat-info">
              <span className="refund-stat-label">Chờ xử lý</span>
              <span className="refund-stat-value">{stats.pending.count}</span>
              <span className="refund-stat-subtext">Cần hoàn: {money(stats.pending.sum)}</span>
            </div>
            <div className="refund-stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>

          <div 
            className={`refund-stat-card-custom completed ${statusFilter === "COMPLETED" ? "active-filter" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
          >
            <div className="refund-stat-info">
              <span className="refund-stat-label">Đã hoàn thành</span>
              <span className="refund-stat-value">{stats.completed.count}</span>
              <span className="refund-stat-subtext">Tổng tiền: {money(stats.completed.sum)}</span>
            </div>
            <div className="refund-stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 11 11 13 15 9" />
              </svg>
            </div>
          </div>

          <div 
            className={`refund-stat-card-custom rejected ${statusFilter === "REJECTED" ? "active-filter" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "ALL" : "REJECTED")}
          >
            <div className="refund-stat-info">
              <span className="refund-stat-label">Đã từ chối</span>
              <span className="refund-stat-value">{stats.rejected.count}</span>
              <span className="refund-stat-subtext">Tổng tiền: {money(stats.rejected.sum)}</span>
            </div>
            <div className="refund-stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Toolbar and filter */}
        <div className="refund-toolbar-custom">
          <div className="refund-search-wrapper">
            <div className="refund-search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Tìm tên khách, số điện thoại, số tài khoản, mã GD..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="refund-search-input"
            />
          </div>

          <div className="refund-tabs">
            <button 
              className={`refund-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              Tất cả ({allRefunds.length})
            </button>
            <button 
              className={`refund-tab-btn ${statusFilter === "PENDING" ? "active" : ""}`}
              onClick={() => setStatusFilter("PENDING")}
            >
              Chờ duyệt ({stats.pending.count})
            </button>
            <button 
              className={`refund-tab-btn ${statusFilter === "COMPLETED" ? "active" : ""}`}
              onClick={() => setStatusFilter("COMPLETED")}
            >
              Đã hoàn ({stats.completed.count})
            </button>
            <button 
              className={`refund-tab-btn ${statusFilter === "REJECTED" ? "active" : ""}`}
              onClick={() => setStatusFilter("REJECTED")}
            >
              Từ chối ({stats.rejected.count})
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="admin-alert error" style={{ margin: 0 }}>{error}</div>}
        {successMsg && <div className="admin-alert success" style={{ margin: 0 }}>{successMsg}</div>}

        {/* Card list */}
        <div className="refund-card-list">
          {loading ? (
            <div className="admin-loading" style={{ padding: "40px" }}>Đang tải dữ liệu hoàn tiền...</div>
          ) : filteredRefunds.length === 0 ? (
            <div className="refund-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h3>Không tìm thấy yêu cầu hoàn tiền nào</h3>
              <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn</p>
            </div>
          ) : (
            filteredRefunds.map((r) => (
              <div className="refund-item-card" key={r.RefundId}>
                {/* Column 1: Refund code & original payment ID */}
                <div className="refund-col-id">
                  <span className="refund-code-badge">#{String(r.RefundId).padStart(4, "0")}</span>
                  <span className="refund-meta-sub">Mã Refund: #{r.RefundId}</span>
                  <span className="refund-meta-sub">Mã Payment: #{r.PaymentId}</span>
                  <span className="refund-meta-sub" style={{ marginTop: "4px" }}>
                    Yêu cầu: {formatDateTime(r.CreatedAt)}
                  </span>
                </div>

                {/* Column 2: Customer */}
                <div className="refund-col-customer">
                  <div className="refund-avatar">
                    {String(r.CustomerName || "K").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="refund-customer-info">
                    <span className="refund-customer-name">{r.CustomerName}</span>
                    <span className="refund-customer-phone">{r.CustomerPhone}</span>
                  </div>
                </div>

                {/* Column 3: Original bill */}
                <div className="refund-col-billing">
                  <span className={`refund-method-badge ${String(r.PaymentMethod || "").toLowerCase()}`}>
                    {r.PaymentMethod}
                  </span>
                  {r.TransactionCode && (
                    <span className="refund-tx-code" style={{ fontFamily: "monospace", fontSize: "11px" }}>
                      GD: {r.TransactionCode}
                    </span>
                  )}
                  <span className="refund-meta-sub">
                    Gốc: <b>{money(r.PaymentAmount)}</b>
                  </span>
                </div>

                {/* Column 4: Refund Bank Account details */}
                <div className="refund-col-bank">
                  {r.AccountNumber ? (
                    <div className="refund-bank-card-mock">
                      <div className="refund-bank-header">
                        <span>🏦 {r.BankCode}</span>
                      </div>
                      <div className="refund-bank-number">
                        <span>{r.AccountNumber}</span>
                        <button 
                          className="refund-copy-icon-btn" 
                          onClick={() => handleCopy(r.AccountNumber, "số tài khoản")}
                          title="Sao chép số tài khoản"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                      <div className="refund-bank-holder">
                        {r.AccountName}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "#9b8062", fontSize: "0.85rem", fontStyle: "italic" }}>
                      Thanh toán thủ công (Không qua API)
                    </span>
                  )}
                </div>

                {/* Column 5: Refund amount & status + actions */}
                <div className="refund-col-amount">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="refund-amount-val">{money(r.RefundAmount)}</span>
                    <span className={`refund-status-custom-badge ${String(r.RefundStatus).toLowerCase()}`}>
                      {r.RefundStatus === "PENDING" && "Chờ duyệt"}
                      {r.RefundStatus === "COMPLETED" && "Đã hoàn"}
                      {r.RefundStatus === "REJECTED" && "Từ chối"}
                    </span>
                  </div>

                  {r.RefundReason && (
                    <span className="refund-meta-sub" style={{ fontStyle: "italic", whiteSpace: "normal" }}>
                      Lý do: {r.RefundReason}
                    </span>
                  )}

                  <div className="refund-col-actions" style={{ marginTop: "6px" }}>
                    {r.RefundStatus === "PENDING" && (
                      <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
                        {String(r.PaymentMethod).toUpperCase() === "PAYOS" ? (
                          <>
                            <button
                              className="refund-btn-payout-auto"
                              onClick={() => requestRefund(r, false)}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              ⚡ Hoàn PayOS
                            </button>
                            <button
                              className="refund-btn-payout-manual"
                              onClick={() => requestRefund(r, true)}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                              Duyệt thủ công (Bypass)
                            </button>
                          </>
                        ) : (
                          <button
                            className="refund-btn-payout-manual"
                            onClick={() => requestRefund(r, true)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            Duyệt thủ công
                          </button>
                        )}
                        
                        <button
                          className="refund-btn-reject"
                          onClick={() => openRejectModal(r.RefundId)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          Từ chối
                        </button>
                      </div>
                    )}
                    {r.RefundStatus === "COMPLETED" && (
                      <div className="refund-processed-info">
                        <div>Đã xử lý: {formatDateTime(r.RefundedAt)}</div>
                        {r.PayosPayoutId && (
                          <div style={{ fontFamily: "monospace", fontSize: "10px", marginTop: "2px" }}>
                            Payout: {r.PayosPayoutId}
                          </div>
                        )}
                      </div>
                    )}
                    {r.RefundStatus === "REJECTED" && (
                      <div className="refund-processed-info" style={{ color: "#b91c1c", backgroundColor: "#fff2f2" }}>
                        <div>Đã từ chối: {formatDateTime(r.RefundedAt)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <AdminConfirmDialog
          open={Boolean(confirmRefund)}
          title={confirmRefund?.manual ? "Xác nhận đã hoàn tiền thủ công?" : "Hoàn tiền qua PayOS?"}
          description={
            confirmRefund?.manual
              ? "Chỉ tiếp tục khi tiền đã được chuyển bên ngoài hệ thống. Thao tác này sẽ đánh dấu yêu cầu là đã hoàn tất."
              : "Hệ thống sẽ gửi lệnh hoàn tiền thật đến PayOS. Vui lòng đối chiếu khách hàng và số tiền trước khi tiếp tục."
          }
          details={
            confirmRefund ? (
              <>
                <strong>{confirmRefund.refund.CustomerName || "Khách hàng"}</strong>
                <span> · {money(confirmRefund.refund.RefundAmount)}</span>
                {confirmRefund.refund.TransactionCode ? (
                  <div>Mã giao dịch: {confirmRefund.refund.TransactionCode}</div>
                ) : null}
              </>
            ) : null
          }
          confirmLabel={confirmRefund?.manual ? "Đã chuyển tiền" : "Hoàn qua PayOS"}
          tone="danger"
          busy={processingRefund}
          onCancel={() => setConfirmRefund(null)}
          onConfirm={handleConfirmRefund}
        />

        {/* Modal từ chối hoàn tiền */}
        {rejectModalOpen && (
          <div className="refund-modal-backdrop" onClick={() => setRejectModalOpen(false)}>
            <div className="refund-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="refund-modal-header">
                <h2>Từ chối hoàn tiền #{selectedRefundId}</h2>
                <button className="refund-modal-close-btn" onClick={() => setRejectModalOpen(false)}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleReject}>
                <div className="refund-modal-body">
                  <div className="refund-form-group">
                    <label>Lý do từ chối:</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Nhập lý do từ chối chi tiết gửi tới khách hàng..."
                      className="refund-form-textarea"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="refund-modal-footer">
                  <button type="button" className="refund-modal-btn-cancel" onClick={() => setRejectModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="refund-modal-btn-submit">
                    Xác nhận từ chối
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Toast Notifications */}
        {toast.open && (
          <div className={`refund-toast ${toast.type}`}>
            {toast.type === "success" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
  );
}
