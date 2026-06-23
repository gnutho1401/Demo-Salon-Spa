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
import "../../styles/pages/technician.css";

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
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
    PENDING: "Đang chờ duyệt",
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
      });

      const blob = new Blob([JSON.stringify(res.data?.data || {}, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `technician-earnings-${range}.json`;
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

  if (loading) {
    return (
      <TechnicianLayout>
        <div className="earning-page">
          <div className="earning-loading">Đang tải báo cáo thu nhập...</div>
        </div>
      </TechnicianLayout>
    );
  }

  return (
    <TechnicianLayout>
      <div className="earning-page">
        <header className="earning-header">
          <div>
            <h1>
              Báo cáo Thu nhập <span>💰</span>
            </h1>
            <p>
              Theo dõi doanh thu, tiền hoa hồng và lịch sử yêu cầu rút tiền của bạn
            </p>
          </div>

          <div className="earning-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo ngày, số lịch, doanh thu..."
            />
          </div>

          <button className="earning-export" onClick={handleExport}>
            📥 Xuất báo cáo JSON
          </button>
        </header>

        <section className="earning-toolbar">
          <div className="earning-date-picker">
            📅{" "}
            {range === "week"
              ? "7 ngày gần nhất"
              : range === "lastMonth"
                ? "Tháng trước"
                : range === "year"
                  ? "Năm nay"
                  : "Tháng này"}
          </div>

          <div className="earning-tabs">
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

        <section className="earning-stat-row">
          <div className="earning-stat-card">
            <span className="green">💵</span>
            <p>Tổng Doanh thu</p>
            <h2>{money(overview.TotalEarnings)}</h2>
            <small>Hóa đơn khách đã thanh toán</small>
            <div className="mini-line" />
          </div>

          <div className="earning-stat-card">
            <span className="purple">♙</span>
            <p>Tiền Hoa hồng</p>
            <h2>{money(overview.Commission)}</h2>
            <small>Hoa hồng được chia sẻ</small>
            <div className="mini-line purple-line" />
          </div>

          <div className="earning-stat-card">
            <span className="pink">♡</span>
            <p>Tiền Tips</p>
            <h2>{money(overview.Tips)}</h2>
            <small>Nhận trực tiếp từ khách hàng</small>
            <div className="mini-line pink-line" />
          </div>

          <div className="earning-stat-card">
            <span className="blue">▣</span>
            <p>Số Lịch hoàn thành</p>
            <h2>{overview.ServicesCompleted || 0}</h2>
            <small>Lịch hẹn đã phục vụ xong</small>
            <div className="mini-line blue-line" />
          </div>

          <div className="earning-stat-card">
            <span className="gold">▤</span>
            <p>Giá trị đơn trung bình</p>
            <h2>{money(overview.AvgOrderValue)}</h2>
            <small>Trung bình trên mỗi hóa đơn</small>
            <div className="mini-line gold-line" />
          </div>

          <div className="earning-stat-card">
            <span className="green">◷</span>
            <p>Giờ làm việc</p>
            <h2>{formatMinutes(overview.WorkingMinutes)}</h2>
            <small>Tổng thời lượng làm dịch vụ</small>
            <div className="mini-line" />
          </div>
        </section>

        <section className="earning-main-grid">
          <div className="earning-card earning-chart-card">
            <div className="card-head">
              <h3>Tổng quan Thu nhập</h3>
              <button type="button" className="btn-chart-type">
                Biểu đồ ngày
              </button>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={filteredDaily.slice(0, 15).reverse()} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="AppointmentDate" tickFormatter={(val) => shortDate(val).slice(0, 5)} stroke="#6f665b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6f665b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip formatter={(value, name) => [money(value), name === "TotalEarnings" ? "Doanh thu" : "Hoa hồng"]} labelFormatter={(label) => `Ngày: ${shortDate(label)}`} labelStyle={{ color: '#102616', fontWeight: 'bold' }} />
                <Legend formatter={(value) => value === "TotalEarnings" ? "Doanh thu" : "Hoa hồng"} wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                <Bar dataKey="TotalEarnings" fill="#456b35" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="Commission" fill="#d9a441" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="earning-card category-chart-card">
            <div className="card-head">
              <h3>Thu nhập theo nhóm dịch vụ</h3>
              <button type="button" className="btn-chart-type">
                Chi tiết
              </button>
            </div>

            <div className="donut-wrap">
              <div className="donut-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="Amount"
                      nameKey="CategoryName"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {categories.map((_, index) => (
                        <Cell key={index} fill={["#456b35", "#d9a441", "#8d7b4a", "#a8b98a", "#d96b43"][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [money(value), "Doanh thu"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span>Tổng cộng</span>
                  <b>{money(overview.TotalEarnings)}</b>
                </div>
              </div>

              <div className="category-list">
                {categories.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#6f665b", textAlign: "center" }}>Chưa có dữ liệu danh mục</p>
                ) : (
                  categories.map((item, index) => (
                    <div
                      key={item.CategoryName}
                      className="category-income-row"
                    >
                      <span>
                        <i className="dot" style={{ background: ["#456b35", "#d9a441", "#8d7b4a", "#a8b98a", "#d96b43"][index % 5] }} /> 
                        {item.CategoryName}
                      </span>
                      <b>{percent(item.Amount, totalCategoryAmount)}%</b>
                      <small>{money(item.Amount)}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="earning-main-grid">
          <div className="earning-card breakdown-card">
            <div className="card-head">
              <h3>Bảng kê chi tiết thu nhập</h3>
              <button type="button" className="btn-count">{filteredDaily.length} ngày</button>
            </div>

            <div className="table-responsive">
              <table className="earning-table">
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
                        <b>{money(item.TotalEarnings)}</b>
                      </td>
                      <td>
                        <span className="paid-pill">ĐÃ TRẢ</span>
                      </td>
                    </tr>
                  ))}

                  {!filteredDaily.length && (
                    <tr>
                      <td colSpan="7" className="empty-row-text">
                        Không có dữ liệu thu nhập trong khoảng này
                      </td>
                    </tr>
                  )}

                  {!!filteredDaily.length && (
                    <tr className="total-row">
                      <td>Tổng cộng</td>
                      <td>
                        {filteredDaily.reduce(
                          (s, x) => s + Number(x.Appointments || 0),
                          0,
                        )}
                      </td>
                      <td>
                        {filteredDaily.reduce(
                          (s, x) => s + Number(x.Services || 0),
                          0,
                        )}
                      </td>
                      <td>
                        {money(
                          filteredDaily.reduce(
                            (s, x) => s + Number(x.Commission || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td>
                        {money(
                          filteredDaily.reduce(
                            (s, x) => s + Number(x.Tips || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td>
                        {money(
                          filteredDaily.reduce(
                            (s, x) => s + Number(x.TotalEarnings || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="earning-side">
            <div className="earning-card payout-card">
              <div className="card-head">
                <h3>Yêu cầu rút tiền (Payout)</h3>
                <button type="button" onClick={() => setShowHistory((v) => !v)} style={{ cursor: "pointer" }}>
                  {showHistory ? "Ẩn lịch sử" : "Xem lịch sử"}
                </button>
              </div>

              <div className="payout-grid">
                <div className="payout-grid-left">
                  <p>Số dư khả dụng</p>
                  <h3>{money(payout.availableBalance)}</h3>

                  <input
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    placeholder="Ghi chú nhận tiền..."
                  />

                  <button 
                    onClick={handleRequestPayout}
                  >
                    Gửi yêu cầu rút
                  </button>
                </div>

                <div className="payout-grid-right">
                  <p>Lần rút gần nhất</p>
                  <h3>{money(payout.lastPayout)}</h3>
                  <span>
                    {payout.lastProcessedAt
                      ? shortDate(payout.lastProcessedAt)
                      : "Chưa có giao dịch"}
                  </span>
                </div>
              </div>

              {showHistory && (
                <div className="payout-history">
                  {payoutHistory.length === 0 ? (
                    <p style={{ textAlign: "center", fontSize: "13px", color: "#6f665b" }}>Chưa có lịch sử rút tiền</p>
                  ) : (
                    payoutHistory.map((item) => (
                      <div
                        className="top-service-row"
                        key={item.PayoutRequestId}
                      >
                        <b>#{item.PayoutRequestId}</b>
                        <span style={{ color: item.Status === "PAID" ? "#1b6b36" : item.Status === "PENDING" ? "#d9a441" : "#c73628" }}>{statusText(item.Status)}</span>
                        <strong>{money(item.Amount)}</strong>
                        <small>{shortDate(item.RequestedAt)}</small>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="earning-card goal-card">
              <div className="card-head">
                <h3>Mục tiêu thu nhập</h3>
                <button type="button" onClick={handleSaveGoal}>
                  Lưu
                </button>
              </div>

              <p>Mục tiêu tháng này</p>

              <input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="Nhập số tiền mục tiêu"
              />

              <h2>{money(goal)}</h2>

              <div className="goal-line">
                <i style={{ display: "block", height: "100%", background: "#456b35", width: `${Math.min(goalPercent, 100)}%` }} />
              </div>

              <div className="goal-status-text">
                <span>Đạt được: {money(earned)}</span>
                <b>{goalPercent}% mục tiêu</b>
              </div>
            </div>

            <div className="earning-card top-service-card">
              <div className="card-head">
                <h3>
                  Dịch vụ doanh thu cao nhất
                </h3>
                <button type="button" className="btn-top-count">Top 5</button>
              </div>

              {topServices.slice(0, 5).map((item, index) => (
                <div className="top-service-row" key={item.ServiceName}>
                  <b>{index + 1}</b>
                  <span>{item.ServiceName}</span>
                  <strong>{money(item.Amount)}</strong>
                  <small>{percent(item.Amount, overview.TotalEarnings)}%</small>
                </div>
              ))}

              {!topServices.length && <p style={{ textAlign: "center", color: "#6f665b", fontSize: "13px" }}>Chưa có dữ liệu dịch vụ</p>}
            </div>
          </aside>
        </section>

        <section className="earning-main-grid">
          <div className="earning-card yearly-card">
            <h3>
              ▧ Tổng kết doanh số năm ({year.YearNumber || new Date().getFullYear()})
            </h3>

            <div className="year-grid">
              <div className="year-grid-item">
                <p>Doanh thu năm</p>
                <h2>{money(year.TotalEarnings)}</h2>
                <small>Hóa đơn completed đã paid</small>
              </div>

              <div className="year-grid-item">
                <p>Hoa hồng tích lũy</p>
                <h2>{money(year.TotalCommission)}</h2>
                <small>Tổng thu nhập hoa hồng</small>
              </div>

              <div className="year-grid-item">
                <p>Tiền Tips nhận</p>
                <h2>{money(year.TotalTips)}</h2>
                <small>Khách hàng thưởng năm nay</small>
              </div>

              <div className="year-grid-item">
                <p>Số ca hoàn thành</p>
                <h2>{year.TotalServices || 0} ca</h2>
                <small>Buổi dịch vụ đã hoàn tất</small>
              </div>

              <div className="year-grid-item">
                <p>Trung bình tháng</p>
                <h2>{money(year.AvgMonthlyEarnings)}</h2>
                <small>Doanh thu bình quân mỗi tháng</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </TechnicianLayout>
  );
}
