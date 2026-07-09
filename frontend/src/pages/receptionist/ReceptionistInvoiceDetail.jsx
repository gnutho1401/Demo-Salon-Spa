import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

const POPULAR_BANKS = [
  { bin: "970436", name: "VCB - Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970423", name: "TPBank" },
  { bin: "970419", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970448", name: "OCB" }
];

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function statusClass(status) {
  return `rx-badge status-${String(status || "unpaid").toLowerCase()}`;
}

function statusLabel(status) {
  const map = {
    PAID: "Đã thanh toán",
    PENDING: "Chờ thanh toán",
    UNPAID: "Chưa thanh toán",
    CANCELLED: "Đã hủy",
    REFUND_PENDING: "Chờ hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
    COMPLETED: "Hoàn thành",
    CONFIRMED: "Đã xác nhận",
  };

  return map[String(status || "").toUpperCase()] || status || "-";
}

export default function ReceptionistInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [payMethod, setPayMethod] = useState("CASH");
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bankList, setBankList] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [manualDiscountInput, setManualDiscountInput] = useState(0);
  const [surchargeInput, setSurchargeInput] = useState(0);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await axiosClient.get("/receptionist/services");
        setAvailableServices(res.data?.data || res.data || []);
      } catch (err) {
        console.error("Failed to fetch services:", err);
      }
    }
    fetchServices();
  }, []);

  useEffect(() => {
    fetch("https://api.vietqr.io/v2/banks")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data) {
          setBankList(data.data.map(b => ({ bin: b.bin, name: `${b.shortName} - ${b.name}` })));
        } else {
          setBankList(POPULAR_BANKS);
        }
      })
      .catch(() => {
        setBankList(POPULAR_BANKS);
      });
  }, []);

  async function loadInvoice() {
    try {
      setLoading(true);
      setError("");

      const res = await axiosClient.get(`/receptionist/invoices/${id}`);
      setInvoice(res.data?.data || res.data || null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được chi tiết hóa đơn",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const paymentStatus = useMemo(() => {
    return String(
      invoice?.PaymentStatus ||
      invoice?.PaymentInfo?.Status ||
      invoice?.Status ||
      "UNPAID",
    ).toUpperCase();
  }, [invoice]);

  const canMarkPaid = paymentStatus !== "PAID" && paymentStatus !== "REFUNDED" && paymentStatus !== "REFUND_PENDING";
  const canRefund = paymentStatus === "PAID" && !invoice?.RefundInfo;

  async function markPaid() {
    if (!window.confirm("Xác nhận hóa đơn này đã được thanh toán?")) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post(`/receptionist/invoices/${id}/mark-paid`, {
        method: payMethod,
      });

      await loadInvoice();
      setSuccessMsg("Cập nhật trạng thái hóa đơn đã thanh toán thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Không thể xác nhận thanh toán");
    } finally {
      setSaving(false);
    }
  }

  async function requestRefund() {
    const isPackage = String(invoice?.PaymentInfo?.PaymentMethod || "").toUpperCase() === "PACKAGE";

    if (isPackage) {
      if (!refundReason.trim()) {
        setError("Vui lòng nhập lý do hoàn trả combo");
        return;
      }
    } else {
      if (!bankCode) {
        setError("Vui lòng chọn ngân hàng nhận hoàn tiền");
        return;
      }

      if (!accountNumber.trim()) {
        setError("Vui lòng nhập số tài khoản nhận hoàn tiền");
        return;
      }

      if (!accountName.trim()) {
        setError("Vui lòng nhập tên chủ tài khoản nhận hoàn tiền");
        return;
      }

      if (!refundReason.trim()) {
        setError("Vui lòng nhập lý do hoàn tiền");
        return;
      }
    }

    if (!window.confirm("Tạo yêu cầu hoàn tiền cho hóa đơn này?")) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post(`/receptionist/invoices/${id}/refund`, {
        reason: refundReason,
        refundAmount: invoice?.FinalAmount || invoice?.Total || 0,
        bankCode,
        accountNumber,
        accountName: accountName.trim().toUpperCase()
      });

      setRefundReason("");
      setRefundAmount("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
      await loadInvoice();
      setSuccessMsg("Tạo yêu cầu hoàn tiền thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể tạo yêu cầu hoàn tiền",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustments() {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.put(`/receptionist/invoices/${id}/update-details`, {
        serviceIds: selectedServiceIds,
        voucherCode: voucherCodeInput,
        manualDiscount: Number(manualDiscountInput || 0),
        surcharge: Number(surchargeInput || 0)
      });

      await loadInvoice();
      setSuccessMsg("Cập nhật chi tiết hóa đơn thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Không thể lưu điều chỉnh");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function sendEmail() {
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post(`/receptionist/invoices/${id}/send-email`);

      setSuccessMsg("Đã gửi hóa đơn qua email khách hàng thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Gửi email thất bại");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  const handleDownloadPDF = () => {
    const element = document.querySelector(".tactile-receipt");
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `Invoice_${id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    const loadScriptAndDownload = () => {
      if (window.html2pdf) {
        window.html2pdf().from(element).set(opt).save();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => {
          window.html2pdf().from(element).set(opt).save();
        };
        document.body.appendChild(script);
      }
    };

    loadScriptAndDownload();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <ReceptionistLayout>
      <div className="rx-page fade-in">
        <header className="rx-page-header no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div className="rx-title-block" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="rx-title-icon" style={{ fontSize: "32px" }}>🧾</div>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", color: "#1e293b", fontWeight: "800" }}>Chi tiết hóa đơn #{id}</h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>Xem thông tin hóa đơn, dịch vụ sử dụng, lịch sử giao dịch và in ấn.</p>
            </div>
          </div>

          <div className="rx-header-actions" style={{ display: "flex", gap: "10px" }}>
            <button
              className="rx-light-btn"
              type="button"
              onClick={() => navigate(-1)}
              style={{ height: "42px", borderRadius: "10px", padding: "0 16px", cursor: "pointer", fontWeight: "bold" }}
            >
              ← Quay lại
            </button>
            {invoice && (
              <>
                <button
                  className="rx-outline-pink-btn"
                  type="button"
                  onClick={handleDownloadPDF}
                  style={{ height: "42px", borderRadius: "10px", padding: "0 16px", cursor: "pointer", fontWeight: "bold" }}
                >
                  📥 Tải PDF
                </button>
                {invoice.CustomerEmail && (
                  <button
                    className="rx-outline-pink-btn"
                    type="button"
                    onClick={sendEmail}
                    disabled={saving}
                    style={{ height: "42px", borderRadius: "10px", padding: "0 16px", cursor: "pointer", fontWeight: "bold" }}
                  >
                    ✉ Gửi Email
                  </button>
                )}
              </>
            )}
            <button
              className="rx-outline-pink-btn"
              type="button"
              onClick={handlePrint}
              disabled={!invoice}
              style={{ height: "42px", borderRadius: "10px", padding: "0 16px", cursor: "pointer", fontWeight: "bold" }}
            >
              🖨 In hóa đơn
            </button>
            <button
              className="rx-primary-btn"
              type="button"
              onClick={loadInvoice}
              style={{ height: "42px", borderRadius: "10px", padding: "0 16px", cursor: "pointer", fontWeight: "bold" }}
            >
              ↻ Làm mới
            </button>
          </div>
        </header>

        {error && <div className="rx-error no-print" style={{ marginBottom: 15 }}>{error}</div>}
        {successMsg && <div className="rx-success no-print" style={{ marginBottom: 15, padding: "12px", background: "#d4edda", color: "#155724", borderRadius: "10px", fontWeight: "bold" }}>{successMsg}</div>}

        {loading && (
          <div className="rx-table-card no-print">
            <div style={{ textAlign: "center", padding: "40px", color: "#6f766f" }}>Đang tải chi tiết hóa đơn...</div>
          </div>
        )}

        {!loading && !invoice && (
          <div className="rx-table-card no-print">
            <div style={{ textAlign: "center", padding: "40px", color: "#6f766f" }}>Không tìm thấy hóa đơn.</div>
          </div>
        )}

        {!loading && invoice && (
          <>
            {/* Top Summary Cards (Hero Row) */}
            <div className="rx-invoice-hero no-print">
              <div className={
                paymentStatus === "PAID" || paymentStatus === "COMPLETED" ? "rx-invoice-summary-card status-paid-bg" :
                paymentStatus === "UNPAID" || paymentStatus === "PENDING" ? "rx-invoice-summary-card status-unpaid-bg" :
                paymentStatus.startsWith("REFUND") ? "rx-invoice-summary-card status-refund-bg" : "rx-invoice-summary-card status-cancelled-bg"
              }>
                <div className="rx-summary-card-content">
                  <div className="rx-summary-main-info">
                    <span className="rx-muted-label">Tổng thanh toán</span>
                    <strong>{money(invoice.FinalAmount || invoice.Total)}</strong>
                    <span className={statusClass(paymentStatus)} style={{ alignSelf: "flex-start", marginTop: "8px" }}>
                      {statusLabel(paymentStatus)}
                    </span>
                  </div>
                  <div className={`rx-summary-icon ${
                    paymentStatus === "PAID" || paymentStatus === "COMPLETED" ? "green" :
                    paymentStatus === "UNPAID" || paymentStatus === "PENDING" ? "orange" : "blue"
                  }`}>
                    💵
                  </div>
                </div>
              </div>

              <div className={
                invoice.AppointmentStatus === "COMPLETED" || invoice.AppointmentStatus === "CONFIRMED" ? "rx-invoice-summary-card status-paid-bg" :
                invoice.AppointmentStatus === "CANCELLED" ? "rx-invoice-summary-card status-cancelled-bg" : "rx-invoice-summary-card status-unpaid-bg"
              }>
                <div className="rx-summary-card-content">
                  <div className="rx-summary-main-info">
                    <span className="rx-muted-label">Mã lịch hẹn</span>
                    <strong>#{invoice.AppointmentId || "-"}</strong>
                    <span className={statusClass(invoice.AppointmentStatus)} style={{ alignSelf: "flex-start", marginTop: "8px" }}>
                      {statusLabel(invoice.AppointmentStatus)}
                    </span>
                  </div>
                  <div className="rx-summary-icon">
                    📅
                  </div>
                </div>
              </div>

              <div className="rx-invoice-summary-card rx-invoice-summary-bg">
                <div className="rx-summary-card-content">
                  <div className="rx-summary-main-info">
                    <span className="rx-muted-label">Ngày lập hóa đơn</span>
                    <strong>{formatDate(invoice.CreatedAt)}</strong>
                    <span style={{ fontSize: "13px", color: "#64748b", marginTop: "8px", fontWeight: "bold" }}>
                      Thời gian: {formatTime(invoice.CreatedAt)}
                    </span>
                  </div>
                  <div className="rx-summary-icon">
                    ⏱️
                  </div>
                </div>
              </div>
            </div>

            {/* Layout Grid columns: Left column 460px (Ticket + Timeline), Right column 1fr (Sidebar grid cards) */}
            <div className="rx-invoice-detail-layout">
              
              {/* COLUMN 1: Receipt Voucher & Activity Timeline */}
              <div className="rx-invoice-receipt-column">
                <div className="tactile-receipt">
                  <div className="receipt-header">
                    <div className="receipt-brand">✿ LUNA SALON ✿</div>
                    <div className="receipt-subtitle">HÓA ĐƠN BIÊN LAI THANH TOÁN</div>
                    <div className="receipt-decor-line">- - - - - - - - - - - - - - - - - - -</div>
                  </div>

                  <div className="receipt-info-block">
                    <p><span>Số hóa đơn:</span> <strong>#INV-{invoice.InvoiceId}</strong></p>
                    <p><span>Mã lịch hẹn:</span> <span>#{invoice.AppointmentId}</span></p>
                    <p><span>Thời gian:</span> <span>{formatTime(invoice.CreatedAt)} {formatDate(invoice.CreatedAt)}</span></p>
                    <p><span>Khách hàng:</span> <span>{invoice.CustomerName || "Khách vãng lai"}</span></p>
                    <p><span>Điện thoại:</span> <span>{invoice.CustomerPhone || "Không có"}</span></p>
                    <p><span>Chuyên viên:</span> <span>{invoice.TechnicianName || "Chưa chỉ định"}</span></p>
                    <p>
                      <span>Trạng thái:</span> 
                      <strong className={`rx-status-text-${paymentStatus.toLowerCase()}`}>
                        {statusLabel(paymentStatus)}
                      </strong>
                    </p>
                  </div>

                  <div className="receipt-decor-line">- - - - - - - - - - - - - - - - - - -</div>

                  <div className="receipt-items-header">Danh sách dịch vụ</div>
                  <table className="receipt-services-table">
                    <thead>
                      <tr>
                        <th>Tên dịch vụ</th>
                        <th style={{ textAlign: "right" }}>Đơn giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice.Services || []).map((s) => (
                        <tr key={s.ServiceId}>
                          <td>
                            <span>{s.ServiceName}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>{money(s.Price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="receipt-decor-line">- - - - - - - - - - - - - - - - - - -</div>

                  <div className="receipt-totals-block">
                    <p><span>Tạm tính:</span> <span>{money(invoice.Total)}</span></p>
                    {invoice.VoucherCode && (
                      <p><span>Voucher ({invoice.VoucherCode}):</span> <span style={{ color: "#d9534f" }}>- {money(Number(invoice.Discount) - Number(invoice.ManualDiscount) - Number(invoice.RewardDiscountAmount || 0))}</span></p>
                    )}
                    {Number(invoice.RewardPointsUsed || 0) > 0 && (
                      <p><span>Dùng điểm thưởng ({invoice.RewardPointsUsed} điểm):</span> <span style={{ color: "#d9534f" }}>- {money(invoice.RewardDiscountAmount)}</span></p>
                    )}
                    {Number(invoice.ManualDiscount) > 0 && (
                      <p><span>Giảm thủ công:</span> <span style={{ color: "#d9534f" }}>- {money(invoice.ManualDiscount)}</span></p>
                    )}
                    {Number(invoice.Surcharge) > 0 && (
                      <p><span>Phụ phí / Tip:</span> <span style={{ color: "#28a745" }}>+ {money(invoice.Surcharge)}</span></p>
                    )}
                    <div className="receipt-grand-total">
                      <span>TỔNG THANH TOÁN:</span>
                      <strong>{money(invoice.FinalAmount)}</strong>
                    </div>
                  </div>

                  <div className="receipt-decor-line">- - - - - - - - - - - - - - - - - - -</div>

                  <div className="receipt-footer">
                    <p>Cảm ơn quý khách đã đồng hành cùng Luna Salon!</p>
                    <p>Hẹn gặp lại quý khách lần sau.</p>
                    
                    {/* SVG Vector Barcode */}
                    <div className="receipt-barcode-container">
                      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
                        <rect x="0" y="0" width="2" height="20" fill="black" />
                        <rect x="3" y="0" width="1" height="20" fill="black" />
                        <rect x="6" y="0" width="3" height="20" fill="black" />
                        <rect x="10" y="0" width="1" height="20" fill="black" />
                        <rect x="13" y="0" width="4" height="20" fill="black" />
                        <rect x="18" y="0" width="1" height="20" fill="black" />
                        <rect x="21" y="0" width="2" height="20" fill="black" />
                        <rect x="25" y="0" width="3" height="20" fill="black" />
                        <rect x="29" y="0" width="1" height="20" fill="black" />
                        <rect x="32" y="0" width="2" height="20" fill="black" />
                        <rect x="36" y="0" width="4" height="20" fill="black" />
                        <rect x="42" y="0" width="1" height="20" fill="black" />
                        <rect x="44" y="0" width="3" height="20" fill="black" />
                        <rect x="49" y="0" width="1" height="20" fill="black" />
                        <rect x="52" y="0" width="2" height="20" fill="black" />
                        <rect x="56" y="0" width="4" height="20" fill="black" />
                        <rect x="61" y="0" width="1" height="20" fill="black" />
                        <rect x="64" y="0" width="3" height="20" fill="black" />
                        <rect x="68" y="0" width="2" height="20" fill="black" />
                        <rect x="72" y="0" width="1" height="20" fill="black" />
                        <rect x="75" y="0" width="4" height="20" fill="black" />
                        <rect x="80" y="0" width="2" height="20" fill="black" />
                        <rect x="84" y="0" width="3" height="20" fill="black" />
                        <rect x="88" y="0" width="1" height="20" fill="black" />
                        <rect x="91" y="0" width="4" height="20" fill="black" />
                        <rect x="96" y="0" width="2" height="20" fill="black" />
                        <rect x="99" y="0" width="1" height="20" fill="black" />
                      </svg>
                      <small>*LUNA-{invoice.InvoiceId}*</small>
                    </div>

                    {/* SVG Vector QR Code */}
                    <div className="receipt-qr-container">
                      <svg viewBox="0 0 100 100">
                        {/* Finder pattern TL */}
                        <rect x="2" y="2" width="24" height="24" fill="black" />
                        <rect x="6" y="6" width="16" height="16" fill="#fdfdfa" />
                        <rect x="10" y="10" width="8" height="8" fill="black" />
                        {/* Finder pattern TR */}
                        <rect x="74" y="2" width="24" height="24" fill="black" />
                        <rect x="78" y="6" width="16" height="16" fill="#fdfdfa" />
                        <rect x="82" y="10" width="8" height="8" fill="black" />
                        {/* Finder pattern BL */}
                        <rect x="2" y="74" width="24" height="24" fill="black" />
                        <rect x="6" y="78" width="16" height="16" fill="#fdfdfa" />
                        <rect x="10" y="82" width="8" height="8" fill="black" />
                        {/* Alignment pattern BR */}
                        <rect x="70" y="70" width="10" height="10" fill="black" />
                        <rect x="72" y="72" width="6" height="6" fill="#fdfdfa" />
                        <rect x="74" y="74" width="2" height="2" fill="black" />
                        {/* QR Pixels details */}
                        <rect x="32" y="4" width="4" height="4" fill="black" />
                        <rect x="40" y="8" width="8" height="4" fill="black" />
                        <rect x="52" y="4" width="4" height="8" fill="black" />
                        <rect x="60" y="12" width="4" height="4" fill="black" />
                        <rect x="64" y="4" width="4" height="4" fill="black" />
                        <rect x="36" y="20" width="8" height="4" fill="black" />
                        <rect x="48" y="16" width="4" height="4" fill="black" />
                        <rect x="56" y="24" width="12" height="4" fill="black" />
                        <rect x="4" y="32" width="4" height="12" fill="black" />
                        <rect x="16" y="36" width="8" height="4" fill="black" />
                        <rect x="28" y="32" width="4" height="4" fill="black" />
                        <rect x="36" y="36" width="12" height="4" fill="black" />
                        <rect x="52" y="32" width="4" height="8" fill="black" />
                        <rect x="64" y="36" width="8" height="4" fill="black" />
                        <rect x="76" y="32" width="4" height="12" fill="black" />
                        <rect x="88" y="36" width="8" height="4" fill="black" />
                        <rect x="8" y="48" width="8" height="4" fill="black" />
                        <rect x="20" y="44" width="4" height="8" fill="black" />
                        <rect x="32" y="48" width="4" height="4" fill="black" />
                        <rect x="40" y="44" width="8" height="4" fill="black" />
                        <rect x="56" y="48" width="4" height="8" fill="black" />
                        <rect x="68" y="44" width="8" height="4" fill="black" />
                        <rect x="80" y="48" width="12" height="4" fill="black" />
                        <rect x="4" y="60" width="8" height="4" fill="black" />
                        <rect x="16" y="56" width="4" height="8" fill="black" />
                        <rect x="28" y="60" width="12" height="4" fill="black" />
                        <rect x="44" y="56" width="4" height="4" fill="black" />
                        <rect x="52" y="60" width="8" height="4" fill="black" />
                        <rect x="64" y="56" width="4" height="12" fill="black" />
                        <rect x="76" y="60" width="8" height="4" fill="black" />
                        <rect x="88" y="56" width="4" height="4" fill="black" />
                        <rect x="32" y="68" width="4" height="8" fill="black" />
                        <rect x="40" y="76" width="8" height="4" fill="black" />
                        <rect x="52" y="72" width="4" height="4" fill="black" />
                        <rect x="60" y="80" width="8" height="4" fill="black" />
                        <rect x="36" y="88" width="12" height="4" fill="black" />
                        <rect x="52" y="84" width="4" height="8" fill="black" />
                        <rect x="60" y="92" width="4" height="4" fill="black" />
                      </svg>
                      <small>LUNA-{invoice.InvoiceId}</small>
                    </div>

                  </div>

                  <div className="receipt-tattered-edge"></div>
                </div>

                {/* TRANSACTION ACTIVITY TIMELINE in LEFT COLUMN */}
                <div className="rx-invoice-receipt-timeline-card no-print">
                  <div className="rx-detail-card" style={{ padding: "24px" }}>
                    <div className="rx-section-title" style={{ marginBottom: "20px" }}>
                      <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>Nhật ký hoạt động (Timeline)</h2>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>Lịch sử giao dịch và thay đổi trạng thái</p>
                    </div>

                    <div className="rx-transaction-timeline">
                      {/* Event 1: Invoice Created */}
                      <div className="timeline-node success">
                        <div className="node-icon"></div>
                        <div className="node-content">
                          <h4>Khởi tạo hóa đơn</h4>
                          <p className="node-time">{formatDateTime(invoice.CreatedAt)}</p>
                          <span className="node-desc">
                            Hóa đơn trị giá <strong>{money(invoice.Total)}</strong> được tạo tự động cho lịch hẹn #{invoice.AppointmentId}.
                          </span>
                        </div>
                      </div>

                      {/* Event 2: Payments History */}
                      {invoice.Payments && invoice.Payments.map((p) => (
                        <div key={p.PaymentId} className={`timeline-node ${p.Status === "PAID" ? "success" : "warning"}`}>
                          <div className="node-icon"></div>
                          <div className="node-content">
                            <h4>Thanh toán #{p.PaymentId} ({p.PaymentMethod})</h4>
                            <p className="node-time">{formatDateTime(p.PaidAt || p.CreatedAt)}</p>
                            <span className="node-desc">
                              Thực hiện thanh toán số tiền <strong>{money(p.Amount)}</strong>. Trạng thái: {statusLabel(p.Status)}.
                              {p.TransactionCode && <> Mã GD: <code>{p.TransactionCode}</code>.</>}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Event 3: Refunds History */}
                      {invoice.Refunds && invoice.Refunds.map((r) => (
                        <div key={r.RefundId} className={`timeline-node ${r.RefundStatus === "COMPLETED" ? "danger" : "warning"}`}>
                          <div className="node-icon"></div>
                          <div className="node-content">
                            <h4>Yêu cầu hoàn tiền #{r.RefundId}</h4>
                            <p className="node-time">{formatDateTime(r.CreatedAt)}</p>
                            <span className="node-desc">
                              Hoàn trả số tiền <strong>{money(r.RefundAmount)}</strong> về tài khoản <code>{r.AccountName} ({r.AccountNumber})</code>.
                              Lý do: <em>"{r.RefundReason}"</em>.
                              Trạng thái: <strong>{statusLabel(r.RefundStatus)}</strong>.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: Sidebar Info Panels and Admin Actions */}
              <div className="rx-invoice-actions-column no-print">
                
                {/* Horizontal side-by-side Grid of details */}
                <div className="rx-detail-grid-two-cols">
                  {/* Customer Info Card */}
                  <div className="rx-detail-card" style={{ padding: "20px" }}>
                    <div className="rx-section-title" style={{ marginBottom: "15px" }}>
                      <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>Người thanh toán</h2>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>Hồ sơ khách hàng</p>
                    </div>
                    <div className="rx-info-list" style={{ gap: "10px" }}>
                      <div style={{ padding: "8px 0" }}>
                        <span>Họ tên</span>
                        <b>{invoice.CustomerName || "Khách vãng lai"}</b>
                      </div>
                      <div style={{ padding: "8px 0" }}>
                        <span>Số điện thoại</span>
                        <b>{invoice.CustomerPhone || "Không có"}</b>
                      </div>
                      <div style={{ padding: "8px 0", borderBottom: "none" }}>
                        <span>Email</span>
                        <b style={{ wordBreak: "break-all", fontSize: "13px" }}>{invoice.CustomerEmail || "Không có"}</b>
                      </div>
                    </div>
                  </div>

                  {/* Appointment Context Card */}
                  <div className="rx-detail-card" style={{ padding: "20px" }}>
                    <div className="rx-section-title" style={{ marginBottom: "15px" }}>
                      <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>Thông tin lịch hẹn</h2>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>Chi tiết lịch làm đẹp</p>
                    </div>
                    <div className="rx-info-list" style={{ gap: "10px" }}>
                      <div style={{ padding: "8px 0" }}>
                        <span>Kỹ thuật viên</span>
                        <b>{invoice.TechnicianName || "Chưa có"}</b>
                      </div>
                      <div style={{ padding: "8px 0" }}>
                        <span>Ngày thực hiện</span>
                        <b>{formatDate(invoice.AppointmentDate)}</b>
                      </div>
                      <div style={{ padding: "8px 0", borderBottom: "none" }}>
                        <span>Khung giờ</span>
                        <b>{invoice.StartTime ? `${invoice.StartTime} - ${invoice.EndTime}` : "N/A"}</b>
                      </div>
                    </div>
                </div>
              </div>

              {/* Action: Edit Invoice Details (for unpaid/pending bills) */}
              {canMarkPaid && (
                <div className="rx-detail-card" style={{ padding: "22px", marginBottom: "20px", border: "1px solid #cbd5e1" }}>
                  <div className="rx-section-title" style={{ marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>✏️ Điều chỉnh chi tiết hóa đơn</h2>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>Thêm/bớt dịch vụ, áp voucher, giảm giá hoặc phụ phí</p>
                  </div>

                  {/* Service selection list */}
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "6px" }}>
                      Danh sách dịch vụ:
                    </label>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                      {selectedServiceIds.map((sid) => {
                        const s = availableServices.find((x) => x.ServiceId === sid);
                        if (!s) return null;
                        return (
                          <div
                            key={sid}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              fontSize: "13px"
                            }}
                          >
                            <span style={{ fontWeight: "600", color: "#334155" }}>{s.ServiceName}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: "#64748b" }}>{money(s.Price)}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceIds(selectedServiceIds.filter((id) => id !== sid));
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  padding: "0 4px"
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <select
                        id="add-service-select"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const sid = Number(val);
                            if (!selectedServiceIds.includes(sid)) {
                              setSelectedServiceIds([...selectedServiceIds, sid]);
                            }
                            e.target.value = "";
                          }
                        }}
                        style={{
                          flex: 1,
                          height: "38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          padding: "0 8px",
                          fontSize: "13px"
                        }}
                      >
                        <option value="">-- Chọn dịch vụ để thêm --</option>
                        {availableServices
                          .filter((s) => !selectedServiceIds.includes(s.ServiceId))
                          .map((s) => (
                            <option key={s.ServiceId} value={s.ServiceId}>
                              {s.ServiceName} ({money(s.Price)})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Voucher input */}
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "4px" }}>
                      Mã Voucher:
                    </label>
                    <input
                      type="text"
                      placeholder="Nhập mã voucher..."
                      value={voucherCodeInput}
                      onChange={(e) => setVoucherCodeInput(e.target.value)}
                      style={{
                        width: "100%",
                        height: "38px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        padding: "0 10px",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  {/* Manual discount & Surcharge */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "4px" }}>
                        Giảm thủ công:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={manualDiscountInput}
                        onChange={(e) => setManualDiscountInput(e.target.value)}
                        style={{
                          width: "100%",
                          height: "38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          padding: "0 10px",
                          fontSize: "13px",
                          boxSizing: "border-box"
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "4px" }}>
                        Phụ phí / Tip:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={surchargeInput}
                        onChange={(e) => setSurchargeInput(e.target.value)}
                        style={{
                          width: "100%",
                          height: "38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          padding: "0 10px",
                          fontSize: "13px",
                          boxSizing: "border-box"
                        }}
                      />
                    </div>
                  </div>

                  <button
                    className="rx-outline-pink-btn"
                    type="button"
                    disabled={saving}
                    onClick={saveAdjustments}
                    style={{ width: "100%", height: "42px", fontWeight: "bold", borderRadius: "10px", cursor: "pointer" }}
                  >
                    {saving ? "Đang lưu..." : "💾 Lưu điều chỉnh hóa đơn"}
                  </button>
                </div>
              )}

                {/* Action: Mark Paid Card (for unpaid/pending bills) */}
                {canMarkPaid && (
                  <div className="rx-detail-card" style={{ border: "1px solid #c3e6cb", backgroundColor: "#f4fdf8", padding: "22px", marginBottom: "20px" }}>
                    <div className="rx-section-title" style={{ marginBottom: "16px" }}>
                      <h2 style={{ color: "#155724", fontSize: "16px", margin: 0 }}>Thanh toán hóa đơn</h2>
                      <p style={{ color: "#28a745", fontSize: "12px", margin: "4px 0 0" }}>Xử lý giao dịch trực tiếp tại quầy</p>
                    </div>

                    <div className="rx-inline-action">
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        style={{ width: "100%", marginBottom: "14px", height: "42px", borderRadius: "10px", padding: "0 10px", border: "1px solid #c3e6cb" }}
                      >
                        <option value="CASH">💵 Tiền mặt (Cash)</option>
                        <option value="CARD">💳 Quẹt thẻ (Card)</option>
                        <option value="TRANSFER">🏦 Chuyển khoản ngân hàng</option>
                        <option value="VNPAY">🏦 Thanh toán VNPay</option>
                        <option value="MOMO">📱 Ví điện tử Momo</option>
                      </select>

                      <button
                        className="rx-primary-btn"
                        type="button"
                        disabled={saving}
                        onClick={markPaid}
                        style={{ width: "100%", height: "46px", fontWeight: "bold", borderRadius: "12px", cursor: "pointer" }}
                      >
                        {saving ? "Đang xử lý..." : "Xác nhận đã thu tiền"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action: Refund Request Card (for paid bills) */}
                {invoice.RefundInfo ? (
                  <div className="rx-detail-card" style={{ border: "1px solid #bee5eb", backgroundColor: "#f8f9fa", padding: "22px" }}>
                    <div className="rx-section-title" style={{ marginBottom: "16px" }}>
                      <h2 style={{ fontSize: "16px", margin: 0 }}>Yêu cầu hoàn trả</h2>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>Thông tin chi tiết phiếu hoàn trả</p>
                    </div>
                    <div className="rx-refund-box" style={{ gap: "10px" }}>
                      <div style={{ padding: "8px 0" }}>
                        <span>Mã yêu cầu</span>
                        <b>#{invoice.RefundInfo.RefundId}</b>
                      </div>
                      <div style={{ padding: "8px 0" }}>
                        <span>Số tiền hoàn</span>
                        <b style={{ color: "#d91f68" }}>{money(invoice.RefundInfo.RefundAmount)}</b>
                      </div>
                      <div style={{ padding: "8px 0" }}>
                        <span>Trạng thái hoàn</span>
                        <span className={statusClass(invoice.RefundInfo.RefundStatus)}>
                          {statusLabel(invoice.RefundInfo.RefundStatus)}
                        </span>
                      </div>
                      <div style={{ padding: "8px 0", borderBottom: "none" }}>
                        <span>Lý do hoàn</span>
                        <b>{invoice.RefundInfo.RefundReason || "Không có"}</b>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rx-refund-section-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* CASE 1: UNPAID INVOICE */}
                    {paymentStatus !== "PAID" && (
                      <div className="rx-detail-card" style={{ border: "1.5px solid #d1d5db", backgroundColor: "#f3f4f6", padding: "22px" }}>
                        <div className="rx-section-title" style={{ marginBottom: "12px" }}>
                          <h2 style={{ color: "#4b5563", fontSize: "16px", margin: 0, fontWeight: "bold" }}>Yêu cầu hoàn trả dịch vụ</h2>
                          <p style={{ color: "#6b7280", fontSize: "12px", margin: "4px 0 0" }}>Trạng thái hóa đơn: Chưa thanh toán</p>
                        </div>
                        <div style={{ padding: "12px", borderRadius: "8px", background: "#f9fafb", border: "1.5px dashed #9ca3af", color: "#4b5563", fontSize: "0.85rem", lineHeight: "1.5" }}>
                          ✏️ <strong>HÓA ĐƠN CHƯA THANH TOÁN:</strong><br />
                          Hóa đơn này chưa được thực hiện thanh toán trực quầy hay qua cổng trực tuyến. Do đó không thể yêu cầu hoàn trả tiền mặt hoặc hoàn trả buổi combo.
                          <br /><br />
                          Nếu quý khách muốn hủy/đổi lịch hoặc xóa hóa đơn chưa thanh toán này, vui lòng truy cập trang chi tiết lịch hẹn tương ứng để thao tác hủy.
                        </div>
                      </div>
                    )}

                    {/* CASE 2: PAID COMBO INVOICE */}
                    {paymentStatus === "PAID" && String(invoice?.PaymentInfo?.PaymentMethod || "").toUpperCase() === "PACKAGE" && (
                      <div className="rx-detail-card" style={{ border: "1.5px solid #e6d7b8", backgroundColor: "#faf6ee", padding: "22px" }}>
                        <div className="rx-section-title" style={{ marginBottom: "16px" }}>
                          <h2 style={{ color: "#85583f", fontSize: "16px", margin: 0, fontWeight: "bold" }}>Yêu cầu hoàn trả dịch vụ Combo</h2>
                          <p style={{ color: "#a78248", fontSize: "12px", margin: "4px 0 0" }}>Khôi phục buổi sử dụng combo cho khách hàng</p>
                        </div>

                        <div style={{ padding: "12px", borderRadius: "8px", background: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", fontSize: "0.85rem", marginBottom: "15px", fontWeight: "bold" }}>
                          📦 HÓA ĐƠN SỬ DỤNG COMBO:<br />
                          Khách hàng đã thanh toán hóa đơn này bằng cách trừ buổi trong Gói Combo. Khi xác nhận hoàn trả, hệ thống sẽ tự động cộng trả lại 1 buổi sử dụng vào Gói Combo của khách hàng.
                        </div>

                        <div className="rx-refund-form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#85583f", display: "block", marginBottom: "4px" }}>Lý do hoàn trả combo</label>
                            <input
                              value={refundReason}
                              onChange={(e) => setRefundReason(e.target.value)}
                              placeholder="Nhập lý do hoàn trả (VD: Khách đổi lịch, hủy lịch)..."
                              style={{ width: "100%", border: "1px solid #e6d7b8", padding: "10px 14px", borderRadius: "10px", outline: "none", boxSizing: "border-box", background: "#fff" }}
                            />
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={requestRefund}
                            style={{
                              width: "100%",
                              height: "46px",
                              fontWeight: "bold",
                              border: "0",
                              color: "#fff",
                              background: "linear-gradient(135deg, #85583f, #66412c)",
                              borderRadius: "12px",
                              cursor: "pointer",
                              marginTop: "5px",
                              boxShadow: "0 8px 16px rgba(102, 65, 44, 0.15)",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, #754b34, #573623)";
                            }}
                            onMouseLeave={(e) => {
                              if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, #85583f, #66412c)";
                            }}
                          >
                            {saving ? "Đang xử lý..." : "Xác nhận hoàn buổi combo"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CASE 3: PAID CASH/TRANSFER INVOICE */}
                    {paymentStatus === "PAID" && String(invoice?.PaymentInfo?.PaymentMethod || "").toUpperCase() !== "PACKAGE" && (
                      <div className="rx-detail-card" style={{ border: "1.5px solid #e6d7b8", backgroundColor: "#faf6ee", padding: "22px" }}>
                        <div className="rx-section-title" style={{ marginBottom: "16px" }}>
                          <h2 style={{ color: "#85583f", fontSize: "16px", margin: 0, fontWeight: "bold" }}>Yêu cầu hoàn tiền dịch vụ lẻ</h2>
                          <p style={{ color: "#a78248", fontSize: "12px", margin: "4px 0 0" }}>Hoàn tiền một phần hoặc toàn bộ số tiền hóa đơn</p>
                        </div>

                        <div style={{ padding: "12px", borderRadius: "8px", background: "#fee2e2", border: "1px solid #ef4444", color: "#b91c1c", fontSize: "0.85rem", marginBottom: "15px", fontWeight: "bold" }}>
                          💳 HÓA ĐƠN LẺ ĐÃ THANH TOÁN:<br />
                          Khách hàng đã thanh toán hóa đơn này bằng tiền mặt hoặc chuyển khoản trực tuyến. Sau khi tạo yêu cầu hoàn tiền, hệ thống sẽ chờ quản trị viên duyệt chi tiền.
                        </div>

                        <div className="rx-refund-form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e6d7b8", background: "#fff" }}>
                            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#85583f" }}>Số tiền hoàn (tự động cập nhật):</span>
                            <span style={{ fontSize: "16px", fontWeight: "800", color: "#d91f68" }}>{money(invoice.FinalAmount || invoice.Total)}</span>
                          </div>

                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#85583f", display: "block", marginBottom: "4px" }}>Ngân hàng nhận hoàn</label>
                            <select
                              value={bankCode}
                              onChange={(e) => setBankCode(e.target.value)}
                              style={{ width: "100%", border: "1px solid #e6d7b8", padding: "0 14px", borderRadius: "10px", outline: "none", height: "42px", boxSizing: "border-box", background: "#fff" }}
                            >
                              <option value="">-- Chọn ngân hàng --</option>
                              {bankList.map((b) => (
                                <option key={b.bin} value={b.bin}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#85583f", display: "block", marginBottom: "4px" }}>Số tài khoản nhận hoàn</label>
                            <input
                              type="text"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
                              placeholder="Số tài khoản ngân hàng..."
                              style={{ width: "100%", border: "1px solid #e6d7b8", padding: "10px 14px", borderRadius: "10px", outline: "none", boxSizing: "border-box", background: "#fff" }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#85583f", display: "block", marginBottom: "4px" }}>Tên chủ tài khoản (VIẾT HOA KHÔNG DẤU)</label>
                            <input
                              type="text"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                              placeholder="VD: NGUYEN VAN A..."
                              style={{ width: "100%", border: "1px solid #e6d7b8", padding: "10px 14px", borderRadius: "10px", outline: "none", boxSizing: "border-box", background: "#fff" }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#85583f", display: "block", marginBottom: "4px" }}>Lý do hoàn tiền</label>
                            <input
                              value={refundReason}
                              onChange={(e) => setRefundReason(e.target.value)}
                              placeholder="Nhập lý do (VD: Đổi dịch vụ, nhân viên nghỉ)..."
                              style={{ width: "100%", border: "1px solid #e6d7b8", padding: "10px 14px", borderRadius: "10px", outline: "none", boxSizing: "border-box", background: "#fff" }}
                            />
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={requestRefund}
                            style={{
                              width: "100%",
                              height: "46px",
                              fontWeight: "bold",
                              border: "0",
                              color: "#fff",
                              background: "linear-gradient(135deg, #85583f, #66412c)",
                              borderRadius: "12px",
                              cursor: "pointer",
                              marginTop: "5px",
                              boxShadow: "0 8px 16px rgba(102, 65, 44, 0.15)",
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                              if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, #754b34, #573623)";
                            }}
                            onMouseLeave={(e) => {
                              if (!saving) e.currentTarget.style.background = "linear-gradient(135deg, #85583f, #66412c)";
                            }}
                          >
                            {saving ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
