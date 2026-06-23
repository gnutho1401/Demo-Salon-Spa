import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const DEFAULT_AVATAR = "/images/default-avatar.png";

function avatarUrl(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function date(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
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
        err.response?.data?.message || "Không tải được chi tiết khách hàng",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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
      setSuccessMsg("Đã cập nhật thông tin khách hàng");
    } catch (err) {
      setError(err.response?.data?.message || "Cập nhật khách hàng thất bại");
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    ["appointments", "Lịch hẹn"],
    ["invoices", "Hóa đơn"],
    ["payments", "Thanh toán"],
    ["reviews", "Đánh giá"],
    ["feedbacks", "Phản hồi"],
    ["packages", "Gói dịch vụ"],
  ];

  return (
    <ReceptionistLayout>
      <div className="rcc-page">
        <div className="rcc-header">
          <div>
            <h1>Chi tiết khách hàng #{id}</h1>
            <p>
              Hồ sơ khách hàng, lịch sử đặt lịch, thanh toán, đánh giá và gói
              dịch vụ.
            </p>
          </div>

          <div className="rcc-header-actions">
            <button
              className="rcc-light-btn"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Quay lại
            </button>
            <button className="rcc-primary-btn" type="button" onClick={load}>
              ↻ Làm mới
            </button>
          </div>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {successMsg && <div className="rcc-alert success">{successMsg}</div>}

        {loading && (
          <div className="rcc-table-card rcc-empty">
            Đang tải chi tiết khách hàng...
          </div>
        )}

        {!loading && !item && (
          <div className="rcc-table-card rcc-empty">
            Không tìm thấy khách hàng
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
                    {profile.Phone || "-"} · {profile.Email || "-"}
                  </p>

                  <div className="rcc-profile-tags">
                    <span className="rcc-badge">
                      {item.Membership?.MembershipLevel || "Standard"}
                    </span>
                    <span className="rcc-badge green">
                      {item.Membership?.Points || 0} điểm
                    </span>
                  </div>
                </div>
              </div>

              <div className="rcc-stat-card pink">
                <span>📅</span>
                <p>Lịch hẹn</p>
                <b>{summary.TotalAppointments || stats.appointments}</b>
              </div>

              <div className="rcc-stat-card gold">
                <span>💰</span>
                <p>Tổng chi tiêu</p>
                <b>{money(summary.TotalSpent)}</b>
              </div>

              <div className="rcc-stat-card green">
                <span>⭐</span>
                <p>Đánh giá</p>
                <b>{stats.reviews}</b>
              </div>
            </div>

            <div className="rcc-detail-grid">
              <section className="rcc-detail-card">
                <div className="rcc-card-head">
                  <div>
                    <h2>Thông tin cá nhân</h2>
                    <p>Cập nhật nhanh thông tin khách tại quầy</p>
                  </div>

                  {!editMode && (
                    <button
                      className="rcc-light-btn"
                      type="button"
                      onClick={() => setEditMode(true)}
                    >
                      Sửa
                    </button>
                  )}
                </div>

                {!editMode ? (
                  <div className="rcc-info-list">
                    <div>
                      <span>Họ tên</span>
                      <b>{profile.FullName || "-"}</b>
                    </div>
                    <div>
                      <span>Số điện thoại</span>
                      <b>{profile.Phone || "-"}</b>
                    </div>
                    <div>
                      <span>Email</span>
                      <b>{profile.Email || "-"}</b>
                    </div>
                    <div>
                      <span>Giới tính</span>
                      <b>{profile.Gender || "-"}</b>
                    </div>
                    <div>
                      <span>Ngày sinh</span>
                      <b>{date(profile.DateOfBirth)}</b>
                    </div>
                    <div>
                      <span>Địa chỉ</span>
                      <b>{profile.Address || "-"}</b>
                    </div>
                    <div>
                      <span>Ngày tạo</span>
                      <b>{date(profile.CreatedAt)}</b>
                    </div>
                  </div>
                ) : (
                  <div className="rcc-edit-form">
                    <input
                      placeholder="Họ tên"
                      value={form.FullName}
                      onChange={(e) =>
                        setForm({ ...form, FullName: e.target.value })
                      }
                    />
                    <input
                      placeholder="Số điện thoại"
                      value={form.Phone}
                      onChange={(e) =>
                        setForm({ ...form, Phone: e.target.value })
                      }
                    />
                    <input
                      placeholder="Email"
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
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                    <input
                      type="date"
                      value={form.DateOfBirth}
                      onChange={(e) =>
                        setForm({ ...form, DateOfBirth: e.target.value })
                      }
                    />
                    <input
                      placeholder="Địa chỉ"
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
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rcc-detail-card">
                <div className="rcc-card-head">
                  <div>
                    <h2>Membership</h2>
                    <p>Thông tin hạng thành viên và ưu đãi</p>
                  </div>
                </div>

                <div className="rcc-info-list">
                  <div>
                    <span>Hạng</span>
                    <b>{item.Membership?.MembershipLevel || "Standard"}</b>
                  </div>
                  <div>
                    <span>Điểm</span>
                    <b>{item.Membership?.Points || 0}</b>
                  </div>
                  <div>
                    <span>Giảm giá</span>
                    <b>{item.Membership?.DiscountPercent || 0}%</b>
                  </div>
                  <div>
                    <span>Lần ghé gần nhất</span>
                    <b>{date(summary.LastVisitDate)}</b>
                  </div>
                  <div>
                    <span>Lịch hoàn thành</span>
                    <b>{summary.CompletedAppointments || 0}</b>
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
                      <th>Mã</th>
                      <th>Dịch vụ</th>
                      <th>Kỹ thuật viên</th>
                      <th>Ngày</th>
                      <th>Giờ</th>
                      <th>Tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAppointments.map((a) => (
                      <tr key={a.AppointmentId}>
                        <td>#{a.AppointmentId}</td>
                        <td>{a.ServiceNames || "-"}</td>
                        <td>{a.TechnicianName || "-"}</td>
                        <td>{date(a.AppointmentDate)}</td>
                        <td>
                          {a.StartTime} - {a.EndTime}
                        </td>
                        <td>{money(a.FinalAmount)}</td>
                        <td>
                          <span className={statusClass(a.Status)}>
                            {a.Status}
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
                      <th>Lịch hẹn</th>
                      <th>Ngày hẹn</th>
                      <th>Tổng tiền</th>
                      <th>Giảm giá</th>
                      <th>Thành tiền</th>
                      <th>Thanh toán</th>
                      <th>Ngày tạo</th>
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
                        <td>{money(i.FinalAmount)}</td>
                        <td>
                          <span
                            className={statusClass(
                              i.PaymentStatus || i.InvoiceStatus,
                            )}
                          >
                            {i.PaymentStatus || i.InvoiceStatus || "UNPAID"}
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
                      <th>Mã</th>
                      <th>Invoice</th>
                      <th>Số tiền</th>
                      <th>Phương thức</th>
                      <th>Ngày</th>
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
                        <td>{money(p.Amount)}</td>
                        <td>{p.PaymentMethod || "-"}</td>
                        <td>{date(p.PaidAt || p.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(p.Status)}>
                            {p.Status}
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
                      <th>Dịch vụ</th>
                      <th>Kỹ thuật viên</th>
                      <th>Rating</th>
                      <th>Nội dung</th>
                      <th>Ngày</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviews.map((r) => (
                      <tr key={r.ReviewId}>
                        <td>{r.ServiceName || "-"}</td>
                        <td>{r.TechnicianName || "-"}</td>
                        <td>⭐ {r.Rating}/5</td>
                        <td>{r.Comment || "-"}</td>
                        <td>{date(r.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(r.Status)}>
                            {r.Status}
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
                      <th>Tiêu đề</th>
                      <th>Nội dung</th>
                      <th>Phản hồi admin</th>
                      <th>Ngày</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFeedbacks.map((f) => (
                      <tr key={f.FeedbackId}>
                        <td>{f.Subject}</td>
                        <td>{f.Content}</td>
                        <td>{f.AdminResponse || "-"}</td>
                        <td>{date(f.CreatedAt)}</td>
                        <td>
                          <span className={statusClass(f.Status)}>
                            {f.Status}
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
                      <th>Gói</th>
                      <th>Thời hạn</th>
                      <th>Buổi</th>
                      <th>Giá</th>
                      <th>Thanh toán</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPackages.map((p) => (
                      <tr key={p.CustomerPackageId}>
                        <td>{p.PackageName}</td>
                        <td>
                          {date(p.StartDate)} - {date(p.EndDate)}
                        </td>
                        <td>
                          {p.UsedSessions}/{p.TotalSessions} đã dùng · còn{" "}
                          {p.RemainingSessions}
                        </td>
                        <td>{money(p.SalePrice)}</td>
                        <td>{p.PaymentStatus || "-"}</td>
                        <td>
                          <span className={statusClass(p.Status)}>
                            {p.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {item?.[tab.charAt(0).toUpperCase() + tab.slice(1)]?.length ===
                0 && <div className="rcc-empty">Chưa có dữ liệu</div>}
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
