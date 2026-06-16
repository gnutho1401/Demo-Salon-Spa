import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function PaymentPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appointment, setAppointment] = useState(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherId, setVoucherId] = useState(
    searchParams.get("voucherId") || null,
  );
  const [discount, setDiscount] = useState(
    Number(searchParams.get("discount") || 0),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    axiosClient
      .get(`/appointments/${appointmentId}`)
      .then((res) => setAppointment(res.data.data || res.data))
      .catch((err) =>
        setError(
          err.response?.data?.message || "Không tải được thông tin hóa đơn",
        ),
      )
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const subtotal = Number(
    appointment?.TotalAmount ??
      appointment?.InvoiceTotalAmount ??
      appointment?.Price ??
      appointment?.Amount ??
      0,
  );

  const serverDiscount = Number(
    appointment?.DiscountAmount ?? appointment?.Discount ?? 0,
  );

  const appliedDiscount = Number(discount || serverDiscount || 0);

  const final = Math.max(subtotal - appliedDiscount, 0);
  function money(v) {
    return Number(v || 0).toLocaleString("vi-VN") + "đ";
  }

  async function applyVoucher() {
    try {
      setError("");
      setMessage("");
      const res = await axiosClient.post("/vouchers/validate", {
        code: voucherCode,
        totalAmount: subtotal,
      });
      const data = res.data.data;
      setVoucherId(data.VoucherId || data.voucherId);
      setDiscount(Number(data.discountAmount || 0));
      setMessage(`Đã áp dụng voucher ${data.Code || voucherCode}`);
    } catch (err) {
      setDiscount(0);
      setVoucherId(null);
      setError(err.response?.data?.message || "Voucher không hợp lệ");
    }
  }

  async function payVnpay() {
    try {
      setPaying(true);
      setError("");
      setMessage("");
      const res = await axiosClient.post(
        `/payments/appointment/${appointmentId}/vnpay`,
        {
          voucherId,
        },
      );
      const data = res.data.data || res.data;
      if (!data?.paymentUrl && !data?.url) {
        throw new Error("VNPay không trả về paymentUrl");
      }
      window.location.href = data.paymentUrl || data.url;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Thanh toán VNPay thất bại",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <CustomerLayout>
      <style>{`.pay-page{padding:8px 0 40px}.pay-grid{display:grid;grid-template-columns:1fr 380px;gap:22px}.pay-card{background:#fff;border:1px solid #f5d8e4;border-radius:24px;padding:24px;box-shadow:0 18px 45px rgba(255,75,140,.08)}.pay-card h2{margin-top:0}.line{display:flex;justify-content:space-between;border-bottom:1px solid #f4e1e9;padding:12px 0}.line.total{font-size:22px;color:#ff3f86;font-weight:900;border-bottom:none}.voucher-row{display:flex;gap:8px}.voucher-row input{flex:1;border:1px solid #efd8e1;border-radius:14px;padding:12px}@media(max-width:900px){.pay-grid{grid-template-columns:1fr}}`}</style>
      <div className="pay-page">
        <div className="section-head">
          <div>
            <div className="eyebrow">Payment</div>
            <h2 className="section-title">
              Thanh toán lịch hẹn #{appointmentId}
            </h2>
          </div>
        </div>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        <div className="pay-grid">
          <div className="pay-card">
            <h2>Thanh toán VNPay</h2>
            <p className="muted">
              Thanh toán trực tiếp qua VNPay Sandbox, không dùng thanh toán
              offline.
            </p>

            <h3>Voucher</h3>
            <div className="voucher-row">
              <input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Nhập mã voucher"
              />
              <button className="btn" type="button" onClick={applyVoucher}>
                Áp dụng
              </button>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link
                className="btn btn-outline"
                to={`/customer/appointments/${appointmentId}`}
              >
                Xem chi tiết lịch hẹn
              </Link>
              <button
                className="btn"
                disabled={
                  loading ||
                  paying ||
                  !appointmentId ||
                  (!!error && !appointment)
                }
                onClick={payVnpay}
              >
                {paying ? "Đang chuyển sang VNPay..." : "Thanh toán VNPay"}
              </button>
            </div>
          </div>

          <div className="pay-card">
            <h2>Thông tin hóa đơn</h2>
            <p>
              <b>Dịch vụ:</b>{" "}
              {appointment?.ServiceName ||
                appointment?.ServiceNames ||
                (loading ? "Đang tải..." : "Không có dữ liệu")}
            </p>
            <p>
              <b>Kỹ thuật viên:</b>{" "}
              {appointment?.TechnicianName ||
                appointment?.EmployeeName ||
                (loading ? "Đang tải..." : "Không có dữ liệu")}
            </p>
            <p>
              <b>Mã hóa đơn:</b> {appointment?.InvoiceId || "Chưa có"}
            </p>
            <div className="line">
              <span>Tạm tính</span>
              <b>{money(subtotal)}</b>
            </div>
            <div className="line">
              <span>Giảm giá</span>
              <b>- {money(discount || serverDiscount)}</b>
            </div>
            <div className="line total">
              <span>Tổng</span>
              <span>{money(final)}</span>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
