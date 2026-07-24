import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export default function PackageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [method, setMethod] = useState("VNPAY");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axiosClient
      .get(`/packages/${id}`)
      .then((res) => setItem(res.data.data || res.data))
      .catch(() => setMessage("Không tìm thấy combo / liệu trình"))
      .finally(() => setLoading(false));
  }, [id]);

  const buy = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const confirmPayment = window.confirm(
      "⚠️ LƯU Ý QUAN TRỌNG:\nGói combo / liệu trình sau khi đã thanh toán sẽ KHÔNG ĐƯỢC HỦY HOẶC HOÀN TIỀN dưới bất kỳ hình thức nào.\n\nBạn có chắc chắn muốn tiếp tục thanh toán?",
    );
    if (!confirmPayment) return;

    setPaying(true);
    setMessage("");
    try {
      if (method === "VNPAY") {
        const res = await axiosClient.post(`/packages/${id}/vnpay`);
        const data = res.data.data || res.data;
        window.location.href = data.paymentUrl;
        return;
      }
      if (method === "PAYOS") {
        const res = await axiosClient.post(`/packages/${id}/payos`);
        const data = res.data.data || res.data;
        window.location.href = data.paymentUrl;
        return;
      }
      await axiosClient.post(`/packages/${id}/buy`, { paymentMethod: method });
      navigate("/customer/packages?paid=1");
    } catch (err) {
      alert(err.response?.data?.message || "Không mua được combo / liệu trình");
    } finally {
      setPaying(false);
    }
  };

  if (loading)
    return (
      <section className="section container">
        <p className="muted">Đang tải chi tiết...</p>
      </section>
    );
  if (!item)
    return (
      <section className="section container">
        <div className="alert error">{message}</div>
      </section>
    );

  return (
    <section className="combo-detail-page">
      <div className="combo-detail-card">
        <div className="combo-detail-img">
          {Number(item.DiscountPercent || 0) > 0 && (
            <span className="sale-badge">-{item.DiscountPercent}%</span>
          )}
          <img
            src={resolveFileUrl(
              item.ImageUrl || "/images/services/default-service.png",
            )}
            alt={item.PackageName}
          />
        </div>
        <div className="combo-detail-info">
          <div className="combo-category">{item.CategoryName}</div>
          <h1>{item.PackageName}</h1>
          <p className="muted">{item.Description}</p>
          <div className="combo-price-row big">
            <b>{money(item.FinalPrice || item.Price)}</b>
            {Number(item.DiscountPercent || 0) > 0 && (
              <del>{money(item.Price)}</del>
            )}
          </div>
          <div className="combo-stat-grid">
            <div>
              <b>{item.TotalSessions || item.Services?.length || 1}</b>
              <span>Buổi sử dụng</span>
            </div>
            <div>
              <b>{item.ValidityDays || 30}</b>
              <span>Ngày hiệu lực</span>
            </div>
            <div>
              <b>{item.Services?.length || 0}</b>
              <span>Dịch vụ gồm có</span>
            </div>
          </div>

          <div className="payment-box">
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "1rem",
                color: "#303442",
                fontWeight: 700,
              }}
            >
              Chọn phương thức thanh toán
            </h3>

            <div className="payment-method-grid">
              <div
                className={`payment-method-card ${method === "VNPAY" ? "active" : ""}`}
                onClick={() => setMethod("VNPAY")}
              >
                <span className="payment-method-card-icon">💳</span>
                <span className="payment-method-card-title">
                  Thanh toán VNPay
                </span>
              </div>

              <div
                className={`payment-method-card ${method === "PAYOS" ? "active" : ""}`}
                onClick={() => setMethod("PAYOS")}
              >
                <span className="payment-method-card-icon">📲</span>
                <span className="payment-method-card-title">
                  Thanh toán PayOS
                </span>
              </div>

              <div
                className={`payment-method-card ${method === "CASH" ? "active" : ""}`}
                onClick={() => setMethod("CASH")}
              >
                <span className="payment-method-card-icon">💵</span>
                <span className="payment-method-card-title">Tại quầy Spa</span>
              </div>
            </div>

            <div
              style={{
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: "10px",
                padding: "12px 14px",
                margin: "14px 0",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                color: "#8c6b00",
                fontSize: "0.88rem",
                lineHeight: "1.4",
              }}
            >
              <span style={{ fontSize: "1.2rem", lineHeight: "1" }}>⚠️</span>
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#d48806",
                    marginBottom: "2px",
                  }}
                >
                  Chính sách lưu ý:
                </strong>
                Gói combo / liệu trình sau khi đã thanh toán thành công sẽ{" "}
                <strong>KHÔNG ĐƯỢC HỦY HOẶC HOÀN TIỀN</strong> dưới bất kỳ hình
                thức nào. Vui lòng kiểm tra kỹ trước khi thanh toán.
              </div>
            </div>

            {message && (
              <div className="alert error" style={{ margin: "12px 0" }}>
                {message}
              </div>
            )}

            <button
              className="btn"
              disabled={paying}
              onClick={buy}
              style={{
                width: "100%",
                marginTop: "8px",
                justifyContent: "center",
                display: "flex",
              }}
            >
              {paying
                ? "Đang xử lý..."
                : method === "VNPAY"
                  ? "Thanh toán qua VNPay"
                  : method === "PAYOS"
                    ? "Thanh toán qua PayOS"
                    : "Xác nhận mua liệu trình"}
            </button>
          </div>
        </div>
      </div>

      <div className="combo-services-section">
        <h2>Chi tiết dịch vụ & Phép tính giá trị gói</h2>
        <div
          style={{
            background: "#fff9fa",
            border: "1.5px solid rgba(239, 79, 131, 0.15)",
            borderRadius: "16px",
            padding: "18px 24px",
            marginBottom: "28px",
            color: "#5c4554",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px 0",
              fontSize: "1.05rem",
              color: "#2d1424",
              fontWeight: 800,
            }}
          >
            📊 Phép tính giá trị thực tế của gói:
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "0.95rem",
              lineHeight: "1.6",
            }}
          >
            {(item.Services || []).map((s) => {
              const svcPrice = Number(s.Price || 0);
              const count = s.SessionCount || 1;
              const lineVal = svcPrice * count;
              return (
                <li key={s.ServiceId} style={{ marginBottom: "6px" }}>
                  <b>{s.ServiceName}</b>: {money(svcPrice)}/buổi × {count} buổi
                  = <b style={{ color: "#2d1424" }}>{money(lineVal)}</b>
                </li>
              );
            })}
          </ul>
          <div
            style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px dashed rgba(239, 79, 131, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <span>
                Tổng giá trị mua lẻ:{" "}
                <del style={{ color: "#8c7784", fontWeight: 600 }}>
                  {money(item.Price)}
                </del>
              </span>
              <span
                style={{
                  marginLeft: "16px",
                  color: "#ef4f83",
                  fontWeight: 800,
                }}
              >
                Tiết kiệm ngay:{" "}
                {money(Number(item.Price || 0) - Number(item.FinalPrice || 0))}{" "}
                (-{item.DiscountPercent}%)
              </span>
            </div>
            <div
              style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2d1424" }}
            >
              Giá trọn gói:{" "}
              <span style={{ color: "#ef4f83", fontSize: "1.3rem" }}>
                {money(item.FinalPrice)}
              </span>
            </div>
          </div>
        </div>

        <div className="combo-service-list">
          {(item.Services || []).map((s) => (
            <Link
              to={`/services/${s.ServiceId}`}
              className="combo-service-item"
              key={s.ServiceId}
              style={{
                background: "#fff",
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
              }}
            >
              <img
                src={resolveFileUrl(
                  s.ImageUrl || "/images/services/default-service.png",
                )}
                alt={s.ServiceName}
                style={{ width: "120px", height: "120px", objectFit: "cover" }}
              />
              <div>
                <h3
                  style={{
                    fontSize: "1.05rem",
                    margin: "0 0 6px 0",
                    color: "#2d2522",
                  }}
                >
                  {s.ServiceName}
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#667085",
                    margin: "6px 0",
                  }}
                >
                  {s.Description || "Chưa có mô tả cho dịch vụ này."}
                </p>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#ef4f83",
                    fontWeight: 700,
                  }}
                >
                  🕘 {s.DurationMinutes || 60} phút • Số lượng:{" "}
                  {s.SessionCount || s.MaxSessions || 1} buổi (Đơn giá:{" "}
                  {money(s.Price)})
                </span>
              </div>
            </Link>
          ))}
        </div>
        <Link
          className="card-btn"
          to="/packages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            width: "auto",
            padding: "10px 20px",
            marginTop: "20px",
          }}
        >
          ← Quay lại danh sách combo
        </Link>
      </div>
    </section>
  );
}
