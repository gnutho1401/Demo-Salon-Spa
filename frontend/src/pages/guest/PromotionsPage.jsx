import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

export default function PromotionsPage() {
  const [vouchers, setVouchers] = useState([]);
  const [voucherStatus, setVoucherStatus] = useState({});

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem("token");

    const promises = [
      axiosClient.get("/vouchers")
    ];

    if (token) {
      promises.push(axiosClient.get("/vouchers/my"));
    }

    Promise.allSettled(promises)
      .then(([vouchersRes, myRes]) => {
        if (!mounted) return;

        if (vouchersRes.status === "fulfilled") {
          setVouchers(vouchersRes.value.data.data || vouchersRes.value.data || []);
        }

        if (token && myRes && myRes.status === "fulfilled") {
          const mySavedVouchers = myRes.value.data.data || myRes.value.data || [];
          const savedStatuses = {};
          mySavedVouchers.forEach((item) => {
            savedStatuses[item.VoucherId] = "saved";
          });
          setVoucherStatus(savedStatuses);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const formatMoney = (val) => {
    return Number(val || 0).toLocaleString("vi-VN") + "đ";
  };

  const formatDate = (val) => {
    if (!val) return "Không giới hạn";
    return new Date(val).toLocaleDateString("vi-VN");
  };

  const handleSaveVoucher = async (voucherId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("❌ Bạn cần đăng nhập để lưu voucher!");
      return;
    }

    setVoucherStatus((prev) => ({ ...prev, [voucherId]: "saving" }));
    try {
      await axiosClient.post(`/vouchers/${voucherId}/save`);
      setVoucherStatus((prev) => ({ ...prev, [voucherId]: "saved" }));
      alert("🎉 Đã lưu voucher thành công vào ví của bạn!");
    } catch (err) {
      setVoucherStatus((prev) => ({ ...prev, [voucherId]: "error" }));
      const errMsg = err.response?.data?.message || "Lưu voucher thất bại hoặc bạn đã lưu voucher này rồi.";
      alert(`❌ ${errMsg}`);
    }
  };

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

      <div className="promo-voucher-grid">
        {vouchers.length === 0 && (
          <div className="promo-empty">Hiện chưa có voucher khả dụng.</div>
        )}

        {vouchers.map((item) => {
          const value = Number(item.DiscountValue || 0);
          const isPercent = String(item.DiscountType || "").toUpperCase() === "PERCENT";
          const discountNumStr = value.toLocaleString("vi-VN");
          const minOrderText = item.MinOrderAmount > 0 
            ? `Đơn từ ${formatMoney(item.MinOrderAmount)}` 
            : "Mọi đơn hàng";

          return (
            <div className="luxury-voucher-card-wrapper" key={item.VoucherId}>
              <article className="luxury-voucher-card">
                {/* Left part: Discount value */}
                <div className="voucher-left">
                  <span className="voucher-percent">
                    {discountNumStr}
                    {isPercent ? <span className="currency-symbol">%</span> : <span className="currency-symbol">đ</span>}
                  </span>
                  <span className="voucher-off">GIẢM GIÁ</span>
                </div>

                {/* Ticket divider with circular punch cuts */}
                <div className="voucher-divider">
                  <div className="divider-circle top" />
                  <div className="divider-line" />
                  <div className="divider-circle bottom" />
                </div>

                {/* Right part: details, terms and collect action button */}
                <div className="voucher-right">
                  <div className="voucher-right-top">
                    <span className="voucher-code-label">MÃ VOUCHER</span>
                    <strong className="voucher-code-text">{item.Code}</strong>
                    <p className="voucher-terms">
                      Điều kiện: {minOrderText} 
                      {item.MaxDiscountAmount > 0 && ` | Giảm tối đa ${formatMoney(item.MaxDiscountAmount)}`}
                    </p>
                    <p className="voucher-expiry">Hạn dùng: {formatDate(item.EndDate)}</p>
                  </div>

                  <div className="voucher-right-bottom">
                    <button 
                      className={`btn-voucher-action ${voucherStatus[item.VoucherId] || ""}`}
                      onClick={() => handleSaveVoucher(item.VoucherId)}
                      disabled={voucherStatus[item.VoucherId] === "saving" || voucherStatus[item.VoucherId] === "saved"}
                    >
                      {voucherStatus[item.VoucherId] === "saving" && "Đang lưu..."}
                      {voucherStatus[item.VoucherId] === "saved" && "Đã lưu ✓"}
                      {!voucherStatus[item.VoucherId] && "Lưu mã ngay"}
                    </button>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}
