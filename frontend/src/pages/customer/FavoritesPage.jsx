import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function FavoritesPage() {
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [serviceRes, employeeRes] = await Promise.all([
        axiosClient.get("/customers/me/favorites/services"),
        axiosClient.get("/customers/me/favorites/employees"),
      ]);
      setServices(serviceRes.data.data || []);
      setEmployees(employeeRes.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được danh sách yêu thích",
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleService(serviceId) {
    await axiosClient.post("/customers/me/favorites/services/toggle", {
      serviceId,
    });
    load();
  }

  async function toggleEmployee(employeeId) {
    await axiosClient.post("/customers/me/favorites/employees/toggle", {
      employeeId,
    });
    load();
  }

  return (
    <CustomerLayout>
      <section className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Favorites</div>
            <h2 className="section-title">
              Dịch vụ và kỹ thuật viên yêu thích
            </h2>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="dashboard-card" style={{ marginBottom: 24 }}>
          <h3>Dịch vụ yêu thích</h3>
          {services.length === 0 ? (
            <p className="muted">Chưa có dịch vụ yêu thích nào.</p>
          ) : (
            <div className="grid">
              {services.map((s) => (
                <div className="service-card" key={s.ServiceId}>
                  <img src={resolveFileUrl(s.ImageUrl)} alt={s.ServiceName} />
                  <div className="service-body">
                    <p className="eyebrow">{s.CategoryName}</p>
                    <h3>{s.ServiceName}</h3>
                    <p className="muted">{s.DurationMinutes} phút</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        className="card-btn"
                        to={`/services/${s.ServiceId}`}
                      >
                        Xem chi tiết
                      </Link>
                      <button
                        className="card-btn primary"
                        onClick={() => toggleService(s.ServiceId)}
                      >
                        Bỏ yêu thích
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <h3>Kỹ thuật viên yêu thích</h3>
          {employees.length === 0 ? (
            <p className="muted">Chưa có kỹ thuật viên yêu thích nào.</p>
          ) : (
            <div className="tech-list-grid">
              {employees.map((t) => (
                <article className="tech-profile-card" key={t.EmployeeId}>
                  <div className="tech-cover">
                    <img src={resolveFileUrl(t.ImageUrl)} alt={t.FullName} />
                  </div>
                  <div className="tech-profile-body">
                    <h3>{t.FullName}</h3>
                    <p className="muted">
                      {t.Position || "Kỹ thuật viên"} •{" "}
                      {t.Specialization || "Chăm sóc sắc đẹp"}
                    </p>
                    <div className="tech-actions">
                      <Link
                        className="card-btn"
                        to={`/technicians/${t.EmployeeId}`}
                      >
                        Xem chi tiết
                      </Link>
                      <button
                        className="card-btn primary"
                        onClick={() => toggleEmployee(t.EmployeeId)}
                      >
                        Bỏ yêu thích
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </CustomerLayout>
  );
}
