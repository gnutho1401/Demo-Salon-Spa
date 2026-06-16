import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";
const DEFAULT_SERVICE_IMAGE = "/images/default-service.png";

const STATUS_STEPS = [
  { key: "PENDING_PAYMENT", label: "Pending Payment", icon: "▣" },
  { key: "PAID", label: "Paid", icon: "💳" },
  { key: "CONFIRMED", label: "Confirmed", icon: "✓" },
  { key: "CHECKED_IN", label: "Checked In", icon: "◇" },
  { key: "IN_PROGRESS", label: "In Progress", icon: "▶" },
  { key: "COMPLETED", label: "Completed", icon: "✓" },
  { key: "NO_SHOW", label: "No Show", icon: "⊗" },
];

function fileUrl(url, fallback) {
  return resolveFileUrl(url) || fallback;
}

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("vi-VN") + " VND";
}

function safeDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function safeDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function statusClass(status) {
  return String(status || "pending")
    .toLowerCase()
    .replaceAll("_", "-");
}

export default function TechnicianAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [productsUsed, setProductsUsed] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [skinCondition, setSkinCondition] = useState("");
  const [technique, setTechnique] = useState("");
  const [customerFeedback, setCustomerFeedback] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [progressStatus, setProgressStatus] = useState("IN_PROGRESS");

  const [noteFiles, setNoteFiles] = useState([]);
  const [uploadingNoteId, setUploadingNoteId] = useState("");
  const noteFileInputRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get(`/technician/appointments/${id}`);
      setAppointment(res.data.data || null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được chi tiết lịch hẹn",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const detail = appointment?.appointment || {};
  const services = appointment?.services || [];
  const history = appointment?.statusHistory || [];
  const notes = appointment?.treatmentNotes || [];

  function historyTime(statusKey) {
    return history.find((item) => item.NewStatus === statusKey)?.ChangedAt;
  }

  const status = String(detail.Status || "PENDING_PAYMENT").toUpperCase();
  const paymentStatus = String(detail.PaymentStatus || "UNPAID").toUpperCase();

  const activeStepIndex = useMemo(() => {
    const index = STATUS_STEPS.findIndex((step) => step.key === status);
    return index < 0 ? 0 : index;
  }, [status]);

  const canStart = status === "CHECKED_IN";
  const canComplete = status === "IN_PROGRESS";
  const canNoShow = ["CONFIRMED", "CHECKED_IN"].includes(status);

  function resetNoteForm() {
    setNoteTitle("");
    setNoteContent("");
    setProductsUsed("");
    setRecommendation("");
    setSkinCondition("");
    setTechnique("");
    setCustomerFeedback("");
    setFollowUpDate("");
    setProgressStatus("IN_PROGRESS");
    setNoteFiles([]);

    if (noteFileInputRef.current) {
      noteFileInputRef.current.value = "";
    }
  }

  async function runAction(type, url, message) {
    const ok = window.confirm(message);
    if (!ok) return;

    try {
      setActionLoading(type);
      await axiosClient.patch(url);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    } finally {
      setActionLoading("");
    }
  }

  async function uploadNoteAttachments(noteId, files = noteFiles) {
    if (!noteId || !files.length) return;

    try {
      setUploadingNoteId(noteId);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      await axiosClient.post(
        `/technician/treatment-notes/${noteId}/attachments`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
    } catch (err) {
      alert(err.response?.data?.message || "Không upload được ảnh điều trị");
    } finally {
      setUploadingNoteId("");
    }
  }

  async function saveNote() {
    if (!noteContent.trim()) {
      alert("Vui lòng nhập nội dung ghi chú");
      return;
    }

    try {
      setNoteSaving(true);

      const selectedFiles = [...noteFiles];

      const res = await axiosClient.post(
        `/technician/appointments/${id}/treatment-notes`,
        {
          title: noteTitle.trim() || null,
          content: noteContent.trim(),
          noteType: "GENERAL",
          productsUsed: productsUsed.trim() || null,
          skinCondition: skinCondition.trim() || null,
          technique: technique.trim() || null,
          customerFeedback: customerFeedback.trim() || null,
          recommendation: recommendation.trim() || null,
          followUpDate: followUpDate || null,
          progressStatus,
        },
      );

      const createdNote = res.data?.data;
      const noteId =
        createdNote?.NoteId ||
        createdNote?.noteId ||
        createdNote?.id ||
        createdNote?.TreatmentNoteId;

      if (noteId && selectedFiles.length > 0) {
        await uploadNoteAttachments(noteId, selectedFiles);
      }

      resetNoteForm();
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Không lưu được ghi chú điều trị");
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <TechnicianLayout>
      <div className="tech-apd-page">
        <header className="tech-apd-topbar">
          <div>
            <button
              className="tech-apd-back"
              type="button"
              onClick={() => navigate("/technician/schedule")}
            >
              ‹ Back to Schedule
            </button>

            <h1>
              Appointment Details <span>▣</span>
            </h1>
            <p>View and manage appointment information</p>
          </div>

          <div className="tech-apd-top-actions">
            <button className="tech-apd-round" type="button">
              🔔
            </button>

            <button className="tech-apd-round" type="button">
              ▣
            </button>

            <button
              className="tech-apd-new"
              type="button"
              onClick={() => navigate("/technician/schedule")}
            >
              View Schedule
            </button>
          </div>
        </header>

        {loading ? (
          <div className="tech-apd-state">Đang tải chi tiết lịch hẹn...</div>
        ) : error ? (
          <div className="tech-apd-state tech-apd-error">{error}</div>
        ) : appointment ? (
          <>
            <section className="tech-apd-hero">
              <div className="tech-apd-hero-icon">▣</div>

              <div>
                <span>Appointment ID</span>
                <strong>
                  {detail.AppointmentCode || `#APT-${detail.AppointmentId}`}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <b className={`tech-apd-badge ${statusClass(status)}`}>
                  {status.replaceAll("_", " ")}
                </b>
              </div>

              <div>
                <span>Date & Time</span>
                <strong>{safeDate(detail.AppointmentDate)}</strong>
                <small>
                  {detail.StartTime || "—"} - {detail.EndTime || "—"}
                </small>
              </div>

              <div>
                <span>Duration</span>
                <strong>{detail.DurationMinutes || 0} minutes</strong>
              </div>

              <div>
                <span>Technician</span>
                <strong>{detail.TechnicianName || "—"}</strong>
                <small>Beauty specialist</small>
              </div>
            </section>

            <section className="tech-apd-layout">
              <main className="tech-apd-main">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    ♙ Service Information
                  </div>

                  {services.length === 0 ? (
                    <div className="tech-apd-empty">Chưa có dịch vụ</div>
                  ) : (
                    services.map((srv, index) => (
                      <article
                        className="tech-apd-service"
                        key={`${srv.ServiceId}-${index}`}
                      >
                        <img
                          src={fileUrl(srv.ImageUrl, DEFAULT_SERVICE_IMAGE)}
                          alt={srv.ServiceName || "Service"}
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_SERVICE_IMAGE;
                          }}
                        />

                        <div>
                          <h3>{srv.ServiceName}</h3>

                          <p>
                            {srv.Description ||
                              "Professional salon service for this appointment."}
                          </p>

                          <div className="tech-apd-service-meta">
                            <span>
                              ◷{" "}
                              {srv.DurationMinutes ||
                                detail.DurationMinutes ||
                                0}{" "}
                              minutes
                            </span>
                            <span>◉ {money(srv.Price)}</span>
                          </div>

                          <div className="tech-apd-tags">
                            <span>{srv.CategoryName || "Service"}</span>
                            <small>
                              {index + 1}/{services.length}
                            </small>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="tech-apd-card tech-apd-timeline-card">
                  <div className="tech-apd-card-title">
                    Appointment Timeline
                  </div>

                  <div className="tech-apd-vertical-timeline">
                    {STATUS_STEPS.map((step, index) => (
                      <div
                        className={index <= activeStepIndex ? "done" : ""}
                        key={step.key}
                      >
                        <i>{index <= activeStepIndex ? "✓" : "○"}</i>

                        <time>
                          {step.key === "IN_PROGRESS"
                            ? historyTime("IN_PROGRESS")
                              ? safeDateTime(historyTime("IN_PROGRESS"))
                              : "—"
                            : step.key === "COMPLETED"
                              ? detail.CompletedAt
                                ? safeDateTime(detail.CompletedAt)
                                : historyTime("COMPLETED")
                                  ? safeDateTime(historyTime("COMPLETED"))
                                  : "—"
                              : historyTime(step.key)
                                ? safeDateTime(historyTime(step.key))
                                : "—"}
                        </time>

                        <section>
                          <strong>{step.label}</strong>
                          <p>
                            {index <= activeStepIndex
                              ? step.key === status
                                ? "Current status"
                                : "Updated"
                              : "Pending"}
                          </p>
                        </section>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-head">
                    <div className="tech-apd-card-title">
                      Treatment Notes ({notes.length})
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("tech-add-note")?.focus()
                      }
                    >
                      ＋ Add New Note
                    </button>
                  </div>

                  <div className="tech-apd-notes-list">
                    {notes.length === 0 ? (
                      <div className="tech-apd-empty">
                        Chưa có ghi chú điều trị
                      </div>
                    ) : (
                      notes.map((note) => (
                        <article className="tech-apd-note" key={note.NoteId}>
                          <div className="tech-apd-note-avatar">
                            {initials(note.AuthorName)}
                          </div>

                          <div>
                            <h4>
                              {note.Title ||
                                note.AuthorName ||
                                "Technician note"}
                            </h4>

                            <small>
                              {note.NoteType || "GENERAL"} •{" "}
                              {safeDateTime(note.CreatedAt)}
                            </small>

                            <p>{note.Content}</p>

                            {note.SkinCondition && (
                              <p>
                                <b>Skin condition:</b> {note.SkinCondition}
                              </p>
                            )}

                            {note.Technique && (
                              <p>
                                <b>Technique:</b> {note.Technique}
                              </p>
                            )}

                            {note.ProductsUsed && (
                              <p>
                                <b>Products:</b> {note.ProductsUsed}
                              </p>
                            )}

                            {note.CustomerFeedback && (
                              <p>
                                <b>Customer feedback:</b>{" "}
                                {note.CustomerFeedback}
                              </p>
                            )}

                            {note.Recommendation && (
                              <p>
                                <b>Recommendation:</b> {note.Recommendation}
                              </p>
                            )}

                            {note.FollowUpDate && (
                              <p>
                                <b>Follow-up:</b> {safeDate(note.FollowUpDate)}
                              </p>
                            )}

                            {note.ProgressStatus && (
                              <p>
                                <b>Progress:</b>{" "}
                                {String(note.ProgressStatus).replaceAll(
                                  "_",
                                  " ",
                                )}
                              </p>
                            )}

                            {Array.isArray(note.Attachments) &&
                              note.Attachments.length > 0 && (
                                <div className="tech-apd-note-files">
                                  {note.Attachments.map((file) => (
                                    <a
                                      key={
                                        file.AttachmentId ||
                                        file.FileUrl ||
                                        file.FileName
                                      }
                                      href={fileUrl(file.FileUrl, "#")}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {file.FileName || "Attachment"}
                                    </a>
                                  ))}
                                </div>
                              )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/technician/treatment-notes?appointmentId=${detail.AppointmentId}`,
                              )
                            }
                          >
                            View Details
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </main>

              <section className="tech-apd-center">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    ♙ Appointment Status
                  </div>

                  <div className="tech-apd-steps">
                    {STATUS_STEPS.map((step, index) => (
                      <div
                        className={`${index <= activeStepIndex ? "active" : ""} ${
                          step.key === status ? "current" : ""
                        }`}
                        key={step.key}
                      >
                        <i>{step.icon}</i>
                        <span>{step.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="tech-apd-update-box">
                    <h3>Update Status</h3>
                    <p>Update the current status of this appointment</p>

                    {canStart && (
                      <button
                        className="tech-apd-action primary"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "start",
                            `/technician/appointments/${id}/start`,
                            "Bắt đầu dịch vụ này?",
                          )
                        }
                      >
                        ▶{" "}
                        {actionLoading === "start"
                          ? "Processing..."
                          : "Start Service"}
                      </button>
                    )}

                    {canComplete && (
                      <button
                        className="tech-apd-action gold"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "complete",
                            `/technician/appointments/${id}/complete`,
                            "Đánh dấu hoàn thành dịch vụ này?",
                          )
                        }
                      >
                        ✓{" "}
                        {actionLoading === "complete"
                          ? "Processing..."
                          : "Mark as Completed"}
                      </button>
                    )}

                    {canNoShow && (
                      <button
                        className="tech-apd-action danger"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "noshow",
                            `/technician/appointments/${id}/no-show`,
                            "Đánh dấu khách không đến?",
                          )
                        }
                      >
                        ⊗{" "}
                        {actionLoading === "noshow"
                          ? "Processing..."
                          : "Mark as No Show"}
                      </button>
                    )}

                    {!canStart && !canComplete && !canNoShow && (
                      <div className="tech-apd-empty">
                        Trạng thái này không còn thao tác cập nhật.
                      </div>
                    )}
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Status History</div>

                  <div className="tech-apd-history">
                    {history.length === 0 ? (
                      <div className="tech-apd-empty">
                        Chưa có lịch sử trạng thái
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={
                            item.HistoryId ||
                            `${item.NewStatus}-${item.ChangedAt}`
                          }
                        >
                          <b className={statusClass(item.NewStatus)}>
                            {String(item.NewStatus || "UPDATED").replaceAll(
                              "_",
                              " ",
                            )}
                          </b>
                          <span>{safeDateTime(item.ChangedAt)}</span>
                          <small>by {item.ChangedByName || "System"}</small>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div
                  className="tech-apd-card tech-apd-note-form-card"
                  id="note-form-card"
                >
                  <div className="tech-apd-card-title">Add Treatment Note</div>

                  <div className="tech-apd-form-section">
                    <h4>Treatment Summary</h4>

                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      placeholder="Session title..."
                    />

                    <textarea
                      id="tech-add-note"
                      rows={5}
                      value={noteContent}
                      onChange={(event) => setNoteContent(event.target.value)}
                      placeholder="Describe treatment performed, customer condition and result..."
                    />
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Treatment Details</h4>

                    <textarea
                      rows={3}
                      value={skinCondition}
                      onChange={(event) => setSkinCondition(event.target.value)}
                      placeholder="Skin / hair / nail condition..."
                    />

                    <textarea
                      rows={3}
                      value={technique}
                      onChange={(event) => setTechnique(event.target.value)}
                      placeholder="Techniques used..."
                    />

                    <textarea
                      rows={3}
                      value={productsUsed}
                      onChange={(event) => setProductsUsed(event.target.value)}
                      placeholder="Products used..."
                    />
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Follow-up & Recommendation</h4>

                    <textarea
                      rows={3}
                      value={customerFeedback}
                      onChange={(event) =>
                        setCustomerFeedback(event.target.value)
                      }
                      placeholder="Customer feedback..."
                    />

                    <textarea
                      rows={3}
                      value={recommendation}
                      onChange={(event) =>
                        setRecommendation(event.target.value)
                      }
                      placeholder="After-care recommendation..."
                    />

                    <div className="tech-apd-form-row">
                      <label>
                        <span>Follow-up date</span>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(event) =>
                            setFollowUpDate(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span>Progress status</span>
                        <select
                          value={progressStatus}
                          onChange={(event) =>
                            setProgressStatus(event.target.value)
                          }
                        >
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IMPROVED">Improved</option>
                          <option value="NEEDS_FOLLOW_UP">
                            Needs Follow Up
                          </option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Treatment Attachments</h4>

                    <label className="tech-apd-upload-box">
                      <input
                        ref={noteFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        onChange={(event) =>
                          setNoteFiles(Array.from(event.target.files || []))
                        }
                        hidden
                      />

                      <strong>📷 Upload treatment photos or PDF</strong>
                      <small>
                        Before / after images, treatment report, or consultation
                        file
                      </small>
                    </label>

                    {noteFiles.length > 0 && (
                      <div className="tech-apd-file-preview">
                        {noteFiles.map((file) => (
                          <span key={`${file.name}-${file.size}`}>
                            {file.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tech-apd-note-actions">
                    <button type="button" onClick={resetNoteForm}>
                      Clear
                    </button>

                    <button
                      type="button"
                      className="save"
                      disabled={noteSaving || !!uploadingNoteId}
                      onClick={saveNote}
                    >
                      {noteSaving || uploadingNoteId
                        ? "Saving..."
                        : "Save Note ✚"}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="tech-apd-side">
                <div className="tech-apd-card tech-apd-customer">
                  <div className="tech-apd-card-title">
                    ♡ Customer Information
                  </div>

                  <div className="tech-apd-customer-main">
                    <img
                      src={fileUrl(detail.CustomerAvatar, DEFAULT_AVATAR)}
                      alt={detail.CustomerName || "Customer"}
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div>
                      <h3>
                        {detail.CustomerName || "Customer"}{" "}
                        <span>{detail.MembershipLevel || "Member"}</span>
                      </h3>
                      <p>♧ {detail.CustomerPhone || "No phone"}</p>
                      <p>✉ {detail.CustomerEmail || "No email"}</p>
                    </div>
                  </div>

                  <button
                    className="tech-apd-outline"
                    type="button"
                    disabled={!detail.CustomerId}
                    onClick={() =>
                      navigate(
                        `/technician/customers?customerId=${detail.CustomerId}`,
                      )
                    }
                  >
                    View Profile
                  </button>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Customer Notes</div>

                  <div className="tech-apd-customer-note">
                    <b>Appointment note</b>
                    <p>
                      {detail.Notes ||
                        "Khách chưa nhập ghi chú cho lịch hẹn này."}
                    </p>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Payment Information</div>

                  <div className="tech-apd-payment-row">
                    <span>Payment Status</span>
                    <b
                      className={`tech-apd-badge ${statusClass(paymentStatus)}`}
                    >
                      {paymentStatus}
                    </b>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Total</span>
                    <strong>{money(detail.TotalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Discount</span>
                    <strong>{money(detail.DiscountAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Amount</span>
                    <strong>{money(detail.FinalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Payment Method</span>
                    <strong>{detail.PaymentMethod || "—"}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Transaction</span>
                    <strong>{detail.TransactionCode || "—"}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Paid On</span>
                    <strong>{safeDateTime(detail.PaidAt)}</strong>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Quick Actions</div>

                  <div className="tech-apd-quick-list">
                    <button
                      type="button"
                      disabled={!detail.CustomerId}
                      onClick={() =>
                        navigate(
                          `/technician/customers?customerId=${detail.CustomerId}`,
                        )
                      }
                    >
                      ▣ View Customer History <span>›</span>
                    </button>

                    <button
                      type="button"
                      disabled={!detail.CustomerId}
                      onClick={() =>
                        navigate(
                          `/technician/customers?customerId=${detail.CustomerId}`,
                        )
                      }
                    >
                      ♙ Customer Profile <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/technician/treatment-notes?appointmentId=${detail.AppointmentId}`,
                        )
                      }
                    >
                      ✎ Treatment Notes <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/technician/schedule")}
                    >
                      ♧ Back to Schedule <span>›</span>
                    </button>
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <div className="tech-apd-state">Không tìm thấy lịch hẹn.</div>
        )}
      </div>
    </TechnicianLayout>
  );
}
