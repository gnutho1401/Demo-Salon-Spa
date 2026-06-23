import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";
const DEFAULT_SERVICE_IMAGE = "/images/default-service.png";

const STATUS_STEPS = [
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán", icon: "▣" },
  { key: "PAID", label: "Đã thanh toán", icon: "💳" },
  { key: "CONFIRMED", label: "Đã xác nhận", icon: "✓" },
  { key: "CHECKED_IN", label: "Đã check-in", icon: "◇" },
  { key: "IN_PROGRESS", label: "Đang thực hiện", icon: "▶" },
  { key: "COMPLETED", label: "Hoàn thành", icon: "✓" },
  { key: "NO_SHOW", label: "Khách không đến", icon: "⊗" },
];

const STATUS_LABELS = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  NO_SHOW: "Khách không đến",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  UNPAID: "Chưa thanh toán",
};

const PROGRESS_LABELS = {
  IN_PROGRESS: "Đang theo dõi",
  IMPROVED: "Đã cải thiện",
  NEEDS_FOLLOW_UP: "Cần theo dõi lại",
  COMPLETED: "Hoàn thành",
};

const MEMBERSHIP_MAP = {
  Normal: "Thành viên Thường",
  Silver: "Thành viên Bạc",
  Gold: "Thành viên Vàng",
  Diamond: "Thành viên Kim cương",
  Platinum: "Thành viên Bạch kim",
};

function getMembershipLabel(level) {
  return MEMBERSHIP_MAP[level] || level || "Thành viên Thường";
}

const PAYMENT_METHOD_MAP = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  VNPAY: "Ví VNPAY",
  MOMO: "Ví Momo",
  PAYOS: "Cổng PayOS",
};

function getPaymentMethodLabel(method) {
  return PAYMENT_METHOD_MAP[String(method).toUpperCase()] || method || "—";
}

const translateNoteType = (type) => {
  const map = {
    'GENERAL': 'Ghi chú chung',
    'TREATMENT': 'Ghi chú trị liệu',
    'PRESCRIPTION': 'Phác đồ điều trị',
    'FOLLOWUP': 'Theo dõi',
  };
  return map[String(type).toUpperCase()] || type;
};

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

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
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

function statusLabel(status) {
  const key = String(status || "").toUpperCase();
  return STATUS_LABELS[key] || key.replaceAll("_", " ") || "—";
}

