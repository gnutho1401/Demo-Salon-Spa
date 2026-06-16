import { useEffect, useMemo, useState } from "react";
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
  return `${h}h ${m}m`;
}

function statusText(status) {
  const map = {
    PENDING: "Đang chờ",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
    PAID: "Đã thanh toán",
  };

  return map[status] || status || "N/A";
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
      alert(err.response?.data?.message || "Không tải được earnings");
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
    goal > 0 ? Math.min(Math.round((earned / goal) * 100), 160) : 0;

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
      alert(err.response?.data?.message || "Không export được báo cáo");
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
      alert("Đã cập nhật mục tiêu earning");
    } catch (err) {
      alert(err.response?.data?.message || "Không cập nhật được mục tiêu");
    }
  }

  async function handleRequestPayout() {
    try {
      const available = Number(payout.availableBalance || 0);

      if (available <= 0) {
        alert("Không có số dư khả dụng để payout");
        return;
      }

      await axiosClient.post("/technician/earnings/payouts", {
        amount: available,
        note: payoutNote || "Technician payout request",
      });

      setPayoutNote("");
      await loadEarnings();
      await loadPayoutHistory();
      alert("Đã gửi yêu cầu payout");
    } catch (err) {
      alert(err.response?.data?.message || "Không tạo được yêu cầu payout");
    }
  }

  if (loading) {
    return (
      <TechnicianLayout>
        <div className="earning-page">
          <div className="earning-loading">Đang tải earnings...</div>
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
              Earnings <span>💰</span>
            </h1>
            <p>
              Theo dõi doanh thu, hoa hồng và payout từ lịch hẹn đã hoàn thành
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
            ⇩ Export JSON
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
              This Week
            </button>
            <button
              onClick={() => setRange("month")}
              className={range === "month" ? "active" : ""}
            >
              This Month
            </button>
            <button
              onClick={() => setRange("lastMonth")}
              className={range === "lastMonth" ? "active" : ""}
            >
              Last Month
            </button>
            <button
              onClick={() => setRange("year")}
              className={range === "year" ? "active" : ""}
            >
              This Year
            </button>
          </div>
        </section>

        <section className="earning-stat-row">
          <div className="earning-stat-card">
            <span className="green">💵</span>
            <p>Total Revenue</p>
            <h2>{money(overview.TotalEarnings)}</h2>
            <small>Tổng tiền invoice đã PAID</small>
            <div className="mini-line" />
          </div>

          <div className="earning-stat-card">
            <span className="purple">♙</span>
            <p>Commission</p>
            <h2>{money(overview.Commission)}</h2>
            <small>Hoa hồng của technician</small>
            <div className="mini-line purple-line" />
          </div>

          <div className="earning-stat-card">
            <span className="pink">♡</span>
            <p>Tips</p>
            <h2>{money(overview.Tips)}</h2>
            <small>Tip lưu trong invoice nếu có</small>
            <div className="mini-line pink-line" />
          </div>

          <div className="earning-stat-card">
            <span className="blue">▣</span>
            <p>Completed</p>
            <h2>{overview.ServicesCompleted || 0}</h2>
            <small>Lịch hẹn đã hoàn thành và thanh toán</small>
            <div className="mini-line blue-line" />
          </div>

          <div className="earning-stat-card">
            <span className="gold">▤</span>
            <p>Avg. Order Value</p>
            <h2>{money(overview.AvgOrderValue)}</h2>
            <small>Giá trị trung bình mỗi hóa đơn</small>
            <div className="mini-line gold-line" />
          </div>

          <div className="earning-stat-card">
            <span className="green">◷</span>
            <p>Working Hours</p>
            <h2>{formatMinutes(overview.WorkingMinutes)}</h2>
            <small>Tính từ appointment đã completed</small>
            <div className="mini-line" />
          </div>
        </section>

        <section className="earning-main-grid">
          <div className="earning-card earning-chart-card">
            <div className="card-head">
              <h3>Earnings Overview</h3>
              <button type="button">Daily</button>
            </div>

            <div className="chart-legend">
              <span>
                <i /> Revenue
              </span>
              <span>
                <i className="commission-dot" /> Commission
              </span>
            </div>

            <div className="bar-chart">
              {(filteredDaily.length ? filteredDaily : [])
                .slice(0, 20)
                .map((item, index) => {
                  const revenue = Number(item.TotalEarnings || 0);
                  const commission = Number(item.Commission || 0);
                  const max = Math.max(
                    ...filteredDaily.map((x) => Number(x.TotalEarnings || 0)),
                    1,
                  );

                  const height = Math.max(
                    16,
                    Math.round((revenue / max) * 125),
                  );
                  const commissionHeight = Math.max(
                    8,
                    Math.round((commission / max) * 125),
                  );

                  return (
                    <div
                      className="bar-col"
                      key={`${item.AppointmentDate}-${index}`}
                    >
                      <div className="bar-tooltip">
                        {shortDate(item.AppointmentDate)}
                        <br />
                        Revenue: {money(revenue)}
                        <br />
                        Commission: {money(commission)}
                      </div>
                      <i style={{ height }} />
                      <b style={{ height: commissionHeight }} />
                      <small>
                        {index % 3 === 0
                          ? shortDate(item.AppointmentDate).slice(0, 5)
                          : ""}
                      </small>
                    </div>
                  );
                })}

              {!filteredDaily.length && (
                <div className="earning-empty">Chưa có dữ liệu earning</div>
              )}
            </div>
          </div>

          <div className="earning-card category-chart-card">
            <div className="card-head">
              <h3>Earnings by Service Category</h3>
              <button type="button">Details</button>
            </div>

            <div className="donut-wrap">
              <div className="donut">
                <div>
                  <h3>{money(overview.TotalEarnings)}</h3>
                  <p>Total</p>
                </div>
              </div>

              <div className="category-list">
                {categories.length === 0 ? (
                  <p>Chưa có dữ liệu category</p>
                ) : (
                  categories.map((item, index) => (
                    <div
                      key={item.CategoryName}
                      className="category-income-row"
                    >
                      <span>
                        <i className={`dot dot-${index}`} /> {item.CategoryName}
                      </span>
                      <b>{percent(item.Amount, totalCategoryAmount)}%</b>
                      <small>{money(item.Amount)}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="earning-card achievement-card">
            <h3>🏵 Monthly Achievement</h3>
            <h4>Tiến độ mục tiêu tháng</h4>
            <p>Dựa trên commission + tips đã kiếm được.</p>
            <strong>{goalPercent}%</strong>
            <span>of your monthly target</span>

            <div className="goal-line">
              <i style={{ width: `${Math.min(goalPercent, 100)}%` }} />
            </div>

            <b>
              {money(earned)} / {money(goal)}
            </b>
          </div>

          <div className="earning-card breakdown-card">
            <div className="card-head">
              <h3>Earnings Breakdown</h3>
              <button type="button">{filteredDaily.length} rows</button>
            </div>

            <table className="earning-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Appointments</th>
                  <th>Services</th>
                  <th>Commission</th>
                  <th>Tips</th>
                  <th>Total Revenue</th>
                  <th>Status</th>
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
                      <span className="paid-pill">PAID</span>
                    </td>
                  </tr>
                ))}

                {!filteredDaily.length && (
                  <tr>
                    <td colSpan="7">
                      Không có dữ liệu earning trong khoảng này
                    </td>
                  </tr>
                )}

                {!!filteredDaily.length && (
                  <tr className="total-row">
                    <td>Total</td>
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

          <aside className="earning-side">
            <div className="earning-card payout-card">
              <div className="card-head">
                <h3>Payout Summary</h3>
                <button type="button" onClick={() => setShowHistory((v) => !v)}>
                  {showHistory ? "Hide" : "View All"}
                </button>
              </div>

              <div className="payout-grid">
                <div>
                  <p>Available Balance</p>
                  <h3>{money(payout.availableBalance)}</h3>

                  <input
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    placeholder="Ghi chú payout..."
                    style={{ width: "100%", marginBottom: 10 }}
                  />

                  <button onClick={handleRequestPayout}>Request Payout</button>
                </div>

                <div>
                  <p>Last Payout</p>
                  <h3>{money(payout.lastPayout)}</h3>
                  <span>
                    {payout.lastProcessedAt
                      ? shortDate(payout.lastProcessedAt)
                      : "Chưa có payout"}
                  </span>
                </div>
              </div>

              {showHistory && (
                <div className="payout-history">
                  {payoutHistory.length === 0 ? (
                    <p>Chưa có lịch sử payout</p>
                  ) : (
                    payoutHistory.map((item) => (
                      <div
                        className="top-service-row"
                        key={item.PayoutRequestId}
                      >
                        <b>#{item.PayoutRequestId}</b>
                        <span>{statusText(item.Status)}</span>
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
                <h3>Earnings Goal</h3>
                <button type="button" onClick={handleSaveGoal}>
                  Save
                </button>
              </div>

              <p>Monthly Goal</p>

              <input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="Nhập mục tiêu tháng"
                style={{ width: "100%", margin: "8px 0" }}
              />

              <h2>{money(goal)}</h2>

              <div className="goal-line">
                <i style={{ width: `${Math.min(goalPercent, 100)}%` }} />
              </div>

              <small>{money(earned)} earned</small>
              <strong>🎯</strong>
            </div>

            <div className="earning-card top-service-card">
              <div className="card-head">
                <h3>
                  Top Services <span>By Revenue</span>
                </h3>
                <button type="button">Top 5</button>
              </div>

              {topServices.slice(0, 5).map((item, index) => (
                <div className="top-service-row" key={item.ServiceName}>
                  <b>{index + 1}</b>
                  <span>{item.ServiceName}</span>
                  <strong>{money(item.Amount)}</strong>
                  <small>{percent(item.Amount, overview.TotalEarnings)}%</small>
                </div>
              ))}

              {!topServices.length && <p>Chưa có dữ liệu service</p>}
            </div>
          </aside>

          <div className="earning-card yearly-card">
            <h3>
              ▧ Yearly Summary ({year.YearNumber || new Date().getFullYear()})
            </h3>

            <div className="year-grid">
              <div>
                <p>Total Revenue</p>
                <h2>{money(year.TotalEarnings)}</h2>
                <small>Doanh thu invoice đã paid</small>
              </div>

              <div>
                <p>Total Commission</p>
                <h2>{money(year.TotalCommission)}</h2>
                <small>Hoa hồng năm nay</small>
              </div>

              <div>
                <p>Total Tips</p>
                <h2>{money(year.TotalTips)}</h2>
                <small>Tip năm nay</small>
              </div>

              <div>
                <p>Total Completed</p>
                <h2>{year.TotalServices || 0}</h2>
                <small>Lịch completed + paid</small>
              </div>

              <div>
                <p>Avg. Monthly Revenue</p>
                <h2>{money(year.AvgMonthlyEarnings)}</h2>
                <small>Trung bình theo tháng có doanh thu</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </TechnicianLayout>
  );
}
