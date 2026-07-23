import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import "../../styles/pages/ai-stylist-advisor.css";

const FILTERS = [
  { value: "ALL", label: "Tất cả" },
  { value: "CUT", label: "Kiểu cắt" },
  { value: "TEXTURE", label: "Uốn & phom" },
  { value: "COLOR", label: "Màu tóc" },
];

const AUDIENCES = [
  { value: "FEMALE", label: "Tóc nữ", description: "Bob, layer, shag, butterfly & màu hot" },
  { value: "MALE", label: "Tóc nam", description: "Crop, taper, curtain, mullet & texture" },
];

const LOADING_STAGES = [
  "Đang giữ nguyên đường nét khuôn mặt",
  "Đang dựng phom và đường chân tóc",
  "Đang hòa sợi tóc với ánh sáng gốc",
  "Đang hoàn thiện ảnh tư vấn salon",
];

const MAINTENANCE_LABELS = {
  LOW: "Dễ chăm sóc",
  MEDIUM: "Chăm sóc vừa",
  HIGH: "Cần tạo kiểu",
};

function Icon({ name, size = 18 }) {
  const paths = {
    camera: <><path d="M14.5 5 13 3H7L5.5 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><circle cx="10" cy="12" r="4"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    sparkle: <><path d="m12 3 1.2 3.4L16.5 8l-3.3 1.6L12 13l-1.2-3.4L7.5 8l3.3-1.6Z"/><path d="m5 13 .8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8Z"/><path d="m19 12 .6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6Z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6"/><path d="M10 11v5M14 11v5"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.sparkle}
    </svg>
  );
}

function extractApiData(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function createLocalLookbookFallback(styles, audience) {
  const scopedStyles = styles.filter((style) => [audience, "UNISEX"].includes(style.audience || "UNISEX"));
  const hairstyles = scopedStyles.filter((style) => style.type !== "COLOR").slice(0, 2);
  const colors = scopedStyles.filter((style) => style.type === "COLOR").slice(0, 2);
  const toRecommendation = (style) => ({
    style_id: style.style_id,
    code: style.code,
    name: style.name,
    description: style.description,
    service_id: style.service_id,
  });
  return {
    analysis: {
      face_shape: "Chưa xác định — hãy dùng ảnh chính diện",
      hair_type: "Lookbook local vẫn sẵn sàng",
      skin_tone: "Chưa xác định",
      warnings: ["Không thể kết nối bộ phân tích; bạn vẫn có thể chọn mẫu tóc local."],
    },
    recommendations: {
      hairstyles: hairstyles.map(toRecommendation),
      colors: colors.map(toRecommendation),
    },
    provider: "local-lookbook-fallback",
    model_name: "Salon Local Lookbook",
    fallback_used: true,
    degraded: true,
  };
}

function optimizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Vui lòng chọn ảnh JPEG, PNG hoặc WEBP."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Ảnh vượt quá 10 MB. Vui lòng chọn ảnh nhỏ hơn."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Tệp ảnh không hợp lệ."));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function BeforeAfter({ source, result, value, onChange }) {
  return (
    <div className="stylist-compare" aria-label="So sánh ảnh gốc và ảnh thử tóc">
      <img src={source} alt="Ảnh gốc trước khi thử tóc" />
      <div className="stylist-compare-after" style={{ clipPath: `inset(0 0 0 ${value}%)` }}>
        <img src={result} alt="Ảnh sau khi AI áp dụng kiểu tóc" />
      </div>
      <div className="stylist-compare-line" style={{ left: `${value}%` }} aria-hidden="true">
        <span>↔</span>
      </div>
      <span className="stylist-compare-label is-before">Ảnh gốc</span>
      <span className="stylist-compare-label is-after">Thử tóc</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Kéo để so sánh ảnh gốc và kết quả"
      />
    </div>
  );
}

