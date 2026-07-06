import { useState } from "react";
import axiosClient from "../../api/axiosClient";

const BRANCHES = [
  {
    id: 1,
    name: "LUNA Beauty Salon - Đà Nẵng",
    address: "123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    phone: "0900000001",
    hours: "08:00 - 20:00"
  },
  {
    id: 2,
    name: "LUNA Beauty Salon - Hồ Chí Minh",
    address: "88 Nguyễn Trãi, Quận 1, Hồ Chí Minh",
    phone: "0900000002",
    hours: "08:00 - 20:00"
  },
  {
    id: 3,
    name: "LUNA Beauty Salon - Hà Nội",
    address: "55 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    phone: "0900000003",
    hours: "08:00 - 20:00"
  }
];

export default function ContactPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", subject: "", content: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);

  async function submit(e) {
    e.preventDefault();
    try {
      setMessage(""); setError("");
      await axiosClient.post("/customers/contact", form);
      setMessage("Gửi liên hệ thành công. Salon sẽ phản hồi cho bạn sớm nhất.");
      setForm({ fullName: "", email: "", phone: "", subject: "", content: "" });
    } catch (err) { setError(err.response?.data?.message || "Gửi liên hệ thất bại"); }
  }

  return (
    <section className="section container">
      <style>{`
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .contact-card {
          background: #fff;
          border: 1px solid #f5d8e4;
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 18px 45px rgba(255,75,140,.08);
        }
        .contact-form {
          display: grid;
          gap: 14px;
        }
        .contact-form input,
        .contact-form textarea {
          border: 1px solid #efd8e1;
          border-radius: 16px;
          padding: 14px;
          font-family: inherit;
          outline: none;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .contact-form input:focus,
        .contact-form textarea:focus {
          border-color: #ef4f83;
        }
        .contact-list {
          display: grid;
          gap: 14px;
        }
        .contact-item {
          background: #fff7fb;
          border: 1px solid #f5d8e4;
          border-radius: 18px;
          padding: 16px;
        }
        .contact-item b {
          display: block;
          color: #ef4f83;
          font-size: 0.95rem;
          margin-bottom: 4px;
        }
        .contact-item p {
          margin: 0;
          color: #4b5563;
          font-size: 0.9rem;
        }
        .branches-section {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 24px;
        }
        .branch-card-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .branch-card-item {
          background: #fff;
          border: 1px solid #efd8e1;
          border-radius: 18px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .branch-card-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(255,75,140,.06);
          border-color: #ef4f83;
        }
        .branch-card-item.active {
          border-color: #ef4f83;
          background: #fff7fb;
          box-shadow: 0 8px 24px rgba(255,75,140,.08);
          border-width: 2px;
        }
        .branch-card-item h4 {
          margin: 0 0 6px 0;
          color: #2b2118;
          font-weight: 700;
          font-size: 1rem;
        }
        .branch-card-item.active h4 {
          color: #ef4f83;
        }
        .branch-card-item p {
          margin: 4px 0;
          font-size: 0.85rem;
          color: #6b7280;
        }
        .map-container {
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid #f5d8e4;
          box-shadow: 0 18px 45px rgba(255,75,140,.08);
          height: 100%;
          min-height: 420px;
        }
        @media(max-width:900px){
          .contact-grid, .branches-section {
            grid-template-columns: 1fr;
          }
          .map-container {
            min-height: 300px;
          }
        }
      `}</style>

      <div className="section-head">
        <div>
          <div className="eyebrow">Contact</div>
          <h2 className="section-title">Liên hệ Beauty Salon & Spa</h2>
          <p className="muted">Bạn có thể gửi câu hỏi, góp ý hoặc tra cứu hệ thống cửa hàng của chúng tôi.</p>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="contact-grid">
        <form className="contact-card contact-form" onSubmit={submit}>
          <input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Họ tên của bạn..."
            required
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email..."
            type="email"
            required
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Số điện thoại liên lạc..."
            required
          />
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Tiêu đề cần liên hệ..."
            required
          />
          <textarea
            rows="5"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Nội dung chi tiết..."
            required
          />
          <button className="btn">Gửi liên hệ</button>
        </form>

        <div className="contact-card contact-list">
          <div className="contact-item">
            <b>Hotline CSKH</b>
            <p>0123 456 789 (Hỗ trợ từ 08:00 - 22:00 hàng ngày)</p>
          </div>
          <div className="contact-item">
            <b>Email chính thức</b>
            <p>beautysalon@example.com</p>
          </div>
          <div className="contact-item">
            <b>Giờ mở cửa hệ thống</b>
            <p>08:00 - 20:00 các ngày trong tuần</p>
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: "60px", marginBottom: "20px" }}>
        <div>
          <div className="eyebrow">Our Branches</div>
          <h2 className="section-title">Hệ thống chi nhánh & Bản đồ chỉ đường</h2>
          <p className="muted">Chọn chi nhánh bất kỳ bên dưới để định vị trực tiếp trên bản đồ vệ tinh Google Maps.</p>
        </div>
      </div>

      <div className="branches-section">
        {/* Branches list card selection */}
        <div className="branch-card-list">
          {BRANCHES.map((b) => (
            <div
              key={b.id}
              className={`branch-card-item ${selectedBranch.id === b.id ? "active" : ""}`}
              onClick={() => setSelectedBranch(b)}
            >
              <h4>{b.name}</h4>
              <p>📍 Địa chỉ: {b.address}</p>
              <p>📞 Hotline: {b.phone}</p>
              <p>⏰ Phục vụ: {b.hours}</p>
            </div>
          ))}
        </div>

        {/* Dynamic google maps embed container */}
        <div className="map-container">
          <iframe
            title={`Bản đồ chi nhánh ${selectedBranch.name}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedBranch.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: "420px" }}
            allowFullScreen=""
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
