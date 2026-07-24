import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function SkinAnalyzerPage() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchHistory = async () => {
    try {
      const res = await axiosClient.get("/ai/skin/history");
      setHistory(res.data.data || res.data || []);
    } catch (err) {
      console.error("Failed to load skin analysis history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const startCamera = async () => {
    setCameraActive(true);
    setError("");
    setData(null);
    setImageUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError(
        "Không thể truy cập camera. Vui lòng cấp quyền hoặc tải lên tệp ảnh.",
      );
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg");
      setImageUrl(base64);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      stopCamera();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
        setData(null);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!imageUrl) {
      setError("Vui lòng chụp ảnh hoặc tải lên hình ảnh khuôn mặt của bạn.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await axiosClient.post("/ai/skin/analyze", {
        imageUrl: imageUrl,
      });

      const analysisResult = res.data?.data || res.data || {};
      if (analysisResult.is_face === false) {
        setError(
          analysisResult.error ||
            "Không nhận diện được khuôn mặt. Vui lòng chụp rõ mặt hơn!",
        );
      } else {
        setData(analysisResult);
        fetchHistory(); // Refresh history list
      }
    } catch (err) {
      console.error("Skin analysis failed:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Gặp lỗi khi kết nối máy chủ phân tích hình ảnh.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper to load a historical analysis into display
  const handleLoadHistoryItem = (item) => {
    stopCamera();
    setImageUrl(item.ImageUrl);
    setData({
      skin_type: item.SkinType,
      acne_level: item.AcneLevel,
      wrinkle_level: item.WrinkleLevel,
      dark_spots: item.DarkSpots,
      redness: item.Redness,
      pores: item.Pores || "Bình thường",
      hydration: item.Hydration || "Đủ ẩm",
      sebum: item.Sebum || "Bình thường",
      skin_barrier: item.SkinBarrier || "Khỏe mạnh",
      elasticity: item.Elasticity || "Tốt",
      dark_circles: item.DarkCircles || "Không có",
      skin_score: item.SkinScore,
      summary: item.Summary,
      routine_suggestion: item.RoutineSuggestion,
      recommended_services: [],
    });
    setError("");
  };

  // Calculate score rating text
  const getScoreRating = (score) => {
    if (score >= 90) return { label: "Xuất sắc", color: "#22c55e" };
    if (score >= 75) return { label: "Tốt", color: "#3b82f6" };
    if (score >= 60) return { label: "Khá", color: "#eab308" };
    return { label: "Cần Chăm Sóc", color: "#ef4444" };
  };

  return (
    <CustomerLayout>
      <div className="skin-analyzer-container">
        {/* Header section */}
        <div className="analyzer-header">
          <h1>✨ AI Skin Analyzer</h1>
          <p>
            Phân tích tình trạng da thông minh qua ảnh chân dung hoặc ảnh chụp
            cận cảnh làn da & gợi ý liệu trình spa phù hợp
          </p>
        </div>

        {/* Core grid */}
        <div className="analyzer-dashboard-grid">
          {/* Left panel: Upload & Capture */}
          <div className="upload-panel">
            <div
              className={`scan-zone-wrapper ${imageUrl || cameraActive ? "has-image" : ""}`}
            >
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Skin to analyze"
                  className="image-preview"
                />
              ) : (
                <div className="placeholder-content">
                  <span className="placeholder-icon">📸</span>
                  <p style={{ color: "#777", fontSize: "0.95rem" }}>
                    Chưa có hình ảnh
                  </p>
                </div>
              )}

              {/* Laser scanning bar animation when loading */}
              {loading && <div className="scanning-bar" />}
            </div>

            {/* Controller buttons */}
            <div className="upload-btn-group">
              {cameraActive ? (
                <button
                  type="button"
                  className="custom-file-upload"
                  onClick={capturePhoto}
                >
                  📸 Chụp hình
                </button>
              ) : (
                <button
                  type="button"
                  className="custom-file-upload"
                  onClick={startCamera}
                >
                  📹 Mở Camera
                </button>
              )}

              {cameraActive && (
                <button
                  type="button"
                  className="custom-file-upload"
                  style={{
                    background: "#f3e8ff",
                    color: "#6b21a8",
                    borderColor: "#c084fc",
                  }}
                  onClick={stopCamera}
                >
                  Dừng Camera
                </button>
              )}

              <label className="custom-file-upload">
                📂 Tải ảnh lên
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {error && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "0.88rem",
                  marginBottom: "15px",
                  textAlign: "center",
                  padding: "0 10px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              type="button"
              className="action-btn-primary"
              disabled={loading || !imageUrl}
              onClick={handleAnalyze}
            >
              {loading ? "⌛ Đang phân tích..." : "🔮 Bắt Đầu Phân Tích"}
            </button>
          </div>

          {/* Right panel: Results */}
          <div className="results-panel">
            {loading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: "300px",
                }}
              >
                <div className="placeholder-icon" style={{ fontSize: "3rem" }}>
                  🧬
                </div>
                <h3 style={{ marginTop: "15px", color: "var(--pink)" }}>
                  Trí tuệ nhân tạo đang phân tích...
                </h3>
                <p
                  style={{
                    color: "#777",
                    fontSize: "0.9rem",
                    textAlign: "center",
                    marginTop: "8px",
                  }}
                >
                  AI đang quét bề mặt da, phát hiện các vùng mụn, thâm sạm và đo
                  lường nếp nhăn. Vui lòng chờ trong giây lát.
                </p>
              </div>
            ) : data ? (
              <div>
                {/* Score Section */}
                <div className="score-section">
                  <div className="circular-score">
                    <span className="score-num">{data.skin_score}</span>
                    <span className="score-lbl">Điểm da</span>
                  </div>
                  <div className="score-text">
                    <h3>
                      Làn da:{" "}
                      <span
                        style={{ color: getScoreRating(data.skin_score).color }}
                      >
                        {getScoreRating(data.skin_score).label}
                      </span>
                    </h3>
                    <p>{data.summary}</p>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-title">Loại da</span>
                    <span className="skin-type-tag">{data.skin_type}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Mức độ mụn</span>
                    <span className="metric-value">{data.acne_level}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Nếp nhăn</span>
                    <span className="metric-value">{data.wrinkle_level}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Tàn nhang / Thâm</span>
                    <span className="metric-value">{data.dark_spots}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Ẩng đỏ / Kích ứng</span>
                    <span className="metric-value">{data.redness}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Lỗ chân lông</span>
                    <span className="metric-value">
                      {data.pores || "Bình thường"}
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Độ cấp ẩm</span>
                    <span className="metric-value">
                      {data.hydration || "Đủ ẩm"}
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Độ tiết dầu</span>
                    <span className="metric-value">
                      {data.sebum || "Bình thường"}
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Hàng rào bảo vệ</span>
                    <span className="metric-value">
                      {data.skin_barrier || "Khỏe mạnh"}
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">Độ đàn hồi / Lão hóa</span>
                    <span className="metric-value">
                      {data.elasticity || "Tốt"}
                    </span>
                  </div>
                  <div className="metric-card" style={{ gridColumn: "span 2" }}>
                    <span className="metric-title">Quầng thâm mắt</span>
                    <span className="metric-value">
                      {data.dark_circles || "Không có"}
                    </span>
                  </div>
                </div>

                {/* Skincare Routine */}
                <div className="routine-box">
                  <h4>💡 Lộ trình chăm sóc da gợi ý:</h4>
                  <pre className="routine-text">{data.routine_suggestion}</pre>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: "350px",
                  textAlign: "center",
                  color: "#8c7b74",
                }}
              >
                <span style={{ fontSize: "3.5rem", marginBottom: "15px" }}>
                  💆‍♀️
                </span>
                <h3>Chưa có kết quả phân tích</h3>
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "#777",
                    maxWidth: "330px",
                    marginTop: "8px",
                  }}
                >
                  Vui lòng tải lên ảnh selfie cận mặt hoặc ảnh chụp cận cảnh một
                  vùng da cụ thể (như vùng má, trán, cằm, da tay...) rồi nhấn
                  "Bắt Đầu Phân Tích".
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recommended Services Section */}
        {data &&
          data.recommended_services &&
          data.recommended_services.length > 0 && (
            <div className="skincare-recommendations">
              <h2>🏥 Liệu trình khuyên dùng tại Salon:</h2>
              <div className="rec-services-grid">
                {data.recommended_services.map((service, index) => (
                  <div className="rec-service-card" key={index}>
                    <h3>{service.service_name}</h3>
                    <p className="rec-service-reason">💡 {service.reason}</p>
                    <div className="rec-service-footer">
                      <span className="rec-service-price">Chuyên sâu</span>
                      <button
                        type="button"
                        className="book-now-btn"
                        onClick={() =>
                          navigate(
                            `/customer/booking?serviceId=${service.service_id}`,
                          )
                        }
                      >
                        Đặt lịch ngay ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Skin Journey Section (Lịch sử) */}
        {history && history.length > 0 && (
          <div className="skin-journey-section">
            <h2>📈 Skin Journey (Nhật ký làn da)</h2>
            <div className="timeline-wrapper">
              {history.map((item) => (
                <div className="timeline-item" key={item.AnalysisId}>
                  <div className="timeline-dot" />
                  <div className="timeline-date">
                    {new Date(item.CreatedAt).toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div
                    className="timeline-card"
                    onClick={() => handleLoadHistoryItem(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="timeline-info">
                      <h4>Làn da {item.SkinType}</h4>
                      <p
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.Summary}
                      </p>
                    </div>
                    <div className="timeline-score">{item.SkinScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
