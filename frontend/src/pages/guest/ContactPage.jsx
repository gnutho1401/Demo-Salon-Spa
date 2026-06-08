import { useState } from "react";
import axiosClient from "../../api/axiosClient";

export default function ContactPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", subject: "", content: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      setMessage(""); setError("");
      await axiosClient.post("/customers/contact", form);
      setMessage("Gửi liên hệ thành công. Salon sẽ phản hồi cho bạn sớm nhất.");
      setForm({ fullName: "", email: "", phone: "", subject: "", content: "" });
    } catch (err) { setError(err.response?.data?.message || "Gửi liên hệ thất bại"); }
  }

  return <section className="section container">
    <style>{`.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.contact-card{background:#fff;border:1px solid #f5d8e4;border-radius:24px;padding:26px;box-shadow:0 18px 45px rgba(255,75,140,.08)}.contact-form{display:grid;gap:14px}.contact-form input,.contact-form textarea{border:1px solid #efd8e1;border-radius:16px;padding:14px}.contact-list{display:grid;gap:14px}.contact-item{background:#fff7fb;border:1px solid #f5d8e4;border-radius:18px;padding:16px}@media(max-width:900px){.contact-grid{grid-template-columns:1fr}}`}</style>
    <div className="section-head"><div><div className="eyebrow">Contact</div><h2 className="section-title">Liên hệ Beauty Salon & Spa</h2><p className="muted">Bạn có thể gửi câu hỏi, góp ý hoặc yêu cầu tư vấn dịch vụ tại đây.</p></div></div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    <div className="contact-grid">
      <form className="contact-card contact-form" onSubmit={submit}>
        <input value={form.fullName} onChange={(e)=>setForm({...form, fullName:e.target.value})} placeholder="Họ tên" />
        <input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} placeholder="Email" />
        <input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} placeholder="Số điện thoại" />
        <input value={form.subject} onChange={(e)=>setForm({...form, subject:e.target.value})} placeholder="Tiêu đề" />
        <textarea rows="6" value={form.content} onChange={(e)=>setForm({...form, content:e.target.value})} placeholder="Nội dung cần liên hệ" />
        <button className="btn">Gửi liên hệ</button>
      </form>
      <div className="contact-card contact-list">
        <div className="contact-item"><b>Hotline</b><p>0123 456 789</p></div>
        <div className="contact-item"><b>Email</b><p>beautysalon@example.com</p></div>
        <div className="contact-item"><b>Địa chỉ</b><p>Beauty Salon & Spa, chi nhánh trung tâm</p></div>
        <div className="contact-item"><b>Giờ mở cửa</b><p>08:00 - 20:00 mỗi ngày</p></div>
      </div>
    </div>
  </section>;
}
