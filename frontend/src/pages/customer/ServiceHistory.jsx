import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerLayout from "../../components/layout/CustomerLayout";
import axiosClient from "../../api/axiosClient";

export default function ServiceHistory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    axiosClient.get("/appointments/my")
      .then((res) => setRows(res.data.data || []))
      .catch((err) => setMessage(err.response?.data?.message || "Không tải được lịch sử dịch vụ"));
  }, []);

  const completed = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return rows
      .filter((r) => String(r.Status || "").toUpperCase() === "COMPLETED")
      .filter((r) => !text ||
        String(r.ServiceName || "").toLowerCase().includes(text) ||
        String(r.EmployeeName || "").toLowerCase().includes(text) ||
        String(r.Notes || "").toLowerCase().includes(text)
      );
  }, [rows, keyword]);

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa có";
  }

  function formatTime(value) {
    return String(value || "").slice(0, 5);
  }

  return (
    <CustomerLayout>
      <style>{`
        .history-page{padding:10px 0 40px}.history-head{background:linear-gradient(135deg,#fff5fa,#fff);border:1px solid #ffd7e6;border-radius:26px;padding:26px 30px;margin-bottom:20px;box-shadow:0 20px 45px rgba(255,75,140,.08)}.history-head h2{margin:0;font-size:32px;font-weight:900}.history-tools{background:#fff;border:1px solid #f5d8e4;border-radius:20px;padding:16px;margin-bottom:18px}.history-tools input{width:100%;padding:13px 15px;border-radius:14px;border:1px solid #efd8e1}.history-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.history-card{background:#fff;border:1px solid #f5d8e4;border-radius:22px;padding:18px;box-shadow:0 14px 34px rgba(255,75,140,.07)}.history-card h3{margin:0 0 8px}.history-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}.history-meta span{background:#fff7fb;border:1px solid #f5d8e4;border-radius:14px;padding:10px}.history-actions{display:flex;gap:10px;flex-wrap:wrap}.btn-soft{background:#fff0f6;color:#ff3f86;border:1px solid #ffc9dd}@media(max-width:900px){.history-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="history-page">
        <div className="history-head">
          <h2>Lịch sử dịch vụ</h2>
          <p className="muted">Chỉ hiển thị các dịch vụ đã hoàn thành. Bạn có thể đánh giá hoặc đặt lại nhanh.</p>
        </div>
        {message && <div className="alert error">{message}</div>}
        <div className="history-tools">
          <input placeholder="Tìm theo dịch vụ, kỹ thuật viên, ghi chú..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        {completed.length === 0 ? <div className="dashboard-card"><h3>Chưa có dịch vụ hoàn thành</h3><p className="muted">Khi lịch hẹn được hoàn thành, thông tin sẽ hiển thị ở đây.</p></div> : null}
        <div className="history-grid">
          {completed.map((r) => (
            <div className="history-card" key={r.AppointmentId}>
              <h3>{r.ServiceName || "Dịch vụ"}</h3>
              <p className="muted">Mã lịch: AP{String(r.AppointmentId).padStart(5, "0")}</p>
              <div className="history-meta">
                <span><b>Kỹ thuật viên</b><br />{r.EmployeeName || "Chưa có"}</span>
                <span><b>Ngày giờ</b><br />{formatDate(r.AppointmentDate)} • {formatTime(r.StartTime)}</span>
                <span><b>Chi phí</b><br />{formatMoney(r.FinalAmount || r.TotalAmount || r.Price)}</span>
                <span><b>Thanh toán</b><br />{r.PaymentStatus || "UNPAID"}</span>
              </div>
              <div className="history-actions">
                <Link className="btn btn-soft" to={`/customer/appointments/${r.AppointmentId}`}>Chi tiết</Link>
                <Link className="btn" to={`/customer/feedback?appointmentId=${r.AppointmentId}`}>Đánh giá</Link>
                <button className="btn" type="button" onClick={() => navigate(`/customer/booking?serviceId=${r.ServiceId || ""}&employeeId=${r.EmployeeId || ""}`)}>Đặt lại</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
}
