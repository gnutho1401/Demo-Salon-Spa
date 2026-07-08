import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

const SAMPLE_PORTRAITS = [
  {
    name: "Nữ tóc lửng (Mặt trái xoan)",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60",
    gender: "Female"
  },
  {
    name: "Nam tóc undercut (Mặt tròn)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60",
    gender: "Male"
  },
  {
    name: "Nữ tóc uốn xoăn (Mặt kim cương)",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60",
    gender: "Female"
  }
];

const TRYON_PRESETS = [
  { label: "💇 Layer ngắn", prompt: "Cắt tóc layer ngắn, tạo độ phồng ôm sát khuôn mặt" },
  { label: "💇 Tóc Bob cụp", prompt: "Cắt tóc bob ngắn ngang cằm, uốn cụp phần đuôi trẻ trung" },
  { label: "💇 Undercut nam", prompt: "Cắt tóc undercut cạo sát hai bên, phần trên vuốt ngược lịch lãm" },
  { label: "🎨 Nhuộm hồng khói", prompt: "Nhuộm tóc thành màu hồng khói trendy cá tính" },
  { label: "🎨 Nhuộm xanh rêu", prompt: "Nhuộm tóc thành màu xanh rêu lạnh thời thượng tôn da" },
  { label: "🎨 Nhuộm bạch kim", prompt: "Nhuộm tóc thành màu vàng bạch kim sang chảnh nổi bật" },
  { label: "🎨 Nhuộm hạt dẻ", prompt: "Nhuộm tóc thành màu nâu hạt dẻ ấm áp tự nhiên" },
  { label: "🌀 Uốn xoăn sóng", prompt: "Làm tóc uốn xoăn sóng bồng bềnh quyến rũ" }
];

// Helper to guess a matching color hex for beauty visual preview
function getColorHex(colorName) {
  if (!colorName) return "#d6b57e";
  const normalized = colorName.toLowerCase();
  if (normalized.includes("mật ong") || normalized.includes("honey")) return "#e6b06c";
  if (normalized.includes("trà sữa") || normalized.includes("milk tea")) return "#cfa888";
  if (normalized.includes("nâu tây")) return "#8f6d53";
  if (normalized.includes("nâu lạnh") || normalized.includes("cold brown")) return "#614e41";
  if (normalized.includes("hạt dẻ") || normalized.includes("chestnut")) return "#824b27";
  if (normalized.includes("khói") || normalized.includes("ash") || normalized.includes("grey")) return "#a8a7a5";
  if (normalized.includes("bạch kim") || normalized.includes("platinum")) return "#e8e7e3";
  if (normalized.includes("đỏ") || normalized.includes("red")) return "#a83232";
  if (normalized.includes("vàng") || normalized.includes("blonde")) return "#eed39b";
  if (normalized.includes("hồng") || normalized.includes("pink")) return "#e3a8bf";
  if (normalized.includes("rêu") || normalized.includes("green")) return "#5b6e58";
  return "#d6b57e"; // Default gold/brown salon accent
}

