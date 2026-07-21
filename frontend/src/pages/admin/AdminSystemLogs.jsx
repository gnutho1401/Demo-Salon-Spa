import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminSystemLogs() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Available filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    actionTypes: []
  });

  const [filters, setFilters] = useState({
    keyword: "",
    actionType: "",
    userId: "",
    module: "",
    fromDate: "",
    toDate: ""
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15
  });

  const modulesList = [
    { value: "Customer", label: "Khách hàng" },
    { value: "Employee", label: "Nhân viên" },
    { value: "Service", label: "Dịch vụ" },
    { value: "Promotion", label: "Khuyến mãi" },
    { value: "Voucher", label: "Voucher" },
    { value: "Membership", label: "Hạng thành viên" },
    { value: "Refund", label: "Hoàn tiền" },
    { value: "WorkShift", label: "Ca làm việc" },
    { value: "Appointment", label: "Lịch hẹn" },
    { value: "Feedback", label: "Ý kiến phản hồi" },
    { value: "Review", label: "Đánh giá" }
  ];

  const loadFilterOptions = async () => {
    try {
      const res = await axiosClient.get("/admin/system-logs/filters");
      setFilterOptions(res.data.data || res.data || { users: [], actionTypes: [] });
    } catch (err) {
      console.error("Error loading log filters", err);
    }
  };

  const loadLogs = async (currentPage = pagination.page, currentLimit = pagination.limit) => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: currentPage,
        limit: currentLimit
      };
      const res = await axiosClient.get("/admin/system-logs", { params });
      const resData = res.data.data || res.data || {};
      setLogs(resData.logs || []);
      setTotalCount(resData.totalCount || 0);
    } catch (err) {
      console.error("Error loading system logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    loadLogs(1, pagination.limit);
  }, []);

  const scrollToTable = () => {
    const tableWrapper = document.getElementById("logs-table-wrapper");
    if (tableWrapper) {
      tableWrapper.scrollTop = 0;
    }
    const logsCard = document.getElementById("logs-card-section");
    if (logsCard) {
      logsCard.scrollIntoView({ behavior: "instant" });
    }
  };

  const handleApply = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLogs(1, pagination.limit);
    setTimeout(scrollToTable, 100);
  };

  const handleReset = () => {
    const defaultFilters = {
      keyword: "",
      actionType: "",
      userId: "",
      module: "",
      fromDate: "",
      toDate: ""
    };
    setFilters(defaultFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    setLoading(true);
    axiosClient.get("/admin/system-logs", {
      params: { ...defaultFilters, page: 1, limit: pagination.limit }
    })
      .then(res => {
        const resData = res.data.data || res.data || {};
        setLogs(resData.logs || []);
        setTotalCount(resData.totalCount || 0);
        setTimeout(scrollToTable, 100);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    loadLogs(newPage, pagination.limit);
    setTimeout(scrollToTable, 100);
  };

  const handleLimitChange = (newLimit) => {
    setPagination({ page: 1, limit: newLimit });
    loadLogs(1, newLimit);
    setTimeout(scrollToTable, 100);
  };

  const openDetail = async (item) => {
    try {
      const res = await axiosClient.get(`/admin/system-logs/${item.LogId}`);
      setSelected(res.data.data || res.data || item);
    } catch (err) {
      console.error("Error loading log detail", err);
      setSelected(item);
    }
  };

  // Export to CSV
  const exportToCSV = async () => {
    setLoading(true);
    try {
      // Fetch up to 100,000 logs matching the current filters for export
      const params = {
        ...filters,
        page: 1,
        limit: 100000
      };
      const res = await axiosClient.get("/admin/system-logs", { params });
      const resData = res.data.data || res.data || {};
      const allLogs = resData.logs || [];

      if (allLogs.length === 0) {
        alert("Không có dữ liệu nhật ký phù hợp để xuất!");
        return;
      }

      const headers = [
        "Mã Nhật Ký",
        "Người Thực Hiện",
        "Email",
        "Vai Trò",
        "Hành Động",
        "Loại Hành Động",
        "Mô Tả",
        "Địa Chỉ IP",
        "Thời Gian Tạo",
        "Dữ Liệu Cũ (Old Value)",
        "Dữ Liệu Mới (New Value)"
      ];

      const rows = allLogs.map(item => [
        item.LogId,
        `"${item.UserName || 'Hệ thống'}"`,
        `"${item.Email || ''}"`,
        `"${item.RoleName || ''}"`,
        `"${item.ActionName || ''}"`,
        item.ActionType || "",
        `"${(item.Description || '').replace(/"/g, '""')}"`,
        item.IpAddress || "",
        item.CreatedAt ? new Date(item.CreatedAt).toLocaleString("vi-VN") : "",
        `"${(item.OldValue || '').replace(/"/g, '""')}"`,
        `"${(item.NewValue || '').replace(/"/g, '""')}"`
      ]);

      // Add BOM to make Excel render UTF-8 Vietnamese chars correctly
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Nhat_ky_he_thong_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error", err);
      alert("Đã xảy ra lỗi khi xuất file!");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pagination.limit) || 1;

  // Pretty JSON value formatter
  const formatJSONValue = (val) => {
    if (!val) return "Không có dữ liệu";
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return val;
    }
  };

  return (
    <section className="admin-page">
      <style>{`
        .admin-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .dashboard-title {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .filter-card {
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          margin-bottom: 24px;
        }
        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-item label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }
        .filter-input {
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          background: #f8fafc;
        }
        .filter-input:focus {
          border-color: #a0573a;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(160, 87, 58, 0.1);
        }
        .actions-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-primary {
          background: #a0573a;
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover {
          background: #8b4a2f;
          transform: translateY(-1px);
        }
        .btn-outline {
          background: transparent;
          color: #64748b;
          border: 1px solid #cbd5e1;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-outline:hover {
          background: #f1f5f9;
          color: #334155;
        }
        .logs-card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          overflow: hidden;
          margin-bottom: 24px;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .logs-table th {
          background: #f1f5f9;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .logs-table td {
          font-size: 14px;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .logs-table tr:hover td {
          background: #f8fafc;
        }
        .action-type-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }
        .badge-create { background: #dcfce7; color: #15803d; }
        .badge-update { background: #dbeafe; color: #1d4ed8; }
        .badge-delete { background: #fee2e2; color: #b91c1c; }
        .badge-status { background: #fef3c7; color: #d97706; }
        
        /* Modal detailing style */
        .log-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.2s;
        }
        .log-modal-card {
          background: #ffffff;
          width: 90%;
          max-width: 750px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-header {
          background: #f8fafc;
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-body {
          padding: 24px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .diff-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        @media (max-width: 600px) {
          .diff-container {
            grid-template-columns: 1fr;
          }
        }
        .diff-box {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          overflow: auto;
          max-height: 250px;
        }
        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }
        .page-btn {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          padding: 6px 12px;
          font-size: 13px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          color: #334155;
        }
        .page-btn:hover:not(:disabled) {
          border-color: #a0573a;
          color: #a0573a;
        }
        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="header-container">
        <div>
          <div className="eyebrow" style={{ color: "#a0573a", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "11px", marginBottom: "4px" }}>
            Giám sát & Bảo mật
          </div>
          <h2 className="dashboard-title">Nhật Ký Hoạt Động Hệ Thống</h2>
        </div>
        <button className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={exportToCSV}>
          <svg style={{ width: "16px", height: "16px", fill: "currentColor" }} viewBox="0 0 24 24">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
          </svg>
          Xuất Nhật Ký CSV
        </button>
      </div>

      {/* Filters Section */}
      <div className="filter-card">
        <div className="filter-grid">
          <div className="filter-item">
            <label>Tìm kiếm chi tiết</label>
            <input
              type="text"
              className="filter-input"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="Hành động, nội dung, IP..."
            />
          </div>
          <div className="filter-item">
            <label>Người thực hiện</label>
            <select
              className="filter-input"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            >
              <option value="">Tất cả quản trị viên</option>
              {filterOptions.users.map((u) => (
                <option key={u.UserId} value={u.UserId}>{u.UserName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Phân hệ (Module)</label>
            <select
              className="filter-input"
              value={filters.module}
              onChange={(e) => setFilters({ ...filters, module: e.target.value })}
            >
              <option value="">Tất cả phân hệ</option>
              {modulesList.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Loại thao tác</label>
            <select
              className="filter-input"
              value={filters.actionType}
              onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
            >
              <option value="">Tất cả thao tác</option>
              {filterOptions.actionTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Từ ngày</label>
            <input
              type="date"
              className="filter-input"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            />
          </div>
          <div className="filter-item">
            <label>Đến ngày</label>
            <input
              type="date"
              className="filter-input"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button className="btn-outline" onClick={handleReset}>Đặt lại</button>
          <button className="btn-primary" onClick={handleApply}>Lọc danh sách</button>
        </div>
      </div>

      {/* Log list card */}
      <div className="logs-card" id="logs-card-section">
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            Đang tải dữ liệu lịch sử nhật ký...
          </div>
        ) : (
          <>
            <div id="logs-table-wrapper" style={{ overflowX: "auto", maxHeight: "550px", overflowY: "auto", position: "relative" }}>
              <table className="logs-table">
                <thead>
                  <tr>
                    <th style={{ width: "80px" }}>Log ID</th>
                    <th style={{ width: "180px" }}>Người thực hiện</th>
                    <th style={{ width: "120px" }}>Thao tác</th>
                    <th style={{ width: "200px" }}>Hành động</th>
                    <th>Mô tả hoạt động</th>
                    <th style={{ width: "120px" }}>IP Address</th>
                    <th style={{ width: "160px" }}>Thời gian</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item) => (
                    <tr key={item.LogId}>
                      <td style={{ fontWeight: 600, color: "#64748b" }}>#{item.LogId}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#1e293b" }}>{item.UserName || "Hệ thống"}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{item.RoleName}</div>
                      </td>
                      <td>
                        <span className={`action-type-badge badge-${(item.ActionType || '').toLowerCase()}`}>
                          {item.ActionType}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.ActionName}</td>
                      <td style={{ color: "#475569", fontSize: "13px" }}>{item.Description}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748b" }}>{item.IpAddress || "localhost"}</td>
                      <td style={{ fontSize: "13px", color: "#64748b" }}>
                        {item.CreatedAt ? new Date(item.CreatedAt).toLocaleString("vi-VN") : ""}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn-outline"
                          style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "6px" }}
                          onClick={() => openDetail(item)}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>
                        Không có dữ liệu nhật ký phù hợp bộ lọc
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="pagination-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  Tổng cộng: <strong>{totalCount}</strong> dòng nhật ký • Hiển thị
                </span>
                <select
                  className="filter-input"
                  style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "6px", background: "#ffffff" }}
                  value={pagination.limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                >
                  <option value={10}>10 dòng</option>
                  <option value={15}>15 dòng</option>
                  <option value={30}>30 dòng</option>
                  <option value={50}>50 dòng</option>
                </select>
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    className="page-btn"
                    disabled={pagination.page === 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    Trước
                  </button>
                  <span style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>
                    Trang {pagination.page} / {totalPages}
                  </span>
                  <button
                    className="page-btn"
                    disabled={pagination.page === totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    Sau
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {selected ? (
        <div className="log-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="log-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className={`action-type-badge badge-${(selected.ActionType || '').toLowerCase()}`} style={{ marginRight: "10px" }}>
                  {selected.ActionType}
                </span>
                <strong style={{ fontSize: "16px", color: "#1e293b" }}>{selected.ActionName}</strong>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "transparent", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px", fontSize: "13px" }}>
                <div>
                  <div style={{ color: "#64748b" }}>Người thực hiện:</div>
                  <strong style={{ color: "#334155" }}>{selected.UserName || "Hệ thống"} ({selected.RoleName})</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b" }}>Địa chỉ IP:</div>
                  <strong style={{ color: "#334155" }}>{selected.IpAddress || "N/A"}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b" }}>Thời gian thực hiện:</div>
                  <strong style={{ color: "#334155" }}>{selected.CreatedAt ? new Date(selected.CreatedAt).toLocaleString("vi-VN") : ""}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b" }}>Email:</div>
                  <strong style={{ color: "#334155" }}>{selected.Email || "N/A"}</strong>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "4px" }}>Mô tả chi tiết:</div>
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", fontSize: "14px", color: "#334155" }}>
                  {selected.Description}
                </div>
              </div>

              {/* Data Diff container */}
              <div className="diff-container">
                <div>
                  <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>
                    Dữ liệu trước (Old Value)
                  </div>
                  <div className="diff-box">
                    {formatJSONValue(selected.OldValue)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#10b981", fontSize: "12px", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>
                    Dữ liệu mới (New Value)
                  </div>
                  <div className="diff-box">
                    {formatJSONValue(selected.NewValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
