import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get("status");
  const appointmentId = params.get("appointmentId");
  const success = status === "success";

  return (
    <CustomerLayout>
      <style>{`
        .payment-result-page {
          min-height: 70vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
          background: linear-gradient(135deg, #fff7fb, #fff);
        }

        .payment-result-card {
          width: 100%;
          max-width: 680px;
          background: #fff;
          border: 1px solid #f7d6e4;
          border-radius: 28px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 24px 60px rgba(255, 75, 140, 0.14);
        }

        .result-icon {
          width: 88px;
          height: 88px;
          margin: 0 auto 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 900;
        }

        .result-icon.success {
          background: #e9fff3;
          color: #16a34a;
        }

        .result-icon.failed {
          background: #fff1f2;
          color: #e11d48;
        }

        .payment-result-card h2 {
          font-size: 34px;
          margin: 0 0 12px;
          color: #222;
        }

        .payment-result-card p {
          color: #666;
          font-size: 16px;
          line-height: 1.7;
        }

        .result-info {
          margin: 28px 0;
          background: #fff7fb;
          border: 1px dashed #f5b8d0;
          border-radius: 18px;
          padding: 20px;
          text-align: left;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f5dce7;
          gap: 16px;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-row span {
          color: #777;
        }

        .info-row b {
          color: #222;
        }

        .result-actions {
          display: flex;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 26px;
        }

        .btn-primary-result {
          background: #ef4b87;
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 14px 24px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(239, 75, 135, 0.25);
        }

        .btn-outline-result {
          background: #fff;
          color: #ef4b87;
          border: 1px solid #ef4b87;
          border-radius: 14px;
          padding: 14px 24px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .note-box {
          margin-top: 24px;
          background: #fffaf0;
          color: #8a5a00;
          border: 1px solid #fde7a8;
          border-radius: 16px;
          padding: 14px;
          font-size: 14px;
          text-align: left;
        }
      `}</style>

      <div className="payment-result-page">
        <div className="payment-result-card">
          <div className={`result-icon ${success ? "success" : "failed"}`}>
            {success ? "✓" : "!"}
          </div>

          <h2>{success ? "Thanh toán thành công" : "Thanh toán thất bại"}</h2>

          <p>
            {success
              ? "Cảm ơn bạn đã thanh toán. Lịch hẹn của bạn đã được ghi nhận trong hệ thống."
              : "Giao dịch chưa hoàn tất. Bạn có thể thử thanh toán lại hoặc quay về lịch hẹn của tôi."}
          </p>

          <div className="result-info">
            <div className="info-row">
              <span>Mã lịch hẹn</span>
              <b>#{appointmentId || "Không có"}</b>
            </div>

            <div className="info-row">
              <span>Trạng thái thanh toán</span>
              <b>{success ? "Đã thanh toán" : "Thất bại"}</b>
            </div>

            <div className="info-row">
              <span>Trạng thái lịch hẹn</span>
              <b>
                {success
                  ? "Đang chờ xác nhận / Đã xác nhận"
                  : "Chưa thanh toán"}
              </b>
            </div>
          </div>

          <div className="result-actions">
            <Link className="btn-primary-result" to="/customer/appointments">
              Về lịch hẹn của tôi
            </Link>

            {appointmentId && (
              <Link
                className="btn-outline-result"
                to={`/customer/appointments/${appointmentId}`}
              >
                Xem chi tiết lịch hẹn
              </Link>
            )}

            {!success && appointmentId && (
              <button
                className="btn-outline-result"
                onClick={() => navigate(`/customer/payment/${appointmentId}`)}
              >
                Thanh toán lại
              </button>
            )}
          </div>

          <div className="note-box">
            Lưu ý: Nếu bạn đã bị trừ tiền nhưng hệ thống chưa cập nhật, vui lòng
            liên hệ hotline hoặc kiểm tra lại lịch hẹn sau vài phút.
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
