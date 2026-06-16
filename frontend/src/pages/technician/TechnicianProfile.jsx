import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getStatusText(status) {
  if (!status) return "Active";
  if (status === "INACTIVE") return "Inactive";
  if (status === "OFFLINE") return "Offline";
  if (status === "ACTIVE") return "Active";
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
    profile.Specialization || profile.Position || "Technician";
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
              My Profile <span>♙</span>
            </h1>
            <p>View your real profile, working hours, skills and attachments</p>
          </div>
        </header>

        {loading && (
          <div className="profile-card profile-loading">Loading profile...</div>
        )}

        {!loading && error && (
          <div className="profile-card profile-error">
            <p>{error}</p>
            <button type="button" onClick={loadProfile}>
              Reload
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
                    {profile.IsVerified === false ? "Unverified" : "Verified"}
                  </small>
                </p>

                <p>📞 {profile.Phone || "N/A"}</p>
                <p>✉ {profile.Email || "N/A"}</p>
                <p>💼 {profile.Position || "Technician"}</p>
                <p>
                  📅 Member since{" "}
                  {dateText(profile.HireDate || profile.CreatedAt)}
                </p>

                <button
                  type="button"
                  className="outline-profile-btn"
                  onClick={() => navigate("/technician/settings")}
                >
                  ✎ Edit Profile
                </button>
              </div>

              <div className="profile-id-box">
                <p>Technician ID</p>
                <b>{technicianCode}</b>

                <p>Total Appointments</p>
                <b>{totalAppointments}</b>

                <p>Completed</p>
                <b>{completedAppointments}</b>

                <p>Total Ratings</p>
                <b>
                  {averageRating} ({reviewCount} reviews)
                </b>
              </div>
            </div>

            <div className="profile-card professional-card">
              <h3>▧ Professional Summary</h3>
              <p>{profile.Bio || "No professional summary yet."}</p>

              <div className="professional-stats">
                <div>
                  <b>{Number(profile.ExperienceYears || 0)}+</b>
                  <span>Years Experience</span>
                </div>

                <div>
                  <b>{happyClients}+</b>
                  <span>Real Clients</span>
                </div>

                <div>
                  <b>{satisfaction}%</b>
                  <span>Client Satisfaction</span>
                </div>
              </div>
            </div>

            <div className="profile-card skills-card">
              <h3>Skills & Expertise</h3>

              {skills.length === 0 ? (
                <p className="profile-empty-text">No skills found</p>
              ) : (
                skills.map((skill, index) => {
                  const name = skill.name || `Skill ${index + 1}`;
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
                        {Number(skill.totalAppointments || 0)} completed
                        appointments
                      </small>
                    </div>
                  );
                })
              )}
            </div>

            <div className="profile-card hours-card">
              <div className="card-title-row">
                <h3>◷ Working Hours</h3>
                <button
                  type="button"
                  onClick={() => navigate("/technician/schedule")}
                >
                  View Schedule
                </button>
              </div>

              {workingHours.length === 0 ? (
                <p className="profile-empty-text">No working hours found</p>
              ) : (
                workingHours.map((item, index) => (
                  <p key={`${item.day}-${index}`}>
                    <span>{item.day || "N/A"}</span>
                    <b className={item.time === "Day off" ? "day-off" : ""}>
                      {item.time || "N/A"}
                    </b>
                  </p>
                ))
              )}
            </div>

            <div className="profile-card documents-card">
              <h3>▧ Recent Treatment Attachments</h3>

              {documents.length === 0 ? (
                <p className="profile-empty-text">No attachments found</p>
              ) : (
                documents.map((doc, index) => (
                  <div
                    className="doc-row"
                    key={doc.DocumentId || doc.AttachmentId || index}
                  >
                    <span>📄</span>

                    <div>
                      <b>{doc.name || doc.FileName || "Attachment"}</b>
                      <p>{doc.type || doc.FileType || "File"}</p>
                    </div>

                    <small>{dateText(doc.createdAt || doc.UploadedAt)}</small>

                    <button
                      type="button"
                      onClick={() => {
                        const url = resolveFileUrl(doc.FileUrl);
                        if (url) window.open(url, "_blank");
                      }}
                      disabled={!doc.FileUrl}
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
