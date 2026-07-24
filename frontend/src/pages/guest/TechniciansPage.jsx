import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState("ALL");

  useEffect(() => {
    axiosClient
      .get("/employees")
      .then((res) => setTechnicians(res.data.data || res.data || []))
      .finally(() => setLoading(false));
  }, []);

  // Group technicians by branch
  const grouped = useMemo(() => {
    const map = {};
    technicians.forEach((t) => {
      const branch = t.BranchName || "Chi nhánh chính";
      if (!map[branch]) map[branch] = [];
      map[branch].push(t);
    });
    // Sort each group by rating descending
    Object.values(map).forEach((list) =>
      list.sort(
        (a, b) => Number(b.AverageRating || 0) - Number(a.AverageRating || 0),
      ),
    );
    return map;
  }, [technicians]);

  const branchNames = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const filteredBranches =
    activeBranch === "ALL" ? branchNames : [activeBranch];

  return (
    <section className="section container tech-page-grouped">
      <div className="section-head" style={{ marginBottom: "12px" }}>
        <div>
          <div
            className="eyebrow"
            style={{
              color: "#e96a95",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Kỹ thuật viên
          </div>
          <h2
            className="section-title"
            style={{
              fontSize: "32px",
              color: "#2d1424",
              fontWeight: 800,
              margin: "6px 0 0 0",
            }}
          >
            Đội ngũ chuyên gia LUNA
          </h2>
          <p style={{ color: "#8c7784", fontSize: "15px", marginTop: "8px" }}>
            Đội ngũ chuyên viên hàng đầu được phân bổ tại các chi nhánh trên
            toàn hệ thống, sẵn sàng mang đến trải nghiệm chăm sóc sắc đẹp đẳng
            cấp nhất.
          </p>
        </div>
      </div>

      {/* Branch filter tabs */}
      {branchNames.length > 1 && (
        <div
          className="tech-branch-tabs"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "32px",
            paddingBottom: "16px",
            borderBottom: "1.5px solid rgba(239, 79, 131, 0.1)",
          }}
        >
          <button
            className={`tech-branch-tab ${activeBranch === "ALL" ? "active" : ""}`}
            onClick={() => setActiveBranch("ALL")}
            style={{
              padding: "10px 22px",
              borderRadius: "999px",
              border:
                activeBranch === "ALL"
                  ? "none"
                  : "1.5px solid rgba(239, 79, 131, 0.2)",
              background:
                activeBranch === "ALL"
                  ? "linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%)"
                  : "#fff",
              color: activeBranch === "ALL" ? "#fff" : "#5c4554",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow:
                activeBranch === "ALL"
                  ? "0 4px 15px rgba(239, 79, 131, 0.3)"
                  : "none",
            }}
          >
            🏢 Tất cả chi nhánh ({technicians.length})
          </button>
          {branchNames.map((branch) => (
            <button
              key={branch}
              className={`tech-branch-tab ${activeBranch === branch ? "active" : ""}`}
              onClick={() => setActiveBranch(branch)}
              style={{
                padding: "10px 22px",
                borderRadius: "999px",
                border:
                  activeBranch === branch
                    ? "none"
                    : "1.5px solid rgba(239, 79, 131, 0.2)",
                background:
                  activeBranch === branch
                    ? "linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%)"
                    : "#fff",
                color: activeBranch === branch ? "#fff" : "#5c4554",
                fontWeight: 800,
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow:
                  activeBranch === branch
                    ? "0 4px 15px rgba(239, 79, 131, 0.3)"
                    : "none",
              }}
            >
              📍 {branch} ({grouped[branch].length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p
          style={{
            textAlign: "center",
            color: "#8c7784",
            fontSize: "16px",
            padding: "40px 0",
          }}
        >
          Đang tải kỹ thuật viên...
        </p>
      ) : (
        filteredBranches.map((branch) => (
          <div
            key={branch}
            className="tech-branch-section"
            style={{ marginBottom: "48px" }}
          >
            {/* Branch header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "24px",
                paddingBottom: "14px",
                borderBottom: "2px solid rgba(239, 79, 131, 0.08)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #fff0f6, #ffe3ec)",
                  fontSize: "22px",
                  flexShrink: 0,
                }}
              >
                🏢
              </span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#2d1424",
                  }}
                >
                  {branch}
                </h3>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    color: "#8c7784",
                    fontSize: "13px",
                  }}
                >
                  {grouped[branch].length} chuyên viên
                </p>
              </div>
            </div>

            {/* Technician cards grid */}
            <div className="tech-grid">
              {grouped[branch].map((t) => (
                <div className="tech-card glow-card" key={t.EmployeeId}>
                  <div className="tech-img-box">
                    <img
                      src={resolveFileUrl(
                        t.ImageUrl || "/images/avatars/default-avatar.png",
                      )}
                      alt={t.FullName}
                    />
                  </div>

                  <div className="tech-info">
                    <h3>{t.FullName}</h3>
                    <p>{t.Position || "Kỹ thuật viên"}</p>
                    <span className="exp">
                      {t.Specialization || "Chăm sóc sắc đẹp"}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        fontSize: "12px",
                        color: "#8c7784",
                        marginTop: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>⭐ {Number(t.AverageRating || 0).toFixed(1)}</span>
                      <span>{t.ReviewCount || 0} đánh giá</span>
                      <span>{t.YearsOfExperience || 0} năm KN</span>
                    </div>

                    <div className="tech-actions-center">
                      <Link
                        className="card-btn"
                        to={`/technicians/${t.EmployeeId}`}
                      >
                        Xem hồ sơ
                      </Link>
                      <Link
                        className="card-btn primary"
                        to={`/customer/booking?employeeId=${t.EmployeeId}`}
                      >
                        Đặt lịch
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