export default function AiStylistAdvisor() {
  const [styles, setStyles] = useState([]);
  const [audience, setAudience] = useState("FEMALE");
  const [history, setHistory] = useState([]);
  const [photo, setPhoto] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [activeResult, setActiveResult] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [compareValue, setCompareValue] = useState(50);
  const [consent, setConsent] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState("");
  const [styleError, setStyleError] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef([]);

  const filteredStyles = useMemo(
    () => styles.filter((style) => (
      [audience, "UNISEX"].includes(style.audience || "UNISEX")
      && (activeFilter === "ALL" || style.type === activeFilter)
    )),
    [styles, activeFilter, audience],
  );

  const progressStep = activeResult ? 3 : analysis ? 2 : photo ? 1 : 0;
  const recommendations = analysis?.recommendations || {};

  const stopCamera = () => {
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraActive(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraActive || !video || !stream) return undefined;

    let active = true;
    const markReady = () => {
      if (active && video.videoWidth > 0) setCameraReady(true);
    };
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", markReady);
    video.play().then(markReady).catch(() => {
      if (active) setError("Camera đã mở nhưng chưa phát được hình ảnh. Hãy thử đóng và mở lại camera.");
    });

    return () => {
      active = false;
      video.removeEventListener("loadedmetadata", markReady);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [cameraActive]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      axiosClient.get("/ai/stylist/styles"),
      axiosClient.get("/ai/stylist/tryon/history"),
    ]).then(([stylesResult, historyResult]) => {
      if (!active) return;
      if (stylesResult.status === "fulfilled") {
        setStyles(extractApiData(stylesResult.value) || []);
      } else {
        setStyleError(stylesResult.reason?.response?.data?.message || "Không thể tải danh mục mẫu tóc.");
      }
      if (historyResult.status === "fulfilled") setHistory(extractApiData(historyResult.value) || []);
    });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!tryOnLoading) {
      setLoadingStage(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setLoadingStage((value) => (value + 1) % LOADING_STAGES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [tryOnLoading]);

  const resetPhotoState = (nextPhoto = "") => {
    setPhoto(nextPhoto);
    setAnalysis(null);
    setSelectedStyle(null);
    setCustomPrompt("");
    setActiveResult(null);
    setSessionResults([]);
    setCompareValue(50);
    setDeleteArmed(false);
    setError("");
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      stopCamera();
      resetPhotoState(await optimizeImageFile(file));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      event.target.value = "";
    }
  };

  const startCamera = async () => {
    setError("");
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraReady(false);
      setError("Không thể mở camera. Hãy cấp quyền hoặc chọn ảnh từ thiết bị.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!cameraReady || !video?.videoWidth) {
      setError("Camera chưa sẵn sàng. Vui lòng chờ hình ảnh xuất hiện rồi chụp lại.");
      return;
    }
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    resetPhotoState(canvas.toDataURL("image/jpeg", 0.9));
    stopCamera();
  };

  const analyzePhoto = async () => {
    if (!photo) return setError("Vui lòng chụp hoặc tải lên một ảnh chân dung.");
    if (!consent) return setError("Bạn cần đồng ý xử lý ảnh trước khi sử dụng AI Stylist.");
    setAnalysisLoading(true);
    setError("");
    try {
      const response = await axiosClient.post("/ai/stylist/analyze", { image_url: photo, audience });
      const data = extractApiData(response) || {};
      setAnalysis(data);
      const firstSuggestion = data.recommendations?.hairstyles?.[0]?.name;
      if (firstSuggestion) setCustomPrompt(firstSuggestion);
    } catch (requestError) {
      if (styles.length > 0) {
        setAnalysis(createLocalLookbookFallback(styles, audience));
        setError("Phân tích ảnh đang gián đoạn; hệ thống đã mở lookbook local để bạn vẫn có thể thử tóc.");
      } else {
        setError(requestError.response?.data?.message || requestError.message || "AI không thể phân tích ảnh này.");
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const createTryOn = async () => {
    if (!photo || !analysis) return setError("Hãy hoàn tất bước phân tích chân dung trước.");
    if (!selectedStyle && !customPrompt.trim()) return setError("Hãy chọn một mẫu tóc hoặc nhập mô tả riêng.");
    setTryOnLoading(true);
    setError("");
    setDeleteArmed(false);
    try {
      const response = await axiosClient.post("/ai/stylist/tryon", {
        image_url: photo,
        style_id: selectedStyle?.style_id || null,
        prompt: customPrompt.trim() || selectedStyle?.prompt,
      });
      const data = extractApiData(response);
      const result = {
        ...data,
        sourceUrl: photo,
        resultUrl: data.edited_image_data,
        is_favorite: false,
        created_at: new Date().toISOString(),
      };
      setActiveResult(result);
      setSessionResults((items) => [result, ...items]);
      setHistory((items) => [{
        try_on_id: data.try_on_id,
        prompt: data.prompt,
        provider: data.provider,
        model_name: data.model_name,
        status: data.status,
        latency_ms: data.latency_ms,
        style: data.style,
        is_favorite: false,
        created_at: result.created_at,
        source_image_endpoint: `/ai/stylist/tryon/${data.try_on_id}/image/source`,
        result_image_endpoint: `/ai/stylist/tryon/${data.try_on_id}/image/result`,
      }, ...items].slice(0, 24));
      setCompareValue(50);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "AI chưa thể tạo ảnh thử tóc.");
    } finally {
      setTryOnLoading(false);
    }
  };

  const fetchPrivateImage = async (endpoint) => {
    const response = await axiosClient.get(endpoint, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    objectUrlsRef.current.push(url);
    return url;
  };

  const openHistoryItem = async (item) => {
    if (item.status !== "SUCCEEDED") return;
    setHistoryLoading(true);
    setError("");
    try {
      const [sourceUrl, resultUrl] = await Promise.all([
        fetchPrivateImage(item.source_image_endpoint),
        fetchPrivateImage(item.result_image_endpoint),
      ]);
      setPhoto(sourceUrl);
      setActiveResult({ ...item, sourceUrl, resultUrl });
      setSelectedStyle(item.style || null);
      setCustomPrompt(item.prompt || "");
      setCompareValue(50);
      setDeleteArmed(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể mở ảnh trong lịch sử.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!activeResult?.try_on_id) return;
    const nextValue = !activeResult.is_favorite;
    try {
      await axiosClient.patch(`/ai/stylist/tryon/${activeResult.try_on_id}/favorite`, { is_favorite: nextValue });
      setActiveResult((item) => ({ ...item, is_favorite: nextValue }));
      setHistory((items) => items.map((item) => item.try_on_id === activeResult.try_on_id ? { ...item, is_favorite: nextValue } : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể cập nhật mẫu yêu thích.");
    }
  };

  const deleteResult = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    try {
      await axiosClient.delete(`/ai/stylist/tryon/${activeResult.try_on_id}`);
      setHistory((items) => items.filter((item) => item.try_on_id !== activeResult.try_on_id));
      setSessionResults((items) => items.filter((item) => item.try_on_id !== activeResult.try_on_id));
      setActiveResult(null);
      setDeleteArmed(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể xóa ảnh thử tóc.");
    }
  };

  const downloadResult = async () => {
    if (!activeResult?.resultUrl) return;
    const blob = await fetch(activeResult.resultUrl).then((response) => response.blob());
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-hair-tryon-${activeResult.try_on_id || Date.now()}.jpg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const chooseStyle = (style) => {
    setSelectedStyle(style);
    setCustomPrompt(style.prompt || "");
    setError("");
  };

  const chooseAudience = (value) => {
    if (value === audience) return;
    setAudience(value);
    setActiveFilter("ALL");
    setSelectedStyle(null);
    setCustomPrompt("");
    setAnalysis(null);
    setActiveResult(null);
    setError("");
  };

  const chooseRecommendation = (item) => {
    const catalogStyle = styles.find((style) => Number(style.style_id) === Number(item.style_id));
    if (catalogStyle) chooseStyle(catalogStyle);
    else {
      setSelectedStyle(null);
      setCustomPrompt(item.name || "");
    }
  };

  const bookingServiceId = activeResult?.style?.service_id || selectedStyle?.service_id || analysis?.booking_suggestion?.recommended_service_id || "";
  const bookingEmployeeId = analysis?.booking_suggestion?.suggested_stylist_id || "";
  const bookingUrl = `/customer/booking?serviceId=${bookingServiceId}&employeeId=${bookingEmployeeId}&hairPrompt=${encodeURIComponent(activeResult?.prompt || customPrompt)}`;

  return (
    <CustomerLayout>
      <div className="ai-stylist-page">
        <header className="ai-stylist-hero">
          <div>
            <span className="ai-stylist-eyebrow">AI Stylist · Gương thử tóc</span>
            <h1>Tìm mái tóc hợp với bạn,<br />trước khi ngồi vào ghế salon.</h1>
            <p>AI phân tích ảnh thật, gợi ý từ dữ liệu dịch vụ của salon và áp dụng trực tiếp từng kiểu tóc lên chính khuôn mặt của bạn.</p>
          </div>
          <div className="ai-stylist-trust">
            <Icon name="shield" size={20} />
            <div><strong>Ảnh được bảo vệ riêng tư</strong><span>Không lưu base64 trong database · Có thể xóa bất kỳ lúc nào</span></div>
          </div>
        </header>

        <div className="ai-audience-selector" role="group" aria-label="Chọn thư viện kiểu tóc nam hoặc nữ">
          <div><span>Lookbook cá nhân</span><strong>Bạn muốn khám phá kiểu tóc nào?</strong></div>
          {AUDIENCES.map((item) => (
            <button type="button" key={item.value} className={audience === item.value ? "is-active" : ""} onClick={() => chooseAudience(item.value)}>
              <span>{item.label}</span><small>{item.description}</small>
            </button>
          ))}
        </div>

        <ol className="ai-stylist-steps" aria-label="Tiến trình thử tóc">
          {["Ảnh chân dung", "Tư vấn kiểu tóc", "Gương thử tóc"].map((label, index) => (
            <li key={label} className={progressStep >= index + 1 ? "is-complete" : progressStep === index ? "is-active" : ""}>
              <span>{progressStep > index ? <Icon name="check" size={15} /> : index + 1}</span>
              <b>{label}</b>
            </li>
          ))}
        </ol>

        <section className="ai-stylist-workspace">
          <div className="ai-stylist-mirror-panel">
            <div className="ai-stylist-panel-heading">
              <div><span>Gương salon</span><strong>{activeResult ? "Kéo để so sánh trước & sau" : cameraActive ? cameraReady ? "Căn khuôn mặt vào giữa khung" : "Đang khởi động camera…" : "Ảnh chân dung của bạn"}</strong></div>
              {activeResult && <span className="ai-real-badge"><i /> AI ảnh thật · {activeResult.provider}</span>}
            </div>

            <div className={`ai-stylist-mirror ${photo || cameraActive ? "has-photo" : ""}`}>
              {cameraActive ? (
                <div className="ai-stylist-camera-view">
                  <video ref={videoRef} autoPlay muted playsInline />
                  <div className="ai-stylist-face-guide" aria-hidden="true" />
                  <button type="button" className="ai-camera-shutter" onClick={capturePhoto} disabled={!cameraReady} aria-label={cameraReady ? "Chụp ảnh" : "Camera đang khởi động"}><span /></button>
                  <button type="button" className="ai-camera-close" onClick={stopCamera}>Đóng camera</button>
                </div>
              ) : activeResult?.resultUrl ? (
                <BeforeAfter source={activeResult.sourceUrl || photo} result={activeResult.resultUrl} value={compareValue} onChange={setCompareValue} />
              ) : photo ? (
                <img className="ai-stylist-portrait" src={photo} alt="Ảnh chân dung đã chọn" />
              ) : (
                <button type="button" className="ai-stylist-empty-mirror" onClick={() => fileInputRef.current?.click()}>
                  <span className="ai-stylist-empty-icon"><Icon name="image" size={28} /></span>
                  <strong>Bắt đầu với một ảnh rõ khuôn mặt</strong>
                  <small>Ánh sáng đều · nhìn thẳng · không đội mũ · tối đa 10 MB</small>
                  <em><Icon name="upload" size={16} /> Chọn ảnh từ thiết bị</em>
                </button>
              )}

              {tryOnLoading && (
                <div className="ai-stylist-generating" role="status" aria-live="polite">
                  <div className="ai-hair-strands" aria-hidden="true"><i /><i /><i /></div>
                  <strong>AI đang tạo mái tóc mới</strong>
                  <span>{LOADING_STAGES[loadingStage]}</span>
                  <div className="ai-generation-progress"><i style={{ width: `${24 + loadingStage * 22}%` }} /></div>
                  <small>Thường mất khoảng 15–45 giây. Vui lòng giữ trang này mở.</small>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
            <div className="ai-stylist-mirror-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}><Icon name="upload" /> Chọn ảnh</button>
              <button type="button" onClick={cameraActive ? stopCamera : startCamera}><Icon name="camera" /> {cameraActive ? "Đóng camera" : "Chụp ảnh"}</button>
              {photo && <button type="button" onClick={() => { stopCamera(); resetPhotoState(); }}><Icon name="reset" /> Làm lại</button>}
            </div>

            {activeResult && (
              <div className="ai-stylist-result-actions">
                <button type="button" className={activeResult.is_favorite ? "is-favorite" : ""} onClick={toggleFavorite}><Icon name="heart" /> {activeResult.is_favorite ? "Đã lưu" : "Lưu mẫu"}</button>
                <button type="button" onClick={downloadResult}><Icon name="download" /> Tải ảnh</button>
                <Link to={bookingUrl}><Icon name="calendar" /> Đặt lịch kiểu này</Link>
                <button type="button" className={deleteArmed ? "is-danger" : ""} onClick={deleteResult}><Icon name="trash" /> {deleteArmed ? "Xác nhận xóa" : "Xóa ảnh"}</button>
              </div>
            )}
          </div>

          <aside className="ai-stylist-consult-panel">
            {!analysis ? (
              <>
                <div className="ai-consult-heading"><span>01</span><div><strong>Đọc đặc điểm tóc & khuôn mặt</strong><p>AI dùng ảnh thật và lịch sử dịch vụ của bạn để tạo tư vấn cá nhân hóa.</p></div></div>
                <div className="ai-photo-guide">
                  <div><i className="is-good" /><span><strong>Ảnh nên dùng</strong>Mặt nhìn thẳng, đủ sáng, thấy rõ toàn bộ tóc.</span></div>
                  <div><i className="is-bad" /><span><strong>Nên tránh</strong>Mũ, kính che mặt, ảnh mờ hoặc nhiều người.</span></div>
                </div>
                <label className="ai-consent-row">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span><b>Tôi đồng ý cho hệ thống xử lý ảnh để tư vấn và thử tóc.</b><small>Ảnh chỉ hiển thị cho tài khoản này và tự hết hạn theo chính sách lưu trữ.</small></span>
                </label>
                <button type="button" className="ai-primary-action" onClick={analyzePhoto} disabled={!photo || analysisLoading}>
                  <Icon name="sparkle" /> {analysisLoading ? "AI đang phân tích ảnh…" : "Phân tích & mở lookbook"}
                </button>
              </>
            ) : (
              <>
                <div className="ai-consult-heading"><span>02</span><div><strong>Hồ sơ phong cách của bạn</strong><p>{analysis.api_enhanced ? "API phân tích + local kiểm tra an toàn" : "Local fallback"} · Ảnh thử tóc luôn tạo local.</p></div></div>
                {analysis.fallback_used && (
                  <div className="ai-local-mode-note" role="status">
                    <Icon name="shield" size={16} />
                    <span><strong>Đang dùng chế độ local</strong> API nâng cao không khả dụng nhưng lookbook và thử tóc vẫn hoạt động.</span>
                  </div>
                )}
                <dl className="ai-profile-facts">
                  <div><dt>Dáng khuôn mặt</dt><dd>{analysis.analysis?.face_shape || "Đã phân tích"}</dd></div>
                  <div><dt>Chất tóc hiện tại</dt><dd>{analysis.analysis?.hair_type || "Đã phân tích"}</dd></div>
                  <div><dt>Tông da</dt><dd>{analysis.analysis?.skin_tone || "Đã phân tích"}</dd></div>
                </dl>
                <div className="ai-recommendation-block">
                  <span>Stylist AI đề xuất</span>
                  {(recommendations.hairstyles || []).slice(0, 2).map((item, index) => (
                    <button key={`${item.name}-${index}`} type="button" onClick={() => chooseRecommendation(item)}>
                      <i>{String(index + 1).padStart(2, "0")}</i><span><strong>{item.name}</strong><small>{item.description}</small></span><Icon name="arrow" />
                    </button>
                  ))}
                  {(recommendations.colors || []).slice(0, 1).map((item) => (
                    <button key={item.name} type="button" onClick={() => chooseRecommendation(item)}>
                      <i className="is-color" /><span><strong>{item.name}</strong><small>{item.description}</small></span><Icon name="arrow" />
                    </button>
                  ))}
                </div>
                <button type="button" className="ai-secondary-action" onClick={() => { setAnalysis(null); setActiveResult(null); }}><Icon name="reset" /> Phân tích lại ảnh</button>
              </>
            )}

            {error && <div className="ai-stylist-error" role="alert"><strong>Chưa thể hoàn tất</strong><span>{error}</span></div>}
          </aside>
        </section>

        {analysis && (
          <section className="ai-lookbook-section">
            <div className="ai-section-heading">
              <div><span>02 · Lookbook salon</span><h2>Chọn một mẫu để thử trực tiếp</h2><p>Mỗi lựa chọn tạo một ảnh mới; bạn có thể so sánh nhiều mẫu trong cùng phiên.</p></div>
              <div className="ai-lookbook-filters" role="group" aria-label="Lọc mẫu tóc">
                {FILTERS.map((filter) => <button type="button" key={filter.value} className={activeFilter === filter.value ? "is-active" : ""} onClick={() => setActiveFilter(filter.value)}>{filter.label}</button>)}
              </div>
            </div>

            {styleError ? <div className="ai-stylist-error"><span>{styleError}</span></div> : (
              <div className="ai-style-grid">
                {filteredStyles.map((style) => (
                  <button type="button" key={style.style_id} className={`ai-style-card ${selectedStyle?.style_id === style.style_id ? "is-selected" : ""}`} onClick={() => chooseStyle(style)}>
                    <div className="ai-style-image"><img src={resolveFileUrl(style.thumbnail_url)} alt={`Mẫu ${style.name}`} />{style.is_trending && <b className="ai-trend-badge">Hot {style.trend_year || 2026}</b>}<span style={{ background: style.accent_color || "#d6b57e" }} /></div>
                    <div className="ai-style-card-body"><small>{style.type === "COLOR" ? "Màu tóc" : style.length === "SHORT" ? "Tóc ngắn" : style.length === "LONG" ? "Tóc dài" : "Tóc trung bình"}</small><strong>{style.name}</strong><p>{style.description}</p><em>{MAINTENANCE_LABELS[style.maintenance] || "Chăm sóc vừa"}</em></div>
                    <span className="ai-style-check"><Icon name="check" size={14} /></span>
                  </button>
                ))}
              </div>
            )}

            <div className="ai-custom-look">
              <div><span>Tinh chỉnh theo ý bạn</span><strong>{selectedStyle ? `Đang chọn: ${selectedStyle.name}` : "Mô tả mái tóc bạn muốn"}</strong></div>
              <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} maxLength={800} placeholder="Ví dụ: giữ phom layer này nhưng đổi sang màu nâu hạt dẻ, mái bay nhẹ và độ dài ngang vai…" />
              <button type="button" onClick={createTryOn} disabled={tryOnLoading || (!selectedStyle && !customPrompt.trim())}><Icon name="sparkle" /> {tryOnLoading ? "Đang tạo ảnh thật…" : activeResult ? "Tạo thêm một phiên bản" : "Thử kiểu tóc này"}</button>
            </div>
          </section>
        )}

        {(sessionResults.length > 0 || history.length > 0) && (
          <section className="ai-history-section">
            <div className="ai-section-heading">
              <div><span>03 · Bộ sưu tập riêng</span><h2>Những kiểu bạn đã thử</h2><p>Kết quả chỉ tải qua phiên đăng nhập của bạn. Chọn một mẫu để mở lại trong gương.</p></div>
              <Icon name="history" size={24} />
            </div>
            <div className={`ai-history-rail ${historyLoading ? "is-loading" : ""}`}>
              {history.filter((item) => item.status === "SUCCEEDED").map((item) => {
                const liveResult = sessionResults.find((result) => result.try_on_id === item.try_on_id);
                return (
                  <button type="button" key={item.try_on_id} className={activeResult?.try_on_id === item.try_on_id ? "is-active" : ""} onClick={() => liveResult ? setActiveResult(liveResult) : openHistoryItem(item)}>
                    <div>{liveResult?.resultUrl ? <img src={liveResult.resultUrl} alt="Kết quả thử tóc" /> : <span style={{ background: item.style?.accent_color || "#d6b57e" }}><Icon name="image" /></span>}</div>
                    <strong>{item.style?.name || item.prompt}</strong>
                    <small>{new Date(item.created_at).toLocaleDateString("vi-VN")} · {Math.max(1, Math.round((item.latency_ms || 0) / 1000))}s</small>
                    {item.is_favorite && <i><Icon name="heart" size={13} /></i>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <footer className="ai-stylist-disclaimer">
          <Icon name="shield" size={18} />
          <p><strong>Kết quả dùng để tham khảo phong cách.</strong> Màu và phom tóc thực tế còn phụ thuộc nền tóc, chất tóc và kỹ thuật thực hiện. Hãy đặt lịch để stylist kiểm tra trực tiếp trước khi dùng hóa chất.</p>
        </footer>
      </div>
    </CustomerLayout>
  );
}
