import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

const STATUS_OPTIONS = [
  ["ALL", "Tất cả trạng thái"],
  ["PENDING", "Chờ xác nhận"],
  ["PENDING_PAYMENT", "Chờ thanh toán"],
  ["CONFIRMED", "Đã xác nhận"],
  ["CHECKED_IN", "Đã check-in"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"],
  ["REFUND_PENDING", "Chờ hoàn tiền"],
  ["NO_SHOW", "Vắng mặt"],
];

const PAYMENT_OPTIONS = [
  ["ALL", "Tất cả thanh toán"],
  ["UNPAID", "Chưa thanh toán"],
  ["PENDING", "Đang chờ"],
  ["PAID", "Đã thanh toán"],
  ["FAILED", "Thất bại"],
  ["REFUND_PENDING", "Chờ hoàn tiền"],
  ["REFUNDED", "Đã hoàn tiền"],
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  if (!value) return "Chưa có";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
  return text.includes(":") ? text.slice(0, 5) : text;
}

function getAppointmentCode(id) {
  return `AP${String(id || "").padStart(5, "0")}`;
}

function statusText(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "Chờ xác nhận";
  if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (s === "CONFIRMED") return "Đã xác nhận";
  if (s === "CHECKED_IN") return "Đã check-in";
  if (s === "IN_PROGRESS") return "Đang thực hiện";
  if (s === "COMPLETED") return "Hoàn thành";
  if (s === "CANCELLED") return "Đã hủy";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  if (s === "NO_SHOW") return "Vắng mặt";
  return status || "Chưa rõ";
}

function paymentText(status) {
  const s = String(status || "UNPAID").toUpperCase();
  if (s === "PAID") return "Đã thanh toán";
  if (s === "PENDING") return "Đang chờ thanh toán";
  if (s === "FAILED") return "Thanh toán thất bại";
  if (s === "REFUND_PENDING") return "Chờ hoàn tiền";
  if (s === "REFUNDED") return "Đã hoàn tiền";
  return "Chưa thanh toán";
}

function refundText(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "Chờ hoàn tiền";
  if (s === "PROCESSING") return "Đang xử lý";
  if (s === "APPROVED") return "Đã duyệt";
  if (s === "REFUNDED") return "Đã hoàn tiền";
  if (s === "REJECTED") return "Từ chối";
  return status || "Chưa có";
}

// ... helper methods for checking state transitions ...
function canPay(row) {
  const s = String(row?.Status || "").toUpperCase();
  const p = String(row?.PaymentStatus || "UNPAID").toUpperCase();
  const isBilledUnderPackage = row?.CustomerPackageId != null;

  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(s)) return false;
  if (p === "PAID" || isBilledUnderPackage) return false;

  return (
    ["UNPAID", "PENDING", "PENDING_PAYMENT", "FAILED"].includes(p) ||
    s === "PENDING_PAYMENT"
  );
}

function canCancel(row) {
  const s = String(row.Status || "").toUpperCase();
  return ["PENDING", "PENDING_PAYMENT", "CONFIRMED"].includes(s);
}

function canReschedule(row) {
  const s = String(row.Status || "").toUpperCase();
  return ["PENDING", "PENDING_PAYMENT", "CONFIRMED"].includes(s);
}

function canReview(row) {
  const s = String(row.Status || "").toUpperCase();
  return (
    s === "COMPLETED" &&
    Number(row.ReviewCount || 0) < Number(row.ServiceCount || 1)
  );
}

