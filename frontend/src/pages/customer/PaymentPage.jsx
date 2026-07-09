import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

const AUTO_CANCEL_MINUTES = 15; // phút tự hủy (phải khớp với backend)

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function calcVoucherDiscount(voucher, amount) {
  if (!voucher) return 0;

  const total = Number(amount || 0);
  const type = String(
    voucher.DiscountType || voucher.discountType || "",
  ).toUpperCase();

  const value = Number(voucher.DiscountValue || voucher.discountValue || 0);
  const maxDiscount = Number(
    voucher.MaxDiscountAmount || voucher.maxDiscountAmount || 0,
  );
  const minOrder = Number(
    voucher.MinOrderAmount || voucher.minOrderAmount || 0,
  );

  if (total <= 0) return 0;
  if (minOrder > 0 && total < minOrder) return 0;

  let discountAmount = 0;

  if (type === "PERCENT") {
    discountAmount = Math.round((total * value) / 100);

    if (maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, maxDiscount);
    }
  } else {
    discountAmount = value;
  }

  return Math.min(discountAmount, total);
}

function isVoucherUsable(voucher, amount, serviceName = "") {
  const used = Boolean(voucher.UsedStatus || voucher.usedStatus);
  const status = String(
    voucher.Status || voucher.status || "ACTIVE",
  ).toUpperCase();

  const minOrder = Number(
    voucher.MinOrderAmount || voucher.minOrderAmount || 0,
  );

  const useCount = Number(voucher.UseCount || 0);

  if (used || useCount >= 1) return false;
  if (status && status !== "ACTIVE") return false;
  if (minOrder > 0 && Number(amount || 0) < minOrder) return false;

  const code = String(voucher.Code || "").toUpperCase();
  const sName = String(serviceName || "").toLowerCase();
  if (code.startsWith("FREEPH") && sName !== "phục hồi tóc hư tổn") {
    return false;
  }
  if (code.startsWith("FREEMS") && sName !== "massage cổ vai gáy") {
    return false;
  }

  return calcVoucherDiscount(voucher, amount) > 0;
}

