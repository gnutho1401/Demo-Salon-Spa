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

const NOTE_TYPE_MAP = {
  "Skin Condition": "Tình trạng da",
  "Products Used": "Sản phẩm đã dùng",
  "Technique": "Kỹ thuật thực hiện",
  "Customer Feedback": "Phản hồi khách hàng",
  "Recommendation": "Khuyến nghị",
  "General Notes": "Ghi chú chung",
};

function getNoteTypeLabel(type) {
  return NOTE_TYPE_MAP[type] || type || "Ghi chú chung";
}

const PROGRESS_STATUS_MAP = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang tiến hành",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
};

function getProgressStatusLabel(status) {
  return PROGRESS_STATUS_MAP[status] || status;
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

  const timelineItems = useMemo(() => {
    if (!appointment) return [];
    const list = [];
    
    // 1. Initial Appointment
    list.push({
      key: "initial",
      type: "gray",
      date: appointment.AppointmentDate,
      user: "Lễ tân",
      label: "Lịch hẹn được tạo",
    });

    // 2. Note added
    if (appointment.NoteCreatedAt) {
      list.push({
        key: "added",
        type: "yellow",
        date: appointment.NoteCreatedAt,
        user: "Kỹ thuật viên",
        label: "Ghi chú điều trị được tạo",
      });
    }

    // 3. Note updated
    if (appointment.UpdatedAt && appointment.UpdatedAt !== appointment.NoteCreatedAt) {
      list.push({
        key: "updated",
        type: "green",
        date: appointment.UpdatedAt,
        user: "Kỹ thuật viên",
        label: "Ghi chú đã được cập nhật",
      });
    }

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [appointment]);

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
              Ghi chú trị liệu <span>📋</span>
            </h1>
            <p>Xem và quản lý ghi chú trị liệu cho các buổi hẹn của bạn</p>
          </div>

          <div className="treatment-top-search">
            <span>⌕</span>
            <input placeholder="Tìm kiếm khách hàng, lịch hẹn, dịch vụ..." />
          </div>

          <button className="treatment-new-btn">+ Lịch hẹn mới⌄</button>
        </header>

        {error && <div className="treatment-error">{error}</div>}

        {loading ? (
          <div className="treatment-loading">Đang tải ghi chú điều trị...</div>
        ) : !appointment ? (
          <div className="treatment-empty">
            Không có lịch hẹn nào để ghi chú.
          </div>
        ) : (
          <>
            <section className="treatment-layout">
              <aside className="treatment-left">
                <div className="treatment-card upcoming-card">
                  <h3>📅 Buổi hẹn sắp tới</h3>

                  <div className="upcoming-profile">
                    <img
                      src={getAvatar(appointment.AvatarUrl)}
                      alt={appointment.CustomerName || "Khách hàng"}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div>
                      <div className="upcoming-name-row">
                        <h2>{appointment.CustomerName || "Khách hàng"}</h2>
                        <span>
                          {appointment.MembershipLevel || "Thường"} Member
                        </span>
                      </div>

                      <p>
                        {formatDate(appointment.AppointmentDate)} •{" "}
                        {appointment.StartTime || "N/A"}
                      </p>

                      <b>{appointment.Status || "Đang tiến hành"}</b>
                    </div>
                  </div>

                  <div className="upcoming-meta">
                    <p>💆 {appointment.ServiceName || "Dịch vụ"}</p>
                    <p>🏠 {appointment.RoomName || "Chưa có phòng"}</p>
                    <p>⏱ {appointment.DurationMinutes || 0} phút</p>
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
                    Xem chi tiết buổi hẹn
                  </button>
                </div>

                <div className="treatment-card category-card">
                  <h3>Danh mục ghi chú</h3>

                  <div className="category-row active">
                    <span>✅ Tất cả ghi chú</span>
                    <b>{summary.TotalNotes || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>⚠️ Tình trạng da</span>
                    <b>{categoryMap["Skin Condition"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>🧴 Sản phẩm đã dùng</span>
                    <b>{categoryMap["Products Used"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>🧬 Kỹ thuật thực hiện</span>
                    <b>{categoryMap["Technique"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>💬 Phản hồi của khách</span>
                    <b>{categoryMap["Customer Feedback"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>📌 Khuyến nghị</span>
                    <b>{categoryMap["Recommendation"] || 0}</b>
                  </div>

                  <div className="category-row">
                    <span>📝 Ghi chú chung</span>
                    <b>{categoryMap["General Notes"] || 0}</b>
                  </div>
                </div>

                <div className="treatment-card note-history-card">
                  <h3>
                    Lịch sử ghi chú <small>(Buổi hẹn này)</small>
                  </h3>

                  <div className="note-timeline">
                    {timelineItems.length === 0 ? (
                      <p className="muted-line">Chưa có lịch hoạt động ghi chú nào</p>
                    ) : (
                      timelineItems.map((item) => (
                        <div className={`timeline-item ${item.type}`} key={item.key}>
                          <i />
                          <div>
                            <p>
                              {item.key === "initial"
                                ? formatDate(item.date)
                                : formatDateTime(item.date)}
                            </p>
                            <span>{item.user}</span>
                            <b>{item.label}</b>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button className="outline-btn">Xem tất cả ghi chú</button>
                </div>
              </aside>

              <main className="treatment-center">
                <div className="treatment-card editor-card">
                  <div className="editor-title">
                    <h3>Ghi chú điều trị hiện tại</h3>
                    <div>
                      <span>
                        Cập nhật cuối:{" "}
                        {formatDateTime(
                          appointment.UpdatedAt || appointment.NoteCreatedAt,
                        )}
                      </span>
                      <button>Mẫu ghi chú mẫu</button>
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
                    <option value="NOT_STARTED">Chưa bắt đầu</option>
                    <option value="IN_PROGRESS">Đang thực hiện</option>
                    <option value="PAUSED">Tạm dừng</option>
                    <option value="COMPLETED">Hoàn thành</option>
                  </select>

                  <textarea
                    className="mini-note"
                    value={skinCondition}
                    onChange={(e) => setSkinCondition(e.target.value)}
                    placeholder="Tình trạng da/tóc/móng..."
                  />

                  <textarea
                    className="mini-note"
                    value={productsUsed}
                    onChange={(e) => setProductsUsed(e.target.value)}
                    placeholder="Sản phẩm đã dùng..."
                  />

                  <textarea
                    className="mini-note"
                    value={technique}
                    onChange={(e) => setTechnique(e.target.value)}
                    placeholder="Kỹ thuật thực hiện..."
                  />

                  <textarea
                    className="mini-note"
                    value={customerFeedback}
                    onChange={(e) => setCustomerFeedback(e.target.value)}
                    placeholder="Phản hồi của khách hàng..."
                  />

                  <textarea
                    className="mini-note"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Khuyến nghị sau điều trị..."
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
                    placeholder="Nhập nội dung ghi chú trị liệu..."
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
                          {getNoteTypeLabel(type)}
                        </button>
                      ))}
                      <button type="button" className="plus-tag">
                        ＋
                      </button>
                    </div>

                    <div className="editor-actions">
                      <button type="button" onClick={() => setContent("")}>
                        Xóa nội dung
                      </button>
                      <button
                        type="button"
                        className="save"
                        disabled={saving}
                        onClick={saveNote}
                      >
                        ✓ {saving ? "Đang lưu..." : "Lưu ghi chú"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="treatment-card previous-card">
                  <div className="previous-head">
                    <h3>Ghi chú trước đó của khách hàng này</h3>
                    <select>
                      <option>Lọc theo dịch vụ</option>
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
                              {appointment.CustomerName || "Khách hàng"}
                            </span>
                          </div>

                          <h4>
                            {note.ServiceName ||
                              getNoteTypeLabel(note.NoteType) ||
                              "Ghi chú trị liệu"}
                          </h4>
                          <p>{note.Content}</p>
                        </div>

                        <button>Xem ghi chú</button>
                      </div>
                    ))
                  )}

                  <button className="outline-btn">Xem tất cả lịch sử</button>
                </div>
              </main>

              <aside className="treatment-right">
                <div className="treatment-card template-card">
                  <div className="template-head">
                    <h3>Mẫu ghi chú mẫu</h3>
                    <button>Quản lý</button>
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
                    + Thêm mẫu mới
                  </button>
                </div>

                <div className="treatment-card attachment-card">
                  <h3>Tệp đính kèm ({files.length})</h3>

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
                    <b>Nhấp để chọn tải lên tệp</b>
                    <p>Ảnh trước/sau khi trị liệu, PDF, tài liệu điều trị</p>
                    <small>JPG, PNG, PDF (Tối đa 5MB)</small>
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
                            Gỡ bỏ
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
                <p>Tổng ghi chú</p>
                <h3>{summary.TotalNotes || 0}</h3>
                <small>Từ trước tới nay</small>
              </div>

              <div className="summary-item">
                <span>📋</span>
                <p>Ghi chú tháng này</p>
                <h3>{summary.NotesThisMonth || 0}</h3>
                <small>↑ 25% so với tháng trước</small>
              </div>

              <div className="summary-item">
                <span>🎯</span>
                <p>Phổ biến nhất</p>
                <h3>{getNoteTypeLabel(categories[0]?.NoteType) || "Tình trạng da"}</h3>
                <small>{categories[0]?.Total || 0} ghi chú</small>
              </div>

              <div className="summary-item">
                <span>🧴</span>
                <p>Sản phẩm dùng nhiều</p>
                <h3>{appointment.ProductsUsed || "Chưa có"}</h3>
                <small>Từ ghi chú trị liệu</small>
              </div>

              <div className="summary-item">
                <span>📅</span>
                <p>Gần đây nhất</p>
                <h3>{formatDate(summary.LastNote)}</h3>
                <small>Gần nhất</small>
              </div>

              <div className="quote-card">
                <strong>“</strong>
                <p>Ghi chú điều trị chuẩn mực tạo nên dịch vụ làm đẹp hoàn hảo.</p>
              </div>
            </section>
          </>
        )}
      </div>
    </TechnicianLayout>
  );
}