export default function AiStylistAdvisor() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("morphology"); // "morphology", "styling", "offers"
  const [history, setHistory] = useState([]);

  // AI Hair Try-on states
  const [tryonPrompt, setTryonPrompt] = useState("");
  const [tryonResult, setTryonResult] = useState("");
  const [tryonLoading, setTryonLoading] = useState(false);
  const [tryonError, setTryonError] = useState("");
  const [isMockResult, setIsMockResult] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await axiosClient.get('/ai/stylist/history');
      setHistory(res.data.data || res.data || []);
    } catch (err) {
      console.error("Failed to load consult history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    setCameraActive(true);
    setError("");
    setData(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Không thể truy cập camera. Vui lòng cấp quyền hoặc tải lên tệp ảnh.");
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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
        setData(null);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSample = (url) => {
    stopCamera();
    setImageUrl(url);
    setData(null);
    setError("");
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      setError("Vui lòng chọn hoặc tải lên hình ảnh chân dung.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await axiosClient.post('/ai/stylist/analyze', {
        image_url: imageUrl.trim()
      });
      setData(res.data.data || res.data || {});
      setActiveTab("morphology"); // default to morphology tab upon complete
      fetchHistory(); // refresh history list
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Gặp lỗi khi kết nối máy chủ phân tích hình ảnh."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTryon = async (e) => {
    if (e) e.preventDefault();
    if (!tryonPrompt.trim()) {
      setTryonError("Vui lòng nhập mô tả hoặc chọn một gợi ý nhanh bên dưới.");
      return;
    }
    if (!imageUrl) {
      setTryonError("Vui lòng tải lên ảnh chân dung và bấm phân tích trước.");
      return;
    }

    setTryonLoading(true);
    setTryonError("");
    setTryonResult("");

    try {
      const res = await axiosClient.post("/ai/stylist/tryon", {
        image_url: imageUrl,
        prompt: tryonPrompt.trim()
      });
      if (res.data?.data?.edited_image_url || res.data?.edited_image_url) {
        setTryonResult(res.data.data.edited_image_url || res.data.edited_image_url);
        setIsMockResult(res.data.data.is_mock || false);
      } else {
        throw new Error("Không nhận được hình ảnh kết quả từ server.");
      }
    } catch (err) {
      setTryonError(
        err?.response?.data?.message ||
        err?.message ||
        "Gặp lỗi khi xử lý biến đổi kiểu tóc."
      );
    } finally {
      setTryonLoading(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="luxury-stylist-container">
        <style>{`
          .luxury-stylist-container {
            font-family: 'Outfit', 'Inter', sans-serif;
            color: #2f1d13;
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px 20px;
            animation: pageFadeIn 0.6s ease-out;
          }
          @keyframes pageFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .header-section {
            text-align: center;
            margin-bottom: 40px;
          }
          .header-section h1 {
            font-size: 36px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #a37f55 0%, #3e2511 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .header-section p {
            color: #7c6c60;
            font-size: 16px;
            max-width: 650px;
            margin: 0 auto;
            line-height: 1.6;
          }

          /* Main content grid split */
          .stylist-layout {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 30px;
          }
          @media (max-width: 992px) {
            .stylist-layout {
              grid-template-columns: 1fr;
            }
          }

          /* Control column */
          .control-card {
            background: #ffffff;
            border: 1px solid #eaddca;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 10px 40px rgba(139, 100, 70, 0.04);
            height: fit-content;
            position: sticky;
            top: 20px;
          }
          .section-title {
            font-size: 15px;
            font-weight: 800;
            color: #3e2511;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Sample portrait grid */
          .sample-grid-compact {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .sample-card-compact {
            border: 2px solid #ebdcc5;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
            aspect-ratio: 1;
            transition: all 0.25s ease;
          }
          .sample-card-compact img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .sample-card-compact:hover, .sample-card-compact.active {
            border-color: #a37f55;
            transform: scale(1.05);
            box-shadow: 0 8px 16px rgba(163, 127, 85, 0.2);
          }
          .sample-card-compact.active::after {
            content: "✓";
            position: absolute;
            bottom: 4px;
            right: 4px;
            background: #a37f55;
            color: #fff;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
          }

          /* File & camera buttons */
          .media-action-buttons {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
          }
          .media-btn {
            flex: 1;
            padding: 12px;
            border: 1px solid #eaddca;
            border-radius: 14px;
            font-weight: 700;
            font-size: 13.5px;
            cursor: pointer;
            background: #ffffff;
            color: #5c4a3c;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
          }
          .media-btn:hover {
            border-color: #a37f55;
            background: #faf7f4;
            color: #3e2511;
          }
          .media-btn.active {
            background: #a37f55;
            border-color: #a37f55;
            color: #ffffff;
          }

          /* Live camera stream view */
          .camera-stream-box {
            position: relative;
            background: #1a0f0a;
            border-radius: 18px;
            overflow: hidden;
            aspect-ratio: 4/3;
            margin-bottom: 20px;
            border: 1px solid #ebdcc5;
          }
          .camera-stream-box video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }
          .camera-capture-trigger {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.9);
            border: 0;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.2s;
          }
          .camera-capture-trigger:hover {
            transform: translateX(-50%) scale(1.1);
            background: #ffffff;
          }

          /* Image Preview with scanner effect */
          .image-preview-container {
            position: relative;
            border-radius: 18px;
            overflow: hidden;
            border: 2px solid #eaddca;
            margin-bottom: 20px;
            aspect-ratio: 4/3;
            background: #faf8f5;
          }
          .image-preview-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .scanner-line {
            position: absolute;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, rgba(214,181,126,0) 0%, rgba(214,181,126,1) 50%, rgba(214,181,126,0) 100%);
            box-shadow: 0 0 15px #d6b57e;
            animation: scanEffect 2s linear infinite;
            pointer-events: none;
            z-index: 10;
          }
          @keyframes scanEffect {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
          }
          .scanner-overlay {
            position: absolute;
            inset: 0;
            background: rgba(163, 127, 85, 0.15);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            z-index: 5;
          }
          .scanner-overlay span {
            font-size: 28px;
            margin-bottom: 8px;
            animation: pulseText 1.5s ease-in-out infinite;
          }
          @keyframes pulseText {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.08); opacity: 1; }
          }

          /* Submit analyze button */
          .luxury-submit-btn {
            background: linear-gradient(135deg, #3e2511 0%, #1c1007 100%);
            color: #ffffff;
            border: 0;
            width: 100%;
            padding: 15px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(62, 37, 17, 0.15);
            transition: all 0.25s ease;
          }
          .luxury-submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(62, 37, 17, 0.3);
          }
          .luxury-submit-btn:disabled {
            background: #d8ceca;
            color: #8c7e74;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }

          /* Results dashboard column */
          .results-dashboard {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          /* Navigation Tabs */
          .tabs-header {
            display: flex;
            background: #f2ece6;
            border-radius: 16px;
            padding: 6px;
            gap: 4px;
          }
          .tab-trigger {
            flex: 1;
            padding: 12px 6px;
            font-weight: 700;
            font-size: 14px;
            border-radius: 12px;
            border: 0;
            cursor: pointer;
            background: transparent;
            color: #7c6c60;
            transition: all 0.25s ease;
          }
          .tab-trigger.active {
            background: #ffffff;
            color: #3e2511;
            box-shadow: 0 4px 12px rgba(62, 37, 17, 0.05);
          }

          /* Info card styling */
          .glowing-card {
            background: #ffffff;
            border: 1px solid #ebdcc5;
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(120, 80, 40, 0.02);
            animation: tabContentFade 0.4s ease-out;
          }
          @keyframes tabContentFade {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .glowing-card h2 {
            font-size: 20px;
            font-weight: 800;
            color: #3e2511;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          /* Grid and rows inside cards */
          .badge-showcase {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          @media (max-width: 576px) {
            .badge-showcase {
              grid-template-columns: 1fr;
            }
          }
          .morphology-badge {
            background: #faf8f5;
            border: 1px solid #eaddca;
            border-radius: 16px;
            padding: 16px;
            text-align: center;
            transition: all 0.2s;
          }
          .morphology-badge:hover {
            border-color: #a37f55;
            background: #fffcf8;
          }
          .morphology-badge .label {
            font-size: 11px;
            font-weight: 700;
            color: #a37f55;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            display: block;
            margin-bottom: 6px;
          }
          .morphology-badge .value {
            font-size: 14.5px;
            font-weight: 800;
            color: #3e2511;
          }

          /* Style suggestions grid */
          .suggested-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          @media (max-width: 768px) {
            .suggested-grid {
              grid-template-columns: 1fr;
            }
          }
          .suggested-item {
            background: #ffffff;
            border: 1px solid #eaddca;
            border-radius: 18px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: all 0.25s ease;
          }
          .suggested-item::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: #a37f55;
          }
          .suggested-item:hover {
            transform: translateY(-3px);
            border-color: #a37f55;
            box-shadow: 0 8px 24px rgba(163, 127, 85, 0.1);
          }
          .suggested-item h4 {
            font-size: 16px;
            font-weight: 800;
            color: #3e2511;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .suggested-item p {
            margin: 0;
            font-size: 13.5px;
            color: #7c6c60;
            line-height: 1.5;
          }

          /* Trending Section */
          .trending-container {
            background: linear-gradient(135deg, #fffbf8 0%, #fcf6ef 100%);
            border: 1px solid #ebdcc5;
            border-radius: 20px;
            padding: 20px;
          }
          .trending-list {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .trending-pill {
            background: #ffffff;
            border: 1px solid #eaddca;
            color: #8a653a;
            padding: 8px 18px;
            border-radius: 50px;
            font-size: 13.5px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.02);
            transition: all 0.2s;
          }
          .trending-pill:hover {
            border-color: #8a653a;
            transform: scale(1.03);
          }

          /* Exclusive promo card */
          .promo-card {
            background: linear-gradient(135deg, #fdfbfa 0%, #f7ece1 100%);
            border: 1px dashed #a37f55;
            border-radius: 24px;
            padding: 32px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .promo-card::after {
            content: "👑";
            position: absolute;
            top: -15px;
            right: -15px;
            font-size: 80px;
            opacity: 0.05;
            transform: rotate(20deg);
          }
          .promo-card h3 {
            font-size: 22px;
            font-weight: 850;
            color: #3e2511;
            margin-bottom: 12px;
          }
          .promo-card p.desc {
            font-size: 14.5px;
            color: #5c4a3c;
            max-width: 600px;
            margin: 0 auto 24px;
            line-height: 1.6;
          }
          .pulse-booking-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #a37f55 0%, #876239 100%);
            color: #ffffff;
            border: 0;
            padding: 14px 36px;
            font-size: 15px;
            font-weight: 800;
            border-radius: 14px;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 8px 25px rgba(163, 127, 85, 0.3);
            transition: all 0.25s;
            animation: pulseButton 2s infinite;
          }
          @keyframes pulseButton {
            0% { box-shadow: 0 0 0 0 rgba(163, 127, 85, 0.4); }
            70% { box-shadow: 0 0 0 12px rgba(163, 127, 85, 0); }
            100% { box-shadow: 0 0 0 0 rgba(163, 127, 85, 0); }
          }
          .pulse-booking-btn:hover {
            transform: translateY(-2px);
            opacity: 0.95;
            box-shadow: 0 10px 30px rgba(163, 127, 85, 0.55);
          }
        `}</style>

        {/* Top Header */}
        <div className="header-section">
          <h1>🔮 AI Stylist Advisor Pro</h1>
          <p>
            Trải nghiệm công nghệ AI nhân trắc học cao cấp kết hợp máy học đa phương thức (Multimodal Vision).
            Chúng tôi quét khuôn mặt, kiểm tra chất tóc của bạn để đề xuất màu sắc và kiểu tạo mẫu tối ưu nhất.
          </p>
        </div>

        {/* Main Grid */}
        <div className="stylist-layout">

          {/* Left Column: Image Controls */}
          <div className="control-card">
            <div className="section-title">
              <span>📷</span> Tải hình chân dung
            </div>

            {/* Input Selection tabs */}
            <div className="media-action-buttons">
              <button
                type="button"
                className={`media-btn ${cameraActive ? "active" : ""}`}
                onClick={cameraActive ? stopCamera : startCamera}
              >
                <span>📷</span> Webcam
              </button>
              <label className="media-btn">
                <span>📁</span> Chọn tệp
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {/* Compact Sample Portraits */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#8c7e74", display: "block", marginBottom: 8 }}>
                Hoặc sử dụng ảnh mẫu:
              </span>
              <div className="sample-grid-compact">
                {SAMPLE_PORTRAITS.map((p, idx) => (
                  <div
                    key={idx}
                    className={`sample-card-compact ${imageUrl === p.url ? "active" : ""}`}
                    onClick={() => handleSelectSample(p.url)}
                  >
                    <img src={p.url} alt={p.name} />
                  </div>
                ))}
              </div>
            </div>

            {/* Video stream box */}
            {cameraActive && (
              <div className="camera-stream-box">
                <video ref={videoRef} autoPlay playsInline />
                <button type="button" className="camera-capture-trigger" onClick={capturePhoto}>
                  📸
                </button>
              </div>
            )}

            {/* Image Preview Box with scanning effect */}
            {imageUrl && !cameraActive && (
              <div className="image-preview-container">
                <img src={imageUrl} alt="User portrait preview" />
                {loading && (
                  <>
                    <div className="scanner-line"></div>
                    <div className="scanner-overlay">
                      <span>🤖</span>
                      <div>AI ĐANG ĐỌC HÌNH THỂ...</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Form submit */}
            <form onSubmit={handleAnalyze}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#8c7e74", display: "block", marginBottom: 6 }}>
                  Hoặc điền URL ảnh công khai:
                </span>
                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? "" : imageUrl}
                  onChange={(e) => {
                    stopCamera();
                    setImageUrl(e.target.value);
                    setData(null);
                    setError("");
                  }}
                  placeholder="Dán link ảnh trực tuyến..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ebdcc5",
                    fontSize: "13px",
                    outline: "none",
                    background: "#fdfcfb"
                  }}
                />
              </div>

              {error && (
                <div style={{ color: "#d83b01", fontSize: "12px", marginBottom: 12, fontWeight: 700 }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                className="luxury-submit-btn"
                type="submit"
                disabled={loading || !imageUrl}
              >
                {loading ? "Đang xử lý hình ảnh..." : "🔮 Phân Tích & Tư Vấn Thẩm Mỹ"}
              </button>
            </form>
          </div>

          {/* Right Column: Displaying results */}
          <div className="results-dashboard">

            {/* Connection Banner */}
            {data && (
              <div style={{
                background: data.is_fallback ? "#fff9e6" : "#eefaf2",
                border: "1px solid",
                borderColor: data.is_fallback ? "#ffe28c" : "#a3e2b8",
                borderRadius: "16px",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "14px",
                color: data.is_fallback ? "#856404" : "#155724"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{data.is_fallback ? "⚠️" : "🟢"}</span>
                  <span>
                    {data.is_fallback
                      ? "Chế độ Dự phòng (API đang bận, đã kích hoạt bộ quy tắc salon)"
                      : "Kết nối AI thật trực tiếp thành công (Gemini Vision)"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", fontWeight: "800", opacity: 0.7, background: "rgba(0,0,0,0.05)", padding: "4px 10px", borderRadius: "50px" }}>
                  Model: {data.model_name}
                </div>
              </div>
            )}

            {data ? (
              <>
                {/* Tabs selection */}
                <div className="tabs-header">
                  <button
                    className={`tab-trigger ${activeTab === "morphology" ? "active" : ""}`}
                    onClick={() => setActiveTab("morphology")}
                  >
                    👤 Đặc điểm nhân trắc
                  </button>
                  <button
                    className={`tab-trigger ${activeTab === "styling" ? "active" : ""}`}
                    onClick={() => setActiveTab("styling")}
                  >
                    💇 Kiểu tóc & Màu nhuộm
                  </button>
                  <button
                    className={`tab-trigger ${activeTab === "offers" ? "active" : ""}`}
                    onClick={() => setActiveTab("offers")}
                  >
                    👑 Đề xuất liệu trình VIP
                  </button>
                </div>

                {/* TAB 1: MORPHOLOGY */}
                {activeTab === "morphology" && (
                  <div className="glowing-card">
                    <h2>👤 Phân Tích Hình Thể Học Khuôn Mặt</h2>
                    <p style={{ color: "#7c6c60", fontSize: "14px", marginTop: -12, marginBottom: 24, lineHeight: 1.5 }}>
                      Mô hình AI đa phương thức đã phân tích cấu trúc xương, kết cấu tóc và sắc tố dưới da của bạn để kết luận các chỉ số sau:
                    </p>

                    <div className="badge-showcase">
                      <div className="morphology-badge">
                        <span className="label">Hình dáng mặt</span>
                        <span className="value">{data.analysis?.face_shape}</span>
                      </div>
                      <div className="morphology-badge">
                        <span className="label">Kết cấu tóc</span>
                        <span className="value">{data.analysis?.hair_type}</span>
                      </div>
                      <div className="morphology-badge">
                        <span className="label">Sắc tố da</span>
                        <span className="value">{data.analysis?.skin_tone}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, background: "#faf8f5", borderRadius: 16, padding: 18, border: "1px solid #ebdcc5" }}>
                      <span style={{ fontSize: 20 }}>💡</span>
                      <div style={{ fontSize: "13.5px", color: "#5c4a3c", lineHeight: "1.5" }}>
                        <strong>Nhận xét từ Cố vấn Thẩm mỹ:</strong> Dáng mặt {data.analysis?.face_shape} là một lợi thế hình thể tuyệt vời. Thiết kế tóc phù hợp sẽ tập trung làm tôn lên các điểm sáng trên gò má và tạo độ thanh thoát tối đa.
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: STYLING RECOMMENDATIONS */}
                {activeTab === "styling" && (
                  <div className="glowing-card">
                    <h2>💇 Phác Thảo Thiết Kế Kiểu Tóc & Màu Sắc</h2>

                    <div className="suggested-grid" style={{ marginBottom: 28 }}>
                      <div>
                        <h3 style={{ fontSize: "15px", color: "#a37f55", marginBottom: 12, textTransform: "uppercase" }}>
                          Kiểu cắt tạo kiểu
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {(data.recommendations?.hairstyles || []).map((h, idx) => (
                            <div key={idx} className="suggested-item">
                              <h4><span>✂️</span> {h.name}</h4>
                              <p>{h.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 style={{ fontSize: "15px", color: "#a37f55", marginBottom: 12, textTransform: "uppercase" }}>
                          Màu nhuộm nịnh da
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {(data.recommendations?.colors || []).map((c, idx) => {
                            const sampleColor = getColorHex(c.name);
                            return (
                              <div key={idx} className="suggested-item">
                                <h4>
                                  <span style={{
                                    display: "inline-block",
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    background: sampleColor,
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                                    border: "1px solid #fff"
                                  }} />
                                  {c.name}
                                </h4>
                                <p>{c.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Trending banner inside tab */}
                    {data.trending && (
                      <div className="trending-container">
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "800", color: "#3e2511" }}>
                          🔥 Bắt nhịp xu hướng: {data.trending.title}
                        </h4>
                        <div className="trending-list">
                          {(Array.isArray(data.trending.styles) ? data.trending.styles : []).map((s, idx) => (
                            <span key={idx} className="trending-pill">
                              ✨ {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: TREATMENTS & BOOKING SUGGESTION */}
                {activeTab === "offers" && (
                  <div className="glowing-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                    {/* Treatment details */}
                    <div>
                      <h2>👑 Liệu Trình Chăm Sóc & Phục Hồi Cao Cấp</h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {(data.upsell || []).map((u, idx) => (
                          <div key={idx} style={{
                            background: "#ffffff",
                            border: "1px solid #eaddca",
                            borderRadius: "16px",
                            padding: "20px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.01)"
                          }}>
                            <h4 style={{ fontSize: "15px", fontWeight: "800", color: "#8a653a", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                              💎 {u.service_name}
                            </h4>
                            <p style={{ margin: 0, fontSize: "13.5px", color: "#5c4a3c", lineHeight: "1.5" }}>
                              {u.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Booking Card */}
                    <div className="promo-card">
                      <h3>📅 Đăng ký trải nghiệm dịch vụ cùng chuyên gia</h3>
                      <p className="desc">
                        {(data.upsell || [])[0]
                          ? `Hệ thống gợi ý bạn nên thực hiện dịch vụ "${(data.upsell || [])[0].service_name}" để có mái tóc hoàn hảo nhất.`
                          : "Đăng ký dịch vụ ngay để nhận ưu đãi thành viên."}
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <a
                          href={`/customer/booking?serviceId=${data.booking_suggestion?.recommended_service_id || ""}&employeeId=${data.booking_suggestion?.suggested_stylist_id || ""}`}
                          className="pulse-booking-btn"
                        >
                          📅 Đặt Lịch Hẹn Ngay
                        </a>

                        {data.booking_suggestion?.reason && (
                          <div style={{ fontSize: "12.5px", color: "#8c7e74", fontStyle: "italic", maxWidth: 500, lineHeight: 1.4 }}>
                            <strong>Đề xuất từ salon:</strong> {data.booking_suggestion.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI HAIR CUSTOMIZER SECTION */}
                <div className="glowing-card" style={{ marginTop: 24, border: "1px solid #ffdce3", background: "#fffbfc" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: 10, color: "#e8396c", fontSize: "18px", margin: "0 0 12px 0" }}>
                    <span>🔮</span> AI Hair Customizer (Thử Tóc Ảo)
                  </h2>
                  <p style={{ color: "#675464", fontSize: "13.5px", marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
                    Tự thiết kế mái tóc mơ ước của bạn! Chọn một gợi ý nhanh bên dưới hoặc tự nhập mô tả để thay đổi kiểu tóc/màu tóc trên ảnh gốc.
                  </p>

                  {/* Preset chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {TRYON_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTryonPrompt(p.prompt);
                          setTryonError("");
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          borderRadius: "20px",
                          border: tryonPrompt === p.prompt ? "1px solid #e8396c" : "1px solid #ffe0eb",
                          background: tryonPrompt === p.prompt ? "#ffeef2" : "#ffffff",
                          color: tryonPrompt === p.prompt ? "#e8396c" : "#675464",
                          fontWeight: tryonPrompt === p.prompt ? "700" : "500",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Prompt Textarea */}
                  <form onSubmit={handleTryon} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <textarea
                      value={tryonPrompt}
                      onChange={(e) => {
                        setTryonPrompt(e.target.value);
                        setTryonError("");
                      }}
                      placeholder="Mô tả kiểu tóc hoặc màu sắc bạn muốn thử (ví dụ: làm tóc ngang vai màu xám khói, cắt mái ngố)..."
                      style={{
                        width: "100%",
                        height: "80px",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid #ffdce3",
                        outline: "none",
                        fontSize: "13px",
                        resize: "none",
                        fontFamily: "inherit",
                        color: "#2d2430",
                        boxSizing: "border-box"
                      }}
                    />

                    {tryonError && (
                      <div style={{ color: "#ff3366", fontSize: "12px", fontWeight: "700" }}>
                        ⚠️ {tryonError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={tryonLoading || !tryonPrompt.trim()}
                      style={{
                        padding: "12px",
                        background: tryonLoading ? "#b9a8b4" : "linear-gradient(135deg, #ff4778, #e8396c)",
                        color: "white",
                        fontWeight: "700",
                        fontSize: "13.5px",
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        transition: "all 0.3s",
                        boxShadow: tryonLoading ? "none" : "0 4px 15px rgba(232, 57, 108, 0.2)"
                      }}
                    >
                      {tryonLoading ? "⏳ AI đang thiết kế mái tóc mới..." : "🔮 Bắt Đầu Biến Đổi Tóc"}
                    </button>
                  </form>

                  {/* Before / After results panel */}
                  {(tryonResult || tryonLoading) && (
                    <div style={{ marginTop: 24, borderTop: "1px dashed #ffdce3", paddingTop: 20 }}>
                      <h3 style={{ fontSize: "14.5px", color: "#e8396c", marginBottom: 16, fontWeight: 700, marginTop: 0 }}>
                        📸 So sánh kết quả biến đổi
                      </h3>
                      
                      {isMockResult && !tryonLoading && (
                        <div style={{
                          background: "#fff9e6",
                          border: "1px solid #ffe28c",
                          borderRadius: "12px",
                          padding: "12px 16px",
                          marginBottom: 16,
                          fontSize: "13px",
                          color: "#856404",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textAlign: "left",
                          lineHeight: "1.4"
                        }}>
                          <span style={{ fontSize: "18px" }}>💡</span>
                          <span>
                            <strong>Chế độ Mô phỏng:</strong> Do chưa cấu hình khóa API thật `REPLICATE_API_TOKEN` ở backend, hệ thống đang hiển thị ảnh minh họa mẫu tương tự từ thư viện. Khi được cấu hình, AI thật sẽ thay thế kiểu tóc trực tiếp trên chính khuôn mặt bạn!
                          </span>
                        </div>
                      )}
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {/* Before */}
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: "11px", color: "#a38f9d", fontWeight: "700", display: "block", marginBottom: 6 }}>
                            ẢNH GỐC
                          </span>
                          <div style={{ width: "100%", height: "200px", borderRadius: "12px", overflow: "hidden", border: "1px solid #f3e6e8" }}>
                            <img src={imageUrl} alt="Before" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        </div>

                        {/* After */}
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: "11px", color: "#e8396c", fontWeight: "700", display: "block", marginBottom: 6 }}>
                            ẢNH BIẾN ĐỔI (AI)
                          </span>
                          <div style={{ 
                            width: "100%", 
                            height: "200px", 
                            borderRadius: "12px", 
                            overflow: "hidden", 
                            border: "1px solid #ffccd7", 
                            background: "#faf6f7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative"
                          }}>
                            {tryonLoading ? (
                              <div style={{ textAlign: "center" }}>
                                <div className="tryon-spinner" style={{
                                  width: "32px",
                                  height: "32px",
                                  border: "3px solid #ffeef2",
                                  borderTop: "3px solid #e8396c",
                                  borderRadius: "50%",
                                  animation: "spin 1s linear infinite",
                                  margin: "0 auto 10px"
                                }} />
                                <span style={{ fontSize: "12px", color: "#e8396c", fontWeight: 600 }}>AI đang xử lý...</span>
                              </div>
                            ) : (
                              <img src={tryonResult} alt="After" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Booking Action */}
                      {!tryonLoading && tryonResult && (
                        <div style={{ marginTop: 24, textAlign: "center", background: "#ffeef2", padding: "16px", borderRadius: "12px", border: "1px solid #ffccd7" }}>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#e8396c", fontWeight: 800 }}>
                            😍 Bạn hài lòng với kiểu tóc này?
                          </h4>
                          <p style={{ margin: "0 0 14px 0", fontSize: "12.5px", color: "#675464", lineHeight: 1.4 }}>
                            Đăng ký làm tóc và nhuộm màu này ngay hôm nay để nhận tư vấn trực tiếp từ stylist hàng đầu!
                          </p>
                          <a
                            href={`/customer/booking?serviceId=${data.booking_suggestion?.recommended_service_id || ""}&employeeId=${data.booking_suggestion?.suggested_stylist_id || ""}&hairPrompt=${encodeURIComponent(tryonPrompt)}&hairImage=${encodeURIComponent(tryonResult)}`}
                            style={{
                              display: "inline-block",
                              padding: "10px 24px",
                              background: "linear-gradient(135deg, #ff4778, #e8396c)",
                              color: "white",
                              borderRadius: "24px",
                              fontWeight: "700",
                              fontSize: "13px",
                              textDecoration: "none",
                              boxShadow: "0 4px 10px rgba(232, 57, 108, 0.2)",
                              transition: "all 0.2s"
                            }}
                          >
                            📅 Đặt Lịch Làm Tóc Kiểu Này
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add keyframe spinner css if needed */}
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              </>
            ) : (
              // Empty initial dashboard view
              <div style={{
                background: "#ffffff",
                border: "1px dashed #ebdcc5",
                borderRadius: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 40px",
                textAlign: "center",
                height: "100%",
                minHeight: 400
              }}>
                <span style={{ fontSize: "60px", marginBottom: 20, animation: "bounce 2s infinite" }}>🔮</span>
                <style>{`
                  @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                  }
                `}</style>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#3e2511", marginBottom: 8 }}>
                  Khởi Tạo AI Stylist Advisor
                </h3>
                <p style={{ color: "#8c7e74", fontSize: "14.5px", maxWidth: 450, margin: 0, lineHeight: 1.5 }}>
                  Hãy chọn một bức ảnh chân dung mẫu ở cột bên trái hoặc tải ảnh chân dung cận cảnh của bạn lên để bắt đầu phân tích hình thể học.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div style={{ marginTop: 40, borderTop: "1px solid #eaddca", paddingTop: 30 }}>
            <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#3e2511", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>📜</span> Lịch sử phân tích & tư vấn của bạn
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20
            }}>
              {history.map((item, idx) => {
                const formattedDate = new Date(item.created_at).toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                const isFallbackItem = item.is_fallback;
                return (
                  <div 
                    key={item.audit_id || idx}
                    onClick={() => {
                      setData(item);
                      if (item.image_url) {
                        setImageUrl(item.image_url);
                      }
                      setActiveTab("morphology");
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid",
                      borderColor: data?.audit_id === item.audit_id ? "#a37f55" : "#eaddca",
                      borderRadius: "16px",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "all 0.25s",
                      boxShadow: data?.audit_id === item.audit_id ? "0 8px 24px rgba(163, 127, 85, 0.15)" : "none",
                      display: "flex",
                      gap: "14px",
                      alignItems: "center"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#a37f55";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      if (data?.audit_id !== item.audit_id) {
                        e.currentTarget.style.borderColor = "#eaddca";
                      }
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Portrait Thumbnail */}
                    <div style={{ width: "65px", height: "65px", borderRadius: "10px", overflow: "hidden", border: "1px solid #eaddca", flexShrink: 0, background: "#faf8f5" }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt="Portrait scanned" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", background: "#f2ece6", color: "#a37f55" }}>👤</div>
                      )}
                    </div>

                    {/* Details Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: "11px", color: "#8c7e74", fontWeight: "700" }}>{formattedDate}</span>
                        <span style={{
                          fontSize: "9px",
                          fontWeight: "800",
                          padding: "2px 6px",
                          borderRadius: "50px",
                          background: isFallbackItem ? "#fff9e6" : "#eefaf2",
                          color: isFallbackItem ? "#856404" : "#155724"
                        }}>
                          {isFallbackItem ? "Dự phòng" : "AI Thật"}
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong>Kiểu tóc:</strong> <span style={{ color: "#8a653a", fontWeight: "700" }}>{item.recommendations?.hairstyles?.[0]?.name || "N/A"}</span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5c4a3c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.analysis?.face_shape || "N/A"} | {item.analysis?.hair_type || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
