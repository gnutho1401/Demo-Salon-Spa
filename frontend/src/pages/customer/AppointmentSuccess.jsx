import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

const AUTO_CANCEL_MINUTES = 15;

function readStoredAppointment() {
  try {
    const raw = sessionStorage.getItem("lastAppointment");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function CountdownBanner({ appointment }) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  const status = String(appointment?.Status || appointment?.status || "").toUpperCase();
  const isPending = status === "PENDING_PAYMENT";

  useEffect(() => {
    if (!isPending) return;

    // Ưu tiên dùng thời điểm client lưu khi đặt lịch (tránh lệch timezone server)
    // Fallback sang CreatedAt của server nếu không có
    let createdMs;
    const storedTs = sessionStorage.getItem("bookingCreatedAt");
    if (storedTs) {
      createdMs = Number(storedTs);
      // Xóa sau lần đầu dùng để không ảnh hưởng lần reload tiếp theo
      sessionStorage.removeItem("bookingCreatedAt");
    } else {
      const createdAt = appointment?.CreatedAt || appointment?.createdAt;
      if (createdAt) {
        const dateWithZ = new Date(createdAt);
        // Nếu dateWithZ lớn hơn thời gian hiện tại nhiều hơn thời gian tự hủy (do lệch múi giờ UTC vs Local)
        if (dateWithZ.getTime() - Date.now() > AUTO_CANCEL_MINUTES * 60 * 1000) {
          const cleanStr = typeof createdAt === "string" ? createdAt.replace(/Z$/, "") : createdAt;
          createdMs = new Date(cleanStr).getTime();
        } else {
          createdMs = dateWithZ.getTime();
        }
      } else {
        createdMs = Date.now();
      }
    }

    const deadline = createdMs + AUTO_CANCEL_MINUTES * 60 * 1000;

    function tick() {
      const remaining = Math.floor((deadline - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        setExpired(true);
      } else {
        setSecondsLeft(remaining);
        setExpired(false);
      }
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [appointment, isPending]);


  if (!isPending || secondsLeft === null) return null;

  const id = appointment?.AppointmentId || appointment?.appointmentId || appointment?.id;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      style={{
        margin: "0 0 20px",
        padding: "18px 24px",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: expired
          ? "linear-gradient(135deg, #ef4444, #dc2626)"
          : secondsLeft <= 120
          ? "linear-gradient(135deg, #f97316, #ea580c)"
          : "linear-gradient(135deg, #ef4f83, #ff5ea8)",
        color: "#fff",
        fontWeight: 700,
        boxShadow: expired
          ? "0 8px 24px rgba(239,68,68,0.3)"
          : "0 8px 24px rgba(239,79,131,0.28)",
        animation: "pulse-countdown 2s ease-in-out infinite",
      }}
    >
      <span style={{ fontSize: "1.8rem" }}>{expired ? "❌" : "⏰"}</span>
      <div style={{ flex: 1 }}>
        {expired ? (
          <>
            <div style={{ fontSize: "1.05rem" }}>Lịch hẹn đã hết thời gian thanh toán!</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.9, marginTop: 4 }}>
              Hệ thống đã tự động hủy lịch hẹn này. Bạn có thể đặt lịch lại ngay.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "1.05rem" }}>
              ⚡ Vui lòng thanh toán trong&nbsp;
              <strong style={{ fontSize: "1.3rem" }}>{mm}:{ss}</strong>
              &nbsp;— Lịch sẽ bị hủy tự động nếu chưa thanh toán!
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: 4 }}>
              Lịch hẹn được giữ tối đa {AUTO_CANCEL_MINUTES} phút sau khi đặt.
            </div>
          </>
        )}
      </div>
      {!expired && (
        <div
          style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: "10px 20px",
            fontSize: "1.8rem",
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            minWidth: 90,
            textAlign: "center",
          }}
        >
          {mm}:{ss}
        </div>
      )}
      {!expired && id && (
        <button
          type="button"
          onClick={() => navigate(`/customer/payment/${id}`)}
          style={{
            background: "rgba(255,255,255,0.25)",
            border: "2px solid rgba(255,255,255,0.5)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 10,
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "0.9rem",
            whiteSpace: "nowrap",
          }}
        >
          💳 Thanh toán ngay
        </button>
      )}
    </div>
  );
}

