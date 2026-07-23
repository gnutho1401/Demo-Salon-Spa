import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const FALLBACK_SERVICE = "/images/services/default-service.png";
const FALLBACK_AVATAR = "/images/avatars/default-avatar.png";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.slice(0, 5);
}

function appointmentCode(id) {
  return `AP${String(id || "").padStart(5, "0")}`;
}

function paymentText(status) {
  const s = String(status || "UNPAID").toUpperCase();

  if (s === "PAID") return "Đã thanh toán";
  if (s === "PENDING") return "Đang chờ";
  if (s === "FAILED") return "Thất bại";
  if (s === "REFUNDED") return "Đã hoàn tiền";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";

  return "Chưa thanh toán";
}

function buildMonthKey(value) {
  return String(value || "").slice(0, 7) || "Khác";
}



function paymentBadgeClass(status) {
  const s = String(status || "UNPAID").toUpperCase();
  if (s === "PAID") return "badge-paid";
  if (s === "PENDING") return "badge-pending";
  if (s === "FAILED") return "badge-failed";
  if (s === "REFUNDED") return "badge-refunded";
  if (s === "REFUND_PENDING") return "badge-refund-pending";
  return "badge-unpaid";
}

export default function ServiceHistory() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [summary, setSummary] = useState([]);
  const [technicianSummary, setTechnicianSummary] = useState([]);
  const [categorySummary, setCategorySummary] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("ALL");
  const [technician, setTechnician] = useState("ALL");
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState("timeline");

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/customers/me/service-history");
      const data = res.data.data || res.data || {};

      setItems(data.items || []);
      setStats(data.stats || {});
      setSummary(data.summary || []);
      setTechnicianSummary(data.technicianSummary || []);
      setCategorySummary(data.categorySummary || []);
      setMonthlySummary(data.monthlySummary || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch sử dịch vụ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.CategoryName).filter(Boolean)),
    );
  }, [items]);

  const technicians = useMemo(() => {
    return Array.from(
      new Map(
        items
          .filter((item) => item.EmployeeId)
          .map((item) => [
            String(item.EmployeeId),
            {
              EmployeeId: item.EmployeeId,
              EmployeeName: item.EmployeeName,
            },
          ]),
      ).values(),
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return items.filter((item) => {
      const date = String(item.AppointmentDate || "").slice(0, 10);
      const reviewed = Number(item.ReviewId || 0) > 0;
      const payment = String(item.PaymentStatus || "UNPAID").toUpperCase();

      const keywordOk =
        !text ||
        String(item.ServiceName || "")
          .toLowerCase()
          .includes(text) ||
        String(item.CategoryName || "")
          .toLowerCase()
          .includes(text) ||
        String(item.EmployeeName || "")
          .toLowerCase()
          .includes(text) ||
        String(item.BranchName || "")
          .toLowerCase()
          .includes(text) ||
        String(item.ReviewComment || "")
          .toLowerCase()
          .includes(text) ||
        appointmentCode(item.AppointmentId).toLowerCase().includes(text);

      const categoryOk = category === "ALL" || item.CategoryName === category;
      const technicianOk =
        technician === "ALL" || String(item.EmployeeId) === technician;
      const reviewOk =
        reviewStatus === "ALL" ||
        (reviewStatus === "REVIEWED" && reviewed) ||
        (reviewStatus === "NOT_REVIEWED" && !reviewed);
      const paymentOk = paymentStatus === "ALL" || payment === paymentStatus;
      const fromOk = !fromDate || date >= fromDate;
      const toOk = !toDate || date <= toDate;

      return (
        keywordOk &&
        categoryOk &&
        technicianOk &&
        reviewOk &&
        paymentOk &&
        fromOk &&
        toOk
      );
    });
  }, [
    items,
    keyword,
    category,
    technician,
    reviewStatus,
    paymentStatus,
    fromDate,
    toDate,
  ]);

  const groupedAppointments = useMemo(() => {
    const map = new Map();

    for (const item of filteredItems) {
      const apptId = item.AppointmentId;
      if (!map.has(apptId)) {
        map.set(apptId, {
          ...item,
          services: [],
        });
      }
      map.get(apptId).services.push(item);
    }

    return Array.from(map.values());
  }, [filteredItems]);

  const groupedByMonth = useMemo(() => {
    const map = new Map();

    for (const appt of groupedAppointments) {
      const key = buildMonthKey(appt.AppointmentDate);
      const current = map.get(key) || [];
      current.push(appt);
      map.set(key, current);
    }

    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [groupedAppointments]);

  const filteredStats = useMemo(() => {
    const total = filteredItems.length;
    const spent = filteredItems.reduce(
      (sum, item) => sum + Number(item.Price || 0),
      0,
    );
    const reviewed = filteredItems.filter(
      (item) => Number(item.ReviewId || 0) > 0,
    ).length;
    const duration = filteredItems.reduce(
      (sum, item) => sum + Number(item.DurationMinutes || 0),
      0,
    );

    return {
      total,
      spent,
      reviewed,
      notReviewed: total - reviewed,
      duration,
    };
  }, [filteredItems]);

  function clearFilters() {
    setKeyword("");
    setCategory("ALL");
    setTechnician("ALL");
    setReviewStatus("ALL");
    setPaymentStatus("ALL");
    setFromDate("");
    setToDate("");
  }

  function exportCsv() {
    const header = [
      "AppointmentCode",
      "ServiceName",
      "Category",
      "Employee",
      "Date",
      "StartTime",
      "EndTime",
      "Price",
      "PaymentStatus",
      "Rating",
      "ReviewComment",
    ];

    const body = filteredItems.map((item) => [
      appointmentCode(item.AppointmentId),
      item.ServiceName || "",
      item.CategoryName || "",
      item.EmployeeName || "",
      String(item.AppointmentDate || "").slice(0, 10),
      formatTime(item.StartTime),
      formatTime(item.EndTime),
      Number(item.Price || 0),
      item.PaymentStatus || "",
      item.Rating || "",
      String(item.ReviewComment || "").replaceAll("\n", " "),
    ]);

    const csv = [header, ...body]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleFavoriteService(serviceId) {
    try {
      setLoadingId(`service-${serviceId}`);
      setError("");
      setMessage("");

      await axiosClient.post("/customers/me/favorites/services/toggle", {
        serviceId,
      });

      setMessage("Đã cập nhật dịch vụ yêu thích");
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Không cập nhật được yêu thích");
    } finally {
      setLoadingId("");
    }
  }

  async function toggleFavoriteEmployee(employeeId) {
    try {
      setLoadingId(`employee-${employeeId}`);
      setError("");
      setMessage("");

      await axiosClient.post("/customers/me/favorites/employees/toggle", {
        employeeId,
      });

      setMessage("Đã cập nhật kỹ thuật viên yêu thích");
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Không cập nhật được yêu thích");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <CustomerLayout>
      <div className="service-history-pro">
        <section className="service-history-hero">
          <div className="hero-text-section">
            <span className="hero-badge">Service History</span>
            <h1>Lịch sử dịch vụ</h1>
            <p>
              Theo dõi toàn bộ dịch vụ đã hoàn thành, kỹ thuật viên đã phục vụ,
              thanh toán, đánh giá, ảnh review và đặt lại dịch vụ nhanh chóng.
            </p>

            <div className="service-history-actions">
              <Link to="/customer/booking" className="btn-book-new">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Đặt lịch mới
              </Link>
              <button type="button" onClick={exportCsv} className="btn-export-csv">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Xuất dữ liệu CSV
              </button>
            </div>
          </div>

          <div className="service-history-hero-card">
            <div className="hero-card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </div>
            <div className="hero-card-details">
              <small>ĐÃ THỰC HIỆN</small>
              <strong>{stats.totalServicesUsed || 0}</strong>
              <span>Tổng thời gian: {stats.totalDuration || 0} phút</span>
            </div>
          </div>
        </section>

        {message && <div className="history-alert success">{message}</div>}
        {error && <div className="history-alert error">{error}</div>}

        <section className="service-history-stats">
          <article>
            <div className="stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                <path d="M19 3v4M21 5h-4"></path>
              </svg>
            </div>
            <div className="stat-card-content">
              <p>Dịch vụ đã dùng</p>
              <strong>{loading ? "..." : filteredStats.total}</strong>
              <small>Theo bộ lọc hiện tại</small>
            </div>
          </article>

          <article>
            <div className="stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
                <path d="M6 14h2M10 14h4"></path>
              </svg>
            </div>
            <div className="stat-card-content">
              <p>Tổng chi tiêu</p>
              <strong>
                {loading ? "..." : formatMoney(stats.totalSpent)}
              </strong>
              <small>Tổng tích lũy thực tế</small>
            </div>
          </article>

          <article>
            <div className="stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <div className="stat-card-content">
              <p>Đã đánh giá</p>
              <strong>{loading ? "..." : filteredStats.reviewed}</strong>
              <small>Chưa đánh giá: {filteredStats.notReviewed}</small>
            </div>
          </article>

          <article>
            <div className="stat-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="stat-card-content">
              <p>Thời gian chăm sóc</p>
              <strong>{loading ? "..." : `${filteredStats.duration} phút`}</strong>
              <small>Tổng thời lượng dịch vụ</small>
            </div>
          </article>
        </section>

        <section className="service-history-insights">
          <article className="insight-card favorite-service-card">
            <div className="insight-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
            </div>
            <div className="insight-card-body">
              <span>Dịch vụ yêu thích nhất</span>
              <h3>{stats.favoriteService?.ServiceName || "Chưa có"}</h3>
              <p>
                {stats.favoriteService
                  ? `${stats.favoriteService.usageCount} lần sử dụng · ${formatMoney(stats.favoriteService.totalSpent)}`
                  : "Hoàn thành thêm dịch vụ để hệ thống thống kê."}
              </p>
            </div>
          </article>

          <article className="insight-card favorite-employee-card">
            <div className="insight-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div className="insight-card-body">
              <span>Kỹ thuật viên quen thuộc</span>
              <h3>{stats.favoriteTechnician?.EmployeeName || "Chưa có"}</h3>
              <p>
                {stats.favoriteTechnician
                  ? `${stats.favoriteTechnician.usageCount} lần phục vụ`
                  : "Chưa có dữ liệu phục vụ."}
              </p>
            </div>
          </article>

          <article className="insight-card avg-rating-card">
            <div className="insight-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <div className="insight-card-body">
              <span>Đánh giá trung bình</span>
              <h3>{stats.averageRating ? `${Number(stats.averageRating).toFixed(1)}/5` : "5.0/5"}</h3>
              <p>Dựa trên các dịch vụ bạn đã đánh giá.</p>
            </div>
          </article>
        </section>

        <section className="service-history-filter">
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="search-svg-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              placeholder="Tìm mã lịch, dịch vụ, kỹ thuật viên, chi nhánh, review..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">Tất cả danh mục</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          >
            <option value="ALL">Tất cả kỹ thuật viên</option>
            {technicians.map((item) => (
              <option value={String(item.EmployeeId)} key={item.EmployeeId}>
                {item.EmployeeName}
              </option>
            ))}
          </select>

          <select
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value)}
          >
            <option value="ALL">Tất cả đánh giá</option>
            <option value="REVIEWED">Đã đánh giá</option>
            <option value="NOT_REVIEWED">Chưa đánh giá</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="FAILED">Thất bại</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <button type="button" onClick={clearFilters} className="clear-filters-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Xóa lọc
          </button>
        </section>

        <section className="service-history-tabs">
          <button
            type="button"
            className={viewMode === "timeline" ? "active" : ""}
            onClick={() => setViewMode("timeline")}
          >
            Timeline
          </button>

          <button
            type="button"
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Card dịch vụ
          </button>

          <button
            type="button"
            className={viewMode === "summary" ? "active" : ""}
            onClick={() => setViewMode("summary")}
          >
            Thống kê
          </button>
        </section>

        {loading && (
          <div className="history-loading">
            <div className="spinner"></div>
            Đang tải lịch sử dịch vụ...
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="history-empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </div>
            <h3>Chưa có lịch sử dịch vụ phù hợp</h3>
            <p>Khi các lịch hẹn hoàn thành, dịch vụ sẽ xuất hiện ở đây.</p>
            <Link to="/customer/booking">Đặt lịch ngay</Link>
          </div>
        )}

        {!loading && viewMode === "timeline" && filteredItems.length > 0 && (
          <section className="history-timeline-pro">
            {groupedByMonth.map(([month, rows]) => (
              <div className="history-month-group" key={month}>
                <h2>
                  Tháng {month.slice(5, 7)}/{month.slice(0, 4)}
                </h2>

                <div className="history-month-list">
                  {rows.map((item) => (
                    <HistoryCard
                      key={`${item.AppointmentId}-${item.ServiceId}`}
                      item={item}
                      navigate={navigate}
                      loadingId={loadingId}
                      toggleFavoriteService={toggleFavoriteService}
                      toggleFavoriteEmployee={toggleFavoriteEmployee}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && viewMode === "cards" && groupedAppointments.length > 0 && (
          <section className="history-card-grid-pro">
            {groupedAppointments.map((item) => (
              <HistoryCard
                key={item.AppointmentId}
                item={item}
                navigate={navigate}
                loadingId={loadingId}
                toggleFavoriteService={toggleFavoriteService}
                toggleFavoriteEmployee={toggleFavoriteEmployee}
              />
            ))}
          </section>
        )}

        {!loading && viewMode === "summary" && (
          <section className="history-summary-grid-pro">
            <SummaryPanel
              title="Dịch vụ sử dụng nhiều nhất"
              rows={summary}
              type="service"
            />
            <SummaryPanel
              title="Kỹ thuật viên phục vụ nhiều nhất"
              rows={technicianSummary}
              type="technician"
            />
            <SummaryPanel
              title="Danh mục dịch vụ"
              rows={categorySummary}
              type="category"
            />
            <SummaryPanel
              title="Theo tháng"
              rows={monthlySummary}
              type="month"
            />
          </section>
        )}
      </div>
    </CustomerLayout>
  );
}

function getStepTimeRange(step, allSteps, apptStartTime) {
  if (step.StepStartTime && step.StepEndTime) {
    return `${step.StepStartTime.slice(0, 5)} - ${step.StepEndTime.slice(0, 5)}`;
  }
  if (!apptStartTime || !apptStartTime.includes(":")) return null;

  const idx = allSteps.indexOf(step);
  let accumulatedMins = 0;
  const [h, m] = apptStartTime.split(":").map(Number);
  const startTotal = (h || 0) * 60 + (m || 0);

  for (let i = 0; i < (idx >= 0 ? idx : 0); i++) {
    accumulatedMins += Number(allSteps[i].DurationMinutes) || 0;
  }

  const stepStartMins = startTotal + accumulatedMins;
  const stepEndMins = stepStartMins + (Number(step.DurationMinutes) || 0);

  const fmt = (mins) => {
    const hrs = Math.floor(mins / 60) % 24;
    const minsVal = mins % 60;
    return `${String(hrs).padStart(2, "0")}:${String(minsVal).padStart(2, "0")}`;
  };

  return `${fmt(stepStartMins)} - ${fmt(stepEndMins)}`;
}

function HistoryCard({
  item,
  navigate,
  loadingId,
  toggleFavoriteService,
  toggleFavoriteEmployee,
}) {
  const reviewed = Number(item.ReviewId || 0) > 0;
  const isCombo = Boolean(item.CustomerPackageId || item.PackageName);
  const displayTitle = isCombo ? (item.PackageName || item.ServiceName || "Gói Combo Spa") : (item.ServiceName || "Dịch vụ");
  const displayImage = isCombo ? (item.PackageImageUrl || item.ServiceImageUrl) : item.ServiceImageUrl;
  const totalDuration = Array.isArray(item.services) && item.services.length > 0
    ? item.services.reduce((acc, s) => acc + (Number(s.DurationMinutes) || 0), 0)
    : (item.DurationMinutes || 0);

  const allTechNames = isCombo && Array.isArray(item.services)
    ? Array.from(new Set(item.services.map(s => s.StepTechnicianName || s.EmployeeName).filter(Boolean))).join(", ")
    : (item.EmployeeName || "Chuyên viên Salon");

  const comboTechnicians = useMemo(() => {
    if (!isCombo || !Array.isArray(item.services)) return [];
    const map = new Map();
    for (const s of item.services) {
      const techName = s.StepTechnicianName || s.EmployeeName || "KTV Salon";
      const techAvatar = s.StepTechnicianAvatar || s.EmployeeImageUrl || FALLBACK_AVATAR;
      const techId = s.StepEmployeeId || s.EmployeeId || techName;

      if (!map.has(techId)) {
        map.set(techId, {
          EmployeeId: s.StepEmployeeId || s.EmployeeId,
          EmployeeName: techName,
          EmployeeImageUrl: techAvatar,
          Specialization: s.Specialization || "Chuyên viên làm đẹp",
          IsFavoriteEmployee: s.IsFavoriteEmployee
        });
      }
    }
    return Array.from(map.values());
  }, [isCombo, item.services]);

  const displayPrice = isCombo ? 0 : item.Price;
  const isPackagePaid = item.PaidPrice === 0 || isCombo;

  return (
    <article className="history-service-card-pro">
      <div className="history-service-image">
        <img
          src={resolveFileUrl(displayImage) || FALLBACK_SERVICE}
          alt={displayTitle}
        />
        <span>{isCombo ? "Gói Combo Spa" : (item.CategoryName || "Beauty Service")}</span>
      </div>

      <div className="history-service-body">
        <div className="history-card-head">
          <div className="history-card-title-group">
            <small>{appointmentCode(item.AppointmentId)}</small>
            <h3>{displayTitle}</h3>
          </div>
          <div className="history-card-price-group">
            <b className="history-card-price">{isCombo ? "Trọn gói Combo" : formatMoney(displayPrice)}</b>
            {isPackagePaid && (
              <span className="badge-package-paid">Thanh toán bằng Combo</span>
            )}
          </div>
        </div>

        <p className="history-card-desc">
          {item.ServiceDescription || "Dịch vụ chăm sóc sắc đẹp tại salon."}
        </p>

        {/* BƯỚC DỊCH VỤ TRONG COMBO (NẾU CÓ) */}
        {isCombo && Array.isArray(item.services) && item.services.length > 0 && (
          <div style={{ background: "#fdf2f8", padding: "12px 16px", borderRadius: 14, border: "1px solid #fbcfe8", margin: "14px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              ✂️ CÁC BƯỚC DỊCH VỤ TRONG COMBO & KTV THỰC HIỆN:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
              {item.services.map((s, idx) => {
                const stepTimeStr = getStepTimeRange(s, item.services, item.StartTime);
                const techNameStr = s.StepTechnicianName || s.EmployeeName || "KTV Salon";
                const techAvatarStr = s.StepTechnicianAvatar || s.EmployeeImageUrl || FALLBACK_AVATAR;

                return (
                  <div key={idx} style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 10, border: "1px solid #fbcfe8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b style={{ color: "#831843", fontSize: 12, display: "block" }}>{idx + 1}. {s.ServiceName}</b>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        ⏱ {stepTimeStr ? `${stepTimeStr} (${s.DurationMinutes || 30} phút)` : `${s.DurationMinutes || 30} phút`}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#be185d", background: "#fdf2f8", padding: "3px 8px", borderRadius: 12, border: "1px solid #fbcfe8", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <img
                        src={resolveFileUrl(techAvatarStr) || FALLBACK_AVATAR}
                        alt={techNameStr}
                        style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
                      />
                      {techNameStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="history-info-grid">
          <div className="info-item">
            <span className="info-icon icon-calendar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </span>
            <div className="info-text">
              <span>Ngày thực hiện</span>
              <b>
                {formatDate(item.AppointmentDate)} · {formatTime(item.StartTime)}{item.EndTime ? ` - ${formatTime(item.EndTime)}` : ""}
              </b>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon icon-user">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <div className="info-text">
              <span>Kỹ thuật viên</span>
              <b>{allTechNames || "Chuyên viên Salon"}</b>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon icon-map">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </span>
            <div className="info-text">
              <span>Chi nhánh</span>
              <b>{item.BranchName || "Chưa có"}</b>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon icon-payment">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </span>
            <div className="info-text">
              <span>Thanh toán</span>
              <span className={`payment-status-badge ${isCombo ? "badge-paid" : paymentBadgeClass(item.PaymentStatus)}`}>
                {isCombo ? "Đã thanh toán" : paymentText(item.PaymentStatus)}
              </span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon icon-clock">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </span>
            <div className="info-text">
              <span>Thời lượng</span>
              <b>{totalDuration} phút</b>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon icon-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </span>
            <div className="info-text">
              <span>Voucher / Combo</span>
              <b className="voucher-code-text">{item.PackageName || item.VoucherCode || "Gói Combo"}</b>
            </div>
          </div>
        </div>

        {/* THẺ KỸ THUẬT VIÊN (HIỂN THỊ ĐẦY ĐỦ CHO TẤT CẢ KTV TRONG COMBO) */}
        {isCombo && comboTechnicians.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "14px 0" }}>
            {comboTechnicians.map((tech, tIdx) => (
              <div
                key={tIdx}
                className="history-employee-mini"
                style={{ flex: "1 1 200px", margin: 0, background: "#ffffff", border: "1px solid #fbcfe8", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}
              >
                <img
                  src={resolveFileUrl(tech.EmployeeImageUrl) || FALLBACK_AVATAR}
                  alt={tech.EmployeeName}
                  style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #ec4899" }}
                />
                <div className="employee-info-content" style={{ flex: 1 }}>
                  <b style={{ fontSize: 13, color: "#831843" }}>{tech.EmployeeName}</b>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{tech.Specialization || "Chuyên viên làm đẹp"}</span>
                </div>
                {tech.EmployeeId && (
                  <button
                    type="button"
                    className={`favorite-employee-btn ${Number(tech.IsFavoriteEmployee) ? "active" : ""}`}
                    disabled={loadingId === `employee-${tech.EmployeeId}`}
                    onClick={() => toggleFavoriteEmployee(tech.EmployeeId)}
                    aria-label="Yêu thích kỹ thuật viên"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={Number(tech.IsFavoriteEmployee) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="history-employee-mini">
            <img
              src={resolveFileUrl(item.EmployeeImageUrl || FALLBACK_AVATAR)}
              alt={item.EmployeeName}
            />

            <div className="employee-info-content">
              <b>{item.EmployeeName || "Kỹ thuật viên"}</b>
              <span>
                {item.Specialization || item.Position || "Beauty Expert"}
              </span>
            </div>

            <button
              type="button"
              className={`favorite-employee-btn ${Number(item.IsFavoriteEmployee) ? "active" : ""}`}
              disabled={loadingId === `employee-${item.EmployeeId}`}
              onClick={() => toggleFavoriteEmployee(item.EmployeeId)}
              aria-label="Yêu thích kỹ thuật viên"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={Number(item.IsFavoriteEmployee) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
            </button>
          </div>
        )}

        <div className="history-review-box">
          {reviewed ? (
            <>
              <div className="history-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={i < Number(item.Rating || 0) ? "#ffb800" : "none"}
                    stroke={i < Number(item.Rating || 0) ? "#ffb800" : "#d0d0d0"}
                    strokeWidth="2.5"
                    style={{ marginRight: "4px" }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                ))}
              </div>
              <p className="review-comment-text">"{item.ReviewComment || "Không có nội dung đánh giá."}"</p>

              {item.AdminResponse && (
                <div className="history-admin-response">
                  <div className="admin-avatar-mini">S</div>
                  <div className="admin-response-body">
                    <b>Salon Phản hồi:</b>
                    <p>{item.AdminResponse}</p>
                  </div>
                </div>
              )}

              {Array.isArray(item.Images) && item.Images.length > 0 && (
                <div className="history-review-images">
                  {item.Images.map((img) => (
                    <img
                      key={img.ReviewImageId || img.ImageUrl}
                      src={resolveFileUrl(img.ImageUrl)}
                      alt="Review"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="history-not-reviewed">
              <b>{isCombo ? "Chưa đánh giá ca hẹn Combo này" : "Chưa đánh giá dịch vụ này"}</b>
              <span>Hãy đánh giá để giúp salon cải thiện chất lượng dịch vụ tốt hơn.</span>
            </div>
          )}
        </div>

        <div className="history-actions-pro">
          {isCombo ? (
            <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn-rebook-ap"
                style={{ background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", color: "#ffffff", border: "none", fontWeight: 800, borderRadius: "10px", padding: "8px 16px", cursor: "pointer", boxShadow: "0 4px 12px rgba(236,72,153,0.3)" }}
                onClick={() => navigate(`/customer/packages?packageId=${item.CustomerPackageId}`)}
                title="Bấm để chuyển đến gói Combo và đặt lịch 1 lượt tiếp theo"
              >
                🔄 Đặt Lại Combo →
              </button>
              <button
                type="button"
                className="btn-detail-ap"
                style={{ background: "#fdf2f8", color: "#db2777", border: "1px solid #fbcfe8", fontWeight: 700, borderRadius: "10px", padding: "8px 16px", cursor: "pointer" }}
                onClick={() => navigate(`/customer/packages?packageId=${item.CustomerPackageId}`)}
              >
                📦 Chi Tiết
              </button>
              <button
                type="button"
                className="btn-review-ap"
                style={{ background: "#fff1f2", color: "#be185d", border: "1px solid #fecdd3", fontWeight: 700, borderRadius: "10px", padding: "8px 16px", cursor: "pointer" }}
                onClick={() => navigate(`/customer/packages?tab=reviews`)}
              >
                ⭐ Đánh Giá
              </button>
            </div>
          ) : (
            <>
              <Link to={`/customer/appointments/${item.AppointmentId}`} className="btn-detail-ap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Chi tiết
              </Link>

              {!reviewed && (
                <Link
                  to={`/customer/reviews?appointmentId=${item.AppointmentId}&serviceId=${item.ServiceId}`}
                  className="btn-review-ap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Đánh giá
                </Link>
              )}

              <button
                type="button"
                className="btn-rebook-ap"
                onClick={() =>
                  navigate(
                    `/customer/booking?serviceId=${item.ServiceId || ""}&employeeId=${item.EmployeeId || ""}`,
                  )
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Đặt lại
              </button>
            </>
          )}

          <button
            type="button"
            className={`btn-favorite-service ${Number(item.IsFavoriteService) ? "active" : ""}`}
            disabled={loadingId === `service-${item.ServiceId}`}
            onClick={() => toggleFavoriteService(item.ServiceId)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={Number(item.IsFavoriteService) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
            </svg>
            {Number(item.IsFavoriteService) ? "Đã thích" : "Yêu thích"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SummaryPanel({ title, rows, type }) {
  return (
    <article className="history-summary-panel">
      <h3>{title}</h3>

      {rows.length === 0 ? (
        <p className="history-muted">Chưa có dữ liệu thống kê.</p>
      ) : (
        <div className="summary-list">
          {rows.slice(0, 8).map((item, index) => {
            const name =
              item.ServiceName ||
              item.EmployeeName ||
              item.CategoryName ||
              item.month ||
              "Không rõ";

            const count = item.usageCount || 0;
            const spent = item.totalSpent ? formatMoney(item.totalSpent) : "";

            return (
              <div className="history-summary-row" key={`${type}-${name}`}>
                <span className="row-index">{index + 1}</span>
                <div className="row-info">
                  <b>{name}</b>
                  <small>
                    {count} lần sử dụng {spent ? `· Tổng chi tiêu: ${spent}` : ""}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

