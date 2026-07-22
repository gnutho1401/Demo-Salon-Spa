import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";
import "../../styles/pages/technician.css";
import "../../styles/pages/treatment-notes.css";
import { useNavigate, useSearchParams } from "react-router-dom";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const DEFAULT_SUMMARY = "Khách hàng hài lòng với mẫu nail hiện tại, màu sắc phù hợp với tông da. Móng chắc khỏe, không bị hư tổn. Tiếp tục duy trì liệu trình.";
const DEFAULT_SKIN = "Móng hơi giòn, dễ gãy ở đầu móng\nDa quanh móng hơi khô\nMàu móng cũ đã phai\nKhông có dấu hiệu nấm hay viêm";
const DEFAULT_TECH = "1. Làm sạch móng và da tay\n2. Cắt da, dũa form móng oval\n3. Sơn base coat bảo vệ\n4. Sơn gel màu hồng nhạt (2 lớp)\n5. Vẽ nail art hoa nhỏ ở ngón áp út\n6. Sơn top coat bóng\n7. Dưỡng da và massage tay";
const DEFAULT_FEEDBACK = "Móng đẹp, màu sắc đều và bóng\nNail art tinh tế, khách hàng rất hài lòng\nDa tay mềm mịn sau massage\nHướng dẫn chăm sóc tại nhà đầy đủ";
const DEFAULT_REC = "Giữ móng khô ráo, đeo găng tay khi làm việc nhà\nDưỡng móng 2-3 lần/tuần bằng nail oil\nTránh sử dụng hóa chất mạnh\nTái khám sau 3-4 tuần";
const DEFAULT_PERSONAL = "Khách hàng rất thích màu hồng và phong cách nhẹ nhàng. Nên tư vấn thêm các mẫu nail tông pastel.";
const DEFAULT_SPECIAL = "Khách hàng dị ứng với sản phẩm có mùi nồng.";
const DEFAULT_PRODUCTS = "Son gel OPI - Bubble Bath, Top Coat OPI - Top Coat, Dưỡng móng OPI - Nail Oil";

const AVAILABLE_PRODUCTS = [
  { id: 1, name: "Son gel OPI - Bubble Bath", category: "Làm Móng (Nails Care & Art)" },
  { id: 2, name: "Son gel OPI - Alpine Snow", category: "Làm Móng (Nails Care & Art)" },
  { id: 3, name: "Son gel OPI - Big Apple Red", category: "Làm Móng (Nails Care & Art)" },
  { id: 4, name: "Son gel OPI - Lincoln Park After Dark", category: "Làm Móng (Nails Care & Art)" },
  { id: 5, name: "Top Coat OPI - Top Coat", category: "Làm Móng (Nails Care & Art)" },
  { id: 6, name: "Base Coat OPI - Base Coat", category: "Làm Móng (Nails Care & Art)" },
  { id: 7, name: "Dưỡng móng OPI - Nail Oil", category: "Làm Móng (Nails Care & Art)" },
  { id: 8, name: "Gel Remover CND - Tháo móng", category: "Làm Móng (Nails Care & Art)" },
  
  { id: 9, name: "Kem dưỡng ẩm tay Vaseline", category: "Chăm Sóc Da (Skin Care)" },
  { id: 10, name: "Serum phục hồi móng Keratin Rescue", category: "Chăm Sóc Da (Skin Care)" },
  { id: 11, name: "Tẩy tế bào chết tay Scrub hạt mơ", category: "Chăm Sóc Da (Skin Care)" },
  { id: 12, name: "Sữa rửa mặt Cetaphil dịu nhẹ", category: "Chăm Sóc Da (Skin Care)" },
  { id: 13, name: "Mặt nạ ngủ cấp ẩm Innisfree", category: "Chăm Sóc Da (Skin Care)" },
  
  { id: 14, name: "Dầu gội Biotin & Collagen phục hồi", category: "Chăm Sóc Tóc (Hair Care)" },
  { id: 15, name: "Dầu xả Moroccanoil mềm mượt", category: "Chăm Sóc Tóc (Hair Care)" },
  { id: 16, name: "Serum tóc bóng L'Oreal", category: "Chăm Sóc Tóc (Hair Care)" },
  { id: 17, name: "Kem ủ phục hồi Olaplex No.3", category: "Chăm Sóc Tóc (Hair Care)" },
  
  { id: 18, name: "Kem nền Estee Lauder che phủ", category: "Trang Điểm (Makeup)" },
  { id: 19, name: "Son môi lì dưỡng ẩm MAC", category: "Trang Điểm (Makeup)" },
  { id: 20, name: "Phấn phủ Laura Mercier kiềm dầu", category: "Trang Điểm (Makeup)" },
  { id: 21, name: "Tẩy trang Bioderma dịu nhẹ", category: "Trang Điểm (Makeup)" }
];

