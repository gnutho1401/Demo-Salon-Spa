import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function getAvatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function dateText(value) {
  if (!value) return "N/A";

  const raw = String(value).trim();

  if (
    !raw ||
    raw === "Invalid Date" ||
    raw === "null" ||
    raw === "undefined" ||
    raw.startsWith("0000")
  ) {
    return "N/A";
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getStatusText(status) {
  if (!status) return "Đang hoạt động";
  if (status === "INACTIVE") return "Ngưng hoạt động";
  if (status === "OFFLINE") return "Ngoại tuyến";
  if (status === "ACTIVE") return "Đang hoạt động";
  return status;
}

export default function TechnicianProfile() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/technician/profile");
      setData(res.data?.data || {});
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được hồ sơ kỹ thuật viên",
      );
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const rating = data?.rating || {};
  const skills = Array.isArray(data?.skills) ? data.skills : [];
  const workingHours = Array.isArray(data?.workingHours)
    ? data.workingHours
    : [];
  const documents = Array.isArray(data?.documents) ? data.documents : [];

  const fullName = profile.FullName || "N/A";
  const specialization =
    profile.Specialization || profile.Position || "Kỹ thuật viên";
  const avatarUrl = getAvatarUrl(profile.AvatarUrl || profile.ImageUrl);
  const employeeStatus =
    profile.WorkingStatus || profile.EmployeeStatus || profile.Status;

  const technicianCode = useMemo(() => {
    if (profile.TechnicianCode) return profile.TechnicianCode;
    if (profile.EmployeeId)
      return `#TEC-${String(profile.EmployeeId).padStart(4, "0")}`;
    return "N/A";
  }, [profile.TechnicianCode, profile.EmployeeId]);

  const averageRating = Number(rating.AverageRating || 0).toFixed(1);
  const reviewCount = Number(rating.ReviewCount || 0);
  const totalAppointments = Number(stats.TotalAppointments || 0);
  const completedAppointments = Number(stats.CompletedAppointments || 0);
  const happyClients = Number(stats.HappyClients || 0);
  const satisfaction = Number(stats.ClientSatisfaction || 0);

  return (
    <TechnicianLayout>
      <div className="tech-profile-page">
        <header className="profile-header">
          <div>
            <h1>
              Hồ sơ của tôi <span>♙</span>
            </h1>
            <p>
              Xem thông tin chi tiết cá nhân, ca trực, chuyên môn và tài liệu
              của bạn
            </p>
          </div>
        </header>

        {loading && (
          <div className="profile-card profile-loading">
            Đang tải hồ sơ kỹ thuật viên...
          </div>
        )}

        {!loading && error && (
          <div className="profile-card profile-error">
            <p>{error}</p>
            <button type="button" onClick={loadProfile}>
              Tải lại
            </button>
          </div>
        )}

        {!loading && !error && (
          <section className="tech-profile-grid">
            <div className="profile-card profile-main-card">
              <div className="profile-avatar-box">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <button
                  type="button"
                  onClick={() => navigate("/technician/settings")}
                  title="Chỉnh sửa ảnh đại diện"
                >
                  ✎
                </button>
              </div>

              <div className="profile-main-info">
                <h2>
                  {fullName}
                  <span>{specialization}</span>
                </h2>

                <p className="profile-status">
                  <b>● {getStatusText(employeeStatus)}</b>
                  <small>
                    {profile.IsVerified === false
                      ? "Chưa xác minh"
                      : "Đã xác minh"}
                  </small>
                </p>

                <p>📞 {profile.Phone || "Chưa cập nhật SĐT"}</p>
                <p>✉ {profile.Email || "N/A"}</p>
                <p>💼 {profile.Position || "Kỹ thuật viên"}</p>
                <p>
                  📅 Thành viên từ{" "}
                  {dateText(profile.HireDate || profile.CreatedAt)}
                </p>

                <button
                  type="button"
                  className="outline-profile-btn"
                  onClick={() => navigate("/technician/settings")}
                >
                  ✎ Chỉnh sửa hồ sơ
                </button>
              </div>

              <div className="profile-id-box">
                <p>Mã kỹ thuật viên</p>
                <b>{technicianCode}</b>

                <p>Tổng số lịch hẹn</p>
                <b>{totalAppointments}</b>

                <p>Đã hoàn thành</p>
                <b>{completedAppointments}</b>

                <p>Đánh giá trung bình</p>
                <b>
                  {averageRating} ⭐ ({reviewCount} đánh giá)
                </b>
              </div>
            </div>

            <div className="profile-card professional-card">
              <h3>▧ Giới thiệu chuyên môn</h3>
              <p>{profile.Bio || "Chưa có thông tin giới thiệu chuyên môn."}</p>

              <div className="professional-stats">
                <div>
                  <b>{Number(profile.ExperienceYears || 0)}+</b>
                  <span>Năm kinh nghiệm</span>
                </div>

                <div>
                  <b>{happyClients}+</b>
                  <span>Khách hàng thân thiết</span>
                </div>

                <div>
                  <b>{satisfaction}%</b>
                  <span>Khách hài lòng</span>
                </div>
              </div>
            </div>

            <div className="profile-card skills-card">
              <h3>Kỹ năng & Chuyên môn</h3>

              {skills.length === 0 ? (
                <p className="profile-empty-text">Chưa cấu hình kỹ năng nào</p>
              ) : (
                skills.map((skill, index) => {
                  const name = skill.name || `Kỹ năng ${index + 1}`;
                  const percent = clampPercent(skill.percent);

                  return (
                    <div className="skill-row" key={`${name}-${index}`}>
                      <p>
                        <span>{name}</span>
                        <b>{percent}%</b>
                      </p>

                      <div>
                        <i style={{ width: `${percent}%` }} />
                      </div>

                      <small>
                        Đã thực hiện {Number(skill.totalAppointments || 0)} lịch
                        hẹn
                      </small>
                    </div>
                  );
                })
              )}
            </div>

            <div className="profile-card hours-card">
              <div className="card-title-row">
                <h3>◷ Giờ làm việc cố định</h3>
                <button
                  type="button"
                  onClick={() => navigate("/technician/schedule")}
                >
                  Xem lịch biểu
                </button>
              </div>

              {workingHours.length === 0 ? (
                <p className="profile-empty-text">
                  Chưa phân ca làm việc cố định
                </p>
              ) : (
                workingHours.map((item, index) => (
                  <p key={`${item.day}-${index}`}>
                    <span>{item.day || "N/A"}</span>
                    <b
                      className={
                        item.time === "Day off" || item.time === "Nghỉ"
                          ? "day-off"
                          : ""
                      }
                    >
                      {item.time === "Day off" ? "Nghỉ ca" : item.time || "N/A"}
                    </b>
                  </p>
                ))
              )}
            </div>

            <div className="profile-card documents-card">
              <h3>▧ Tài liệu đính kèm điều trị gần đây</h3>

              {documents.length === 0 ? (
                <p className="profile-empty-text">
                  Chưa có tài liệu hoặc chứng chỉ đính kèm
                </p>
              ) : (
                documents.map((doc, index) => (
                  <div
                    className="doc-row"
                    key={doc.DocumentId || doc.AttachmentId || index}
                  >
                    <span>📄</span>

                    <div>
                      <b>{doc.name || doc.FileName || "Tài liệu đính kèm"}</b>
                      <p>{doc.type || doc.FileType || "Tệp tin"}</p>
                    </div>

                    <small>{dateText(doc.createdAt || doc.UploadedAt)}</small>

                    <button
                      type="button"
                      onClick={() => {
                        const url = resolveFileUrl(doc.FileUrl);
                        if (url) window.open(url, "_blank");
                      }}
                      disabled={!doc.FileUrl}
                      title="Tải tệp xuống"
                    >
                      ⇩
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </TechnicianLayout>
  );
}
