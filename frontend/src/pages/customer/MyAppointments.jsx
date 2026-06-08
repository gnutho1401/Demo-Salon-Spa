import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function MyAppointments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  async function loadAppointments() {
    try {
      setError("");
      const res = await axiosClient.get("/appointments/my");
      setRows(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được lịch hẹn");
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const statusOk =
        statusFilter === "ALL" ||
        String(r.Status || "").toUpperCase() === statusFilter;

      const dateOk =
        !dateFilter ||
        String(r.AppointmentDate || "").slice(0, 10) === dateFilter;

      const text = keyword.trim().toLowerCase();

      const keywordOk =
        !text ||
        String(r.ServiceName || "")
          .toLowerCase()
          .includes(text) ||
        String(r.EmployeeName || "")
          .toLowerCase()
          .includes(text) ||
        String(r.Notes || "")
          .toLowerCase()
          .includes(text) ||
        getAppointmentCode(r.AppointmentId).toLowerCase().includes(text);

      return statusOk && dateOk && keywordOk;
    });
  }, [rows, statusFilter, keyword, dateFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "CONFIRMED",
    ).length;
    const pending = rows.filter(
      (r) => String(r.Status || "").toUpperCase() === "PENDING_PAYMENT",
    ).length;
    const spent = rows
      .filter((r) => String(r.PaymentStatus || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + Number(r.FinalAmount || r.Price || 0), 0);

    return { total, confirmed, pending, spent };
  }, [rows]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatDate(value) {
    if (!value) return "Chưa có";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function formatTime(value) {
    if (!value) return "";

    const text = String(value);

    if (text.includes("T")) {
      const afterT = text.split("T")[1];
      return afterT ? afterT.slice(0, 5) : "";
    }

    if (text.includes(":")) {
      return text.slice(0, 5);
    }

    return text;
  }

  function getAppointmentCode(id) {
    return `AP${String(id).padStart(5, "0")}`;
  }

  function canPay(status, paymentStatus) {
    const s = String(status || "").toUpperCase();
    const p = String(paymentStatus || "").toUpperCase();
    return s !== "CANCELLED" && s !== "COMPLETED" && p !== "PAID";
  }

  function canCancel(status) {
    const s = String(status || "").toUpperCase();
    return s === "PENDING_PAYMENT" || s === "CONFIRMED";
  }

  function getStatusText(status) {
    const s = String(status || "").toUpperCase();
    if (s === "PENDING_PAYMENT") return "Chờ thanh toán";
    if (s === "CONFIRMED") return "Đã xác nhận";
    if (s === "COMPLETED") return "Hoàn thành";
    if (s === "CANCELLED") return "Đã hủy";
    return status || "Chưa rõ";
  }

  function getPaymentText(paymentStatus) {
    const p = String(paymentStatus || "").toUpperCase();
    if (p === "PAID") return "Đã thanh toán";
    if (p === "UNPAID") return "Chưa thanh toán";
    if (p === "PENDING") return "Đang chờ thanh toán";
    if (p === "FAILED") return "Thanh toán thất bại";
    if (p === "PENDING") return "Đang xử lý";
    if (p === "REFUNDED") return "Đã hoàn tiền";
    return paymentStatus || "Chưa thanh toán";
  }

  async function handleCancel(appointmentId) {
    const ok = window.confirm("Bạn có chắc muốn hủy lịch hẹn này không?");
    if (!ok) return;

    try {
      setLoadingId(appointmentId);
      setError("");
      setMessage("");

      const reason = window.prompt("Nhập lý do hủy lịch hẹn:");
      if (!reason || !reason.trim()) {
        setError("Vui lòng nhập lý do hủy lịch");
        return;
      }

      await axiosClient.delete(`/appointments/${appointmentId}`, {
        data: { reason },
      });

      setMessage("Hủy lịch hẹn thành công");
      await loadAppointments();
    } catch (err) {
      setError(err.response?.data?.message || "Hủy lịch hẹn thất bại");
    } finally {
      setLoadingId(null);
    }
  }

  function handlePay(appointmentId) {
    navigate(`/customer/payment/${appointmentId}`);
  }

  return (
    <CustomerLayout>
      <style>{`
        .appointments-page {
          position: relative;
          min-height: 100vh;
          padding: 26px 0 60px;
          color: #f8f7ff;
          background:
            radial-gradient(circle at 15% 10%, rgba(255, 0, 128, .22), transparent 28%),
            radial-gradient(circle at 85% 20%, rgba(120, 77, 255, .28), transparent 30%),
            radial-gradient(circle at 50% 90%, rgba(0, 217, 255, .12), transparent 28%),
            linear-gradient(135deg, #090518 0%, #120a2b 45%, #1a0730 100%);
          overflow: hidden;
        }

        .appointments-page::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.25) 1px, transparent 1px);
          background-size: 38px 38px;
          opacity: .16;
          animation: starMove 18s linear infinite;
          pointer-events: none;
        }

        .appointments-page > * {
          position: relative;
          z-index: 1;
        }

        .appointments-header {
          position: relative;
          overflow: hidden;
          min-height: 230px;
          border-radius: 34px;
          padding: 42px 48px;
          margin-bottom: 22px;
          border: 1px solid rgba(255, 96, 190, .55);
          background:
            linear-gradient(90deg, rgba(15, 8, 40, .95), rgba(35, 14, 68, .72), rgba(255, 67, 150, .1)),
            url("https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80");
          background-size: cover;
          background-position: center right;
          box-shadow:
            0 0 0 1px rgba(255,255,255,.06) inset,
            0 28px 90px rgba(255, 0, 128, .25),
            0 0 60px rgba(150, 87, 255, .18);
        }

        .appointments-header::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 80% 30%, rgba(255, 85, 170, .32), transparent 22%),
            linear-gradient(90deg, rgba(9, 5, 24, .92), rgba(9, 5, 24, .45), transparent);
        }

        .header-content {
          position: relative;
          z-index: 2;
          max-width: 760px;
        }

        .appointments-header h2 {
          margin: 0;
          font-size: 48px;
          font-weight: 950;
          letter-spacing: -1px;
          background: linear-gradient(90deg, #ffffff, #ff7bc0, #8fd3ff);
          -webkit-background-clip: text;
          color: transparent;
          text-shadow: 0 0 28px rgba(255, 85, 170, .45);
        }

        .appointments-header p {
          margin: 10px 0 0;
          color: #ded8ff;
          font-size: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(150px, 1fr));
          gap: 16px;
          margin-top: 28px;
          max-width: 850px;
        }

        .stat-card {
          padding: 18px;
          border-radius: 22px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.13);
          backdrop-filter: blur(16px);
          box-shadow: 0 18px 45px rgba(0,0,0,.22);
          transition: .25s ease;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 28px rgba(255, 71, 166, .32);
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          font-size: 22px;
          background: linear-gradient(135deg, #ff2f92, #7c3cff);
          box-shadow: 0 0 22px rgba(255, 47, 146, .45);
        }

        .stat-number {
          font-size: 24px;
          font-weight: 950;
          color: #fff;
        }

        .stat-label {
          color: #cfc8ee;
          font-size: 13px;
          margin-top: 3px;
        }

        .alert-success,
        .alert-error {
          padding: 15px 18px;
          border-radius: 18px;
          margin-bottom: 18px;
          font-weight: 800;
          backdrop-filter: blur(12px);
        }

        .alert-success {
          background: rgba(34, 197, 94, .14);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, .35);
        }

        .alert-error {
          background: rgba(244, 63, 94, .14);
          color: #fda4af;
          border: 1px solid rgba(244, 63, 94, .35);
        }

        .filter-card {
          display: grid;
          grid-template-columns: 1.5fr 240px 210px 150px;
          gap: 14px;
          align-items: center;
          margin-bottom: 18px;
          padding: 18px;
          border-radius: 28px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255, 120, 200, .32);
          backdrop-filter: blur(18px);
          box-shadow:
            0 18px 55px rgba(0,0,0,.24),
            0 0 35px rgba(255, 47, 146, .14);
        }

        .filter-select,
        .filter-input {
          height: 50px;
          padding: 0 18px;
          border-radius: 17px;
          border: 1px solid rgba(255,255,255,.15);
          outline: none;
          min-width: 0;
          background: rgba(255,255,255,.1);
          color: #fff;
          font-weight: 800;
          box-shadow: 0 0 0 rgba(255, 47, 146, 0);
          transition: .25s ease;
        }

        .filter-select option {
          background: #160b2d;
          color: #fff;
        }

        .filter-input::placeholder {
          color: #bcb4d8;
        }

        .filter-select:focus,
        .filter-input:focus {
          border-color: #ff4fa3;
          box-shadow: 0 0 0 4px rgba(255, 79, 163, .18), 0 0 25px rgba(255, 79, 163, .2);
        }

        .btn-clear {
          height: 50px;
          border: none;
          border-radius: 17px;
          color: #fff;
          font-weight: 950;
          cursor: pointer;
          background: linear-gradient(135deg, #ff2f92, #7c3cff);
          box-shadow: 0 16px 38px rgba(255, 47, 146, .26);
          transition: .25s ease;
        }

        .btn-clear:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 32px rgba(255, 47, 146, .55);
        }

        .table-card {
          overflow: hidden;
          border-radius: 30px;
          background: rgba(12, 8, 35, .78);
          border: 1px solid rgba(255, 120, 200, .35);
          backdrop-filter: blur(22px);
          box-shadow:
            0 28px 90px rgba(0,0,0,.35),
            0 0 50px rgba(255, 47, 146, .15);
        }

        .appointments-table {
          width: 100%;
          border-collapse: collapse;
        }

        .appointments-table th {
          background: rgba(255,255,255,.07);
          color: #efeaff;
          font-size: 13px;
          text-align: left;
          padding: 17px 14px;
          border-bottom: 1px solid rgba(255,255,255,.1);
          white-space: nowrap;
        }

        .appointments-table td {
          padding: 17px 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          color: #f7f4ff;
          vertical-align: middle;
        }

        .appointments-table tr {
          transition: .22s ease;
        }

        .appointments-table tbody tr:hover {
          background: rgba(255, 47, 146, .09);
          transform: scale(1.006);
        }

        .appointments-table tr:last-child td {
          border-bottom: none;
        }

        .code {
          font-weight: 950;
          color: #ff4fa3;
          text-shadow: 0 0 12px rgba(255, 79, 163, .45);
        }

        .service-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .service-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255, 47, 146, .25), rgba(124, 60, 255, .18));
          border: 1px solid rgba(255,255,255,.1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 18px rgba(255, 47, 146, .22);
        }

        .service-name {
          font-weight: 950;
          color: #fff;
        }

        .muted {
          color: #aaa3c8;
          font-size: 13px;
          margin-top: 4px;
        }

        .status-badge,
        .payment-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .status-pending {
          background: rgba(245, 158, 11, .18);
          color: #fbbf24;
          box-shadow: 0 0 18px rgba(245, 158, 11, .16);
        }

        .status-confirmed {
          background: rgba(34, 197, 94, .17);
          color: #86efac;
          box-shadow: 0 0 18px rgba(34, 197, 94, .15);
        }

        .status-completed {
          background: rgba(14, 165, 233, .16);
          color: #7dd3fc;
        }

        .status-cancelled {
          background: rgba(244, 63, 94, .16);
          color: #fda4af;
        }

        .payment-paid {
          background: rgba(34, 197, 94, .17);
          color: #86efac;
        }

        .payment-unpaid {
          background: rgba(245, 158, 11, .18);
          color: #fbbf24;
        }

        .action-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-detail,
        .btn-pay,
        .btn-cancel,
        .btn-again {
          border: none;
          border-radius: 13px;
          padding: 10px 13px;
          font-weight: 950;
          cursor: pointer;
          color: white;
          text-decoration: none;
          transition: .22s ease;
          white-space: nowrap;
        }

        .btn-detail {
          background: linear-gradient(135deg, #6d5dfc, #9d4edd);
          box-shadow: 0 0 18px rgba(109, 93, 252, .32);
        }

        .btn-pay {
          background: linear-gradient(135deg, #ff2f92, #ff5f6d);
          box-shadow: 0 0 18px rgba(255, 47, 146, .32);
        }

        .btn-cancel {
          background: linear-gradient(135deg, #ff3b30, #ff2f92);
          box-shadow: 0 0 18px rgba(255, 59, 48, .28);
        }

        .btn-again {
          background: linear-gradient(135deg, #13a06f, #22c55e);
          box-shadow: 0 0 18px rgba(34, 197, 94, .25);
        }

        .btn-detail:hover,
        .btn-pay:hover,
        .btn-cancel:hover,
        .btn-again:hover {
          transform: translateY(-3px);
          filter: brightness(1.12);
        }

        .btn-pay:disabled,
        .btn-cancel:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .empty-row {
          text-align: center;
          color: #cfc8ee;
          padding: 36px !important;
        }

        .table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          color: #cfc8ee;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .page-dot {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 47, 146, .16);
          border: 1px solid rgba(255, 47, 146, .38);
          color: #fff;
          box-shadow: 0 0 18px rgba(255, 47, 146, .25);
        }

        @keyframes starMove {
          from { transform: translateY(0); }
          to { transform: translateY(-80px); }
        }

        @media (max-width: 1100px) {
          .filter-card,
          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .table-card {
            overflow-x: auto;
          }

          .appointments-table {
            min-width: 1100px;
          }
        }

        @media (max-width: 700px) {
          .appointments-header {
            padding: 30px 24px;
          }

          .appointments-header h2 {
            font-size: 34px;
          }

          .filter-card,
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="appointments-page">
        <div className="appointments-header">
          <div className="header-content">
            <h2>Lịch hẹn của tôi ✨</h2>
            <p>
              Theo dõi lịch hẹn, trạng thái xác nhận và trạng thái thanh toán.
            </p>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Tổng lịch hẹn</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-number">{stats.confirmed}</div>
                <div className="stat-label">Đã xác nhận</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-number">{stats.pending}</div>
                <div className="stat-label">Đang chờ</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💳</div>
                <div className="stat-number">{formatMoney(stats.spent)}</div>
                <div className="stat-label">Tổng đã chi tiêu</div>
              </div>
            </div>
          </div>
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <div className="filter-card">
          <input
            className="filter-input"
            placeholder="🔍 Tìm theo mã lịch, dịch vụ, kỹ thuật viên..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Đang chờ</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <input
            className="filter-input"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          <button
            className="btn-clear"
            type="button"
            onClick={() => {
              setKeyword("");
              setDateFilter("");
              setStatusFilter("ALL");
            }}
          >
            Bộ lọc
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
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan="9">
                    Bạn chưa có lịch hẹn nào
                  </td>
                </tr>
              )}

              {filteredRows.map((r) => {
                const status = String(r.Status || "").toUpperCase();
                const paymentStatus = String(
                  r.PaymentStatus || "UNPAID",
                ).toUpperCase();

                return (
                  <tr key={r.AppointmentId}>
                    <td>
                      <span className="code">
                        {getAppointmentCode(r.AppointmentId)}
                      </span>
                    </td>

                    <td>
                      <div className="service-cell">
                        <div className="service-icon">🌸</div>
                        <div>
                          <div className="service-name">
                            {r.ServiceName || "Dịch vụ"}
                          </div>
                          <div className="muted">
                            {r.Notes
                              ? `Ghi chú: ${r.Notes}`
                              : "Dịch vụ chăm sóc cao cấp"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>{r.EmployeeName || "Chưa có"}</td>

                    <td>{formatDate(r.AppointmentDate)}</td>

                    <td>
                      <b>
                        {formatTime(r.StartTime)} - {formatTime(r.EndTime)}
                      </b>
                    </td>

                    <td>{formatMoney(r.FinalAmount || r.Price)}</td>

                    <td>
                      <span
                        className={`status-badge status-${status.toLowerCase()}`}
                      >
                        {status === "PENDING"
                          ? "⏳ "
                          : status === "CONFIRMED"
                            ? "✅ "
                            : ""}
                        {getStatusText(status)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`payment-badge ${
                          paymentStatus === "PAID"
                            ? "payment-paid"
                            : "payment-unpaid"
                        }`}
                      >
                        {paymentStatus === "PAID" ? "💳 " : "⚠️ "}
                        {getPaymentText(paymentStatus)}
                      </span>
                    </td>

                    <td>
                      <div className="action-row">
                        <Link
                          className="btn-detail"
                          to={`/customer/appointments/${r.AppointmentId}`}
                        >
                          Chi tiết
                        </Link>

                        {canPay(r.Status, r.PaymentStatus) && (
                          <button
                            type="button"
                            className="btn-pay"
                            disabled={loadingId === r.AppointmentId}
                            onClick={() => handlePay(r.AppointmentId)}
                          >
                            {loadingId === r.AppointmentId
                              ? "Đang xử lý..."
                              : "Thanh toán"}
                          </button>
                        )}

                        {String(r.Status || "").toUpperCase() ===
                          "COMPLETED" && (
                          <>
                            <button
                              type="button"
                              className="btn-pay"
                              onClick={() =>
                                navigate(
                                  `/customer/feedback?appointmentId=${r.AppointmentId}&serviceId=${r.ServiceId || ""}`,
                                )
                              }
                            >
                              Đánh giá
                            </button>

                            <button
                              type="button"
                              className="btn-again"
                              onClick={() =>
                                navigate(
                                  `/customer/booking?serviceId=${r.ServiceId || ""}&employeeId=${r.EmployeeId || ""}`,
                                )
                              }
                            >
                              Đặt lại
                            </button>
                          </>
                        )}

                        {canCancel(r.Status) && (
                          <button
                            type="button"
                            className="btn-cancel"
                            disabled={loadingId === r.AppointmentId}
                            onClick={() => handleCancel(r.AppointmentId)}
                          >
                            {loadingId === r.AppointmentId
                              ? "Đang hủy..."
                              : paymentStatus === "PAID"
                                ? "Hủy & hoàn"
                                : "Hủy"}
                          </button>
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
              Hiển thị 1 - {filteredRows.length} của {filteredRows.length} lịch
              hẹn
            </span>
            <span className="page-dot">1</span>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
