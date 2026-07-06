import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/TechnicianEarnings.css";

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function shortDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}

function formatMinutes(minutes) {
  const total = Number(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}g ${m}ph`;
}

function statusText(status) {
  const map = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
    PAID: "Đã thanh toán",
  };

  return map[status] || status || "Không rõ";
}

export default function TechnicianEarnings() {
  const [data, setData] = useState({
    overview: {},
    daily: [],
    serviceCategory: [],
    topServices: [],
    yearSummary: {},
    payout: {},
    payoutHistory: [],
  });

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("month");
  const [showHistory, setShowHistory] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [search, setSearch] = useState("");

  async function loadEarnings() {
    try {
      setLoading(true);

      const res = await axiosClient.get("/technician/earnings", {
        params: { range },
      });

      const payload = res.data?.data || {};
      setData((prev) => ({
        ...prev,
        ...payload,
      }));

      setGoalInput(String(payload.payout?.monthlyGoal || 8000000));
    } catch (err) {
      alert(err.response?.data?.message || "Không tải được báo cáo thu nhập");
    } finally {
      setLoading(false);
    }
  }

  async function loadPayoutHistory() {
    try {
      const res = await axiosClient.get("/technician/earnings/payouts", {
        params: { page: 1, limit: 10 },
      });

      setData((prev) => ({
        ...prev,
        payoutHistory: res.data?.data?.items || [],
      }));
    } catch {
      setData((prev) => ({
        ...prev,
        payoutHistory: [],
      }));
    }
  }

  useEffect(() => {
    loadEarnings();
    loadPayoutHistory();
  }, [range]);

  const overview = data.overview || {};
  const daily = data.daily || [];
  const categories = data.serviceCategory || [];
  const topServices = data.topServices || [];
  const year = data.yearSummary || {};
  const payout = data.payout || {};
  const payoutHistory = data.payoutHistory || [];

  const filteredDaily = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return daily;

    return daily.filter((item) =>
      [
        item.AppointmentDate,
        item.Appointments,
        item.Services,
        item.TotalEarnings,
        item.Commission,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [daily, search]);

  const totalCategoryAmount = useMemo(
    () => categories.reduce((sum, item) => sum + Number(item.Amount || 0), 0),
    [categories],
  );

  const goal = Number(payout.monthlyGoal || 8000000);
  const earned = Number(overview.Commission || 0) + Number(overview.Tips || 0);
  const goalPercent =
    goal > 0 ? Math.min(Math.round((earned / goal) * 100), 100) : 0;

  async function handleExport() {
    try {
      const res = await axiosClient.get("/technician/earnings/export", {
        params: { range },
        responseType: "text",
      });

      const blob = new Blob([res.data], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doanh-thu-ktv-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || "Không thể xuất file báo cáo");
    }
  }

  async function handleSaveGoal() {
    try {
      const value = Number(goalInput);

      if (!Number.isFinite(value) || value < 0) {
        alert("Mục tiêu tháng không hợp lệ");
        return;
      }

      await axiosClient.put("/technician/earnings/goal", {
        monthlyGoal: value,
      });

      await loadEarnings();
      alert("Đã cập nhật mục tiêu thu nhập thành công");
    } catch (err) {
      alert(err.response?.data?.message || "Không thể cập nhật mục tiêu");
    }
  }

  async function handleRequestPayout() {
    try {
      const available = Number(payout.availableBalance || 0);

      if (available <= 0) {
        alert("Không có số dư khả dụng để gửi yêu cầu rút tiền");
        return;
      }

      await axiosClient.post("/technician/earnings/payouts", {
        amount: available,
        note: payoutNote.trim() || "Yêu cầu rút tiền từ Kỹ thuật viên",
      });

      setPayoutNote("");
      await loadEarnings();
      await loadPayoutHistory();
      alert("Đã gửi yêu cầu rút tiền thành công, vui lòng chờ duyệt");
    } catch (err) {
      alert(err.response?.data?.message || "Không thể gửi yêu cầu rút tiền");
    }
  }

  const currentRangeLabel = useMemo(() => {
    if (range === "week") return "7 ngày gần nhất";
    if (range === "lastMonth") return "Tháng trước";
    if (range === "year") return "Năm nay";
    return "Tháng này";
  }, [range]);

  const colorPalette = ["#1b4332", "#d8b56d", "#40916c", "#eed39b", "#8d7b4a"];

  if (loading) {
    return (
      <TechnicianLayout>
        <div className="earning-page-v2">
          <div className="earning-loading">Đang tải báo cáo thu nhập...</div>
        </div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div className="earning-page-v2">
        
        {/* HEADER SECTION */}
        <header className="earning-header-v2">
          <div className="earning-title-area">
            <h1>
              Báo cáo Thu nhập <span className="gold-icon">💰</span>
            </h1>
            <p>Theo dõi doanh thu, tiền hoa hồng & lịch sử yêu cầu rút tiền của bạn</p>
          </div>

          <div className="earning-search-v2">
            <span className="search-icon">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo ngày, số lịch, doanh thu..."
            />
          </div>

          <button className="earning-export-btn" onClick={handleExport}>
            📥 Xuất báo cáo JSON
          </button>
        </header>

        {/* TOOLBAR & FILTERS */}
        <section className="earning-toolbar-v2">
          <div className="earning-period-badge">
            <span className="calendar-icon">📅</span>
            Thực tế: {currentRangeLabel}
          </div>

          <div className="earning-tabs-v2">
            <button
              onClick={() => setRange("week")}
              className={range === "week" ? "active" : ""}
            >
              Tuần này
            </button>
            <button
              onClick={() => setRange("month")}
              className={range === "month" ? "active" : ""}
            >
              Tháng này
            </button>
            <button
              onClick={() => setRange("lastMonth")}
              className={range === "lastMonth" ? "active" : ""}
            >
              Tháng trước
            </button>
            <button
              onClick={() => setRange("year")}
              className={range === "year" ? "active" : ""}
            >
              Năm nay
            </button>
          </div>
        </section>

        {/* TOP STAT CARDS ROW */}
        <section className="earning-stats-grid">
          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">💵</div>
            </div>
            <p className="stat-label">Tổng Doanh thu</p>
            <h2 className="stat-value">{money(overview.TotalEarnings)}</h2>
            <small className="stat-desc">Khách đã hoàn tất thanh toán</small>
            <div className="card-indicator" />
          </div>

          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">♙</div>
            </div>
            <p className="stat-label">Tiền Hoa hồng</p>
            <h2 className="stat-value">{money(overview.Commission)}</h2>
            <small className="stat-desc">Hoa hồng dịch vụ được chia</small>
            <div className="card-indicator" />
          </div>

          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">♡</div>
            </div>
            <p className="stat-label">Tiền Tips</p>
            <h2 className="stat-value">{money(overview.Tips)}</h2>
            <small className="stat-desc">Khách hàng tặng trực tiếp</small>
            <div className="card-indicator" />
          </div>

          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">▣</div>
            </div>
            <p className="stat-label">Số lịch phục vụ</p>
            <h2 className="stat-value">{overview.ServicesCompleted || 0} ca</h2>
            <small className="stat-desc">Lịch hẹn đã phục vụ thành công</small>
            <div className="card-indicator" />
          </div>

          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">▤</div>
            </div>
            <p className="stat-label">Giá trị trung bình</p>
            <h2 className="stat-value">{money(overview.AvgOrderValue)}</h2>
            <small className="stat-desc">Tính trên mỗi buổi dịch vụ</small>
            <div className="card-indicator" />
          </div>

          <div className="stat-card-v2">
            <div className="stat-card-header">
              <div className="stat-icon-wrapper">◷</div>
            </div>
            <p className="stat-label">Thời gian làm</p>
            <h2 className="stat-value">{formatMinutes(overview.WorkingMinutes)}</h2>
            <small className="stat-desc">Tổng thời lượng làm trị liệu</small>
            <div className="card-indicator" />
          </div>
        </section>

        {/* SPLIT LAYOUT (LEFT: MAIN REPORTS, RIGHT: SIDEBAR OPERATIONS) */}
        <div className="earning-main-split">
          
          {/* LEFT SIDE CONTENT */}
          <div className="earning-content-left">
            
            {/* CHARTS CONTAINER */}
            <div className="premium-card">
              <div className="premium-card-head">
                <h3>Biểu đồ Phân tích Thu nhập</h3>
                <span className="premium-badge-info">Cơ cấu & Xu hướng</span>
              </div>

              <div className="charts-split-grid">
                
                {/* Column 1: Trend Bar Chart */}
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredDaily.slice(0, 15).reverse()}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="barTotalEarnings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1b4332" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#2d6a4f" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="barCommission" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d8b56d" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#eed39b" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="AppointmentDate"
                        tickFormatter={(val) => shortDate(val).slice(0, 5)}
                        stroke="#8c9c90"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#8c9c90"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val / 1000}k`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          money(value),
                          name === "TotalEarnings" ? "Doanh thu" : "Hoa hồng",
                        ]}
                        labelFormatter={(label) => `Ngày: ${shortDate(label)}`}
                        contentStyle={{
                          background: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #eadfca",
                          boxShadow: "0 10px 24px rgba(80, 60, 20, 0.08)",
                          color: "#1b241e",
                        }}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "TotalEarnings" ? "Doanh thu" : "Hoa hồng"
                        }
                        wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      />
                      <Bar dataKey="TotalEarnings" fill="url(#barTotalEarnings)" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="Commission" fill="url(#barCommission)" radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Column 2: Category Donut Chart */}
                <div className="donut-wrap-v2">
                  <div className="donut-chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categories}
                          dataKey="Amount"
                          nameKey="CategoryName"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                        >
                          {categories.map((_, index) => (
                            <Cell key={index} fill={colorPalette[index % colorPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [money(value), "Doanh thu"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    <div className="chart-center-info">
                      <span>Tổng cộng</span>
                      <b>{money(overview.TotalEarnings)}</b>
                    </div>
                  </div>

                  <div className="donut-legend-list">
                    {categories.length === 0 ? (
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                        Chưa có dữ liệu danh mục
                      </p>
                    ) : (
                      categories.map((item, index) => (
                        <div key={item.CategoryName} className="donut-legend-item">
                          <span className="donut-legend-label">
                            <i
                              className="donut-legend-color-dot"
                              style={{ background: colorPalette[index % colorPalette.length] }}
                            />
                            {item.CategoryName}
                          </span>
                          <div>
                            <b>{percent(item.Amount, totalCategoryAmount)}%</b>
                            <span className="legend-value"> ({money(item.Amount)})</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* BREAKDOWN TABLE */}
            <div className="premium-card">
              <div className="premium-card-head">
                <h3>Bảng kê chi tiết thu nhập</h3>
                <span className="premium-badge-info">{filteredDaily.length} ngày ghi nhận</span>
              </div>

              <div className="breakdown-table-wrapper">
                <div className="table-responsive-v2">
                  <table className="earning-table-v2">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Lịch hẹn</th>
                        <th>Dịch vụ</th>
                        <th>Hoa hồng</th>
                        <th>Tips</th>
                        <th>Tổng doanh thu</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDaily.slice(0, 8).map((item, index) => (
                        <tr key={`${item.AppointmentDate}-${index}`}>
                          <td>{shortDate(item.AppointmentDate)}</td>
                          <td>{item.Appointments || 0}</td>
                          <td>{item.Services || 0}</td>
                          <td>{money(item.Commission)}</td>
                          <td>{money(item.Tips)}</td>
                          <td>
                            <strong>{money(item.TotalEarnings)}</strong>
                          </td>
                          <td>
                            <span className="paid-pill-v2">Đã thanh toán</span>
                          </td>
                        </tr>
                      ))}

                      {filteredDaily.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                            Không có dữ liệu thu nhập trong khoảng này
                          </td>
                        </tr>
                      )}

                      {filteredDaily.length > 0 && (
                        <tr className="summary-row-v2">
                          <td>Tổng cộng</td>
                          <td>
                            {filteredDaily.reduce((s, x) => s + Number(x.Appointments || 0), 0)}
                          </td>
                          <td>
                            {filteredDaily.reduce((s, x) => s + Number(x.Services || 0), 0)}
                          </td>
                          <td>
                            {money(filteredDaily.reduce((s, x) => s + Number(x.Commission || 0), 0))}
                          </td>
                          <td>
                            {money(filteredDaily.reduce((s, x) => s + Number(x.Tips || 0), 0))}
                          </td>
                          <td>
                            {money(filteredDaily.reduce((s, x) => s + Number(x.TotalEarnings || 0), 0))}
                          </td>
                          <td>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR OPERATIONS */}
          <aside className="earning-sidebar-right">
            
            {/* PAYOUT REQUEST CARD */}
            <div className="payout-card-v2">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Yêu cầu rút tiền
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="payout-status-badge"
                  style={{ cursor: "pointer", background: "none" }}
                >
                  {showHistory ? "Ẩn lịch sử" : "Xem lịch sử"}
                </button>
              </div>

              <div className="payout-balance-box">
                <p>Số dư khả dụng</p>
                <h3>{money(payout.availableBalance)}</h3>
              </div>

              <div className="payout-recent-box">
                <div>
                  <p>Lần rút gần nhất</p>
                  <b>{money(payout.lastPayout)}</b>
                </div>
                <span className="recent-date">
                  {payout.lastProcessedAt ? shortDate(payout.lastProcessedAt) : "Chưa có giao dịch"}
                </span>
              </div>

              <div className="payout-input-group">
                <label>Ghi chú nhận tiền</label>
                <input
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder="Ví dụ: Rút về Vietcombank..."
                />
              </div>

              <button
                className="payout-submit-btn"
                onClick={handleRequestPayout}
                disabled={Number(payout.availableBalance || 0) <= 0}
              >
                Gửi yêu cầu rút tiền
              </button>

              {showHistory && (
                <div className="payout-history-list">
                  {payoutHistory.length === 0 ? (
                    <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                      Chưa có lịch sử rút tiền
                    </p>
                  ) : (
                    payoutHistory.map((item) => (
                      <div className="payout-history-item" key={item.PayoutRequestId}>
                        <b>#{item.PayoutRequestId}</b>
                        <span className={`payout-status ${String(item.Status).toLowerCase()}`}>
                          {statusText(item.Status)}
                        </span>
                        <strong>{money(item.Amount)}</strong>
                        <small>Yêu cầu lúc: {shortDate(item.RequestedAt)}</small>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* MONTHLY GOAL CARD */}
            <div className="goal-card-v2">
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Mục tiêu thu nhập
              </h3>
              
              <div className="goal-input-box">
                <input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Nhập số tiền mục tiêu..."
                />
                <button type="button" onClick={handleSaveGoal}>Lưu</button>
              </div>

              <div style={{ marginTop: "4px" }}>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>
                  Mục tiêu tháng này
                </p>
                <h2>{money(goal)}</h2>
              </div>

              <div className="goal-progress-bar">
                <div className="goal-progress-fill" style={{ width: `${goalPercent}%` }} />
              </div>

              <div className="goal-numbers">
                <span>Đạt được: <b>{money(earned)}</b></span>
                <b>{goalPercent}% mục tiêu</b>
              </div>
            </div>

            {/* TOP SERVICES CARD */}
            <div className="payout-card-v2">
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--primary-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Top dịch vụ hiệu quả
              </h3>

              <div className="top-services-list-v2">
                {topServices.slice(0, 5).map((item, index) => {
                  const servicePercent = percent(item.Amount, overview.TotalEarnings);
                  return (
                    <div className="top-service-item-v2" key={item.ServiceName}>
                      <div className="top-service-meta-v2">
                        <span className="top-service-name-v2">
                          <span className="top-service-rank-v2">{index + 1}</span>
                          {item.ServiceName}
                        </span>
                        <span className="top-service-value-v2">{money(item.Amount)}</span>
                      </div>
                      <div className="top-service-bar-container-v2">
                        <div className="top-service-bar-v2" style={{ width: `${servicePercent}%` }} />
                      </div>
                    </div>
                  );
                })}

                {topServices.length === 0 && (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "10px 0" }}>
                    Chưa có dữ liệu dịch vụ
                  </p>
                )}
              </div>
            </div>

          </aside>

        </div>

        {/* YEARLY SUMMARY (FULL-WIDTH CARD) */}
        <section className="premium-card yearly-summary-v2">
          <div className="premium-card-head">
            <h3>Tổng kết doanh số năm ({year.YearNumber || new Date().getFullYear()})</h3>
            <span className="premium-badge-info">Lũy kế năm</span>
          </div>

          <div className="yearly-grid-v2">
            <div className="yearly-grid-item-v2">
              <p>Doanh thu năm</p>
              <h2>{money(year.TotalEarnings)}</h2>
              <small>Hóa đơn đã hoàn thành</small>
            </div>

            <div className="yearly-grid-item-v2">
              <p>Hoa hồng tích lũy</p>
              <h2>{money(year.TotalCommission)}</h2>
              <small>Tổng thu nhập chia sẻ</small>
            </div>

            <div className="yearly-grid-item-v2">
              <p>Tiền Tips nhận</p>
              <h2>{money(year.TotalTips)}</h2>
              <small>Quà tặng của khách</small>
            </div>

            <div className="yearly-grid-item-v2">
              <p>Số ca hoàn thành</p>
              <h2>{year.TotalServices || 0} ca</h2>
              <small>Buổi dịch vụ đã làm</small>
            </div>

            <div className="yearly-grid-item-v2">
              <p>Trung bình tháng</p>
              <h2>{money(year.AvgMonthlyEarnings)}</h2>
              <small>Thu nhập bình quân tháng</small>
            </div>
          </div>
        </section>

      </div>
    </TechnicianLayout>
  );
}