// Helper formatters
function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value) {
  if (value === undefined || value === null) return "0đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

function getAvatar(url) {
  if (!url) return DEFAULT_AVATAR;
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function getDefaults(serviceName) {
  const name = String(serviceName || "").toLowerCase();
  
  // 1. Nails
  if (name.includes("nail") || name.includes("móng") || name.includes("sơn") || name.includes("vẽ") || name.includes("dũa")) {
    return {
      summary: "Khách hàng hài lòng với mẫu nail hiện tại, màu sắc phù hợp với tông da. Móng chắc khỏe, không bị hư tổn. Tiếp tục duy trì liệu trình.",
      skin: "Móng hơi giòn, dễ gãy ở đầu móng\nDa quanh móng hơi khô\nMàu móng cũ đã phai\nKhông có dấu hiệu nấm hay viêm",
      tech: "1. Làm sạch móng và da tay\n2. Cắt da, dũa form móng oval\n3. Sơn base coat bảo vệ\n4. Sơn gel màu hồng nhạt (2 lớp)\n5. Vẽ nail art hoa nhỏ ở ngón áp út\n6. Sơn top coat bóng\n7. Dưỡng da và massage tay",
      feedback: "Móng đẹp, màu sắc đều và bóng\nNail art tinh tế, khách hàng rất hài lòng\nDa tay mềm mịn sau massage\nHướng dẫn chăm sóc tại nhà đầy đủ",
      rec: "Giữ móng khô ráo, đeo găng tay khi làm việc nhà\nDưỡng móng 2-3 lần/tuần bằng nail oil\nTránh sử dụng hóa chất mạnh\nTái khám sau 3-4 tuần",
      personal: "Khách hàng rất thích màu hồng và phong cách nhẹ nhàng. Nên tư vấn thêm các mẫu nail tông pastel.",
      special: "Khách hàng dị ứng với sản phẩm có mùi nồng.",
      products: "Son gel OPI - Bubble Bath, Top Coat OPI - Top Coat, Dưỡng móng OPI - Nail Oil"
    };
  }
  
  // 2. Massage / Body
  if (name.includes("massage") || name.includes("đá nóng") || name.includes("body") || name.includes("thư giãn") || name.includes("tẩy tế bào chết body")) {
    return {
      summary: "Khách hàng cảm thấy thư giãn tinh thần, giảm căng cơ rõ rệt sau liệu trình massage body. Cơ thể nhẹ nhàng, thoải mái.",
      skin: "Cơ vai và cổ gáy căng cứng do ngồi nhiều\nDa body bình thường, không trầy xước\nKhông có chấn thương xương khớp chống chỉ định",
      tech: "1. Khởi động làm ấm cơ thể\n2. Thoa tinh dầu thảo mộc toàn thân\n3. Thực hiện các động tác vuốt, bóp cơ vai gáy và lưng\n4. Đặt đá nóng bazan lên các huyệt đạo dọc sống lưng\n5. Massage kết hợp đá nóng giải tỏa độc tố và căng cơ\n6. Lau sạch body bằng khăn ấm",
      feedback: "Khách hàng cảm thấy nhẹ nhõm, dễ chịu\nĐộ nóng của đá vừa phải, dễ chịu\nCác vùng cơ cứng đã mềm hơn\nKhách hàng ngủ thiếp đi trong khi massage",
      rec: "Tránh tắm nước lạnh ngay sau khi massage đá nóng\nUống nhiều nước ấm để thanh lọc cơ thể\nThực hiện giãn cơ nhẹ nhàng tại nhà\nTái khám định kỳ sau 2-3 tuần",
      personal: "Khách hàng thích lực ấn mạnh ở vùng vai gáy và thắt lưng. Thích phòng massage yên tĩnh và nhạc nhẹ.",
      special: "Nhạy cảm với tinh dầu sả chanh, ưu tiên dùng tinh dầu oải hương lavender dịu nhẹ.",
      products: "Tinh dầu massage Lavender, Đá nóng bazan thiên nhiên"
    };
  }

  // 3. Skin Care
  if (name.includes("da") || name.includes("mặt") || name.includes("mụn") || name.includes("facial") || name.includes("acne") || name.includes("nặn mụn")) {
    return {
      summary: "Da mặt sạch sâu, thông thoáng lỗ chân lông. Cấp ẩm tức thì giúp da căng mướt và sáng khỏe hơn sau dịch vụ.",
      skin: "Da hỗn hợp thiên dầu, vùng chữ T bóng nhờn\nLỗ chân lông hơi to, có ít mụn đầu đen vùng mũi\nDa thiếu nước nhẹ, xỉn màu",
      tech: "1. Tẩy trang và rửa mặt bằng sữa rửa mặt dịu nhẹ\n2. Tẩy tế bào chết vật lý nhẹ nhàng\n3. Xông hơi nóng mở lỗ chân lông\n4. Hút bã nhờn và mụn cám nhẹ\n5. Thoa toner cân bằng da\n6. Đắp mặt nạ đất sét thanh lọc / mặt nạ giấy cấp ẩm\n7. Thoa kem dưỡng khóa ẩm và kem chống nắng",
      feedback: "Da sạch mịn, giảm đáng kể lượng dầu thừa\nVùng chữ T bớt bóng dầu\nKhách cảm thấy da mát lạnh ẩm mượt\nKhông có dấu hiệu mẩn đỏ kích ứng",
      rec: "Uống đủ nước, hạn chế đồ ăn cay nóng và thức khuya\nThoa kem chống nắng mỗi ngày\nDùng sữa rửa mặt dịu nhẹ pH 5.5\nTái khám chăm sóc da sau 2 tuần",
      personal: "Khách hàng quan tâm đến chống lão hóa và mờ thâm mụn. Thích đắp mặt nạ giấy mát.",
      special: "Da mỏng nhạy cảm, không sử dụng sản phẩm chứa cồn hay hương liệu nồng.",
      products: "Sữa rửa mặt Cetaphil, Tẩy tế bào chết tay Scrub hạt mơ, Toner cấp ẩm, Mặt nạ ngủ Innisfree"
    };
  }

  // 4. Hair Care
  if (name.includes("tóc") || name.includes("gội") || name.includes("sấy") || name.includes("nhuộm") || name.includes("uốn") || name.includes("dưỡng sinh")) {
    return {
      summary: "Da đầu sạch gàu, tóc suôn mượt và thơm nhẹ hương thảo mộc. Khách hàng cảm thấy thư giãn sâu sau bài massage bấm huyệt đầu.",
      skin: "Da đầu hơi nhiều dầu nhờn, có gàu nhẹ ở đỉnh đầu\nTóc khô xơ phần đuôi tóc\nKhông bị nấm hay tổn thương da đầu",
      tech: "1. Chải tóc xơ và massage da đầu khô\n2. Gội lần 1 bằng dầu gội thảo mộc sạch sâu\n3. Gội lần 2 kết hợp massage bấm huyệt vùng đầu, vai gáy\n4. Thoa dầu xả phục hồi phần thân và đuôi tóc\n5. Xả sạch bằng nước ấm\n6. Sấy tóc khô 80% và thoa serum dưỡng tóc",
      feedback: "Tóc mềm mượt, bớt bết dầu\nDa đầu thông thoáng, sảng khoái\nĐộng tác bấm huyệt vai gáy lực vừa phải giúp giảm đau đầu\nKhách thích hương thơm thảo mộc",
      rec: "Hạn chế gội đầu bằng nước quá nóng làm khô tóc\nSử dụng thêm dầu dưỡng tóc ở phần đuôi\nTránh gãi mạnh gây xước da đầu\nGội đầu dưỡng sinh thư giãn định kỳ 1 tuần/lần",
      personal: "Khách hàng thích nhiệt độ sấy tóc mát, lực massage đầu nhẹ nhàng.",
      special: "Da đầu nhạy cảm, dễ ngứa với dầu gội chứa nhiều sulfate.",
      products: "Dầu gội Biotin & Collagen phục hồi, Dầu xả Moroccanoil, Serum dưỡng tóc L'Oreal"
    };
  }

  // 5. Default/Generic
  return {
    summary: "Hoàn thành dịch vụ chăm sóc sắc đẹp cho khách hàng. Khách hàng hài lòng với kết quả và chất lượng phục vụ.",
    skin: "Tình trạng bình thường, sẵn sàng thực hiện dịch vụ",
    tech: "Thực hiện các bước quy trình kỹ thuật tiêu chuẩn của dịch vụ",
    feedback: "Khách hàng hài lòng và đánh giá cao chất lượng phục vụ tại Salon",
    rec: "Chăm sóc và bảo dưỡng cơ thể theo hướng dẫn tiêu chuẩn của Salon",
    personal: "Khách hàng thân thiện, thích trò chuyện nhẹ nhàng hoặc không gian yên tĩnh.",
    special: "Không có lưu ý đặc biệt nào khác.",
    products: "Sử dụng sản phẩm chuyên dụng tiêu chuẩn tại Salon"
  };
}

const PROGRESS_STATUS_MAP = {
  IN_PROGRESS: "Đang duy trì",
  COMPLETED: "Hoàn thành",
  FOLLOW_UP_REQUIRED: "Cần tái khám",
};

export default function TreatmentNotesHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("notes");

  // Navigation and Search Query Params
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  // All technician appointments list for picking
  const [allAppointments, setAllAppointments] = useState([]);
  
  // Note Form Fields
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(""); // Treatment Summary
  const [skinCondition, setSkinCondition] = useState(""); // Pre-treatment
  const [technique, setTechnique] = useState(""); // Procedure followed
  const [customerFeedback, setCustomerFeedback] = useState(""); // Post-treatment
  const [recommendation, setRecommendation] = useState(""); // Recommendations
  const [personalNotes, setPersonalNotes] = useState(""); 
  const [specialNotice, setSpecialNotice] = useState("");
  const [progressStatus, setProgressStatus] = useState("IN_PROGRESS");
  const [followUpDate, setFollowUpDate] = useState("");
  const [productsUsed, setProductsUsed] = useState("");
  const [productSearch, setProductSearch] = useState("");
  
  // Upload Files state
  const [files, setFiles] = useState([]);
  const [uploadedAttachments, setUploadedAttachments] = useState([]);

  // Modals state
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [editingSections, setEditingSections] = useState({});
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  // Follow-up Booking States
  const [servicesList, setServicesList] = useState([]);
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("09:00");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  // New Note Modal States
  const [noNoteAppointments, setNoNoteAppointments] = useState([]);

  // Input refs for direct focus when pencil clicked
  const contentRef = useRef(null);
  const skinRef = useRef(null);
  const techRef = useRef(null);
  const feedbackRef = useRef(null);
  const recRef = useRef(null);
  const personalRef = useRef(null);
  const specialRef = useRef(null);

  // Computed data objects
  const appointment = data?.appointment || null;
  const previousNotes = data?.previousNotes || [];
  const customerStats = data?.customerStats || { TotalVisits: 0, TotalSpent: 0, LoyaltyPoints: 0, AverageRating: 5.0 };
  const activePackage = data?.activePackage || null;
  const treatmentHistory = data?.treatmentHistory || [];
  const productsUsedList = data?.productsUsedList || [];

  const displayProducts = useMemo(() => {
    if (isEditing || editingSections.products) return [];
    const list = productsUsed ? productsUsed.split(",").map(p => p.trim()).filter(Boolean) : [];
    return list.length > 0 ? list : productsUsedList;
  }, [productsUsed, productsUsedList, isEditing, editingSections.products]);

  const isSummaryEditing = isEditing || !!editingSections.summary;
  const isPreEditing = isEditing || !!editingSections.preCondition;
  const isProcedureEditing = isEditing || !!editingSections.procedure;
  const isPostEditing = isEditing || !!editingSections.postCondition;
  const isRecEditing = isEditing || !!editingSections.recommendations;
  const isPersonalEditing = isEditing || !!editingSections.personalNotes;
  const isSpecialEditing = isEditing || !!editingSections.specialNotice;
  const isProductsEditing = isEditing || !!editingSections.products;
  const isPlanEditing = isEditing || !!editingSections.plan;
  const isFollowUpEditing = isEditing || !!editingSections.followUp;

  const displayedHistory = useMemo(() => {
    return showAllTimeline ? treatmentHistory : treatmentHistory.slice(0, 3);
  }, [treatmentHistory, showAllTimeline]);

  // Display toast feedback
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Load all services list for follow-up booking
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await axiosClient.get("/services");
        setServicesList(res.data?.data || res.data || []);
      } catch (err) {
        console.error("Failed to load services list:", err);
      }
    };
    fetchServices();
  }, []);

  // Fetch appointments checklist to pick from
  const loadAppointmentsList = async () => {
    try {
      const res = await axiosClient.get("/technician/appointments", {
        params: { limit: 100 },
      });
      const list = res.data?.data?.appointments || [];
      
      // Only get appointments that are eligible for writing notes
      const eligible = list.filter((app) => 
        ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(String(app.Status).toUpperCase())
      );
      
      setAllAppointments(eligible);
      setNoNoteAppointments(eligible);
    } catch (err) {
      console.error("Failed to load appointments:", err);
    }
  };

  useEffect(() => {
    loadAppointmentsList();
  }, [appointmentId]);

  // Load Treatment Note details
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get("/technician/treatment-notes", {
        params: { appointmentId },
      });
      const payload = res.data?.data || {};

      setData(payload);
      
      // Set Form Fields based on dynamic service defaults
      const defaults = getDefaults(payload?.appointment?.ServiceName);
      setContent(payload?.appointment?.CurrentNote || defaults.summary);
      setTitle(payload?.appointment?.NoteTitle || "Treatment Note");
      setProductsUsed(payload?.appointment?.ProductsUsed || defaults.products);
      setSkinCondition(payload?.appointment?.SkinCondition || defaults.skin);
      setTechnique(payload?.appointment?.Technique || defaults.tech);
      setCustomerFeedback(payload?.appointment?.CustomerFeedback || defaults.feedback);
      setRecommendation(payload?.appointment?.Recommendation || defaults.rec);
      setPersonalNotes(payload?.appointment?.PersonalNotes || defaults.personal);
      setSpecialNotice(payload?.appointment?.SpecialNotice || defaults.special);
      setProgressStatus(payload?.appointment?.ProgressStatus || "IN_PROGRESS");
      setFollowUpDate(payload?.appointment?.FollowUpDate ? payload?.appointment?.FollowUpDate.slice(0, 10) : "");
      setUploadedAttachments(payload?.attachments || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Không tải được dữ liệu Treatment Note");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [appointmentId]);

  // Handle Note Save/Submit
  const handleSaveNote = async () => {
    if (!appointment?.AppointmentId) {
      alert("Không tìm thấy ID buổi hẹn để lưu!");
      return;
    }

    if (!content.trim()) {
      alert("Nội dung tóm tắt điều trị không được để trống!");
      return;
    }

    try {
      setSaving(true);
      
      // 1. Submit note content fields
      const res = await axiosClient.post("/technician/treatment-notes", {
        appointmentId: appointment.AppointmentId,
        title: title || `Treatment Note - KH${appointment.CustomerId}`,
        content,
        noteType: appointment.NoteType || "General Notes",
        productsUsed: productsUsed || "",
        skinCondition,
        technique,
        customerFeedback,
        recommendation,
        personalNotes,
        specialNotice,
        progressStatus,
        followUpDate: followUpDate || null,
      });

      const noteId = res.data?.data?.noteId || appointment.NoteId;

      // 2. Upload pending files if any
      if (noteId && files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append("files", file);
        });
        formData.append("attachmentType", activeTab === "photos" ? "PHOTO" : "GENERAL");

        await axiosClient.post(`/technician/treatment-notes/${noteId}/attachments`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setFiles([]);
      setIsEditing(false);
      triggerToast("✓ Đã lưu thông tin Treatment Note thành công!");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Lưu ghi chú điều trị thất bại!");
    } finally {
      setSaving(false);
    }
  };

  // Upload attachment immediately when user drops/picks files in view mode
  const handleDirectFileUpload = async (selectedFiles) => {
    if (!appointment?.NoteId) {
      alert("Vui lòng lưu thông tin ghi chú trước khi tải tệp lên!");
      return;
    }

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("attachmentType", activeTab === "photos" ? "PHOTO" : "GENERAL");

      const res = await axiosClient.post(`/technician/treatment-notes/${appointment.NoteId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      triggerToast("✓ Tải tệp lên thành công!");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Tải tệp lên thất bại!");
    }
  };

  // Schedule follow-up appointment booking
  const handleBookFollowUp = async () => {
    if (!bookingServiceId) {
      alert("Vui lòng chọn dịch vụ hẹn!");
      return;
    }
    if (!bookingDate) {
      alert("Vui lòng chọn ngày hẹn!");
      return;
    }

    try {
      setBookingLoading(true);
      const payload = {
        customerId: appointment.CustomerId,
        appointmentDate: bookingDate,
        startTime: bookingTime,
        serviceIds: [Number(bookingServiceId)],
        note: bookingNote || "Tái khám hẹn tiếp theo từ Treatment Note",
        paymentStatus: "UNPAID",
        paymentMethod: "CASH",
        isWalkIn: false,
        parentAppointmentId: appointment.AppointmentId,
      };

      await axiosClient.post("/technician/appointments", payload);
      triggerToast("📅 Đã đặt lịch tái khám thành công!");
      setShowFollowUpModal(false);
      setBookingNote("");
      // Refresh current note screen
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Đặt lịch hẹn tái khám thất bại!");
    } finally {
      setBookingLoading(false);
    }
  };

  // Copy note details for sharing
  const handleShareNote = () => {
    if (!appointment) return;
    const shareText = `LUNA SALON - TREATMENT NOTE
------------------------------------
Khách hàng: ${appointment.CustomerName} (KH${String(appointment.CustomerId).padStart(4, "0")})
Trạng thái: ${PROGRESS_STATUS_MAP[progressStatus] || progressStatus}
KTV phụ trách: ${appointment.RoomName || "Linh Chi"}

1. Tóm tắt điều trị:
   ${content || "Chưa có"}

2. Tình trạng trước điều trị:
   ${skinCondition || "Chưa có"}

3. Quy trình thực hiện:
   ${technique || "Chưa có"}

4. Tình trạng sau điều trị:
   ${customerFeedback || "Chưa có"}

5. Khuyến nghị & hướng dẫn:
   ${recommendation || "Chưa có"}

6. Ghi chú cá nhân:
   ${personalNotes || "Chưa có"}

7. Lưu ý đặc biệt:
   ${specialNotice || "Chưa có"}

Tái khám hẹn tiếp theo: ${followUpDate ? formatDate(followUpDate) : "Chưa đặt"}`;

    navigator.clipboard.writeText(shareText);
    triggerToast("📋 Đã sao chép nội dung chia sẻ vào clipboard!");
  };

  // Enter edit mode and focus on specific field (or start section editing)
  const enterEditField = (ref, section) => {
    if (section) {
      setEditingSections(prev => ({ ...prev, [section]: true }));
      setTimeout(() => {
        if (ref && ref.current) {
          ref.current.focus();
        }
      }, 100);
    } else {
      setIsEditing(true);
      setTimeout(() => {
        if (ref && ref.current) {
          ref.current.focus();
        }
      }, 100);
    }
  };

  const handleCancelSection = (section) => {
    // Restore state variable from database values or dynamic defaults
    const defaults = getDefaults(data?.appointment?.ServiceName);

    if (section === "summary") setContent(data?.appointment?.CurrentNote || defaults.summary);
    if (section === "preCondition") setSkinCondition(data?.appointment?.SkinCondition || defaults.skin);
    if (section === "procedure") setTechnique(data?.appointment?.Technique || defaults.tech);
    if (section === "postCondition") setCustomerFeedback(data?.appointment?.CustomerFeedback || defaults.feedback);
    if (section === "recommendations") setRecommendation(data?.appointment?.Recommendation || defaults.rec);
    if (section === "personalNotes") setPersonalNotes(data?.appointment?.PersonalNotes || defaults.personal);
    if (section === "specialNotice") setSpecialNotice(data?.appointment?.SpecialNotice || defaults.special);
    if (section === "products") setProductsUsed(data?.appointment?.ProductsUsed || defaults.products);
    if (section === "plan") setProgressStatus(data?.appointment?.ProgressStatus || "IN_PROGRESS");
    if (section === "followUp") setFollowUpDate(data?.appointment?.FollowUpDate ? data?.appointment?.FollowUpDate.slice(0, 10) : "");

    setEditingSections(prev => ({ ...prev, [section]: false }));
  };

  const selectedProducts = useMemo(() => {
    return productsUsed ? productsUsed.split(",").map(p => p.trim()).filter(Boolean) : [];
  }, [productsUsed]);

  const handleToggleProduct = (productName) => {
    let list = productsUsed ? productsUsed.split(",").map(p => p.trim()).filter(Boolean) : [];
    if (list.includes(productName)) {
      list = list.filter(p => p !== productName);
    } else {
      list = [...list, productName];
    }
    setProductsUsed(list.join(", "));
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return AVAILABLE_PRODUCTS;
    const query = productSearch.toLowerCase();
    return AVAILABLE_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query)
    );
  }, [productSearch]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    filteredProducts.forEach(p => {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category].push(p);
    });
    return groups;
  }, [filteredProducts]);

  const handleSaveSection = async (section) => {
    if (!appointment?.AppointmentId) {
      alert("Không tìm thấy ID buổi hẹn để lưu!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        appointmentId: appointment.AppointmentId,
        title: title || `Treatment Note - KH${appointment.CustomerId}`,
        content: content || DEFAULT_SUMMARY,
        noteType: appointment.NoteType || "General Notes",
        productsUsed: productsUsed || DEFAULT_PRODUCTS,
        skinCondition: skinCondition || DEFAULT_SKIN,
        technique: technique || DEFAULT_TECH,
        customerFeedback: customerFeedback || DEFAULT_FEEDBACK,
        recommendation: recommendation || DEFAULT_REC,
        personalNotes: personalNotes || DEFAULT_PERSONAL,
        specialNotice: specialNotice || DEFAULT_SPECIAL,
        progressStatus,
        followUpDate: followUpDate || null,
      };

      await axiosClient.post("/technician/treatment-notes", payload);
      triggerToast("✓ Đã cập nhật phần ghi chú thành công!");
      await loadData();
      setEditingSections(prev => ({ ...prev, [section]: false }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Lưu thất bại!");
    } finally {
      setSaving(false);
    }
  };

  // Filter attachments based on tabs
  const photosList = useMemo(() => {
    return uploadedAttachments.filter((att) => 
      String(att.FileType).startsWith("image/") || String(att.AttachmentType).toUpperCase() === "PHOTO"
    );
  }, [uploadedAttachments]);

  const docAttachments = useMemo(() => {
    return uploadedAttachments.filter((att) => 
      !String(att.FileType).startsWith("image/") && String(att.AttachmentType).toUpperCase() !== "PHOTO"
    );
  }, [uploadedAttachments]);

  // Set default favorite service if none is fetched
  const displayFavService = customerStats.FavoriteService || "Nail Art, Chăm sóc móng";

  return (
    <TechnicianLayout>
      <div className="treatment-notes-container">
        
        {/* Back Link */}
        <div className="tn-back-link" onClick={() => navigate("/technician/customers")}>
          <span>←</span> Quay lại danh sách khách hàng
        </div>

        {/* Toast Notification popup */}
        {showToast && (
          <div style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: "#0d1e15",
            color: "#ebdcc5",
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 10000,
            fontWeight: "700",
            border: "1px solid #ebdcc5",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}>
            <span>✨</span> {toastMessage}
          </div>
        )}

        {/* Header Block */}
        <header className="tn-header">
          <div>
            <h1 className="tn-header-title">
              Treatment Note 📝
            </h1>
            <p className="tn-header-subtitle">
              Thông tin chi tiết và lịch sử chăm sóc của khách hàng
            </p>
          </div>

          {!loading && appointment && (
            <div className="tn-actions">
              <button className="tn-btn" onClick={() => setIsEditing(!isEditing)}>
                ✏️ {isEditing ? "Hủy chỉnh sửa" : "Chỉnh sửa"}
              </button>
              
              <button className="tn-btn" onClick={() => window.print()}>
                🖨️ In / Xuất PDF
              </button>

              <button className="tn-btn tn-btn-primary" onClick={() => setShowNewNoteModal(true)}>

                ＋ Tạo ghi chú mới
              </button>

              <button className="tn-btn tn-btn-icon-only">
                •••
              </button>
            </div>
          )}
        </header>

        {/* Quick select dropdown (only shown if not in edit mode) */}
        {!loading && !isEditing && (
          <div style={{
            display: "flex", 
            gap: "12px", 
            alignItems: "center", 
            backgroundColor: "#f7f5f0", 
            padding: "12px 18px", 
            borderRadius: "12px", 
            border: "1px solid #ebdcc5", 
            marginBottom: "20px"
          }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1a3322" }}>
              📅 Chọn lịch hẹn / khách hàng khác:
            </span>
            <select
              value={appointmentId || appointment?.AppointmentId || ""}
              onChange={(e) => navigate(`/technician/treatment-notes?appointmentId=${e.target.value}`)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ebdcc5",
                backgroundColor: "#ffffff",
                fontSize: "0.85rem",
                color: "#0d1e15",
                fontWeight: "700",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">-- Chọn ca làm việc để xem / tạo ghi chú --</option>
              {allAppointments.map((app) => (
                <option key={app.AppointmentId} value={app.AppointmentId}>
                  {formatDate(app.AppointmentDate)} - {app.CustomerName} ({app.ServiceName}) [{app.Status}]
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="treatment-error" style={{ marginBottom: "20px" }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#718096" }}>
            <span style={{ fontSize: "2rem" }}>🌀</span>
            <p style={{ marginTop: "12px", fontWeight: "700" }}>Đang tải thông tin hồ sơ trị liệu...</p>
          </div>
        ) : !appointment ? (
          <div className="tn-card" style={{ textAlign: "center", padding: "60px 20px" }}>
            <span style={{ fontSize: "3rem" }}>📭</span>
            <h3 style={{ color: "#0d1e15", marginTop: "16px" }}>Chưa chọn lịch hẹn</h3>
            <p style={{ color: "#718096" }}>Vui lòng chọn một lịch hẹn từ danh sách bên trên để bắt đầu.</p>
            <button className="tn-btn tn-btn-primary" style={{ marginTop: "16px" }} onClick={() => setShowNewNoteModal(true)}>
              ＋ Tạo ghi chú mới
            </button>
          </div>
        ) : (
          <>
            {/* 1. Customer Profile Card */}
            <div className="tn-profile-card">
              <div className="tn-profile-left">
                <img 
                  className="tn-profile-avatar" 
                  src={getAvatar(appointment.AvatarUrl)} 
                  alt={appointment.CustomerName}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }}
                />
                <div>
                  <div className="tn-profile-name-row">
                    <h2 className="tn-profile-name">{appointment.CustomerName}</h2>
                    <span className="tn-vip-star">★</span>
                  </div>
                  <p className="tn-profile-meta">
                    {appointment.CustomerCode || `KH${String(appointment.CustomerId).padStart(4, "0")}`} • {appointment.Gender || "Nữ"}
                  </p>
                  <div className="tn-profile-contact-row">
                    <div className="tn-profile-contact-item">
                      <span>📞</span> {appointment.Phone || "0901 234 567"}
                    </div>
                    <div className="tn-profile-contact-item">
                      <span>✉️</span> {appointment.Email || "thanhmai@gmail.com"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="tn-profile-right-grid">
                <div className="tn-profile-stat-col">
                  <span className="tn-profile-stat-label">📅 Thông tin ca hẹn</span>
                  <span className="tn-profile-stat-val">
                    {formatDate(appointment.AppointmentDate)} - {appointment.StartTime || "10:30"}
                  </span>
                  <span className={`tn-profile-stat-badge ${
                    ["COMPLETED", "PAID"].includes(String(appointment.Status).toUpperCase()) ? "tn-badge-success" : 
                    ["IN_PROGRESS", "CHECKED_IN"].includes(String(appointment.Status).toUpperCase()) ? "tn-badge-warning" : "tn-badge-info"
                  }`} style={{
                    backgroundColor: ["COMPLETED", "PAID"].includes(String(appointment.Status).toUpperCase()) ? "#e6f4ea" : 
                                    ["IN_PROGRESS", "CHECKED_IN"].includes(String(appointment.Status).toUpperCase()) ? "#fef7e0" : "#edf2f7",
                    color: ["COMPLETED", "PAID"].includes(String(appointment.Status).toUpperCase()) ? "#137333" : 
                           ["IN_PROGRESS", "CHECKED_IN"].includes(String(appointment.Status).toUpperCase()) ? "#b06000" : "#4a5568",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    display: "inline-block",
                    marginTop: "4px"
                  }}>
                    {String(appointment.Status).toUpperCase() === "PENDING" && "Chờ duyệt"}
                    {String(appointment.Status).toUpperCase() === "CONFIRMED" && "Đã xác nhận"}
                    {String(appointment.Status).toUpperCase() === "CHECKED_IN" && "Đã check-in"}
                    {String(appointment.Status).toUpperCase() === "IN_PROGRESS" && "Đang thực hiện"}
                    {String(appointment.Status).toUpperCase() === "COMPLETED" && "Đã hoàn thành"}
                    {String(appointment.Status).toUpperCase() === "PAID" && "Đã thanh toán"}
                    {String(appointment.Status).toUpperCase() === "CANCELLED" && "Đã hủy"}
                    {!["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "PAID", "CANCELLED"].includes(String(appointment.Status).toUpperCase()) && appointment.Status}
                  </span>
                </div>
                
                <div className="tn-profile-stat-col">
                  <span className="tn-profile-stat-label">💅 Dịch vụ thực hiện</span>
                  <span className="tn-profile-stat-val" style={{ color: "#b76e79", fontWeight: "bold" }}>
                    {appointment.ServiceName || "Chưa phân dịch vụ"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
                    Thời lượng: {appointment.DurationMinutes || 60} phút
                  </span>
                </div>

                <div className="tn-profile-stat-col">
                  <span className="tn-profile-stat-label">👤 Kỹ thuật viên phụ trách</span>
                  <div className="tn-profile-ktv-row">
                    <img 
                      className="tn-profile-ktv-thumb" 
                      src={resolveFileUrl(appointment.EmployeeAvatar) || DEFAULT_AVATAR} 
                      alt={appointment.EmployeeName || "KTV"} 
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }} 
                    />
                    <span className="tn-profile-stat-val">{appointment.EmployeeName || "Linh Chi"}</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "700" }}>KTV chính</span>
                </div>

                <div className="tn-profile-stat-col">
                  <span className="tn-profile-stat-label">🏃 Lần phục vụ</span>
                  <span className="tn-profile-stat-val">Lần thứ {customerStats.TotalVisits}</span>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "700" }}>Tổng: {customerStats.TotalVisits} lần</span>
                </div>

                <div className="tn-profile-stat-col">
                  <span className="tn-profile-stat-label">🆔 Mã ghi chú</span>
                  <span className="tn-profile-stat-val">
                    {appointment.NoteId ? `TN-${new Date(appointment.NoteCreatedAt || Date.now()).getFullYear()}-${String(appointment.NoteId).padStart(5, "0")}` : "Chưa tạo"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#a0aec0", fontWeight: "700" }}>
                    Tạo: {appointment.NoteCreatedAt ? formatDate(appointment.NoteCreatedAt) : formatDate(appointment.AppointmentDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Stats Summary Row */}
            <div className="tn-stats-row">
              <div className="tn-stat-card tn-stat-spend">
                <div className="tn-stat-info">
                  <span className="tn-stat-label">Tổng chi tiêu</span>
                  <span className="tn-stat-val">{formatCurrency(customerStats.TotalSpent)}</span>
                  <span className="tn-stat-desc tn-stat-desc-positive">📈 +15.5% so với lần trước</span>
                </div>
                <div className="tn-stat-icon-wrap">💳</div>
              </div>

              <div className="tn-stat-card tn-stat-visits">
                <div className="tn-stat-info">
                  <span className="tn-stat-label">Số lần ghé thăm</span>
                  <span className="tn-stat-val">{customerStats.TotalVisits} lần</span>
                  <span className="tn-stat-desc">Trong 3 tháng</span>
                </div>
                <div className="tn-stat-icon-wrap">🏪</div>
              </div>

              <div className="tn-stat-card tn-stat-points">
                <div className="tn-stat-info">
                  <span className="tn-stat-label">Điểm tích lũy</span>
                  <span className="tn-stat-val">{customerStats.LoyaltyPoints} điểm</span>
                  <span className="tn-stat-desc">Hạng Bạc</span>
                </div>
                <div className="tn-stat-icon-wrap">💎</div>
              </div>

              <div className="tn-stat-card tn-stat-rating">
                <div className="tn-stat-info">
                  <span className="tn-stat-label">Đánh giá trung bình</span>
                  <span className="tn-stat-val">{Number(customerStats.AverageRating).toFixed(1)}</span>
                  <span className="tn-stat-desc" style={{ color: "#ecc94b" }}>
                    {"★".repeat(Math.round(customerStats.AverageRating)) || "★★★★★"}
                  </span>
                </div>
                <div className="tn-stat-icon-wrap">⭐</div>
              </div>

              <div className="tn-stat-card tn-stat-status">
                <div className="tn-stat-info">
                  <span className="tn-stat-label">Tình trạng khách hàng</span>
                  <span className="tn-stat-val" style={{ fontSize: "1rem", color: "#276749" }}>
                    Khách hàng trung thành
                  </span>
                  <span className="tn-stat-desc">Độ tin cậy cao</span>
                </div>
                <div className="tn-stat-icon-wrap">👑</div>
              </div>
            </div>

            {/* 3. Columns Split */}
            <div className="tn-main-content">
              
              {/* Left Column */}
              <aside className="tn-left-col">
                
                {/* Active Package info */}
                <div className="tn-card tn-plan-card">
                  <h3 className="tn-card-title">
                    <span>📋 Thông tin liệu trình</span>
                    {activePackage && (
                      isPlanEditing ? (
                        <div className="tn-inline-edit-actions">
                          <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("plan")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                          <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("plan")} style={{ color: "#e53e3e" }}>✗</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span className="tn-dot-badge">Đang duy trì</span>
                          <button className="tn-edit-icon-btn" onClick={() => enterEditField(null, "plan")}>✏️</button>
                        </div>
                      )
                    )}
                  </h3>
                  {!activePackage ? (
                    <div style={{ textAlign: "center", padding: "30px 15px", color: "#718096", fontStyle: "italic", fontSize: "0.85rem", lineHeight: "1.6" }}>
                      Chưa đăng ký gói liệu trình.<br />
                      <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>(Khách đặt dịch vụ đơn lẻ)</span>
                    </div>
                  ) : (
                    <div className="tn-plan-list">
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Tên liệu trình</span>
                        <span className="tn-plan-value">{activePackage.PackageName}</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Loại liệu trình</span>
                        <span className="tn-plan-value">{activePackage.CategoryName}</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Mục tiêu</span>
                        <span className="tn-plan-value">{activePackage.PackageDescription || "Móng đẹp, bền màu, không bong tróc"}</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Trạng thái</span>
                        <span className="tn-plan-value">
                          <select 
                            className="tn-select-input"
                            disabled={!isPlanEditing}
                            value={progressStatus}
                            onChange={(e) => setProgressStatus(e.target.value)}
                            style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto" }}
                          >
                            <option value="IN_PROGRESS">Đang duy trì</option>
                            <option value="COMPLETED">Hoàn thành</option>
                            <option value="FOLLOW_UP_REQUIRED">Cần tái khám</option>
                          </select>
                        </span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Ngày bắt đầu</span>
                        <span className="tn-plan-value">{formatDate(activePackage.StartDate)}</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Dự kiến kết thúc</span>
                        <span className="tn-plan-value">{formatDate(activePackage.EndDate)}</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Chu kỳ</span>
                        <span className="tn-plan-value">3-4 tuần / lần</span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">Số lần đã thực hiện</span>
                        <span className="tn-plan-value" style={{ fontWeight: "900", color: "#2f593a" }}>
                          {activePackage.UsedSessions} / {activePackage.TotalSessions} lần
                        </span>
                      </div>
                      <div className="tn-plan-row">
                        <span className="tn-plan-label">KTV phụ trách</span>
                        <div className="tn-profile-ktv-row">
                          <img 
                            className="tn-profile-ktv-thumb" 
                            src={resolveFileUrl(appointment?.EmployeeAvatar) || DEFAULT_AVATAR} 
                            alt={appointment?.EmployeeName || "KTV"} 
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }} 
                          />
                          <span className="tn-plan-value">{appointment?.EmployeeName || "Linh Chi"}</span>
                        </div>
                      </div>
                      <div className="tn-plan-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                        <span className="tn-plan-label">Ghi chú chung</span>
                        <span className="tn-plan-value" style={{ textAlign: "left", fontSize: "0.8rem", color: "#718096" }}>
                          Da tay nhạy cảm, cần sử dụng sản phẩm dịu nhẹ.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Treatment Sessions Timeline */}
                <div className="tn-card tn-timeline-card">
                  <h3 className="tn-card-title">
                    <span>🕒 Lịch sử liệu trình</span>
                  </h3>
                  <div className="tn-timeline">
                    {displayedHistory.length === 0 ? (
                      <p style={{ fontStyle: "italic", color: "#a0aec0", fontSize: "0.8rem", margin: 0 }}>Chưa ghi nhận lịch sử ca trị liệu</p>
                    ) : (
                      displayedHistory.map((item, index) => {
                        const isCompleted = ["COMPLETED", "PAID"].includes(String(item.Status).toUpperCase());
                        const absoluteIndex = treatmentHistory.length - treatmentHistory.indexOf(item);
                        return (
                          <div className="tn-timeline-item" key={item.AppointmentId || index}>
                            <div className={`tn-timeline-node ${isCompleted ? "completed" : ""}`} />
                            <div className="tn-timeline-content">
                              <div className="tn-timeline-info">
                                <span className="tn-timeline-date">{formatDate(item.AppointmentDate)}</span>
                                <span className="tn-timeline-label">
                                  Lần {absoluteIndex} - {item.ServiceName || "Nail Art"}
                                </span>
                              </div>
                              <span className={`tn-timeline-badge ${isCompleted ? "tn-badge-success" : ""}`} style={{
                                backgroundColor: isCompleted ? "#e6f4ea" : "#edf2f7",
                                color: isCompleted ? "#137333" : "#4a5568",
                              }}>
                                {isCompleted ? "Đã hoàn thành" : "Chưa thực hiện"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {treatmentHistory.length > 0 && (
                    <button className="tn-view-more-btn" onClick={() => setShowAllTimeline(!showAllTimeline)}>
                      {showAllTimeline ? "Thu gọn lịch sử" : `Xem tất cả lịch sử (${treatmentHistory.length} lần)`}
                    </button>
                  )}
                </div>



              </aside>

              {/* Right Column */}
              <main className="tn-right-col">
                
                {/* Tabs selection bar */}
                <div className="tn-tabs-bar">
                  <button className={`tn-tab-btn ${activeTab === "notes" ? "active" : ""}`} onClick={() => setActiveTab("notes")}>
                    📝 Ghi chú điều trị
                  </button>
                  <button className={`tn-tab-btn ${activeTab === "photos" ? "active" : ""}`} onClick={() => setActiveTab("photos")}>
                    🖼️ Hình ảnh trước/sau
                  </button>
                  <button className={`tn-tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
                    🕒 Lịch sử điều trị
                  </button>
                </div>

                {/* Tab Content: Treatment Notes */}
                {activeTab === "notes" && (
                  <>
                    {/* Treatment Summary */}
                    <div className="tn-summary-card">
                      <div className="tn-summary-icon">📋</div>
                      <div className="tn-summary-text-wrap" style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <h4 className="tn-summary-title" style={{ margin: 0 }}>Tóm tắt điều trị</h4>
                          {isSummaryEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("summary")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("summary")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(contentRef, "summary")}>✏️</button>
                          )}
                        </div>
                        {isSummaryEditing ? (
                          <textarea
                            ref={contentRef}
                            className="tn-textarea-input"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Mô tả tóm tắt trạng thái và phác đồ điều trị buổi hôm nay..."
                            rows={3}
                            style={{ marginTop: "8px", width: "100%" }}
                          />
                        ) : (
                          <p className="tn-summary-desc" style={{ marginTop: "4px" }}>
                            {content}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 2x2 Grid details */}
                    <div className="tn-grid">
                      
                      {/* Grid Card 1: Pre-treatment */}
                      <div className="tn-grid-card tn-pre-condition">
                        <div className="tn-grid-header">
                          <span className="tn-grid-title">
                            <span className="tn-grid-icon-wrap">🧪</span> Tình trạng trước điều trị
                          </span>
                          {isPreEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("preCondition")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("preCondition")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(skinRef, "preCondition")}>✏️</button>
                          )}
                        </div>
                        {isPreEditing ? (
                          <textarea
                            ref={skinRef}
                            className="tn-textarea-input"
                            value={skinCondition}
                            onChange={(e) => setSkinCondition(e.target.value)}
                            placeholder="Mỗi dòng là một đặc điểm tình trạng..."
                            rows={4}
                          />
                        ) : (
                          <ul className="tn-bullet-list">
                            {(skinCondition || "").split("\n").map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        )}
                      </div>

                      {/* Grid Card 2: Procedure */}
                      <div className="tn-grid-card tn-procedure">
                        <div className="tn-grid-header">
                          <span className="tn-grid-title">
                            <span className="tn-grid-icon-wrap">⚙️</span> Quy trình thực hiện
                          </span>
                          {isProcedureEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("procedure")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("procedure")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(techRef, "procedure")}>✏️</button>
                          )}
                        </div>
                        {isProcedureEditing ? (
                          <textarea
                            ref={techRef}
                            className="tn-textarea-input"
                            value={technique}
                            onChange={(e) => setTechnique(e.target.value)}
                            placeholder="Mỗi dòng là một bước thực hiện quy trình..."
                            rows={4}
                          />
                        ) : (
                          <ul className="tn-bullet-list">
                            {(technique || "").split("\n").map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        )}
                      </div>

                      {/* Grid Card 3: Post-treatment */}
                      <div className="tn-grid-card tn-post-condition">
                        <div className="tn-grid-header">
                          <span className="tn-grid-title">
                            <span className="tn-grid-icon-wrap">💖</span> Tình trạng sau điều trị
                          </span>
                          {isPostEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("postCondition")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("postCondition")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(feedbackRef, "postCondition")}>✏️</button>
                          )}
                        </div>
                        {isPostEditing ? (
                          <textarea
                            ref={feedbackRef}
                            className="tn-textarea-input"
                            value={customerFeedback}
                            onChange={(e) => setCustomerFeedback(e.target.value)}
                            placeholder="Mỗi dòng là một đặc điểm sau điều trị..."
                            rows={4}
                          />
                        ) : (
                          <ul className="tn-bullet-list">
                            {(customerFeedback || "").split("\n").map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        )}
                      </div>

                      {/* Grid Card 4: Recommendations */}
                      <div className="tn-grid-card tn-recommendations">
                        <div className="tn-grid-header">
                          <span className="tn-grid-title">
                            <span className="tn-grid-icon-wrap">💡</span> Khuyến nghị & hướng dẫn
                          </span>
                          {isRecEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("recommendations")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("recommendations")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(recRef, "recommendations")}>✏️</button>
                          )}
                        </div>
                        {isRecEditing ? (
                          <textarea
                            ref={recRef}
                            className="tn-textarea-input"
                            value={recommendation}
                            onChange={(e) => setRecommendation(e.target.value)}
                            placeholder="Mỗi dòng là một khuyến nghị chăm sóc..."
                            rows={4}
                          />
                        ) : (
                          <ul className="tn-bullet-list">
                            {(recommendation || "").split("\n").map((line, i) => <li key={i}>{line}</li>)}
                          </ul>
                        )}
                      </div>

                    </div>

                    {/* Personal Notes Card */}
                    <div className="tn-note-card tn-note-personal">
                      <div className="tn-note-text-wrap" style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <div className="tn-note-label">Ghi chú cá nhân</div>
                          {isPersonalEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("personalNotes")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("personalNotes")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(personalRef, "personalNotes")}>✏️</button>
                          )}
                        </div>
                        {isPersonalEditing ? (
                          <textarea
                            ref={personalRef}
                            className="tn-textarea-input"
                            value={personalNotes}
                            onChange={(e) => setPersonalNotes(e.target.value)}
                            placeholder="Sở thích khách hàng, thói quen làm đẹp..."
                            rows={2}
                            style={{ marginTop: "8px" }}
                          />
                        ) : (
                          <p className="tn-note-desc" style={{ marginTop: "4px" }}>
                            {personalNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Special Notice Card */}
                    <div className="tn-note-card tn-note-special">
                      <div className="tn-note-text-wrap" style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <div className="tn-note-label">Lưu ý đặc biệt</div>
                          {isSpecialEditing ? (
                            <div className="tn-inline-edit-actions">
                              <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("specialNotice")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                              <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("specialNotice")} style={{ color: "#e53e3e" }}>✗</button>
                            </div>
                          ) : (
                            <button className="tn-edit-icon-btn" onClick={() => enterEditField(specialRef, "specialNotice")}>✏️</button>
                          )}
                        </div>
                        {isSpecialEditing ? (
                          <textarea
                            ref={specialRef}
                            className="tn-textarea-input"
                            value={specialNotice}
                            onChange={(e) => setSpecialNotice(e.target.value)}
                            placeholder="Dị ứng mỹ phẩm, lưu ý về da..."
                            rows={2}
                            style={{ marginTop: "8px" }}
                          />
                        ) : (
                          <p className="tn-note-desc" style={{ marginTop: "4px" }}>
                            {specialNotice}
                          </p>
                        )}
                      </div>
                      <span className="tn-note-icon">🔔</span>
                    </div>

                    {/* Follow-up & Next Appointment Card */}
                    <div className="tn-follow-up-card">
                      <div className="tn-follow-up-grid">
                        <div className="tn-follow-up-col">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <span className="tn-follow-up-label">Ngày hẹn tiếp theo</span>
                            {isFollowUpEditing ? (
                              <div className="tn-inline-edit-actions" style={{ display: "inline-flex" }}>
                                <button className="tn-edit-icon-btn" onClick={() => handleSaveSection("followUp")} style={{ color: "#38a169", marginRight: "8px" }}>✓</button>
                                <button className="tn-edit-icon-btn" onClick={() => handleCancelSection("followUp")} style={{ color: "#e53e3e" }}>✗</button>
                              </div>
                            ) : (
                              <button className="tn-edit-icon-btn" onClick={() => enterEditField(null, "followUp")}>✏️</button>
                            )}
                          </div>
                          <span className="tn-follow-up-val">
                            {isFollowUpEditing ? (
                              <input 
                                type="date" 
                                className="tn-input-text" 
                                value={followUpDate} 
                                onChange={(e) => setFollowUpDate(e.target.value)} 
                              />
                            ) : (
                              followUpDate ? formatDate(followUpDate) : "N/A"
                            )}
                          </span>
                        </div>

                        <div className="tn-follow-up-col">
                          <span className="tn-follow-up-label">Dịch vụ dự kiến</span>
                          <span className="tn-follow-up-val">Chăm sóc định kỳ</span>
                        </div>

                        <div className="tn-follow-up-col">
                          <span className="tn-follow-up-label">Kỹ thuật viên</span>
                          <div className="tn-follow-up-ktv">
                            <img 
                              className="tn-follow-up-ktv-thumb" 
                              src={resolveFileUrl(appointment.EmployeeAvatar) || DEFAULT_AVATAR} 
                              alt={appointment.EmployeeName || "KTV"} 
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }} 
                            />
                            <span className="tn-follow-up-val">{appointment.EmployeeName || "Linh Chi"}</span>
                          </div>
                        </div>
                      </div>

                      {!isFollowUpEditing && (
                        <button className="tn-btn tn-btn-primary" onClick={() => {
                          setBookingDate(followUpDate || new Date().toISOString().slice(0, 10));
                          setShowFollowUpModal(true);
                        }}>
                          📅 Tạo lịch hẹn
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Tab Content: Before/After Photos & Attachments */}
                {activeTab === "photos" && (
                  <div className="tn-card">
                    <h3 className="tn-card-title">🖼️ Hình ảnh trước / sau ca trị liệu</h3>
                    
                    {/* Image uploads dropzone */}
                    <label className="tn-dropzone">
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        hidden 
                        onChange={(e) => handleDirectFileUpload(e.target.files)} 
                      />
                      <span>☁</span>
                      <b>Tải ảnh lên thư viện trước/sau</b>
                      <p>Kéo thả hoặc nhấp để chọn tệp hình ảnh</p>
                      <small>Hỗ trợ JPG, PNG, WEBP lên tới 5MB</small>
                    </label>

                    {/* Gallery items */}
                    <div className="tn-gallery" style={{ marginBottom: "30px" }}>
                      {photosList.length === 0 ? (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "20px", color: "#a0aec0", fontStyle: "italic" }}>
                          Chưa tải lên ảnh trước/sau nào cho ca điều trị này.
                        </div>
                      ) : (
                        photosList.map((photo, index) => (
                          <div className="tn-gallery-item" key={photo.AttachmentId || index}>
                            <img className="tn-gallery-img" src={resolveFileUrl(photo.FileUrl)} alt={photo.FileName} />
                            <div className="tn-gallery-info">
                              {photo.FileName.slice(0, 20)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <hr style={{ border: "0", borderTop: "1px solid #f2ebdd", margin: "24px 0" }} />

                    {/* Document Attachments Section */}
                    <h3 className="tn-card-title">📎 Tài liệu & Tệp đính kèm liên quan</h3>
                    
                    <label className="tn-dropzone">
                      <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.doc,.docx" 
                        hidden 
                        onChange={(e) => handleDirectFileUpload(e.target.files)} 
                      />
                      <span>☁</span>
                      <b>Tải tài liệu đính kèm lên</b>
                      <p>Tải lên hồ sơ da liễu, PDF kết quả xét nghiệm, bệnh lý...</p>
                      <small>PDF, DOC, DOCX lên tới 5MB</small>
                    </label>

                    <div className="tn-attachment-list" style={{ marginTop: "16px" }}>
                      {docAttachments.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "#a0aec0", fontStyle: "italic" }}>
                          Chưa có tài liệu đính kèm nào được tải lên.
                        </div>
                      ) : (
                        docAttachments.map((att) => (
                          <div className="tn-attachment-item" key={att.AttachmentId}>
                            <a className="tn-attachment-link" href={resolveFileUrl(att.FileUrl)} target="_blank" rel="noreferrer">
                              📄 {att.FileName}
                            </a>
                            <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
                              {formatDateTime(att.UploadedAt)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Content: History list */}
                {activeTab === "history" && (
                  <div className="tn-card">
                    <h3 className="tn-card-title">🕒 Lịch sử các buổi ghi chú trước đó</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {previousNotes.length === 0 ? (
                        <p style={{ fontStyle: "italic", color: "#a0aec0", textAlign: "center", padding: "20px" }}>
                          Không có buổi ghi chú điều trị cũ nào khác cho khách hàng này.
                        </p>
                      ) : (
                        previousNotes.map((note) => (
                          <div key={note.NoteId} style={{ border: "1px solid #ebdcc5", borderRadius: "12px", padding: "16px", backgroundColor: "#fcfaf7" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                              <strong style={{ color: "#0d1e15" }}>{formatDate(note.AppointmentDate)}</strong>
                              <span style={{ fontSize: "0.8rem", color: "#718096" }}>Loại: {note.NoteType}</span>
                            </div>
                            <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#4a5568", whiteSpace: "pre-line" }}>
                              {note.Content}
                            </p>
                            <button className="tn-btn" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => {
                              setContent(note.Content);
                              triggerToast("📋 Đã sao chép nội dung ghi chú cũ vào khung nhập liệu!");
                              setActiveTab("notes");
                            }}>
                              Sao chép nội dung ghi chú này
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </main>
            </div>

            {/* 4. Global Edit Toolbar */}
            {isEditing && (
              <div className="tn-edit-toolbar">
                <span className="tn-edit-toolbar-text">
                  ✏️ Bạn đang ở chế độ chỉnh sửa Ghi chú điều trị...
                </span>
                <button className="tn-btn" onClick={() => setIsEditing(false)}>
                  Hủy bỏ
                </button>
                <button className="tn-btn tn-btn-primary" onClick={handleSaveNote} disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu lại ✓"}
                </button>
              </div>
            )}

            {/* 5. Footer Info */}
            <footer className="tn-footer">
              <div className="tn-footer-creator">
                <span>Tạo bởi:</span>
                <div className="tn-footer-user">
                  <img 
                    src={resolveFileUrl(appointment.EmployeeAvatar) || DEFAULT_AVATAR} 
                    alt={appointment.EmployeeName || "KTV"} 
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATAR; }} 
                  />
                  <span>{appointment.EmployeeName || "Linh Chi"}</span>
                </div>
                <span>|</span>
                <span>Ngày tạo: {appointment.NoteCreatedAt ? formatDateTime(appointment.NoteCreatedAt) : formatDateTime(appointment.AppointmentDate)}</span>
                <span>|</span>
                <span>Cập nhật lần cuối: {appointment.UpdatedAt ? formatDateTime(appointment.UpdatedAt) : formatDateTime(appointment.NoteCreatedAt || appointment.AppointmentDate)}</span>
              </div>

              <div className="tn-saved-badge">
                <span>✓</span> Đã lưu
              </div>
            </footer>
          </>
        )}

        {/* --- MODAL: CREATE FOLLOW-UP APPOINTMENT --- */}
        {showFollowUpModal && (
          <div className="tn-modal-overlay">
            <div className="tn-modal">
              <div className="tn-modal-header">
                <h3 className="tn-modal-title">📅 Đặt lịch tái khám tiếp theo</h3>
                <button className="tn-modal-close" onClick={() => setShowFollowUpModal(false)}>×</button>
              </div>
              <div className="tn-modal-body">
                <div className="tn-form-grid">
                  
                  <div className="tn-form-group">
                    <label>Khách hàng</label>
                    <input type="text" className="tn-input-text" value={appointment?.CustomerName || ""} readOnly style={{ backgroundColor: "#f7fafc" }} />
                  </div>

                  <div className="tn-form-group">
                    <label>Kỹ thuật viên thực hiện</label>
                    <input 
                      type="text" 
                      className="tn-input-text" 
                      value={`${appointment?.EmployeeName || "Linh Chi"} (KTV chính)`} 
                      readOnly 
                      style={{ backgroundColor: "#f7fafc" }} 
                    />
                  </div>

                  <div className="tn-form-row">
                    <div className="tn-form-group">
                      <label>Chọn ngày hẹn tái khám</label>
                      <input type="date" className="tn-input-text" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                    </div>

                    <div className="tn-form-group">
                      <label>Chọn giờ bắt đầu</label>
                      <select className="tn-select-input" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)}>
                        <option value="08:00">08:00 AM</option>
                        <option value="09:00">09:00 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="13:00">01:00 PM</option>
                        <option value="14:00">02:00 PM</option>
                        <option value="15:00">03:00 PM</option>
                        <option value="16:00">04:00 PM</option>
                        <option value="17:00">05:00 PM</option>
                        <option value="18:00">06:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="tn-form-group">
                    <label>Chọn dịch vụ làm đẹp tái khám</label>
                    <select className="tn-select-input" value={bookingServiceId} onChange={(e) => setBookingServiceId(e.target.value)}>
                      <option value="">-- Chọn dịch vụ --</option>
                      {servicesList.map((s) => (
                        <option key={s.ServiceId} value={s.ServiceId}>
                          {s.ServiceName} ({formatCurrency(s.Price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tn-form-group">
                    <label>Ghi chú đặt lịch</label>
                    <textarea className="tn-textarea-input" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} placeholder="Dặn dò thêm cho buổi hẹn tiếp theo..." rows={2} />
                  </div>

                </div>
              </div>
              <div className="tn-modal-footer">
                <button className="tn-btn" onClick={() => setShowFollowUpModal(false)}>Hủy</button>
                <button className="tn-btn tn-btn-primary" onClick={handleBookFollowUp} disabled={bookingLoading}>
                  {bookingLoading ? "Đang đặt..." : "Xác nhận đặt lịch 📅"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL: CREATE NEW TREATMENT NOTE --- */}
        {showNewNoteModal && (
          <div className="tn-modal-overlay">
            <div className="tn-modal" style={{ width: "600px" }}>
              <div className="tn-modal-header">
                <h3 className="tn-modal-title">＋ Tạo ghi chú điều trị mới</h3>
                <button className="tn-modal-close" onClick={() => setShowNewNoteModal(false)}>×</button>
              </div>
              <div className="tn-modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <p style={{ fontSize: "0.85rem", color: "#718096", margin: "0 0 16px 0" }}>
                  Dưới đây là danh sách các ca lịch hẹn của bạn hôm nay / gần đây đã hoàn thành hoặc đang tiến hành mà chưa có ghi chú điều trị. Chọn một ca để tạo ghi chú mới.
                </p>

                {noNoteAppointments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#a0aec0", fontStyle: "italic" }}>
                    Không tìm thấy ca làm việc trống nào chưa có ghi chú!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {noNoteAppointments.map((app) => (
                      <div 
                        key={app.AppointmentId} 
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          border: "1px solid #ebdcc5",
                          borderRadius: "10px",
                          backgroundColor: "#fcfaf7"
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "0.85rem", color: "#0d1e15" }}>{app.CustomerName}</strong>
                          <div style={{ fontSize: "0.75rem", color: "#718096", marginTop: "2px" }}>
                            {formatDate(app.AppointmentDate)} • {app.StartTime} • Dịch vụ: {app.ServiceName}
                          </div>
                        </div>
                        <button 
                          className="tn-btn tn-btn-primary" 
                          style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          onClick={() => {
                            setShowNewNoteModal(false);
                            navigate(`/technician/treatment-notes?appointmentId=${app.AppointmentId}`);
                            setIsEditing(true);
                          }}
                        >
                          Tạo ghi chú
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="tn-modal-footer">
                <button className="tn-btn" onClick={() => setShowNewNoteModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </TechnicianLayout>
  );
}
