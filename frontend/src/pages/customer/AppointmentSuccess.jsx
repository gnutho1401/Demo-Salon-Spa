import { Link, useLocation } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";

export default function AppointmentSuccess() {
  const location = useLocation();
  const appointment =
    location.state?.appointment ||
    JSON.parse(sessionStorage.getItem("lastAppointment"));

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

        .success-code {
          margin: 24px auto 0;
          width: fit-content;
          padding: 12px 22px;
          border-radius: 999px;
          background: #fff0f6;
          color: #ff3f86;
          font-weight: 900;
          border: 1px solid #ffd7e6;
          letter-spacing: 1px;
        }

        .success-body {
          padding: 28px 38px 38px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .info-box {
          border: 1px solid #f2dbe5;
          border-radius: 20px;
          padding: 18px;
          background: #fff;
        }

        .info-box span {
          display: block;
          font-size: 13px;
          color: #888;
          margin-bottom: 8px;
        }

        .info-box strong {
          color: #222;
          font-size: 16px;
        }

        .status-badge {
          display: inline-block;
          padding: 8px 14px;
          border-radius: 999px;
          background: #fff4df;
          color: #b36b00;
          font-weight: 900;
          font-size: 13px;
        }

        .notice-box {
          border-radius: 22px;
          padding: 18px 20px;
          background: #fff7fb;
          border: 1px solid #ffd7e6;
          color: #8a4b62;
          line-height: 1.7;
          margin-bottom: 26px;
        }

        .success-actions {
          display: flex;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .btn-main,
        .btn-sub {
          text-decoration: none;
          border-radius: 16px;
          padding: 15px 26px;
          font-weight: 900;
        }

        .btn-main {
          color: white;
          background: linear-gradient(135deg, #ff3f86, #ff7aad);
          box-shadow: 0 14px 30px rgba(255, 63, 134, 0.25);
        }

        .btn-sub {
          color: #ff3f86;
          background: #fff0f6;
          border: 1px solid #ffd7e6;
        }

        @media (max-width: 760px) {
          .success-card {
            border-radius: 24px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .success-title {
            font-size: 28px;
          }
        }
      `}</style>

      <div className="success-wrap">
        <div className="success-card">
          <div className="success-top">
            <div className="success-icon">✓</div>

            <h1 className="success-title">Lịch hẹn đã được xác nhận</h1>

            <p className="success-subtitle">
              Cảm ơn bạn đã đặt lịch. Lịch hẹn của bạn đã được xác nhận và sẵn
              sàng phục vụ.
            </p>

            <div className="success-code">{appointmentCode}</div>
          </div>

          <div className="success-body">
            <div className="info-grid">
              <div className="info-box">
                <span>Dịch vụ</span>
                <strong>
                  {appointment.ServiceName ||
                    appointment.serviceName ||
                    "Dịch vụ đã đặt"}
                </strong>
              </div>

              <div className="info-box">
                <span>Trạng thái</span>
                <strong className="status-badge">
                  {appointment.status || "PENDING"}
                </strong>
              </div>

              <div className="info-box">
                <span>Ngày hẹn</span>
                <strong>
                  {appointment.AppointmentDate || appointment.appointmentDate}
                </strong>
              </div>

              <div className="info-box">
                <span>Giờ hẹn</span>
                <strong>
                  {String(
                    appointment.StartTime || appointment.startTime || "",
                  ).slice(0, 5)}
                </strong>
              </div>
            </div>

            <div className="notice-box">
              <strong>Lưu ý:</strong>
              <br />
              • Vui lòng đến trước giờ hẹn khoảng 10–15 phút.
              <br />
              • Lịch hẹn hiện đã được xác nhận sau khi thanh toán thành công.
              <br />• Bạn có thể xem lại lịch hẹn trong mục “Lịch hẹn của tôi”.
            </div>

            <div className="success-actions">
              <Link className="btn-main" to="/customer/appointments">
                Xem lịch hẹn
              </Link>

              <Link className="btn-sub" to="/customer/booking">
                Đặt thêm lịch khác
              </Link>

              <Link className="btn-sub" to="/">
                Quay về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
