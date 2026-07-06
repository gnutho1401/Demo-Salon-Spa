import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

const DEFAULT_AVATAR = "/images/default-avatar.png";

const MEMBERSHIP_MAP = {
  Normal: "Thành viên Thường",
  Silver: "Thành viên Bạc",
  Gold: "Thành viên Vàng",
  Diamond: "Thành viên Kim cương",
  Platinum: "Thành viên Bạch kim",
};

const RISK_MAP = {
  High: "Rủi ro Cao",
  Medium: "Rủi ro Trung bình",
  Low: "Rủi ro Thấp",
};

const GENDER_MAP = {
  Nam: "Nam",
  Nữ: "Nữ",
  Khác: "Khác",
};

const STATUS_MAP = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  BANNED: "Đang bị khóa",
  PENDING: "Đang chờ duyệt",
};

const APPT_STATUS_MAP = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PENDING: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  NO_SHOW: "Không đến",
  UNPAID: "Chưa thanh toán",
  PAID_INVOICE: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
  FAILED: "Thất bại",
};

function getMembershipLabel(level) {
  return MEMBERSHIP_MAP[level] || level || "Thành viên Thường";
}

function getRiskLabel(risk) {
  return RISK_MAP[risk] || risk || "Rủi ro Thấp";
}

function getGenderLabel(gender) {
  return GENDER_MAP[gender] || gender || "Khác";
}

function getStatusLabel(status) {
  return STATUS_MAP[status] || status || "Đang hoạt động";
}