export default function AppointmentSuccess() {
  const { appointmentId } = useParams();
  const location = useLocation();
  const [appointment, setAppointment] = useState(
    () => location.state?.appointment || readStoredAppointment(),
  );
  const [loading, setLoading] = useState(
    () => !(location.state?.appointment || readStoredAppointment()),
  );

  useEffect(() => {
    if (appointment || !appointmentId) return;

    setLoading(true);
    axiosClient
      .get(`/appointments/${appointmentId}`)
      .then((res) => setAppointment(res.data.data || res.data))
      .catch(() => setAppointment(null))
      .finally(() => setLoading(false));
  }, [appointmentId, appointment]);

  if (loading) {
    return (
      <CustomerLayout>
        <div style={{ padding: 40 }}>
          <p>Đang tải thông tin lịch hẹn...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (!appointment) {
    return (
      <CustomerLayout>
        <div style={{ padding: 40 }}>
          <h2>Không tìm thấy thông tin lịch hẹn</h2>
          <Link to="/customer/booking">Quay lại đặt lịch</Link>
        </div>
      </CustomerLayout>
    );
  }

  const id =
    appointment.AppointmentId || appointment.appointmentId || appointment.id;

  const appointmentCode = `AP${String(id).padStart(5, "0")}`;
  const isPending = String(appointment?.Status || appointment?.status || "").toUpperCase() === "PENDING_PAYMENT";

  return (
    <CustomerLayout>
      <style>{`
        .success-wrap {
          min-height: 75vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px 0 50px;
          background:
            radial-gradient(circle at top left, rgba(255, 63, 134, 0.12), transparent 35%),
            radial-gradient(circle at bottom right, rgba(255, 122, 173, 0.12), transparent 35%);
        }

        .success-card {
          width: 100%;
          max-width: 820px;
          background: white;
          border-radius: 34px;
          border: 1px solid #f6d7e4;
          box-shadow: 0 28px 70px rgba(255, 63, 134, 0.16);
          overflow: hidden;
        }

        .success-top {
          text-align: center;
          padding: 42px 38px 26px;
          background: linear-gradient(135deg, #fff5fa, #ffffff);
        }

        .success-icon {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          margin: 0 auto 20px;
          display: grid;
          place-items: center;
          font-size: 44px;
          color: white;
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
          box-shadow: 0 18px 38px rgba(255, 63, 134, 0.3);
        }

        .success-title {
          margin: 0;
          font-size: 34px;
          font-weight: 900;
          color: #171725;
        }

        .success-subtitle {
          margin: 10px auto 0;
          max-width: 520px;
          color: #777;
          line-height: 1.6;
        }

        .success-body {
          padding: 28px 38px 38px;
        }

        .success-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .success-item {
          background: #fff8fb;
          border: 1px solid #f5d8e4;
          border-radius: 18px;
          padding: 16px;
        }

        .success-item span {
          display: block;
          color: #888;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .success-item strong {
          color: #222;
          font-size: 16px;
        }

        .success-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        @keyframes pulse-countdown {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }

        @media (max-width: 768px) {
          .success-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="success-wrap">
        <div className="success-card">
          <div className="success-top">
            <div className="success-icon">✓</div>
            <h1 className="success-title">Đặt lịch thành công!</h1>
            <p className="success-subtitle">
              {isPending
                ? "Lịch hẹn đã được tạo. Vui lòng thanh toán để xác nhận lịch hẹn."
                : "Lịch hẹn của bạn đã được ghi nhận. Vui lòng đến đúng giờ hoặc kiểm tra lại thông tin bên dưới."}
            </p>
          </div>

          <div className="success-body">
            {/* Banner đếm ngược 15 phút */}
            <CountdownBanner appointment={appointment} />

            <div className="success-grid">
              <div className="success-item">
                <span>Mã lịch hẹn</span>
                <strong>{appointmentCode}</strong>
              </div>
              <div className="success-item">
                <span>Trạng thái</span>
                <strong>
                  {appointment.Status || appointment.status || "PENDING"}
                </strong>
              </div>
              <div className="success-item">
                <span>Ngày hẹn</span>
                <strong>
                  {appointment.AppointmentDate || appointment.appointmentDate
                    ? new Date(
                        appointment.AppointmentDate ||
                          appointment.appointmentDate,
                      ).toLocaleDateString("vi-VN")
                    : "Chưa có"}
                </strong>
              </div>
              <div className="success-item">
                <span>Giờ hẹn</span>
                <strong>
                  {String(
                    appointment.StartTime || appointment.startTime || "",
                  ).slice(0, 5)}
                </strong>
              </div>
              <div className="success-item">
                <span>Kỹ thuật viên</span>
                <strong>
                  {appointment.EmployeeName ||
                    appointment.employeeName ||
                    "Đang cập nhật"}
                </strong>
              </div>
              <div className="success-item">
                <span>Dịch vụ</span>
                <strong>
                  {appointment.ServiceName ||
                    appointment.serviceName ||
                    appointment.ServiceNames ||
                    "Đang cập nhật"}
                </strong>
              </div>
            </div>

            <div className="success-actions">
              {isPending && (
                <Link className="btn" to={`/customer/payment/${id}`}>
                  💳 Thanh toán ngay
                </Link>
              )}
              <Link className="btn" to={`/customer/appointments/${id}`}>
                Xem chi tiết lịch hẹn
              </Link>
              <Link className="btn btn-outline" to="/customer/appointments">
                Danh sách lịch hẹn
              </Link>
              <Link className="btn btn-outline" to="/customer">
                Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
