import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("vi-VN");
}

function timeText(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusClass(status) {
  return `admin-status admin-status-${String(status || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function safeAvatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function StatCard({ label, value, note, icon }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        {note ? <span>{note}</span> : null}
      </div>
    </article>
  );
}

function MiniBarChart({ items }) {
  const max = Math.max(...items.map((item) => Number(item.revenue || 0)), 1);

  return (
    <div className="admin-mini-chart">
      {items.map((item) => {
        const height = Math.max(10, (Number(item.revenue || 0) / max) * 100);

        return (
          <div className="admin-chart-item" key={item.date}>
            <div className="admin-chart-track">
              <div
                className="admin-chart-bar"
                style={{ height: `${height}%` }}
                title={formatMoney(item.revenue)}
              />
            </div>
            <span>{String(item.date).slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(isRefresh = false) {
    try {
      setError("");
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await axiosClient.get("/admin/dashboard");
      setData(res.data.data || res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được dashboard admin",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const summary = data?.summary || {};

  const maxServiceCount = useMemo(() => {
    const values =
      data?.topServices?.map((item) => item.appointmentCount) || [];
    return Math.max(...values, 1);
  }, [data]);

  return (
    <section className="admin-dashboard admin-page">
      <div className="admin-dashboard-hero">
        <div>
          <div className="admin-eyebrow">Admin Overview</div>
          <h1>Dashboard quản trị Beauty Salon</h1>
          <p>
            Theo dõi doanh thu, lịch hẹn, thanh toán, đánh giá, phản hồi và hiệu
            suất kỹ thuật viên theo dữ liệu thật từ database.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
        >
          {refreshing ? "Đang cập nhật..." : "Làm mới"}
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải dữ liệu dashboard...</div>
      ) : null}

      {error ? <div className="admin-error-card">{error}</div> : null}

      {!loading && data ? (
        <>
          <div className="admin-stat-grid">
            <StatCard
              icon="₫"
              label="Doanh thu hôm nay"
              value={formatMoney(summary.revenueToday)}
              note="Tổng payment PAID trong ngày"
            />
            <StatCard
              icon="↗"
              label="Doanh thu tháng này"
              value={formatMoney(summary.revenueThisMonth)}
              note="Tổng doanh thu đã thanh toán"
            />
            <StatCard
              icon="📅"
              label="Lịch hẹn hôm nay"
              value={summary.appointmentsToday}
              note={`${summary.totalAppointments || 0} lịch hẹn toàn hệ thống`}
            />
            <StatCard
              icon="👥"
              label="Khách hàng"
              value={summary.totalCustomers}
              note={`${summary.activeUsers || 0} tài khoản đang active`}
            />
            <StatCard
              icon="💆"
              label="Nhân viên"
              value={summary.totalEmployees}
              note="Bao gồm technician/receptionist/admin"
            />
            <StatCard
              icon="✨"
              label="Dịch vụ đang bán"
              value={summary.activeServices}
              note={`${summary.inactiveServices || 0} dịch vụ không active`}
            />
            <StatCard
              icon="💳"
              label="Payment cần xử lý"
              value={summary.pendingPayments}
              note={`${summary.failedPayments || 0} payment thất bại`}
            />
            <StatCard
              icon="💬"
              label="Review / Feedback chờ xử lý"
              value={`${summary.pendingReviews || 0} / ${
                summary.pendingFeedbacks || 0
              }`}
              note="Cần admin kiểm tra"
            />
          </div>

          <div className="admin-dashboard-layout">
            <article className="admin-panel admin-panel-large">
              <div className="admin-panel-head">
                <div>
                  <h2>Doanh thu 7 ngày gần nhất</h2>
                  <p>Theo các payment có trạng thái PAID.</p>
                </div>
              </div>

              <MiniBarChart items={data.revenueByDay || []} />
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Trạng thái lịch hẹn</h2>
                  <p>Tổng hợp toàn bộ appointment.</p>
                </div>
              </div>

              <div className="admin-status-list">
                {(data.appointmentStatus || []).map((item) => (
                  <div className="admin-status-row" key={item.status}>
                    <span className={statusClass(item.status)}>
                      {item.status}
                    </span>
                    <strong>{item.count}</strong>
                  </div>
                ))}

                {!data.appointmentStatus?.length ? (
                  <p className="admin-empty">Chưa có lịch hẹn.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Trạng thái thanh toán</h2>
                  <p>Theo bảng Payments.</p>
                </div>
              </div>

              <div className="admin-status-list">
                {(data.paymentStatus || []).map((item) => (
                  <div className="admin-status-row" key={item.status}>
                    <span className={statusClass(item.status)}>
                      {item.status}
                    </span>
                    <strong>{item.count}</strong>
                  </div>
                ))}

                {!data.paymentStatus?.length ? (
                  <p className="admin-empty">Chưa có payment.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel admin-panel-large">
              <div className="admin-panel-head">
                <div>
                  <h2>Dịch vụ bán chạy</h2>
                  <p>Top dịch vụ theo số lịch hẹn và doanh thu.</p>
                </div>
              </div>

              <div className="admin-service-rank">
                {(data.topServices || []).map((item, index) => {
                  const width = Math.max(
                    8,
                    (item.appointmentCount / maxServiceCount) * 100,
                  );

                  return (
                    <div className="admin-rank-item" key={item.serviceId}>
                      <div className="admin-rank-index">{index + 1}</div>
                      <div className="admin-rank-main">
                        <div className="admin-rank-title">
                          <strong>{item.serviceName}</strong>
                          <span>{item.categoryName || "Chưa có danh mục"}</span>
                        </div>
                        <div className="admin-rank-bar">
                          <div style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <div className="admin-rank-meta">
                        <strong>{item.appointmentCount}</strong>
                        <span>{formatMoney(item.revenue)}</span>
                      </div>
                    </div>
                  );
                })}

                {!data.topServices?.length ? (
                  <p className="admin-empty">Chưa có dữ liệu dịch vụ.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Top kỹ thuật viên</h2>
                  <p>Hiệu suất theo lịch hẹn, doanh thu và rating.</p>
                </div>
              </div>

              <div className="admin-tech-list">
                {(data.topTechnicians || []).map((item) => (
                  <div className="admin-tech-card" key={item.employeeId}>
                    <img src={safeAvatar(item.avatarUrl)} alt={item.fullName} />
                    <div>
                      <strong>{item.fullName}</strong>
                      <span>
                        {item.specialization || item.position || "Technician"}
                      </span>
                      <small>
                        {item.appointmentCount} lịch •{" "}
                        {item.avgRating
                          ? `${item.avgRating.toFixed(1)}★`
                          : "Chưa có rating"}{" "}
                        • {formatMoney(item.revenue)}
                      </small>
                    </div>
                  </div>
                ))}

                {!data.topTechnicians?.length ? (
                  <p className="admin-empty">Chưa có kỹ thuật viên.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel admin-panel-large">
              <div className="admin-panel-head">
                <div>
                  <h2>Lịch hẹn mới nhất</h2>
                  <p>Theo thời gian mới nhất đến cũ hơn.</p>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-mini-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Khách hàng</th>
                      <th>Kỹ thuật viên</th>
                      <th>Ngày giờ</th>
                      <th>Trạng thái</th>
                      <th>Payment</th>
                      <th>Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.latestAppointments || []).map((item) => (
                      <tr key={item.appointmentId}>
                        <td>#{item.appointmentId}</td>
                        <td>{item.customerName || "N/A"}</td>
                        <td>{item.employeeName || "Chưa phân công"}</td>
                        <td>
                          {formatDate(item.appointmentDate)}{" "}
                          {timeText(item.startTime)}
                        </td>
                        <td>
                          <span className={statusClass(item.status)}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <span className={statusClass(item.paymentStatus)}>
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td>{formatMoney(item.finalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!data.latestAppointments?.length ? (
                  <p className="admin-empty">Chưa có lịch hẹn.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Review mới nhất</h2>
                  <p>Đánh giá từ khách hàng.</p>
                </div>
              </div>

              <div className="admin-review-list">
                {(data.latestReviews || []).map((item) => (
                  <div className="admin-review-card" key={item.reviewId}>
                    <div className="admin-review-top">
                      <strong>{item.customerName}</strong>
                      <span>{item.rating}/5 ★</span>
                    </div>
                    <p>{item.comment || "Không có nội dung đánh giá."}</p>
                    <small>
                      {item.serviceName} • {item.employeeName || "N/A"} •{" "}
                      {formatDateTime(item.createdAt)}
                    </small>
                  </div>
                ))}

                {!data.latestReviews?.length ? (
                  <p className="admin-empty">Chưa có review.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Feedback mới nhất</h2>
                  <p>Phản hồi cần admin theo dõi.</p>
                </div>
              </div>

              <div className="admin-feedback-list">
                {(data.recentFeedbacks || []).map((item) => (
                  <div className="admin-feedback-card" key={item.feedbackId}>
                    <div>
                      <strong>{item.subject}</strong>
                      <span className={statusClass(item.status)}>
                        {item.status}
                      </span>
                    </div>
                    <p>{item.content}</p>
                    <small>
                      {item.customerName || "Khách hàng"} •{" "}
                      {formatDateTime(item.createdAt)}
                    </small>
                  </div>
                ))}

                {!data.recentFeedbacks?.length ? (
                  <p className="admin-empty">Chưa có feedback.</p>
                ) : null}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
