import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";

const DEFAULT_BRANCHES = [
  {
    BranchId: 1,
    BranchName: "LUNA Beauty Salon - Hải Châu",
    Address: "123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    Phone: "0900 000 001",
    Hours: "08:00 - 20:00"
  },
  {
    BranchId: 2,
    BranchName: "LUNA Beauty Salon - Thanh Khê",
    Address: "456 Điện Biên Phủ, Thanh Khê, Đà Nẵng",
    Phone: "0900 000 002",
    Hours: "08:00 - 20:00"
  }
];

export default function ContactPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", subject: "", content: "" });
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(DEFAULT_BRANCHES[0]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await axiosClient.get("/employees/branches");
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data) && data.length > 0) {
          // Map hours if missing
          const mapped = data.map((b) => ({
            ...b,
            Hours: b.Hours || "08:00 - 20:00"
          }));
          setBranches(mapped);
          setSelectedBranch(mapped[0]);
        } else {
          setBranches(DEFAULT_BRANCHES);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách chi nhánh:", err);
        setBranches(DEFAULT_BRANCHES);
      } finally {
        setLoadingBranches(false);
      }
    }
    fetchBranches();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;

    // Client validation
    if (!form.fullName.trim() || !form.content.trim()) {
      setError("Vui lòng nhập họ tên và nội dung liên hệ");
      return;
    }
    const phoneRegex = /^[0-9+ ]{9,15}$/;
    if (form.phone && !phoneRegex.test(form.phone)) {
      setError("Số điện thoại không đúng định dạng");
      return;
    }

    setSubmitting(true);
    setMessage(""); 
    setError("");

    try {
      await axiosClient.post("/customers/contact", form);
      setMessage(" Gửi liên hệ thành công. Chúng tôi sẽ phản hồi lại cho bạn sớm nhất!");
      setForm({ fullName: "", email: "", phone: "", subject: "", content: "" });
      // Clear message after 5 seconds
      setTimeout(() => setMessage(""), 6000);
    } catch (err) { 
      setError(err.response?.data?.message || "Gửi liên hệ thất bại. Vui lòng thử lại sau."); 
      setTimeout(() => setError(""), 5000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="contact-page-container">
      <style>{`
        .contact-page-container {
          padding: 50px 24px 100px;
          background: linear-gradient(180deg, #fffafc 0%, #ffffff 40%, #fffbfd 100%);
          min-height: 100vh;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .contact-hero {
          max-width: 1200px;
          margin: 0 auto 40px;
          text-align: center;
        }

        .contact-hero .eyebrow {
          text-transform: uppercase;
          font-size: 13px;
          font-weight: 800;
          color: #ff4778;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }

        .contact-hero h1 {
          font-size: clamp(30px, 4vw, 46px);
          font-weight: 900;
          color: #1a0b14;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        .contact-hero p {
          font-size: 16px;
          color: #6d5c68;
          max-width: 650px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .contact-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 36px;
          margin-bottom: 60px;
        }

        .contact-card {
          background: #ffffff;
          border: 1px solid rgba(255, 224, 235, 0.8);
          border-radius: 28px;
          padding: 36px;
          box-shadow: 0 12px 40px rgba(226, 59, 117, 0.03);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .contact-card-title {
          font-size: 22px;
          font-weight: 800;
          color: #1a0b14;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .contact-form {
          display: grid;
          gap: 18px;
        }

        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .contact-form label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #4a3e47;
          margin-bottom: 6px;
        }

        .contact-form input,
        .contact-form textarea {
          width: 100%;
          border: 1.5px solid rgba(255, 224, 235, 0.8);
          border-radius: 16px;
          padding: 14px 18px;
          font-family: inherit;
          outline: none;
          font-size: 14px;
          color: #1a0b14;
          box-sizing: border-box;
          background: #fffdfd;
          transition: all 0.3s ease;
        }

        .contact-form input:focus,
        .contact-form textarea:focus {
          border-color: #ff4778;
          box-shadow: 0 0 0 4px rgba(255, 71, 120, 0.1);
          background: #ffffff;
        }

        .btn-submit-contact {
          padding: 16px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%);
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(239, 79, 131, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-submit-contact:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(239, 79, 131, 0.4);
        }

        .btn-submit-contact:disabled {
          background: #e2e8f0;
          color: #94a3b8;
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }

        .info-side-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .info-card-item {
          background: #fffdfd;
          border: 1px solid rgba(255, 224, 235, 0.6);
          border-radius: 22px;
          padding: 24px;
          display: flex;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .info-card-item:hover {
          transform: translateX(5px);
          border-color: rgba(255, 71, 120, 0.2);
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(226, 59, 117, 0.04);
        }

        .info-icon-wrapper {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          background: #fff0f5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #ff4778;
          flex-shrink: 0;
        }

        .info-details b {
          display: block;
          font-size: 15px;
          color: #1a0b14;
          margin-bottom: 6px;
          font-weight: 800;
        }

        .info-details p {
          margin: 0;
          color: #6d5c68;
          font-size: 13.5px;
          line-height: 1.5;
        }

        /* --- BRANCHES AREA --- */
        .branches-heading {
          max-width: 1200px;
          margin: 40px auto 24px;
          border-top: 2px solid #fff0f5;
          padding-top: 40px;
        }

        .branches-heading h2 {
          font-size: 28px;
          font-weight: 900;
          color: #1a0b14;
          margin: 0 0 6px;
        }

        .branches-heading p {
          font-size: 15px;
          color: #6d5c68;
          margin: 0;
        }

        .branches-section {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 36px;
        }

        .branch-card-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .branch-card-item {
          background: #ffffff;
          border: 1px solid rgba(255, 224, 235, 0.6);
          border-radius: 22px;
          padding: 22px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .branch-card-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(226, 59, 117, 0.05);
          border-color: rgba(255, 71, 120, 0.3);
        }

        .branch-card-item.active {
          border-color: #ff4778;
          background: #fffafc;
          box-shadow: 0 12px 30px rgba(226, 59, 117, 0.08);
          border-width: 2px;
        }

        .branch-card-item h4 {
          margin: 0 0 10px 0;
          color: #1a0b14;
          font-weight: 800;
          font-size: 16px;
        }

        .branch-card-item.active h4 {
          color: #ff4778;
        }

        .branch-meta-row {
          margin: 6px 0;
          font-size: 13.5px;
          color: #6d5c68;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .branch-meta-row span.icon {
          color: #ff4778;
          font-size: 14px;
        }

        .map-container {
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid rgba(255, 224, 235, 0.8);
          box-shadow: 0 12px 40px rgba(226, 59, 117, 0.04);
          height: 100%;
          min-height: 440px;
        }

        @media (max-width: 900px) {
          .contact-grid, .branches-section {
            grid-template-columns: 1fr;
          }
          .form-row-2 {
            grid-template-columns: 1fr;
          }
          .map-container {
            min-height: 320px;
          }
        }
      `}</style>

      {/* Hero */}
      <div className="contact-hero">
        <div className="eyebrow">Liên Hệ & Tra Cứu</div>
        <h1>Beauty Salon & Spa Center</h1>
        <p>Gửi ý kiến đóng góp, câu hỏi phản hồi hoặc tra cứu vị trí các chi nhánh làm đẹp trong hệ thống trên bản đồ.</p>
      </div>

      {/* Alerts */}
      {message && <div className="alert success" style={{ maxWidth: 1200, margin: "0 auto 24px", borderRadius: "16px" }}>{message}</div>}
      {error && <div className="alert error" style={{ maxWidth: 1200, margin: "0 auto 24px", borderRadius: "16px" }}>{error}</div>}

      {/* Contact Grid */}
      <div className="contact-grid">
        <form className="contact-card contact-form" onSubmit={submit}>
          <div className="contact-card-title">
            <span>✉️</span> Gửi tin nhắn cho chúng tôi
          </div>

          <div className="form-row-2">
            <div>
              <label>Họ và tên <span style={{ color: "#ef4f83" }}>*</span></label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>
            <div>
              <label>Số điện thoại <span style={{ color: "#ef4f83" }}>*</span></label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="09xx xxx xxx"
                required
              />
            </div>
          </div>

          <div>
            <label>Địa chỉ Email <span style={{ color: "#ef4f83" }}>*</span></label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@gmail.com"
              type="email"
              required
            />
          </div>

          <div>
            <label>Tiêu đề liên hệ <span style={{ color: "#ef4f83" }}>*</span></label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Tư vấn dịch vụ / Phản hồi chất lượng..."
              required
            />
          </div>

          <div>
            <label>Nội dung chi tiết <span style={{ color: "#ef4f83" }}>*</span></label>
            <textarea
              rows="5"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Nội dung bạn muốn trao đổi chi tiết với bộ phận chăm sóc khách hàng..."
              required
            />
          </div>

          <button className="btn-submit-contact" type="submit" disabled={submitting}>
            {submitting ? "⌛ Đang gửi liên hệ..." : "🚀 Gửi liên hệ ngay"}
          </button>
        </form>

        <div className="info-side-list">
          <div className="info-card-item">
            <div className="info-icon-wrapper">📞</div>
            <div className="info-details">
              <b>Tổng đài chăm sóc khách hàng</b>
              <p>1900 1234 (Miễn phí cuộc gọi)</p>
              <p>Hotline: 0123 456 789 (Hỗ trợ khẩn cấp 08:00 - 20:00)</p>
            </div>
          </div>

          <div className="info-card-item">
            <div className="info-icon-wrapper">✉️</div>
            <div className="info-details">
              <b>Hòm thư điện tử chính thức</b>
              <p>support@beautysalon.com</p>
              <p>contact@beautysalon.com</p>
            </div>
          </div>

          <div className="info-card-item">
            <div className="info-icon-wrapper">⏰</div>
            <div className="info-details">
              <b>Thời gian hoạt động hệ thống</b>
              <p>Thứ 2 - Chủ Nhật hàng tuần</p>
              <p>Giờ làm việc: 08:00 - 20:00 (Kể cả ngày Lễ/Tết)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branches Header */}
      <div className="branches-heading">
        <h2>Hệ thống chi nhánh & Bản đồ định vị</h2>
        <p>Chọn chi nhánh bất kỳ bên dưới để hiển thị địa chỉ chi tiết và định vị đường đi trên bản đồ Google Maps.</p>
      </div>

      {/* Branches Grid */}
      <div className="branches-section">
        <div className="branch-card-list">
          {loadingBranches ? (
            <p style={{ color: "#8c7c85", padding: "10px" }}>Đang tải danh sách chi nhánh...</p>
          ) : (
            branches.map((b) => (
              <div
                key={b.BranchId}
                className={`branch-card-item ${selectedBranch.BranchId === b.BranchId ? "active" : ""}`}
                onClick={() => setSelectedBranch(b)}
              >
                <h4>{b.BranchName}</h4>
                <div className="branch-meta-row">
                  <span className="icon">📍</span>
                  <span>{b.Address}</span>
                </div>
                <div className="branch-meta-row">
                  <span className="icon">📞</span>
                  <span>Hotline: {b.Phone || "Đang cập nhật"}</span>
                </div>
                <div className="branch-meta-row">
                  <span className="icon">⏰</span>
                  <span>Giờ mở cửa: {b.Hours || "08:00 - 20:00"}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Maps container */}
        <div className="map-container">
          <iframe
            title={`Bản đồ chi nhánh ${selectedBranch.BranchName}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedBranch.Address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: "440px" }}
            allowFullScreen=""
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