function progressLabel(status) {
  const key = String(status || "").toUpperCase();
  return PROGRESS_LABELS[key] || key.replaceAll("_", " ") || "—";
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

  const canStart = ["CHECKED_IN", "CONFIRMED", "PAID"].includes(status);
  const canComplete = status === "IN_PROGRESS";
  const canNoShow = ["CONFIRMED", "CHECKED_IN", "PAID"].includes(status);

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
      alert(
        err.response?.data?.message ||
          "Không tải lên được hình ảnh hoặc tài liệu điều trị",
      );
    } finally {
      setUploadingNoteId("");
    }
  }

  async function saveNote() {
    if (!noteContent.trim()) {
      alert("Vui lòng nhập nội dung ghi chú dịch vụ");
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
      alert(err.response?.data?.message || "Không lưu được ghi chú dịch vụ");
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
              ‹ Quay lại lịch làm việc
            </button>

            <h1>
              Chi tiết lịch hẹn <span>▣</span>
            </h1>
            <p>Xem và quản lý thông tin lịch hẹn được phân công</p>
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
              Xem lịch làm việc
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
                <span>Mã lịch hẹn</span>
                <strong>
                  {detail.AppointmentCode || `#APT-${detail.AppointmentId}`}
                </strong>
              </div>

              <div>
                <span>Trạng thái</span>
                <b className={`tech-apd-badge ${statusClass(status)}`}>
                  {statusLabel(status)}
                </b>
              </div>

              <div>
                <span>Ngày & giờ</span>
                <strong>{safeDate(detail.AppointmentDate)}</strong>
                <small>
                  {detail.StartTime || "—"} - {detail.EndTime || "—"}
                </small>
              </div>

              <div>
                <span>Thời lượng</span>
                <strong>{detail.DurationMinutes || 0} phút</strong>
              </div>

              <div>
                <span>Kỹ thuật viên</span>
                <strong>{detail.TechnicianName || "—"}</strong>
                <small>Chuyên viên làm đẹp</small>
              </div>
            </section>

            <section className="tech-apd-layout">
              <main className="tech-apd-main">
                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">♙ Thông tin dịch vụ</div>

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
                          alt={srv.ServiceName || "Dịch vụ"}
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_SERVICE_IMAGE;
                          }}
                        />

                        <div>
                          <h3>{srv.ServiceName}</h3>

                          <p>
                            {srv.Description ||
                              "Dịch vụ chăm sóc chuyên nghiệp tại salon."}
                          </p>

                          <div className="tech-apd-service-meta">
                            <span>
                              ◷{" "}
                              {srv.DurationMinutes ||
                                detail.DurationMinutes ||
                                0}{" "}
                              phút
                            </span>
                            <span>◉ {money(srv.Price)}</span>
                          </div>

                          <div className="tech-apd-tags">
                            <span>{srv.CategoryName || "Dịch vụ"}</span>
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
                  <div className="tech-apd-card-title">Tiến trình lịch hẹn</div>

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
                                ? "Trạng thái hiện tại"
                                : "Đã cập nhật"
                              : "Đang chờ"}
                          </p>
                        </section>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-head">
                    <div className="tech-apd-card-title">
                      Ghi chú dịch vụ ({notes.length})
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("tech-add-note")?.focus()
                      }
                    >
                      ＋ Thêm ghi chú mới
                    </button>
                  </div>

                  <div className="tech-apd-notes-list">
                    {notes.length === 0 ? (
                      <div className="tech-apd-empty">
                        Chưa có ghi chú dịch vụ
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
                                "Ghi chú của kỹ thuật viên"}
                            </h4>

                            <small>
                              {translateNoteType(note.NoteType || "GENERAL")} •{" "}
                              {safeDateTime(note.CreatedAt)}
                            </small>

                            <p>{note.Content}</p>

                            {note.SkinCondition && (
                              <p>
                                <b>Tình trạng da / tóc / móng:</b>{" "}
                                {note.SkinCondition}
                              </p>
                            )}

                            {note.Technique && (
                              <p>
                                <b>Kỹ thuật đã áp dụng:</b> {note.Technique}
                              </p>
                            )}

                            {note.ProductsUsed && (
                              <p>
                                <b>Sản phẩm đã sử dụng:</b> {note.ProductsUsed}
                              </p>
                            )}

                            {note.CustomerFeedback && (
                              <p>
                                <b>Phản hồi của khách hàng:</b>{" "}
                                {note.CustomerFeedback}
                              </p>
                            )}

                            {note.Recommendation && (
                              <p>
                                <b>Khuyến nghị sau dịch vụ:</b>{" "}
                                {note.Recommendation}
                              </p>
                            )}

                            {note.FollowUpDate && (
                              <p>
                                <b>Ngày theo dõi lại:</b>{" "}
                                {safeDate(note.FollowUpDate)}
                              </p>
                            )}

                            {note.ProgressStatus && (
                              <p>
                                <b>Tình trạng tiến triển:</b>{" "}
                                {progressLabel(note.ProgressStatus)}
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
                                      {file.FileName || "Tệp đính kèm"}
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
                            Xem chi tiết
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
                    ♙ Trạng thái lịch hẹn
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
                    <h3>Cập nhật trạng thái</h3>
                    <p>Cập nhật trạng thái hiện tại của lịch hẹn này</p>

                    {canStart && (
                      <button
                        className="tech-apd-action primary"
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() =>
                          runAction(
                            "start",
                            `/technician/appointments/${id}/start`,
                            "Bạn có chắc muốn bắt đầu thực hiện dịch vụ này?",
                          )
                        }
                      >
                        ▶{" "}
                        {actionLoading === "start"
                          ? "Đang xử lý..."
                          : "Bắt đầu dịch vụ"}
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
                            "Bạn có chắc muốn đánh dấu hoàn thành dịch vụ này?",
                          )
                        }
                      >
                        ✓{" "}
                        {actionLoading === "complete"
                          ? "Đang xử lý..."
                          : "Đánh dấu hoàn thành"}
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
                            "Bạn có chắc muốn đánh dấu khách không đến?",
                          )
                        }
                      >
                        ⊗{" "}
                        {actionLoading === "noshow"
                          ? "Đang xử lý..."
                          : "Khách không đến"}
                      </button>
                    )}

                    {!canStart && !canComplete && !canNoShow && (
                      <div className="tech-apd-empty">
                        Trạng thái này hiện không còn thao tác cập nhật.
                      </div>
                    )}
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Lịch sử trạng thái</div>

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
                            {statusLabel(item.NewStatus)}
                          </b>
                          <span>{safeDateTime(item.ChangedAt)}</span>
                          <small>bởi {item.ChangedByName || "Hệ thống"}</small>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div
                  className="tech-apd-card tech-apd-note-form-card"
                  id="note-form-card"
                >
                  <div className="tech-apd-card-title">
                    Thêm ghi chú dịch vụ
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Tóm tắt buổi dịch vụ</h4>

                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      placeholder="Tiêu đề buổi dịch vụ..."
                    />

                    <textarea
                      id="tech-add-note"
                      rows={5}
                      value={noteContent}
                      onChange={(event) => setNoteContent(event.target.value)}
                      placeholder="Mô tả dịch vụ đã thực hiện, tình trạng khách hàng và kết quả đạt được..."
                    />
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Chi tiết thực hiện</h4>

                    <textarea
                      rows={3}
                      value={skinCondition}
                      onChange={(event) => setSkinCondition(event.target.value)}
                      placeholder="Tình trạng da / tóc / móng của khách hàng..."
                    />

                    <textarea
                      rows={3}
                      value={technique}
                      onChange={(event) => setTechnique(event.target.value)}
                      placeholder="Kỹ thuật đã áp dụng..."
                    />

                    <textarea
                      rows={3}
                      value={productsUsed}
                      onChange={(event) => setProductsUsed(event.target.value)}
                      placeholder="Sản phẩm đã sử dụng..."
                    />
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Khuyến nghị & chăm sóc sau dịch vụ</h4>

                    <textarea
                      rows={3}
                      value={customerFeedback}
                      onChange={(event) =>
                        setCustomerFeedback(event.target.value)
                      }
                      placeholder="Phản hồi của khách hàng..."
                    />

                    <textarea
                      rows={3}
                      value={recommendation}
                      onChange={(event) =>
                        setRecommendation(event.target.value)
                      }
                      placeholder="Hướng dẫn chăm sóc sau dịch vụ..."
                    />

                    <div className="tech-apd-form-row">
                      <label>
                        <span>Ngày theo dõi lại</span>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(event) =>
                            setFollowUpDate(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span>Tình trạng tiến triển</span>
                        <select
                          value={progressStatus}
                          onChange={(event) =>
                            setProgressStatus(event.target.value)
                          }
                        >
                          <option value="IN_PROGRESS">Đang theo dõi</option>
                          <option value="IMPROVED">Đã cải thiện</option>
                          <option value="NEEDS_FOLLOW_UP">
                            Cần theo dõi lại
                          </option>
                          <option value="COMPLETED">Hoàn thành</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="tech-apd-form-section">
                    <h4>Tệp đính kèm</h4>

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

                      <strong>📷 Tải lên hình ảnh điều trị hoặc tệp PDF</strong>
                      <small>
                        Ảnh trước / sau dịch vụ, báo cáo điều trị hoặc tài liệu
                        tư vấn
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
                      Xóa nội dung
                    </button>

                    <button
                      type="button"
                      className="save"
                      disabled={noteSaving || !!uploadingNoteId}
                      onClick={saveNote}
                    >
                      {noteSaving || uploadingNoteId
                        ? "Đang lưu..."
                        : "Lưu ghi chú ✚"}
                    </button>
                  </div>
                </div>
              </section>

              <aside className="tech-apd-side">
                <div className="tech-apd-card tech-apd-customer">
                  <div className="tech-apd-card-title">
                    ♡ Thông tin khách hàng
                  </div>

                  <div className="tech-apd-customer-main">
                    <img
                      src={fileUrl(detail.CustomerAvatar, DEFAULT_AVATAR)}
                      alt={detail.CustomerName || "Khách hàng"}
                      onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div>
                      <h3>
                        {detail.CustomerName || "Khách hàng"}{" "}
                        <span>{getMembershipLabel(detail.MembershipLevel)}</span>
                      </h3>
                      <p>♧ {detail.CustomerPhone || "Chưa có số điện thoại"}</p>
                      <p>✉ {detail.CustomerEmail || "Chưa có email"}</p>
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
                    Xem hồ sơ khách hàng
                  </button>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    Ghi chú của khách hàng
                  </div>

                  <div className="tech-apd-customer-note">
                    <b>Ghi chú lịch hẹn</b>
                    <p>
                      {detail.Notes ||
                        "Khách chưa nhập ghi chú cho lịch hẹn này."}
                    </p>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">
                    Thông tin thanh toán
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Trạng thái thanh toán</span>
                    <b
                      className={`tech-apd-badge ${statusClass(paymentStatus)}`}
                    >
                      {statusLabel(paymentStatus)}
                    </b>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Tổng tiền</span>
                    <strong>{money(detail.TotalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Giảm giá</span>
                    <strong>{money(detail.DiscountAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Thành tiền</span>
                    <strong>{money(detail.FinalAmount)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Phương thức thanh toán</span>
                    <strong>{getPaymentMethodLabel(detail.PaymentMethod)}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Mã giao dịch</span>
                    <strong>{detail.TransactionCode || "—"}</strong>
                  </div>

                  <div className="tech-apd-payment-row">
                    <span>Ngày thanh toán</span>
                    <strong>{safeDateTime(detail.PaidAt)}</strong>
                  </div>
                </div>

                <div className="tech-apd-card">
                  <div className="tech-apd-card-title">Thao tác nhanh</div>

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
                      ▣ Xem lịch sử khách hàng <span>›</span>
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
                      ♙ Hồ sơ khách hàng <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/technician/treatment-notes?appointmentId=${detail.AppointmentId}`,
                        )
                      }
                    >
                      ✎ Ghi chú dịch vụ <span>›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/technician/schedule")}
                    >
                      ♧ Quay lại lịch làm việc <span>›</span>
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
