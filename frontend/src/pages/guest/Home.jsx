import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function Home() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [techs, setTechs] = useState([]);
  const [search, setSearch] = useState({ serviceId: "", employeeId: "", appointmentDate: "" });

  useEffect(() => {
    axiosClient
      .get("/services")
      .then((res) => setServices(res.data.data || res.data || []))
      .catch((err) => console.log("Lỗi lấy services:", err));

    axiosClient
      .get("/employees")
      .then((res) => setTechs(res.data.data || res.data || []))
      .catch((err) => console.log("Lỗi lấy employees:", err));
  }, []);

  const handleQuickBooking = () => {
    const params = new URLSearchParams();
    if (search.serviceId) params.set("serviceId", search.serviceId);
    if (search.employeeId) params.set("employeeId", search.employeeId);
    if (search.appointmentDate) params.set("date", search.appointmentDate);
    navigate(`/customer/booking${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-content animated-panel">
            <div className="eyebrow">Beauty Salon Management System</div>
            <h1>
              Tỏa sáng vẻ đẹp <span>Tự tin mỗi ngày</span>
            </h1>
            <p>
              Beauty Salon & Spa hỗ trợ khách hàng xem dịch vụ, chọn kỹ thuật viên,
              đặt lịch, thanh toán và theo dõi lịch hẹn nhanh chóng.
            </p>

            <div className="hero-actions">
              <Link to="/customer/booking" className="btn">Đặt lịch ngay</Link>
              <Link to="/services" className="btn btn-outline">Xem dịch vụ</Link>
              <Link to="/technicians" className="btn btn-outline">Xem kỹ thuật viên</Link>
            </div>

            <div className="features-mini">
              <span>🎧 Đội ngũ chuyên nghiệp</span>
              <span>💎 Dịch vụ cao cấp</span>
              <span>🌸 Đặt lịch rõ ràng</span>
            </div>
          </div>

          <div className="hero-img">
            <img src="http://localhost:5000/images/home/hero-girl.png" alt="Beauty Girl" />
          </div>
        </div>
      </section>

      <div className="container search-box enhanced-search">
        <div className="field">
          <span className="field-icon">💆</span>
          <div>
            <small>Chọn dịch vụ</small>
            <select value={search.serviceId} onChange={(e) => setSearch((prev) => ({ ...prev, serviceId: e.target.value }))}>
              <option value="">Tất cả dịch vụ</option>
              {services.map((s) => <option key={s.ServiceId} value={s.ServiceId}>{s.ServiceName}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field-icon">👩‍🔧</span>
          <div>
            <small>Chọn kỹ thuật viên</small>
            <select value={search.employeeId} onChange={(e) => setSearch((prev) => ({ ...prev, employeeId: e.target.value }))}>
              <option value="">Bất kỳ</option>
              {techs.map((t) => <option key={t.EmployeeId} value={t.EmployeeId}>{t.FullName}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field-icon">📅</span>
          <div>
            <small>Chọn ngày</small>
            <input type="date" value={search.appointmentDate} onChange={(e) => setSearch((prev) => ({ ...prev, appointmentDate: e.target.value }))} />
          </div>
        </div>

        <button className="btn" type="button" onClick={handleQuickBooking}>Tìm & đặt lịch</button>
      </div>

      <section className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Dịch vụ của chúng tôi</div>
            <h2 className="section-title">Dịch vụ nổi bật</h2>
          </div>
          <Link className="see-all" to="/services">Xem tất cả dịch vụ →</Link>
        </div>

        <div className="grid">
          {services.slice(0, 5).map((s) => (
            <div className="service-card glow-card" key={s.ServiceId}>
              <img src={resolveFileUrl(s.ImageUrl)} alt={s.ServiceName} />
              <div className="service-body">
                <p className="eyebrow">{s.CategoryName || "Beauty Service"}</p>
                <h3>{s.ServiceName}</h3>
                <p className="muted">
                  {s.DurationMinutes} phút
                  <span className="price" style={{ float: "right" }}>{Number(s.Price).toLocaleString("vi-VN")}đ</span>
                </p>
                <div className="card-action-row">
                  <Link to={`/services/${s.ServiceId}`}><button className="card-btn">Chi tiết</button></Link>
                  <Link to={`/customer/booking?serviceId=${s.ServiceId}`}><button className="card-btn primary">Đặt lịch</button></Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div id="promotion" className="banner">
          <div>
            <div className="eyebrow">Khuyến mãi hấp dẫn</div>
            <h2>Ưu đãi đặc biệt tháng này</h2>
            <p>Giảm ngay 20% cho khách hàng mới và thành viên thân thiết.</p>
            <Link className="btn" to="/services">Xem dịch vụ ưu đãi</Link>
          </div>
          <div className="discount">20%<br /><small>OFF</small></div>
        </div>
      </section>

      <section id="about" className="section why">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow">Vì sao chọn chúng tôi?</div>
            <h2 className="section-title">Trải nghiệm khác biệt</h2>
          </div>

          <div className="grid why-grid">
            <div className="why-item"><div className="circle">👩‍⚕️</div><h3>Đội ngũ chuyên nghiệp</h3><p className="muted">Kỹ thuật viên giàu kinh nghiệm.</p></div>
            <div className="why-item"><div className="circle">🎁</div><h3>Sản phẩm cao cấp</h3><p className="muted">An toàn cho sức khỏe.</p></div>
            <div className="why-item"><div className="circle">🏠</div><h3>Không gian sang trọng</h3><p className="muted">Sạch sẽ, thư giãn tuyệt đối.</p></div>
            <div className="why-item"><div className="circle">💗</div><h3>Dịch vụ tận tâm</h3><p className="muted">Chăm sóc khách hàng chu đáo.</p></div>
          </div>
        </div>
      </section>

      <section id="technicians" className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Kỹ thuật viên nổi bật</div>
            <h2 className="section-title">Đội ngũ chuyên gia</h2>
          </div>
          <Link className="see-all" to="/technicians">Xem tất cả →</Link>
        </div>

        <div className="tech-grid">
          {techs.slice(0, 4).map((t, index) => (
            <div className="tech-card glow-card" key={t.EmployeeId}>
              <div className="tech-img-box"><img src={resolveFileUrl(t.ImageUrl)} alt={t.FullName} /></div>
              <div className="tech-info">
                <h3>{t.FullName}</h3>
                <p>Chuyên viên {t.Specialization || t.Position || "Beauty"}</p>
                <span className="exp">{5 + index} năm kinh nghiệm</span>
                <div className="tech-actions-center">
                  <Link className="card-btn" to="/technicians">Xem hồ sơ</Link>
                  <Link className="card-btn primary" to={`/customer/booking?employeeId=${t.EmployeeId}`}>Đặt lịch</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section testimonials">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Khách hàng nói về chúng tôi</div>
              <h2 className="section-title">Cảm nhận từ khách hàng</h2>
            </div>
          </div>

          <div className="grid">
            <div className="testimonial"><h2 style={{ color: "#ef4f83" }}>“</h2><p>Dịch vụ tuyệt vời. Nhân viên tư vấn nhiệt tình, kỹ thuật viên tay nghề cao.</p><b>Nguyễn Thanh Hằng</b><p className="stars">★★★★★</p></div>
            <div className="testimonial"><h2 style={{ color: "#ef4f83" }}>“</h2><p>Không gian đẹp, thư giãn, giá cả hợp lý. Đặc biệt thích dịch vụ chăm sóc da.</p><b>Trần Thị Mai</b><p className="stars">★★★★★</p></div>
          </div>

          <div className="newsletter">
            <div>
              <div className="eyebrow">Đăng ký nhận tin</div>
              <h2>Nhận ngay ưu đãi đặc biệt!</h2>
              <p className="muted">Đăng ký email để nhận thông tin khuyến mãi mới nhất.</p>
            </div>
            <div><input placeholder="Nhập email của bạn" /> <button className="btn">Đăng ký</button></div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="container footer-grid">
        <div>
          <div className="logo">🌸<div>Beauty<span>Salon & Spa</span></div></div>
          <p className="muted">Nơi tôn vinh vẻ đẹp và mang đến sự tự tin cho bạn.</p>
        </div>
        <div><h4>Dịch vụ</h4><ul><li>Chăm sóc da mặt</li><li>Massage thư giãn</li><li>Nail cao cấp</li><li>Làm tóc</li></ul></div>
        <div><h4>Hỗ trợ</h4><ul><li>Hướng dẫn đặt lịch</li><li>Chính sách bảo mật</li><li>Câu hỏi thường gặp</li></ul></div>
        <div><h4>Liên hệ</h4><ul><li>☎ 0123 456 789</li><li>✉ spa@beautysalon.com</li><li>📍 Đà Nẵng</li></ul></div>
      </div>
    </footer>
  );
}
