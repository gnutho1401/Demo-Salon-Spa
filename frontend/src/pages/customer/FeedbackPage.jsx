import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function formatDateTime(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusText(status) {
  const map = {
    PENDING: "Đang chờ xử lý",
    PROCESSING: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Từ chối",
  };

  return map[status] || status || "Đang chờ xử lý";
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [form, setForm] = useState({
    subject: "",
    content: "",
  });

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/customers/me/feedbacks");
      setFeedbacks(res.data?.data || res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được danh sách phản hồi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  const summary = useMemo(() => {
    return {
      total: feedbacks.length,
      pending: feedbacks.filter((x) => x.Status === "PENDING").length,
      processing: feedbacks.filter((x) => x.Status === "PROCESSING").length,
      resolved: feedbacks.filter((x) => x.Status === "RESOLVED").length,
      replied: feedbacks.filter((x) => x.AdminResponse).length,
    };
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      const matchStatus =
        statusFilter === "ALL" ||
        String(item.Status || "PENDING") === statusFilter;

      const text = `${item.Subject || ""} ${item.Content || ""} ${
        item.AdminResponse || ""
      }`.toLowerCase();

      const matchKeyword = text.includes(keyword.trim().toLowerCase());

      return matchStatus && matchKeyword;
    });
  }, [feedbacks, statusFilter, keyword]);

  async function submitFeedback(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    const subject = form.subject.trim();
    const content = form.content.trim();

    if (!subject || !content) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung phản hồi.");
      return;
    }

    if (subject.length < 5) {
      setError("Tiêu đề phản hồi phải có ít nhất 5 ký tự.");
      return;
    }

    if (content.length < 10) {
      setError("Nội dung phản hồi phải có ít nhất 10 ký tự.");
      return;
    }

    try {
      setSubmitting(true);

      await axiosClient.post("/customers/me/feedbacks", {
        subject,
        content,
      });

      setMessage("Gửi phản hồi thành công.");
      setForm({ subject: "", content: "" });

      await loadFeedbacks();
    } catch (err) {
      setError(err.response?.data?.message || "Gửi phản hồi thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerLayout>
      <div className="crf-page">
        <section className="crf-hero feedback">
          <div>
            <span className="crf-kicker">CUSTOMER FEEDBACK</span>
            <h1>Phản hồi & hỗ trợ</h1>
            <p>
              Gửi góp ý, báo lỗi, khiếu nại hoặc yêu cầu hỗ trợ cho salon. Phần
              này khác với đánh giá dịch vụ sau lịch hẹn.
            </p>
            <div className="crf-hero-actions">
              <Link to="/customer/reviews">Đánh giá dịch vụ</Link>
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({ top: 420, behavior: "smooth" })
                }
              >
                Gửi phản hồi
              </button>
            </div>
          </div>

          <div className="crf-hero-score">
            <strong>{summary.total}</strong>
            <span>phản hồi đã gửi</span>
            <small>{summary.replied} phản hồi đã được salon trả lời</small>
          </div>
        </section>

        {message && <div className="crf-alert success">{message}</div>}
        {error && <div className="crf-alert error">{error}</div>}

        <section className="crf-stats">
          <div>
            <span>Tổng phản hồi</span>
            <b>{summary.total}</b>
          </div>
          <div>
            <span>Đang chờ</span>
            <b>{summary.pending}</b>
          </div>
          <div>
            <span>Đang xử lý</span>
            <b>{summary.processing}</b>
          </div>
          <div>
            <span>Đã giải quyết</span>
            <b>{summary.resolved}</b>
          </div>
          <div>
            <span>Đã trả lời</span>
            <b>{summary.replied}</b>
          </div>
        </section>

        <section className="crf-grid">
          <form className="crf-form-card" onSubmit={submitFeedback}>
            <div className="crf-section-title">
              <span>01</span>
              <div>
                <h2>Gửi phản hồi mới</h2>
                <p>Salon sẽ tiếp nhận và phản hồi trong thời gian sớm nhất.</p>
              </div>
            </div>

            <label>
              Tiêu đề phản hồi
              <input
                value={form.subject}
                maxLength={200}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subject: e.target.value,
                  })
                }
                placeholder="Ví dụ: Không nhận được thông báo đặt lịch"
              />
              <small>{form.subject.length}/200 ký tự</small>
            </label>

            <label>
              Nội dung phản hồi
              <textarea
                rows="7"
                value={form.content}
                onChange={(e) =>
                  setForm({
                    ...form,
                    content: e.target.value,
                  })
                }
                placeholder="Nhập nội dung góp ý, khiếu nại hoặc lỗi bạn gặp phải..."
              />
              <small>{form.content.length} ký tự</small>
            </label>

            <button className="crf-primary" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </form>

          <aside className="crf-side-card">
            <h3>Phản hồi dùng để làm gì?</h3>

            <div className="crf-guide-list">
              <div>
                <b>01</b>
                <p>
                  <strong>Góp ý dịch vụ</strong>Đề xuất salon cải thiện trải
                  nghiệm.
                </p>
              </div>
              <div>
                <b>02</b>
                <p>
                  <strong>Báo lỗi hệ thống</strong>Lỗi đặt lịch, thanh toán, tài
                  khoản.
                </p>
              </div>
              <div>
                <b>03</b>
                <p>
                  <strong>Khiếu nại</strong>Vấn đề cần salon kiểm tra và xử lý.
                </p>
              </div>
              <div>
                <b>04</b>
                <p>
                  <strong>Hỗ trợ khác</strong>Câu hỏi hoặc yêu cầu hỗ trợ từ
                  khách.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="crf-list-card">
          <div className="crf-section-title">
            <span>02</span>
            <div>
              <h2>Lịch sử phản hồi</h2>
              <p>Theo dõi trạng thái xử lý và phản hồi từ salon.</p>
            </div>
          </div>

          <div className="crf-toolbar">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tiêu đề, nội dung, phản hồi salon..."
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Đang chờ xử lý</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>

          {loading ? (
            <div className="crf-empty">Đang tải dữ liệu phản hồi...</div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="crf-empty">Chưa có phản hồi phù hợp.</div>
          ) : (
            <div className="crf-feedback-list">
              {filteredFeedbacks.map((item) => (
                <article className="crf-feedback-card" key={item.FeedbackId}>
                  <div className="crf-feedback-top">
                    <div>
                      <h3>{item.Subject || "Không có tiêu đề"}</h3>
                      <p>Gửi ngày {formatDateTime(item.CreatedAt)}</p>
                    </div>

                    <span
                      className={`crf-status ${String(
                        item.Status || "PENDING",
                      ).toLowerCase()}`}
                    >
                      {statusText(item.Status)}
                    </span>
                  </div>

                  <p className="crf-comment">{item.Content}</p>

                  {item.AdminResponse ? (
                    <div className="crf-admin-box">
                      <strong>Phản hồi từ salon</strong>
                      <p>{item.AdminResponse}</p>
                    </div>
                  ) : (
                    <div className="crf-waiting-box">
                      Salon chưa phản hồi. Vui lòng theo dõi trạng thái xử lý.
                    </div>
                  )}

                  <div className="crf-card-footer">
                    <span>Mã phản hồi #{item.FeedbackId}</span>
                    <span>
                      Cập nhật{" "}
                      {formatDateTime(item.UpdatedAt || item.CreatedAt)}
                    </span>
                    <button type="button" onClick={() => setDetail(item)}>
                      Xem chi tiết
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {detail && (
          <div className="crf-modal-backdrop" onClick={() => setDetail(null)}>
            <div className="crf-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="crf-modal-close"
                onClick={() => setDetail(null)}
              >
                ×
              </button>

              <h2>Chi tiết phản hồi</h2>

              <div className="crf-modal-main">
                <h3>{detail.Subject}</h3>
                <p>{detail.Content}</p>
              </div>

              <div className="crf-modal-grid">
                <div>
                  <span>Mã phản hồi</span>
                  <b>#{detail.FeedbackId}</b>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <b>{statusText(detail.Status)}</b>
                </div>
                <div>
                  <span>Ngày gửi</span>
                  <b>{formatDateTime(detail.CreatedAt)}</b>
                </div>
                <div>
                  <span>Cập nhật</span>
                  <b>{formatDateTime(detail.UpdatedAt || detail.CreatedAt)}</b>
                </div>
              </div>

              {detail.AdminResponse && (
                <div className="crf-admin-box">
                  <strong>Phản hồi từ salon</strong>
                  <p>{detail.AdminResponse}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
