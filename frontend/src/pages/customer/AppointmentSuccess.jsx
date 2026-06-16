import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function readStoredAppointment() {
  try {
    const raw = sessionStorage.getItem("lastAppointment");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
              Lịch hẹn của bạn đã được ghi nhận. Vui lòng đến đúng giờ hoặc
              kiểm tra lại thông tin bên dưới.
            </p>
          </div>

          <div className="success-body">
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
