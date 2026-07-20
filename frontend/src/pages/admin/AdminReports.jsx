import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [memberships, setMemberships] = useState([]);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    categoryId: "",
    employeeId: "",
    membershipLevelId: ""
  });

  const loadFilters = async () => {
    try {
      const [catRes, empRes, memRes] = await Promise.all([
        axiosClient.get("/admin/services/categories"),
        axiosClient.get("/admin/employees"),
        axiosClient.get("/admin/memberships"),
      ]);
      setCategories(catRes.data.data || catRes.data || []);
      setEmployees(empRes.data.data || empRes.data || []);
      setMemberships(memRes.data.data || memRes.data || []);
    } catch (err) {
      console.error("Error loading filters", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/admin/reports/summary", { params: filters });
      setData(res.data.data || res.data || null);
    } catch (err) {
      console.error("Error loading report summary", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
    loadData();
  }, []);

  const scrollToAppointments = () => {
    const section = document.getElementById("reports-appointments-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleApply = () => {
    loadData();
    setTimeout(scrollToAppointments, 150);
  };

  const handleReset = () => {
    const defaultFilters = {
      fromDate: "",
      toDate: "",
      categoryId: "",
      employeeId: "",
      membershipLevelId: ""
    };
    setFilters(defaultFilters);
    setLoading(true);
    axiosClient.get("/admin/reports/summary", { params: defaultFilters })
      .then(res => {
        setData(res.data.data || res.data || null);
        setTimeout(scrollToAppointments, 150);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  // CSV Export function
  const exportToCSV = () => {
    if (!data || !data.customerAppointments || data.customerAppointments.length === 0) {
      setNotice("Không có dữ liệu lịch hẹn phù hợp để xuất file.");
      return;
    }

    setNotice("");

    const headers = [
      "Mã Lịch Hẹn",
      "Khách Hàng",
      "Nhân Viên",
      "Ngày Hẹn",
      "Giờ Bắt Đầu",
      "Giờ Kết Thúc",
      "Trạng Thái Lịch",
      "Mã Hóa Đơn",
      "Tổng Tiền",
      "Trạng Thái Thanh Toán",
      "Phương Thức Thanh Toán",
      "Trạng Thái Hoàn Tiền"
    ];

    const rows = data.customerAppointments.map(item => [
      item.AppointmentId,
      `"${item.CustomerName || ''}"`,
      `"${item.EmployeeName || ''}"`,
      item.AppointmentDate ? item.AppointmentDate.slice(0, 10) : "",
      item.StartTime ? item.StartTime.slice(0, 5) : "",
      item.EndTime ? item.EndTime.slice(0, 5) : "",
      item.AppointmentStatus || "",
      item.InvoiceId || "",
      item.FinalAmount || 0,
      item.PaymentStatus || "",
      item.PaymentMethod || "",
      item.RefundStatus || ""
    ]);

    // Build CSV content with BOM for UTF-8 compatibility with Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_doanh_thu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pagination for Appointments list (Client-side)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const paginatedAppointments = useMemo(() => {
    if (!data || !data.customerAppointments) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.customerAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [data?.customerAppointments, currentPage]);

  const totalPages = useMemo(() => {
    if (!data || !data.customerAppointments) return 1;
    return Math.ceil(data.customerAppointments.length / itemsPerPage) || 1;
  }, [data?.customerAppointments]);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // SVG Chart Computations for Revenue Trend
  const chartPath = useMemo(() => {
    if (!data || !data.dailyTrend || data.dailyTrend.length === 0) return "";
    const trend = data.dailyTrend;
    const maxVal = Math.max(...trend.map(item => item.Revenue), 100000);
    const width = 600;
    const height = 180;
    const padding = 30;

    const points = trend.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(trend.length - 1, 1);
      const y = height - padding - (item.Revenue * (height - padding * 2)) / maxVal;
      return `${x},${y}`;
    });

    return points.join(" ");
  }, [data?.dailyTrend]);

  // Path Area under the line for gradient fill
  const chartAreaPath = useMemo(() => {
    if (!data || !data.dailyTrend || data.dailyTrend.length === 0) return "";
    const trend = data.dailyTrend;
    const maxVal = Math.max(...trend.map(item => item.Revenue), 100000);
    const width = 600;
    const height = 180;
    const padding = 30;

    const startX = padding;
    const startY = height - padding;
    const endX = padding + ((trend.length - 1) * (width - padding * 2)) / Math.max(trend.length - 1, 1);

    const points = trend.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(trend.length - 1, 1);
      const y = height - padding - (item.Revenue * (height - padding * 2)) / maxVal;
      return `${x},${y}`;
    });

    return `${startX},${startY} ${points.join(" ")} ${endX},${startY}`;
  }, [data?.dailyTrend]);

  const maxRevenue = useMemo(() => {
    if (!data || !data.dailyTrend || data.dailyTrend.length === 0) return 0;
    return Math.max(...data.dailyTrend.map(item => item.Revenue), 0);
  }, [data?.dailyTrend]);

  const totalServicesRevenue = useMemo(() => {
    if (!data || !data.serviceDistribution) return 1;
    return data.serviceDistribution.reduce((sum, item) => sum + item.Revenue, 0) || 1;
  }, [data?.serviceDistribution]);

  // Helper date formatter
  const formatDateString = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
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
        .actions-row {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
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
        .metric-revenue { border-left-color: #10b981; }
        .metric-transactions { border-left-color: #3b82f6; }
        .metric-customers { border-left-color: #ec4899; }
        .metric-refunds { border-left-color: #f59e0b; }
        .metric-appointments { border-left-color: #8b5cf6; }
        
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
          grid-template-columns: 1.5fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
        .chart-card {
          background: #ffffff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .chart-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .chart-subtitle {
          font-size: 12px;
          color: #94a3b8;
        }
        .svg-chart-container {
          position: relative;
          width: 100%;
          height: 180px;
        }
        .svg-chart {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .chart-line {
          stroke: #a0573a;
          stroke-width: 3;
          fill: none;
          stroke-linecap: round;
        }
        .chart-dot {
          fill: #a0573a;
          stroke: #ffffff;
          stroke-width: 2;
          cursor: pointer;
          transition: r 0.2s;
        }
        .chart-dot:hover {
          r: 6;
        }
        .service-dist-item {
          margin-bottom: 14px;
        }
        .service-dist-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 4px;
        }
        .progress-bar-bg {
          background: #e2e8f0;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-bar-fill {
          background: #a0573a;
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease-out;
        }
        .tables-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) {
          .tables-grid {
            grid-template-columns: 1fr;
          }
        }
        .table-card {
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
        }
        .table-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 16px 0;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 10px;
        }
        .simple-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .simple-table th {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .simple-table td {
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .simple-table tr:last-child td {
          border-bottom: none;
        }
        .status-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-completed { background: #dcfce7; color: #15803d; }
        .status-confirmed { background: #dbeafe; color: #1d4ed8; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-cancelled { background: #fee2e2; color: #b91c1c; }
        .status-paid { background: #e0f2fe; color: #0369a1; }
        .pagination-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
        }
        .pagination-info {
          font-size: 13px;
          color: #64748b;
        }
        .pagination-buttons {
          display: flex;
          gap: 6px;
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
            Hệ thống phân tích
          </div>
          <h2 className="dashboard-title">Báo Cáo & Thống Kê</h2>
        </div>
        <button className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={exportToCSV}>
          <svg style={{ width: "16px", height: "16px", fill: "currentColor" }} viewBox="0 0 24 24">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
          </svg>
          Xuất File CSV
        </button>
      </div>

      {notice ? (
        <div className="admin-error-card" role="alert" style={{ marginBottom: 20 }}>
          {notice}
        </div>
      ) : null}

      {/* Filters Section */}
      <div className="filter-card">
        <div className="filter-grid">
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
          <div className="filter-item">
            <label>Danh mục dịch vụ</label>
            <select
              className="filter-input"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.CategoryId} value={c.CategoryId}>{c.CategoryName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Nhân viên</label>
            <select
              className="filter-input"
              value={filters.employeeId}
              onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
            >
              <option value="">Tất cả nhân viên</option>
              {employees.map((emp) => (
                <option key={emp.EmployeeId} value={emp.EmployeeId}>{emp.FullName} ({emp.Position})</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Hạng khách hàng</label>
            <select
              className="filter-input"
              value={filters.membershipLevelId}
              onChange={(e) => setFilters({ ...filters, membershipLevelId: e.target.value })}
            >
              <option value="">Tất cả hạng</option>
              {memberships.map((m) => (
                <option key={m.MembershipLevelId} value={m.MembershipLevelId}>{m.LevelName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions-row">
          <button className="btn-outline" onClick={handleReset}>Đặt lại</button>
          <button className="btn-primary" onClick={handleApply}>Áp dụng lọc</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: "40px", textAlign: "center", fontSize: "16px", color: "#64748b" }}>
          Đang tải dữ liệu báo cáo...
        </div>
      ) : data ? (
        <>
          {/* Metrics Grid */}
          <div className="metrics-grid">
            <article className="metric-card metric-revenue">
              <div className="eyebrow">Doanh thu</div>
              <h3>{Number(data.revenue?.TotalRevenue || 0).toLocaleString("vi-VN")}đ</h3>
              <p>Tổng tiền thanh toán thực nhận</p>
            </article>
            <article className="metric-card metric-transactions">
              <div className="eyebrow">Số giao dịch</div>
              <h3>{data.revenue?.TotalTransactions || 0}</h3>
              <p>Hóa đơn đã được lập & thanh toán</p>
            </article>
            <article className="metric-card metric-customers">
              <div className="eyebrow">Khách hàng mới</div>
              <h3>{data.revenue?.NewCustomersCount || 0}</h3>
              <p>Thành viên mới đăng ký tài khoản</p>
            </article>
            <article className="metric-card metric-refunds">
              <div className="eyebrow">Hoàn tiền</div>
              <h3>{data.revenue?.RefundCount || 0}</h3>
              <p>Tổng hoàn: {Number(data.revenue?.TotalRefunded || 0).toLocaleString("vi-VN")}đ</p>
            </article>
            <article className="metric-card metric-appointments">
              <div className="eyebrow">Lịch hẹn khách hàng</div>
              <h3>{data.appointments?.TotalAppointments || 0}</h3>
              <p>Xong: {data.appointments?.CompletedAppointments || 0} • Hủy: {data.appointments?.CancelledAppointments || 0}</p>
            </article>
          </div>

          {/* Charts Row */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title">Xu hướng doanh thu hàng ngày</h3>
                <span className="chart-subtitle">Đơn vị: VNĐ</span>
              </div>
              <div className="svg-chart-container">
                {data.dailyTrend && data.dailyTrend.length > 0 ? (
                  <svg className="svg-chart" viewBox="0 0 600 180">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a0573a" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#a0573a" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Fill Area */}
                    <polygon points={chartAreaPath} fill="url(#chartGrad)" />
                    {/* Grid lines */}
                    <line x1="30" y1="30" x2="570" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="90" x2="570" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="150" x2="570" y2="150" stroke="#e2e8f0" strokeWidth="2" />
                    {/* Line path */}
                    <polyline points={chartPath} className="chart-line" />
                    {/* Dots */}
                    {data.dailyTrend.map((item, idx) => {
                      const width = 600;
                      const height = 180;
                      const padding = 30;
                      const maxVal = maxRevenue || 100000;
                      const x = padding + (idx * (width - padding * 2)) / Math.max(data.dailyTrend.length - 1, 1);
                      const y = height - padding - (item.Revenue * (height - padding * 2)) / maxVal;
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="4"
                          className="chart-dot"
                          title={`${formatDateString(item.RevenueDate)}: ${Number(item.Revenue).toLocaleString("vi-VN")}đ`}
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "14px" }}>
                    Không có đủ dữ liệu vẽ xu hướng
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                <span>{data.dailyTrend && data.dailyTrend[0] ? formatDateString(data.dailyTrend[0].RevenueDate) : ""}</span>
                <span>Doanh thu cao nhất: {Number(maxRevenue).toLocaleString("vi-VN")}đ</span>
                <span>{data.dailyTrend && data.dailyTrend[data.dailyTrend.length - 1] ? formatDateString(data.dailyTrend[data.dailyTrend.length - 1].RevenueDate) : ""}</span>
              </div>
            </div>

            <div className="chart-card">
              <h3 className="chart-title" style={{ marginBottom: "16px" }}>Phân bổ doanh thu theo danh mục</h3>
              <div style={{ maxHeight: "190px", overflowY: "auto", paddingRight: "4px" }}>
                {data.serviceDistribution && data.serviceDistribution.length > 0 ? (
                  data.serviceDistribution.map((item) => {
                    const pct = ((item.Revenue / totalServicesRevenue) * 100).toFixed(1);
                    return (
                      <div className="service-dist-item" key={item.CategoryId}>
                        <div className="service-dist-info">
                          <span>{item.CategoryName}</span>
                          <span>{Number(item.Revenue).toLocaleString("vi-VN")}đ ({pct}%)</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: "flex", height: "150px", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "14px" }}>
                    Không có dữ liệu phân bổ danh mục
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tables Section */}
          <div className="tables-grid">
            <div className="table-card">
              <h3 className="table-title">Top 10 dịch vụ được yêu thích nhất</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Tên dịch vụ</th>
                      <th>Số lượt đặt</th>
                      <th>Doanh thu dịch vụ</th>
                      <th>Đánh giá TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topServices || []).map((item) => (
                      <tr key={item.ServiceId}>
                        <td style={{ fontWeight: 600 }}>{item.ServiceName}</td>
                        <td style={{ textAlign: "center" }}>{item.AppointmentCount} lượt</td>
                        <td>{Number(item.ServiceRevenue || 0).toLocaleString("vi-VN")}đ</td>
                        <td style={{ color: "#eab308", fontWeight: 700 }}>
                          ★ {Number(item.AverageRating || 0).toFixed(1)} <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 400 }}>({item.ReviewCount})</span>
                        </td>
                      </tr>
                    ))}
                    {(!data.topServices || data.topServices.length === 0) && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>Chưa có dữ liệu dịch vụ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="table-card">
              <h3 className="table-title">Top 10 nhân viên phục vụ nhiều nhất</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>Tên nhân viên</th>
                      <th>Số lịch hẹn</th>
                      <th>Đánh giá TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topEmployees || []).map((item) => (
                      <tr key={item.EmployeeId}>
                        <td style={{ fontWeight: 600 }}>{item.EmployeeName}</td>
                        <td style={{ textAlign: "center" }}>{item.AppointmentCount} ca</td>
                        <td style={{ color: "#eab308", fontWeight: 700 }}>
                          ★ {Number(item.AverageRating || 0).toFixed(1)} <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 400 }}>({item.ReviewCount})</span>
                        </td>
                      </tr>
                    ))}
                    {(!data.topEmployees || data.topEmployees.length === 0) && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>Chưa có dữ liệu nhân viên</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Appointments Table */}
          <div className="table-card" id="reports-appointments-section" style={{ marginBottom: "24px" }}>
            <h3 className="table-title">Chi tiết danh sách lịch hẹn</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="simple-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Nhân viên</th>
                    <th>Ngày hẹn</th>
                    <th>Thời gian</th>
                    <th>Tổng tiền</th>
                    <th>Thanh toán</th>
                    <th>Trạng thái hẹn</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppointments.map((item) => (
                    <tr key={item.AppointmentId}>
                      <td style={{ fontWeight: 600 }}>{item.CustomerName}</td>
                      <td>{item.EmployeeName}</td>
                      <td>{formatDateString(item.AppointmentDate)}</td>
                      <td>{item.StartTime?.slice(0, 5)} - {item.EndTime?.slice(0, 5)}</td>
                      <td style={{ fontWeight: 700 }}>{Number(item.FinalAmount || 0).toLocaleString("vi-VN")}đ</td>
                      <td>
                        <span className={`status-pill status-${(item.PaymentStatus || 'pending').toLowerCase()}`}>
                          {item.PaymentStatus === 'PAID' ? 'Đã thu' : item.PaymentStatus === 'REFUNDED' ? 'Hoàn tiền' : 'Chưa trả'}
                        </span>
                        {item.PaymentMethod && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{item.PaymentMethod}</div>}
                      </td>
                      <td>
                        <span className={`status-pill status-${(item.AppointmentStatus || 'pending').toLowerCase()}`}>
                          {item.AppointmentStatus === 'COMPLETED' ? 'Hoàn thành' : item.AppointmentStatus === 'CANCELLED' ? 'Đã hủy' : item.AppointmentStatus === 'CONFIRMED' ? 'Xác nhận' : 'Chờ xử lý'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data.customerAppointments || data.customerAppointments.length === 0) && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", color: "#94a3b8", padding: "30px" }}>Không tìm thấy lịch hẹn phù hợp</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Hiển thị trang {currentPage} / {totalPages} (Tổng {data.customerAppointments.length} lịch hẹn)
                </span>
                <div className="pagination-buttons">
                  <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      setTimeout(scrollToAppointments, 50);
                    }}
                  >
                    Trước
                  </button>
                  <button
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      setTimeout(scrollToAppointments, 50);
                    }}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Không thể tải dữ liệu báo cáo
        </div>
      )}
    </section>
  );
}
