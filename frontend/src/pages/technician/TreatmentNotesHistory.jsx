import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";
import { useNavigate, useSearchParams } from "react-router-dom";

const DEFAULT_AVATAR = "/images/default-avatar.png";

const NOTE_TYPES = [
  "Skin Condition",
  "Products Used",
  "Technique",
  "Customer Feedback",
  "Recommendation",
  "General Notes",
];

const TEMPLATES = [
  {
    title: "Da nhạy cảm",
    content:
      "Da khách hơi nhạy cảm, có dấu hiệu khô nhẹ vùng má.\nNên dùng sản phẩm dịu nhẹ và tránh treatment mạnh.",
  },
  {
    title: "Da dầu mụn",
    content:
      "Da dầu, có mụn ẩn nhẹ ở vùng chữ T.\nNên làm sạch sâu, hạn chế sản phẩm gây bí da.",
  },
  {
    title: "Da khô",
    content:
      "Da khách hơi khô, cần tăng cường cấp ẩm.\nKhuyến nghị serum HA và mặt nạ phục hồi.",
  },
  {
    title: "Lão hóa",
    content:
      "Da có dấu hiệu lão hóa nhẹ.\nNên tập trung nâng cơ, cấp ẩm và chống oxy hóa.",
  },
  {
    title: "Sau điều trị mụn",
    content:
      "Sau điều trị mụn, da hơi đỏ nhẹ.\nCần phục hồi hàng rào bảo vệ da và chống nắng kỹ.",
  },
];

