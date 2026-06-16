import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient
      .get("/employees")
      .then((res) => setTechnicians(res.data.data || res.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Kỹ thuật viên</div>
          <h2 className="section-title">Đội ngũ chuyên gia</h2>
        </div>
      </div>

      {loading ? (
        <p>Đang tải kỹ thuật viên...</p>
      ) : (
        <div className="tech-grid">
          {technicians.map((t) => (
            <div className="tech-card glow-card" key={t.EmployeeId}>
              <div className="tech-img-box">
                <img src={resolveFileUrl(t.ImageUrl)} alt={t.FullName} />
              </div>

              <div className="tech-info">
                <h3>{t.FullName}</h3>
                <p>{t.Position || "Kỹ thuật viên"}</p>
                <span className="exp">
                  {t.Specialization || "Chăm sóc sắc đẹp"}
                </span>

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
      )}
    </section>
  );
}
