import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminAIMonitoring() {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ requestCount: 0, tokenUsage: 0, errorRate: 0, avgLatency: 0 });
  const [dailyTrend, setDailyTrend] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    type: "",
    checked: "",
    keyword: "",
    fromDate: "",
    toDate: "",
    feature: "",
    errorOnly: "0"
  });

  const [selected, setSelected] = useState(null);
  const [checkResult, setCheckResult] = useState("");

  const load = async (activeFilters = filters) => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/admin/ai-monitoring", { params: activeFilters });
      const resData = res.data.data || res.data || {};
      setItems(resData.items || []);
      setMetrics(resData.metrics || { requestCount: 0, tokenUsage: 0, errorRate: 0, avgLatency: 0 });
      setDailyTrend(resData.dailyTrend || []);
    } catch (err) {
      console.error("Error loading AI monitoring logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scrollToTable = () => {
    const tableWrapper = document.getElementById("ai-logs-table-wrapper");
    if (tableWrapper) {
      tableWrapper.scrollTop = 0;
    }
    const logsCard = document.getElementById("ai-logs-card-section");
    if (logsCard) {
      logsCard.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleApply = () => {
    load();
    setTimeout(scrollToTable, 100);
  };

  const handleReset = () => {
    const defaultFilters = {
      type: "",
      checked: "",
      keyword: "",
      fromDate: "",
      toDate: "",
      feature: "",
      errorOnly: "0"
    };
    setFilters(defaultFilters);
    load(defaultFilters);
    setTimeout(scrollToTable, 100);
  };

  const openDetail = async (item) => {
    try {
      const res = await axiosClient.get(`/admin/ai-monitoring/${item.ItemType}/${item.ItemId}`);
      const detail = res.data.data || res.data || item;
      setSelected(detail);
      setCheckResult(detail.CheckResult || "");
    } catch (err) {
      console.error("Error loading detail", err);
      setSelected(item);
      setCheckResult(item.CheckResult || "");
    }
  };

  const markChecked = async () => {
    await axiosClient.patch(`/admin/ai-monitoring/${selected.ItemType}/${selected.ItemId}/checked`, {
      checked: true,
      checkResult
    });
    await load();
    await openDetail({ ItemType: selected.ItemType, ItemId: selected.ItemId });
  };

  // SVG Chart points calculation for Usage Trend (AI Request Count)
  const usageChartPath = useMemo(() => {
    if (!dailyTrend || dailyTrend.length === 0) return "";
    const maxVal = Math.max(...dailyTrend.map(item => item.RequestCount), 5);
    const width = 450;
    const height = 120;
    const padding = 20;

    const points = dailyTrend.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(dailyTrend.length - 1, 1);
      const y = height - padding - (item.RequestCount * (height - padding * 2)) / maxVal;
      return `${x},${y}`;
    });

    return points.join(" ");
  }, [dailyTrend]);

  // SVG Chart points calculation for Error count Trend
  const errorChartPath = useMemo(() => {
    if (!dailyTrend || dailyTrend.length === 0) return "";
    const maxVal = Math.max(...dailyTrend.map(item => item.ErrorCount), 2);
    const width = 450;
    const height = 120;
    const padding = 20;

    const points = dailyTrend.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(dailyTrend.length - 1, 1);
      const y = height - padding - (item.ErrorCount * (height - padding * 2)) / maxVal;
      return `${x},${y}`;
    });

    return points.join(" ");
  }, [dailyTrend]);

  const maxRequests = useMemo(() => {
    if (!dailyTrend || dailyTrend.length === 0) return 0;
    return Math.max(...dailyTrend.map(item => item.RequestCount), 0);
  }, [dailyTrend]);

  const maxErrors = useMemo(() => {
    if (!dailyTrend || dailyTrend.length === 0) return 0;
    return Math.max(...dailyTrend.map(item => item.ErrorCount), 0);
  }, [dailyTrend]);

  const formatDateString = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
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
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .metric-card {
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          border-left: 4px solid #cbd5e1;
          transition: transform 0.2s;
        }
        .metric-card:hover {
          transform: translateY(-2px);
        }
        .metric-requests { border-left-color: #3b82f6; }
        .metric-tokens { border-left-color: #8b5cf6; }
        .metric-errors { border-left-color: #ef4444; }
        .metric-latency { border-left-color: #10b981; }

        .metric-card .eyebrow {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 8px;
        }
        .metric-card h3 {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 6px 0;
        }
        .metric-card p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
        .chart-card {
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
        }
        .chart-title {
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 12px;
        }
        .svg-chart-wrapper {
          width: 100%;
          height: 120px;
        }
        .svg-chart {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .chart-line-usage { stroke: #3b82f6; stroke-width: 2.5; fill: none; stroke-linecap: round; }
        .chart-line-error { stroke: #ef4444; stroke-width: 2.5; fill: none; stroke-linecap: round; }
        .chart-circle { fill: #ffffff; stroke-width: 2.5; cursor: pointer; r: 3.5; }
        .circle-usage { stroke: #3b82f6; }
        .circle-error { stroke: #ef4444; }

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
        .log-type-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .badge-recommendation { background: #e0f2fe; color: #0369a1; }
        .badge-prediction { background: #fae8ff; color: #a21caf; }
        .badge-chat { background: #f0fdf4; color: #166534; }
        .badge-audit { background: #f1f5f9; color: #475569; }

        .error-pill {
          display: inline-block;
          background: #fee2e2;
          color: #b91c1c;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          margin-left: 8px;
        }

        .ai-modal-backdrop {
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
        }
        .ai-modal-card {
          background: #ffffff;
          width: 90%;
          max-width: 700px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
          overflow: hidden;
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
        .json-box {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          font-family: monospace;
          font-size: 12.5px;
          white-space: pre-wrap;
          overflow: auto;
          margin-top: 10px;
          border: 1px solid #334155;
        }
      `}</style>

      <div className="header-container">
        <div>
          <div className="eyebrow" style={{ color: "#a0573a", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "11px", marginBottom: "4px" }}>
            Trí tuệ nhân tạo
          </div>
          <h2 className="dashboard-title">Bảng Giám Sát AI (AI Monitoring)</h2>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="metrics-grid">
        <article className="metric-card metric-requests">
          <div className="eyebrow">Tổng lượt gọi (Requests)</div>
          <h3>{Number(metrics.requestCount).toLocaleString("vi-VN")}</h3>
          <p>Số yêu cầu AI xử lý</p>
        </article>
        <article className="metric-card metric-tokens">
          <div className="eyebrow">Token tiêu thụ</div>
          <h3>{Number(metrics.tokenUsage).toLocaleString("vi-VN")} tkn</h3>
          <p>Input + Output tokens</p>
        </article>
        <article className="metric-card metric-errors">
          <div className="eyebrow">Tỷ lệ lỗi (Error Rate)</div>
          <h3 style={{ color: Number(metrics.errorRate) > 5 ? "#ef4444" : "#1e293b" }}>{metrics.errorRate}%</h3>
          <p>Yêu cầu thất bại hoặc trống</p>
        </article>
        <article className="metric-card metric-latency">
          <div className="eyebrow">Độ trễ trung bình</div>
          <h3>{metrics.avgLatency} ms</h3>
          <p>Thời gian phản hồi bình quân</p>
        </article>
      </div>

      {/* Visual Trends Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h4 className="chart-title">Tần suất cuộc gọi hàng ngày (Lượt)</h4>
          <div className="svg-chart-wrapper">
            {dailyTrend && dailyTrend.length > 0 ? (
              <svg className="svg-chart" viewBox="0 0 450 120">
                <line x1="20" y1="20" x2="430" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="20" y1="60" x2="430" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="20" y1="100" x2="430" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
                <polyline points={usageChartPath} className="chart-line-usage" />
                {dailyTrend.map((item, idx) => {
                  const width = 450;
                  const height = 120;
                  const padding = 20;
                  const maxVal = Math.max(maxRequests, 5);
                  const x = padding + (idx * (width - padding * 2)) / Math.max(dailyTrend.length - 1, 1);
                  const y = height - padding - (item.RequestCount * (height - padding * 2)) / maxVal;
                  return (
                    <circle key={idx} cx={x} cy={y} className="chart-circle circle-usage" title={`Ngày: ${formatDateString(item.LogDate)}: ${item.RequestCount} lượt`} />
                  );
                })}
              </svg>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
                Chưa có dữ liệu vẽ biểu đồ
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
            <span>{dailyTrend && dailyTrend[0] ? formatDateString(dailyTrend[0].LogDate) : ""}</span>
            <span>{dailyTrend && dailyTrend[dailyTrend.length - 1] ? formatDateString(dailyTrend[dailyTrend.length - 1]?.LogDate) : ""}</span>
          </div>
        </div>

        <div className="chart-card">
          <h4 className="chart-title">Số lượng yêu cầu lỗi hàng ngày (Lượt)</h4>
          <div className="svg-chart-wrapper">
            {dailyTrend && dailyTrend.length > 0 ? (
              <svg className="svg-chart" viewBox="0 0 450 120">
                <line x1="20" y1="20" x2="430" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="20" y1="60" x2="430" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="20" y1="100" x2="430" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
                <polyline points={errorChartPath} className="chart-line-error" />
                {dailyTrend.map((item, idx) => {
                  const width = 450;
                  const height = 120;
                  const padding = 20;
                  const maxVal = Math.max(maxErrors, 2);
                  const x = padding + (idx * (width - padding * 2)) / Math.max(dailyTrend.length - 1, 1);
                  const y = height - padding - (item.ErrorCount * (height - padding * 2)) / maxVal;
                  return (
                    <circle key={idx} cx={x} cy={y} className="chart-circle circle-error" title={`Lỗi ngày ${formatDateString(item.LogDate)}: ${item.ErrorCount} lượt`} />
                  );
                })}
              </svg>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
                Chưa có dữ liệu vẽ biểu đồ
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
            <span>{dailyTrend && dailyTrend[0] ? formatDateString(dailyTrend[0].LogDate) : ""}</span>
            <span>{dailyTrend && dailyTrend[dailyTrend.length - 1] ? formatDateString(dailyTrend[dailyTrend.length - 1]?.LogDate) : ""}</span>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filter-card">
        <div className="filter-grid">
          <div className="filter-item">
            <label>Phân loại log</label>
            <select
              className="filter-input"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">Tất cả</option>
              <option value="recommendation">Gợi ý dịch vụ (recommendation)</option>
              <option value="prediction">Dự báo (prediction)</option>
              <option value="chat">Hội thoại AI (chat)</option>
              <option value="audit">Kiểm định nội dung (audit)</option>
            </select>
          </div>
          <div className="filter-item">
            <label>Tính năng (Feature/Module)</label>
            <input
              type="text"
              className="filter-input"
              value={filters.feature}
              onChange={(e) => setFilters({ ...filters, feature: e.target.value })}
              placeholder="VD: Chat, Recommendation, Audit..."
            />
          </div>
          <div className="filter-item">
            <label>Trạng thái kiểm duyệt</label>
            <select
              className="filter-input"
              value={filters.checked}
              onChange={(e) => setFilters({ ...filters, checked: e.target.value })}
            >
              <option value="">Tất cả</option>
              <option value="1">Đã duyệt</option>
              <option value="0">Chưa duyệt</option>
            </select>
          </div>
          <div className="filter-item">
            <label>Chỉ hiển thị Lỗi</label>
            <select
              className="filter-input"
              value={filters.errorOnly}
              onChange={(e) => setFilters({ ...filters, errorOnly: e.target.value })}
            >
              <option value="0">Tất cả cuộc gọi</option>
              <option value="1">Chỉ các cuộc gọi lỗi</option>
            </select>
          </div>
          <div className="filter-item">
            <label>Tìm kiếm từ khóa</label>
            <input
              type="text"
              className="filter-input"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="Nội dung, kết quả..."
            />
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
          <button className="btn-primary" onClick={handleApply}>Áp dụng bộ lọc</button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="logs-card" id="ai-logs-card-section">
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            Đang tải dữ liệu nhật ký AI...
          </div>
        ) : (
          <div id="ai-logs-table-wrapper" style={{ overflowX: "auto", maxHeight: "550px", overflowY: "auto", position: "relative" }}>
            <table className="logs-table">
              <thead>
                <tr>
                  <th style={{ width: "140px" }}>Phân loại</th>
                  <th>Tiêu đề / Tính năng</th>
                  <th>Nội dung (Prompt / Question / Input)</th>
                  <th>Kết quả (AI Response / Answer)</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Độ trễ</th>
                  <th style={{ width: "160px" }}>Thời gian tạo</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={`${item.ItemType}-${item.ItemId}-${idx}`}>
                    <td>
                      <span className={`log-type-badge badge-${(item.ItemType || '').toLowerCase()}`}>
                        {item.ItemType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {item.Title}
                      {Number(item.IsError) === 1 && <span className="error-pill">LỖI</span>}
                    </td>
                    <td style={{ fontSize: "13px", color: "#475569", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.Content}
                    </td>
                    <td style={{ fontSize: "13px", color: "#475569", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.Detail || "N/A"}
                    </td>
                    <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "13px", fontWeight: 600, color: item.LatencyMs > 1500 ? "#ef4444" : "#10b981" }}>
                      {item.LatencyMs}ms
                    </td>
                    <td style={{ fontSize: "13px", color: "#64748b" }}>
                      {item.CreatedAt ? new Date(item.CreatedAt).toLocaleString("vi-VN") : ""}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn-outline"
                        style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "6px" }}
                        onClick={() => openDetail(item)}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>
                      Không tìm thấy bản ghi dữ liệu AI nào phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Log Modal */}
      {selected ? (
        <div className="ai-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className={`log-type-badge badge-${(selected.ItemType || '').toLowerCase()}`} style={{ marginRight: "10px" }}>
                  {selected.ItemType}
                </span>
                <strong style={{ fontSize: "16px", color: "#1e293b" }}>{selected.Title || "Chi tiết log AI"}</strong>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", fontSize: "20px", color: "#94a3b8", cursor: "pointer" }}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px", fontSize: "13px" }}>
                <div>
                  <div style={{ color: "#64748b" }}>Người gọi / Khách hàng:</div>
                  <strong style={{ color: "#334155" }}>{selected.UserName || "Hệ thống"} (ID: {selected.UserId || "N/A"})</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b" }}>Thời gian:</div>
                  <strong style={{ color: "#334155" }}>{selected.CreatedAt ? new Date(selected.CreatedAt).toLocaleString("vi-VN") : ""}</strong>
                </div>
                {selected.ModelName && (
                  <div>
                    <div style={{ color: "#64748b" }}>Mô hình AI:</div>
                    <strong style={{ color: "#334155" }}>{selected.ModelName}</strong>
                  </div>
                )}
                {selected.InputToken !== undefined && (
                  <div>
                    <div style={{ color: "#64748b" }}>Tokens / Chi phí:</div>
                    <strong style={{ color: "#334155" }}>
                      In: {selected.InputToken} | Out: {selected.OutputToken} | Cost: ${selected.Cost}
                    </strong>
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginBottom: "16px" }}>
                <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>YÊU CẦU / PROMPT / CÂU HỎI:</div>
                <div className="json-box" style={{ background: "#f8fafc", color: "#334155", border: "1px solid #e2e8f0" }}>
                  {selected.Content || selected.Prompt || selected.Question}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginBottom: "16px" }}>
                <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>PHẢN HỒI CỦA AI:</div>
                <div className="json-box">
                  {selected.Detail || selected.AIResponse || selected.Answer || "Không có kết quả"}
                </div>
              </div>

              {selected.ItemType === "audit" && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>KIỂM DUYỆT (AUDIT CHECK):</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      className="filter-input"
                      style={{ width: "100%", height: "80px", background: "#ffffff" }}
                      value={checkResult}
                      onChange={(e) => setCheckResult(e.target.value)}
                      placeholder="Nhập ghi chú kết quả kiểm duyệt..."
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn-primary" onClick={markChecked}>
                        Xác nhận đã kiểm duyệt
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
