import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/treatment-notes-v2.css";

/* ─────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");

const getDayOfWeekVn = (date) => {
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return days[date.getDay()];
};

function parseLocalDate(str) {
  if (!str) return new Date();
  let s = String(str);
  if (s.includes("T") || s.endsWith("Z")) {
    return new Date(s);
  }
  s = s.replace(" ", "T");
  return new Date(s);
}


function parseDateParts(str) {
  if (!str) return { day: "--", thMonth: "--", year: "----", full: "--/--/----", weekday: "--" };
  const d = parseLocalDate(str);
  return {
    day: pad(d.getDate()),
    thMonth: `TH${pad(d.getMonth() + 1)}`,
    year: d.getFullYear(),
    full: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    weekday: getDayOfWeekVn(d),
  };
}

function formatTimeRange(str, durationMin) {
  if (!str) return "—";
  const d = parseLocalDate(str);
  const startH = pad(d.getHours()), startM = pad(d.getMinutes());
  if (!durationMin) return `${startH}:${startM}`;
  const end = new Date(d.getTime() + durationMin * 60000);
  const endH = pad(end.getHours()), endM = pad(end.getMinutes());
  const h = Math.floor(durationMin / 60), m = durationMin % 60;
  const dur = h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
  return `${startH}:${startM} - ${endH}:${endM} (${dur})`;
}

function fmtMoney(val) {
  if (val == null) return "—";
  return Number(val).toLocaleString("vi-VN") + "đ";
}

function formatTime(value) {
  if (!value) return "";
  if (value instanceof Date || (typeof value === "object" && typeof value.getHours === "function")) {
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (typeof value === "object") {
    const ms = value.ms !== undefined ? value.ms : value.milliseconds;
    if (typeof ms === "number") {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  const str = String(value);
  if (str.includes("T")) {
    const parts = str.split("T")[1];
    if (parts) return parts.slice(0, 5);
  }
  const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
  const match = str.match(timeRegex);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return str.slice(0, 5);
}

/* ─────────────────────────────────────────
   PRODUCT CATALOG (by service category)
   ───────────────────────────────────────── */
const PRODUCT_CATALOG = {
  "Nail": [
    "Son gel OPI - Bubble Bath (Hồng pastel)",
    "Son gel OPI - Malaga Wine (Đỏ burgundy)",
    "Son gel OPI - Lincoln Park (Đen xanh)",
    "Top Coat OPI - Bóng cao cấp",
    "Base Coat OPI - Bảo vệ móng",
    "Dầu dưỡng móng OPI - Nail Oil",
    "Acetone tẩy sơn chuyên dụng",
    "Dũa móng điện chuyên nghiệp",
    "Keo nail art - Gel trong",
    "Bột acrylic - Trắng/Hồng",
    "Đèn UV/LED gel chiếu khô",
  ],
  "Massage": [
    "Tinh dầu Lavender thư giãn",
    "Tinh dầu Peppermint giảm đau",
    "Tinh dầu Eucalyptus thông mũi",
    "Tinh dầu Lemon sảng khoái",
    "Đá bazan trị liệu nóng 55°C",
    "Kem massage Deep Tissue",
    "Dầu dừa hữu cơ nguyên chất",
    "Gel lạnh giảm sưng viêm",
    "Muối Himalaya ngâm chân",
    "Khăn nóng thảo dược",
  ],
  "Waxing": [
    "Sáp wax mật ong (da nhạy cảm)",
    "Sáp wax chocolate (da thường)",
    "Sáp wax lavender (da khô)",
    "Phấn rôm chuẩn bị da",
    "Dầu after-wax dịu nhẹ",
    "Kem làm dịu sau wax Aloe Vera",
    "Băng wax vải cotton",
    "Nước tẩy trang trước wax",
  ],
  "Facial": [
    "Sữa rửa mặt CeraVe dịu nhẹ",
    "Toner Klairs - Cân bằng độ ẩm",
    "Serum Vitamin C - Làm sáng da",
    "Serum Hyaluronic Acid - Cấp ẩm",
    "Retinol - Tái tạo tế bào",
    "Kem dưỡng ẩm SPF50+",
    "Mặt nạ đất sét - Kiểm soát dầu",
    "Mặt nạ collagen - Căng bóng",
    "Kem tẩy tế bào chết enzyme",
    "Nước cân bằng pH da",
    "Máy siêu âm đẩy dưỡng chất",
  ],
  "Hair": [
    "Dầu gội Kerastase dưỡng tóc",
    "Dầu xả Kerastase phục hồi",
    "Kem ủ tóc collagen",
    "Serum dưỡng tóc Argan Oil",
    "Thuốc nhuộm tóc Loreal",
    "Oxy nhuộm 20Vol / 30Vol",
    "Thuốc uốn/duỗi ceramic",
    "Keo tạo kiểu giữ nếp",
    "Xịt dưỡng nhiệt bảo vệ tóc",
  ],
  "Spa": [
    "Muối khoáng tắm khoáng",
    "Sữa tắm dưỡng thể hoa hồng",
    "Tẩy tế bào chết body cà phê",
    "Kem body butter dưỡng ẩm sâu",
    "Mặt nạ bùn khoáng",
    "Viên bom tắm thư giãn",
    "Tinh dầu xông hơi",
    "Trà thảo mộc detox",
  ],
  "default": [
    "Dung dịch vệ sinh chuyên dụng",
    "Kem dưỡng ẩm đa năng",
    "Bông tẩy trang y tế",
    "Cồn 70° khử trùng dụng cụ",
    "Găng tay y tế vô trùng",
    "Khăn giấy cao cấp",
  ]
};

function getProductsByCategory(categoryName = "", serviceName = "") {
  const cat = categoryName.toLowerCase();
  const svc = serviceName.toLowerCase();
  if (cat.includes("nail") || svc.includes("nail") || svc.includes("móng")) return PRODUCT_CATALOG["Nail"];
  if (cat.includes("massage") || svc.includes("massage") || svc.includes("đá nóng") || svc.includes("body")) return PRODUCT_CATALOG["Massage"];
  if (cat.includes("wax") || svc.includes("wax") || svc.includes("triệt")) return PRODUCT_CATALOG["Waxing"];
  if (cat.includes("facial") || svc.includes("facial") || svc.includes("da mặt") || svc.includes("chăm sóc da")) return PRODUCT_CATALOG["Facial"];
  if (cat.includes("hair") || svc.includes("tóc") || svc.includes("nhuộm") || svc.includes("uốn")) return PRODUCT_CATALOG["Hair"];
  if (cat.includes("spa") || svc.includes("spa") || svc.includes("tắm") || svc.includes("khoáng")) return PRODUCT_CATALOG["Spa"];
  return PRODUCT_CATALOG["default"];
}

/* ─────────────────────────────────────────
   SERVICE-BASED DEFAULTS
   ───────────────────────────────────────── */
function getDefaults(name = "") {
  const n = name.toLowerCase();
  if (n.includes("nail") || n.includes("móng") || n.includes("gel") || n.includes("sơn") || n.includes("vẽ") || !name) {
    return {
      steps: [
        "Vệ sinh & khử khuẩn móng",
        "Dũa form móng oval",
        "Dũa bề mặt & làm sạch",
        "Sơn base coat",
        "Vẽ nail art họa tiết pastel",
        "Sơn top coat bóng",
        "Dưỡng dầu & massage tay",
      ],
      products: [
        { name: "Son gel OPI - Bubble Bath", desc: "Màu hồng pastel" },
        { name: "Top Coat OPI - Top Coat", desc: "Bóng" },
        { name: "Dưỡng móng OPI - Nail Oil", desc: "Dưỡng ẩm, chắc khỏe" },
        { name: "Dầu massage", desc: "Hương lavender" },
      ],
      beforeCond: "Khô, dễ gãy",
      afterResult: "Đẹp, bóng khỏe",
      observations: "Móng khách hơi khô, da quanh móng hơi khô. Bà tư vấn dưỡng ẩm và tránh tiếp xúc hóa chất. Khách thích màu hồng nhẹ nhàng.",
      recs: ["Dưỡng ẩm da tay và móng 2-3 lần/ngày", "Tránh ngâm tay trong nước quá nóng hoặc hóa chất", "Nên quay lại sau 3 - 4 tuần để làm mới", "Sử dụng dầu dưỡng móng trước khi đi ngủ"],
      specs: [
        { label: "Tình trạng móng", field: "beforeCond", value: "Khô, dễ gãy" },
        { label: "Độ dài móng", value: "Trung bình" },
        { label: "Hình dạng", value: "Oval" },
        { label: "Độ bền giữ", value: "4 - 5 tuần" },
        { label: "Thời gian thực hiện", field: "duration", value: "1 giờ 30 phút" },
        { label: "Chi phí dịch vụ", field: "price", value: "450,000đ" },
      ],
      beforeLabel: "Tình trạng móng trước khi làm",
      afterLabel: "Kết quả sau khi làm",
    };
  }
  if (n.includes("massage") || n.includes("body") || n.includes("thư giãn") || n.includes("đá nóng")) {
    return {
      steps: ["Làm ấm cơ thể bằng tinh dầu", "Day ấn huyệt giảm xơ cứng", "Chườm đá nóng vùng lưng vai", "Xoa bóp thải độc và thư giãn sâu"],
      products: [
        { name: "Tinh dầu Lavender", desc: "Thảo mộc" },
        { name: "Đá bazan trị liệu", desc: "Nóng 55°C" },
      ],
      beforeCond: "Đau mỏi vai gáy",
      afterResult: "Giảm cơ thắt, nhẹ nhõm",
      observations: "Vùng cơ thang bả vai trái bị co cứng nhiều do ngồi lâu. Đã thực hiện giải cơ sâu 20 phút.",
      recs: ["Uống 500ml nước ấm sau massage", "Tập giãn cơ vai nhẹ mỗi 2 tiếng", "Hẹn lịch sau 1 tuần phục hồi"],
      specs: [
        { label: "Vùng điều trị", field: "beforeCond", value: "Đau mỏi vai gáy" },
        { label: "Cường độ", value: "Vừa phải" },
        { label: "Kỹ thuật", value: "Swedish" },
        { label: "Thời gian thực hiện", field: "duration", value: "1 giờ" },
        { label: "Chi phí dịch vụ", field: "price", value: "350,000đ" },
      ],
      beforeLabel: "Tình trạng trước massage",
      afterLabel: "Kết quả sau massage",
    };
  }
  return {
    steps: ["Vệ sinh chuẩn bị dụng cụ", "Thực hiện các bước quy trình kỹ thuật chuẩn", "Lau sạch và dưỡng ẩm hoàn tất"],
    products: [{ name: "Sản phẩm chuyên dụng Luna Salon", desc: "" }],
    beforeCond: "Bình thường",
    afterResult: "Hoàn thiện đẹp",
    observations: "Khách hàng hài lòng với kết quả và thái độ phục vụ.",
    recs: ["Chăm sóc tại nhà theo hướng dẫn cơ bản", "Bảo vệ vùng da tránh nắng trực tiếp"],
    specs: [
      { label: "Tình trạng", field: "beforeCond", value: "Bình thường" },
      { label: "Thời gian thực hiện", field: "duration", value: "45 phút" },
      { label: "Chi phí dịch vụ", field: "price", value: "180,000đ" },
    ],
    beforeLabel: "Tình trạng trước dịch vụ",
    afterLabel: "Kết quả sau dịch vụ",
  };
}

/* ─────────────────────────────────────────
   TOAST
   ───────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  return (
    <div className={`tn-toast tn-toast--${type}`}>
      <span className="tn-toast__icon">{icons[type] || "ℹ"}</span>
      <p>{msg}</p>
      <button onClick={onClose}>✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────── */
