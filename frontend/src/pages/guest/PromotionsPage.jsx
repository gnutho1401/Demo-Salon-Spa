import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function PromotionsPage() {
  const [vouchers, setVouchers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axiosClient
      .get("/vouchers")
      .then((res) => setVouchers(res.data.data || res.data || []))
      .catch(() => setVouchers([]));
  }, []);

  function discountText(v) {
    const type = String(v.DiscountType || "").toUpperCase();
    const value = Number(v.DiscountValue || 0);

    if (type === "PERCENT") return `${value}%`;
    return `${value.toLocaleString("vi-VN")}đ`;
  }

  function formatDate(value) {
    if (!value) return "Không giới hạn";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  async function saveVoucher(id) {
    try {
      await axiosClient.post(`/vouchers/${id}/save`);
      setMessage("Lưu voucher thành công");
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Bạn cần đăng nhập để lưu voucher",
      );
    }
  }

  return (
    <section className="section container promo-page">
      <div className="promo-hero">
        <div>
          <div className="eyebrow">Promotions</div>
          <h1>Khuyến mãi & voucher đang có</h1>
          <p>
            Xem ưu đãi mới nhất, lưu voucher và dùng khi thanh toán lịch hẹn.
          </p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}

      <div className="promo-voucher-grid">
        {vouchers.length === 0 && (
          <div className="promo-empty">Hiện chưa có voucher khả dụng.</div>
        )}

        {vouchers.map((v) => (
          <article className="promo-voucher-card" key={v.VoucherId}>
            <div className="promo-voucher-main">
              <span className="promo-voucher-code">{v.Code}</span>

              <div>
                <p className="promo-voucher-label">Giảm</p>
                <h2>{discountText(v)}</h2>
              </div>
            </div>

            <div className="promo-voucher-info">
              <div>
                <span>Hạn dùng</span>
                <strong>{formatDate(v.EndDate)}</strong>
              </div>

              <div>
                <span>Số lượng còn</span>
                <strong>{v.Quantity ?? "Không giới hạn"}</strong>
              </div>
            </div>

            <div className="promo-voucher-actions">
              <button type="button" onClick={() => saveVoucher(v.VoucherId)}>
                Lưu voucher
              </button>

              <Link to="/customer/booking">Đặt lịch</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
