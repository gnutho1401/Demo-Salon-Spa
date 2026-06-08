import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function PromotionsPage() {
  const [vouchers, setVouchers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axiosClient.get("/vouchers").then((res) => setVouchers(res.data.data || res.data || [])).catch(() => setVouchers([]));
  }, []);

  function discountText(v) {
    if (String(v.DiscountType).toUpperCase() === "PERCENT") return `Giảm ${Number(v.DiscountValue || 0)}%`;
    return `Giảm ${Number(v.DiscountValue || 0).toLocaleString("vi-VN")}đ`;
  }

  async function saveVoucher(id) {
    try { await axiosClient.post(`/vouchers/${id}/save`); setMessage("Lưu voucher thành công"); }
    catch (err) { setMessage(err.response?.data?.message || "Bạn cần đăng nhập để lưu voucher"); }
  }

  return <section className="section container">
    <style>{`.promo-hero{background:linear-gradient(135deg,#fff0f6,#fff);border:1px solid #ffd7e6;border-radius:28px;padding:34px;margin-bottom:24px}.voucher-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.voucher-card{background:#fff;border:1px dashed #ff8fbd;border-radius:24px;padding:22px;box-shadow:0 18px 45px rgba(255,75,140,.08)}.voucher-code{display:inline-block;background:#fff0f6;color:#ff3f86;border-radius:12px;padding:9px 12px;font-weight:900;letter-spacing:1px}.voucher-value{font-size:28px;font-weight:900;color:#ff3f86;margin:14px 0}.voucher-actions{display:flex;gap:10px;flex-wrap:wrap}@media(max-width:900px){.voucher-grid{grid-template-columns:1fr}}`}</style>
    <div className="promo-hero"><div className="eyebrow">Promotions</div><h1>Khuyến mãi & voucher đang có</h1><p className="muted">Xem ưu đãi mới nhất, lưu voucher và dùng khi thanh toán lịch hẹn.</p></div>
    {message && <div className="alert success">{message}</div>}
    <div className="voucher-grid">
      {vouchers.length === 0 && <p className="muted">Hiện chưa có voucher khả dụng.</p>}
      {vouchers.map(v => <article className="voucher-card" key={v.VoucherId}>
        <span className="voucher-code">{v.Code}</span>
        <div className="voucher-value">{discountText(v)}</div>
        <p className="muted">Hạn dùng: {v.EndDate ? new Date(v.EndDate).toLocaleDateString("vi-VN") : "Không giới hạn"}</p>
        <p className="muted">Số lượng còn lại: {v.Quantity ?? "Không giới hạn"}</p>
        <div className="voucher-actions"><button className="btn" onClick={()=>saveVoucher(v.VoucherId)}>Lưu voucher</button><Link className="btn btn-outline" to="/customer/booking">Đặt lịch</Link></div>
      </article>)}
    </div>
  </section>;
}