export default function TreatmentNotesV2() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = sp.get("appointmentId");
  const customerIdParam = sp.get("customerId");

  /* ── data ── */
  const [customer,     setCustomer]     = useState(null);
  const [customerPreferences, setCustomerPreferences] = useState([]);
  const [beautyProfile, setBeautyProfile] = useState(null);
  const [timeline,     setTimeline]     = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [services,     setServices]     = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [userRole,     setUserRole]     = useState("Technician");

  /* ── ui ── */
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [imgFull,   setImgFull]   = useState(null);

  /* ── filters (left panel) ── */
  const [filterSvc,    setFilterSvc]    = useState("");
  const [filterKtv,    setFilterKtv]    = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStart,  setFilterStart]  = useState("");
  const [filterEnd,    setFilterEnd]    = useState("");
  const [search,       setSearch]       = useState("");
  const [filterCustomerOnly, setFilterCustomerOnly] = useState(!!customerIdParam);

  /* ── pagination (left panel) ── */
  const [visibleCount, setVisibleCount] = useState(5);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState("draft");
  useEffect(() => {
    setVisibleCount(5);
    setShowAllDrafts(false);
    setShowAllCompleted(false);
    setActiveTab("draft");
  }, [customer?.CustomerId, search, filterSvc, filterKtv, filterStatus, filterStart, filterEnd]);

  /* ── edit fields ── */
  const [editDuration, setEditDuration] = useState(60);
  const [editBefore,   setEditBefore]   = useState("");
  const [editAfter,    setEditAfter]    = useState("");
  const [editObserv,   setEditObserv]   = useState("");
  const [editRecs,     setEditRecs]     = useState("");
  const [editInternal, setEditInternal] = useState("");
  const [editSteps,    setEditSteps]    = useState([]);
  const [editProducts, setEditProducts] = useState([]);
  const [beforeImgs,   setBeforeImgs]   = useState([]);
  const [afterImgs,    setAfterImgs]    = useState([]);
  const [newStep,      setNewStep]      = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  /* ── booking modal ── */
  const [showBook, setShowBook] = useState(false);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("10:00");
  const [bookSvc,  setBookSvc]  = useState("");
  const [bookKtv,  setBookKtv]  = useState("");
  const [bookNote, setBookNote] = useState("");
  const [customerPackages, setCustomerPackages] = useState([]);
  const [usePackage, setUsePackage] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [bookStatus, setBookStatus] = useState("CONFIRMED");

  const [followUpApptDetail, setFollowUpApptDetail] = useState(null);
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [followUpApptId, setFollowUpApptId] = useState(null);

  useEffect(() => {
    if (selectedNote?.follow_up_appointment_id) {
      axiosClient.get(`/appointments/${selectedNote.follow_up_appointment_id}`)
        .then(r => {
          setFollowUpApptDetail(r.data?.data || r.data);
        })
        .catch(err => {
          console.error("Failed to load follow-up appointment detail:", err);
          setFollowUpApptDetail(null);
        });
    } else {
      setFollowUpApptDetail(null);
    }
  }, [selectedNote?.follow_up_appointment_id]);

  // When true: date is locked to the suggested date; When false: technician picks freely
  const [bookDateLocked, setBookDateLocked] = useState(false);
  // Service name, image and KTV name, avatar for read-only display (always locked)
  const [bookSvcName, setBookSvcName] = useState("");
  const [bookSvcImage, setBookSvcImage] = useState("");
  const [bookKtvName, setBookKtvName] = useState("");
  const [bookKtvAvatar, setBookKtvAvatar] = useState("");

  const [slotLoading, setSlotLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [slotError, setSlotError] = useState("");
  const [qualifiedKtvs, setQualifiedKtvs] = useState([]);
  const [ktvLoading, setKtvLoading] = useState(false);
  const [ktvKeyword, setKtvKeyword] = useState("");

  /* ── create note modal ── */
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [completedAppts,      setCompletedAppts]      = useState([]);
  const [loadingAppts,        setLoadingAppts]        = useState(false);

  const toast$ = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    if (type === "error") {
      window.alert("⚠️ CẢNH BÁO LỖI:\n\n" + msg);
    }
  }, []);
  const isAdmin = ["ADMIN", "MANAGER"].includes(userRole.toUpperCase());
  const isFinalized = selectedNote?.status === "finalized";
  const def = useMemo(() => getDefaults(selectedNote?.ServiceName), [selectedNote]);

  /* ── load user role ── */
  useEffect(() => {
    axiosClient.get("/auth/me").then(r => setUserRole(r.data?.data?.RoleName || "Technician")).catch(() => {});
  }, []);

  /* ── main data load ── */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let activeApptId = appointmentId;
        let customerId = customerIdParam;
        let activeNote = null;

        // 1. If we have activeApptId, load note or auto-create one from appointment details
        if (activeApptId) {
          try {
            const r = await axiosClient.get(`/v2/treatment-notes/appointments/${activeApptId}`);
            activeNote = r.data?.data;
            if (activeNote) {
              customerId = activeNote.customer_id;
            }
          } catch {}

          if (!activeNote) {
            try {
              const apptR = await axiosClient.get(`/technician/appointments/${activeApptId}`);
              const data = apptR.data?.data || {};
              const fullAppt = data.appointment || {};
              const servicesList = data.services || [];
              const serviceId = servicesList[0]?.ServiceId || 1;
              const technicianId = fullAppt.TechnicianId || 1;
              customerId = fullAppt.CustomerId;

              if (customerId) {
                const createRes = await axiosClient.post("/v2/treatment-notes", {
                  customerId,
                  appointmentId: Number(activeApptId),
                  serviceId,
                  technicianId,
                  serviceDateTime: `${fullAppt.AppointmentDate.split("T")[0]} ${fullAppt.StartTime || "10:00:00"}`,
                  status: "draft"
                });
                const noteId = createRes.data?.data?.noteId;
                if (noteId) {
                  const fullRes = await axiosClient.get(`/v2/treatment-notes/${noteId}`);
                  activeNote = fullRes.data?.data;
                }
              }
            } catch (err) {
              console.error("Auto-creating note on load failed:", err);
            }
          }
        }

        // 2. If still no activeApptId and no customerId, fetch technician's appointments to find the most recent customer
        if (!activeApptId && !customerId) {
          const apptsRes = await axiosClient.get("/technician/appointments");
          const appts = apptsRes.data?.data?.appointments || [];
          const completed = appts.filter(a => a.Status === "COMPLETED");
          const selectedAppt = completed.length > 0 ? completed[0] : (appts.length > 0 ? appts[0] : null);
          
          if (selectedAppt) {
            activeApptId = selectedAppt.AppointmentId;
            customerId = selectedAppt.CustomerId;
          }
        }

        // 3. Fallback to first customer in system if still no customerId
        if (!customerId) {
          const custsRes = await axiosClient.get("/technician/customers");
          const custs = custsRes.data?.data?.customers || custsRes.data?.data || [];
          if (custs.length > 0) {
            customerId = custs[0].CustomerId;
          }
        }

        if (!customerId) {
          toast$("Chưa có dữ liệu khách hàng nào trong hệ thống.", "info");
          setServices((await axiosClient.get("/services")).data?.data || (await axiosClient.get("/services")).data || []);
          setEmployees((await axiosClient.get("/employees")).data?.data || (await axiosClient.get("/employees")).data || []);
          return;
        }

        // Now load customer, timeline, and service list
        const [custR, histR, svcR, empR] = await Promise.all([
          axiosClient.get(`/technician/customers/${customerId}`),
          axiosClient.get("/v2/treatment-notes/search"),
          axiosClient.get("/services"),
          axiosClient.get("/employees"),
        ]);

        const custData = custR.data?.data;
        if (custData?.customer) {
          setCustomer(custData.customer);
          setCustomerPreferences(custData.preferences || []);
          setBeautyProfile(custData.beautyProfile || null);
          setCustomerPackages(custData.packages || []);
        } else {
          setCustomer(custData);
          setCustomerPackages(custData?.packages || []);
        }
        const hist = histR.data?.data || [];
        setTimeline(hist);
        setServices(svcR.data?.data || svcR.data || []);
        setEmployees(empR.data?.data || empR.data || []);

        // Load active note
        if (activeApptId && !activeNote) {
          try {
            const r = await axiosClient.get(`/v2/treatment-notes/appointments/${activeApptId}`);
            activeNote = r.data?.data;
          } catch {}
        }

        const note = activeNote
          || (activeApptId ? hist.find(n => String(n.appointment_id) === String(activeApptId)) : null)
          || (hist.length > 0 ? hist[0] : null);

        if (note) {
          setSelectedNote(note);
          initFields(note);
        } else {
          setSelectedNote(null);
        }
      } catch (e) {
        toast$(e.response?.data?.message || e.message || "Lỗi tải dữ liệu.", "error");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, customerIdParam]);

  useEffect(() => {
    if (selectedNote?.customer_id) {
      axiosClient.get(`/technician/customers/${selectedNote.customer_id}`)
        .then(r => {
          const custData = r.data?.data;
          if (custData?.customer) {
            setCustomer(custData.customer);
            setCustomerPreferences(custData.preferences || []);
            setBeautyProfile(custData.beautyProfile || null);
            setCustomerPackages(custData.packages || []);
          } else {
            setCustomer(custData);
            setCustomerPackages(custData?.packages || []);
          }
        })
        .catch(() => {});
    }
  }, [selectedNote?.customer_id]);

  useEffect(() => {
    async function loadQualifiedKtvs() {
      if (!bookSvc) {
        setQualifiedKtvs([]);
        return;
      }
      try {
        setKtvLoading(true);
        const res = await axiosClient.get(`/employees/by-service/${bookSvc}`);
        setQualifiedKtvs(res.data.data || []);
      } catch {
        setQualifiedKtvs([]);
      } finally {
        setKtvLoading(false);
      }
    }
    if (showBook) {
      loadQualifiedKtvs();
    }
  }, [bookSvc, showBook]);

  useEffect(() => {
    async function loadAvailableSlots() {
      if (!bookSvc || !bookKtv || !bookDate) {
        setAvailableSlots([]);
        setAlternatives([]);
        return;
      }
      try {
        setSlotLoading(true);
        setSlotError("");
        const res = await axiosClient.get("/appointments/available-slots", {
          params: {
            serviceId: bookSvc,
            employeeId: bookKtv,
            appointmentDate: bookDate,
            includeAlternatives: true,
            includeAllSlots: true,
          },
        });
        const data = res.data.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setAvailableSlots(data.slots || []);
          setAlternatives(data.alternatives || []);
        } else {
          setAvailableSlots(data || []);
          setAlternatives([]);
        }
      } catch (err) {
        setAvailableSlots([]);
        setAlternatives([]);
        setSlotError(err.response?.data?.message || "Không tải được giờ trống");
      } finally {
        setSlotLoading(false);
      }
    }
    if (showBook) {
      loadAvailableSlots();
    }
  }, [bookSvc, bookKtv, bookDate, showBook]);

  useEffect(() => {
    if (availableSlots.length > 0) {
      const firstFree = availableSlots.find(slot => slot.available !== false);
      if (firstFree) {
        setBookTime(formatTime(firstFree.startTime));
      } else {
        setBookTime("");
      }
    } else {
      setBookTime("");
    }
  }, [availableSlots]);

  const initFields = (n) => {
    const svc = services.find(s => Number(s.ServiceId) === Number(n.service_id));
    const defaultDuration = svc?.DurationMinutes || 90;
    setEditDuration(n.duration_minutes || defaultDuration);
    setEditBefore(n.before_condition || "");
    setEditAfter(n.after_result || "");
    setEditObserv(n.technician_notes || "");
    setEditRecs(n.recommendations
      ? (Array.isArray(n.recommendations) ? n.recommendations.join("; ") : n.recommendations)
      : "");
    setEditInternal(n.internal_notes || "");
    setEditSteps(n.procedure_steps?.length ? n.procedure_steps : []);
    setEditProducts(n.products_used?.length
      ? n.products_used.map(p => typeof p === "string" ? { name: p.split(" - ")[0] || p, desc: p.split(" - ")[1] || "" } : p)
      : []);
    setBeforeImgs(n.before_images?.length ? n.before_images : []);
    setAfterImgs(n.after_images?.length ? n.after_images : []);
  };

  const selectNote = (n) => { setSelectedNote(n); initFields(n); setIsEditing(false); };

  /* ── filters ── */
  const ktvList = useMemo(() => [...new Set(timeline.map(n => n.TechnicianName).filter(Boolean))], [timeline]);
  const filtered = useMemo(() => {
    let list = timeline;
    if (customer?.CustomerId) {
      list = list.filter(n => Number(n.customer_id) === Number(customer.CustomerId));
    } else {
      list = [];
    }
    if (search)       list = list.filter(n => [n.ServiceName, n.TechnicianName, n.CategoryName, n.CustomerName].some(v => v?.toLowerCase().includes(search.toLowerCase())));
    if (filterSvc)    list = list.filter(n => n.CategoryName?.toLowerCase().includes(filterSvc.toLowerCase()) || n.ServiceName?.toLowerCase().includes(filterSvc.toLowerCase()));
    if (filterKtv)    list = list.filter(n => n.TechnicianName === filterKtv);
    if (filterStatus) list = list.filter(n => n.status === filterStatus);
    if (filterStart)  list = list.filter(n => n.service_date_time >= filterStart);
    if (filterEnd)    list = list.filter(n => n.service_date_time <= filterEnd + "T23:59:59");
    return list;
  }, [timeline, customer, search, filterSvc, filterKtv, filterStatus, filterStart, filterEnd]);

  const draftNotes = useMemo(() => {
    return filtered.filter(n => n.status !== "finalized");
  }, [filtered]);

  const completedNotes = useMemo(() => {
    return filtered.filter(n => n.status === "finalized");
  }, [filtered]);

  const clearFilters = () => { setSearch(""); setFilterSvc(""); setFilterKtv(""); setFilterStatus(""); setFilterStart(""); setFilterEnd(""); };

  /* ── crud helpers ── */
  const buildPayload = () => ({
    duration_minutes: editDuration,
    before_condition: editBefore,
    after_result: editAfter,
    technician_notes: editObserv,
    recommendations: editRecs,
    internal_notes: editInternal,
    procedure_steps: editSteps,
    products_used: editProducts.map(p => `${p.name}${p.desc ? ` - ${p.desc}` : ""}`),
    before_images: beforeImgs,
    after_images: afterImgs,
  });

  const reloadTimeline = async () => {
    const r = await axiosClient.get("/v2/treatment-notes/search");
    const d = r.data?.data || [];
    setTimeline(d);
    return d;
  };

  const handleSave = async () => {
    if (!selectedNote) return;
    try {
      setSaving(true);
      await axiosClient.patch(`/v2/treatment-notes/${selectedNote.id}`, buildPayload());
      toast$("Lưu bản nháp thành công!");
      setIsEditing(false);
      const d = await reloadTimeline();
      const u = d.find(n => n.id === selectedNote.id);
      if (u) { setSelectedNote(u); initFields(u); }
    } catch (e) { toast$(e.response?.data?.message || "Lưu thất bại.", "error"); }
    finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    if (!selectedNote || !window.confirm("Sau khi KHÓA hồ sơ sẽ không thể chỉnh sửa. Tiếp tục?")) return;
    try {
      setSaving(true);
      await axiosClient.patch(`/v2/treatment-notes/${selectedNote.id}`, buildPayload());
      await axiosClient.post(`/v2/treatment-notes/${selectedNote.id}/finalize`);
      toast$("Đã khóa hồ sơ điều trị!");
      setIsEditing(false);
      const d = await reloadTimeline();
      const u = d.find(n => n.id === selectedNote.id);
      if (u) { setSelectedNote(u); initFields(u); }
    } catch (e) { toast$(e.response?.data?.message || "Khóa thất bại.", "error"); }
    finally { setSaving(false); }
  };

  const openEditFollowUpModal = () => {
    if (!followUpApptDetail) return;
    const apptDateStr = followUpApptDetail.AppointmentDate
      ? followUpApptDetail.AppointmentDate.split("T")[0]
      : "";
    setBookDate(apptDateStr);
    setBookTime(followUpApptDetail.StartTime ? followUpApptDetail.StartTime.substring(0, 5) : "10:00");
    const svcId = followUpApptDetail.ServiceId || (followUpApptDetail.ServiceIds ? followUpApptDetail.ServiceIds.split(",")[0] : "");
    setBookSvc(String(svcId || ""));
    const svcObj = services.find(s => String(s.ServiceId) === String(svcId));
    setBookSvcName(svcObj?.ServiceName || "");
    setBookSvcImage(svcObj?.ImageUrl || "");
    const ktvId = followUpApptDetail.EmployeeId;
    setBookKtv(String(ktvId || ""));
    const ktvObj = employees.find(e => String(e.EmployeeId) === String(ktvId));
    setBookKtvName(ktvObj?.FullName || "");
    setBookKtvAvatar(ktvObj?.AvatarUrl || "");
    setBookNote(followUpApptDetail.Notes || "");
    setBookStatus(followUpApptDetail.Status || "CONFIRMED");
    setUsePackage(!!followUpApptDetail.CustomerPackageId);
    setSelectedPackageId(String(followUpApptDetail.CustomerPackageId || ""));
    setBookDateLocked(false);
    setIsEditingFollowUp(true);
    setFollowUpApptId(selectedNote.follow_up_appointment_id);
    setShowBook(true);
  };

  const handleBook = async () => {
    if (!customer?.CustomerId) { toast$("Không xác định được khách hàng!", "error"); return; }
    if (!bookDate) { toast$("Vui lòng chọn ngày hẹn!", "error"); return; }
    if (!bookSvc) { toast$("Vui lòng chọn dịch vụ!", "error"); return; }
    if (!bookKtv) { toast$("Vui lòng chọn kỹ thuật viên!", "error"); return; }
    const today = new Date().toISOString().split("T")[0];
    if (bookDate < today) { toast$("Ngày hẹn không thể là ngày trong quá khứ!", "error"); return; }
    if (suggestDate && !isEditingFollowUp) {
      const y = suggestDate.getFullYear();
      const m = String(suggestDate.getMonth() + 1).padStart(2, "0");
      const d = String(suggestDate.getDate()).padStart(2, "0");
      const suggestDateStr = `${y}-${m}-${d}`;
      if (bookDate < suggestDateStr) {
        toast$(`Ngày hẹn tái khám không thể trước ngày đề xuất tái khám (${suggestDate.toLocaleDateString("vi-VN")})!`, "error");
        return;
      }
    }
    try {
      setSaving(true);
      const pkgId = usePackage && selectedPackageId ? Number(selectedPackageId) : null;

      if (isEditingFollowUp && followUpApptId) {
        try {
          await axiosClient.delete(`/appointments/${followUpApptId}`, {
            data: { reason: "Cập nhật thay đổi thông tin đặt lịch tái khám từ Treatment Note" }
          });
        } catch (delErr) {
          console.warn("Delete old follow-up failed:", delErr);
        }
      }

      const res = await axiosClient.post("/technician/appointments", {
        customerId: customer.CustomerId,
        appointmentDate: bookDate,
        startTime: bookTime || "09:00",
        serviceIds: [Number(bookSvc)],
        technicianId: Number(bookKtv),
        note: bookNote || `Tái khám ${bookSvcName || selectedNote?.ServiceName || "dịch vụ"}`,
        paymentStatus: pkgId ? "PAID" : "UNPAID",
        paymentMethod: "CASH",
        isWalkIn: false,
        customerPackageId: pkgId,
        parentAppointmentId: selectedNote?.appointment_id || null,
        status: bookStatus,
        treatmentNoteId: (bookStatus === "PENDING" && selectedNote?.id) ? selectedNote.id : undefined,
      });

      const dataAppt = res.data?.data;
      const finalApptId = dataAppt?.appointmentId || dataAppt?.AppointmentId;

      let updatedTimeline = null;
      if (bookStatus === "CONFIRMED") {
        if (selectedNote && selectedNote.status !== "finalized") {
          try {
            await axiosClient.patch(`/v2/treatment-notes/${selectedNote.id}`, {
              ...buildPayload(),
              follow_up_appointment_id: finalApptId
            });
            await axiosClient.post(`/v2/treatment-notes/${selectedNote.id}/finalize`);
            toast$("Đã tự động khóa hồ sơ điều trị liên quan!");
            updatedTimeline = await reloadTimeline();
          } catch (err) {
            console.error("Auto-finalize failed:", err);
          }
        } else if (selectedNote && finalApptId) {
          // Bất kể đã finalized, cập nhật follow_up_appointment_id mới liên kết
          try {
            await axiosClient.patch(`/v2/treatment-notes/${selectedNote.id}`, {
              follow_up_appointment_id: finalApptId
            });
            updatedTimeline = await reloadTimeline();
          } catch (err) {
            console.error("Link update failed:", err);
          }
        }
      } else {
        // Ghi chú dạng PENDING
        if (selectedNote && finalApptId) {
          try {
            await axiosClient.patch(`/v2/treatment-notes/${selectedNote.id}`, {
              follow_up_appointment_id: finalApptId
            });
            updatedTimeline = await reloadTimeline();
          } catch (err) {
            console.error("Link update failed:", err);
          }
        }
      }

      toast$(isEditingFollowUp ? "Cập nhật lịch tái khám thành công!" : `Đặt lịch tái khám thành công cho ${customer.FullName} ngày ${new Date(bookDate).toLocaleDateString("vi-VN")}!`, "success");

      setShowBook(false);
      setBookDate(""); setBookSvc(""); setBookKtv(""); setBookNote(""); setBookTime("10:00");
      setBookDateLocked(false); setBookSvcName(""); setBookSvcImage(""); setBookKtvName(""); setBookKtvAvatar("");
      setUsePackage(false); setSelectedPackageId(""); setBookStatus("CONFIRMED");
      setIsEditingFollowUp(false); setFollowUpApptId(null);
      
      if (updatedTimeline) {
        const u = updatedTimeline.find(n => n.id === selectedNote.id);
        if (u) { setSelectedNote(u); initFields(u); }
      } else {
        reloadTimeline();
      }
    } catch (e) {
      toast$(e.response?.data?.message || "Đặt lịch thất bại. Vui lòng thử lại.", "error");
    } finally {
      setSaving(false);
    }
  };

  const closeBookModal = () => {
    setShowBook(false);
    setBookDate(""); setBookSvc(""); setBookKtv(""); setBookNote(""); setBookTime("10:00");
    setBookDateLocked(false); setBookSvcName(""); setBookSvcImage(""); setBookKtvName(""); setBookKtvAvatar("");
    setUsePackage(false); setSelectedPackageId(""); setBookStatus("CONFIRMED");
    setIsEditingFollowUp(false); setFollowUpApptId(null);
  };



  const openCreateNoteModal = async () => {
    try {
      setShowCreateNoteModal(true);
      setLoadingAppts(true);
      const [resComp, resInProg] = await Promise.all([
        axiosClient.get("/technician/appointments", { params: { limit: 50, status: "COMPLETED" } }),
        axiosClient.get("/technician/appointments", { params: { limit: 50, status: "IN_PROGRESS" } })
      ]);
      const apptsComp = resComp.data?.data?.appointments || [];
      const apptsInProg = resInProg.data?.data?.appointments || [];
      const combined = [...apptsInProg, ...apptsComp];
      setCompletedAppts(combined);
    } catch (e) {
      toast$("Không tải được danh sách lịch hẹn.", "error");
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleSelectCompletedAppt = async (appt) => {
    try {
      setSaving(true);

      // Step 1: Get full appointment detail to retrieve serviceId & technicianId
      const detailRes = await axiosClient.get(`/technician/appointments/${appt.AppointmentId}`);
      const data = detailRes.data?.data || {};
      const fullAppt = data.appointment || {};
      const servicesList = data.services || [];
      const serviceId  = servicesList[0]?.ServiceId  || 1;
      const technicianId = fullAppt.TechnicianId || 1;

      // Step 2: Create draft note (or find existing one if already created)
      let noteId = null;
      let note   = null;

      try {
        const createRes = await axiosClient.post("/v2/treatment-notes", {
          customerId:      appt.CustomerId,
          appointmentId:   appt.AppointmentId,
          serviceId,
          technicianId,
          serviceDateTime: `${appt.AppointmentDate.split("T")[0]} ${appt.StartTime || "10:00:00"}`,
          status: "draft"
        });
        noteId = createRes.data?.data?.noteId;
      } catch (err) {
        // Already exists – fetch from appointment
        const findRes = await axiosClient.get(`/v2/treatment-notes/appointments/${appt.AppointmentId}`);
        note = findRes.data?.data;
      }

      // Step 3: If we got a noteId, fetch the full note with ServiceName, TechnicianName etc.
      if (noteId && !note) {
        try {
          const fullRes = await axiosClient.get(`/v2/treatment-notes/${noteId}`);
          note = fullRes.data?.data;
        } catch {
          // Fallback to appointment-based lookup
          const fallbackRes = await axiosClient.get(`/v2/treatment-notes/appointments/${appt.AppointmentId}`);
          note = fallbackRes.data?.data;
        }
      }

      if (!note) throw new Error("Không thể khởi tạo ghi chú điều trị.");

      toast$("Khởi tạo ghi chú điều trị thành công!");
      setShowCreateNoteModal(false);

      // Step 4: Load customer details
      const custR = await axiosClient.get(`/technician/customers/${appt.CustomerId}`);
      const custData = custR.data?.data;
      setCustomer(custData?.customer || custData);
      setCustomerPackages(custData?.packages || []);

      // Step 5: Reload timeline and auto-select the new note
      const d = await reloadTimeline();
      const match = d.find(n => String(n.id).toUpperCase() === String(note.id).toUpperCase()) || note;
      setSelectedNote(match);
      initFields(match);
      setFilterCustomerOnly(true);

    } catch (e) {
      toast$(e.response?.data?.message || e.message || "Lỗi khởi tạo ghi chú.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (!selectedNote || !customer) return;
    const txt = [`🌸 LUNA SALON - HỒ SƠ DỊCH VỤ`, `👤 ${customer.FullName || "Trần Thanh Mai"}`, `💅 ${selectedNote.ServiceName}`,
      `📅 ${parseDateParts(selectedNote.service_date_time).full}`, `✅ Kết quả: ${editAfter}`,
      `📋 Khuyến nghị:\n${recsList.map(r => `  • ${r}`).join("\n")}`].join("\n");
    navigator.clipboard.writeText(txt).then(() => toast$("Đã sao chép thông tin dịch vụ!"));
  };

  const recsList = useMemo(() => editRecs ? editRecs.split(/[;\n]+/).map(s => s.trim()).filter(Boolean) : [], [editRecs]);

  /* suggest follow-up dynamically based on category */
  const suggestDate = useMemo(() => {
    if (!selectedNote?.service_date_time) return null;
    const d = parseLocalDate(selectedNote.service_date_time);
    const cat = (selectedNote.CategoryName || "").toLowerCase();
    const svc = (selectedNote.ServiceName || "").toLowerCase();

    let days = 21; // default fallback
    if (cat.includes("nail") || svc.includes("nail") || svc.includes("móng")) {
      days = 28;
    } else if (cat.includes("massage") || svc.includes("massage") || svc.includes("thư giãn")) {
      days = 7;
    } else if (cat.includes("skincare") || cat.includes("facial") || svc.includes("da mặt") || svc.includes("chăm sóc da")) {
      days = 14;
    }
    d.setDate(d.getDate() + days);
    return d;
  }, [selectedNote]);

  /* totalSpend from timeline or fallback */
  const totalSpend = useMemo(() => {
    if (customer?.TotalSpent != null && customer.TotalSpent > 0) return fmtMoney(customer.TotalSpent);
    if (!timeline.length) return "24.500.000đ";
    const sum = timeline.reduce((a, n) => a + (Number(n.ServicePrice) || 0), 0);
    return sum > 0 ? fmtMoney(sum) : "24.500.000đ";
  }, [customer, timeline]);

  const visitsCount = useMemo(() => {
    if (customer?.TotalVisits != null && customer.TotalVisits > 0) return customer.TotalVisits;
    return Math.max(15, timeline.length);
  }, [customer, timeline]);

  const loyaltyPoints = useMemo(() => {
    if (!customer) return 320;
    return customer.LoyaltyPoints || 320;
  }, [customer]);

  const customerAge = useMemo(() => {
    if (!customer?.DateOfBirth) return 28;
    const birthYear = new Date(customer.DateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  }, [customer?.DateOfBirth]);

  const matchedPackages = useMemo(() => {
    if (!bookSvc || !customerPackages?.length) return [];
    const svcIdStr = String(bookSvc);
    return customerPackages.filter(pkg => {
      const ids = (pkg.ServiceIds || "").split(",");
      return ids.includes(svcIdStr) && pkg.RemainingSessions > 0;
    });
  }, [bookSvc, customerPackages]);

  useEffect(() => {
    if (matchedPackages.length > 0) {
      setUsePackage(true);
      setSelectedPackageId(String(matchedPackages[0].CustomerPackageId));
    } else {
      setUsePackage(false);
      setSelectedPackageId("");
    }
  }, [matchedPackages]);

  const imgRef1 = useRef(), imgRef2 = useRef();

  const displayBeforeImg = useMemo(() => {
    if (beforeImgs[0]) return resolveFileUrl(beforeImgs[0]);
    return null;
  }, [beforeImgs]);

  const displayAfterImg = useMemo(() => {
    if (afterImgs[0]) return resolveFileUrl(afterImgs[0]);
    return null;
  }, [afterImgs]);

  const detailThumbs = useMemo(() => {
    // Chỉ lấy ảnh thật đã upload (before + after), không dùng nh ảnh placeholder
    const allImgs = [
      ...(beforeImgs || []).map(src => ({ src: resolveFileUrl(src), label: "TRƯỚC" })),
      ...(afterImgs  || []).map(src => ({ src: resolveFileUrl(src), label: "SAU"   })),
    ];
    return allImgs;
  }, [beforeImgs, afterImgs]);

  const getTimelineThumb = (item) => {
    if (item.ImageUrl) return resolveFileUrl(item.ImageUrl);

    const cat = (item.CategoryName || "").toLowerCase();
    const svc = (item.ServiceName || "").toLowerCase();
    const svcImg = (name) => resolveFileUrl(`/images/services/${name}`);

    // 1. Nail
    if (cat.includes("nail") || svc.includes("nail") || svc.includes("móng")) {
      if (svc.includes("cao cấp") || svc.includes("premium")) return svcImg("nail-premium.png");
      if (svc.includes("gel") || svc.includes("hàn quốc") || svc.includes("korean")) return svcImg("korean-gel.png");
      if (svc.includes("chăm sóc") || svc.includes("care") || svc.includes("dưỡng")) return svcImg("nail-care.png");
      return svcImg("nail.png");
    }

    // 2. Massage
    if (svc.includes("đá nóng") || svc.includes("hot stone")) return svcImg("hot-stone.png");
    if (svc.includes("vai") || svc.includes("cổ") || svc.includes("gáy") || svc.includes("neck") || svc.includes("shoulder")) return svcImg("neck-shoulder.png");
    if (cat.includes("massage") || svc.includes("massage") || svc.includes("thư giãn")) {
      if (svc.includes("relax")) return svcImg("massage-relax.png");
      return svcImg("massage.png");
    }

    // 3. Skincare / Facial
    if (svc.includes("mụn") || svc.includes("acne")) return svcImg("acne-care.png");
    if (svc.includes("trẻ hóa") || svc.includes("trẻ hoá") || svc.includes("chống lão hóa") || svc.includes("anti-aging")) return svcImg("anti-aging.png");
    if (svc.includes("tinh chất") || svc.includes("cấy") || svc.includes("skin booster") || svc.includes("booster")) return svcImg("skin-booster.png");
    if (cat.includes("skincare") || cat.includes("facial") || svc.includes("da mặt") || svc.includes("chăm sóc da")) {
      if (svc.includes("cơ bản") || svc.includes("basic")) return svcImg("skincare-basic.png");
      return svcImg("skincare.png");
    }

    // 4. Hair
    if (svc.includes("nhuộm") || svc.includes("màu") || svc.includes("color")) return svcImg("hair-color.png");
    if (svc.includes("uốn") || svc.includes("curl")) return svcImg("hair-curl.png");
    if (svc.includes("phục hồi") || svc.includes("repair")) return svcImg("hair-repair.png");
    if (svc.includes("cắt") || svc.includes("tạo kiểu") || svc.includes("cut")) return svcImg("hair-cut.png");
    if (cat.includes("hair") || svc.includes("tóc") || svc.includes("gội")) return svcImg("hair.png");

    // 5. Detox / Slim
    if (svc.includes("detox") || svc.includes("body detox")) return svcImg("detox-body.png");
    if (svc.includes("giảm béo") || svc.includes("slim") || svc.includes("bụng")) return svcImg("slim-belly.png");

    // 6. Combo / Spa Combo
    if (svc.includes("tóc và nail") || (svc.includes("tóc") && svc.includes("nail"))) return svcImg("hair-nail-combo.png");
    if (svc.includes("cuối tuần") || svc.includes("weekend")) return svcImg("weekend-combo.png");
    if (cat.includes("spa") || svc.includes("spa") || svc.includes("combo") || svc.includes("package")) return svcImg("weekend-combo.png");

    return svcImg("skincare.png");
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <TechnicianLayout>
      <div className="tn-page">

        {/* TOAST */}
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* FULLSCREEN IMAGE */}
        {imgFull && (
          <div className="tn-lightbox" onClick={() => setImgFull(null)}>
            <img src={imgFull} alt="preview" onClick={e => e.stopPropagation()} />
            <button className="tn-lightbox__close" onClick={() => setImgFull(null)}>✕</button>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="tn-header">
          <div className="tn-header__top-row">
            <button className="tn-back" onClick={() => navigate(-1)}>
              <span className="tn-back-arrow">←</span> Quay lại danh sách khách hàng
            </button>
            <div className="tn-header__actions">
              <button className="tn-btn tn-btn--primary" onClick={openCreateNoteModal} type="button">
                <span className="tn-btn-icon">+</span> Tạo ghi chú mới
              </button>
              <button className="tn-btn tn-btn--dots" type="button">•••</button>
            </div>
          </div>
          <div className="tn-header__title-row" style={{ marginTop: "12px" }}>
            <h1 className="tn-header__title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              Treatment Notes
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "#dcfce7", color: "#166534", borderRadius: "50%",
                width: "22px", height: "22px", fontSize: "0.85rem", fontWeight: "bold"
              }}>✓</span>
            </h1>
            <p className="tn-header__sub">Hồ sơ ghi chú điều trị và chăm sóc của khách hàng</p>
          </div>
        </div>

        {/* ── CUSTOMER PROFILE CARD ── */}
        {loading && !customer ? (
          <div className="tn-profile-skeleton">
            <div className="tn-skel tn-skel--avatar" />
            <div className="tn-skel-lines">
              <div className="tn-skel tn-skel--line" />
              <div className="tn-skel tn-skel--line" style={{ width: "55%" }} />
            </div>
          </div>
        ) : (
          <section className="tn-profile-card">
            <div className="tn-profile-card__top">
              <div className="tn-profile-card__left">
                <div className="tn-profile-card__avatar-container">
                  <img
                    className="tn-profile-card__avatar"
                    src={customer?.AvatarUrl ? resolveFileUrl(customer.AvatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "Trần Thanh Mai")}&background=1f7a5a&color=fff&size=80`}
                    alt={customer?.FullName || "Trần Thanh Mai"}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "Trần Thanh Mai")}&background=1f7a5a&color=fff&size=80`; }}
                  />
                  <span className="tn-profile-card__online-dot" />
                </div>
                <div className="tn-profile-card__main-info">
                  <h2 className="tn-profile-card__name">
                    {customer?.FullName || "Kien Duong"}
                    <span style={{ fontSize: "1.1rem", marginLeft: "6px" }}>👑</span>
                  </h2>
                  <p className="tn-profile-card__code">
                    {customer?.CustomerCode || `#CUST-${String(customer?.CustomerId || 83).padStart(3, "0")}`} · {customerAge} tuổi · {customer?.Gender === "Male" ? "Nam" : "Nữ"}
                  </p>
                  <p className="tn-profile-card__contact-item">
                    <span style={{ marginRight: "6px" }}>📞</span>{customer?.Phone || "0901 234 567"}
                  </p>
                  <p className="tn-profile-card__contact-item">
                    <span style={{ marginRight: "6px" }}>✉</span>{customer?.Email || "giakienkj1@gmail.com"}
                  </p>
                  <span className="tn-profile-card__badge">
                    💚 {customer?.MembershipLevel || "Silver"} Member
                  </span>
                </div>
              </div>

              <div className="tn-profile-card__middle">
                <div className="tn-profile-card__specs-col">
                  <table className="tn-profile-card__specs-table">
                    <tbody>
                      <tr>
                        <td className="tn-pspec-label">📅 NGÀY SINH</td>
                        <td className="tn-pspec-value">
                          {customer?.DateOfBirth ? new Date(customer.DateOfBirth).toLocaleDateString("vi-VN") : "12/06/1996"}
                        </td>
                      </tr>
                      <tr>
                        <td className="tn-pspec-label">🌐 NGUỒN KHÁCH</td>
                        <td className="tn-pspec-value">{customer?.Source || "Facebook"}</td>
                      </tr>
                      <tr>
                        <td className="tn-pspec-label">👥 NHÓM KHÁCH HÀNG</td>
                        <td className="tn-pspec-value">{customer?.MembershipLevel || "Silver"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="tn-profile-card__vertical-divider" />

                <div className="tn-profile-card__stat-item">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "1.1rem", background: "#fef3c7", padding: "4px", borderRadius: "50%", display: "inline-flex" }}>💰</span>
                    <span className="tn-pstat-lbl">TỔNG CHI TIÊU</span>
                  </div>
                  <p className="tn-pstat-val">{totalSpend}</p>
                  <span className="tn-pstat-trend tn-pstat-trend--up">↑ 12% so với 3 tháng trước</span>
                  <svg width="90" height="20" viewBox="0 0 100 24" className="tn-pstat-spark">
                    <path d="M 0 20 Q 20 18 40 12 T 80 4 T 100 2" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 0 20 Q 20 18 40 12 T 80 4 T 100 2 L 100 24 L 0 24 Z" fill="rgba(34, 197, 94, 0.08)" />
                  </svg>
                </div>

                <div className="tn-profile-card__vertical-divider" />

                <div className="tn-profile-card__stat-item">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "1.1rem", background: "#dbeafe", padding: "4px", borderRadius: "50%", display: "inline-flex" }}>📊</span>
                    <span className="tn-pstat-lbl">SỐ LẦN ĐẾN</span>
                  </div>
                  <p className="tn-pstat-val">{visitsCount} lần</p>
                  <span className="tn-pstat-trend tn-pstat-trend--up">↑ 5 lần so với tháng trước</span>
                  <svg width="90" height="20" viewBox="0 0 100 24" className="tn-pstat-spark">
                    <path d="M 0 20 C 20 22, 40 10, 60 14 C 80 18, 90 2, 100 4" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 0 20 C 20 22, 40 10, 60 14 C 80 18, 90 2, 100 4 L 100 24 L 0 24 Z" fill="rgba(34, 197, 94, 0.08)" />
                  </svg>
                </div>

                <div className="tn-profile-card__vertical-divider" />

                <div className="tn-profile-card__stat-item">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "1.1rem", background: "#fef3c7", padding: "4px", borderRadius: "50%", display: "inline-flex" }}>⭐</span>
                    <span className="tn-pstat-lbl">ĐIỂM TÍCH LŨY</span>
                  </div>
                  <p className="tn-pstat-val">{loyaltyPoints} điểm</p>
                  <span className="tn-pstat-trend tn-pstat-trend--up">↑ 320 điểm mới</span>
                  <svg width="90" height="20" viewBox="0 0 100 24" className="tn-pstat-spark">
                    <path d="M 0 18 Q 25 24 50 14 T 75 10 T 100 6" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 0 18 Q 25 24 50 14 T 75 10 T 100 6 L 100 24 L 0 24 Z" fill="rgba(234, 179, 8, 0.08)" />
                  </svg>
                </div>
              </div>

              <div className="tn-profile-card__vertical-divider" />

              <div className="tn-profile-card__right">
                <div className="tn-profile-card__ktv-section">
                  <span className="tn-pcard-right-title">KỸ THUẬT VIÊN PHỤ TRÁCH</span>
                  <div className="tn-pcard-ktv-row">
                    <img
                      src={selectedNote?.TechnicianAvatar
                        ? resolveFileUrl(selectedNote.TechnicianAvatar)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedNote?.TechnicianName || "KTV")}&background=1f7a5a&color=fff&size=40&rounded=true`}
                      alt={selectedNote?.TechnicianName || "KTV"}
                      onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedNote?.TechnicianName || "KTV")}&background=1f7a5a&color=fff&size=40&rounded=true`; }}
                      style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb", flexShrink: 0 }}
                    />
                    <div>
                      <strong className="tn-pcard-ktv-name">{selectedNote?.TechnicianName || "—"}</strong>
                      <p className="tn-pcard-ktv-sub">KTV chính</p>
                    </div>
                    <span className="tn-pcard-ktv-arrow">›</span>
                  </div>
                </div>

                <div className="tn-profile-card__notice-section">
                  <span className="tn-pcard-right-title">GHI CHÚ KHÁCH HÀNG</span>
                  <div className="tn-pcard-notice-box" style={
                    !selectedNote?.AppointmentNotes
                      ? { background: "#f3f4f6", border: "1px solid #e5e7eb" }
                      : {}
                  }>
                    {selectedNote?.AppointmentNotes ? (
                      <>
                        <span style={{ color: "#dc2626", fontWeight: "bold" }}>⚠️</span>
                        <span className="tn-pcard-notice-text">
                          {selectedNote.AppointmentNotes}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#9ca3af", fontSize: "0.8rem", fontStyle: "italic" }}>
                        Không có ghi chú đặc biệt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="tn-profile-card__bottom">
              {/* Segment 1: Trạng thái */}
              <div className="tn-pcard-foot-item">
                <div className="tn-pcard-foot-icon" style={{ background: "#ecfdf5" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 11 2 2 4-4" />
                  </svg>
                </div>
                <div className="tn-pcard-foot-content">
                  <span className="tn-pcard-foot-lbl">Trạng thái</span>
                  <span className="tn-pcard-foot-status-badge">Đang hoạt động</span>
                </div>
              </div>

              <div className="tn-pcard-foot-divider" />

              {/* Segment 2: Mức độ trung thành */}
              <div className="tn-pcard-foot-item">
                <div className="tn-pcard-foot-icon" style={{ background: "#fef2f2" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
                <div className="tn-pcard-foot-content">
                  <span className="tn-pcard-foot-lbl">Mức độ trung thành</span>
                  <div style={{ display: "flex", gap: "2px", fontSize: "0.95rem", marginTop: "2px" }}>
                    {(() => {
                      const level = (customer?.MembershipLevel || "Silver").toLowerCase();
                      let count = 4;
                      if (level.includes("gold") || level.includes("vip") || level.includes("diamond")) count = 5;
                      else if (level.includes("silver")) count = 4;
                      else if (level.includes("bronze")) count = 3;
                      return Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} style={{ color: i < count ? "#10b981" : "#d1d5db" }}>
                          {i < count ? "💚" : "🤍"}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              <div className="tn-pcard-foot-divider" />

              {/* Segment 3: Lần đến gần nhất */}
              <div className="tn-pcard-foot-item">
                <div className="tn-pcard-foot-icon" style={{ background: "#ecfdf5" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                    <path d="m9 16 2 2 4-4" />
                  </svg>
                </div>
                <div className="tn-pcard-foot-content">
                  <span className="tn-pcard-foot-lbl">Lần đến gần nhất</span>
                  <span className="tn-pcard-foot-val">
                    {customer?.LastVisit ? new Date(customer.LastVisit).toLocaleDateString("vi-VN") : "22/11/2024"}
                  </span>
                </div>
              </div>

              <div className="tn-pcard-foot-divider" />

              {/* Segment 4: Dịch vụ yêu thích */}
              <div className="tn-pcard-foot-item">
                <div className="tn-pcard-foot-icon" style={{ background: "#ecfdf5" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                  </svg>
                </div>
                <div className="tn-pcard-foot-content">
                  <span className="tn-pcard-foot-lbl">Dịch vụ yêu thích</span>
                  <span className="tn-pcard-foot-val" style={{ color: "var(--text-charcoal)" }}>
                    {customerPreferences.length > 0
                      ? customerPreferences.map(p => p.ServiceName).slice(0, 3).join(", ")
                      : "Nail Art, Gội đầu dưỡng sinh"}
                  </span>
                </div>
              </div>

              <button className="tn-pcard-foot-btn" onClick={() => navigate(`/technician/customers?customerId=${customer?.CustomerId}`)} type="button">
                Xem lịch sử chi tiết <span style={{ marginLeft: "4px", fontSize: "0.95rem" }}>›</span>
              </button>
            </div>
          </section>
        )}

        {/* ── BODY: 2 PANELS ── */}
        <div className="tn-body">

          {/* ════ LEFT PANEL ════ */}
          <div className="tn-left">
            <div className="tn-left__head">
              <h3 className="tn-left__title">Lịch sử Treatment Notes</h3>
            </div>

            <div className="tn-left__tabs" style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: "0px", background: "#f8f9fa", borderRadius: "10px 10px 0 0" }}>
              <button
                type="button"
                onClick={() => setActiveTab("draft")}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  border: "none",
                  borderBottom: activeTab === "draft" ? "3px solid #b45309" : "3px solid transparent",
                  background: "none",
                  color: activeTab === "draft" ? "#b45309" : "#6b7280",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                ✏️ Bản nháp ({draftNotes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("finalized")}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  border: "none",
                  borderBottom: activeTab === "finalized" ? "3px solid #166534" : "3px solid transparent",
                  background: "none",
                  color: activeTab === "finalized" ? "#166534" : "#6b7280",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                ✓ Hoàn thành ({completedNotes.length})
              </button>
            </div>

            <div className="tn-timeline" style={{ padding: "20px" }}>
              {/* SECTION 1: BẢN NHÁP */}
              {activeTab === "draft" && (
                <div>
                  {loading && timeline.length === 0 ? (
                    [1, 2].map(i => (
                      <div key={i} className="tn-tcard tn-tcard--skel" style={{ marginBottom: "8px" }}>
                        <div className="tn-skel tn-skel--datenode" />
                        <div style={{ flex: 1 }}>
                          <div className="tn-skel tn-skel--line" />
                        </div>
                      </div>
                    ))
                  ) : draftNotes.length === 0 ? (
                    <div style={{ padding: "30px 16px", border: "1px dashed #e5e7eb", borderRadius: "10px", background: "#fefeff", textAlign: "center", fontSize: "0.82rem", color: "#9ca3af" }}>
                      📭 Chưa có bản nháp nào
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(showAllDrafts ? draftNotes : draftNotes.slice(0, 5)).map((item, idx, arr) => {
                        const p = parseDateParts(item.service_date_time);
                        const active = selectedNote?.id === item.id;
                        return (
                          <div key={item.id} className={`tn-tcard ${active ? "tn-tcard--active" : ""}`} onClick={() => selectNote(item)} style={{ margin: 0, position: "relative" }}>
                            {idx < arr.length - 1 && <div className="tn-tline" />}
                            <div className={`tn-date ${active ? "tn-date--active" : ""}`}>
                              <span className="tn-date__day">{p.day}</span>
                              <span className="tn-date__mo">{p.thMonth}</span>
                              <span className="tn-date__yr">{p.year}</span>
                            </div>
                            <div className="tn-tcard__body">
                              <div className="tn-tcard__row">
                                <strong className="tn-tcard__name">{item.CustomerName || "Khách hàng"}</strong>
                                <span className="tn-badge" style={{ background: "#fef9c3", color: "#b45309", border: "1px solid #fef08a", padding: "2px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: "700" }}>
                                  Bản nháp
                                </span>
                              </div>
                              <p className="tn-tcard__meta">💅 {item.ServiceName}</p>
                              <p className="tn-tcard__meta">⏰ {formatTimeRange(item.service_date_time, item.duration_minutes)}</p>
                              <p className="tn-tcard__meta">👤 KTV: {item.TechnicianName}</p>
                            </div>
                            <div className="tn-tcard__thumb">
                              <img src={getTimelineThumb(item)} alt="Thumb" />
                            </div>
                          </div>
                        );
                      })}
                      {draftNotes.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllDrafts(!showAllDrafts)}
                          style={{
                            width: "100%", padding: "8px", fontSize: "0.78rem", fontWeight: "700",
                            borderRadius: "8px", border: "1px solid #dcdfe6", background: "#f5f7fa",
                            color: "#606266", cursor: "pointer", marginTop: "4px", transition: "all 0.2s"
                          }}
                        >
                          {showAllDrafts ? "▲ Thu gọn bản nháp" : `👁 Xem tất cả bản nháp (${draftNotes.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: HOÀN THÀNH */}
              {activeTab === "finalized" && (
                <div>
                  {loading && timeline.length === 0 ? (
                    [1, 2].map(i => (
                      <div key={i} className="tn-tcard tn-tcard--skel" style={{ marginBottom: "8px" }}>
                        <div className="tn-skel tn-skel--datenode" />
                        <div style={{ flex: 1 }}>
                          <div className="tn-skel tn-skel--line" />
                        </div>
                      </div>
                    ))
                  ) : completedNotes.length === 0 ? (
                    <div style={{ padding: "30px 16px", border: "1px dashed #e5e7eb", borderRadius: "10px", background: "#fefeff", textAlign: "center", fontSize: "0.82rem", color: "#9ca3af" }}>
                      📭 Chưa có hồ sơ hoàn thành nào
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(showAllCompleted ? completedNotes : completedNotes.slice(0, 5)).map((item, idx, arr) => {
                        const p = parseDateParts(item.service_date_time);
                        const active = selectedNote?.id === item.id;
                        return (
                          <div key={item.id} className={`tn-tcard ${active ? "tn-tcard--active" : ""}`} onClick={() => selectNote(item)} style={{ margin: 0, position: "relative" }}>
                            {idx < arr.length - 1 && <div className="tn-tline" />}
                            <div className={`tn-date ${active ? "tn-date--active" : ""}`}>
                              <span className="tn-date__day">{p.day}</span>
                              <span className="tn-date__mo">{p.thMonth}</span>
                              <span className="tn-date__yr">{p.year}</span>
                            </div>
                            <div className="tn-tcard__body">
                              <div className="tn-tcard__row">
                                <strong className="tn-tcard__name">{item.CustomerName || "Khách hàng"}</strong>
                                <span className="tn-badge tn-badge--done">
                                  Hoàn thành
                                </span>
                              </div>
                              <p className="tn-tcard__meta">💅 {item.ServiceName}</p>
                              <p className="tn-tcard__meta">⏰ {formatTimeRange(item.service_date_time, item.duration_minutes)}</p>
                              <p className="tn-tcard__meta">👤 KTV: {item.TechnicianName}</p>
                            </div>
                            <div className="tn-tcard__thumb">
                              <img src={getTimelineThumb(item)} alt="Thumb" />
                            </div>
                          </div>
                        );
                      })}
                      {completedNotes.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCompleted(!showAllCompleted)}
                          style={{
                            width: "100%", padding: "8px", fontSize: "0.78rem", fontWeight: "700",
                            borderRadius: "8px", border: "1px solid #dcdfe6", background: "#f5f7fa",
                            color: "#606266", cursor: "pointer", marginTop: "4px", transition: "all 0.2s"
                          }}
                        >
                          {showAllCompleted ? "▲ Thu gọn lịch sử" : `👁 Xem tất cả lịch sử (${completedNotes.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="tn-search-section">
              <p className="tn-search-section__title">Tìm kiếm ghi chú</p>
              <div className="tn-search-box">
                <span className="tn-search-box__icon">🔍</span>
                <input
                  className="tn-search-box__input"
                  placeholder="Tìm theo dịch vụ, kỹ thuật viên, sản phẩm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <p className="tn-filter-title">Lọc theo</p>
              <div className="tn-filter-row">
                <select className="tn-filter-chip" value={filterSvc} onChange={e => setFilterSvc(e.target.value)}>
                  <option value="">Dịch vụ ▾</option>
                  {[...new Set(timeline.map(n => n.CategoryName).filter(Boolean))].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select className="tn-filter-chip" value={filterKtv} onChange={e => setFilterKtv(e.target.value)}>
                  <option value="">KTV thực hiện ▾</option>
                  {ktvList.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <select className="tn-filter-chip" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Trạng thái ▾</option>
                  <option value="draft">Bản nháp</option>
                  <option value="finalized">Hoàn thành</option>
                </select>
                <div className="tn-filter-chip tn-filter-chip--date">
                  <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} placeholder="Từ ngày" />
                  <span>—</span>
                  <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} placeholder="Đến ngày" />
                  <span>Khoảng thời gian ▾</span>
                </div>
              </div>
              {(search || filterSvc || filterKtv || filterStatus || filterStart || filterEnd) && (
                <button className="tn-clear-filter" onClick={clearFilters} type="button">✕ Xóa bộ lọc</button>
              )}
            </div>
          </div>

          {/* ════ RIGHT PANEL ════ */}
          <div className="tn-right">
            {!selectedNote ? (
              <div className="tn-detail-empty">
                <div className="tn-detail-empty__icon">📋</div>
                <h3>Chọn một hồ sơ để xem chi tiết</h3>
                <p>Nhấn vào ca dịch vụ bên trái để hiển thị hồ sơ ghi chú đầy đủ.</p>
              </div>
            ) : (
              <div className="tn-detail" style={{ background: "none", border: "none", boxShadow: "none", padding: 0 }}>

                {/* ── CARD 1: CHI TIẾT TREATMENT NOTE ── */}
                <div className="tn-card">
                  <div className="tn-detail__head">
                    <div className="tn-detail__head-left">
                      <div className="tn-detail__head-title-row">
                        <h3 className="tn-detail__panel-label">Chi tiết Treatment Note</h3>
                        <span 
                          className={selectedNote.status === "finalized" ? "tn-status-badge tn-status-badge--done" : "tn-status-badge"}
                          style={selectedNote.status === "finalized" ? {} : { background: "#fef9c3", color: "#b45309", border: "1px solid #fef08a", padding: "2px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: "700" }}
                        >
                          {selectedNote.status === "finalized" ? "Hoàn thành" : "Bản nháp"}
                        </span>
                      </div>
                    </div>
                    <div className="tn-detail__head-actions">
                      {!isFinalized && !isEditing && (
                        <button className="tn-btn tn-btn--outline" onClick={() => setIsEditing(true)} type="button">✏ Chỉnh sửa</button>
                      )}
                      <button className="tn-btn tn-btn--outline" onClick={() => window.print()} type="button">📥 In / PDF</button>
                      <button className="tn-btn tn-btn--outline" onClick={handleShare} type="button">🔗 Chia sẻ</button>
                    </div>
                  </div>

                  <div className="tn-detail__meta">
                    <h2 className="tn-detail__title">{selectedNote.ServiceName}</h2>
                    <div className="tn-detail__meta-row">
                      <span>📅 {parseDateParts(selectedNote.service_date_time).full}</span>
                      <span>⏰ {formatTimeRange(selectedNote.service_date_time, selectedNote.duration_minutes)}</span>
                      <span>📍 Luna Salon - Chi nhánh 1</span>
                    </div>
                    <div className="tn-detail__meta-row">
                      <span className="tn-ktv-inline">
                        <img
                          className="tn-ktv-av"
                          src={selectedNote.TechnicianAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedNote.TechnicianName || "Linh Chi")}&background=1f7a5a&color=fff&size=24`}
                          alt=""
                          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=Linh+Chi&background=1f7a5a&color=fff&size=24`; }}
                        />
                        KTV thực hiện: <strong>{selectedNote.TechnicianName}</strong>
                      </span>
                      <span>🔧 Dịch vụ: <strong>{selectedNote.ServiceName}</strong></span>
                    </div>
                  </div>

                  <div className="tn-ba">
                    <div className="tn-ba__col">
                      <p className="tn-ba__label">Tình trạng trước dịch vụ</p>
                      <div className="tn-ba__frame" onClick={() => !isEditing && displayBeforeImg && setImgFull(displayBeforeImg)}
                        style={{ cursor: (!isEditing && displayBeforeImg) ? "zoom-in" : "default" }}>
                      {displayBeforeImg ? (
                          <img src={displayBeforeImg} alt="before" />
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "var(--text-muted-gray)" }}>
                            <span style={{ fontSize: "2rem" }}>📷</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: "600" }}>Chưa có ảnh trước</span>
                          </div>
                        )}
                        {isEditing && (
                          <div className="tn-ba__upload" onClick={e => { e.stopPropagation(); imgRef1.current?.click(); }}>
                            {displayBeforeImg ? "Thay ảnh" : "+ Tải ảnh"}
                            <input ref={imgRef1} type="file" accept="image/*" style={{ display: "none" }}
                              onChange={e => {
                                const f = e.target.files[0];
                                if (!f) return;
                                const currentCount = (beforeImgs?.length || 0) + (afterImgs?.length || 0);
                                if ((beforeImgs?.length || 0) === 0 && currentCount >= 6) {
                                  toast$("Tổng số hình ảnh chi tiết (trước và sau) không được vượt quá 6 hình ảnh!", "error");
                                  return;
                                }
                                const r = new FileReader();
                                r.onloadend = () => setBeforeImgs(prev => prev.length ? [r.result, ...prev.slice(1)] : [r.result]);
                                r.readAsDataURL(f);
                              }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="tn-ba__arrow-wrap">
                      <div className="tn-ba__arrow">›</div>
                    </div>
                    <div className="tn-ba__col">
                      <p className="tn-ba__label">Kết quả sau dịch vụ</p>
                      <div className="tn-ba__frame" onClick={() => !isEditing && displayAfterImg && setImgFull(displayAfterImg)}
                        style={{ cursor: (!isEditing && displayAfterImg) ? "zoom-in" : "default" }}>
                        {displayAfterImg ? (
                          <img src={displayAfterImg} alt="after" />
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "var(--text-muted-gray)" }}>
                            <span style={{ fontSize: "2rem" }}>📷</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: "600" }}>Chưa có ảnh sau</span>
                          </div>
                        )}
                        {isEditing && (
                          <div className="tn-ba__upload" onClick={e => { e.stopPropagation(); imgRef2.current?.click(); }}>
                            {displayAfterImg ? "Thay ảnh" : "+ Tải ảnh"}
                            <input ref={imgRef2} type="file" accept="image/*" style={{ display: "none" }}
                              onChange={e => {
                                const f = e.target.files[0];
                                if (!f) return;
                                const currentCount = (beforeImgs?.length || 0) + (afterImgs?.length || 0);
                                if ((afterImgs?.length || 0) === 0 && currentCount >= 6) {
                                  toast$("Tổng số hình ảnh chi tiết (trước và sau) không được vượt quá 6 hình ảnh!", "error");
                                  return;
                                }
                                const r = new FileReader();
                                r.onloadend = () => setAfterImgs(prev => prev.length ? [r.result, ...prev.slice(1)] : [r.result]);
                                r.readAsDataURL(f);
                              }} />
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  <div className="tn-grid3">
                    <div className="tn-col3">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <h4 className="tn-col3__title" style={{ margin: 0 }}>Quy trình thực hiện</h4>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              const d = getDefaults(selectedNote?.ServiceName);
                              setEditSteps(d.steps || []);
                            }}
                            className="tn-btn-template"
                            style={{
                              fontSize: "0.72rem",
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "#eff6ff",
                              color: "#2563eb",
                              border: "1px solid #bfdbfe",
                              cursor: "pointer",
                              fontWeight: 600,
                              outline: "none"
                            }}
                          >
                            📋 Áp dụng Mẫu
                          </button>
                        )}
                      </div>
                      <div className="tn-steps">
                        {editSteps.map((s, i) => (
                          <div key={i} className="tn-step">
                            <span className="tn-step__num">{i + 1}</span>
                            <span className="tn-step__txt">{s}</span>
                            {isEditing && <button className="tn-del" onClick={() => setEditSteps(prev => prev.filter((_, j) => j !== i))} type="button">✕</button>}
                          </div>
                        ))}
                      </div>
                      {isEditing && (
                        <div className="tn-add">
                          <input className="tn-add__input" placeholder="Thêm bước..." value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newStep.trim()) { setEditSteps(p => [...p, newStep.trim()]); setNewStep(""); }}} />
                          <button className="tn-add__btn" onClick={() => { if (newStep.trim()) { setEditSteps(p => [...p, newStep.trim()]); setNewStep(""); }}} type="button">+</button>
                        </div>
                      )}
                    </div>

                    <div className="tn-col3">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <h4 className="tn-col3__title" style={{ margin: 0 }}>Sản phẩm sử dụng</h4>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              const d = getDefaults(selectedNote?.ServiceName);
                              setEditProducts(d.products || []);
                            }}
                            className="tn-btn-template"
                            style={{
                              fontSize: "0.72rem",
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "#eff6ff",
                              color: "#2563eb",
                              border: "1px solid #bfdbfe",
                              cursor: "pointer",
                              fontWeight: 600,
                              outline: "none"
                            }}
                          >
                            📋 Áp dụng Mẫu
                          </button>
                        )}
                      </div>
                      <div className="tn-prods">
                        {editProducts.map((p, i) => (
                          <div key={i} className="tn-prod">
                            <div className="tn-prod__icon">💅</div>
                            <div className="tn-prod__info">
                              <strong>{typeof p === "string" ? p : p.name}</strong>
                              {typeof p !== "string" && p.desc && <span>{p.desc}</span>}
                            </div>
                            {isEditing && <button className="tn-del" onClick={() => setEditProducts(prev => prev.filter((_, j) => j !== i))} type="button">✕</button>}
                          </div>
                        ))}
                        {editProducts.length === 0 && !isEditing && (
                          <p style={{ fontSize: "0.82rem", color: "var(--text-muted-gray)", margin: 0 }}>Chưa chọn sản phẩm nào.</p>
                        )}
                      </div>
                      {isEditing && (() => {
                        const catalog = getProductsByCategory(
                          selectedNote?.CategoryName || "",
                          selectedNote?.ServiceName || ""
                        );
                        const selectedNames = editProducts.map(p => typeof p === "string" ? p : p.name);
                        return (
                          <div style={{ marginTop: "10px", position: "relative" }}>
                            <button
                              type="button"
                              onClick={() => setShowProductPicker(v => !v)}
                              style={{
                                width: "100%", padding: "7px 12px", border: "1.5px solid var(--mint-border)",
                                borderRadius: "var(--r-item)", background: "#f9fafb", cursor: "pointer",
                                fontSize: "0.85rem", color: "var(--primary-green)", fontWeight: "600",
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px"
                              }}
                            >
                              <span>➕ Chọn sản phẩm theo dịch vụ</span>
                              <span>{showProductPicker ? "▲" : "▼"}</span>
                            </button>
                            {showProductPicker && (
                              <div style={{
                                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
                                background: "#fff", border: "1.5px solid var(--mint-border)",
                                borderRadius: "var(--r-item)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                maxHeight: "220px", overflowY: "auto", padding: "6px",
                                marginTop: "4px"
                              }}>
                                {catalog.map((prod, idx) => {
                                  const checked = selectedNames.includes(prod);
                                  return (
                                    <label key={idx} style={{
                                      display: "flex", alignItems: "center", gap: "8px",
                                      padding: "6px 8px", cursor: "pointer", borderRadius: "6px",
                                      fontSize: "0.83rem", fontWeight: checked ? "600" : "400",
                                      color: checked ? "var(--primary-green)" : "var(--text-charcoal)",
                                      background: checked ? "#f0fdf4" : "transparent",
                                      transition: "background 0.15s"
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (checked) {
                                            setEditProducts(prev => prev.filter(p => (typeof p === "string" ? p : p.name) !== prod));
                                          } else {
                                            setEditProducts(prev => [...prev, prod]);
                                          }
                                        }}
                                        style={{ width: "15px", height: "15px", accentColor: "var(--primary-green)" }}
                                      />
                                      {prod}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="tn-col3">
                      <h4 className="tn-col3__title">Thông tin chi tiết</h4>
                      <table className="tn-specs">
                        <tbody>
                          <tr>
                            <td className="tn-spec-lbl">Danh mục dịch vụ</td>
                            <td className="tn-spec-val"><span>{selectedNote.CategoryName || "—"}</span></td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Mã lịch hẹn</td>
                            <td className="tn-spec-val"><span style={{ fontFamily: "monospace", color: "var(--primary-green)" }}>#{selectedNote.appointment_id || "—"}</span></td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Trạng thái hồ sơ</td>
                            <td className="tn-spec-val">
                              <span style={{
                                padding: "2px 8px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: "700",
                                background: selectedNote.status === "finalized" ? "#dcfce7" : "#fef9c3",
                                color: selectedNote.status === "finalized" ? "#166534" : "#92400e"
                              }}>
                                {selectedNote.status === "finalized" ? "✓ Đã khóa" : "✏ Bản nháp"}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Tình trạng ban đầu</td>
                            <td className="tn-spec-val">
                              {isEditing
                                ? <input className="tn-spec-inp" value={editBefore} onChange={e => setEditBefore(e.target.value)} placeholder="Nhập tình trạng..." />
                                : <span>{editBefore || "—"}</span>}
                            </td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Kết quả đạt được</td>
                            <td className="tn-spec-val">
                              {isEditing
                                ? <input className="tn-spec-inp" value={editAfter} onChange={e => setEditAfter(e.target.value)} placeholder="Nhập kết quả..." />
                                : <span>{editAfter || "—"}</span>}
                            </td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Thời gian thực hiện</td>
                            <td className="tn-spec-val">
                              {isEditing
                                ? <input className="tn-spec-inp" type="number" value={editDuration} onChange={e => setEditDuration(Number(e.target.value))} />
                                : <span>{editDuration ? `${editDuration} phút` : "—"}</span>}
                            </td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">KTV thực hiện</td>
                            <td className="tn-spec-val"><span>{selectedNote.TechnicianName || "—"}</span></td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Chi phí dịch vụ</td>
                            <td className="tn-spec-val"><span className="tn-price">{fmtMoney(selectedNote.ServicePrice || 0)}</span></td>
                          </tr>
                          <tr>
                            <td className="tn-spec-lbl">Ngày tạo hồ sơ</td>
                            <td className="tn-spec-val">
                              <span>{selectedNote.created_at ? new Date(selectedNote.created_at).toLocaleDateString("vi-VN") : "—"}</span>
                            </td>
                          </tr>
                          {selectedNote.updated_at && (
                            <tr>
                              <td className="tn-spec-lbl">Cập nhật lần cuối</td>
                              <td className="tn-spec-val">
                                <span>{new Date(selectedNote.updated_at).toLocaleString("vi-VN")}</span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* ── CARD 2 & 3: GHI CHÚ KTV & KHUYẾN NGHỊ SIDE-BY-SIDE ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  {/* Ghi chú KTV */}
                  <div className="tn-card tn-section" style={{ margin: 0, borderBottom: "none", height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 className="tn-section__title" style={{ margin: 0 }}>Ghi chú của kỹ thuật viên</h3>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            const d = getDefaults(selectedNote?.ServiceName);
                            setEditObserv(d.observations || "");
                          }}
                          className="tn-btn-template"
                          style={{
                            fontSize: "0.72rem",
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            cursor: "pointer",
                            fontWeight: 600,
                            outline: "none"
                          }}
                        >
                          📋 Áp dụng Mẫu
                        </button>
                      )}
                    </div>
                    {isEditing
                      ? <textarea className="tn-textarea" rows={5} style={{ flex: 1 }} value={editObserv} onChange={e => setEditObserv(e.target.value)} placeholder="Nhập ghi chú..." />
                      : <p className="tn-observ" style={{ margin: 0, flex: 1, fontSize: "0.85rem", lineHeight: "1.45" }}>{editObserv || "Chưa có ghi chú."}</p>}
                  </div>

                  {/* Khuyến nghị */}
                  <div className="tn-card tn-section" style={{ margin: 0, borderBottom: "none", height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 className="tn-section__title" style={{ margin: 0 }}>Khuyến nghị &amp; Chăm sóc sau dịch vụ</h3>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            const d = getDefaults(selectedNote?.ServiceName);
                            setEditRecs(d.recs?.join("; ") || "");
                          }}
                          className="tn-btn-template"
                          style={{
                            fontSize: "0.72rem",
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            cursor: "pointer",
                            fontWeight: 600,
                            outline: "none"
                          }}
                        >
                          📋 Áp dụng Mẫu
                        </button>
                      )}
                    </div>
                    {isEditing
                      ? <textarea className="tn-textarea" rows={5} style={{ flex: 1 }} value={editRecs} onChange={e => setEditRecs(e.target.value)} placeholder="Các khuyến nghị, cách nhau bằng dấu ;" />
                      : (
                        <ul className="tn-recs" style={{ margin: 0, padding: 0, flex: 1 }}>
                          {recsList.map((r, i) => (
                            <li key={i} className="tn-rec" style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                              <span className="tn-rec__tick" style={{ color: "#10b981", fontWeight: "bold" }}>✓</span>
                              <span className="tn-rec__txt" style={{ fontSize: "0.85rem", color: "var(--text-charcoal)" }}>{r}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </div>

                {/* ── CARD 4 & 5: GALLERY & BOOKING SIDE-BY-SIDE ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", marginBottom: "16px" }}>
                  {/* Gallery */}
                  <div className="tn-card tn-section" style={{ margin: 0, borderBottom: "none", height: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <h3 className="tn-section__title" style={{ margin: 0 }}>Hình ảnh chi tiết</h3>
                      {isEditing && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <label style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                            + Ảnh trước
                            <input type="file" accept="image/*" multiple style={{ display: "none" }}
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                const currentCount = (beforeImgs?.length || 0) + (afterImgs?.length || 0);
                                if (currentCount + files.length > 6) {
                                  toast$("Tổng số hình ảnh chi tiết không được vượt quá 6 hình ảnh!", "error");
                                  return;
                                }
                                files.forEach(f => {
                                  const r = new FileReader();
                                  r.onloadend = () => setBeforeImgs(prev => [...prev, r.result]);
                                  r.readAsDataURL(f);
                                });
                                e.target.value = "";
                              }} />
                          </label>
                          <label style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                            + Ảnh sau
                            <input type="file" accept="image/*" multiple style={{ display: "none" }}
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                const currentCount = (beforeImgs?.length || 0) + (afterImgs?.length || 0);
                                if (currentCount + files.length > 6) {
                                  toast$("Tổng số hình ảnh chi tiết không được vượt quá 6 hình ảnh!", "error");
                                  return;
                                }
                                files.forEach(f => {
                                  const r = new FileReader();
                                  r.onloadend = () => setAfterImgs(prev => [...prev, r.result]);
                                  r.readAsDataURL(f);
                                });
                                e.target.value = "";
                              }} />
                          </label>
                        </div>
                      )}
                    </div>
                    {detailThumbs.length > 0 ? (
                      <div className="tn-gallery" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                        {/* Before images */}
                        {(beforeImgs || []).map((src, i) => (
                          <div key={`b-${i}`} className="tn-gallery__thumb" style={{ position: "relative" }}>
                            <img src={resolveFileUrl(src)} alt={`trước-${i+1}`} onClick={() => setImgFull(resolveFileUrl(src))} style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: 6, cursor: "zoom-in" }} />
                            <span style={{ position: "absolute", top: 4, left: 4, background: "#3b82f6", color: "#fff", fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 4 }}>TRƯỚC</span>
                            {isEditing && (
                              <button type="button" onClick={() => setBeforeImgs(prev => prev.filter((_, j) => j !== i))}
                                style={{ position: "absolute", top: 3, right: 3, background: "rgba(239,68,68,0.85)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                        ))}
                        {/* After images */}
                        {(afterImgs || []).map((src, i) => (
                          <div key={`a-${i}`} className="tn-gallery__thumb" style={{ position: "relative" }}>
                            <img src={resolveFileUrl(src)} alt={`sau-${i+1}`} onClick={() => setImgFull(resolveFileUrl(src))} style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: 6, cursor: "zoom-in" }} />
                            <span style={{ position: "absolute", top: 4, left: 4, background: "#10b981", color: "#fff", fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 4 }}>SAU</span>
                            {isEditing && (
                              <button type="button" onClick={() => setAfterImgs(prev => prev.filter((_, j) => j !== i))}
                                style={{ position: "absolute", top: 3, right: 3, background: "rgba(239,68,68,0.85)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 8, color: "var(--text-muted-gray)" }}>
                        <span style={{ fontSize: "2.2rem" }}>🖼️</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                          {isEditing ? "Dùng nút ‘+ Ảnh trước’ / ‘+ Ảnh sau’ để tải lên" : "Chưa có hình ảnh chi tiết."}
                        </span>
                      </div>
                    )}
                  </div>


                  {/* Booking Proposal */}
                  {selectedNote.follow_up_appointment_id ? (
                    <div className="tn-card tn-followup-card-wrapper" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "14px", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1.5px solid #bfdbfe", padding: "20px", height: "100%" }}>
                      <p className="tn-followup__tag" style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase", color: "#1d4ed8" }}>Lịch tái khám đã được đặt</p>
                      {followUpApptDetail ? (
                        <div className="tn-followup__main" style={{ display: "flex", gap: "12px" }}>
                          <div className="tn-followup__date" style={{ background: "#3b82f6" }}>
                            <span className="tn-fdate__day">{getDayOfWeekVn(new Date(followUpApptDetail.AppointmentDate))}</span>
                            <span className="tn-fdate__num">{pad(new Date(followUpApptDetail.AppointmentDate).getDate())}</span>
                            <span className="tn-fdate__mo">TH{pad(new Date(followUpApptDetail.AppointmentDate).getMonth() + 1)}</span>
                            <span className="tn-fdate__yr">{new Date(followUpApptDetail.AppointmentDate).getFullYear()}</span>
                          </div>
                          <div className="tn-followup__info">
                            <strong>{followUpApptDetail.ServiceName || selectedNote.ServiceName}</strong>
                            <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#1e3a8a" }}>⏰ {followUpApptDetail.StartTime ? followUpApptDetail.StartTime.substring(0, 5) : "10:00"} (CN {followUpApptDetail.BranchId || 1})</p>
                            <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#1e3a8a" }}>👤 KTV: {followUpApptDetail.EmployeeName || selectedNote.TechnicianName}</p>
                            <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#1e3a8a" }}>🏷️ Trạng thái: <strong style={{ color: followUpApptDetail.Status === "CONFIRMED" ? "#16a34a" : "#d97706" }}>{followUpApptDetail.Status === "CONFIRMED" ? "Đã xác nhận" : "Chờ xác nhận"}</strong></p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, fontSize: "0.83rem", color: "#1e3a8a" }}>
                          ⏳ Đang tải thông tin lịch tái khám...
                        </div>
                      )}
                      <div className="tn-followup__btns" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                        {selectedNote.status === "finalized" ? (
                          <div style={{
                            background: "#f3f4f6",
                            border: "1.5px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            fontWeight: 600,
                            lineHeight: "1.4",
                          }}>
                            🔒 Hồ sơ điều trị đã khóa.<br />Không thể chỉnh sửa lịch tái khám.
                          </div>
                        ) : (
                          <button className="tn-btn tn-btn--sm" onClick={openEditFollowUpModal} type="button" style={{ justifyContent: "center", width: "100%", background: "#2563eb", color: "#fff", border: "none" }}>
                            ✏️ Chỉnh sửa lịch tái khám
                          </button>
                        )}
                      </div>
                    </div>
                  ) : suggestDate ? (
                    <div className="tn-card tn-followup-card-wrapper" style={{ margin: 0, display: "flex", flexDirection: "column", gap: "14px", background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", border: "1.5px solid var(--mint-border)", padding: "20px", height: "100%" }}>
                      <p className="tn-followup__tag" style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-green)" }}>Lịch hẹn tiếp theo (Đề xuất)</p>
                      <div className="tn-followup__main" style={{ display: "flex", gap: "12px" }}>
                        <div className="tn-followup__date">
                          <span className="tn-fdate__day">{getDayOfWeekVn(suggestDate)}</span>
                          <span className="tn-fdate__num">{pad(suggestDate.getDate())}</span>
                          <span className="tn-fdate__mo">TH{pad(suggestDate.getMonth() + 1)}</span>
                          <span className="tn-fdate__yr">{suggestDate.getFullYear()}</span>
                        </div>
                        <div className="tn-followup__info">
                          <strong>{selectedNote.ServiceName}</strong>
                          <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#4b5563" }}>⏰ 10:00 - 11:30 (1h30m)</p>
                          <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#4b5563" }}>👤 KTV: {selectedNote.TechnicianName}</p>
                          <p style={{ margin: "2px 0", fontSize: "0.8rem", color: "#4b5563" }}>📍 Luna Salon - CN 1</p>
                        </div>
                      </div>
                      <div className="tn-followup__btns" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
                        {selectedNote.status === "finalized" ? (
                          <div style={{
                            background: "#f3f4f6",
                            border: "1.5px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            fontWeight: 600,
                            lineHeight: "1.4",
                          }}>
                            🔒 Hồ sơ điều trị đã khóa.<br />Không thể đặt lịch tái khám.
                          </div>
                        ) : selectedNote.AppointmentStatus === "COMPLETED" ? (
                          <>
                            <button className="tn-btn tn-btn--primary tn-btn--sm" onClick={() => {
                              const y = suggestDate.getFullYear(), m = suggestDate.getMonth()+1, d = suggestDate.getDate();
                              setBookDate(`${y}-${pad(m)}-${pad(d)}`);
                              setBookDateLocked(true);
                              setBookSvc(String(selectedNote.service_id || ""));
                              setBookSvcName(selectedNote.ServiceName || "");
                              setBookSvcImage(services.find(s => String(s.ServiceId) === String(selectedNote.service_id))?.ImageUrl || "");
                              setBookKtv(String(selectedNote.technician_id || ""));
                              setBookKtvName(selectedNote.TechnicianName || "");
                              setBookKtvAvatar(selectedNote.TechnicianAvatar || "");
                              setBookTime("10:00");
                              setBookNote("");
                              setShowBook(true);
                            }} type="button" style={{ justifyContent: "center", width: "100%" }}>
                              📅 Đặt lịch ngay
                            </button>
                            <button className="tn-btn tn-btn--ghost tn-btn--sm" style={{ justifyContent: "center", width: "100%" }} onClick={() => {
                              setBookDate("");
                              setBookDateLocked(false);
                              setBookSvc(String(selectedNote.service_id || ""));
                              setBookSvcName(selectedNote.ServiceName || "");
                              setBookSvcImage(services.find(s => String(s.ServiceId) === String(selectedNote.service_id))?.ImageUrl || "");
                              setBookKtv(String(selectedNote.technician_id || ""));
                              setBookKtvName(selectedNote.TechnicianName || "");
                              setBookKtvAvatar(selectedNote.TechnicianAvatar || "");
                              setBookTime("10:00");
                              setBookNote("");
                              setShowBook(true);
                            }} type="button">🔁 Chọn ngày khác
                            </button>
                          </>
                        ) : (
                          <div style={{
                            background: "#fffbeb",
                            border: "1.5px solid #fde68a",
                            borderRadius: 10,
                            padding: "10px 12px",
                            textAlign: "center",
                            fontSize: "0.8rem",
                            color: "#b45309",
                            fontWeight: 600,
                            lineHeight: "1.4",
                          }}>
                            ⚠️ Chỉ đặt lịch tái khám khi lịch gốc đã hoàn thành. (Hiện tại: {
                              selectedNote.AppointmentStatus === "CONFIRMED" ? "Đã xác nhận" :
                              selectedNote.AppointmentStatus === "PENDING" ? "Chờ xác nhận" :
                              selectedNote.AppointmentStatus === "CHECKED_IN" ? "Đã check-in" :
                              selectedNote.AppointmentStatus === "CANCELLED" ? "Đã hủy" :
                              selectedNote.AppointmentStatus || "Chưa bắt đầu"
                            })
                          </div>
                        )}
                      </div>
                    </div>

                  ) : (
                    <div className="tn-card" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--border-color)", padding: "20px", height: "100%", color: "var(--text-muted-gray)", fontSize: "0.85rem" }}>
                      Chưa có đề xuất lịch hẹn tiếp theo.
                    </div>
                  )}

                </div>

                {/* ── CARD 6: ADMIN NOTES ── */}
                {isAdmin && (
                  <div className="tn-card tn-section" style={{ borderBottom: "none", marginBottom: "16px" }}>
                    <h3 className="tn-section__title tn-section__title--admin" style={{ margin: "0 0 12px" }}>🔒 Ghi chú nội bộ <small>(Admin/Manager)</small></h3>
                    {isEditing
                      ? <textarea className="tn-textarea" rows={3} value={editInternal} onChange={e => setEditInternal(e.target.value)} placeholder="Ghi chú bảo mật nội bộ..." />
                      : <p className="tn-admin-txt" style={{ margin: 0 }}>{editInternal || "Không có ghi chú nội bộ."}</p>}
                  </div>
                )}

                {/* ── CARD 7: EDIT ACTIONS ── */}
                {isEditing && (
                  <div className="tn-card tn-edit-bar" style={{ borderBottom: "none", marginBottom: "16px" }}>
                    <button className="tn-btn tn-btn--success" onClick={handleSave} disabled={saving} type="button">💾 {saving ? "Đang lưu..." : "Lưu bản nháp"}</button>
                    <button className="tn-btn tn-btn--lock" onClick={handleFinalize} disabled={saving} type="button">🔒 Khóa hồ sơ</button>
                    <button className="tn-btn tn-btn--ghost" onClick={() => { setIsEditing(false); initFields(selectedNote); }} type="button">Hủy bỏ</button>
                  </div>
                )}

                {/* ── CARD 8: BOTTOM ACTION BAR ── */}
                <div className="tn-card tn-bot-bar" style={{ borderBottom: "none" }}>
                  <button className="tn-bot-btn" onClick={() => toast$("Đã gửi hướng dẫn chăm sóc qua Zalo/SMS!")} type="button">✉ Gửi hướng dẫn chăm sóc</button>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ════ BOOKING MODAL ════ */}
        {showBook && (
          <div className="tn-modal-bg" onClick={e => e.target === e.currentTarget && closeBookModal()}>
            <div style={
              {
                background: "#fff",
                borderRadius: 20,
                width: "min(920px, 96vw)",
                maxHeight: "92vh",
                overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "column",
              }
            }>
              {/* ── Header ── */}
              <div style={
                {
                  padding: "22px 28px 18px",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }
              }>
                <div style={
                  {
                    width: 48, height: 48,
                    background: "linear-gradient(135deg,#e8f5e9,#c8e6c9)",
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                  }
                }>📅</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1a1a1a" }}>
                    {isEditingFollowUp ? "Chỉnh sửa lịch tái khám 🌿" : "Đặt lịch hẹn tái khám 🌿"}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "0.83rem", color: "#6b7280" }}>
                    {isEditingFollowUp ? "Cập nhật lại thời gian và dịch vụ tái khám" : "Lên lịch để chúng tôi tiếp tục chăm sóc bạn tốt nhất"}
                  </p>
                </div>
                <button
                  onClick={closeBookModal}
                  type="button"
                  style={
                    {
                      background: "#f3f4f6", border: "none", borderRadius: "50%",
                      width: 36, height: 36, cursor: "pointer", fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#374151", fontWeight: 700, flexShrink: 0,
                    }
                  }
                >✕</button>
              </div>


              {/* ── Body: two columns ── */}
              <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

                {/* LEFT: Form */}
                <div style={{ flex: "1 1 0", padding: "24px 28px", overflowY: "auto", borderRight: "1px solid #f0f0f0" }}>

                  {/* ① Customer info */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#2d6a4f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Thông tin khách hàng</h4>
                    </div>
                    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", background: "#fafafa" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: (customer?.Email || customer?.Phone || customer?.CustomerCode) ? 12 : 0 }}>
                        <img
                          src={customer?.AvatarUrl ? resolveFileUrl(customer.AvatarUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "KH")}&background=1f7a5a&color=fff&size=96`}
                          alt={customer?.FullName || "KH"}
                          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "KH")}&background=1f7a5a&color=fff&size=96`; }}
                          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #d1fae5" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.97rem", color: "#1a1a1a" }}>{customer?.FullName || "Khách hàng"}</p>
                          {customer?.CustomerCode && (<p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>{customer.CustomerCode}</p>)}
                        </div>
                        {(customer?.MembershipLevel || customer?.MembershipTier) && (
                          <span style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1px solid #f59e0b", borderRadius: 20, padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", whiteSpace: "nowrap", flexShrink: 0 }}>⭐ {customer.MembershipLevel || customer.MembershipTier}</span>
                        )}
                      </div>
                      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                        {customer?.Phone ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#374151" }}><span>📞</span><span>{customer.Phone}</span></div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#9ca3af" }}><span>📞</span><span>Chưa cập nhật số điện thoại</span></div>
                        )}
                        {customer?.Email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#374151" }}><span>✉️</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.Email}</span></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ② Date & Time */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#2d6a4f", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>2</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Chọn ngày &amp; giờ hẹn</h4>
                    </div>

                    {/* Date */}
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Ngày hẹn *
                    </label>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      border: "1.5px solid #e5e7eb", borderRadius: 10,
                      padding: "2px 14px", marginBottom: 16,
                      background: "#fff",
                    }}>
                      <span style={{ fontSize: 16 }}>📅</span>
                      <input
                        type="date"
                        value={bookDate}
                        min={(() => {
                          const now = new Date();
                          let todayStr = now.toISOString().split("T")[0];
                          if (now.getHours() >= 21) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            todayStr = tomorrow.toISOString().split("T")[0];
                          }
                          if (suggestDate) {
                            // Extract date part only from suggestDate (which is a local Date object)
                            const y = suggestDate.getFullYear();
                            const m = String(suggestDate.getMonth() + 1).padStart(2, "0");
                            const d = String(suggestDate.getDate()).padStart(2, "0");
                            const suggestDateStr = `${y}-${m}-${d}`;
                            if (suggestDateStr > todayStr) {
                              return suggestDateStr;
                            }
                          }
                          return todayStr;
                        })()}
                        onChange={e => setBookDate(e.target.value)}
                        style={{
                          flex: 1, border: "none", outline: "none",
                          fontSize: "0.95rem", fontWeight: 600, color: "#1a1a1a",
                          padding: "10px 0", background: "transparent",
                        }}
                      />
                      {bookDate && (
                        <span style={{ fontSize: "0.8rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {new Date(bookDate + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {/* Time slots */}
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      Chọn giờ hẹn *
                    </label>
                    
                    {slotLoading ? (
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "10px 0" }}>⏳ Đang tải giờ trống...</p>
                    ) : slotError ? (
                      <p style={{ fontSize: "0.85rem", color: "#ef4444", margin: "10px 0" }}>⚠️ {slotError}</p>
                    ) : availableSlots.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        {availableSlots.map((slot) => {
                          const isSlotAvailable = slot.available !== false;
                          const formattedStart = formatTime(slot.startTime);
                          const isActive = formatTime(bookTime) === formattedStart;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              disabled={!isSlotAvailable}
                              onClick={() => setBookTime(formattedStart)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: isActive ? "2px solid #2d6a4f" : "1.5px solid #e5e7eb",
                                background: isActive ? "#2d6a4f" : "#fff",
                                color: isActive ? "#fff" : "#374151",
                                fontWeight: isActive ? 700 : 500,
                                fontSize: "0.82rem",
                                cursor: isSlotAvailable ? "pointer" : "not-allowed",
                                opacity: isSlotAvailable ? 1 : 0.5,
                                transition: "all 0.15s",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 90,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{formattedStart}</span>
                              <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>- {formatTime(slot.endTime)}</span>
                              {!isSlotAvailable && <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700, marginTop: 2 }}>Bận</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "10px 0" }}>💡 Vui lòng chọn kỹ thuật viên và ngày để xem giờ trống.</p>
                    )}

                    {alternatives.length > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 12px", background: "#fdf2f8", border: "1px solid #fbcfe8", borderRadius: 8 }}>
                        <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "#be185d" }}>
                          💡 Gợi ý khung giờ trống khác:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {alternatives.map((alt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (alt.date) setBookDate(alt.date);
                                if (alt.startTime) setBookTime(formatTime(alt.startTime));
                              }}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #fbcfe8",
                                background: "#fff",
                                color: "#db2777",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {alt.date ? new Date(alt.date).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" }) : ""} - {formatTime(alt.startTime)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ③ Service */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#2d6a4f", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>3</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Dịch vụ</h4>
                    </div>
                    <div style={{
                      border: "1.5px solid #e5e7eb", borderRadius: 12,
                      padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
                    }}>
                      {bookSvcImage ? (
                        <img
                          src={resolveFileUrl(bookSvcImage)}
                          alt={bookSvcName}
                          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
                          style={{
                            width: 44, height: 44, borderRadius: 10,
                            objectFit: "cover", flexShrink: 0,
                            border: "1px solid #f3e4ec",
                          }}
                        />
                      ) : null}
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: "linear-gradient(135deg,#fce4ec,#f8bbd0)",
                        display: bookSvcImage ? "none" : "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 22, flexShrink: 0,
                      }}>💅</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: "#1a1a1a", fontSize: "0.97rem" }}>
                          {bookSvcName || "Dịch vụ"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
                          Theo liệu trình – cố định
                        </p>
                      </div>
                      {(() => {
                        const svc = services.find(s => String(s.ServiceId) === String(bookSvc));
                        return svc?.Price ? (
                          <span style={{ fontWeight: 700, color: "#2d6a4f", fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                            {Number(svc.Price).toLocaleString("vi-VN")}đ
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* ④ KTV */}
                  {/* ④ KTV */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#2d6a4f", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>4</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Kỹ thuật viên *</h4>
                    </div>

                    <input
                      type="text"
                      placeholder="Tìm kiếm kỹ thuật viên..."
                      value={ktvKeyword}
                      onChange={e => setKtvKeyword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1.5px solid #e5e7eb",
                        fontSize: "0.85rem",
                        outline: "none",
                        marginBottom: 10,
                        boxSizing: "border-box"
                      }}
                    />

                    {ktvLoading ? (
                      <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Đang tải danh sách kỹ thuật viên...</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 200, overflowY: "auto", padding: "2px" }}>
                        {qualifiedKtvs.filter(item => !ktvKeyword || item.FullName?.toLowerCase().includes(ktvKeyword.toLowerCase())).map((item) => {
                          const isSelected = String(bookKtv) === String(item.EmployeeId);
                          return (
                            <button
                              type="button"
                              key={item.EmployeeId}
                              onClick={() => {
                                setBookKtv(String(item.EmployeeId));
                                setBookKtvName(item.FullName);
                                setBookKtvAvatar(item.ImageUrl || "");
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: isSelected ? "2.5px solid #2d6a4f" : "1.5px solid #e5e7eb",
                                background: isSelected ? "#f0fdf4" : "#fff",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                outline: "none",
                                boxShadow: isSelected ? "0 2px 6px rgba(45,106,79,0.15)" : "none",
                              }}
                            >
                              <img
                                src={item.ImageUrl ? resolveFileUrl(item.ImageUrl) : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.FullName || "KTV")}&background=1f7a5a&color=fff&size=64`}
                                alt={item.FullName}
                                onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.FullName || "KTV")}&background=1f7a5a&color=fff&size=64`; }}
                                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.FullName}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.Specialization || item.Position || "Kỹ thuật viên"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                        {qualifiedKtvs.length === 0 && (
                          <p style={{ gridColumn: "span 2", fontSize: "0.85rem", color: "#9ca3af", textAlign: "center", margin: "10px 0" }}>
                            Không tìm thấy kỹ thuật viên phù hợp.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Package banner */}
                  {matchedPackages.length > 0 && (
                    <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          id="use-package-chk"
                          checked={usePackage}
                          onChange={e => setUsePackage(e.target.checked)}
                          style={{ width: 16, height: 16, cursor: "pointer", margin: 0, accentColor: "#2563eb" }}
                        />
                        <label htmlFor="use-package-chk" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1e40af", cursor: "pointer", margin: 0 }}>
                          🎁 Sử dụng thẻ liệu trình của khách
                        </label>
                      </div>
                      {usePackage && (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: "block", fontSize: "0.8rem", color: "#1e40af", marginBottom: 4, fontWeight: 600 }}>Chọn gói áp dụng:</label>
                          <select
                            value={selectedPackageId}
                            onChange={e => setSelectedPackageId(e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #93c5fd", background: "#fff", fontSize: "0.88rem", outline: "none" }}
                          >
                            {matchedPackages.map(pkg => (
                              <option key={pkg.CustomerPackageId} value={pkg.CustomerPackageId}>
                                {pkg.PackageName} (Còn {pkg.RemainingSessions} buổi)
                              </option>
                            ))}
                          </select>
                          <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#2563eb", fontWeight: 500 }}>
                            ✨ Ca tái khám này sẽ được thanh toán bằng thẻ (0đ)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ⑤ Status */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#2d6a4f", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>5</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Trạng thái xác nhận lịch hẹn *</h4>
                    </div>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                        width: 20, height: 20, borderRadius: "50%",
                        background: bookStatus === "CONFIRMED" ? "#16a34a" : "#f59e0b",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: "#fff", fontWeight: 700,
                      }}>
                        {bookStatus === "CONFIRMED" ? "✓" : "⏳"}
                      </div>
                      <select
                        value={bookStatus}
                        onChange={e => setBookStatus(e.target.value)}
                        style={{
                          width: "100%", paddingLeft: 46, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
                          borderRadius: 10, border: "1.5px solid #e5e7eb",
                          background: "#fff", fontSize: "0.9rem", outline: "none", cursor: "pointer",
                          fontWeight: 600, color: "#1a1a1a", appearance: "none",
                        }}
                      >
                        <option value="CONFIRMED">Khách đã xác nhận (Confirmed)</option>
                        <option value="PENDING">Gửi tin nhắn chờ xác nhận (Pending)</option>
                      </select>
                      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }}>▾</span>
                    </div>
                  </div>

                  {/* ⑥ Note */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#9ca3af", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>6</span>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a" }}>Ghi chú thêm <span style={{ fontWeight: 400, color: "#6b7280", fontSize: "0.82rem" }}>(tùy chọn)</span></h4>
                    </div>
                    <textarea
                      rows={3}
                      value={bookNote}
                      onChange={e => { if (e.target.value.length <= 200) setBookNote(e.target.value); }}
                      placeholder="Lưu ý cho lần tái khám này..."
                      style={{
                        width: "100%", padding: "12px 14px", borderRadius: 10,
                        border: "1.5px solid #e5e7eb", fontSize: "0.88rem",
                        outline: "none", resize: "vertical", boxSizing: "border-box",
                        color: "#374151", lineHeight: 1.5,
                      }}
                    />
                    <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>
                      {bookNote.length}/200
                    </div>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>(*) Bắt buộc</p>
                </div>

                {/* RIGHT: Summary sidebar */}
                <div style={{ width: 280, flexShrink: 0, padding: "24px 20px", background: "#fafafa", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

                  {/* Summary card */}
                  <div>
                    <p style={{ margin: "0 0 12px", fontSize: "0.72rem", fontWeight: 800, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      TÓM TẮT LỊCH HẸN
                    </p>
                    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      {/* Customer row */}
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "center" }}>
                          <img
                            src={customer?.AvatarUrl
                              ? resolveFileUrl(customer.AvatarUrl)
                              : `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "KH")}&background=1f7a5a&color=fff&size=64`}
                            alt={customer?.FullName || "KH"}
                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(customer?.FullName || "KH")}&background=1f7a5a&color=fff&size=64`; }}
                            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #d1fae5" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Khách hàng</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>{customer?.FullName || "—"}</p>
                            {customer?.Phone && <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#6b7280" }}>{customer.Phone}</p>}
                          </div>
                        </div>

                        {/* Date row */}
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📅</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Ngày hẹn</p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>
                              {bookDate
                                ? new Date(bookDate + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
                                : "Chưa chọn"}
                            </p>
                          </div>
                        </div>

                        {/* Time row */}
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🕐</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Giờ hẹn</p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>{bookTime || "Chưa chọn"}</p>
                          </div>
                        </div>

                        {/* Service row */}
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "center" }}>
                          {bookSvcImage ? (
                            <img
                              src={resolveFileUrl(bookSvcImage)}
                              alt={bookSvcName}
                              onError={e => { e.target.src = ""; e.target.style.display = "none"; }}
                              style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #f3e4ec" }}
                            />
                          ) : (
                            <span style={{ fontSize: 16, flexShrink: 0 }}>💅</span>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Dịch vụ</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {bookSvcName || "—"}
                            </p>
                          </div>
                          {(() => {
                            const svc = services.find(s => String(s.ServiceId) === String(bookSvc));
                            return svc?.Price ? (
                              <span style={{ fontWeight: 700, color: "#2d6a4f", fontSize: "0.88rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                                {Number(svc.Price).toLocaleString("vi-VN")}đ
                              </span>
                            ) : null;
                          })()}
                        </div>

                        {/* KTV row */}
                        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "center" }}>
                          <img
                            src={bookKtvAvatar
                              ? resolveFileUrl(bookKtvAvatar)
                              : `https://ui-avatars.com/api/?name=${encodeURIComponent(bookKtvName || "KTV")}&background=1f7a5a&color=fff&size=64`}
                            alt={bookKtvName || "KTV"}
                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(bookKtvName || "KTV")}&background=1f7a5a&color=fff&size=64`; }}
                            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #bae6fd" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Kỹ thuật viên</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>{bookKtvName || "—"}</p>
                            <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#6b7280" }}>KTV điều trị – cố định</p>
                          </div>
                        </div>

                        {/* Duration row */}
                        <div style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⏱</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Thời lượng dự kiến</p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>
                              {(() => {
                                const svc = services.find(s => String(s.ServiceId) === String(bookSvc));
                                return svc?.DurationMinutes ? svc.DurationMinutes + " phút" : "—";
                              })()}
                            </p>
                          </div>
                        </div>

                      {/* Total */}
                      <div style={{ padding: "12px 14px", background: "#f0fdf4", borderTop: "2px solid #d1fae5" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>💰</span>
                          <div>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#6b7280" }}>Tổng chi phí dự kiến</p>
                            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#2d6a4f" }}>
                              {usePackage ? "0đ (thẻ liệu trình)" : (() => {
                                const svc = services.find(s => String(s.ServiceId) === String(bookSvc));
                                return svc?.Price ? Number(svc.Price).toLocaleString("vi-VN") + "đ" : "—";
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Green tip */}
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 10, padding: "12px 14px",
                    fontSize: "0.8rem", color: "#166534", lineHeight: 1.5,
                  }}>
                    🌿 Tái khám giúp duy trì kết quả và chăm sóc tốt nhất cho bạn. 💚
                  </div>

                  {/* Recent service history */}
                  {(() => {
                    const uniqueHistory = [];
                    const seen = new Set();
                    timeline
                      .filter(n => customer?.CustomerId && Number(n.customer_id) === Number(customer.CustomerId))
                      .sort((a, b) => parseLocalDate(b.service_date_time) - parseLocalDate(a.service_date_time))
                      .forEach(n => {
                        const dateStr = n.service_date_time ? parseLocalDate(n.service_date_time).toLocaleDateString("vi-VN") : "";
                        const key = `${n.ServiceName || ""}_${dateStr}_${n.TechnicianName || ""}`;
                        if (!seen.has(key)) {
                          seen.add(key);
                          uniqueHistory.push(n);
                        }
                      });
                    const recentHistory = uniqueHistory.slice(0, 5);
                    return (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 800, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          LỊCH SỬ DỊCH VỤ GẦN NHẤT
                        </p>
                        {recentHistory.length === 0 ? (
                          <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px dashed #e5e7eb", padding: "16px 14px", textAlign: "center" }}>
                            <p style={{ margin: 0, fontSize: "0.8rem", color: "#9ca3af" }}>Chưa có lịch sử dịch vụ</p>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {recentHistory.map((note, idx) => {
                              const isActive = selectedNote?.id === note.id;
                              const statusColor = note.status === "finalized" ? "#16a34a"
                                : note.status === "draft" ? "#d97706"
                                : note.status === "cancelled" ? "#dc2626" : "#6b7280";
                              const statusLabel = note.status === "finalized" ? "Hoàn thành"
                                : note.status === "draft" ? "Nháp"
                                : note.status === "cancelled" ? "Đã hủy" : note.status || "—";
                              
                              const svcImage = getTimelineThumb(note);
                              
                              return (
                                <div key={note.id || idx} style={{
                                  background: isActive ? "#f0fdf4" : "#fff",
                                  borderRadius: 12,
                                  border: isActive ? "1.5px solid #86efac" : "1px solid #e5e7eb",
                                  padding: "10px 12px",
                                  display: "flex", alignItems: "center", gap: 12,
                                  boxShadow: isActive ? "0 2px 8px rgba(34,197,94,0.08)" : "none",
                                  transition: "all 0.2s ease"
                                }}>
                                  {svcImage ? (
                                    <img
                                      src={svcImage}
                                      alt={note.ServiceName}
                                      onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(note.ServiceName || "DV")}&background=1f7a5a&color=fff&size=64`; }}
                                      style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #f3f4f6" }}
                                    />
                                  ) : (
                                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💅</div>
                                  )}
                                  
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {note.ServiceName || "—"}
                                    </p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                      <span style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                                        📅 {note.service_date_time ? parseLocalDate(note.service_date_time).toLocaleDateString("vi-VN") : "—"}
                                      </span>
                                      {note.TechnicianName && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 2, minWidth: 0 }}>
                                          <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>·</span>
                                          <img
                                            src={note.TechnicianAvatar ? resolveFileUrl(note.TechnicianAvatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(note.TechnicianName)}&background=1f7a5a&color=fff&size=32`}
                                            alt={note.TechnicianName}
                                            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(note.TechnicianName)}&background=1f7a5a&color=fff&size=32`; }}
                                            style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                          />
                                          <span style={{ fontSize: "0.72rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {note.TechnicianName}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: statusColor, background: statusColor + "18", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                                    {statusLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                </div>

              {/* ── Footer ── */}
              <div style={{
                padding: "16px 28px",
                borderTop: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#9ca3af" }}>(*) Bắt buộc</p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={closeBookModal}
                    style={{
                      padding: "10px 22px", borderRadius: 10,
                      border: "1.5px solid #e5e7eb", background: "#fff",
                      color: "#374151", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
                    }}
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="button"
                    onClick={handleBook}
                    disabled={saving}
                    style={{
                      padding: "10px 24px", borderRadius: 10, border: "none",
                      background: saving ? "#9ca3af" : "linear-gradient(135deg,#2d6a4f,#1b4332)",
                      color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                      cursor: saving ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      boxShadow: "0 4px 14px rgba(45,106,79,0.35)",
                    }}
                  >
                    {saving ? (
                      <>⏳ Đang đặt lịch...</>
                    ) : (
                      <>📅 Xác nhận đặt lịch</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ CHỌN LỊCH HẸN HOÀN THÀNH MODAL ════ */}
        {showCreateNoteModal && (
          <div className="tn-modal-bg" onClick={e => e.target === e.currentTarget && setShowCreateNoteModal(false)}>
            <div className="tn-modal" style={{ width: "520px" }}>
              <div className="tn-modal__head">
                <h3>📝 Tạo ghi chú điều trị</h3>
                <button className="tn-modal__close" onClick={() => setShowCreateNoteModal(false)} type="button">✕</button>
              </div>
              <p className="tn-modal__sub">Chọn lịch hẹn đã hoàn thành hoặc đang thực hiện để tiến hành ghi chú</p>
              
              <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", margin: "10px 0" }}>
                {loadingAppts ? (
                  <p style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted-gray)" }}>Đang tải lịch hẹn...</p>
                ) : completedAppts.length === 0 ? (
                  <p style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted-gray)", padding: "20px 0" }}>Không có lịch hẹn hoàn thành hoặc đang thực hiện nào cần ghi chú.</p>
                ) : (
                  completedAppts.map(appt => (
                    <div key={appt.AppointmentId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", border: "1.5px solid var(--border-color)", borderRadius: "var(--r-item)", background: "#fff", transition: "all 0.18s" }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                          <strong style={{ fontSize: "0.95rem", color: "var(--text-charcoal)" }}>{appt.CustomerName}</strong>
                          <span style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 6px",
                            background: appt.Status === "COMPLETED" ? "#d1fae5" : "#ffedd5",
                            color: appt.Status === "COMPLETED" ? "#065f46" : "#9a3412"
                          }}>
                            {appt.Status === "COMPLETED" ? "Hoàn thành" : "Đang thực hiện"}
                          </span>
                        </div>
                        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted-gray)", marginTop: "4px" }}>💅 {appt.ServiceName}</span>
                        <span style={{ display: "block", fontSize: "0.78rem", color: "#3b82f6", marginTop: "2px", fontWeight: "600" }}>📅 {new Date(appt.AppointmentDate).toLocaleDateString("vi-VN")} - {appt.StartTime}</span>
                      </div>
                      <button className="tn-btn tn-btn--primary tn-btn--sm" onClick={() => handleSelectCompletedAppt(appt)} type="button">Chọn</button>
                    </div>
                  ))
                )}
              </div>

              <div className="tn-modal__foot">
                <button className="tn-btn tn-btn--ghost" onClick={() => setShowCreateNoteModal(false)} type="button">Đóng</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </TechnicianLayout>
  );
}
