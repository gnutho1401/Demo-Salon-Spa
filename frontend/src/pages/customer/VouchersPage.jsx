import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

function money(v) {
  return Number(v || 0).toLocaleString("vi-VN");
}
function date(v) {
  return v ? new Date(v).toLocaleDateString("vi-VN") : "Không giới hạn";
}
function discountText(v) {
  return v.DiscountType === "PERCENT"
    ? `${v.DiscountValue}%`
    : `${money(v.DiscountValue)}đ`;
}

export default function VouchersPage() {
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [allRes, myRes] = await Promise.all([
      axiosClient.get("/vouchers"),
      axiosClient.get("/vouchers/my"),
    ]);
    setAll(allRes.data.data || allRes.data || []);
    setMine(myRes.data.data || myRes.data || []);
  };

  useEffect(() => {
    load()
      .catch(() => setMessage("Không tải được voucher"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (id) => {
    try {
      await axiosClient.post(`/vouchers/${id}/save`);
      setMessage("Lưu voucher thành công");
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Lưu voucher thất bại");
    }
  };

  return (
    <CustomerLayout>
      <div className="section-head" style={{ marginBottom: "28px" }}>
        <div>
          <div
            className="eyebrow"
            style={{
              color: "#e96a95",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Voucher
          </div>
          <h2
            className="section-title"
            style={{
              fontSize: "32px",
              color: "#2d1424",
              fontWeight: 800,
              margin: "6px 0 0 0",
            }}
          >
            Ví Voucher của tôi
          </h2>
        </div>
      </div>

      {message && (
        <div
          className="alert success"
          style={{
            background: "#e6fcf5",
            color: "#0ca678",
            padding: "14px 20px",
            borderRadius: "16px",
            border: "1px solid #c3fae8",
            fontWeight: 700,
            marginBottom: "24px",
            fontSize: "15px",
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <p
          style={{
            textAlign: "center",
            color: "#8c7784",
            fontSize: "16px",
            padding: "40px 0",
          }}
        >
          Đang tải danh sách voucher...
        </p>
      ) : (
        <>
          <h3
            style={{
              fontSize: "20px",
              color: "#2d1424",
              fontWeight: 800,
              marginBottom: "20px",
            }}
          >
            Voucher đã lưu
          </h3>
          <div
            className="voucher-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "40px",
            }}
          >
            {mine.length ? (
              mine.map((v) => {
                const personalRemaining = 1 - (v.UseCount || 0);
                const unpaidUsages = v.Usages
                  ? v.Usages.filter((u) => u.PaymentStatus !== "PAID")
                  : [];
                const isFullyUsed = v.UsedStatus || v.UseCount >= 1;
                const isPercent = v.DiscountType === "PERCENT";
                const discountNumStr = isPercent
                  ? String(v.DiscountValue)
                  : money(v.DiscountValue);

                return (
                  <div
                    className={`luxury-voucher-card-wrapper ${isFullyUsed ? "used" : ""}`}
                    key={v.VoucherId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <article
                      className="luxury-voucher-card"
                      style={{ opacity: isFullyUsed ? 0.65 : 1 }}
                    >
                      {/* Left side: discount value */}
                      <div className="voucher-left">
                        <span
                          className="voucher-percent"
                          style={{
                            fontSize:
                              discountNumStr.length > 5
                                ? "18px"
                                : discountNumStr.length > 3
                                  ? "22px"
                                  : "28px",
                          }}
                        >
                          {discountNumStr}
                          {isPercent ? (
                            <span className="currency-symbol">%</span>
                          ) : (
                            <span className="currency-symbol">đ</span>
                          )}
                        </span>
                        <span className="voucher-off">GIẢM GIÁ</span>
                      </div>

                      {/* Divider line */}
                      <div className="voucher-divider">
                        <div className="divider-circle top" />
                        <div className="divider-line" />
                        <div className="divider-circle bottom" />
                      </div>

                      {/* Right side: details and actions */}
                      <div className="voucher-right">
                        <div className="voucher-right-top">
                          <span className="voucher-code-label">MÃ VOUCHER</span>
                          <strong className="voucher-code-text">
                            {v.Code}
                          </strong>
                          <p className="voucher-terms">
                            Điều kiện:{" "}
                            {!v.MinOrderAmount || Number(v.MinOrderAmount) === 0
                              ? "Mọi đơn hàng"
                              : `Đơn từ ${money(v.MinOrderAmount)}đ`}
                            {v.MaxDiscountAmount > 0 &&
                              ` | Giảm tối đa ${money(v.MaxDiscountAmount)}đ`}
                          </p>
                          <p className="voucher-expiry">
                            Hạn dùng: {date(v.EndDate)}
                          </p>
                          <p
                            style={{
                              fontWeight: "bold",
                              color: isFullyUsed ? "#ef4444" : "#10b981",
                              marginTop: "6px",
                              fontSize: "12px",
                            }}
                          >
                            Lượt dùng còn lại:{" "}
                            {isFullyUsed
                              ? "Hết lượt"
                              : `${personalRemaining}/1 lần`}
                          </p>
                        </div>

                        <div className="voucher-right-bottom">
                          {isFullyUsed ? (
                            <button
                              className="btn-voucher-action"
                              disabled
                              style={{
                                background: "#e9ecef",
                                color: "#adb5bd",
                                cursor: "not-allowed",
                                boxShadow: "none",
                              }}
                            >
                              Đã dùng
                            </button>
                          ) : (
                            <button
                              className="btn-voucher-action"
                              onClick={() => navigate("/customer/booking")}
                            >
                              Dùng ngay
                            </button>
                          )}
                        </div>
                      </div>
                    </article>

                    {/* Extra usages or unpaid warnings */}
                    {((v.Usages && v.Usages.length > 0) ||
                      unpaidUsages.length > 0) && (
                      <div
                        className="voucher-extra-details"
                        style={{
                          background: "#fff8fa",
                          border: "1px solid rgba(239, 79, 131, 0.1)",
                          borderRadius: "16px",
                          padding: "14px 18px",
                          fontSize: "13px",
                          color: "#5c4554",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {v.Usages && v.Usages.length > 0 && (
                          <div className="usage-history">
                            <b
                              style={{
                                color: "#2d1424",
                                display: "block",
                                marginBottom: "4px",
                              }}
                            >
                              Lịch sử sử dụng:
                            </b>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: "16px",
                                color: "#7b6874",
                              }}
                            >
                              {v.Usages.map((usage) => (
                                <li
                                  key={usage.AppointmentId}
                                  style={{ marginBottom: "2px" }}
                                >
                                  <span>
                                    Lịch hẹn #{usage.AppointmentId} (
                                    {usage.ServiceNames || "Dịch vụ"}):{" "}
                                  </span>
                                  <b
                                    style={{
                                      color:
                                        usage.PaymentStatus === "PAID"
                                          ? "#10b981"
                                          : "#f59e0b",
                                    }}
                                  >
                                    {usage.PaymentStatus === "PAID"
                                      ? "Đã thanh toán"
                                      : "Chờ thanh toán"}
                                  </b>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {unpaidUsages.map((usage) => (
                          <div
                            key={usage.AppointmentId}
                            className="unpaid-warning"
                            style={{
                              borderTop: "1px dashed rgba(239, 79, 131, 0.15)",
                              paddingTop: "8px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <span style={{ color: "#e03131", fontWeight: 600 }}>
                              ⚠️ Đang giữ chỗ cho lịch hẹn #
                              {usage.AppointmentId} (
                              {usage.ServiceNames || "Dịch vụ"}) chưa thanh
                              toán!
                            </span>
                            <button
                              className="btn-voucher-action"
                              style={{
                                background: "#f59e0b",
                                color: "#ffffff",
                                fontSize: "12px",
                                padding: "6px 12px",
                                alignSelf: "flex-start",
                                boxShadow: "none",
                              }}
                              onClick={() =>
                                navigate(
                                  `/customer/payment/${usage.AppointmentId}`,
                                )
                              }
                            >
                              💳 Thanh toán lịch hẹn #{usage.AppointmentId}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                className="dashboard-card"
                style={{
                  gridColumn: "1 / -1",
                  background: "#fff9fa",
                  border: "1px dashed rgba(239, 79, 131, 0.2)",
                  borderRadius: "24px",
                  padding: "36px",
                  textAlign: "center",
                }}
              >
                <p
                  className="muted"
                  style={{ margin: 0, color: "#8c7784", fontSize: "15px" }}
                >
                  Bạn chưa lưu voucher nào. Hãy thu thập voucher phía dưới nhé!
                  🌸
                </p>
              </div>
            )}
          </div>

          <h3
            style={{
              fontSize: "20px",
              color: "#2d1424",
              fontWeight: 800,
              marginBottom: "20px",
              marginTop: "36px",
            }}
          >
            Voucher đang có
          </h3>
          <div
            className="voucher-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
            }}
          >
            {all.map((v) => {
              const isSaved = mine.some((m) => m.VoucherId === v.VoucherId);
              const isPercent = v.DiscountType === "PERCENT";
              const discountNumStr = isPercent
                ? String(v.DiscountValue)
                : money(v.DiscountValue);

              return (
                <article className="luxury-voucher-card" key={v.VoucherId}>
                  <div className="voucher-left">
                    <span
                      className="voucher-percent"
                      style={{
                        fontSize:
                          discountNumStr.length > 5
                            ? "18px"
                            : discountNumStr.length > 3
                              ? "22px"
                              : "28px",
                      }}
                    >
                      {discountNumStr}
                      {isPercent ? (
                        <span className="currency-symbol">%</span>
                      ) : (
                        <span className="currency-symbol">đ</span>
                      )}
                    </span>
                    <span className="voucher-off">GIẢM GIÁ</span>
                  </div>

                  <div className="voucher-divider">
                    <div className="divider-circle top" />
                    <div className="divider-line" />
                    <div className="divider-circle bottom" />
                  </div>

                  <div className="voucher-right">
                    <div className="voucher-right-top">
                      <span className="voucher-code-label">MÃ VOUCHER</span>
                      <strong className="voucher-code-text">{v.Code}</strong>
                      <p className="voucher-terms">
                        Điều kiện:{" "}
                        {!v.MinOrderAmount || Number(v.MinOrderAmount) === 0
                          ? "Mọi đơn hàng"
                          : `Đơn từ ${money(v.MinOrderAmount)}đ`}
                        {v.MaxDiscountAmount > 0 &&
                          ` | Giảm tối đa ${money(v.MaxDiscountAmount)}đ`}
                      </p>
                      <p className="voucher-expiry">
                        Hạn dùng: {date(v.EndDate)}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#8c7784",
                          marginTop: "6px",
                        }}
                      >
                        Số lượng còn lại: {v.Quantity}
                      </p>
                    </div>

                    <div className="voucher-right-bottom">
                      {isSaved ? (
                        <button className="btn-voucher-action saved" disabled>
                          Đã lưu ✓
                        </button>
                      ) : (
                        <button
                          className="btn-voucher-action"
                          onClick={() => save(v.VoucherId)}
                        >
                          Lưu voucher
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </CustomerLayout>
  );
}
