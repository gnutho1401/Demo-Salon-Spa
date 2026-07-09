import React, { useState, useEffect, useMemo } from "react";
import axiosClient from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

export default function AdminAiCrm() {
  const [loading, setLoading] = useState(true);
  const [crmData, setCrmData] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [selectedCust, setSelectedCust] = useState(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSegment, setActiveSegment] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [executedActions, setExecutedActions] = useState({});

  useEffect(() => {
    fetchCrmData();
    fetchVouchers();
  }, []);

  // Helper to extract recommended voucher discount details
  const recommendedVoucherDetails = useMemo(() => {
    if (!selectedCust || !selectedCust.recommended_action) return null;
    const actionsText = selectedCust.recommended_action.join(" ");
    if (actionsText.includes("20%")) {
      return { discount: 20, text: "giảm 20%" };
    }
    if (actionsText.includes("15%")) {
      return { discount: 15, text: "giảm 15%" };
    }
    if (actionsText.includes("10%")) {
      return { discount: 10, text: "giảm 10%" };
    }
    return null;
  }, [selectedCust]);

  // Synchronize pre-selected voucher based on AI recommendation
  useEffect(() => {
    if (selectedCust && vouchers.length > 0) {
      const details = recommendedVoucherDetails;
      if (details) {
        const matchingVoucher = vouchers.find(
          (v) =>
            v.DiscountType === "PERCENTAGE" &&
            Number(v.DiscountValue) === details.discount
        );
        if (matchingVoucher) {
          setSelectedVoucherId(matchingVoucher.VoucherId);
          return;
        }
      }
      // Fallback: select the first voucher
      setSelectedVoucherId(vouchers[0].VoucherId);
    }
  }, [selectedCust, vouchers, recommendedVoucherDetails]);

  // Synchronize pre-populated client-facing template message with the AI's actual recommended actions list
  useEffect(() => {
    if (selectedCust) {
      const risk = selectedCust.risk_level;
      const favService = (selectedCust.favorite_services && selectedCust.favorite_services.length > 0)
        ? selectedCust.favorite_services[0]
        : null;

      let msg = "";
      if (risk === "HIGH_RISK") {
        msg = `Kính gửi Anh/Chị ${selectedCust.name},\n\nĐã lâu rồi Beauty Salon chưa có cơ hội được đón tiếp và chăm sóc sắc đẹp cho Anh/Chị. Chúng em luôn trân quý sự đồng hành của Anh/Chị và rất mong muốn được cải thiện chất lượng dịch vụ tốt hơn.\n\nĐể bày tỏ lòng tri ân sâu sắc, Beauty Salon xin gửi tặng riêng Anh/Chị:\n💝 01 Voucher ưu đãi giảm giá 20% áp dụng cho toàn bộ dịch vụ.\n🎁 Đặc biệt: Tặng kèm 01 suất Gội đầu thảo dược dưỡng sinh hoặc Massage cổ vai gáy hoàn toàn miễn phí cho lần hẹn tới.\n\nChúng em rất mong được gặp lại Anh/Chị. Anh/Chị có thể đặt lịch hẹn trực tiếp qua website hoặc liên hệ hotline của salon nhé ạ!\n\nTrân trọng,\nBeauty Salon`;
      } else if (risk === "MEDIUM_RISK") {
        const serviceIntro = favService ? ` dịch vụ ${favService} cũng như các` : "";
        msg = `Kính chào Anh/Chị ${selectedCust.name},\n\nĐã một khoảng thời gian kể từ lần cuối Beauty Salon có cơ hội được phục vụ Anh/Chị. Salon rất nhớ bạn và hy vọng bạn vẫn đang có những trải nghiệm tuyệt vời.\n\nĐể hỗ trợ bạn tiếp tục duy trì vẻ đẹp và sự tự tin, chúng em xin gửi tặng ưu đãi đặc biệt:\n🎫 01 Voucher giảm giá 15% cho${serviceIntro} dịch vụ yêu thích tại Salon.\n\nAnh/Chị đặt lịch hẹn ngay hôm nay để nhận thêm nhiều ưu đãi làm đẹp tốt nhất nhé. Rất mong được đón tiếp bạn trở lại!\n\nThân ái,\nBeauty Salon`;
      } else {
        msg = `Xin chào Anh/Chị ${selectedCust.name},\n\nBeauty Salon chân thành cảm ơn sự tin tưởng và yêu mến của Anh/Chị trong suốt thời gian qua. Sự hài lòng của Anh/Chị chính là niềm hạnh phúc lớn nhất của chúng em.\n\nNhư một món quà nhỏ tri ân, Beauty Salon xin gửi tới Anh/Chị:\n🌟 Chương trình tích lũy điểm thưởng gấp đôi cho lần ghé thăm tiếp theo.\n💎 Cơ hội nâng cấp lên thẻ thành viên VIP nhận ưu đãi chiết khấu lâu dài.\n\nHẹn sớm gặp lại Anh/Chị tại Salon để tận hưởng những phút giây thư giãn tuyệt vời nhất!\n\nTrân trọng,\nBeauty Salon`;
      }
      setCustomMessage(msg);
    }
  }, [selectedCust]);

  async function fetchCrmData() {
    try {
      setLoading(true);
      const res = await axiosClient.get("/ai/customers/churn-prediction");
      const data = res.data.data || res.data || {};
      setCrmData(data);
      if (data.customers && data.customers.length > 0) {
        setSelectedCust(data.customers[0]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể tải dữ liệu phân tích CRM", "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchVouchers() {
    try {
      const res = await axiosClient.get("/vouchers");
      const list = res.data.data || res.data || [];
      const activeList = list.filter((v) => v.Status === "ACTIVE");
      setVouchers(activeList);
      if (activeList.length > 0) {
        setSelectedVoucherId(activeList[0].VoucherId);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách voucher:", err);
    }
  }

  function showToast(msg, type = "success") {
    setToast({ show: true, message: msg, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  }

  async function handleSendVoucher() {
    if (!selectedCust || !selectedVoucherId) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-voucher`, {
        voucherId: selectedVoucherId,
      });
      showToast(res.data?.message || "Đã gửi tặng Voucher thành công!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể gửi tặng Voucher", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendReminder() {
    if (!selectedCust || !customMessage.trim()) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-reminder`, {
        message: customMessage,
      });
      showToast(res.data?.message || "Đã gửi nhắc nhở thành công!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể gửi tin nhắn nhắc nhở", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExecuteRecommendedAction(actionStr) {
    if (!selectedCust) return;
    const isVoucher = actionStr.includes("Voucher") || actionStr.includes("voucher");
    const isGift = actionStr.includes("Gội đầu") || actionStr.includes("Massage") || actionStr.includes("Tặng kèm") || actionStr.includes("suất");
    const isUpgrade = actionStr.includes("nâng cấp") || actionStr.includes("VIP");
    const isPoints = actionStr.includes("điểm tích lũy") || actionStr.includes("điểm thưởng") || actionStr.includes("Nhân đôi");
    const isMessage = actionStr.includes("tin nhắn") || actionStr.includes("Zalo/SMS") || actionStr.includes("Gửi tin nhắn");

    try {
      setActionLoading(true);
      if (isVoucher) {
        const details = recommendedVoucherDetails;
        const discountVal = details ? details.discount : 20;
        const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-voucher`, {
          discountPercent: discountVal,
        });
        showToast(res.data?.message || `Đã tặng thành công Voucher giảm giá ${discountVal}% mới!`, "success");
      } else if (isUpgrade) {
        const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/upgrade-vip`);
        showToast(res.data?.message || "Đã đặc cách nâng cấp VIP thành công!", "success");
      } else if (isGift) {
        const giftName = actionStr.includes("Gội đầu") ? "Gội đầu thảo dược dưỡng sinh" : "Massage cổ vai gáy miễn phí";
        const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/gift-free-service`, {
          serviceName: giftName
        });
        showToast(res.data?.message || `Đã tặng quà miễn phí (${giftName})!`, "success");
      } else if (isPoints) {
        const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/add-points`, {
          points: 200
        });
        showToast(res.data?.message || "Đã cộng +200 điểm thưởng tích lũy thành công!", "success");
      } else if (isMessage) {
        const res = await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-reminder`, {
          message: customMessage,
        });
        showToast(res.data?.message || "Đã gửi nhắc nhở chăm sóc thành công!", "success");
      } else {
        showToast("Hành động này không yêu cầu kích hoạt phần mềm.", "info");
      }

      setExecutedActions(prev => ({
        ...prev,
        [`${selectedCust.customer_id}-${actionStr}`]: true
      }));
    } catch (err) {
      showToast(err.response?.data?.message || "Không thể thực hiện hành động này", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExecuteAllActions() {
    if (!selectedCust) return;
    const actions = selectedCust.recommended_action || [];
    setActionLoading(true);
    let successCount = 0;
    
    for (const action of actions) {
      if (executedActions[`${selectedCust.customer_id}-${action}`]) continue;

      const isVoucher = action.includes("Voucher") || action.includes("voucher");
      const isGift = action.includes("Gội đầu") || action.includes("Massage") || action.includes("Tặng kèm") || action.includes("suất");
      const isUpgrade = action.includes("nâng cấp") || action.includes("VIP");
      const isPoints = action.includes("điểm tích lũy") || action.includes("điểm thưởng") || action.includes("Nhân đôi");
      const isMessage = action.includes("tin nhắn") || action.includes("Zalo/SMS") || action.includes("Gửi tin nhắn");

      if (isVoucher || isGift || isUpgrade || isPoints || isMessage) {
        try {
          if (isVoucher) {
            const details = recommendedVoucherDetails;
            const discountVal = details ? details.discount : 20;
            await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-voucher`, {
              discountPercent: discountVal,
            });
          } else if (isUpgrade) {
            await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/upgrade-vip`);
          } else if (isGift) {
            const giftName = action.includes("Gội đầu") ? "Gội đầu thảo dược dưỡng sinh" : "Massage cổ vai gáy miễn phí";
            await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/gift-free-service`, {
              serviceName: giftName
            });
          } else if (isPoints) {
            await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/add-points`, {
              points: 200
            });
          } else if (isMessage) {
            await axiosClient.post(`/ai/customers/${selectedCust.customer_id}/send-reminder`, {
              message: customMessage,
            });
          }
          
          setExecutedActions(prev => ({
            ...prev,
            [`${selectedCust.customer_id}-${action}`]: true
          }));
          successCount++;
        } catch (err) {
          console.error(`Lỗi thực hiện hành động "${action}":`, err.message);
        }
      }
    }
    
    setActionLoading(false);
    if (successCount > 0) {
      showToast(`Đã thực hiện thành công ${successCount} hành động chăm sóc!`, "success");
    } else {
      showToast("Không có hành động mới nào cần thực hiện.", "info");
    }
  }

  // Format currency
  function formatVND(amount) {
    return Number(amount || 0).toLocaleString("vi-VN") + "đ";
  }

  // Filter logic
  const filteredCustomers = useMemo(() => {
    if (!crmData?.customers) return [];
    return crmData.customers.filter((c) => {
      // Search filter
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customer_id.includes(searchQuery);

      if (!matchesSearch) return false;

      // Segment filter
      if (activeSegment === "ALL") return true;
      return c.segments.includes(activeSegment);
    });
  }, [crmData, searchQuery, activeSegment]);

  // Count segments for stats
  const stats = useMemo(() => {
    if (!crmData?.customers) return { total: 0, vip: 0, churn: 0, inactive: 0, package: 0 };
    const list = crmData.customers;
    return {
      total: list.length,
      vip: list.filter((c) => c.segments.includes("Khách VIP")).length,
      churn: list.filter((c) => c.segments.includes("Nguy cơ rời bỏ")).length,
      inactive: list.filter((c) => c.segments.includes("Lâu chưa quay lại")).length,
      package: list.filter((c) => c.segments.includes("Tiềm năng mua gói")).length,
    };
  }, [crmData]);

  return (
    <div style={{ padding: "24px", color: "#1f140e", fontFamily: "sans-serif" }}>
      {/* Toast Alert */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            padding: "16px 24px",
            borderRadius: "12px",
            color: "#fff",
            backgroundColor: toast.type === "success" ? "#2e7d32" : "#c62828",
            boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontWeight: "bold",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {toast.type === "success" ? "✅" : "❌"} {toast.message}
        </div>
      )}

      {/* Header section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          borderBottom: "1px solid #ebdcc5",
          paddingBottom: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "#b45309",
              fontWeight: "700",
            }}
          >
            Hệ thống CRM thông minh kết hợp Trí tuệ Nhân tạo
          </span>
          <h1 style={{ margin: "4px 0", fontSize: "2rem", fontFamily: "Georgia, serif" }}>
            🔮 AI CRM & Churn Predictor
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
            Tự động phân nhóm khách hàng, cảnh báo rủi ro rời dịch vụ và đề xuất chính sách giữ chân phù hợp.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchCrmData}
          style={{
            backgroundColor: "#1b3d2f",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#11261d")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#1b3d2f")}
        >
          🔄 Phân tích lại dữ liệu
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🤖</div>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif" }}>AI CRM đang tính toán...</h3>
          <p style={{ color: "#666", marginTop: "8px" }}>
            Đang phân tích lịch sử giao dịch, tần suất hủy lịch, no-show và thời gian ghé thăm gần nhất...
          </p>
        </div>
      ) : (
        <>
          {/* Stats widgets */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>
                Tổng phân tích
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", marginTop: "4px" }}>
                {stats.total} khách
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>
                Khách VIP ⭐
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#b45309", marginTop: "4px" }}>
                {stats.vip} khách
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>
                Cảnh báo rời bỏ ⚠️
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#c62828", marginTop: "4px" }}>
                {stats.churn} khách
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>
                Lâu chưa quay lại 📅
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#e65100", marginTop: "4px" }}>
                {stats.inactive} khách
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>
                Tiềm năng mua gói 💼
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#2e7d32", marginTop: "4px" }}>
                {stats.package} khách
              </div>
            </div>
          </div>

          {/* AI Global Summary */}
          <div
            style={{
              padding: "16px 24px",
              background: "#fffbf2",
              border: "1px solid #ebdcc5",
              borderRadius: "16px",
              marginBottom: "24px",
              fontSize: "0.95rem",
              lineHeight: "1.5",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "24px" }}>🤖</span>
            <div>
              <strong>Tóm tắt xu hướng từ AI:</strong> {crmData?.summary || "Không có tóm tắt dữ liệu."}
            </div>
          </div>

          {/* Main workspace layout */}
          <div style={{ display: "flex", gap: "24px", height: "70vh", overflow: "hidden" }}>
            {/* Left sidebar list */}
            <div
              style={{
                width: "35%",
                backgroundColor: "#faf8f5",
                border: "1px solid #ebdcc5",
                borderRadius: "20px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Search Box */}
              <div style={{ padding: "16px", borderBottom: "1px solid #ebdcc5", background: "#fcfbf9" }}>
                <input
                  type="text"
                  placeholder="Tìm khách hàng theo tên hoặc mã..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #ebdcc5",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Segment selection filters */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "12px 16px",
                  background: "#f5ece1",
                  borderBottom: "1px solid #ebdcc5",
                }}
              >
                {[
                  ["ALL", "Tất cả"],
                  ["Khách VIP", "VIP"],
                  ["Nguy cơ rời bỏ", "Nguy cơ"],
                  ["Lâu chưa quay lại", "Trễ hẹn"],
                  ["Hay hủy lịch", "Hủy lịch"],
                  ["Tiềm năng mua gói", "Combo"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setActiveSegment(val)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: activeSegment === val ? "#1b3d2f" : "#fff",
                      color: activeSegment === val ? "#fff" : "#1b3d2f",
                      border: "1px solid #ebdcc5",
                      transition: "all 0.2s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Customers list container */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((cust) => {
                    const isSelected = selectedCust?.customer_id === cust.customer_id;
                    const isHighRisk = cust.risk_level === "HIGH_RISK";
                    const isMedRisk = cust.risk_level === "MEDIUM_RISK";

                    return (
                      <div
                        key={cust.customer_id}
                        onClick={() => setSelectedCust(cust)}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          backgroundColor: isSelected ? "#fffbf2" : "#ffffff",
                          border: isSelected ? "2px solid #b45309" : "1.5px solid #ebdcc5",
                          marginBottom: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          boxShadow: isSelected ? "0 4px 12px rgba(180,83,9,0.08)" : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "6px",
                          }}
                        >
                          <strong style={{ fontSize: "0.95rem", color: "#1f140e" }}>{cust.name}</strong>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: "800",
                              padding: "3px 8px",
                              borderRadius: "20px",
                              backgroundColor: isHighRisk ? "#fff0f0" : isMedRisk ? "#fff9f2" : "#f2faf4",
                              color: isHighRisk ? "#c62828" : isMedRisk ? "#b86a00" : "#2e7d32",
                              border: "1px solid",
                              borderColor: isHighRisk
                                ? "rgba(198,40,40,0.15)"
                                : isMedRisk
                                ? "rgba(184,106,0,0.15)"
                                : "rgba(46,125,50,0.15)",
                            }}
                          >
                            {cust.risk_level}
                          </span>
                        </div>

                        {/* Customer dynamic segments pills */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "6px 0" }}>
                          {cust.segments.map((seg, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                fontSize: "0.65rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor:
                                  seg === "Khách VIP"
                                    ? "#fef3c7"
                                    : seg === "Nguy cơ rời bỏ"
                                    ? "#fee2e2"
                                    : seg === "Lâu chưa quay lại"
                                    ? "#ffedd5"
                                    : seg === "Hay hủy lịch"
                                    ? "#f3e8ff"
                                    : seg === "Tiềm năng mua gói"
                                    ? "#dcfce7"
                                    : "#f3f4f6",
                                color:
                                  seg === "Khách VIP"
                                    ? "#92400e"
                                    : seg === "Nguy cơ rời bỏ"
                                    ? "#991b1b"
                                    : seg === "Lâu chưa quay lại"
                                    ? "#9a3412"
                                    : seg === "Hay hủy lịch"
                                    ? "#6b21a8"
                                    : seg === "Tiềm năng mua gói"
                                    ? "#166534"
                                    : "#374151",
                                fontWeight: "bold",
                              }}
                            >
                              {seg}
                            </span>
                          ))}
                        </div>

                        {(cust.phone || cust.email) && (
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", display: "flex", flexDirection: "column", gap: "2px", margin: "6px 0 0 0" }}>
                            {cust.phone && <span>📞 {cust.phone}</span>}
                            {cust.email && <span style={{ wordBreak: "break-all" }}>✉️ {cust.email}</span>}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.8rem",
                            color: "#666",
                            marginTop: "8px",
                          }}
                        >
                          <span>Mã KH: #{cust.customer_id}</span>
                          <strong>Điểm rủi ro: {cust.risk_score}/100</strong>
                        </div>

                        {/* Progress risk bar */}
                        <div
                          style={{
                            width: "100%",
                            height: "5px",
                            backgroundColor: "#f0ece6",
                            borderRadius: "3px",
                            marginTop: "8px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${cust.risk_score}%`,
                              height: "100%",
                              backgroundColor: isHighRisk ? "#c62828" : isMedRisk ? "#ff8c00" : "#2e7d32",
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: "center", padding: "30px", color: "#666", fontSize: "0.9rem" }}>
                    Không tìm thấy khách hàng nào khớp bộ lọc.
                  </div>
                )}
              </div>
            </div>

            {/* Right main details panel */}
            <div
              style={{
                width: "65%",
                backgroundColor: "#fff",
                border: "1px solid #ebdcc5",
                borderRadius: "20px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              {selectedCust ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Title card header */}
                  <div
                    style={{
                      borderBottom: "2px solid #ecd8b8",
                      paddingBottom: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          color: "#b45309",
                          textTransform: "uppercase",
                        }}
                      >
                        Hồ sơ phân tích chi tiết
                      </span>
                      <h2
                        style={{
                          margin: "4px 0",
                          fontFamily: "Georgia, serif",
                          fontSize: "1.6rem",
                          color: "#1b3d2f",
                        }}
                      >
                        {selectedCust.name}
                      </h2>
                      <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
                        ID khách hàng: #{selectedCust.customer_id}
                        {selectedCust.phone ? ` • SĐT: ${selectedCust.phone}` : ""}
                        {selectedCust.email ? ` • Email: ${selectedCust.email}` : ""}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {selectedCust.segments.map((seg, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "0.75rem",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#1b3d2f",
                            color: "#fff",
                            fontWeight: "bold",
                          }}
                        >
                          {seg}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* KPI metric grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px",
                        background: "#faf8f5",
                        border: "1.5px solid #ebdcc5",
                        borderRadius: "12px",
                        textAlign: "center",
                      }}
                    >
                      <small style={{ color: "#666", textTransform: "uppercase", fontSize: "0.7rem" }}>
                        Tổng chi tiêu
                      </small>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "1.1rem",
                          marginTop: "4px",
                          color: "#1b3d2f",
                        }}
                      >
                        {formatVND(selectedCust.total_spent)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "12px",
                        background: "#faf8f5",
                        border: "1.5px solid #ebdcc5",
                        borderRadius: "12px",
                        textAlign: "center",
                      }}
                    >
                      <small style={{ color: "#666", textTransform: "uppercase", fontSize: "0.7rem" }}>
                        Tổng lượt ghé thăm
                      </small>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "1.1rem",
                          marginTop: "4px",
                          color: "#1b3d2f",
                        }}
                      >
                        {selectedCust.total_visits} lần
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "12px",
                        background: "#faf8f5",
                        border: "1.5px solid #ebdcc5",
                        borderRadius: "12px",
                        textAlign: "center",
                      }}
                    >
                      <small style={{ color: "#666", textTransform: "uppercase", fontSize: "0.7rem" }}>
                        Đã hủy / No-show
                      </small>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "1.1rem",
                          marginTop: "4px",
                          color: selectedCust.cancellation_count > 0 ? "#c62828" : "#2e7d32",
                        }}
                      >
                        {selectedCust.cancellation_count} / {selectedCust.no_show_count}
                      </div>
                    </div>
                  </div>

                  {/* Behavioral stats & Preferences (NEW COMPONENT) */}
                  <div
                    style={{
                      border: "1px solid #ebdcc5",
                      borderRadius: "16px",
                      padding: "16px",
                      backgroundColor: "#faf8f5",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "0.9rem",
                        color: "#1b3d2f",
                        margin: "0 0 12px 0",
                        textTransform: "uppercase",
                        fontWeight: "700",
                        letterSpacing: "0.5px",
                        borderBottom: "1px solid #ebdcc5",
                        paddingBottom: "8px",
                      }}
                    >
                      📊 Chỉ số hành vi & Sở thích khách hàng
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>
                        <span style={{ color: "#666" }}>Lần cuối ghé thăm:</span>
                        <strong style={{ marginLeft: "6px" }}>
                          {selectedCust.last_visit_date
                            ? new Date(selectedCust.last_visit_date).toLocaleDateString("vi-VN")
                            : "Chưa ghi nhận"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "#666" }}>Tần suất quay lại trung bình:</span>
                        <strong style={{ marginLeft: "6px" }}>
                          {selectedCust.avg_days_between_visits
                            ? `${selectedCust.avg_days_between_visits} ngày / lần`
                            : "Chưa đủ dữ liệu"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "#666" }}>Đánh giá dịch vụ (Reviews):</span>
                        <strong style={{ marginLeft: "6px", color: "#b45309" }}>
                          {selectedCust.feedback_rating
                            ? `⭐ ${selectedCust.feedback_rating} / 5.0`
                            : "Chưa có đánh giá"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "#666" }}>Dịch vụ sử dụng nhiều nhất:</span>
                        <div style={{ display: "inline-flex", gap: "4px", flexWrap: "wrap", marginLeft: "6px" }}>
                          {selectedCust.favorite_services && selectedCust.favorite_services.length > 0 ? (
                            selectedCust.favorite_services.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                style={{
                                  fontSize: "0.7rem",
                                  backgroundColor: "#e2e8f0",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  color: "#4a5568",
                                  fontWeight: "bold",
                                }}
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontStyle: "italic", color: "#888" }}>Chưa có</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Churn Risk description */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      background: selectedCust.risk_level === "HIGH_RISK" ? "#fff5f5" : "#f7faf7",
                      border: "1px solid",
                      borderColor: selectedCust.risk_level === "HIGH_RISK" ? "#fed7d7" : "#e2ebd9",
                      padding: "16px",
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ fontSize: "28px" }}>
                      {selectedCust.risk_level === "HIGH_RISK" ? "⚠️" : "✓"}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: "#1f140e", fontSize: "0.95rem" }}>
                        Đánh giá rủi ro Churn: {selectedCust.risk_score}%
                      </h4>
                      <p style={{ margin: "4px 0 0 0", color: "#555", fontSize: "0.85rem", lineHeight: "1.4" }}>
                        Khách hàng thuộc nhóm phân loại{" "}
                        <strong>{selectedCust.risk_level}</strong>. Cần áp dụng ngay các giải pháp giữ chân đề xuất dưới đây.
                      </p>
                    </div>
                  </div>

                  {/* Detected triggers block */}
                  <div>
                    <h4 style={{ fontSize: "1rem", color: "#1f140e", margin: "0 0 10px 0", fontWeight: "700" }}>
                      ⚠️ Dấu hiệu bất thường phát hiện:
                    </h4>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontSize: "0.88rem",
                        color: "#444",
                        lineHeight: "1.4",
                      }}
                    >
                      {selectedCust.reason.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Suggested actions block */}
                  <div
                    style={{
                      backgroundColor: "#fffdf9",
                      border: "1px dashed #b45309",
                      padding: "16px",
                      borderRadius: "12px",
                    }}
                  >
                    <h4 style={{ fontSize: "1rem", color: "#b45309", margin: "0 0 10px 0", fontWeight: "700" }}>
                      💡 Khuyến nghị giữ chân đề xuất:
                    </h4>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontSize: "0.88rem",
                        color: "#444",
                        lineHeight: "1.4",
                      }}
                    >
                      {selectedCust.recommended_action.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Interactive cta actions panel */}
                  <div
                    style={{
                      borderTop: "1px solid #ebdcc5",
                      paddingTop: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ fontSize: "1rem", color: "#1b3d2f", margin: "0", fontWeight: "700" }}>
                        ⚡ Thực hiện Hành động Giữ chân ngay lập tức
                      </h4>
                      <button
                        type="button"
                        onClick={handleExecuteAllActions}
                        disabled={actionLoading}
                        style={{
                          backgroundColor: "#b45309",
                          color: "#fff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          fontSize: "0.78rem",
                          cursor: actionLoading ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 5px rgba(180,83,9,0.2)",
                        }}
                      >
                        🚀 Thực hiện tất cả
                      </button>
                    </div>

                    {/* Dynamic Action Buttons from Recommendations */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {(selectedCust.recommended_action || []).map((action, idx) => {
                        const isVoucher = action.includes("Voucher") || action.includes("voucher");
                        const isCall = action.includes("điện thoại") || action.includes("Gọi điện") || action.includes("Liên hệ");
                        const isMessage = action.includes("tin nhắn") || action.includes("Zalo/SMS") || action.includes("Gửi tin nhắn");
                        const isGift = action.includes("Tặng kèm") || action.includes("miễn phí") || action.includes("suất");
                        const isUpgrade = action.includes("nâng cấp") || action.includes("VIP");
                        const isPoints = action.includes("điểm tích lũy") || action.includes("điểm thưởng") || action.includes("Nhân đôi");

                        let btnText = "Thực hiện ngay";
                        let btnIcon = "⚡";
                        let handleExecute = null;
                        let helperText = "";

                        if (isVoucher) {
                          const details = recommendedVoucherDetails;
                          btnText = `Tự động Tặng Voucher ${details ? details.text : ""}`;
                          btnIcon = "🎁";
                          helperText = "Hệ thống tự động tìm và gửi voucher phù hợp từ danh sách voucher.";
                          handleExecute = () => handleExecuteRecommendedAction(action);
                        } else if (isCall) {
                          btnText = "Gọi điện chăm sóc";
                          btnIcon = "📞";
                          helperText = `SĐT khách hàng: ${selectedCust.phone || "Chưa cập nhật"}`;
                          handleExecute = () => {
                            if (selectedCust.phone) {
                              window.location.href = `tel:${selectedCust.phone}`;
                            } else {
                              showToast("Khách hàng không có số điện thoại", "error");
                            }
                          };
                        } else if (isMessage) {
                          btnText = "Gửi lời nhắn mẫu";
                          btnIcon = "✉️";
                          helperText = "Gửi ngay lời nhắc và hỏi thăm theo mẫu soạn sẵn qua Email/Thông báo.";
                          handleExecute = () => handleExecuteRecommendedAction(action);
                        } else if (isGift) {
                          const giftName = action.includes("Gội đầu") ? "Gội đầu thảo dược dưỡng sinh" : "Massage cổ vai gáy miễn phí";
                          btnText = `Tặng suất ${giftName}`;
                          btnIcon = "💆";
                          helperText = "Gửi tặng dịch vụ miễn phí vào tài khoản khách hàng để họ trải nghiệm.";
                          handleExecute = () => handleExecuteRecommendedAction(action);
                        } else if (isUpgrade) {
                          btnText = "Đặc cách lên VIP";
                          btnIcon = "👑";
                          helperText = "Cấp quyền thành viên VIP, hưởng chiết khấu trọn đời.";
                          handleExecute = () => handleExecuteRecommendedAction(action);
                        } else if (isPoints) {
                          btnText = "Tặng +200 điểm Loyalty";
                          btnIcon = "🌟";
                          helperText = "Cộng trực tiếp 200 điểm Loyalty Points vào tài khoản khách.";
                          handleExecute = () => handleExecuteRecommendedAction(action);
                        } else {
                          // Default handler for general recommendations
                          btnText = "Xử lý thủ công";
                          btnIcon = "🔧";
                          helperText = "Đọc kỹ khuyến nghị để thực hiện hỗ trợ khách.";
                        }

                        const isExecuted = executedActions[`${selectedCust.customer_id}-${action}`];
                        const isDisabled = actionLoading || isExecuted;

                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#faf8f5",
                              padding: "14px 18px",
                              borderRadius: "12px",
                              border: "1px solid #ebdcc5",
                              gap: "16px",
                              opacity: isExecuted ? 0.75 : 1,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.88rem", fontWeight: "bold", color: "#3f2817", marginBottom: "4px" }}>
                                {action}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#8c7e74" }}>
                                {helperText}
                              </div>
                            </div>
                            {handleExecute && (
                              <button
                                type="button"
                                onClick={handleExecute}
                                disabled={isDisabled}
                                style={{
                                  backgroundColor: isExecuted ? "#cbd5e1" : "#1b3d2f",
                                  color: isExecuted ? "#64748b" : "#fff",
                                  border: "none",
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  fontWeight: "bold",
                                  fontSize: "0.8rem",
                                  cursor: isDisabled ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  transition: "all 0.2s",
                                }}
                              >
                                <span>{isExecuted ? "✓" : btnIcon}</span>
                                <span>{isExecuted ? "Đã thực hiện" : btnText}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Collapsible Manual Override Section */}
                    <details
                      style={{
                        borderTop: "1.5px solid #ebdcc5",
                        marginTop: "10px",
                        paddingTop: "15px",
                      }}
                    >
                      <summary
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: "bold",
                          color: "#6b5444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          listStyle: "none",
                          userSelect: "none",
                        }}
                      >
                        <span>🛠️ Công cụ gửi thủ công / Dự phòng</span>
                        <span style={{ fontSize: "0.75rem", color: "#b45309" }}>Xem chi tiết ▼</span>
                      </summary>

                      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "15px" }}>
                        {/* Send Custom Voucher manually */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            backgroundColor: "#fffdf9",
                            padding: "14px",
                            borderRadius: "10px",
                            border: "1.5px solid #ebdcc5",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "bold", color: "#666", marginBottom: "4px" }}>
                              GỬI VOUCHER TỰ CHỌN
                            </label>
                            <select
                              value={selectedVoucherId}
                              onChange={(e) => setSelectedVoucherId(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #ebdcc5",
                                fontSize: "0.82rem",
                                outline: "none",
                                backgroundColor: "#fff",
                              }}
                            >
                              {vouchers.length > 0 ? (
                                vouchers.map((v) => (
                                  <option key={v.VoucherId} value={v.VoucherId}>
                                    {v.Code} - Giảm{" "}
                                    {String(v.DiscountType).toUpperCase().startsWith("PERCENT")
                                      ? `${Number(v.DiscountValue)}%`
                                      : formatVND(v.DiscountValue)}
                                  </option>
                                ))
                              ) : (
                                <option value="">Không có voucher khả dụng</option>
                              )}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={handleSendVoucher}
                            disabled={actionLoading || !selectedVoucherId}
                            style={{
                              backgroundColor: "#b45309",
                              color: "#fff",
                              border: "none",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              fontWeight: "bold",
                              fontSize: "0.8rem",
                              cursor: actionLoading || !selectedVoucherId ? "not-allowed" : "pointer",
                              opacity: actionLoading || !selectedVoucherId ? 0.6 : 1,
                            }}
                          >
                            🎁 Gửi thủ công
                          </button>
                        </div>

                        {/* Send Custom Text Message manually */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            backgroundColor: "#fffdf9",
                            padding: "14px",
                            borderRadius: "10px",
                            border: "1.5px solid #ebdcc5",
                          }}
                        >
                          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "bold", color: "#666" }}>
                            SOẠN VÀ GỬI TIN NHẮN ZALO / SMS CHĂM SÓC
                          </label>
                          <textarea
                            id="retention-textarea"
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            rows={4}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              border: "1px solid #ebdcc5",
                              fontSize: "0.82rem",
                              outline: "none",
                              resize: "none",
                              fontFamily: "monospace",
                              lineHeight: "1.4",
                            }}
                          />
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={handleSendReminder}
                              disabled={actionLoading || !customMessage.trim()}
                              style={{
                                backgroundColor: "#1b3d2f",
                                color: "#fff",
                                border: "none",
                                padding: "8px 14px",
                                borderRadius: "8px",
                                fontWeight: "bold",
                                fontSize: "0.8rem",
                                cursor: actionLoading || !customMessage.trim() ? "not-allowed" : "pointer",
                                opacity: actionLoading || !customMessage.trim() ? 0.6 : 1,
                              }}
                            >
                              ✉️ Gửi tin nhắn chăm sóc
                            </button>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    color: "#8c7e74",
                  }}
                >
                  <span style={{ fontSize: "48px", marginBottom: "16px" }}>🔮</span>
                  <h3 style={{ margin: 0, fontFamily: "Georgia, serif" }}>AI CRM Analyzer Panel</h3>
                  <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "8px", textAlign: "center" }}>
                    Chọn một khách hàng ở danh sách bên trái để kiểm tra phân tích chi tiết và hành động giữ chân.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
