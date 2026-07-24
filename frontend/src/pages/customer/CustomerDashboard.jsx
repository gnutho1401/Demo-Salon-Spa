import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const STATUS_LABELS = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  NO_SHOW: "Không đến",
  UNPAID: "Chưa thanh toán",
  PAID_INVOICE: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thất bại",
  PENDING_FEEDBACK: "Đang chờ",
  PROCESSING: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  REJECTED: "Từ chối",
};

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? null;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.slice(0, 5);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Chưa rõ";
}

function statusClass(status) {
  const normalized = String(status || "unknown")
    .toLowerCase()
    .replace(/_/g, "-");
  return `customer-dash-status ${normalized}`;
}

function calcPercent(current, target) {
  const c = Number(current || 0);
  const t = Number(target || 0);
  if (!t || t <= c) return 100;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

function EmptyState({ title, desc, actionText, to }) {
  return (
    <div className="customer-dash-empty">
      <div className="customer-dash-empty-icon">✦</div>
      <h4>{title}</h4>
      <p>{desc}</p>
      {to ? <Link to={to}>{actionText}</Link> : null}
    </div>
  );
}

export default function CustomerDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    Promise.allSettled([
      axiosClient.get("/customers/me/dashboard"),
      axiosClient.get("/ai/my/recommendations"),
    ])
      .then(([dashRes, aiRes]) => {
        if (!mounted) return;

        if (dashRes.status === "fulfilled") {
          setDashboard(unwrap(dashRes.value) || {});
        } else {
          setError(
            dashRes.reason?.response?.data?.message ||
              "Không tải được dashboard khách hàng",
          );
        }

        if (aiRes.status === "fulfilled") {
          const aiData = unwrap(aiRes.value);
          setRecommendations(
            Array.isArray(aiData) ? aiData : aiData?.items || [],
          );
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const profile = dashboard?.Profile || dashboard || {};
  const summary = dashboard?.Summary || dashboard || {};
  const upcoming = useMemo(
    () => dashboard?.UpcomingAppointments || [],
    [dashboard],
  );
  const unpaid = useMemo(() => dashboard?.UnpaidInvoices || [], [dashboard]);
  const payments = useMemo(
    () => dashboard?.RecentPayments || dashboard?.Payments || [],
    [dashboard],
  );
  const packages = useMemo(
    () => dashboard?.ActivePackages || dashboard?.Packages || [],
    [dashboard],
  );
  const vouchers = useMemo(
    () => dashboard?.AvailableVouchers || [],
    [dashboard],
  );
  const histories = useMemo(() => dashboard?.ServiceHistory || [], [dashboard]);
  const favorites = useMemo(
    () => dashboard?.FavoriteServices || [],
    [dashboard],
  );
  const favoriteEmployees = useMemo(
    () => dashboard?.FavoriteEmployees || [],
    [dashboard],
  );
  const reviewable = useMemo(
    () => dashboard?.ReviewableServices || [],
    [dashboard],
  );
  const notifications = useMemo(
    () => dashboard?.Notifications || [],
    [dashboard],
  );
  const feedbacks = useMemo(() => dashboard?.Feedbacks || [], [dashboard]);

  const loyaltyPercent = calcPercent(
    profile.LoyaltyPoints,
    profile.NextLevelMinPoints,
  );

  if (loading) {
    return (
      <CustomerLayout>
        <div className="customer-dash-page">
          <div className="customer-dash-loading">
            <span />
            <h3>Đang tải dashboard khách hàng...</h3>
            <p>
              Hệ thống đang lấy lịch hẹn, thanh toán, điểm thưởng, voucher và
              thông báo của bạn.
            </p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="customer-dash-page">
        {error ? (
          <div className="customer-dash-alert">
            <strong>Không tải đủ dữ liệu:</strong> {error}
          </div>
        ) : null}

        <section className="customer-dash-hero">
          <div className="customer-dash-hero-main">
            <div className="customer-dash-eyebrow">
              Beauty Salon Customer Center
            </div>
            <h1>Xin chào, {profile.FullName || "khách hàng"}</h1>
            <p>
              Theo dõi nhanh lịch hẹn, thanh toán, voucher, combo liệu trình,
              điểm thưởng, đánh giá và phản hồi trong một màn hình.
            </p>
            <div className="customer-dash-actions">
              <Link className="primary" to="/customer/booking">
                Đặt lịch mới
              </Link>
              <Link to="/customer/appointments">Lịch hẹn của tôi</Link>
              <Link to="/customer/vouchers">Voucher</Link>
              <Link to="/customer/feedback">Gửi phản hồi</Link>
            </div>
          </div>

          <div
            className="customer-dash-member-container"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              alignItems: "center",
              width: "100%",
              maxWidth: "380px",
            }}
          >
            <div
              className={`premium-member-card ${String(profile.MembershipLevel || "normal").toLowerCase()}`}
              style={{ width: "100%", height: "230px" }}
            >
              <div className="card-glass-shine" />
              <div className="card-chip" />
              <div className="card-header">
                <span className="card-brand">🌟 PREMIUM MEMBER</span>
                <span className="card-vip-badge">
                  {profile.MembershipLevel || "MEMBER"}
                </span>
              </div>

              <div
                className="card-body"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  margin: "-10px 0",
                }}
              >
                <div
                  className="customer-dash-avatar"
                  style={{
                    margin: 0,
                    position: "relative",
                    zIndex: 3,
                    width: "75px",
                    height: "75px",
                    minWidth: "75px",
                    border: "3px solid rgba(255,255,255,0.7)",
                    borderRadius: "50%",
                    overflow: "hidden",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                  }}
                >
                  {profile.AvatarUrl ? (
                    <img
                      src={resolveFileUrl(profile.AvatarUrl)}
                      alt={profile.FullName || "Avatar"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: "100%",
                        height: "100%",
                        background: "#fff",
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#1e293b",
                      }}
                    >
                      {String(profile.FullName || "K")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="card-footer">
                <div className="card-holder">
                  <span>Chủ thẻ</span>
                  <strong>{profile.FullName || "QUÝ KHÁCH"}</strong>
                </div>
                <div className="card-discount">
                  <span>Điểm tích lũy</span>
                  <strong>{profile.LoyaltyPoints || 0} PTS</strong>
                </div>
              </div>
            </div>

            {/* Loyalty thăng hạng progress bar đặt gọn gàng phía dưới thẻ */}
            <div
              className="customer-dash-progress"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.65)",
                backdropFilter: "blur(10px)",
                padding: "12px 18px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  background: "#e2e8f0",
                  borderRadius: "999px",
                  height: "8px",
                  overflow: "hidden",
                  marginBottom: "8px",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "block",
                    background: "linear-gradient(90deg, #10b981, #059669)",
                    width: `${loyaltyPercent}%`,
                    height: "100%",
                    borderRadius: "999px",
                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "#475569",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {Number(profile.LoyaltyPoints || 0).toLocaleString("vi-VN")}{" "}
                điểm · còn{" "}
                {Number(profile.PointsToNextLevel || 0).toLocaleString("vi-VN")}{" "}
                điểm để lên {profile.NextMembershipLevel || "hạng cao hơn"}
              </p>
            </div>
          </div>
        </section>

        <section className="customer-dash-kpis">
          <article>
            <span>📅</span>
            <p>Lịch hoạt động</p>
            <strong>{summary.ActiveAppointments || 0}</strong>
            <small>Chờ thanh toán / xác nhận / đang làm</small>
          </article>
          <article>
            <span>💳</span>
            <p>Cần thanh toán</p>
            <strong>{formatMoney(summary.UnpaidAmount)}</strong>
            <small>{summary.UnpaidInvoices || 0} hóa đơn chưa trả</small>
          </article>
          <article>
            <span>💎</span>
            <p>Điểm thưởng</p>
            <strong>
              {Number(profile.LoyaltyPoints || 0).toLocaleString("vi-VN")}
            </strong>
            <small>Hạng {profile.MembershipLevel || "Normal"}</small>
          </article>
          <article>
            <span>🎁</span>
            <p>Voucher khả dụng</p>
            <strong>{summary.AvailableVouchers || 0}</strong>
            <small>Có thể dùng khi thanh toán</small>
          </article>
          <article>
            <span>🌸</span>
            <p>Combo hiệu lực</p>
            <strong>{summary.ActivePackages || 0}</strong>
            <small>Còn {summary.RemainingPackageSessions || 0} buổi</small>
          </article>
          <article>
            <span>🔔</span>
            <p>Thông báo mới</p>
            <strong>{summary.UnreadNotifications || 0}</strong>
            <small>Chưa đọc</small>
          </article>
        </section>

        <section className="customer-dash-quick-grid">
          <Link to="/customer/booking">
            <b>Đặt lịch nhanh</b>
            <span>Chọn dịch vụ, kỹ thuật viên, khung giờ</span>
          </Link>
          <Link to="/customer/payments">
            <b>Lịch sử thanh toán</b>
            <span>Xem VNPay, trạng thái, mã giao dịch</span>
          </Link>
          <Link to="/customer/service-history">
            <b>Lịch sử dịch vụ</b>
            <span>Theo dõi dịch vụ đã làm và chi phí</span>
          </Link>
          <Link to="/customer/reviews">
            <b>Đánh giá dịch vụ</b>
            <span>Đánh giá các dịch vụ đã hoàn thành</span>
          </Link>
          <Link to="/customer/packages">
            <b>Liệu trình / combo</b>
            <span>Quản lý số buổi còn lại</span>
          </Link>
          <Link to="/customer/favorites">
            <b>Yêu thích</b>
            <span>Dịch vụ và kỹ thuật viên yêu thích</span>
          </Link>
        </section>

        <section className="customer-dash-layout">
          <div className="customer-dash-main-col">
            <div className="customer-dash-panel xl">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Lịch hẹn</span>
                  <h2>Lịch hẹn sắp tới</h2>
                </div>
                <Link to="/customer/appointments">Xem tất cả</Link>
              </div>
              {upcoming.length ? (
                <div className="customer-dash-appointment-list">
                  {upcoming.map((item) => (
                    <article key={item.AppointmentId}>
                      <div className="customer-dash-date-box">
                        <strong>{formatDate(item.AppointmentDate)}</strong>
                        <span>
                          {formatTime(item.StartTime)} -{" "}
                          {formatTime(item.EndTime)}
                        </span>
                      </div>
                      <div className="customer-dash-appointment-info">
                        <h3>{item.ServiceNames || "Dịch vụ làm đẹp"}</h3>
                        <p>
                          Kỹ thuật viên:{" "}
                          <b>{item.EmployeeName || "Chưa phân công"}</b>
                        </p>
                        <p>Chi nhánh: {item.BranchName || "Chưa có"}</p>
                        <div className="customer-dash-meta">
                          <span>{item.TotalDurationMinutes || 0} phút</span>
                          <span>{formatMoney(item.FinalAmount)}</span>
                          <span className={statusClass(item.Status)}>
                            {statusLabel(item.Status)}
                          </span>
                        </div>
                      </div>
                      <div className="customer-dash-card-actions">
                        {item.InvoiceStatus === "UNPAID" ||
                        item.Status === "PENDING_PAYMENT" ? (
                          <Link
                            className="pay"
                            to={`/customer/payment/${item.AppointmentId}`}
                          >
                            Thanh toán
                          </Link>
                        ) : null}
                        <Link
                          to={`/customer/appointments/${item.AppointmentId}`}
                        >
                          Chi tiết
                        </Link>
                        {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
                          item.Status,
                        ) ? (
                          <Link
                            to={`/customer/reschedule/${item.AppointmentId}`}
                          >
                            Đổi lịch
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có lịch hẹn sắp tới"
                  desc="Đặt lịch mới để dashboard hiển thị timeline chăm sóc của bạn."
                  actionText="Đặt lịch ngay"
                  to="/customer/booking"
                />
              )}
            </div>

            <div className="customer-dash-two-cols">
              <div className="customer-dash-panel">
                <div className="customer-dash-panel-head">
                  <div>
                    <span>Thanh toán</span>
                    <h2>Hóa đơn cần xử lý</h2>
                  </div>
                  <Link to="/customer/payments">Lịch sử</Link>
                </div>
                {unpaid.length ? (
                  unpaid.map((item) => (
                    <div className="customer-dash-bill" key={item.InvoiceId}>
                      <div>
                        <b>{item.ServiceNames || "Hóa đơn dịch vụ"}</b>
                        <span>
                          {formatDate(item.AppointmentDate)} ·{" "}
                          {formatTime(item.StartTime)}
                        </span>
                      </div>
                      <strong>{formatMoney(item.FinalAmount)}</strong>
                      <Link to={`/customer/payment/${item.AppointmentId}`}>
                        Thanh toán
                      </Link>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Không có hóa đơn chưa thanh toán"
                    desc="Các hóa đơn cần xử lý sẽ hiển thị tại đây."
                  />
                )}
              </div>

              <div className="customer-dash-panel">
                <div className="customer-dash-panel-head">
                  <div>
                    <span>Combo</span>
                    <h2>Liệu trình đang dùng</h2>
                  </div>
                  <Link to="/customer/packages">Xem combo</Link>
                </div>
                {packages.length ? (
                  packages.map((item) => (
                    <div
                      className="customer-dash-package"
                      key={item.CustomerPackageId}
                    >
                      <div>
                        <b>{item.PackageName}</b>
                        <span>Hết hạn: {formatDate(item.EndDate)}</span>
                      </div>
                      <div className="customer-dash-progress small">
                        <div>
                          <span
                            style={{
                              width: `${Math.min(100, Number(item.UsedPercent || 0))}%`,
                            }}
                          />
                        </div>
                        <p>
                          Đã dùng {item.UsedSessions || 0}/
                          {item.TotalSessions || 0} · còn{" "}
                          {item.RemainingSessions || 0} buổi
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Chưa có combo hiệu lực"
                    desc="Mua combo/liệu trình để tiết kiệm chi phí và theo dõi số buổi còn lại."
                    actionText="Xem combo"
                    to="/customer/packages"
                  />
                )}
              </div>
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Lịch sử</span>
                  <h2>Dịch vụ gần đây</h2>
                </div>
                <Link to="/customer/service-history">Xem tất cả</Link>
              </div>
              {histories.length ? (
                <div className="customer-dash-history-table">
                  {histories.map((item) => (
                    <Link
                      to={`/customer/appointments/${item.AppointmentId}`}
                      key={item.AppointmentId}
                    >
                      <span>{formatDate(item.AppointmentDate)}</span>
                      <b>{item.ServiceNames || "Dịch vụ"}</b>
                      <em>{item.EmployeeName || "Kỹ thuật viên"}</em>
                      <strong>{formatMoney(item.FinalAmount)}</strong>
                      <i className={statusClass(item.Status)}>
                        {statusLabel(item.Status)}
                      </i>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có lịch sử dịch vụ"
                  desc="Dịch vụ hoàn thành, đã hủy hoặc chờ hoàn tiền sẽ nằm ở đây."
                />
              )}
            </div>
          </div>

          <aside className="customer-dash-side-col">
            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>AI</span>
                  <h2>Gợi ý dịch vụ</h2>
                </div>
                <Link to="/customer/ai">Mở AI</Link>
              </div>
              {recommendations.length ? (
                recommendations.slice(0, 4).map((item, index) => (
                  <Link
                    className="customer-dash-service-mini"
                    to={
                      item.ServiceId
                        ? `/services/${item.ServiceId}`
                        : "/customer/ai"
                    }
                    key={item.RecommendationId || item.ServiceId || index}
                  >
                    <b>{item.ServiceName || "Gợi ý dịch vụ"}</b>
                    <span>
                      {item.Reason ||
                        item.Description ||
                        "Phù hợp với lịch sử chăm sóc của bạn."}
                    </span>
                    {item.Price ? (
                      <strong>{formatMoney(item.Price)}</strong>
                    ) : null}
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Chưa có gợi ý AI"
                  desc="Sau khi sử dụng thêm dịch vụ, AI sẽ đề xuất chính xác hơn."
                  actionText="Chat với AI"
                  to="/customer/ai"
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Voucher</span>
                  <h2>Ưu đãi của bạn</h2>
                </div>
                <Link to="/customer/vouchers">Tất cả</Link>
              </div>
              {vouchers.length ? (
                vouchers.map((item) => (
                  <div className="customer-dash-voucher" key={item.VoucherId}>
                    <strong>{item.Code}</strong>
                    <span>
                      {item.DiscountType === "PERCENT"
                        ? `Giảm ${item.DiscountValue}%`
                        : `Giảm ${formatMoney(item.DiscountValue)}`}{" "}
                      · đơn tối thiểu {formatMoney(item.MinOrderAmount)}
                    </span>
                    <small>HSD: {formatDate(item.EndDate)}</small>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Chưa có voucher khả dụng"
                  desc="Voucher được nhận từ khuyến mãi, điểm thưởng hoặc chăm sóc khách hàng."
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Review</span>
                  <h2>Cần đánh giá</h2>
                </div>
                <Link to="/customer/reviews">Đánh giá</Link>
              </div>
              {reviewable.length ? (
                reviewable.map((item) => (
                  <div
                    className="customer-dash-reviewable"
                    key={`${item.AppointmentId}-${item.ServiceId}`}
                  >
                    <div>
                      <b>{item.ServiceName}</b>
                      <span>
                        {formatDate(item.AppointmentDate)} ·{" "}
                        {item.EmployeeName || "Kỹ thuật viên"}
                      </span>
                    </div>
                    <Link to="/customer/reviews">Đánh giá</Link>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Không có dịch vụ chờ đánh giá"
                  desc="Sau khi lịch hẹn hoàn thành, dịch vụ chưa đánh giá sẽ hiện ở đây."
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Yêu thích</span>
                  <h2>Dịch vụ & kỹ thuật viên</h2>
                </div>
                <Link to="/customer/favorites">Xem</Link>
              </div>
              {favorites.length || favoriteEmployees.length ? (
                <div className="customer-dash-favorites">
                  {favorites.slice(0, 3).map((item) => (
                    <Link
                      to={`/services/${item.ServiceId}`}
                      key={`s-${item.ServiceId}`}
                    >
                      <b>{item.ServiceName}</b>
                      <span>
                        {formatMoney(item.Price)} · {item.DurationMinutes} phút
                      </span>
                    </Link>
                  ))}
                  {favoriteEmployees.slice(0, 3).map((item) => (
                    <Link
                      to={`/technicians/${item.EmployeeId}`}
                      key={`e-${item.EmployeeId}`}
                    >
                      <b>{item.EmployeeName}</b>
                      <span>
                        {item.Specialization ||
                          item.Position ||
                          "Kỹ thuật viên"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có mục yêu thích"
                  desc="Lưu dịch vụ hoặc kỹ thuật viên để đặt lịch nhanh hơn."
                  actionText="Khám phá dịch vụ"
                  to="/services"
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Thông báo</span>
                  <h2>Mới nhất</h2>
                </div>
                <Link to="/customer/notifications">Tất cả</Link>
              </div>
              {notifications.length ? (
                notifications.map((item) => (
                  <Link
                    className={`customer-dash-noti ${item.IsRead ? "read" : "unread"}`}
                    to="/customer/notifications"
                    key={item.NotificationId}
                  >
                    <b>{item.Title}</b>
                    <span>
                      {item.Content || item.Type || "Thông báo hệ thống"}
                    </span>
                    <small>{formatDateTime(item.CreatedAt)}</small>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Chưa có thông báo"
                  desc="Thông báo đặt lịch, thanh toán, đổi lịch sẽ hiển thị tại đây."
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Feedback</span>
                  <h2>Phản hồi gần đây</h2>
                </div>
                <Link to="/customer/feedback">Gửi phản hồi</Link>
              </div>
              {feedbacks.length ? (
                feedbacks.map((item) => (
                  <div className="customer-dash-feedback" key={item.FeedbackId}>
                    <div>
                      <b>{item.Subject}</b>
                      <span>{formatDateTime(item.CreatedAt)}</span>
                    </div>
                    <i className={statusClass(item.Status)}>
                      {statusLabel(item.Status)}
                    </i>
                    {item.AdminResponse ? (
                      <p>Admin: {item.AdminResponse}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Chưa có phản hồi"
                  desc="Gửi góp ý hoặc yêu cầu hỗ trợ để salon xử lý."
                  actionText="Gửi phản hồi"
                  to="/customer/feedback"
                />
              )}
            </div>

            <div className="customer-dash-panel">
              <div className="customer-dash-panel-head">
                <div>
                  <span>Thanh toán</span>
                  <h2>Giao dịch gần đây</h2>
                </div>
                <Link to="/customer/payments">Lịch sử</Link>
              </div>
              {payments.length ? (
                payments.map((item) => (
                  <Link
                    className="customer-dash-payment"
                    to="/customer/payments"
                    key={item.PaymentId}
                  >
                    <div>
                      <b>{formatMoney(item.Amount)}</b>
                      <span>
                        {item.ServiceNames || `Hóa đơn #${item.InvoiceId}`}
                      </span>
                    </div>
                    <i className={statusClass(item.Status)}>
                      {statusLabel(item.Status)}
                    </i>
                    <small>
                      {item.PaymentMethod || "VNPAY"} ·{" "}
                      {formatDateTime(item.PaidAt || item.CreatedAt)}
                    </small>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Chưa có giao dịch"
                  desc="Các giao dịch VNPay/thanh toán tại quầy sẽ hiển thị ở đây."
                />
              )}
            </div>
          </aside>
        </section>
      </div>
    </CustomerLayout>
  );
}