const POPULAR_BANKS = [
  { bin: "970436", name: "VCB - Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970423", name: "TPBank" },
  { bin: "970419", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970448", name: "OCB" },
];

export default function MyAppointments() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [technicians, setTechnicians] = useState([]);
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [services, setServices] = useState([]);
  const [serviceFilter, setServiceFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [bankList, setBankList] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [cancelModal, setCancelModal] = useState({
    open: false,
    appointment: null,
    reason: "",
  });

  useEffect(() => {
    fetch("https://api.vietqr.io/v2/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data) {
          setBankList(
            data.data.map((b) => ({
              bin: b.bin,
              name: `${b.shortName} - ${b.name}`,
            })),
          );
        } else {
          setBankList(POPULAR_BANKS);
        }
      })
      .catch(() => {
        setBankList(POPULAR_BANKS);
      });
  }, []);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [branchRes, techRes, serviceRes] = await Promise.all([
          axiosClient
            .get("/employees/branches")
            .catch(() => ({ data: { data: [] } })),
          axiosClient.get("/employees").catch(() => ({ data: [] })),
          axiosClient.get("/services").catch(() => ({ data: { data: [] } })),
        ]);
        setBranches(branchRes.data.data || branchRes.data || []);
        setTechnicians(techRes.data.data || techRes.data || []);
        setServices(serviceRes.data.data || serviceRes.data || []);
      } catch (err) {
        console.error("Lỗi khi tải danh mục lọc:", err);
      }
    }
    loadFilterOptions();
  }, []);

  async function loadAppointments() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/appointments/my");
      setRows(
        Array.isArray(res.data.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [],
      );
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch hẹn");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(appointmentId) {
    try {
      setLoadingId(appointmentId);
      setError("");
      setMessage("");
      await axiosClient.post(`/appointments/${appointmentId}/confirm`);
      setMessage("Xác nhận lịch hẹn tái khám thành công!");
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || "Xác nhận lịch hẹn thất bại");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const filteredRows = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return [...rows]
      .sort((a, b) => {
        const da = `${a.AppointmentDate || ""} ${a.StartTime || ""}`;
        const db = `${b.AppointmentDate || ""} ${b.StartTime || ""}`;
        return (
          db.localeCompare(da) ||
          Number(b.AppointmentId || 0) - Number(a.AppointmentId || 0)
        );
      })
      .filter((r) => {
        const status = String(r.Status || "").toUpperCase();

        const payment = String(r.PaymentStatus || "UNPAID").toUpperCase();
        const date = String(r.AppointmentDate || "").slice(0, 10);

        let statusOk = false;
        if (statusFilter === "ALL") {
          statusOk = true;
        } else if (statusFilter === "IN_PROGRESS") {
          statusOk = ["IN_PROGRESS", "CHECKED_IN"].includes(status);
        } else if (statusFilter === "CANCELLED") {
          statusOk = ["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(
            status,
          );
        } else {
          statusOk = status === statusFilter;
        }

        const paymentOk = paymentFilter === "ALL" || payment === paymentFilter;
        const fromOk = !fromDate || date >= fromDate;
        const toOk = !toDate || date <= toDate;

        const branchOk =
          branchFilter === "ALL" || Number(r.BranchId) === Number(branchFilter);
        const technicianOk =
          technicianFilter === "ALL" ||
          Number(r.EmployeeId) === Number(technicianFilter);
        const serviceOk =
          serviceFilter === "ALL" ||
          (r.ServiceIds &&
            r.ServiceIds.split(",")
              .map(Number)
              .includes(Number(serviceFilter))) ||
          Number(r.ServiceId) === Number(serviceFilter);

        const keywordOk =
          !text ||
          getAppointmentCode(r.AppointmentId).toLowerCase().includes(text) ||
          String(r.ServiceNames || r.ServiceName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.EmployeeName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.BranchName || "")
            .toLowerCase()
            .includes(text) ||
          String(r.Notes || "")
            .toLowerCase()
            .includes(text);

        return (
          statusOk &&
          paymentOk &&
          fromOk &&
          toOk &&
          branchOk &&
          technicianOk &&
          serviceOk &&
          keywordOk
        );
      });
  }, [
    rows,
    keyword,
    statusFilter,
    paymentFilter,
    fromDate,
    toDate,
    branchFilter,
    technicianFilter,
    serviceFilter,
  ]);

  const stats = useMemo(() => {
    const total = rows.length;

    const active = rows.filter((r) =>
      [
        "PENDING",
        "PENDING_PAYMENT",
        "CONFIRMED",
        "CHECKED_IN",
        "IN_PROGRESS",
      ].includes(String(r.Status || "").toUpperCase()),
    ).length;

    const completed = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "COMPLETED",
    ).length;

    const spent = rows
      .filter((r) => String(r.PaymentStatus || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + Number(r.FinalAmount || 0), 0);

    return { total, active, completed, spent };
  }, [rows]);

  function openCancelModal(row) {
    setError("");
    setMessage("");
    setCancelModal({
      open: true,
      appointment: row,
      reason: "",
    });
    setBankCode("");
    setAccountNumber("");
    setAccountName("");
  }

  function closeCancelModal() {
    setCancelModal({
      open: false,
      appointment: null,
      reason: "",
    });
  }

  async function submitCancel() {
    const appointmentId = cancelModal.appointment?.AppointmentId;

    if (!appointmentId) {
      setError("Không tìm thấy lịch hẹn cần hủy");
      return;
    }

    if (!cancelModal.reason.trim()) {
      setError("Vui lòng nhập lý do hủy lịch");
      return;
    }

    const paymentStatus = String(
      cancelModal.appointment?.PaymentStatus || "",
    ).toUpperCase();
    const paymentMethod = String(
      cancelModal.appointment?.PaymentMethod || "",
    ).toUpperCase();
    const hasPaid = paymentStatus === "PAID" && paymentMethod !== "PACKAGE";

    if (hasPaid) {
      if (!bankCode) {
        setError("Vui lòng chọn ngân hàng nhận hoàn tiền");
        return;
      }
      if (!accountNumber.trim()) {
        setError("Vui lòng nhập số tài khoản nhận hoàn tiền");
        return;
      }
      if (!accountName.trim()) {
        setError("Vui lòng nhập tên chủ tài khoản");
        return;
      }
    }

    try {
      setLoadingId(appointmentId);
      setError("");
      setMessage("");

      await axiosClient.delete(`/appointments/${appointmentId}`, {
        data: {
          reason: cancelModal.reason.trim(),
          bankCode,
          accountNumber,
          accountName: accountName.trim().toUpperCase(),
        },
      });

      setMessage(
        hasPaid
          ? "Đã hủy lịch và gửi yêu cầu hoàn tiền"
          : "Hủy lịch hẹn thành công",
      );

      closeCancelModal();
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch hẹn thất bại");
    } finally {
      setLoadingId(null);
    }
  }

  function clearFilter() {
    setKeyword("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setBranchFilter("ALL");
    setTechnicianFilter("ALL");
    setServiceFilter("ALL");
    setFromDate("");
    setToDate("");
  }

  return (
    <CustomerLayout>
      <div className="customer-appointments-page">
        {cancelModal.open && (
          <div className="cancel-modal-backdrop" onClick={closeCancelModal}>
            <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="cancel-modal-close"
                onClick={closeCancelModal}
              >
                ×
              </button>

              <div className="cancel-modal-icon">!</div>
              <h3>Xác nhận hủy lịch hẹn</h3>

              <p className="cancel-modal-desc">
                Vui lòng nhập lý do hủy để salon xử lý lịch hẹn, thanh toán và
                hoàn tiền chính xác.
              </p>

              <div className="cancel-summary">
                <div>
                  <span>Mã lịch</span>
                  <b>
                    {getAppointmentCode(cancelModal.appointment?.AppointmentId)}
                  </b>
                </div>

                <div>
                  <span>Dịch vụ</span>
                  <b>
                    {cancelModal.appointment?.ServiceNames ||
                      cancelModal.appointment?.ServiceName ||
                      "Dịch vụ"}
                  </b>
                </div>

                <div>
                  <span>Ngày hẹn</span>
                  <b>{formatDate(cancelModal.appointment?.AppointmentDate)}</b>
                </div>

                <div>
                  <span>Thời gian</span>
                  <b>
                    {formatTime(cancelModal.appointment?.StartTime)} -{" "}
                    {formatTime(cancelModal.appointment?.EndTime)}
                  </b>
                </div>
              </div>

              {String(
                cancelModal.appointment?.PaymentStatus || "",
              ).toUpperCase() === "PAID" &&
                String(
                  cancelModal.appointment?.PaymentMethod || "",
                ).toUpperCase() !== "PACKAGE" && (
                  <div className="refund-warning">
                    Lịch này đã thanh toán. Sau khi hủy, hệ thống sẽ tạo yêu cầu
                    hoàn tiền qua cổng PayOS.
                  </div>
                )}

              {String(
                cancelModal.appointment?.PaymentStatus || "",
              ).toUpperCase() === "PAID" &&
                String(
                  cancelModal.appointment?.PaymentMethod || "",
                ).toUpperCase() !== "PACKAGE" && (
                  <div
                    className="bank-refund-fields"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      margin: "15px 0",
                      padding: "12px",
                      border: "1px solid #ffe3e3",
                      borderRadius: "8px",
                      backgroundColor: "#fff9f9",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        color: "#d32f2f",
                        fontSize: "14px",
                      }}
                    >
                      Thông tin tài khoản nhận hoàn tiền
                    </h4>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#555",
                          textAlign: "left",
                        }}
                      >
                        Ngân hàng nhận:
                      </label>
                      <select
                        style={{
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          outline: "none",
                        }}
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                      >
                        <option value="">-- Chọn ngân hàng --</option>
                        {bankList.map((b) => (
                          <option key={b.bin} value={b.bin}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#555",
                          textAlign: "left",
                        }}
                      >
                        Số tài khoản:
                      </label>
                      <input
                        type="text"
                        placeholder="Nhập số tài khoản..."
                        style={{
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          outline: "none",
                        }}
                        value={accountNumber}
                        onChange={(e) =>
                          setAccountNumber(e.target.value.replace(/\s/g, ""))
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#555",
                          textAlign: "left",
                        }}
                      >
                        Tên chủ tài khoản (viết hoa không dấu):
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: NGUYEN VAN A"
                        style={{
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          outline: "none",
                        }}
                        value={accountName}
                        onChange={(e) =>
                          setAccountName(e.target.value.toUpperCase())
                        }
                      />
                    </div>
                  </div>
                )}

              <label className="cancel-label">Lý do hủy lịch</label>

              <textarea
                className="cancel-textarea"
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="Ví dụ: Tôi bận đột xuất, muốn hủy lịch..."
                rows={4}
              />

              <div className="cancel-modal-actions">
                <button
                  type="button"
                  className="cancel-keep-btn"
                  onClick={closeCancelModal}
                >
                  Giữ lịch
                </button>

                <button
                  type="button"
                  className="cancel-confirm-btn"
                  onClick={submitCancel}
                  disabled={
                    loadingId === cancelModal.appointment?.AppointmentId
                  }
                >
                  {loadingId === cancelModal.appointment?.AppointmentId
                    ? "Đang xử lý..."
                    : "Xác nhận hủy"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="section-head">
          <div>
            <div className="eyebrow">Appointments</div>
            <h2 className="section-title">Lịch hẹn của tôi</h2>
            <p className="muted">
              Theo dõi dịch vụ, kỹ thuật viên, trạng thái lịch hẹn, thanh toán
              và hoàn tiền.
            </p>
          </div>

          <Link className="btn" to="/customer/booking">
            Đặt lịch mới
          </Link>
        </div>

        <div className="stats">
          <div
            className="dashboard-card"
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("ALL")}
          >
            <h3>Tổng lịch hẹn</h3>
            <strong>{stats.total}</strong>
            <p className="muted">Tất cả lịch đã đặt</p>
          </div>

          <div
            className="dashboard-card"
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            <h3>Đang hoạt động</h3>
            <strong>{stats.active}</strong>
            <p className="muted">Chờ thanh toán / xác nhận / đang làm</p>
          </div>

          <div
            className="dashboard-card"
            style={{ cursor: "pointer" }}
            onClick={() => setStatusFilter("COMPLETED")}
          >
            <h3>Hoàn thành</h3>
            <strong>{stats.completed}</strong>
            <p className="muted">Lịch đã sử dụng dịch vụ</p>
          </div>

          <div className="dashboard-card">
            <h3>Tổng chi tiêu</h3>
            <strong>{formatMoney(stats.spent)}</strong>
            <p className="muted">Các lịch đã thanh toán</p>
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        {/* Tabs Phân loại Lịch hẹn */}
        <div
          className="service-history-tabs"
          style={{
            marginBottom: "20px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={statusFilter === "ALL" ? "active" : ""}
            onClick={() => setStatusFilter("ALL")}
          >
            Tất cả ({rows.length})
          </button>
          <button
            type="button"
            className={statusFilter === "PENDING" ? "active" : ""}
            onClick={() => setStatusFilter("PENDING")}
          >
            Chờ xác nhận (
            {
              rows.filter((r) => String(r.Status).toUpperCase() === "PENDING")
                .length
            }
            )
          </button>
          <button
            type="button"
            className={statusFilter === "PENDING_PAYMENT" ? "active" : ""}
            onClick={() => setStatusFilter("PENDING_PAYMENT")}
          >
            Chờ thanh toán (
            {
              rows.filter(
                (r) => String(r.Status).toUpperCase() === "PENDING_PAYMENT",
              ).length
            }
            )
          </button>
          <button
            type="button"
            className={statusFilter === "CONFIRMED" ? "active" : ""}
            onClick={() => setStatusFilter("CONFIRMED")}
          >
            Đã xác nhận (
            {
              rows.filter((r) => String(r.Status).toUpperCase() === "CONFIRMED")
                .length
            }
            )
          </button>
          <button
            type="button"
            className={statusFilter === "IN_PROGRESS" ? "active" : ""}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            Đang làm (
            {
              rows.filter((r) =>
                ["IN_PROGRESS", "CHECKED_IN"].includes(
                  String(r.Status).toUpperCase(),
                ),
              ).length
            }
            )
          </button>
          <button
            type="button"
            className={statusFilter === "COMPLETED" ? "active" : ""}
            onClick={() => setStatusFilter("COMPLETED")}
          >
            Hoàn thành (
            {
              rows.filter((r) => String(r.Status).toUpperCase() === "COMPLETED")
                .length
            }
            )
          </button>
          <button
            type="button"
            className={statusFilter === "CANCELLED" ? "active" : ""}
            onClick={() => setStatusFilter("CANCELLED")}
          >
            Đã hủy / Vắng mặt (
            {
              rows.filter((r) =>
                ["CANCELLED", "REFUND_PENDING", "NO_SHOW"].includes(
                  String(r.Status).toUpperCase(),
                ),
              ).length
            }
            )
          </button>
        </div>

        <div className="dashboard-card appointment-filter-card">
          <input
            className="filter-input"
            placeholder="Tìm mã lịch, dịch vụ, kỹ thuật viên, chi nhánh..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            className="filter-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            {PAYMENT_OPTIONS.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="ALL">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.BranchId} value={b.BranchId}>
                {b.BranchName}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
          >
            <option value="ALL">Tất cả KTV</option>
            {technicians.map((t) => (
              <option key={t.EmployeeId} value={t.EmployeeId}>
                {t.FullName}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="ALL">Tất cả dịch vụ</option>
            {services.map((s) => (
              <option key={s.ServiceId} value={s.ServiceId}>
                {s.ServiceName}
              </option>
            ))}
          </select>

          <input
            className="filter-input"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            className="filter-input"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <button className="card-btn" type="button" onClick={clearFilter}>
            Xóa lọc
          </button>
        </div>

        <div className="table-card">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Mã lịch</th>
                <th>Dịch vụ</th>
                <th>Kỹ thuật viên</th>
                <th>Ngày</th>
                <th>Giờ</th>
                <th>Thành tiền</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Đang tải lịch hẹn...
                  </td>
                </tr>
              )}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Không có lịch hẹn phù hợp
                  </td>
                </tr>
              )}

              {!loading &&
                filteredRows.map((r) => {
                  const status = String(r.Status || "").toUpperCase();
                  const paymentStatus = String(
                    r.PaymentStatus || "UNPAID",
                  ).toUpperCase();
                  const paymentMethod = String(
                    r.PaymentMethod || "",
                  ).toUpperCase();

                  return (
                    <tr
                      key={r.AppointmentId}
                      style={
                        r.CustomerPackageId
                          ? {
                              background:
                                "linear-gradient(135deg, #fdf2f8 0%, #ffffff 100%)",
                            }
                          : {}
                      }
                    >
                      <td>
                        <span className="code">
                          {getAppointmentCode(r.AppointmentId)}
                        </span>
                      </td>

                      <td>
                        <div className="service-cell">
                          <div
                            className="service-icon"
                            style={
                              r.CustomerPackageId
                                ? { background: "#fbcfe8", color: "#831843" }
                                : {}
                            }
                          >
                            {r.CustomerPackageId ? "📦" : "🌸"}
                          </div>
                          <div>
                            {r.CustomerPackageId ? (
                              <div>
                                <span
                                  style={{
                                    background: "#db2777",
                                    color: "#ffffff",
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    letterSpacing: "0.5px",
                                  }}
                                >
                                  GÓI COMBO TRỌN GÓI
                                </span>
                                <div
                                  className="service-name"
                                  style={{
                                    color: "#831843",
                                    fontWeight: 800,
                                    marginTop: "2px",
                                  }}
                                >
                                  {r.CustomerPackageName ||
                                    r.ServiceName ||
                                    "Gói Combo Spa"}
                                </div>
                                {r.ServiceNames && (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "4px",
                                      marginTop: "4px",
                                    }}
                                  >
                                    {r.ServiceNames.split(",").map(
                                      (sName, sIdx) => (
                                        <span
                                          key={sIdx}
                                          style={{
                                            background: "#fce7f3",
                                            color: "#9d174d",
                                            border: "1px solid #fbcfe8",
                                            padding: "1px 6px",
                                            borderRadius: "6px",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                          }}
                                        >
                                          ✓ {sName.trim()}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="service-name">
                                  {r.ServiceNames || r.ServiceName || "Dịch vụ"}
                                </div>
                                <div className="muted">
                                  {r.ServiceCount > 1
                                    ? `${r.ServiceCount} dịch vụ trong lịch hẹn`
                                    : r.Notes
                                      ? `Ghi chú: ${r.Notes}`
                                      : "Dịch vụ chăm sóc sắc đẹp"}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <b>
                          {r.EmployeeName ||
                            (r.CustomerPackageId
                              ? "Hệ thống tự động xếp KTV"
                              : "Chưa phân công")}
                        </b>
                        {r.BranchName && (
                          <div className="muted">{r.BranchName}</div>
                        )}
                      </td>

                      <td>{formatDate(r.AppointmentDate)}</td>

                      <td>
                        <b>
                          {formatTime(r.StartTime)} - {formatTime(r.EndTime)}
                        </b>
                      </td>

                      <td>
                        {r.CustomerPackageId ? (
                          <span
                            style={{
                              color: "#059669",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                            }}
                          >
                            📦 Trọn gói Combo
                          </span>
                        ) : (
                          <>
                            <b>
                              {formatMoney(
                                r.FinalAmount || r.TotalAmount || r.TotalPrice,
                              )}
                            </b>
                            {Number(r.DiscountAmount || 0) > 0 && (
                              <div className="muted">
                                Giảm {formatMoney(r.DiscountAmount)}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-badge status-${status.toLowerCase()}`}
                        >
                          {statusText(status)}
                        </span>
                      </td>

                      <td>
                        {r.CustomerPackageId ? (
                          <span
                            className="payment-badge"
                            style={{
                              backgroundColor: "#dcfce7",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "0.78rem",
                              fontWeight: "700",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            💳 Đã thanh toán thành công (Combo)
                          </span>
                        ) : (
                          <span
                            className={`payment-badge ${
                              paymentStatus === "PAID"
                                ? "payment-paid"
                                : paymentStatus === "REFUND_PENDING"
                                  ? "status-pending"
                                  : "payment-unpaid"
                            }`}
                          >
                            {paymentText(paymentStatus)}
                          </span>
                        )}

                        {r.RefundStatus && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            Hoàn tiền: {refundText(r.RefundStatus)}
                          </div>
                        )}

                        {r.CancelReason && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            Lý do hủy: {r.CancelReason}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="action-row">
                          {r.CustomerPackageId ? (
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <button
                                type="button"
                                className="btn-detail"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #db2777, #be185d)",
                                  color: "#ffffff",
                                  border: "none",
                                  fontWeight: 700,
                                  borderRadius: "8px",
                                  padding: "6px 12px",
                                  boxShadow: "0 2px 8px rgba(219,39,119,0.25)",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  navigate(
                                    `/customer/packages?packageId=${r.CustomerPackageId}`,
                                  )
                                }
                                title="Bấm để chuyển đến chi tiết gói Combo này"
                              >
                                📦 Chi tiết Combo →
                              </button>
                              {status === "COMPLETED" && (
                                <button
                                  type="button"
                                  style={{
                                    background: "#ec4899",
                                    color: "#ffffff",
                                    border: "none",
                                    fontWeight: 700,
                                    borderRadius: "8px",
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(236,72,153,0.3)",
                                  }}
                                  onClick={() =>
                                    navigate(`/customer/packages?tab=reviews`)
                                  }
                                  title="Đánh giá Gói Combo & KTV"
                                >
                                  ⭐ Đánh giá Combo
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <Link
                                className="btn-detail"
                                to={`/customer/appointments/${r.AppointmentId}`}
                              >
                                Chi tiết
                              </Link>

                              {status === "PENDING" && (
                                <button
                                  type="button"
                                  className="btn-pay"
                                  style={{
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                  }}
                                  onClick={() => handleConfirm(r.AppointmentId)}
                                  disabled={loadingId === r.AppointmentId}
                                >
                                  {loadingId === r.AppointmentId
                                    ? "..."
                                    : "Xác nhận"}
                                </button>
                              )}

                              {canPay(r) && (
                                <button
                                  type="button"
                                  className="btn-pay"
                                  onClick={() =>
                                    navigate(
                                      `/customer/payment/${r.AppointmentId}`,
                                    )
                                  }
                                >
                                  Thanh toán
                                </button>
                              )}

                              {canReschedule(r) && (
                                <button
                                  type="button"
                                  className="btn-detail"
                                  onClick={() =>
                                    navigate(
                                      `/customer/reschedule/${r.AppointmentId}`,
                                    )
                                  }
                                >
                                  Đổi lịch
                                </button>
                              )}

                              {canReview(r) && (
                                <button
                                  type="button"
                                  className="btn-pay"
                                  onClick={() =>
                                    navigate(
                                      `/customer/reviews?appointmentId=${r.AppointmentId}`,
                                    )
                                  }
                                >
                                  Đánh giá
                                </button>
                              )}

                              {status === "COMPLETED" && (
                                <button
                                  type="button"
                                  className="btn-detail"
                                  onClick={() =>
                                    navigate(
                                      `/customer/booking?serviceId=${r.ServiceId || ""}&employeeId=${r.EmployeeId || ""}`,
                                    )
                                  }
                                >
                                  Đặt lại
                                </button>
                              )}

                              {canCancel(r) && (
                                <button
                                  type="button"
                                  className="btn-cancel"
                                  disabled={loadingId === r.AppointmentId}
                                  onClick={() => openCancelModal(r)}
                                >
                                  Hủy
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <div className="table-footer">
            <span>
              Hiển thị {filteredRows.length} / {rows.length} lịch hẹn
            </span>
            <span className="page-dot">1</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
