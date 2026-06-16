import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function formatDate(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axiosClient.get("/customers/me/feedbacks");
      setFeedbacks(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được danh sách phản hồi",
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
    };
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      const matchStatus =
        statusFilter === "ALL" || String(item.Status || "") === statusFilter;

      const text = `${item.Subject || ""} ${item.Content || ""} ${
        item.AdminResponse || ""
      }`.toLowerCase();

      const matchKeyword = text.includes(keyword.trim().toLowerCase());

      return matchStatus && matchKeyword;
    });
  }, [feedbacks, statusFilter, keyword]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const subject = form.subject.trim();
    const content = form.content.trim();

    if (!subject || !content) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung phản hồi");
      return;
    }

    if (subject.length < 5) {
      setError("Tiêu đề phản hồi phải có ít nhất 5 ký tự");
      return;
    }

    if (content.length < 10) {
      setError("Nội dung phản hồi phải có ít nhất 10 ký tự");
      return;
    }

    try {
      await axiosClient.post("/customers/me/feedbacks", {
        subject,
        content,
      });

      setMessage("Gửi phản hồi thành công");
      setForm({
        subject: "",
        content: "",
      });

      await loadFeedbacks();
    } catch (err) {
      setError(err.response?.data?.message || "Gửi phản hồi thất bại");
    }
  };

  return (
    <CustomerLayout>
      <div className="review-feedback-hero">
        <div>
          <div className="eyebrow">Customer Support</div>
          <h2>Phản hồi / Khiếu nại</h2>
          <p>
            Dùng để gửi góp ý, báo lỗi hệ thống, khiếu nại hoặc yêu cầu hỗ trợ
            từ salon.
          </p>
        </div>
        <div className="review-feedback-hero-badge">
          <strong>{summary.total}</strong>
          <span>phản hồi đã gửi</span>
        </div>
      </div>

      {loading && <p className="muted">Đang tải dữ liệu...</p>}
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="rf-stats">
        <div className="rf-stat-card">
          <span>Tổng phản hồi</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="rf-stat-card">
          <span>Đang chờ</span>
          <strong>{summary.pending}</strong>
        </div>
        <div className="rf-stat-card">
          <span>Đang xử lý</span>
          <strong>{summary.processing}</strong>
        </div>
        <div className="rf-stat-card">
          <span>Đã giải quyết</span>
          <strong>{summary.resolved}</strong>
        </div>
      </div>

      <div className="rf-layout">
        <form
          className="dashboard-card profile-form rf-form-card"
          onSubmit={submitFeedback}
        >
          <h3>Gửi phản hồi mới</h3>
          <p className="muted">
            Phần này không dùng để đánh giá dịch vụ. Nếu muốn chấm sao dịch vụ,
            hãy vào mục Đánh giá dịch vụ.
          </p>

          <div className="form-group">
            <label>Tiêu đề</label>
            <input
              value={form.subject}
              onChange={(e) =>
                setForm({
                  ...form,
                  subject: e.target.value,
                })
              }
              placeholder="Ví dụ: Không nhận được thông báo đặt lịch"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label>Nội dung phản hồi</label>
            <textarea
              value={form.content}
              onChange={(e) =>
                setForm({
                  ...form,
                  content: e.target.value,
                })
              }
              placeholder="Nhập nội dung góp ý, khiếu nại hoặc lỗi bạn gặp phải..."
              rows={7}
            />
          </div>

          <button className="btn" type="submit">
            Gửi phản hồi
          </button>
        </form>

        <div className="dashboard-card rf-list-card">
          <div className="rf-card-head">
            <div>
              <h3>Danh sách phản hồi</h3>
              <p className="muted">Theo dõi trạng thái xử lý từ salon.</p>
            </div>
          </div>

          <div className="rf-toolbar">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tiêu đề, nội dung..."
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

          {filteredFeedbacks.length === 0 ? (
            <div className="rf-empty">
              <strong>Chưa có phản hồi phù hợp</strong>
              <span>Hãy gửi phản hồi mới nếu bạn cần salon hỗ trợ.</span>
            </div>
          ) : (
            <div className="rf-list">
              {filteredFeedbacks.map((item) => (
                <div className="rf-item" key={item.FeedbackId}>
                  <div className="rf-item-top">
                    <div>
                      <strong>{item.Subject || "Không có tiêu đề"}</strong>
                      <span>Gửi ngày {formatDate(item.CreatedAt)}</span>
                    </div>
                    <span
                      className={`rf-status ${String(item.Status || "PENDING").toLowerCase()}`}
                    >
                      {statusText(item.Status)}
                    </span>
                  </div>

                  <p>{item.Content}</p>

                  {item.AdminResponse && (
                    <div className="rf-admin-response">
                      <strong>Phản hồi từ salon</strong>
                      <span>{item.AdminResponse}</span>
                    </div>
                  )}

                  <div className="rf-meta">
                    <span>Mã phản hồi: #{item.FeedbackId}</span>
                    <span>
                      Cập nhật: {formatDate(item.UpdatedAt || item.CreatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