export default function PaymentPage() {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();

  const [appointment, setAppointment] = useState(null);
  const [membership, setMembership] = useState(null);
  const [myVouchers, setMyVouchers] = useState([]);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherId, setVoucherId] = useState(
    searchParams.get("voucherId") || null,
  );
  const [discount, setDiscount] = useState(
    Number(searchParams.get("discount") || 0),
  );
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [rewardPoints, setRewardPoints] = useState(0);

  const [message, setMessage] = useState("");
  const [error, _setError] = useState("");
  const setError = (msg) => {
    _setError(msg);
    if (msg) {
      window.alert("⚠️ CẢNH BÁO LỖI:\n\n" + msg);
    }
  };
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.allSettled([
      axiosClient.get(`/appointments/${appointmentId}`),
      axiosClient.get("/membership/my"),
      axiosClient.get("/vouchers/my"),
    ])
      .then(([appointmentRes, membershipRes, voucherRes]) => {
        if (appointmentRes.status === "fulfilled") {
          setAppointment(
            appointmentRes.value.data?.data || appointmentRes.value.data,
          );
        } else {
          throw appointmentRes.reason;
        }

        if (membershipRes.status === "fulfilled") {
          setMembership(
            membershipRes.value.data?.data || membershipRes.value.data,
          );
        }

        if (voucherRes.status === "fulfilled") {
          const voucherData =
            voucherRes.value.data?.data || voucherRes.value.data || [];
          setMyVouchers(Array.isArray(voucherData) ? voucherData : []);
        }
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || "Không tải được thông tin thanh toán",
        );
      })
      .finally(() => setLoading(false));
  }, [appointmentId]);

  // Countdown timer: ưu tiên dùng thời điểm client lưu khi đặt lịch để tránh lệch timezone
  useEffect(() => {
    if (!appointment) return;
    const status = String(appointment.Status || "").toUpperCase();
    if (status !== "PENDING_PAYMENT") return;

    // Ưu tiên dùng bookingCreatedAt (client timestamp) → tránh lệch timezone server
    // Fallback sang CreatedAt server nếu không có
    let createdMs;
    const storedTs = sessionStorage.getItem("bookingCreatedAt");
    if (storedTs) {
      createdMs = Number(storedTs);
      // Xóa sau khi đọc để không bị reuse lần tải sau (không phải lần đặt lịch mới nhất)
      sessionStorage.removeItem("bookingCreatedAt");
    } else {
      const createdAt = appointment.CreatedAt;
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
  }, [appointment]);

  const subtotal = Number(
    appointment?.TotalAmount ??
      appointment?.InvoiceTotalAmount ??
      appointment?.FinalAmount ??
      appointment?.Price ??
      appointment?.Amount ??
      0,
  );

  // Khôi phục voucher và điểm thưởng đã lưu trên hóa đơn lịch hẹn hoặc truyền từ URL đặt lịch
  useEffect(() => {
    if (!appointment) return;
    
    // Reward Points
    const usedPoints = Number(appointment.RewardPointsUsed || 0);
    const usedPointsDiscount = Number(appointment.RewardDiscountAmount || 0);
    setRewardPoints(usedPoints);
    
    // Voucher
    const savedVoucherId = appointment.VoucherId;
    const urlVoucherId = searchParams.get("voucherId");
    const urlDiscount = Number(searchParams.get("discount") || 0);
    const targetVoucherId = savedVoucherId || urlVoucherId;

    if (targetVoucherId) {
      setVoucherId(targetVoucherId);
      
      if (savedVoucherId) {
        setVoucherCode(appointment.VoucherCode || "");
        const totalDiscount = Number(appointment.DiscountAmount || 0);
        const membershipPercent = Number(membership?.DiscountPercent || 0);
        const membershipDiscount = Math.min(
          Math.round((subtotal * membershipPercent) / 100),
          subtotal
        );
        
        // Pure voucher discount is the remaining discount after points and membership
        const pureVoucherDiscount = Math.max(totalDiscount - usedPointsDiscount - membershipDiscount, 0);
        setDiscount(pureVoucherDiscount);
      } else {
        setDiscount(urlDiscount);
        if (myVouchers.length > 0) {
          const found = myVouchers.find(
            (v) => String(v.VoucherId || v.voucherId) === String(targetVoucherId)
          );
          if (found) {
            setVoucherCode(found.Code || found.code || "");
            setSelectedVoucher(found);
          }
        }
      }
      
      if (myVouchers.length > 0) {
        const found = myVouchers.find(
          (v) => String(v.VoucherId || v.voucherId) === String(targetVoucherId)
        );
        if (found) setSelectedVoucher(found);
      }
    } else {
      setVoucherId(null);
      setVoucherCode("");
      setDiscount(0);
      setSelectedVoucher(null);
    }
  }, [appointment, myVouchers, membership, subtotal, searchParams]);

  const appliedVoucherDiscount = Number(discount || 0);

  const calc = useMemo(() => {
    const membershipPercent = Number(membership?.DiscountPercent || 0);
    const availablePoints = Number(membership?.LoyaltyPoints || 0);

    const membershipDiscount = Math.min(
      Math.round((subtotal * membershipPercent) / 100),
      subtotal,
    );

    const afterMembership = Math.max(subtotal - membershipDiscount, 0);

    const voucherDiscount = Math.min(appliedVoucherDiscount, afterMembership);

    const afterVoucher = Math.max(afterMembership - voucherDiscount, 0);

    const pointValue = 1000;

    const maxUsablePoints = Math.min(
      availablePoints,
      Math.floor((afterVoucher * 0.5) / pointValue),
    );

    const safeRewardPoints = Math.min(
      Math.max(Number(rewardPoints || 0), 0),
      maxUsablePoints,
    );

    const rewardDiscount = safeRewardPoints * pointValue;
    const finalAmount = Math.max(afterVoucher - rewardDiscount, 0);
    const earnedPointsEstimate = Math.floor(finalAmount / 10000);

    return {
      membershipPercent,
      availablePoints,
      membershipDiscount,
      afterMembership,
      voucherDiscount,
      pointValue,
      maxUsablePoints,
      safeRewardPoints,
      rewardDiscount,
      finalAmount,
      earnedPointsEstimate,
    };
  }, [subtotal, membership, appliedVoucherDiscount, rewardPoints]);

  const voucherBaseAmount = Math.max(subtotal - calc.membershipDiscount, 0);

  const availableVouchers = useMemo(() => {
    const serviceName = appointment?.ServiceName || appointment?.ServiceNames || "";
    
    return myVouchers
      .map((voucher) => {
        const discountAmount = calcVoucherDiscount(voucher, voucherBaseAmount);

        return {
          ...voucher,
          QuickDiscountAmount: discountAmount,
          IsUsableNow: isVoucherUsable(voucher, voucherBaseAmount, serviceName),
        };
      })
      .filter((voucher) => voucher.IsUsableNow)
      .sort((a, b) => {
        return (
          Number(b.QuickDiscountAmount || 0) -
          Number(a.QuickDiscountAmount || 0)
        );
      });
  }, [myVouchers, voucherBaseAmount, appointment]);

  async function savePointsToDb(points) {
    try {
      setError("");
      setMessage("");
      await axiosClient.post(
        `/payments/appointment/${appointmentId}/apply-voucher`,
        {
          voucherId,
          rewardPoints: Number(points || 0),
        }
      );
    } catch (err) {
      setError(err.response?.data?.message || "Không thể áp dụng điểm thưởng");
    }
  }

  async function applyQuickVoucher(voucher) {
    const discountAmount = calcVoucherDiscount(voucher, voucherBaseAmount);

    if (discountAmount <= 0) {
      setError("Voucher không đủ điều kiện áp dụng cho hóa đơn này.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const vid = voucher.VoucherId || voucher.voucherId;
      
      await axiosClient.post(
        `/payments/appointment/${appointmentId}/apply-voucher`,
        {
          voucherId: vid,
          rewardPoints: Number(rewardPoints || 0),
        }
      );
      
      setVoucherId(vid);
      setVoucherCode(voucher.Code || voucher.code || "");
      setDiscount(discountAmount);
      setSelectedVoucher(voucher);
      setMessage(`Đã áp dụng voucher ${voucher.Code || voucher.code}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể áp dụng voucher");
    }
  }

  async function removeVoucher() {
    try {
      setError("");
      setMessage("");
      
      await axiosClient.post(
        `/payments/appointment/${appointmentId}/apply-voucher`,
        {
          voucherId: null,
          rewardPoints: Number(rewardPoints || 0),
        }
      );
      
      setVoucherId(null);
      setVoucherCode("");
      setDiscount(0);
      setSelectedVoucher(null);
      setMessage("Đã bỏ voucher khỏi hóa đơn.");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể xóa voucher");
    }
  }

  async function applyVoucher() {
    try {
      setError("");
      setMessage("");

      // Validate voucher first on backend
      const resVal = await axiosClient.post("/vouchers/validate", {
        code: voucherCode,
        totalAmount: voucherBaseAmount,
      });

      const dataVal = resVal.data?.data || resVal.data;
      const vid = dataVal.VoucherId || dataVal.voucherId;

      // Apply to appointment invoice
      await axiosClient.post(
        `/payments/appointment/${appointmentId}/apply-voucher`,
        {
          voucherId: vid,
          rewardPoints: Number(rewardPoints || 0),
        }
      );

      const foundVoucher =
        myVouchers.find(
          (v) =>
            String(v.VoucherId || v.voucherId) === String(vid) ||
            String(v.Code || v.code).toUpperCase() === String(voucherCode).toUpperCase(),
        ) || dataVal;

      setVoucherId(vid);
      setDiscount(Number(dataVal.discountAmount || dataVal.DiscountAmount || 0));
      setSelectedVoucher(foundVoucher);
      setMessage(`Đã áp dụng voucher ${dataVal.Code || voucherCode}`);
    } catch (err) {
      setDiscount(0);
      setVoucherId(null);
      setSelectedVoucher(null);
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
          rewardPoints: calc.safeRewardPoints,
        },
      );

      const data = res.data?.data || res.data;

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

  async function payPayos() {
    try {
      setPaying(true);
      setError("");
      setMessage("");

      const res = await axiosClient.post(
        `/payments/appointment/${appointmentId}/payos`,
        {
          voucherId,
          rewardPoints: calc.safeRewardPoints,
        },
      );

      const data = res.data?.data || res.data;

      if (!data?.paymentUrl && !data?.url) {
        throw new Error("PayOS không trả về paymentUrl");
      }

      window.location.href = data.paymentUrl || data.url;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Thanh toán PayOS thất bại",
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <CustomerLayout>
      <div className="reward-pay-page">
        <section className="reward-pay-hero">
          <div>
            <span>SECURE PAYMENT</span>
            <h1>Thanh toán lịch hẹn #{appointmentId}</h1>
            <p>
              Áp dụng voucher, ưu đãi hạng thành viên và điểm thưởng trực tiếp
              vào hóa đơn trước khi thanh toán.
            </p>
          </div>

          <div className="reward-pay-score">
            <b>{calc.availablePoints}</b>
            <span>điểm hiện có</span>
            <small>1 điểm = {money(calc.pointValue)}</small>
          </div>
        </section>

        {/* ── Countdown Banner ── */}
        {secondsLeft !== null && (
          <div
            style={{
              margin: "0 0 18px",
              padding: "14px 22px",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: expired
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : secondsLeft <= 120
                ? "linear-gradient(135deg, #f97316, #ea580c)"
                : "linear-gradient(135deg, #ef4f83, #ff5ea8)",
              color: "#fff",
              fontWeight: 700,
              boxShadow: expired
                ? "0 6px 20px rgba(239,68,68,0.3)"
                : "0 6px 20px rgba(239,79,131,0.25)",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{expired ? "❌" : "⏰"}</span>
            <div style={{ flex: 1 }}>
              {expired ? (
                <>
                  <div style={{ fontSize: "1rem" }}>Lịch hẹn đã hết thời gian thanh toán!</div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.9, marginTop: 3 }}>
                    Hệ thống đã tự động hủy lịch. Vui lòng đặt lịch lại.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "1rem" }}>
                    ⚡ Vui lòng thanh toán trong&nbsp;
                    <strong style={{ fontSize: "1.2rem" }}>
                      {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
                    </strong>
                    &nbsp;— Lịch hẹn sẽ bị hủy tự động nếu chưa thanh toán!
                  </div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.85, marginTop: 3 }}>
                    Lịch hẹn được giữ tối đa {AUTO_CANCEL_MINUTES} phút sau khi đặt.
                  </div>
                </>
              )}
            </div>
            {!expired && (
              <div
                style={{
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 78,
                  textAlign: "center",
                }}
              >
                {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
              </div>
            )}
          </div>
        )}

        {message && <div className="reward-alert success">{message}</div>}
        {error && <div className="reward-alert error">{error}</div>}

        <section className="reward-pay-grid">
          <div className="reward-pay-card">
            <h2>Phương thức thanh toán</h2>
            <p>
              Thanh toán trực tuyến qua VNPay. Sau khi thanh toán thành công,
              lịch hẹn sẽ được xác nhận và điểm thưởng sẽ được cộng tự động.
            </p>

            <div className="reward-box">
              <div className="reward-box-head">
                <div>
                  <h3>Voucher</h3>
                  <p>Chọn nhanh voucher đang có hoặc nhập mã thủ công.</p>
                </div>

                {voucherId && (
                  <button
                    type="button"
                    className="mini-outline"
                    onClick={removeVoucher}
                  >
                    Bỏ voucher
                  </button>
                )}
              </div>

              <div className="reward-input-row">
                <input
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="Nhập mã voucher"
                />

                <button type="button" onClick={applyVoucher}>
                  Áp dụng
                </button>
              </div>

              {selectedVoucher && (
                <div className="quick-voucher-selected">
                  <b>
                    Đang dùng: {selectedVoucher.Code || selectedVoucher.code}
                  </b>
                  <span>Giảm {money(calc.voucherDiscount)}</span>
                </div>
              )}

              <div className="quick-voucher-list">
                <div className="quick-voucher-title">
                  <b>Voucher của tôi</b>
                  <span>{availableVouchers.length} voucher</span>
                </div>

                {availableVouchers.length === 0 ? (
                  <div className="quick-voucher-empty">
                    Bạn chưa có voucher nào khả dụng.
                  </div>
                ) : (
                  availableVouchers.map((voucher) => {
                    const id = voucher.VoucherId || voucher.voucherId;
                    const code = voucher.Code || voucher.code;
                    const type = String(
                      voucher.DiscountType || voucher.discountType || "",
                    ).toUpperCase();
                    const value = Number(
                      voucher.DiscountValue || voucher.discountValue || 0,
                    );
                    const minOrder = Number(
                      voucher.MinOrderAmount || voucher.minOrderAmount || 0,
                    );
                    const maxDiscount = Number(
                      voucher.MaxDiscountAmount ||
                        voucher.maxDiscountAmount ||
                        0,
                    );
                    const isSelected = String(voucherId) === String(id);

                    return (
                      <article
                        className={`quick-voucher-card ${
                          voucher.IsUsableNow ? "" : "disabled"
                        } ${isSelected ? "selected" : ""}`}
                        key={id || code}
                      >
                        <div className="quick-voucher-left">
                          <div className="quick-voucher-icon">%</div>

                          <div>
                            <h4>{code}</h4>
                            <p>
                              {type === "PERCENT"
                                ? `Giảm ${value}%`
                                : `Giảm ${money(value)}`}
                              {maxDiscount > 0
                                ? ` · tối đa ${money(maxDiscount)}`
                                : ""}
                            </p>
                            <small>
                              Đơn tối thiểu {money(minOrder)} · Giảm được{" "}
                              {money(voucher.QuickDiscountAmount)}
                            </small>
                            <small style={{ display: "block", color: "#64748b", marginTop: 4 }}>
                              Lượt dùng cá nhân: {voucher.UseCount >= 1 ? "Đã dùng hết (1/1)" : `Còn ${1 - (voucher.UseCount || 0)}/1 lần`} · Còn lại: {voucher.Quantity}
                            </small>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!voucher.IsUsableNow}
                          onClick={() => applyQuickVoucher(voucher)}
                        >
                          {isSelected
                            ? "Đang dùng"
                            : voucher.IsUsableNow
                              ? "Dùng ngay"
                              : "Không đủ ĐK"}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <div className="reward-box">
              <h3>Điểm thưởng</h3>

              <div className="reward-lines">
                <div>
                  <span>Điểm hiện có</span>
                  <b>{calc.availablePoints} điểm</b>
                </div>

                <div>
                  <span>Có thể dùng tối đa</span>
                  <b>{calc.maxUsablePoints} điểm</b>
                </div>

                <div>
                  <span>Quy đổi</span>
                  <b>1 điểm = {money(calc.pointValue)}</b>
                </div>
              </div>

              <div className="reward-input-row">
                <input
                  type="number"
                  min="0"
                  max={calc.maxUsablePoints}
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(e.target.value)}
                  onBlur={() => savePointsToDb(rewardPoints)}
                  placeholder="Nhập điểm muốn dùng"
                />

                <button
                  type="button"
                  className="outline"
                  onClick={() => {
                    setRewardPoints(calc.maxUsablePoints);
                    savePointsToDb(calc.maxUsablePoints);
                  }}
                >
                  Dùng tối đa
                </button>
              </div>

              <small className="reward-hint">
                Hệ thống cho dùng điểm tối đa 50% giá trị hóa đơn sau giảm giá.
              </small>
            </div>

            <div className="reward-pay-actions">
              <Link
                className="outline-link"
                to={`/customer/appointments/${appointmentId}`}
              >
                Xem chi tiết lịch hẹn
              </Link>

              <button
                disabled={
                  loading ||
                  paying ||
                  !appointmentId ||
                  !appointment ||
                  (!!error && !appointment)
                }
                onClick={payPayos}
                style={{ background: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)" }}
              >
                {paying ? "Đang chuyển sang PayOS..." : "💳 Thanh toán PayOS"}
              </button>

              <button
                className="outline"
                disabled={
                  loading ||
                  paying ||
                  !appointmentId ||
                  !appointment ||
                  (!!error && !appointment)
                }
                onClick={payVnpay}
              >
                {paying ? "Đang chuyển sang VNPay..." : "Thanh toán VNPay"}
              </button>
            </div>
          </div>

          <aside className="reward-pay-card invoice">
            <h2>Thông tin hóa đơn</h2>

            <div className="reward-info">
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

              <p>
                <b>Hạng thành viên:</b> {membership?.LevelName || "Normal"}
              </p>
            </div>

            <div className="reward-invoice-lines">
              <div>
                <span>Tạm tính</span>
                <b>{money(subtotal)}</b>
              </div>

              <div>
                <span>Giảm hạng thành viên ({calc.membershipPercent}%)</span>
                <b>- {money(calc.membershipDiscount)}</b>
              </div>

              <div>
                <span>Giảm voucher</span>
                <b>- {money(calc.voucherDiscount)}</b>
              </div>

              <div>
                <span>Dùng điểm thưởng ({calc.safeRewardPoints} điểm)</span>
                <b>- {money(calc.rewardDiscount)}</b>
              </div>

              <div>
                <span>Dự kiến cộng điểm sau thanh toán</span>
                <b>+ {calc.earnedPointsEstimate} điểm</b>
              </div>

              <div className="total">
                <span>Tổng thanh toán</span>
                <b>{money(calc.finalAmount)}</b>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </CustomerLayout>
  );
}
