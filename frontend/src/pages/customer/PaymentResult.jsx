import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const status = params.get("status");
  const appointmentId = params.get("appointmentId");

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(Boolean(appointmentId));

  useEffect(() => {
    async function loadAppointment() {
      if (!appointmentId) return;

      try {
        setLoading(true);
        const res = await axiosClient.get(`/appointments/${appointmentId}`);
        setAppointment(res.data.data || null);
      } catch (err) {
        console.error("Cannot reload appointment payment status", err);
      } finally {
        setLoading(false);
      }
    }

    loadAppointment();
  }, [appointmentId]);

  const paymentStatus = String(appointment?.PaymentStatus || "").toUpperCase();
  const appointmentStatus = String(appointment?.Status || "").toUpperCase();

  const success =
    status === "success" ||
    paymentStatus === "PAID" ||
    appointmentStatus === "CONFIRMED";

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function date(value) {
    if (!value) return "Chưa có";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function time(value) {
    if (!value) return "";
    const text = String(value);
    if (text.includes("T")) return text.split("T")[1]?.slice(0, 5) || "";
    return text.slice(0, 5);
  }

  return (
    <CustomerLayout>
      <div className="payment-result-page">
        <div
          className={`payment-result-card ${success ? "success" : "failed"}`}
        >
          <div className="result-icon-wrap">
            <div className="result-icon">{success ? "✓" : "!"}</div>
          </div>

          <div className="result-label">
            {success ? "Payment Successful" : "Payment Failed"}
          </div>

          <h1>
            {success
              ? "Thanh toán VNPay thành công"
              : "Thanh toán VNPay thất bại"}
          </h1>

          <p className="result-desc">
            {loading
              ? "Đang kiểm tra trạng thái thanh toán mới nhất..."
              : success
                ? "Giao dịch đã được hệ thống ghi nhận. Lịch hẹn của bạn đã được xác nhận."
                : "Giao dịch chưa hoàn tất hoặc VNPay đã từ chối thanh toán."}
          </p>

          <div className="result-info-grid">
            <div className="result-info-item">
              <span>Mã lịch hẹn</span>
              <strong>AP{String(appointmentId || "").padStart(5, "0")}</strong>
            </div>

            <div className="result-info-item">
              <span>Trạng thái lịch</span>
              <strong>{appointment?.Status || "Đang kiểm tra"}</strong>
            </div>

            <div className="result-info-item">
              <span>Trạng thái thanh toán</span>
              <strong>{appointment?.PaymentStatus || "UNPAID"}</strong>
            </div>

            <div className="result-info-item">
              <span>Tổng tiền</span>
              <strong>
                {money(
                  appointment?.FinalAmount ||
                    appointment?.InvoiceFinalAmount ||
                    appointment?.TotalAmount ||
                    appointment?.Price,
                )}
              </strong>
            </div>
          </div>

          {appointment && (
            <div className="appointment-summary-box">
              <h3>Thông tin lịch hẹn</h3>

              <div className="summary-row">
                <span>Dịch vụ</span>
                <b>
                  {appointment.ServiceName ||
                    appointment.ServiceNames ||
                    "Không có"}
                </b>
              </div>

              <div className="summary-row">
                <span>Kỹ thuật viên</span>
                <b>
                  {appointment.EmployeeName ||
                    appointment.TechnicianName ||
                    "Chưa có"}
                </b>
              </div>

              <div className="summary-row">
                <span>Ngày hẹn</span>
                <b>{date(appointment.AppointmentDate)}</b>
              </div>

              <div className="summary-row">
                <span>Thời gian</span>
                <b>
                  {time(appointment.StartTime)} - {time(appointment.EndTime)}
                </b>
              </div>
            </div>
          )}

          <div className="result-actions">
            <Link className="btn" to="/customer/appointments">
              Về lịch hẹn của tôi
            </Link>

            {appointmentId && (
              <Link
                className="btn btn-outline"
                to={`/customer/appointments/${appointmentId}`}
              >
                Xem chi tiết
              </Link>
            )}

            {!success && appointmentId && (
              <Link className="btn" to={`/customer/payment/${appointmentId}`}>
                Thanh toán lại
              </Link>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
