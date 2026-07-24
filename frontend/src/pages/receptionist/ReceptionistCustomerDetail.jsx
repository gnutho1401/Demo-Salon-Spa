import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function date(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function translateStatus(status) {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    COMPLETED: "Đã hoàn thành",
    CHECKED_IN: "Đã check-in",
    PENDING_PAYMENT: "Chờ thanh toán",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
    REFUNDED: "Đã hoàn tiền",
    ACTIVE: "Đang hoạt động",
    EXPIRED: "Hết hạn",
  };
  return map[s] || status || "-";
}

function statusClass(status) {
  return `rcc-badge status-${String(status || "").toLowerCase()}`;
}

export default function ReceptionistCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [tab, setTab] = useState("appointments");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    FullName: "",
    Phone: "",
    Email: "",
    Gender: "",
    DateOfBirth: "",
    Address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [treatmentNotes, setTreatmentNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get(`/receptionist/customers/${id}`);
      const data = res.data?.data || res.data;
      setItem(data);

      const p = data?.Profile || {};
      setForm({
        FullName: p.FullName || "",
        Phone: p.Phone || "",
        Email: p.Email || "",
        Gender: p.Gender || "",
        DateOfBirth: p.DateOfBirth ? String(p.DateOfBirth).slice(0, 10) : "",
        Address: p.Address || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không tải được chi tiết khách hàng từ hệ thống",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function loadTreatmentNotes() {
    try {
      setNotesLoading(true);
      const res = await axiosClient.get(`/v2/treatment-notes/customers/${id}`);
      setTreatmentNotes(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to load treatment notes:", err);
    } finally {
      setNotesLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "treatment-notes") {
      loadTreatmentNotes();
    }
  }, [tab, id]);

  const profile = item?.Profile || {};
  const summary = item?.Summary || {};

  const sortedAppointments = useMemo(() => {
    return [...(item?.Appointments || [])].sort((a, b) => {
      const dateA = new Date(
        `${a.AppointmentDate || ""} ${a.StartTime || "00:00"}`,
      );
      const dateB = new Date(
        `${b.AppointmentDate || ""} ${b.StartTime || "00:00"}`,
      );
      return dateB - dateA || (b.AppointmentId || 0) - (a.AppointmentId || 0);
    });
  }, [item]);

  const sortedInvoices = useMemo(() => {
    return [...(item?.Invoices || [])].sort((a, b) => {
      return (
        new Date(b.CreatedAt || b.AppointmentDate || 0) -
          new Date(a.CreatedAt || a.AppointmentDate || 0) ||
        (b.InvoiceId || 0) - (a.InvoiceId || 0)
      );
    });
  }, [item]);

  const sortedPayments = useMemo(() => {
    return [...(item?.Payments || [])].sort((a, b) => {
      return (
        new Date(b.PaidAt || b.CreatedAt || 0) -
          new Date(a.PaidAt || a.CreatedAt || 0) ||
        (b.PaymentId || 0) - (a.PaymentId || 0)
      );
    });
  }, [item]);

  const sortedReviews = useMemo(() => {
    return [...(item?.Reviews || [])].sort((a, b) => {
      return (
        new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0) ||
        (b.ReviewId || 0) - (a.ReviewId || 0)
      );
    });
  }, [item]);

  const sortedFeedbacks = useMemo(() => {
    return [...(item?.Feedbacks || [])].sort((a, b) => {
      return (
        new Date(b.UpdatedAt || b.CreatedAt || 0) -
          new Date(a.UpdatedAt || a.CreatedAt || 0) ||
        (b.FeedbackId || 0) - (a.FeedbackId || 0)
      );
    });
  }, [item]);

  const sortedPackages = useMemo(() => {
    return [...(item?.Packages || [])].sort((a, b) => {
      return (
        new Date(b.CreatedAt || b.StartDate || 0) -
          new Date(a.CreatedAt || a.StartDate || 0) ||
        (b.CustomerPackageId || 0) - (a.CustomerPackageId || 0)
      );
    });
  }, [item]);

  const stats = useMemo(() => {
    return {
      appointments: item?.Appointments?.length || 0,
      invoices: item?.Invoices?.length || 0,
      payments: item?.Payments?.length || 0,
      reviews: item?.Reviews?.length || 0,
      packages: item?.Packages?.length || 0,
    };
  }, [item]);

  async function saveProfile() {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.put(`/receptionist/customers/${id}`, form);
      await load();

      setEditMode(false);
      setSuccessMsg("Cập nhật thông tin hồ sơ khách hàng thành công!");
    } catch (err) {
      setError(err.response?.data?.message || "Cập nhật thông tin thất bại");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    ["appointments", "Lịch hẹn dịch vụ"],
    ["invoices", "Hóa đơn thanh toán"],
    ["payments", "Lịch sử giao dịch"],
    ["reviews", "Đánh giá chất lượng"],
    ["feedbacks", "Ý kiến phản hồi"],
    ["packages", "Gói liệu trình đã mua"],
    ["treatment-notes", "Hồ sơ trị liệu"],
  ];

  return (
    <ReceptionistLayout>
      <div className="rcc-page">
        <div className="rcc-header">
          <div>
            <h1>Chi tiết hồ sơ khách hàng #{id}</h1>
            <p>
              Xem chi tiết hồ sơ cá nhân, lịch sử sử dụng dịch vụ, hóa đơn giao
              dịch và gói liệu trình.
            </p>
          </div>

          <div className="rcc-header-actions">
            <button
              className="rcc-light-btn"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Quay lại danh sách
            </button>
            <button className="rcc-primary-btn" type="button" onClick={load}>
              Làm mới dữ liệu
            </button>
          </div>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {successMsg && <div className="rcc-alert success">{successMsg}</div>}

        {loading && (
          <div className="rcc-table-card rcc-empty">
            Đang tải dữ liệu hồ sơ chi tiết khách hàng...
          </div>
        )}

        {!loading && !item && (
          <div className="rcc-table-card rcc-empty">
            Không tìm thấy thông tin khách hàng này trên hệ thống.
          </div>
        )}

        {!loading && item && (
          <>
            <div className="rcc-customer-hero">
              <div className="rcc-customer-profile-card">
                <img
                  className="rcc-customer-avatar"
                  src={avatarUrl(item.Profile?.AvatarUrl)}
                  alt={item.Profile?.FullName || "Customer"}
                />

                <div>
                  <h2>{profile.FullName || "-"}</h2>
                  <p>
                    ☎ {profile.Phone || "-"} · ✉ {profile.Email || "-"}
                  </p>

                  <div className="rcc-profile-tags">
                    <span
                      className={`rcc-badge ${String(item.Membership?.MembershipLevel || "Standard").toLowerCase() !== "standard" ? "green" : ""}`}
                    >
                      Hạng: {item.Membership?.MembershipLevel || "Standard"}
                    </span>
                    <span className="rcc-badge green">
                      Tích lũy: {item.Membership?.Points || 0} điểm
                    </span>
                  </div>
                </div>
              </div>

              <div className="rcc-stat-card pink">
                <span>📅</span>
                <div>
                  <p>Tổng lịch hẹn</p>
                  <b>{summary.TotalAppointments || stats.appointments} lượt</b>
                </div>
              </div>

              <div className="rcc-stat-card gold">
                <span>💰</span>
                <div>
                  <p>Tích lũy chi tiêu</p>
                  <b>{money(summary.TotalSpent)}</b>
                </div>
              </div>

              <div className="rcc-stat-card green">
                <span>⭐</span>
                <div>
                  <p>Số lần đánh giá</p>
                  <b>{stats.reviews} đánh giá</b>
                </div>
              </div>
            </div>

            <div className="rcc-detail-grid">
              <section className="rcc-detail-card">
                <div className="rcc-card-head">
                  <div>
                    <h2>Thông tin cá nhân khách hàng</h2>
                    <p>Hồ sơ lưu trữ cơ bản tại quầy</p>
                  </div>

                  {!editMode && (
                    <button
                      className="rcc-light-btn"
                      type="button"
                      onClick={() => setEditMode(true)}
                    >
                      Chỉnh sửa
                    </button>
                  )}
                </div>

                {!editMode ? (
                  <div className="rcc-info-list">
                    <div>
                      <span>Họ và tên khách</span>
                      <b>{profile.FullName || "-"}</b>
                    </div>
                    <div>
                      <span>Số điện thoại</span>
                      <b>{profile.Phone || "-"}</b>
                    </div>
                    <div>
                      <span>Địa chỉ Email</span>
                      <b>{profile.Email || "-"}</b>
                    </div>
                    <div>
                      <span>Giới tính</span>
                      <b>
                        {profile.Gender === "Male"
                          ? "Nam"
                          : profile.Gender === "Female"
                            ? "Nữ"
                            : "Khác"}
                      </b>
                    </div>
                    <div>
                      <span>Ngày sinh nhật</span>
                      <b>{date(profile.DateOfBirth)}</b>
                    </div>
                    <div>
                      <span>Địa chỉ thường trú</span>
                      <b>{profile.Address || "-"}</b>
                    </div>
                    <div>
                      <span>Ngày lập tài khoản</span>
                      <b>{date(profile.CreatedAt)}</b>
                    </div>
                  </div>
                ) : (
                  <div className="rcc-edit-form">
                    <input
                      placeholder="Họ và tên đầy đủ..."
                      value={form.FullName}
                      onChange={(e) =>
                        setForm({ ...form, FullName: e.target.value })
                      }
                    />
                    <input
                      placeholder="Số điện thoại..."
                      value={form.Phone}
                      onChange={(e) =>
                        setForm({ ...form, Phone: e.target.value })
                      }
                    />
                    <input
                      placeholder="Địa chỉ email..."
                      value={form.Email}
                      onChange={(e) =>
                        setForm({ ...form, Email: e.target.value })
                      }
                    />
                    <select
                      value={form.Gender}
                      onChange={(e) =>
                        setForm({ ...form, Gender: e.target.value })
                      }
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="Male">Nam</option>
                      <option value="Female">Nữ</option>
                      <option value="Other">Khác</option>
                    </select>
                    <input
                      type="date"
                      value={form.DateOfBirth}
                      onChange={(e) =>
                        setForm({ ...form, DateOfBirth: e.target.value })
                      }
                    />
                    <input
                      placeholder="Địa chỉ thường trú..."
                      value={form.Address}
                      onChange={(e) =>
                        setForm({ ...form, Address: e.target.value })
                      }
                    />

                    <div className="rcc-form-actions">
                      <button
                        className="rcc-primary-btn"
                        type="button"
                        disabled={saving}
                        onClick={saveProfile}
                      >
                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                      <button
                        className="rcc-light-btn"
                        type="button"
                        onClick={() => setEditMode(false)}
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rcc-detail-card">
                <div className="rcc-card-head">
                  <div>
                    <h2>Thông tin thẻ thành viên (Membership)</h2>
                    <p>Ưu đãi chiết khấu trực tiếp trên hóa đơn</p>
                  </div>
                </div>

                <div className="rcc-info-list">
                  <div>
                    <span>Hạng thành viên hiện tại</span>
                    <b style={{ color: "var(--pink)" }}>
                      {item.Membership?.MembershipLevel || "Standard"}
                    </b>
                  </div>
                  <div>
                    <span>Điểm tích lũy</span>
                    <b>{item.Membership?.Points || 0} điểm</b>
                  </div>
                  <div>
                    <span>Ưu đãi giảm giá (%)</span>
                    <b style={{ color: "#2e6221" }}>
                      Giảm {item.Membership?.DiscountPercent || 0}% trên dịch vụ
                    </b>
                  </div>
                  <div>
                    <span>Lần ghé salon gần nhất</span>
                    <b>{date(summary.LastVisitDate)}</b>
                  </div>
                  <div>
                    <span>Số lịch hẹn hoàn thành</span>
                    <b>{summary.CompletedAppointments || 0} lần</b>
                  </div>
                </div>
              </section>
            </div>

            <section className="rcc-table-card">
              <div className="rcc-tabs">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={tab === key ? "active" : ""}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "appointments" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "100px" }}>Mã lịch</th>
                      <th>Danh sách dịch vụ</th>
                      <th>Kỹ thuật viên thực hiện</th>
                      <th>Ngày đặt hẹn</th>
                      <th>Thời gian</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAppointments.map((a) => (
                      <tr key={a.AppointmentId}>
                        <td>
                          <Link
                            to={`/receptionist/appointments/${a.AppointmentId}`}
                          >
                            #{a.AppointmentId}
                          </Link>
                        </td>
                        <td>
                          <b>{a.ServiceNames || "-"}</b>
                        </td>
                        <td>{a.TechnicianName || "-"}</td>
                        <td>{date(a.AppointmentDate)}</td>
                        <td>
                          <b>
                            {a.StartTime} - {a.EndTime}
                          </b>
                        </td>
                        <td>
                          <b>{money(a.FinalAmount)}</b>
                        </td>
                        <td>
                          <span className={statusClass(a.Status)}>
                            {translateStatus(a.Status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "invoices" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th>Mã hóa đơn</th>
                      <th>Mã lịch hẹn</th>
                      <th>Ngày hẹn</th>
                      <th>Tổng tiền gốc</th>
                      <th>Giảm giá hạng</th>
                      <th>Thành tiền</th>
                      <th>Trạng thái hóa đơn</th>
                      <th>Ngày thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((i) => (
                      <tr key={i.InvoiceId}>
                        <td>
                          <Link to={`/receptionist/invoices/${i.InvoiceId}`}>
                            #{i.InvoiceId}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`/receptionist/appointments/${i.AppointmentId}`}
                          >
                            #{i.AppointmentId}
                          </Link>
                        </td>
                        <td>{date(i.AppointmentDate)}</td>
                        <td>{money(i.TotalAmount)}</td>
                        <td>{money(i.DiscountAmount)}</td>
                        <td>
                          <b>{money(i.FinalAmount)}</b>
                        </td>
                        <td>
                          <span
                            className={statusClass(
                              i.PaymentStatus || i.InvoiceStatus,
                            )}
                          >
                            {translateStatus(
                              i.PaymentStatus || i.InvoiceStatus || "UNPAID",
                            )}
                          </span>
                        </td>
                        <td>{date(i.CreatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "payments" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th>Mã thanh toán</th>
                      <th>Mã hóa đơn</th>
                      <th>Số tiền trả</th>
                      <th>Phương thức giao dịch</th>
                      <th>Ngày giao dịch</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPayments.map((p) => (
                      <tr key={p.PaymentId}>
                        <td>#{p.PaymentId}</td>
                        <td>
                          <Link to={`/receptionist/invoices/${p.InvoiceId}`}>
                            #{p.InvoiceId}
                          </Link>
                        </td>
                        <td>
                          <b>{money(p.Amount)}</b>
                        </td>
                        <td>{p.PaymentMethod || "-"}</td>
                        <td>{date(p.PaidAt || p.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(p.Status)}>
                            {translateStatus(p.Status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "reviews" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th>Dịch vụ đánh giá</th>
                      <th>Kỹ thuật viên</th>
                      <th>Số sao đánh giá</th>
                      <th>Nội dung nhận xét</th>
                      <th>Ngày nhận xét</th>
                      <th>Trạng thái hiển thị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviews.map((r) => (
                      <tr key={r.ReviewId}>
                        <td>
                          <b>{r.ServiceName || "-"}</b>
                        </td>
                        <td>{r.TechnicianName || "-"}</td>
                        <td style={{ color: "#b57a13", fontWeight: "bold" }}>
                          ⭐ {r.Rating}/5
                        </td>
                        <td>
                          <i>"{r.Comment || "Không để lại nhận xét viết."}"</i>
                        </td>
                        <td>{date(r.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(r.Status)}>
                            {translateStatus(r.Status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "feedbacks" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th>Chủ đề đóng góp</th>
                      <th>Nội dung chi tiết</th>
                      <th>Phản hồi của Salon</th>
                      <th>Ngày gửi ý kiến</th>
                      <th>Trạng thái xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFeedbacks.map((f) => (
                      <tr key={f.FeedbackId}>
                        <td>
                          <b>{f.Subject}</b>
                        </td>
                        <td>{f.Content}</td>
                        <td>{f.AdminResponse || "-"}</td>
                        <td>{date(f.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(f.Status)}>
                            {translateStatus(f.Status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "packages" && (
                <table className="rcc-table">
                  <thead>
                    <tr>
                      <th>Gói dịch trình mua</th>
                      <th>Thời gian áp dụng</th>
                      <th>Số buổi liệu trình</th>
                      <th>Giá tiền mua</th>
                      <th>Trạng thái thanh toán</th>
                      <th>Trạng thái gói</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPackages.map((p) => (
                      <tr key={p.CustomerPackageId}>
                        <td>
                          <b>{p.PackageName}</b>
                        </td>
                        <td>
                          {date(p.StartDate)} - {date(p.EndDate)}
                        </td>
                        <td>
                          <b>
                            {p.UsedSessions}/{p.TotalSessions}
                          </b>{" "}
                          buổi đã dùng (Còn <b>{p.RemainingSessions}</b>)
                        </td>
                        <td>{money(p.SalePrice)}</td>
                        <td>
                          <span className={statusClass(p.PaymentStatus)}>
                            {translateStatus(p.PaymentStatus)}
                          </span>
                        </td>
                        <td>
                          <span className={statusClass(p.Status)}>
                            {translateStatus(p.Status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "treatment-notes" &&
                (notesLoading ? (
                  <div className="rcc-empty">Đang tải hồ sơ trị liệu...</div>
                ) : treatmentNotes.length === 0 ? (
                  <div className="rcc-empty">
                    Chưa có ghi nhận hồ sơ trị liệu nào.
                  </div>
                ) : (
                  <div
                    className="treatment-notes-timeline"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                      padding: "10px 0",
                    }}
                  >
                    {treatmentNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          padding: "20px",
                          backgroundColor: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #f3f4f6",
                            paddingBottom: "10px",
                            marginBottom: "15px",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "bold",
                                color: "#db2777",
                                textTransform: "uppercase",
                                display: "block",
                                marginBottom: "4px",
                              }}
                            >
                              {note.CategoryName || "Dịch vụ"}
                            </span>
                            <h4
                              style={{
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: "bold",
                                color: "#1f2937",
                              }}
                            >
                              {note.ServiceName}
                            </h4>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span
                              style={{
                                fontSize: "13px",
                                color: "#6b7280",
                                display: "block",
                              }}
                            >
                              🗓{" "}
                              {new Date(
                                note.service_date_time,
                              ).toLocaleDateString("vi-VN")}
                            </span>
                            <span
                              style={{
                                display: "inline-block",
                                marginTop: "4px",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                backgroundColor:
                                  note.status === "finalized"
                                    ? "#d1fae5"
                                    : "#fef3c7",
                                color:
                                  note.status === "finalized"
                                    ? "#065f46"
                                    : "#92400e",
                              }}
                            >
                              {note.status === "finalized"
                                ? "🔒 Đã khóa"
                                : "📝 Bản nháp"}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "20px",
                          }}
                        >
                          <div>
                            <h5
                              style={{
                                margin: "0 0 6px 0",
                                fontSize: "13px",
                                color: "#4b5563",
                                fontWeight: "600",
                              }}
                            >
                              Tình trạng trước thực hiện:
                            </h5>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#374151",
                                whiteSpace: "pre-line",
                              }}
                            >
                              {note.before_condition || "Chưa ghi nhận"}
                            </p>
                          </div>
                          <div>
                            <h5
                              style={{
                                margin: "0 0 6px 0",
                                fontSize: "13px",
                                color: "#4b5563",
                                fontWeight: "600",
                              }}
                            >
                              Kết quả sau thực hiện:
                            </h5>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#374151",
                                whiteSpace: "pre-line",
                              }}
                            >
                              {note.after_result || "Chưa ghi nhận"}
                            </p>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: "15px",
                            borderTop: "1px solid #f3f4f6",
                            paddingTop: "15px",
                          }}
                        >
                          <h5
                            style={{
                              margin: "0 0 6px 0",
                              fontSize: "13px",
                              color: "#4b5563",
                              fontWeight: "600",
                            }}
                          >
                            Chỉ định / Khuyên dùng tại nhà:
                          </h5>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: "#374151",
                              whiteSpace: "pre-line",
                            }}
                          >
                            {note.recommendations ||
                              "Không có khuyên dùng đặc biệt"}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: "15px",
                            padding: "8px 12px",
                            backgroundColor: "#f9fafb",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#6b7280",
                          }}
                        >
                          <span>
                            KTV thực hiện:{" "}
                            <strong>{note.TechnicianName}</strong>
                          </span>
                          <span>Thời lượng: {note.duration_minutes} phút</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

              {tab !== "treatment-notes" &&
                item?.[tab.charAt(0).toUpperCase() + tab.slice(1)]?.length ===
                  0 && (
                  <div className="rcc-empty">
                    Hiện tại khách hàng chưa có dữ liệu ở mục này.
                  </div>
                )}
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
