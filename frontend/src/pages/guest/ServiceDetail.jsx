import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_IMAGE = "/images/default-service.png";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [service, setService] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function image(url) {
    return resolveFileUrl(url) || DEFAULT_IMAGE;
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [serviceRes, techRes] = await Promise.all([
          axiosClient.get(`/services/${id}`),
          axiosClient.get(`/employees/by-service/${id}`),
        ]);

        setService(serviceRes.data.data || serviceRes.data);
        setTechnicians(techRes.data.data || techRes.data || []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Không tải được chi tiết dịch vụ",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  function handleBooking(employeeId = "") {
    const url = `/customer/booking?serviceId=${id}${
      employeeId ? `&employeeId=${employeeId}` : ""
    }`;

    if (!user) {
      navigate(`/login?redirectUrl=${encodeURIComponent(url)}`);
      return;
    }

    navigate(url);
  }

  if (loading) {
    return (
      <section className="section container">
        <p>Đang tải chi tiết dịch vụ...</p>
      </section>
    );
  }

  if (error || !service) {
    return (
      <section className="section container">
        <div className="dashboard-card">
          <h3>Không tìm thấy dịch vụ</h3>
          <p className="muted">{error}</p>
          <Link className="btn" to="/services">
            Quay lại dịch vụ
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section container">
      <style>{`
        .svc-detail-hero {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 28px;
          align-items: stretch;
        }

        .svc-main-card,
        .svc-side-card,
        .svc-section-card {
          background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
          border: 1px solid #ead8c5;
          border-radius: 30px;
          box-shadow: 0 22px 55px rgba(88, 62, 39, .10);
        }

        .svc-main-card {
          overflow: hidden;
        }

        .svc-main-card img {
          width: 100%;
          height: 430px;
          object-fit: cover;
          background: #f7efe5;
        }

        .svc-main-body {
          padding: 28px;
        }

        .svc-main-body h1 {
          margin: 8px 0 12px;
          font-size: 38px;
          color: #3e2a1f;
        }

        .svc-info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin: 22px 0;
        }

        .svc-info-box {
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .svc-info-box b {
          display: block;
          margin-bottom: 6px;
          color: #4a3325;
        }

        .svc-side-card {
          padding: 28px;
        }

        .svc-tech-list {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .svc-tech-item {
          display: grid;
          grid-template-columns: 82px 1fr;
          gap: 14px;
          align-items: center;
          padding: 14px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .svc-tech-item img {
          width: 82px;
          height: 82px;
          object-fit: cover;
          border-radius: 20px;
          background: #f7efe5;
        }

        .svc-tech-item h3 {
          margin: 0 0 6px;
          color: #4a3325;
        }

        .svc-tech-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        @media(max-width: 980px) {
          .svc-detail-hero,
          .svc-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="svc-detail-hero">
        <div className="svc-main-card">
          <img src={image(service.ImageUrl)} alt={service.ServiceName} />

          <div className="svc-main-body">
            <div className="eyebrow">
              {service.CategoryName || "Beauty Service"}
            </div>

            <h1>{service.ServiceName}</h1>
            <p className="muted">{service.Description}</p>

            <div className="svc-info-grid">
              <div className="svc-info-box">
                <b>Giá dịch vụ</b>
                {money(service.Price)}
              </div>

              <div className="svc-info-box">
                <b>Thời lượng</b>
                {service.DurationMinutes} phút
              </div>

              <div className="svc-info-box">
                <b>Trạng thái</b>
                {service.Status || "AVAILABLE"}
              </div>
            </div>

            <button
              className="btn"
              type="button"
              onClick={() => handleBooking()}
            >
              Đặt lịch dịch vụ này
            </button>
          </div>
        </div>

        <aside className="svc-side-card">
          <div className="eyebrow">Kỹ thuật viên phù hợp</div>
          <h2>Nhân viên có thể thực hiện</h2>

          <div className="svc-tech-list">
            {technicians.length === 0 ? (
              <p className="muted">
                Chưa có kỹ thuật viên nào được gán cho dịch vụ này.
              </p>
            ) : (
              technicians.map((t) => (
                <div className="svc-tech-item" key={t.EmployeeId}>
                  <img src={image(t.ImageUrl)} alt={t.FullName} />

                  <div>
                    <h3>{t.FullName}</h3>

                    <p className="muted">
                      {t.Position || "Kỹ thuật viên"} •{" "}
                      {t.Specialization || "Chăm sóc sắc đẹp"}
                    </p>

                    <p className="muted">
                      ⭐ {Number(t.AverageRating || 0).toFixed(1)} •{" "}
                      {t.ReviewCount || 0} đánh giá
                    </p>

                    <div className="svc-tech-actions">
                      <Link
                        className="card-btn"
                        to={`/technicians/${t.EmployeeId}`}
                      >
                        Xem hồ sơ
                      </Link>

                      <button
                        className="card-btn primary"
                        type="button"
                        onClick={() => handleBooking(t.EmployeeId)}
                      >
                        Đặt lịch
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link className="btn btn-outline" to="/services">
          Quay lại danh sách dịch vụ
        </Link>
      </div>
    </section>
  );
}