function getApptStatusLabel(status) {
  return APPT_STATUS_MAP[status] || status || "Chưa rõ";
}

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} VND`;
}

function shortDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function getAvatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function fileUrl(url) {
  return resolveFileUrl(url) || url || "#";
}

function safeText(value, fallback = "N/A") {
  return value === null || value === undefined || value === ""
    ? fallback
    : value;
}

function statusClass(value) {
  return String(value || "unknown").toLowerCase();
}

export default function TechnicianCustomers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Booking Appointment states
  const [showBookModal, setShowBookModal] = useState(false);
  const [techServices, setTechServices] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    customerId: "",
    customerName: "",
    serviceId: "",
    appointmentDate: new Date().toISOString().slice(0, 10),
    startTime: "",
    note: ""
  });

  const loadTechServices = async () => {
    try {
      const res = await axiosClient.get("/technician/schedule");
      setTechServices(res.data?.data?.services || []);
    } catch (err) {
      console.error("Load services failed:", err);
    }
  };

  useEffect(() => {
    loadTechServices();
  }, []);

  // Fetch available slots when date or service changes
  useEffect(() => {
    if (!bookingForm.appointmentDate || !bookingForm.serviceId) {
      setAvailableSlots([]);
      return;
    }
    const selectedService = techServices.find(s => s.ServiceId === Number(bookingForm.serviceId));
    const duration = selectedService ? selectedService.Duration : 60;

    const fetchSlots = async () => {
      try {
        setSlotsLoading(true);
        const res = await axiosClient.get("/technician/schedule/available-slots", {
          params: {
            date: bookingForm.appointmentDate,
            duration: duration
          }
        });
        setAvailableSlots(res.data?.data || []);
      } catch (err) {
        console.error("Load slots failed:", err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [bookingForm.appointmentDate, bookingForm.serviceId, techServices]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingForm.startTime) {
      alert("Vui lòng chọn khung giờ trống");
      return;
    }
    try {
      const payload = {
        customerId: Number(bookingForm.customerId),
        serviceIds: [Number(bookingForm.serviceId)],
        appointmentDate: bookingForm.appointmentDate,
        startTime: bookingForm.startTime,
        note: bookingForm.note,
        paymentStatus: "UNPAID",
        paymentMethod: "CASH"
      };
      await axiosClient.post("/technician/appointments", payload);
      alert("Đặt lịch dịch vụ thành công!");
      setShowBookModal(false);
      if (selected === bookingForm.customerId) {
        loadDetail(selected);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Đặt lịch thất bại");
    }
  };

  const [summary, setSummary] = useState({});
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [search, setSearch] = useState("");
  const [membership, setMembership] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [gender, setGender] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [error, setError] = useState("");

  const totalPages = Number(pagination.totalPages || 1);

  const loadSummary = async () => {
    try {
      const res = await axiosClient.get("/technician/customers/summary");
      setSummary(res.data?.data || {});
    } catch (err) {
      console.error("Load customer summary failed:", err);
    }
  };

  const loadCustomers = async () => {
    try {
      setError("");

      const res = await axiosClient.get("/technician/customers", {
        params: {
          page,
          limit: 8,
          search,
          membership,
          status,
          gender,
        },
      });

      const payload = res.data?.data || {};
      setCustomers(payload.customers || []);
      setPagination(payload.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Load customers failed:", err);
      setCustomers([]);
      setError(
        err.response?.data?.message || "Không tải được danh sách khách hàng",
      );
    }
  };

  const loadDetail = async (customerId) => {
    if (!customerId) return;

    try {
      setSelected(customerId);
      setActiveTab("overview");
      setDetailLoading(true);
      setError("");

      const res = await axiosClient.get(`/technician/customers/${customerId}`);
      setDetail(res.data?.data || null);
    } catch (err) {
      console.error("Load customer detail failed:", err);
      setDetail(null);
      setError(
        err.response?.data?.message || "Không tải được chi tiết khách hàng",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);
  useEffect(() => {
    const customerId = searchParams.get("customerId");

    if (customerId) {
      loadDetail(customerId);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, membership, status, gender]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  };

  const detailCustomer = detail?.customer || {};
  const preferences = Array.isArray(detail?.preferences)
    ? detail.preferences
    : [];
  const notes = Array.isArray(detail?.notes) ? detail.notes : [];
  const visits = Array.isArray(detail?.visits) ? detail.visits : [];
  const reviews = Array.isArray(detail?.reviews) ? detail.reviews : [];
  const upcoming = Array.isArray(detail?.upcoming) ? detail.upcoming : [];
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  const beautyProfile = detail?.beautyProfile || {};

  const noShowRate = useMemo(() => {
    const total = Number(detailCustomer.TotalVisits || visits.length || 0);
    const noShow = Number(detailCustomer.NoShowCount || 0);
    if (!total) return 0;
    return Math.round((noShow / total) * 100);
  }, [detailCustomer, visits.length]);

  const riskLevel = useMemo(() => {
    if (noShowRate >= 30) return "High";
    if (noShowRate >= 10) return "Medium";
    return "Low";
  }, [noShowRate]);

  const nextAppointment = upcoming[0] || null;

  return (
    <TechnicianLayout>
      <div className="tech-customers-page">
        <header className="tech-page-head customer-page-head">
          <div>
            <h1>
              Khách hàng <span>👥</span>
            </h1>
            <p>Quản lý hồ sơ chi tiết, lịch sử trị liệu và thông tin khách hàng</p>
          </div>

          <form
            className="tech-search customer-top-search"
            onSubmit={submitSearch}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, điện thoại, email..."
            />
          </form>

          <button
            type="button"
            className="tech-new-btn"
            onClick={() => navigate("/technician/schedule")}
          >
            Lịch trình của tôi
          </button>
        </header>

        <section className="customer-stats">
          <div className="customer-stat-card">
            <span>🏥</span>
            <p>Tổng khách hàng</p>
            <h2>{summary.totalCustomers || 0}</h2>
            <small>Được phân công phụ trách</small>
          </div>

          <div className="customer-stat-card blue">
            <span>🔄</span>
            <p>Đang hoạt động</p>
            <h2>{summary.activeCustomers || 0}</h2>
            <small>Tài khoản hoạt động</small>
          </div>

          <div className="customer-stat-card gold">
            <span>⭐</span>
            <p>Khách mới tháng này</p>
            <h2>{summary.newThisMonth || 0}</h2>
            <small>Lượt ghé thăm mới</small>
          </div>

          <div className="customer-stat-card purple">
            <span>💎</span>
            <p>Khách hàng VIP</p>
            <h2>{summary.vipCustomers || 0}</h2>
            <small>Hạng Vàng / Kim cương</small>
          </div>
        </section>

        {error && <div className="customer-error">{error}</div>}

        <section className={`customer-layout ${detail ? "has-detail" : ""}`}>
          <main className="customer-left-col">
            <form className="customer-filter-bar" onSubmit={submitSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên, số điện thoại, email..."
              />

              <select
                value={membership}
                onChange={(e) => {
                  setMembership(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả hạng thành viên</option>
                <option value="Normal">Normal (Thường)</option>
                <option value="Silver">Silver (Bạc)</option>
                <option value="Gold">Gold (Vàng)</option>
                <option value="Diamond">Diamond (Kim cương)</option>
                <option value="Platinum">Platinum (Bạch kim)</option>
              </select>

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
                <option value="BANNED">Bị khóa</option>
              </select>

              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả giới tính</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>

              <button type="submit">Tìm kiếm</button>
            </form>

            <div className="customer-table-card">
              <div className="customer-table-title">
                Danh sách khách hàng ({pagination.total || 0})
              </div>

              <div className="customer-table-wrap">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Khách hàng</th>
                      <th>Liên hệ</th>
                      <th>Hạng thành viên</th>
                      <th>Gần nhất</th>
                      <th>Tổng số buổi</th>
                      <th>Tổng chi tiêu</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="customer-empty-row">
                          Không tìm thấy khách hàng nào
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr
                          key={c.CustomerId}
                          className={selected === c.CustomerId ? "active" : ""}
                          onClick={() => loadDetail(c.CustomerId)}
                        >
                          <td>
                            <div className="customer-name-cell">
                              <img
                                src={getAvatar(c.AvatarUrl)}
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_AVATAR;
                                }}
                                alt={c.FullName || "Customer"}
                              />

                              <div>
                                <b>{safeText(c.FullName)}</b>
                                <p>
                                  {safeText(
                                    c.CustomerCode,
                                    `#CUST-${String(c.CustomerId).padStart(
                                      3,
                                      "0",
                                    )}`,
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td>
                            <b>{safeText(c.Phone, "Chưa có SĐT")}</b>
                            <p>{safeText(c.Email, "Chưa có email")}</p>
                          </td>

                          <td>
                            <span
                              className={`member-badge ${String(
                                c.MembershipLevel || "normal",
                              ).toLowerCase()}`}
                            >
                              {getMembershipLabel(c.MembershipLevel)}
                            </span>
                          </td>

                          <td>{shortDate(c.LastVisit)}</td>
                          <td>{c.TotalVisits || 0} ca</td>
                          <td>{money(c.TotalSpent)}</td>

                          <td>
                            <span
                              className={`customer-status ${statusClass(
                                c.Status,
                              )}`}
                            >
                              {getStatusLabel(c.Status)}
                            </span>
                          </td>

                          <td>
                            <div className="customer-actions">
                              <button
                                type="button"
                                title="Xem chi tiết"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadDetail(c.CustomerId);
                                }}
                              >
                                👁
                              </button>

                              <button
                                type="button"
                                title="Đặt lịch hẹn dịch vụ"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBookingForm({
                                    customerId: c.CustomerId,
                                    customerName: c.FullName || "Khách hàng",
                                    serviceId: techServices[0]?.ServiceId || "",
                                    appointmentDate: new Date().toISOString().slice(0, 10),
                                    startTime: "",
                                    note: ""
                                  });
                                  setShowBookModal(true);
                                }}
                              >
                                📅
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="customer-pagination">
                <span>
                  Hiển thị {customers.length} trên tổng số {pagination.total || 0} khách hàng
                </span>

                <div>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>

                  <b>{page}</b>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </main>

          {detail && (
            <aside className="customer-detail-panel">
              {detailLoading ? (
                <div className="empty-customer-detail">
                  <h3>Đang tải...</h3>
                  <p>Đang tải thông tin khách hàng</p>
                </div>
              ) : (
                <>
                  <div className="customer-detail-head">
                    <h3>Chi tiết khách hàng</h3>

                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        setSelected(null);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="customer-profile-card">
                    <img
                      src={getAvatar(detailCustomer.AvatarUrl)}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                      alt={detailCustomer.FullName || "Khách hàng"}
                    />

                    <div>
                      <h2>{safeText(detailCustomer.FullName)}</h2>
                      <span>
                        {getMembershipLabel(detailCustomer.MembershipLevel)}
                      </span>
                      <p>📞 {safeText(detailCustomer.Phone, "Chưa có SĐT")}</p>
                      <p>✉ {safeText(detailCustomer.Email, "Chưa có Email")}</p>
                      <p>🎂 {shortDate(detailCustomer.DateOfBirth)}</p>
                      <p>📍 {safeText(detailCustomer.Address, "Chưa có địa chỉ")}</p>
                    </div>

                    <div className="customer-id-box">
                      <p>Mã khách hàng</p>
                      <b>{safeText(detailCustomer.CustomerCode)}</b>

                      <p>Tổng số buổi</p>
                      <b>{detailCustomer.TotalVisits || visits.length || 0}</b>

                      <p>Tổng chi tiêu</p>
                      <b>{money(detailCustomer.TotalSpent)}</b>
                    </div>
                  </div>

                  {nextAppointment && (
                    <div className="customer-upcoming-card">
                      <div>
                        <span>Lịch hẹn tiếp theo</span>
                        <h4>
                          {shortDate(nextAppointment.AppointmentDate)} •{" "}
                          {nextAppointment.StartTime}
                        </h4>
                        <p>{nextAppointment.ServiceName || "Không có dịch vụ"}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/technician/appointments/${nextAppointment.AppointmentId}`,
                          )
                        }
                      >
                        Xem
                      </button>
                    </div>
                  )}

                  <div className="customer-detail-actions">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                    >
                      Xem hồ sơ
                    </button>

                    <button
                      type="button"
                      disabled={!detailCustomer.Phone && !detailCustomer.Email}
                      onClick={() => {
                        if (detailCustomer.Phone) {
                          window.location.href = `tel:${detailCustomer.Phone}`;
                        } else if (detailCustomer.Email) {
                          window.location.href = `mailto:${detailCustomer.Email}`;
                        }
                      }}
                    >
                      Liên hệ
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (nextAppointment?.AppointmentId) {
                          navigate(
                            `/technician/appointments/${nextAppointment.AppointmentId}`,
                          );
                        } else {
                          navigate(`/technician/treatment-notes?customerId=${detailCustomer.CustomerId}`);
                        }
                      }}
                    >
                      + Thêm ghi chú trị liệu
                    </button>
                  </div>

                  <div className="customer-tabs">
                    <button
                      type="button"
                      className={activeTab === "overview" ? "active" : ""}
                      onClick={() => setActiveTab("overview")}
                    >
                      Tổng quan
                    </button>

                    <button
                      type="button"
                      className={activeTab === "visits" ? "active" : ""}
                      onClick={() => setActiveTab("visits")}
                    >
                      Lịch sử ghé thăm
                    </button>

                    <button
                      type="button"
                      className={activeTab === "notes" ? "active" : ""}
                      onClick={() => setActiveTab("notes")}
                    >
                      Ghi chú & Trị liệu
                    </button>

                    <button
                      type="button"
                      className={activeTab === "timeline" ? "active" : ""}
                      onClick={() => setActiveTab("timeline")}
                    >
                      Dòng thời gian
                    </button>

                    <button
                      type="button"
                      className={activeTab === "reviews" ? "active" : ""}
                      onClick={() => setActiveTab("reviews")}
                    >
                      Đánh giá
                    </button>
                  </div>

                  {activeTab === "overview" && (
                    <div className="customer-detail-grid">
                      <div className="customer-info-card customer-info-main">
                        <h4>Thông tin khách hàng</h4>

                        <p>
                          <span>Họ và tên</span>
                          <b>{safeText(detailCustomer.FullName)}</b>
                        </p>

                        <p>
                          <span>Số điện thoại</span>
                          <b>{safeText(detailCustomer.Phone)}</b>
                        </p>

                        <p>
                          <span>Email</span>
                          <b>{safeText(detailCustomer.Email)}</b>
                        </p>

                        <p>
                          <span>Ngày sinh</span>
                          <b>{shortDate(detailCustomer.DateOfBirth)}</b>
                        </p>

                        <p>
                          <span>Giới tính</span>
                          <b>{getGenderLabel(detailCustomer.Gender)}</b>
                        </p>

                        <p>
                          <span>Địa chỉ</span>
                          <b>{safeText(detailCustomer.Address)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Hồ sơ làm đẹp</h4>

                        <p>
                          <span>Tình trạng da</span>
                          <b>{safeText(beautyProfile.skinCondition)}</b>
                        </p>

                        <p>
                          <span>Sản phẩm đã dùng</span>
                          <b>{safeText(beautyProfile.productsUsed)}</b>
                        </p>

                        <p>
                          <span>Kỹ thuật thực hiện</span>
                          <b>{safeText(beautyProfile.technique)}</b>
                        </p>

                        <p>
                          <span>Khuyến nghị</span>
                          <b>{safeText(beautyProfile.recommendation)}</b>
                        </p>

                        <p>
                          <span>Hẹn tái khám</span>
                          <b>{shortDate(beautyProfile.followUpDate)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Thông tin thành viên</h4>

                        <div className="membership-box">
                          <b>{getMembershipLabel(detailCustomer.MembershipLevel)}</b>
                          <p>
                            Điểm tích lũy: {detailCustomer.LoyaltyPoints || 0}
                          </p>
                        </div>

                        <p>
                          <span>Điểm hiện tại</span>
                          <b>{detailCustomer.LoyaltyPoints || 0} điểm</b>
                        </p>

                        <p>
                          <span>Ưu đãi giảm giá</span>
                          <b>{detailCustomer.DiscountPercent || 0}%</b>
                        </p>

                        <p>
                          <span>Tổng chi tiêu</span>
                          <b>{money(detailCustomer.TotalSpent)}</b>
                        </p>

                        <p>
                          <span>Chi tiêu trung bình</span>
                          <b>{money(detailCustomer.AverageTicket)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Mức độ rủi ro</h4>

                        <p>
                          <span>Tỷ lệ vắng mặt</span>
                          <b>{noShowRate}%</b>
                        </p>

                        <p>
                          <span>Số lần vắng mặt</span>
                          <b>{detailCustomer.NoShowCount || 0}</b>
                        </p>

                        <p>
                          <span>Số lần hủy lịch</span>
                          <b>{detailCustomer.CancelledCount || 0}</b>
                        </p>

                        <p>
                          <span>Mức độ rủi ro</span>
                          <b>{getRiskLabel(riskLevel)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Dịch vụ yêu thích</h4>

                        {preferences.length === 0 ? (
                          <p className="muted-line">Chưa có dịch vụ yêu thích</p>
                        ) : (
                          preferences.map((p, index) => (
                            <p key={`${p.ServiceName}-${index}`}>
                              <span>♡ {p.ServiceName}</span>
                              <b>{p.UsedCount || 0} lần</b>
                            </p>
                          ))
                        )}
                      </div>

                      <div className="customer-info-card quick-stat-card">
                        <h4>Tóm tắt độ hài lòng</h4>

                        <p>
                          <span>Đánh giá trung bình</span>
                          <b>
                            ⭐{" "}
                            {Number(detailCustomer.AverageRating || 0).toFixed(
                              1,
                            )}
                          </b>
                        </p>

                        <p>
                          <span>Số lượng đánh giá</span>
                          <b>{detailCustomer.ReviewCount || 0}</b>
                        </p>

                        <p>
                          <span>Lượt ghé thăm gần nhất</span>
                          <b>{shortDate(detailCustomer.LastVisit)}</b>
                        </p>

                        <p>
                          <span>Thành viên từ ngày</span>
                          <b>{shortDate(detailCustomer.MemberSince)}</b>
                        </p>
                      </div>

                      <div className="customer-info-card">
                        <h4>Lịch hẹn sắp tới</h4>

                        {upcoming.length === 0 ? (
                          <p className="muted-line">Không có lịch hẹn sắp tới</p>
                        ) : (
                          upcoming.map((item) => (
                            <div className="mini-note" key={item.AppointmentId}>
                              <b>{item.AppointmentCode}</b>
                              <p>
                                {shortDate(item.AppointmentDate)} •{" "}
                                {item.StartTime} - {item.EndTime}
                              </p>
                              <small>{item.ServiceName || "Không có dịch vụ"}</small>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="customer-info-card">
                        <h4>Ghi chú trị liệu gần đây</h4>

                        {notes.length === 0 ? (
                          <p className="muted-line">Không có ghi chú trị liệu</p>
                        ) : (
                          notes.slice(0, 3).map((n, index) => (
                            <div
                              className="mini-note"
                              key={n.NoteId || `${n.CreatedAt}-${index}`}
                            >
                              <b>{n.Title || n.NoteType || "Ghi chú trị liệu"}</b>
                              <p>{n.Content || "Không có nội dung"}</p>
                              <small>{shortDate(n.CreatedAt)}</small>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "visits" && (
                    <div className="customer-tab-panel">
                      <h4>Lịch sử ghé thăm</h4>

                      {visits.length === 0 ? (
                        <p className="muted-line">Không có lịch sử ghé thăm</p>
                      ) : (
                        <div className="customer-history-list">
                          {visits.map((v, index) => (
                            <div
                              className="history-item"
                              key={v.AppointmentId || index}
                            >
                              <div>
                                <b>
                                  {v.AppointmentCode ||
                                    `#APT-${String(v.AppointmentId).padStart(
                                      3,
                                      "0",
                                    )}`}
                                </b>
                                <p>
                                  {shortDate(v.AppointmentDate)} •{" "}
                                  {safeText(v.StartTime, "--:--")} -{" "}
                                  {safeText(v.EndTime, "--:--")}
                                </p>
                                <p>{v.ServiceName || "Không có dịch vụ"}</p>
                              </div>

                              <div>
                                <span
                                  className={`customer-status ${statusClass(
                                    v.Status,
                                  )}`}
                                >
                                  {getApptStatusLabel(v.Status)}
                                </span>
                                <p>{money(v.FinalAmount)}</p>
                                <small>
                                  Thanh toán: {getApptStatusLabel(v.PaymentStatus)}
                                </small>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${v.AppointmentId}`,
                                  )
                                }
                              >
                                Chi tiết lịch hẹn
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "notes" && (
                    <div className="customer-tab-panel">
                      <div className="tab-title-row">
                        <h4>Ghi chú & Trị liệu</h4>

                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/technician/treatment-notes?customerId=${detailCustomer.CustomerId}`)
                          }
                        >
                          + Thêm ghi chú
                        </button>
                      </div>

                      {notes.length === 0 ? (
                        <p className="muted-line">Không có ghi chú trị liệu</p>
                      ) : (
                        <div className="customer-history-list">
                          {notes.map((n, index) => (
                            <div
                              className="history-item"
                              key={n.NoteId || `${n.CreatedAt}-${index}`}
                            >
                              <div>
                                <b>
                                  {n.Title || n.NoteType || "Ghi chú trị liệu"}
                                </b>
                                <p>{n.Content || "Không có nội dung"}</p>

                                <small>
                                  {shortDate(n.CreatedAt)} •{" "}
                                  {n.AppointmentCode || "Không có mã lịch hẹn"}
                                </small>

                                {Array.isArray(n.Attachments) &&
                                  n.Attachments.length > 0 && (
                                    <div className="note-attachments">
                                      {n.Attachments.map((file) => (
                                        <a
                                          key={file.AttachmentId}
                                          href={fileUrl(file.FileUrl)}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          📎 {file.FileName}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/technician/appointments/${n.AppointmentId}`,
                                  )
                                }
                              >
                                Xem ghi chú
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "timeline" && (
                    <div className="customer-tab-panel">
                      <h4>Dòng thời gian hoạt động</h4>

                      {timeline.length === 0 ? (
                        <p className="muted-line">Không có dữ liệu dòng thời gian</p>
                      ) : (
                        <div className="customer-history-list">
                          {timeline.map((item, index) => (
                            <div className="history-item" key={index}>
                              <div>
                                <b>
                                  {item.type === "APPOINTMENT" && "📅 Lượt hẹn: "}
                                  {item.type === "NOTE" && "📝 Ghi chú: "}
                                  {item.type === "REVIEW" && "⭐ Đánh giá: "}
                                  {item.title === "Appointment" ? "Lịch hẹn" : item.title === "Treatment note" ? "Ghi chú trị liệu" : item.title}
                                </b>
                                <p>{safeText(item.subtitle, "")}</p>
                                <small>{shortDate(item.date)}</small>
                              </div>

                              {item.status && (
                                <span
                                  className={`customer-status ${statusClass(
                                    item.status,
                                  )}`}
                                >
                                  {getApptStatusLabel(item.status)}
                                </span>
                              )}

                              {item.appointmentId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/technician/appointments/${item.appointmentId}`,
                                    )
                                  }
                                >
                                  Xem
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "reviews" && (
                    <div className="customer-tab-panel">
                      <h4>Đánh giá từ khách hàng</h4>

                      {reviews.length === 0 ? (
                        <p className="muted-line">Không có đánh giá</p>
                      ) : (
                        <div className="customer-history-list">
                          {reviews.map((r, index) => (
                            <div
                              className="history-item"
                              key={r.ReviewId || index}
                            >
                              <div>
                                <b>⭐ {Number(r.Rating || 0).toFixed(1)}</b>
                                <p>{r.Comment || "Không có nhận xét"}</p>
                                <small>
                                  {r.ServiceName || "Dịch vụ"} •{" "}
                                  {shortDate(r.CreatedAt)}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
        </section>

        {showBookModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px"
          }}>
            <div style={{
              backgroundColor: "#16161e",
              border: "1px solid rgba(212, 175, 55, 0.35)",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 10px 40px rgba(212, 175, 55, 0.15)",
              position: "relative"
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, color: "#d4af37", fontSize: "1.3rem", fontWeight: "bold" }}>
                  📅 Đặt lịch dịch vụ cho ${bookingForm.customerName}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleBookAppointment}>
                {/* Service Selection */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: "0.85rem", marginBottom: "6px" }}>
                    Chọn dịch vụ thực hiện
                  </label>
                  <select
                    value={bookingForm.serviceId}
                    onChange={e => setBookingForm({ ...bookingForm, serviceId: e.target.value, startTime: "" })}
                    style={{
                      width: "100%",
                      backgroundColor: "#22222b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      padding: "10px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                    required
                  >
                    <option value="" disabled>-- Chọn dịch vụ --</option>
                    {techServices.map(s => (
                      <option key={s.ServiceId} value={s.ServiceId}>
                        {s.ServiceName} ({s.Duration} phút)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Selection */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: "0.85rem", marginBottom: "6px" }}>
                    Chọn ngày hẹn
                  </label>
                  <input
                    type="date"
                    value={bookingForm.appointmentDate}
                    onChange={e => setBookingForm({ ...bookingForm, appointmentDate: e.target.value, startTime: "" })}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{
                      width: "100%",
                      backgroundColor: "#22222b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      padding: "10px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                    required
                  />
                </div>

                {/* Available Slots suggestions */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: "0.85rem", marginBottom: "8px" }}>
                    Gợi ý khung giờ khả dụng (Không bị trùng lắp)
                  </label>

                  {slotsLoading ? (
                    <div style={{ color: "#d4af37", fontSize: "0.9rem", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                      🌀 Đang tìm các khung giờ trống...
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ color: "#ef4444", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                      ❌ Kỹ thuật viên không có ca làm việc hoặc không còn giờ trống trong ngày đã chọn.
                    </div>
                  ) : (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      maxHeight: "150px",
                      overflowY: "auto",
                      backgroundColor: "#22222b",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.05)"
                    }}>
                      {availableSlots.map(slot => {
                        const isSelected = bookingForm.startTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, startTime: slot })}
                            style={{
                              backgroundColor: isSelected ? "#d4af37" : "#1a1a24",
                              color: isSelected ? "black" : "#e5e7eb",
                              border: `1px solid ${isSelected ? "#d4af37" : "rgba(255,255,255,0.1)"}`,
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "0.85rem",
                              fontWeight: isSelected ? "bold" : "normal",
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "all 0.2s ease"
                            }}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: "0.85rem", marginBottom: "6px" }}>
                    Ghi chú đặc biệt
                  </label>
                  <textarea
                    value={bookingForm.note}
                    onChange={e => setBookingForm({ ...bookingForm, note: e.target.value })}
                    placeholder="Khách có yêu cầu đặc biệt gì không..."
                    style={{
                      width: "100%",
                      backgroundColor: "#22222b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      padding: "10px",
                      borderRadius: "8px",
                      outline: "none",
                      height: "60px",
                      resize: "none"
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowBookModal(false)}
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#e5e7eb",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    HỦY
                  </button>
                  <button
                    type="submit"
                    style={{
                      backgroundColor: "#d4af37",
                      color: "black",
                      padding: "10px 24px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    XÁC NHẬN ĐẶT LỊCH
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
