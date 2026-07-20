import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

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

function StatCard({ label, value, note, icon }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-icon" style={{ background: "rgba(160, 87, 58, 0.1)", color: "#a0573a" }}>
        {icon}
      </div>
      <div>
        <p style={{ color: "#7c6f68", fontSize: "0.85rem", margin: "0 0 4px 0" }}>{label}</p>
        <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#3d2e26", margin: 0 }}>{value}</h3>
        {note ? <span style={{ fontSize: "0.75rem", color: "#a08e84" }}>{note}</span> : null}
      </div>
    </article>
  );
}

export default function PackageReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosClient.get("/packages/report", {
        params: {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        },
      });
      setData(res.data.data || res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Không tải được báo cáo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const summary = data?.summary || {};
  const topPackages = data?.topPackages || [];
  const monthlyTrend = data?.monthlyTrend || [];

  return (
    <section className="admin-page admin-package-report-page">
      <div className="admin-dashboard-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="admin-eyebrow">Enterprise Packages</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#3d2e26", margin: "4px 0 8px 0" }}>
            Báo cáo Liệu trình & Combo 📊
          </h1>
          <p style={{ color: "#7c6f68", margin: 0 }}>
            Phân tích chuyên sâu doanh thu, tần suất sử dụng, tỷ lệ hoàn thành và người thân dùng chung combo.
          </p>
        </div>

        <div className="package-report-filters" style={{ display: "flex", gap: 8, alignItems: "center", background: "#fff", padding: 12, borderRadius: 14, border: "1px solid #f4e7dd" }}>
          <div>
            <label style={{ fontSize: 11, color: "#7c6f68", display: "block", marginBottom: 2 }}>Từ ngày</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              style={{ border: "1px solid #d4c4b8", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: "#3d2e26" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#7c6f68", display: "block", marginBottom: 2 }}>Đến ngày</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              style={{ border: "1px solid #d4c4b8", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: "#3d2e26" }}
            />
          </div>
          <button
            onClick={loadReport}
            className="btn"
            style={{
              background: "#a0573a",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              alignSelf: "flex-end",
              fontSize: 13,
              marginTop: 14,
            }}
          >
            Lọc
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", color: "#ef4444", borderRadius: 12, border: "1px solid #fecaca", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#7c6f68", background: "#fff", borderRadius: 14, border: "1px solid #f4e7dd" }}>
          Đang tải báo cáo...
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="admin-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard icon="₫" label="Doanh thu Combo" value={formatMoney(summary.TotalRevenue)} note="Tổng thu từ giao dịch combo" />
            <StatCard icon="📦" label="Combo đã bán" value={summary.TotalPackagesSold || 0} note="Số lượng combo khách hàng đã mua" />
            <StatCard icon="⚡" label="Đang hoạt động" value={summary.ActivePackages || 0} note="Các gói combo đang hoạt động" />
            <StatCard icon="⏰" label="Sắp hết hạn" value={summary.ExpiringSoonPackages || 0} note="Gói ACTIVE sẽ hết hạn trong 7 ngày tới" />
          </div>

          <div className="package-report-panels" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20, marginBottom: 24 }}>
            {/* Completion Rates */}
            <div className="card" style={{ background: "#fff", borderRadius: 14, border: "1px solid #f4e7dd", padding: 20 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3d2e26", marginBottom: 16 }}>Tiến độ & Tần suất sử dụng</h3>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "#7c6f68" }}>Tỷ lệ hoàn thành liệu trình</span>
                  <b style={{ color: "#a0573a" }}>{summary.CompletionRate || 0}%</b>
                </div>
                <div style={{ height: 8, background: "#f5e6dc", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${summary.CompletionRate || 0}%`, height: "100%", background: "#a0573a", borderRadius: 4 }} />
                </div>
                <small style={{ color: "#a08e84", fontSize: 11, display: "block", marginTop: 4 }}>
                  Tỷ lệ gói chuyển sang COMPLETED/USED_UP trên tổng số gói đã bán
                </small>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "#7c6f68" }}>Tỷ lệ sử dụng buổi</span>
                  <b style={{ color: "#22c55e" }}>{summary.UsageRate || 0}%</b>
                </div>
                <div style={{ height: 8, background: "#e0f2fe", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${summary.UsageRate || 0}%`, height: "100%", background: "#22c55e", borderRadius: 4 }} />
                </div>
                <small style={{ color: "#a08e84", fontSize: 11, display: "block", marginTop: 4 }}>
                  Phần trăm tổng số buổi đã sử dụng trên tổng số buổi đã bán ra
                </small>
              </div>
            </div>

            {/* Trạng thái chi tiết */}
            <div className="card" style={{ background: "#fff", borderRadius: 14, border: "1px solid #f4e7dd", padding: 20 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3d2e26", marginBottom: 16 }}>Phân bố trạng thái liệu trình</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {[
                  { label: "Đang hoạt động", value: summary.ActivePackages, color: "#22c55e", bg: "#f0fdf4" },
                  { label: "Đã hoàn thành", value: summary.CompletedPackages, color: "#8b5cf6", bg: "#f5f3ff" },
                  { label: "Đã hết hạn", value: summary.ExpiredPackages, color: "#ef4444", bg: "#fef2f2" },
                ].map((item, idx) => (
                  <div key={idx} style={{ background: item.bg, padding: 12, borderRadius: 10, border: `1px solid ${item.color}20` }}>
                    <span style={{ fontSize: 12, color: "#7c6f68" }}>{item.label}</span>
                    <h4 style={{ fontSize: "1.25rem", margin: "4px 0 0 0", color: item.color, fontWeight: 700 }}>{item.value || 0}</h4>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Packages Table */}
          <div className="card" style={{ background: "#fff", borderRadius: 14, border: "1px solid #f4e7dd", padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3d2e26", marginBottom: 16 }}>
              Top 10 Liệu trình doanh thu cao nhất 🏆
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f4e7dd", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", color: "#7c6f68", fontWeight: 600, fontSize: 13 }}>Liệu trình</th>
                    <th style={{ padding: "12px 8px", color: "#7c6f68", fontWeight: 600, fontSize: 13 }}>Số lượng bán</th>
                    <th style={{ padding: "12px 8px", color: "#7c6f68", fontWeight: 600, fontSize: 13 }}>Tổng doanh thu</th>
                    <th style={{ padding: "12px 8px", color: "#7c6f68", fontWeight: 600, fontSize: 13 }}>Số buổi đã thực hiện</th>
                    <th style={{ padding: "12px 8px", color: "#7c6f68", fontWeight: 600, fontSize: 13 }}>Tỷ lệ sử dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {topPackages.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: "20px 8px", textSelect: "none", color: "#a08e84", textAlign: "center" }}>
                        Chưa có dữ liệu giao dịch liệu trình
                      </td>
                    </tr>
                  ) : (
                    topPackages.map((pkg) => {
                      const usagePct = pkg.TotalSessionsSold > 0 
                        ? Math.round((pkg.TotalUsedSessions * 100) / pkg.TotalSessionsSold)
                        : 0;

                      return (
                        <tr key={pkg.PackageId} style={{ borderBottom: "1px solid #f4e7dd" }}>
                          <td style={{ padding: "12px 8px", fontWeight: 600, color: "#3d2e26" }}>{pkg.PackageName}</td>
                          <td style={{ padding: "12px 8px", color: "#5a4a42" }}>{pkg.SoldCount}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 700, color: "#a0573a" }}>{formatMoney(pkg.Revenue)}</td>
                          <td style={{ padding: "12px 8px", color: "#5a4a42" }}>
                            {pkg.TotalUsedSessions} / {pkg.TotalSessionsSold} buổi
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "#f5e6dc", borderRadius: 3, width: 80, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(usagePct, 100)}%`, height: "100%", background: "#a0573a", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#7c6f68" }}>{usagePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly trend list */}
          <div className="card" style={{ background: "#fff", borderRadius: 14, border: "1px solid #f4e7dd", padding: 20 }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3d2e26", marginBottom: 16 }}>
              Xu hướng doanh thu combo 12 tháng qua 📈
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              {monthlyTrend.length === 0 ? (
                <p style={{ color: "#a08e84", gridColumn: "1/-1", textAlign: "center", padding: 20 }}>Chưa có dữ liệu xu hướng tháng</p>
              ) : (
                monthlyTrend.map((trend) => (
                  <div
                    key={trend.Month}
                    style={{
                      padding: 16,
                      background: "#fffcf9",
                      borderRadius: 12,
                      border: "1px solid #f4e7dd",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <small style={{ color: "#7c6f68", fontWeight: 600 }}>Tháng {trend.Month}</small>
                      <h4 style={{ margin: "6px 0 2px 0", color: "#a0573a", fontSize: "1.15rem", fontWeight: 800 }}>
                        {formatMoney(trend.Revenue)}
                      </h4>
                    </div>
                    <span style={{ fontSize: 12, color: "#a08e84" }}>Đã bán: {trend.PackagesSold} gói</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