function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getAvatar(url) {
  if (!url) return DEFAULT_AVATAR;
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

export default function TreatmentNotes() {
  const [data, setData] = useState(null);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("General Notes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const [title, setTitle] = useState("");
  const [productsUsed, setProductsUsed] = useState("");
  const [skinCondition, setSkinCondition] = useState("");
  const [technique, setTechnique] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [progressStatus, setProgressStatus] = useState("IN_PROGRESS");
  const [files, setFiles] = useState([]);
  const appointment = data?.appointment || null;
  const previousNotes = data?.previousNotes || [];
  const categories = data?.categories || [];
  const summary = data?.summary || {};

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((item) => {
      map[item.NoteType] = item.Total;
    });
    return map;
  }, [categories]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/technician/treatment-notes", {
        params: { appointmentId },
      });
      const payload = res.data?.data || {};

      setData(payload);
      setContent(payload?.appointment?.CurrentNote || "");
      setNoteType(payload?.appointment?.NoteType || "General Notes");
      setTitle(payload?.appointment?.NoteTitle || "Treatment Note");
      setProductsUsed(payload?.appointment?.ProductsUsed || "");
      setSkinCondition(payload?.appointment?.SkinCondition || "");
      setTechnique(payload?.appointment?.Technique || "");
      setCustomerFeedback(payload?.appointment?.CustomerFeedback || "");
      setRecommendation(payload?.appointment?.Recommendation || "");
      setFollowUpDate(payload?.appointment?.FollowUpDate?.slice(0, 10) || "");
      setProgressStatus(payload?.appointment?.ProgressStatus || "IN_PROGRESS");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Không tải được Treatment Notes");
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!appointment?.AppointmentId) {
      alert("Không có lịch hẹn để lưu ghi chú");
      return;
    }

    if (!content.trim()) {
      alert("Vui lòng nhập nội dung ghi chú");
      return;
    }

    try {
      setSaving(true);

      const res = await axiosClient.post("/technician/treatment-notes", {
        appointmentId: appointment.AppointmentId,
        title,
        content,
        noteType,
        productsUsed,
        skinCondition,
        technique,
        customerFeedback,
        recommendation,
        followUpDate: followUpDate || null,
        progressStatus,
      });

      const noteId = res.data?.data?.noteId;

      if (noteId && files.length > 0) {
        const formData = new FormData();

        files.forEach((file) => {
          formData.append("files", file);
        });

        formData.append("attachmentType", "GENERAL");

        await axiosClient.post(
          `/technician/treatment-notes/${noteId}/attachments`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
      }

      setFiles([]);
      await loadData();
      alert("Đã lưu ghi chú điều trị");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Lưu ghi chú thất bại");
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (template) => {
    setContent((old) => {
      if (!old.trim()) return template.content;
      return `${old}\n\n${template.content}`;
    });
  };

  useEffect(() => {
    loadData();
  }, [appointmentId]);

  return (
    <TechnicianLayout>
      <div className="treatment-page">
        <header className="treatment-header">
          <div>
            <h1>
              Treatment Notes <span>📋</span>
            </h1>
            <p>View and manage treatment notes for your appointments</p>
          </div>

          <div className="treatment-top-search">
            <span>⌕</span>
            <input placeholder="Search customers, appointments, services..." />
          </div>

          <button className="treatment-new-btn">+ New Appointment⌄</button>
        </header>

        {error && <div className="treatment-error">{error}</div>}

        {loading ? (
          <div className="treatment-loading">Loading treatment notes...</div>
        ) : !appointment ? (
          <div className="treatment-empty">
            Không có lịch hẹn nào để ghi chú.
          </div>
        ) : (
          <>
            <section className="treatment-layout">
              <aside className="treatment-left">
                <div className="treatment-card upcoming-card">
                  <h3>📅 Upcoming Appointment</h3>

                  <div className="upcoming-profile">
                    <img
                      src={getAvatar(appointment.AvatarUrl)}
                      alt={appointment.CustomerName || "Customer"}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div>
                      <div className="upcoming-name-row">
                        <h2>{appointment.CustomerName || "Customer"}</h2>
                        <span>
                          {appointment.MembershipLevel || "Normal"} Member
                        </span>
                      </div>

                      <p>
                        {formatDate(appointment.AppointmentDate)} •{" "}
                        {appointment.StartTime || "N/A"}
                      </p>

                      <b>{appointment.Status || "IN PROGRESS"}</b>
                    </div>
                  </div>

                  <div className="upcoming-meta">
                    <p>💆 {appointment.ServiceName || "Service"}</p>
                    <p>🏠 {appointment.RoomName || "Chưa có phòng"}</p>
                    <p>⏱ {appointment.DurationMinutes || 0} minutes</p>
                  </div>

                  <button
                    className="outline-btn"
                    type="button"
                    onClick={() =>
                      navigate(
                        `/technician/appointments/${appointment.AppointmentId}`,
                      )
                    }
                  >
                    View Appointment Details
                  </button>
                </div>

                <div className="treatment-card category-card">
                  <h3>Note Categories</h3>

                  <div className="category-row active">
                    <span>✅ All Notes</span>
                    <b>{summary.TotalNotes || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>⚠️ Skin Condition</span>
                    <b>{categoryMap["Skin Condition"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>🧴 Products Used</span>
                    <b>{categoryMap["Products Used"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>🧬 Techniques</span>
                    <b>{categoryMap["Technique"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>💬 Customer Feedback</span>
                    <b>{categoryMap["Customer Feedback"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>📌 Recommendations</span>
                    <b>{categoryMap["Recommendation"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>📝 General Notes</span>
                    <b>{categoryMap["General Notes"] || 0}</b>
                  </div>
                </div>

                <div className="treatment-card note-history-card">
                  <h3>
                    Note History <small>(This Appointment)</small>
                  </h3>

                  <div className="note-timeline">
                    <div className="timeline-item green">
                      <i />
                      <div>
                        <p>
                          {formatDateTime(
                            appointment.UpdatedAt || appointment.NoteCreatedAt,
                          )}
                        </p>
                        <span>{appointment.CustomerName || "Customer"}</span>
                        <b>Note updated</b>
                      </div>
                    </div>

                    <div className="timeline-item yellow">
                      <i />
                      <div>
                        <p>{formatDateTime(appointment.NoteCreatedAt)}</p>
                        <span>{appointment.CustomerName || "Customer"}</span>
                        <b>Note added</b>
                      </div>
                    </div>

                    <div className="timeline-item gray">
                      <i />
                      <div>
                        <p>{formatDate(appointment.AppointmentDate)}</p>
                        <span>Receptionist</span>
                        <b>Initial note added</b>
                      </div>
                    </div>
                  </div>

                  <button className="outline-btn">View All Notes</button>
                </div>
              </aside>

              <main className="treatment-center">
                <div className="treatment-card editor-card">
                  <div className="editor-title">
                    <h3>Current Treatment Note</h3>
                    <div>
                      <span>
                        Last updated:{" "}
                        {formatDateTime(
                          appointment.UpdatedAt || appointment.NoteCreatedAt,
                        )}
                      </span>
                      <button>Templates⌄</button>
                    </div>
                  </div>

                  <div className="editor-toolbar">
                    <button>B</button>
                    <button>
                      <i>I</i>
                    </button>
                    <button>
                      <u>U</u>
                    </button>
                    <button>♧⌄</button>
                    <button>☷</button>
                    <button>☰</button>
                    <button>≡</button>
                    <button>⇤</button>
                    <button>↶</button>
                    <button className="disabled">↷</button>
                  </div>
                  <input
                    className="treatment-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Tiêu đề ghi chú"
                  />

                  <select
                    className="treatment-input"
                    value={progressStatus}
                    onChange={(e) => setProgressStatus(e.target.value)}
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="PAUSED">Paused</option>
                    <option value="COMPLETED">Completed</option>
                  </select>

                  <textarea
                    className="mini-note"
                    value={skinCondition}
                    onChange={(e) => setSkinCondition(e.target.value)}
                    placeholder="Skin condition - tình trạng da/tóc/móng..."
                  />

                  <textarea
                    className="mini-note"
                    value={productsUsed}
                    onChange={(e) => setProductsUsed(e.target.value)}
                    placeholder="Products used - sản phẩm đã dùng..."
                  />

                  <textarea
                    className="mini-note"
                    value={technique}
                    onChange={(e) => setTechnique(e.target.value)}
                    placeholder="Technique - kỹ thuật thực hiện..."
                  />

                  <textarea
                    className="mini-note"
                    value={customerFeedback}
                    onChange={(e) => setCustomerFeedback(e.target.value)}
                    placeholder="Customer feedback - phản hồi khách hàng..."
                  />

                  <textarea
                    className="mini-note"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Recommendation - lời khuyên sau điều trị..."
                  />

                  <input
                    className="treatment-input"
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập ghi chú điều trị..."
                  />

                  <div className="editor-bottom">
                    <div className="note-tags">
                      {NOTE_TYPES.slice(0, 5).map((type) => (
                        <button
                          key={type}
                          className={noteType === type ? "active" : ""}
                          onClick={() => setNoteType(type)}
                          type="button"
                        >
                          {type}
                        </button>
                      ))}
                      <button type="button" className="plus-tag">
                        ＋
                      </button>
                    </div>

                    <div className="editor-actions">
                      <button type="button" onClick={() => setContent("")}>
                        Clear
                      </button>
                      <button
                        type="button"
                        className="save"
                        disabled={saving}
                        onClick={saveNote}
                      >
                        ✓ {saving ? "Saving..." : "Save Note"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="treatment-card previous-card">
                  <div className="previous-head">
                    <h3>Previous Notes for This Customer</h3>
                    <select>
                      <option>Filter by Service</option>
                    </select>
                  </div>

                  {previousNotes.length === 0 ? (
                    <div className="previous-empty">
                      Chưa có ghi chú trước đó cho khách hàng này.
                    </div>
                  ) : (
                    previousNotes.slice(0, 3).map((note, index) => (
                      <div className="previous-note" key={note.NoteId || index}>
                        <div className={`previous-icon icon-${index + 1}`}>
                          ♧
                        </div>

                        <div className="previous-content">
                          <div className="previous-meta">
                            <span>
                              {formatDate(note.AppointmentDate)} •{" "}
                              {note.StartTime}
                            </span>
                            <span>
                              {appointment.CustomerName || "Customer"}
                            </span>
                          </div>

                          <h4>
                            {note.ServiceName ||
                              note.NoteType ||
                              "Treatment Note"}
                          </h4>
                          <p>{note.Content}</p>
                        </div>

                        <button>View Note</button>
                      </div>
                    ))
                  )}

                  <button className="outline-btn">View All History</button>
                </div>
              </main>

              <aside className="treatment-right">
                <div className="treatment-card template-card">
                  <div className="template-head">
                    <h3>Note Templates</h3>
                    <button>Manage</button>
                  </div>

                  {TEMPLATES.map((item) => (
                    <button
                      key={item.title}
                      className="template-item"
                      onClick={() => applyTemplate(item)}
                      type="button"
                    >
                      <span>📄 {item.title}</span>
                      <b>›</b>
                    </button>
                  ))}

                  <button className="add-template" type="button">
                    + Add New Template
                  </button>
                </div>

                <div className="treatment-card attachment-card">
                  <h3>Attachments ({files.length})</h3>

                  <label className="dropzone">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      hidden
                      onChange={(e) =>
                        setFiles(Array.from(e.target.files || []))
                      }
                    />

                    <span>☁</span>
                    <b>Click to upload files</b>
                    <p>Before/After photos, PDF, treatment documents</p>
                    <small>JPG, PNG, PDF (Max 5MB)</small>
                  </label>

                  {files.length > 0 && (
                    <div className="uploaded-list">
                      {files.map((file, index) => (
                        <div key={`${file.name}-${index}`}>
                          <span>{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setFiles((old) =>
                                old.filter((_, i) => i !== index),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(data?.attachments || []).length > 0 && (
                    <div className="uploaded-list">
                      {data.attachments.map((item) => (
                        <a
                          key={item.AttachmentId}
                          href={resolveFileUrl(item.FileUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.FileName}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </section>

            <section className="treatment-summary">
              <div className="summary-item">
                <span>🗒️</span>
                <p>Total Notes</p>
                <h3>{summary.TotalNotes || 0}</h3>
                <small>All time</small>
              </div>

              <div className="summary-item">
                <span>📋</span>
                <p>Notes This Month</p>
                <h3>{summary.NotesThisMonth || 0}</h3>
                <small>↑ 25% vs last month</small>
              </div>

              <div className="summary-item">
                <span>🎯</span>
                <p>Most Common</p>
                <h3>{categories[0]?.NoteType || "Skin Condition"}</h3>
                <small>{categories[0]?.Total || 0} notes</small>
              </div>

              <div className="summary-item">
                <span>🧴</span>
                <p>Most Used Product</p>
                <h3>{appointment.ProductsUsed || "Chưa có"}</h3>
                <small>From treatment notes</small>
              </div>

              <div className="summary-item">
                <span>📅</span>
                <p>Last Note</p>
                <h3>{formatDate(summary.LastNote)}</h3>
                <small>10:45 AM</small>
              </div>

              <div className="quote-card">
                <strong>“</strong>
                <p>Good notes make great service even better.</p>
              </div>
            </section>
          </>
        )}
      </div>
    </TechnicianLayout>
  );
}
