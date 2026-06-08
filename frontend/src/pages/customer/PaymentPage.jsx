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
  const [method, setMethod] = useState("VNPAY");
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

  useEffect(() => {
    axiosClient
      .get(`/appointments/${appointmentId}`)
      .then((res) => setAppointment(res.data.data || res.data))
      .catch((err) =>
        setError(err.response?.data?.message || "Không tải được hóa đơn"),
      );
  }, [appointmentId]);

  const total = Number(appointment?.TotalAmount || 0);
  const final = Math.max(total - discount, 0);
  function money(v) {
    return Number(v || 0).toLocaleString("vi-VN") + "đ";
  }

  async function applyVoucher() {
    try {
      setError("");
      setMessage("");
      const res = await axiosClient.post("/vouchers/validate", {
        code: voucherCode,
        totalAmount: total,
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

  async function pay() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      if (method === "VNPAY") {
        const res = await axiosClient.post(
          `/payments/appointment/${appointmentId}/vnpay`,
          { voucherId },
        );
        const data = res.data.data || res.data;
        window.location.href = data.paymentUrl;
        return;
      }
      await axiosClient.post(`/payments/appointment/${appointmentId}/pay`, {
        paymentMethod: method,
        voucherId,
      });
      navigate(`/customer/appointment-success/${appointmentId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Thanh toán thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CustomerLayout>
      <style>{`.pay-page{padding:8px 0 40px}.pay-grid{display:grid;grid-template-columns:1fr 380px;gap:22px}.pay-card{background:#fff;border:1px solid #f5d8e4;border-radius:24px;padding:24px;box-shadow:0 18px 45px rgba(255,75,140,.08)}.pay-card h2{margin-top:0}.pay-method{display:grid;gap:12px}.pay-option{border:1px solid #efd8e1;border-radius:16px;padding:14px;display:flex;gap:10px;align-items:center}.line{display:flex;justify-content:space-between;border-bottom:1px solid #f4e1e9;padding:12px 0}.line.total{font-size:22px;color:#ff3f86;font-weight:900;border-bottom:none}.voucher-row{display:flex;gap:8px}.voucher-row input{flex:1;border:1px solid #efd8e1;border-radius:14px;padding:12px}@media(max-width:900px){.pay-grid{grid-template-columns:1fr}}`}</style>
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
            <h2>Chọn phương thức thanh toán</h2>
            <div className="pay-method">
              {[["VNPAY", "Thanh toán VNPay"]].map(([v, t]) => (
                <label className="pay-option" key={v}>
                  <input
                    type="radio"
                    checked={method === v}
                    onChange={() => setMethod(v)}
                  />
                  {t}
                </label>
              ))}
            </div>
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
            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
              <Link
                className="btn btn-outline"
                to={`/customer/appointments/${appointmentId}`}
              >
                Xem chi tiết lịch hẹn
              </Link>
              <button
                className="btn"
                disabled={loading || !appointment}
                onClick={pay}
              >
                {loading ? "Đang thanh toán..." : "Xác nhận thanh toán"}
              </button>
            </div>
          </div>
          <div className="pay-card">
            <h2>Thông tin hóa đơn</h2>
            <p>
              <b>Dịch vụ:</b> {appointment?.ServiceNames || "Đang tải..."}
            </p>
            <p>
              <b>Kỹ thuật viên:</b> {appointment?.EmployeeName || "Đang tải..."}
            </p>
            <div className="line">
              <span>Tạm tính</span>
              <b>{money(total)}</b>
            </div>
            <div className="line">
              <span>Giảm giá</span>
              <b>- {money(discount)}</b>
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
