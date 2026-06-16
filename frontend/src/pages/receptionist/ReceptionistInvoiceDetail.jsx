import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";
import "../../styles/pages/receptionist.css";

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
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

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
      invoice?.PaymentInfo?.Status ||
        invoice?.PaymentStatus ||
        invoice?.Status ||
        "UNPAID",
    ).toUpperCase();
  }, [invoice]);

  const canMarkPaid = paymentStatus !== "PAID";
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
      setSuccessMsg("Đã cập nhật hóa đơn thành đã thanh toán");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể xác nhận thanh toán");
    } finally {
      setSaving(false);
    }
  }

  async function requestRefund() {
    if (!refundReason.trim()) {
      setError("Vui lòng nhập lý do hoàn tiền");
      return;
    }

    if (!window.confirm("Tạo yêu cầu hoàn tiền cho hóa đơn này?")) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      await axiosClient.post(`/receptionist/invoices/${id}/refund`, {
        reason: refundReason,
        refundAmount:
          refundAmount || invoice?.FinalAmount || invoice?.Total || 0,
      });

      setRefundReason("");
      setRefundAmount("");
      await loadInvoice();
      setSuccessMsg("Đã tạo yêu cầu hoàn tiền");
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể tạo yêu cầu hoàn tiền",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReceptionistLayout>
      <div className="rx-page">
        <div className="rx-page-header">
          <div className="rx-title-block">
            <div className="rx-title-icon">🧾</div>
            <div>
              <h1>Chi tiết hóa đơn #{id}</h1>
              <p>Xem thông tin hóa đơn, dịch vụ, thanh toán và hoàn tiền.</p>
            </div>
          </div>

          <div className="rx-header-actions">
            <button
              className="rx-light-btn"
              type="button"
              onClick={() => navigate(-1)}
            >
              ← Quay lại
            </button>
            <button
              className="rx-primary-btn"
              type="button"
              onClick={loadInvoice}
            >
              ↻ Làm mới
            </button>
          </div>
        </div>

        {error && <div className="rcc-alert error">{error}</div>}
        {successMsg && <div className="rcc-alert success">{successMsg}</div>}

        {loading && (
          <div className="rx-table-card">
            <div className="rx-empty-row">Đang tải chi tiết hóa đơn...</div>
          </div>
        )}

        {!loading && !invoice && (
          <div className="rx-table-card">
            <div className="rx-empty-row">Không tìm thấy hóa đơn</div>
          </div>
        )}

        {!loading && invoice && (
          <>
            <div className="rx-invoice-hero">
              <div className="rx-invoice-summary-card">
                <span className="rx-muted-label">Tổng thanh toán</span>
                <strong>{money(invoice.FinalAmount || invoice.Total)}</strong>
                <span className={statusClass(paymentStatus)}>
                  {statusLabel(paymentStatus)}
                </span>
              </div>

              <div className="rx-invoice-summary-card">
                <span className="rx-muted-label">Mã lịch hẹn</span>
                <strong>#{invoice.AppointmentId || "-"}</strong>
                <span className={statusClass(invoice.AppointmentStatus)}>
                  {statusLabel(invoice.AppointmentStatus)}
                </span>
              </div>

              <div className="rx-invoice-summary-card">
                <span className="rx-muted-label">Ngày tạo</span>
                <strong>{formatDate(invoice.CreatedAt)}</strong>
                <span>{formatDateTime(invoice.CreatedAt)}</span>
              </div>
            </div>

            <div className="rx-detail-grid">
              <section className="rx-detail-card">
                <div className="rx-section-title">
                  <h2>Thông tin khách hàng</h2>
                  <p>Người thanh toán hóa đơn</p>
                </div>

                <div className="rx-info-list">
                  <div>
                    <span>Khách hàng</span>
                    <b>{invoice.CustomerName || "-"}</b>
                  </div>
                  <div>
                    <span>Số điện thoại</span>
                    <b>{invoice.CustomerPhone || "-"}</b>
                  </div>
                  <div>
                    <span>Email</span>
                    <b>{invoice.CustomerEmail || "-"}</b>
                  </div>
                </div>
              </section>

              <section className="rx-detail-card">
                <div className="rx-section-title">
                  <h2>Thông tin lịch hẹn</h2>
                  <p>Dữ liệu liên kết từ appointment</p>
                </div>

                <div className="rx-info-list">
                  <div>
                    <span>Kỹ thuật viên</span>
                    <b>{invoice.TechnicianName || "-"}</b>
                  </div>
                  <div>
                    <span>Ngày hẹn</span>
                    <b>{formatDate(invoice.AppointmentDate)}</b>
                  </div>
                  <div>
                    <span>Thời gian</span>
                    <b>
                      {invoice.StartTime || "-"} - {invoice.EndTime || "-"}
                    </b>
                  </div>
                </div>
              </section>
            </div>

            <section className="rx-table-card">
              <div className="rx-table-header">
                <div>
                  <h2>Dịch vụ trong hóa đơn</h2>
                  <p>Danh sách dịch vụ khách đã sử dụng hoặc đã đặt</p>
                </div>
              </div>

              <div className="rx-table-scroll">
                <table className="rx-appointment-table">
                  <thead>
                    <tr>
                      <th>Dịch vụ</th>
                      <th>Mã dịch vụ</th>
                      <th>Đơn giá</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(invoice.Services || []).map((s) => (
                      <tr key={s.ServiceId}>
                        <td>
                          <b>{s.ServiceName}</b>
                        </td>
                        <td>#{s.ServiceId}</td>
                        <td>{money(s.Price)}</td>
                      </tr>
                    ))}

                    {(!invoice.Services || invoice.Services.length === 0) && (
                      <tr>
                        <td colSpan="3" className="rx-empty-row">
                          Hóa đơn chưa có dịch vụ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rx-table-card">
              <div className="rx-table-header">
                <div>
                  <h2>Lịch sử thanh toán</h2>
                  <p>Toàn bộ giao dịch của hóa đơn này</p>
                </div>
              </div>

              <div className="rx-table-scroll">
                <table className="rx-appointment-table">
                  <thead>
                    <tr>
                      <th>Mã payment</th>
                      <th>Số tiền</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                      <th>Mã giao dịch</th>
                      <th>VNPay Ref</th>
                      <th>Ngày thanh toán</th>
                      <th>Ngày tạo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(invoice.Payments || []).map((p) => (
                      <tr key={p.PaymentId}>
                        <td>#{p.PaymentId}</td>
                        <td>{money(p.Amount)}</td>
                        <td>{p.PaymentMethod || "-"}</td>
                        <td>
                          <span className={statusClass(p.Status)}>
                            {statusLabel(p.Status)}
                          </span>
                        </td>
                        <td>{p.TransactionCode || "-"}</td>
                        <td>{p.VnpTxnRef || p.VnpTransactionNo || "-"}</td>
                        <td>{formatDateTime(p.PaidAt)}</td>
                        <td>{formatDateTime(p.CreatedAt)}</td>
                      </tr>
                    ))}

                    {(!invoice.Payments || invoice.Payments.length === 0) && (
                      <tr>
                        <td colSpan="8" className="rx-empty-row">
                          Chưa có giao dịch thanh toán
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rx-table-card">
              <div className="rx-table-header">
                <div>
                  <h2>Lịch sử hoàn tiền</h2>
                  <p>Theo dõi các yêu cầu hoàn tiền của hóa đơn</p>
                </div>
              </div>

              <div className="rx-table-scroll">
                <table className="rx-appointment-table">
                  <thead>
                    <tr>
                      <th>Mã refund</th>
                      <th>Mã payment</th>
                      <th>Số tiền hoàn</th>
                      <th>Trạng thái</th>
                      <th>Lý do</th>
                      <th>Mã giao dịch</th>
                      <th>Ngày tạo</th>
                      <th>Ngày hoàn tất</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(invoice.Refunds || []).map((r) => (
                      <tr key={r.RefundId}>
                        <td>#{r.RefundId}</td>
                        <td>#{r.PaymentId}</td>
                        <td>{money(r.RefundAmount)}</td>
                        <td>
                          <span className={statusClass(r.RefundStatus)}>
                            {statusLabel(r.RefundStatus)}
                          </span>
                        </td>
                        <td>{r.RefundReason || "-"}</td>
                        <td>{r.TransactionCode || "-"}</td>
                        <td>{formatDateTime(r.CreatedAt)}</td>
                        <td>{formatDateTime(r.RefundedAt)}</td>
                      </tr>
                    ))}

                    {(!invoice.Refunds || invoice.Refunds.length === 0) && (
                      <tr>
                        <td colSpan="8" className="rx-empty-row">
                          Chưa có lịch sử hoàn tiền
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rx-detail-grid">
              <section className="rx-detail-card">
                <div className="rx-section-title">
                  <h2>Tổng tiền</h2>
                  <p>Chi tiết số tiền hóa đơn</p>
                </div>

                <div className="rx-money-box">
                  <div>
                    <span>Tạm tính</span>
                    <b>{money(invoice.Total)}</b>
                  </div>
                  <div>
                    <span>Giảm giá</span>
                    <b>- {money(invoice.Discount)}</b>
                  </div>
                  <div className="rx-total-line">
                    <span>Cần thanh toán</span>
                    <b>{money(invoice.FinalAmount || invoice.Total)}</b>
                  </div>
                </div>
              </section>

              <section className="rx-detail-card">
                <div className="rx-section-title">
                  <h2>Thanh toán</h2>
                  <p>Cập nhật trạng thái thanh toán tại quầy</p>
                </div>

                <div className="rx-info-list">
                  <div>
                    <span>Trạng thái</span>
                    <b>{statusLabel(paymentStatus)}</b>
                  </div>
                  <div>
                    <span>Phương thức</span>
                    <b>{invoice.PaymentInfo?.PaymentMethod || "-"}</b>
                  </div>
                  <div>
                    <span>Mã giao dịch</span>
                    <b>{invoice.PaymentInfo?.TransactionCode || "-"}</b>
                  </div>
                  <div>
                    <span>Thời gian thanh toán</span>
                    <b>{formatDateTime(invoice.PaymentInfo?.PaidAt)}</b>
                  </div>
                </div>

                {canMarkPaid && (
                  <div className="rx-inline-action">
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="CARD">Thẻ</option>
                      <option value="TRANSFER">Chuyển khoản</option>
                      <option value="VNPAY">VNPay</option>
                      <option value="MOMO">MoMo</option>
                    </select>

                    <button
                      className="rx-primary-btn"
                      type="button"
                      disabled={saving}
                      onClick={markPaid}
                    >
                      Xác nhận đã thanh toán
                    </button>
                  </div>
                )}
              </section>
            </div>

            <section className="rx-detail-card">
              <div className="rx-section-title">
                <h2>Hoàn tiền</h2>
                <p>Chỉ tạo yêu cầu hoàn tiền khi hóa đơn đã thanh toán</p>
              </div>

              {invoice.RefundInfo ? (
                <div className="rx-refund-box">
                  <div>
                    <span>Mã hoàn tiền</span>
                    <b>#{invoice.RefundInfo.RefundId}</b>
                  </div>
                  <div>
                    <span>Số tiền hoàn</span>
                    <b>{money(invoice.RefundInfo.RefundAmount)}</b>
                  </div>
                  <div>
                    <span>Trạng thái</span>
                    <b>{statusLabel(invoice.RefundInfo.RefundStatus)}</b>
                  </div>
                  <div>
                    <span>Lý do</span>
                    <b>{invoice.RefundInfo.RefundReason || "-"}</b>
                  </div>
                </div>
              ) : canRefund ? (
                <div className="rx-refund-form">
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Số tiền hoàn, mặc định ${money(invoice.FinalAmount || invoice.Total)}`}
                  />

                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Nhập lý do hoàn tiền"
                  />

                  <button
                    className="rx-outline-pink-btn"
                    type="button"
                    disabled={saving}
                    onClick={requestRefund}
                  >
                    Tạo yêu cầu hoàn tiền
                  </button>
                </div>
              ) : (
                <div className="rx-empty-row">
                  Hóa đơn chưa đủ điều kiện hoàn tiền hoặc chưa thanh toán.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ReceptionistLayout>
  );
}
