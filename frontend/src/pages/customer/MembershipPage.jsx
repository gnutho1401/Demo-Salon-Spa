import { useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function dateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MembershipPage() {
  const [mine, setMine] = useState(null);
  const [levels, setLevels] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      axiosClient.get("/membership/my"),
      axiosClient.get("/membership"),
      axiosClient.get("/membership/my/history"),
    ])
      .then(([myRes, levelsRes, historyRes]) => {
        setMine(myRes.data?.data || myRes.data);
        setLevels(levelsRes.data?.data || levelsRes.data || []);
        setHistory(historyRes.data?.data || historyRes.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Không tải được điểm thưởng.");
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    return {
      earned: history
        .filter((x) => x.Type === "EARN")
        .reduce((sum, x) => sum + Number(x.Points || 0), 0),

      used: Math.abs(
        history
          .filter((x) => x.Type === "USE")
          .reduce((sum, x) => sum + Number(x.Points || 0), 0),
      ),

      earnCount: history.filter((x) => x.Type === "EARN").length,
      useCount: history.filter((x) => x.Type === "USE").length,
    };
  }, [history]);

  const needToNextLevel = mine?.NextLevelMinPoints
    ? Math.max(
        Number(mine.NextLevelMinPoints) - Number(mine.LoyaltyPoints || 0),
        0,
      )
    : 0;

  const progressPercent = mine?.NextLevelMinPoints
    ? Math.min(
        (Number(mine.LoyaltyPoints || 0) / Number(mine.NextLevelMinPoints)) *
          100,
        100,
      )
    : 100;

  return (
    <CustomerLayout>
      <div className="reward-page">
        <section className="reward-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 30 }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <span style={{ color: '#b45309', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1.5 }}>LOYALTY REWARDS</span>
            <h1 style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: '2.5rem', color: '#111827', margin: '10px 0' }}>Hạng Thành Viên & Điểm Tích Lũy</h1>
            <p style={{ color: '#4b5563', lineHeight: 1.6, fontSize: '1rem', margin: '0 0 20px 0' }}>
              Trải nghiệm dịch vụ chăm sóc sắc đẹp cao cấp và nhận các chương trình ưu đãi đặc quyền tương ứng với phân hạng của bạn.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => window.location.href = '/customer/booking'} style={{ background: '#1e3d2f', color: '#fff', border: 0, padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
                📅 Đặt lịch ngay
              </button>
              <button onClick={() => window.location.href = '/customer/vouchers'} style={{ background: 'none', border: '1px solid #1e3d2f', color: '#1e3d2f', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                🎁 Xem voucher
              </button>
            </div>
          </div>

          <div className={`premium-member-card ${String(mine?.LevelName || "normal").toLowerCase()}`}>
            <div className="card-glass-shine" />
            <div className="card-chip" />
            <div className="card-header">
              <span className="card-brand">🌟 PREMIUM MEMBER</span>
              <span className="card-vip-badge">{mine?.LevelName || "MEMBER"}</span>
            </div>
            <div className="card-body">
              <div className="card-points">
                <span>Điểm khả dụng</span>
                <strong>{mine?.LoyaltyPoints || 0}</strong>
              </div>
            </div>
            <div className="card-footer">
              <div className="card-holder">
                <span>Chủ thẻ</span>
                <strong>{mine?.FullName || "QUÝ KHÁCH"}</strong>
              </div>
              <div className="card-discount">
                <span>Ưu đãi hạng</span>
                <strong>-{mine?.DiscountPercent || 0}%</strong>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="reward-alert error">{error}</div>}

        <section className="reward-stats">
          <div className="reward-stats-card">
            <div className="stats-icon-wrapper" style={{ background: '#eff6ff', color: '#3b82f6' }}>⭐</div>
            <div className="stats-info">
              <span>Hạng hiện tại</span>
              <b>{mine?.LevelName || "Normal"}</b>
            </div>
          </div>

          <div className="reward-stats-card">
            <div className="stats-icon-wrapper" style={{ background: '#ecfdf5', color: '#10b981' }}>📈</div>
            <div className="stats-info">
              <span>Đã tích lũy</span>
              <b>{summary.earned}</b>
            </div>
          </div>

          <div className="reward-stats-card">
            <div className="stats-icon-wrapper" style={{ background: '#fef2f2', color: '#ef4444' }}>📉</div>
            <div className="stats-info">
              <span>Đã sử dụng</span>
              <b>{summary.used}</b>
            </div>
          </div>

          <div className="reward-stats-card">
            <div className="stats-icon-wrapper" style={{ background: '#fffbeb', color: '#f59e0b' }}>🏷️</div>
            <div className="stats-info">
              <span>Ưu đãi giảm giá</span>
              <b>{mine?.DiscountPercent || 0}%</b>
            </div>
          </div>
        </section>

        <section className="premium-progress-container">
          <h2 style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: '1.5rem', color: '#1e293b', margin: '0 0 8px' }}>Tiến độ nâng hạng tiếp theo</h2>

          {loading ? (
            <p style={{ color: '#64748b' }}>Đang tải dữ liệu tiến trình...</p>
          ) : mine?.NextLevelName ? (
            <>
              <div className="premium-progress-bar">
                <div className="premium-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>

              <p style={{ fontSize: '0.95rem', color: '#475569', margin: 0 }}>
                Bạn cần tích lũy thêm <strong style={{ color: '#b45309', fontSize: '1.05rem' }}>{needToNextLevel}</strong> điểm để nâng cấp đặc quyền hạng <strong style={{ color: '#1e3d2f', fontSize: '1.05rem' }}>{mine.NextLevelName}</strong>.
              </p>
            </>
          ) : (
            <p style={{ fontSize: '0.95rem', color: '#15803d', fontWeight: 600, margin: 0 }}>
              🎉 Chúc mừng! Bạn đang sở hữu thứ hạng đặc quyền cao nhất trong hệ thống thành viên của Salon.
            </p>
          )}
        </section>

        <section>
          <h2 style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: '1.5rem', color: '#1e293b', marginBottom: 16 }}>Đặc quyền các phân hạng</h2>
          <div className="reward-levels-grid">
            {levels.map((level) => {
              const isActive = Number(level.MembershipLevelId) === Number(mine?.MembershipLevelId);
              const tierName = String(level.LevelName).toLowerCase();
              const isTopTier = tierName === "diamond" || tierName === "vip";
              return (
                <article
                  className={`reward-level-card ${isActive ? "active-tier" : ""} ${isTopTier ? "tier-diamond" : ""} tier-${tierName}`}
                  key={level.MembershipLevelId}
                >
                  {isActive && <span className="tier-badge">Hạng của bạn</span>}
                  <h3>{level.LevelName}</h3>
                  <span className="tier-points">Yêu cầu: Từ {level.MinPoints} điểm</span>
                  <div className="tier-perk">Giảm giá {level.DiscountPercent}%</div>
                  <p className="tier-desc">{level.Description || "Mở khóa nhiều ưu đãi dịch vụ hấp dẫn."}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="history-section-card">
          <h2 style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: '1.5rem', color: '#1e293b', marginBottom: 18 }}>Lịch sử điểm thưởng</h2>

          {loading ? (
            <div className="reward-empty">Đang tải lịch sử điểm...</div>
          ) : history.length === 0 ? (
            <div className="reward-empty">Chưa có bất kỳ giao dịch tích/tiêu điểm thưởng nào.</div>
          ) : (
            <div className="premium-history-list">
              {history.map((item) => {
                const isEarn = item.Type === "EARN";
                return (
                  <article key={item.TransactionId} className="history-item">
                    <div className="history-item-left">
                      <div className={`history-badge-container ${isEarn ? "earn" : "use"}`}>
                        {isEarn ? "↑" : "↓"}
                      </div>
                      <div className="history-item-details">
                        <p>{item.Note || (isEarn ? "Tích lũy điểm khi thanh toán dịch vụ" : "Dùng điểm giảm trừ hóa đơn")}</p>
                        <small>
                          Mã lịch hẹn: #{item.AppointmentId || "N/A"} • Giao dịch: #{item.PaymentId || "N/A"} • {dateTime(item.CreatedAt)}
                        </small>
                      </div>
                    </div>

                    <div className="history-item-right">
                      <span className={`history-item-points ${isEarn ? "earn" : "use"}`}>
                        {isEarn ? "+" : "-"}
                        {Math.abs(item.Points)} điểm
                      </span>
                      <span className="history-item-amount">Hóa đơn: {money(item.Amount)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </CustomerLayout>
  );
}
