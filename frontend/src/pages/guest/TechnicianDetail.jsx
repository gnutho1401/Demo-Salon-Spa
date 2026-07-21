import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

export default function TechnicianDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tech, setTech] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function image(url) {
    return resolveFileUrl(url || DEFAULT_AVATAR);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const techRes = await axiosClient.get(`/employees/${id}`);
        const techData = techRes.data.data || techRes.data;
        setTech(techData);

        if (user?.role === "CUSTOMER" || user?.RoleName === "CUSTOMER") {
          const favRes = await axiosClient.get(
            "/customers/me/favorites/employees",
          );
          const favorites = favRes.data.data || [];
          setIsFavorite(
            favorites.some((item) => String(item.EmployeeId) === String(id)),
          );
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Không tải được chi tiết kỹ thuật viên",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user]);

  async function toggleFavorite() {
    if (!user) {
      navigate("/login");
      return;
    }

    const res = await axiosClient.post(
      "/customers/me/favorites/employees/toggle",
      { employeeId: tech.EmployeeId },
    );

    setIsFavorite(!!res.data.data?.favorited);
  }

  if (loading) {
    return (
      <section className="section container">
        <p>Đang tải kỹ thuật viên...</p>
      </section>
    );
  }

  if (error || !tech) {
    return (
      <section className="section container">
        <div className="dashboard-card">
          <h3>Không tìm thấy kỹ thuật viên</h3>
          <p className="muted">{error}</p>
          <Link className="btn" to="/technicians">
            Quay lại danh sách
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section container">
      <style>{`
        .tech-detail-hero {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 28px;
          align-items: stretch;
        }

        .tech-profile-card,
        .tech-main-card,
        .tech-section-card {
          background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
          border: 1px solid #ead8c5;
          border-radius: 30px;
          box-shadow: 0 22px 55px rgba(88, 62, 39, .10);
        }

        .tech-profile-card {
          padding: 24px;
          text-align: center;
        }

        .tech-profile-card img {
          width: 100%;
          height: 380px;
          object-fit: cover;
          border-radius: 26px;
          background: #f7efe5;
        }

        .tech-profile-card h2 {
          margin: 18px 0 4px;
          color: #4a3325;
        }

        .tech-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #f7eadb;
          color: #7a5134;
          font-weight: 700;
          margin-top: 8px;
        }

        .tech-action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 18px;
        }

        .tech-main-card {
          padding: 30px;
        }

        .tech-main-card h1 {
          margin: 8px 0 10px;
          font-size: 38px;
          color: #3e2a1f;
        }

        .tech-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin: 24px 0;
        }

        .tech-stat-box {
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .tech-stat-box b {
          display: block;
          font-size: 22px;
          color: #8a5b37;
          margin-bottom: 4px;
        }

        .tech-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-top: 18px;
        }

        .tech-info-box {
          padding: 16px;
          border-radius: 20px;
          background: #fffaf5;
          border: 1px solid #ead8c5;
        }

        .tech-info-box b {
          display: block;
          margin-bottom: 6px;
          color: #4a3325;
        }

        .tech-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 28px;
        }

        .tech-section-card {
          padding: 24px;
        }

        .tech-service-list,
        .tech-review-list,
        .tech-shift-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .tech-service-item,
        .tech-review-item,
        .tech-shift-item {
          padding: 14px;
          border-radius: 18px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .tech-service-item {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 14px;
          align-items: center;
        }

        .tech-service-item img {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          object-fit: cover;
          background: #f7efe5;
        }

        .tech-service-item h4,
        .tech-review-item h4,
        .tech-shift-item h4 {
          margin: 0 0 6px;
          color: #4a3325;
        }

        .star {
          color: #d79b43;
          font-weight: 800;
        }

        @media(max-width: 980px) {
          .tech-detail-hero,
          .tech-detail-grid {
            grid-template-columns: 1fr;
          }

          .tech-stats-grid,
          .tech-info-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media(max-width: 560px) {
          .tech-stats-grid,
          .tech-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="tech-detail-hero">
        <aside className="tech-profile-card">
          <img src={image(tech.ImageUrl)} alt={tech.FullName} />

          <h2>{tech.FullName}</h2>
          <p className="muted">{tech.Position || "Kỹ thuật viên"}</p>

          <span className="tech-badge">
            {tech.Status === "ACTIVE" ? "Đang hoạt động" : tech.Status}
          </span>

          <div className="tech-action-row">
            <button className="card-btn" type="button" onClick={toggleFavorite}>
              {isFavorite ? "♥ Bỏ yêu thích" : "♡ Yêu thích"}
            </button>

            <Link
              className="card-btn primary"
              to={`/customer/booking?employeeId=${tech.EmployeeId}`}
            >
              Đặt lịch
            </Link>
          </div>
        </aside>

        <main className="tech-main-card">
          <div className="eyebrow">Chuyên gia làm đẹp</div>
          <h1>{tech.FullName}</h1>

          <p className="muted">
            {tech.Bio ||
              "Kỹ thuật viên có kinh nghiệm tư vấn, thực hiện dịch vụ và theo dõi liệu trình phù hợp với từng khách hàng."}
          </p>

          <div className="tech-stats-grid">
            <div className="tech-stat-box">
              <b>{Number(tech.AverageRating || 0).toFixed(1)}</b>
              Đánh giá trung bình
            </div>

            <div className="tech-stat-box">
              <b>{tech.ReviewCount || 0}</b>
              Lượt đánh giá
            </div>

            <div className="tech-stat-box">
              <b>{tech.CompletedAppointments || 0}</b>
              Lịch đã hoàn thành
            </div>

            <div className="tech-stat-box">
              <b>{tech.YearsOfExperience || 0}+</b>
              Năm kinh nghiệm
            </div>
          </div>

          <div className="tech-info-grid">
            <div className="tech-info-box">
              <b>Chuyên môn</b>
              {tech.Specialization || "Chăm sóc sắc đẹp"}
            </div>

            <div className="tech-info-box">
              <b>Chi nhánh</b>
              {tech.BranchName || "Beauty Salon"}
            </div>

            <div className="tech-info-box">
              <b>Email</b>
              {tech.Email || "Đang cập nhật"}
            </div>

            <div className="tech-info-box">
              <b>Số điện thoại</b>
              {tech.Phone || "Đang cập nhật"}
            </div>
          </div>
        </main>
      </div>

      <div className="tech-detail-grid">
        <div className="tech-section-card">
          <div className="eyebrow">Dịch vụ thực hiện</div>
          <h2>Dịch vụ của kỹ thuật viên</h2>

          <div className="tech-service-list">
            {(tech.Services || []).length === 0 ? (
              <p className="muted">Chưa có dịch vụ được gán.</p>
            ) : (
              tech.Services.map((s) => (
                <div className="tech-service-item" key={s.ServiceId}>
                  <img src={image(s.ImageUrl)} alt={s.ServiceName} />

                  <div>
                    <h4>{s.ServiceName}</h4>
                    <p className="muted">
                      {s.DurationMinutes} phút • {money(s.Price)}
                    </p>

                    <Link className="card-btn" to={`/services/${s.ServiceId}`}>
                      Xem dịch vụ
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="tech-section-card">
          <div className="eyebrow">Lịch làm việc</div>
          <h2>Ca làm sắp tới</h2>

          <div className="tech-shift-list">
            {(tech.WorkShifts || []).length === 0 ? (
              <p className="muted">Chưa có lịch làm việc sắp tới.</p>
            ) : (
              tech.WorkShifts.map((shift) => (
                <div className="tech-shift-item" key={shift.ShiftId}>
                  <h4>
                    {new Date(shift.ShiftDate).toLocaleDateString("vi-VN")}
                  </h4>

                  <p className="muted">
                    {shift.IsDayOff
                      ? "Nghỉ"
                      : `${shift.StartTime} - ${shift.EndTime}`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="tech-section-card" style={{ marginTop: 28 }}>
        <div className="eyebrow">Đánh giá khách hàng</div>
        <h2>Khách hàng nói gì?</h2>

        <div className="tech-review-list">
          {(tech.Reviews || []).length === 0 ? (
            <p className="muted">Chưa có đánh giá nào.</p>
          ) : (
            tech.Reviews.map((r) => (
              <div className="tech-review-item" key={r.ReviewId}>
                <h4>{r.CustomerName}</h4>
                <p className="star">
                  {"★".repeat(Number(r.TechnicianRating || r.Rating || 5))}
                </p>
                <p className="muted">{r.Comment}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link className="btn btn-outline" to="/technicians">
          Quay lại danh sách kỹ thuật viên
        </Link>
      </div>
    </section>
  );
}
