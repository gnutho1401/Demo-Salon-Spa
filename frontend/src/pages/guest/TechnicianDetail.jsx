import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function TechnicianDetail() {
  const { id } = useParams();
  const [tech, setTech] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get(`/employees/${id}`).then((res) => setTech(res.data.data || res.data)).finally(()=>setLoading(false));
  }, [id]);

  if (loading) return <section className="section container"><p>Đang tải kỹ thuật viên...</p></section>;
  if (!tech) return <section className="section container"><p>Không tìm thấy kỹ thuật viên</p></section>;

  return <section className="section container">
    <style>{`.tech-detail-page{display:grid;grid-template-columns:360px 1fr;gap:28px}.tech-photo-card,.tech-info-card{background:#fff;border:1px solid #f5d8e4;border-radius:26px;padding:24px;box-shadow:0 18px 45px rgba(255,75,140,.08)}.tech-photo-card img{width:100%;height:360px;object-fit:cover;border-radius:22px;background:#fff0f6}.tech-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:18px 0}.tech-info-box{background:#fff7fb;border:1px solid #f5d8e4;border-radius:16px;padding:14px}.tech-info-box b{display:block;margin-bottom:6px}@media(max-width:900px){.tech-detail-page,.tech-info-grid{grid-template-columns:1fr}}`}</style>
    <div className="tech-detail-page">
      <div className="tech-photo-card"><img src={resolveFileUrl(tech.ImageUrl)} alt={tech.FullName} /><div style={{marginTop:16}}><Link className="btn" to={`/customer/booking?employeeId=${tech.EmployeeId}`}>Đặt lịch với kỹ thuật viên này</Link></div></div>
      <div className="tech-info-card"><div className="eyebrow">Technician</div><h1>{tech.FullName}</h1><p className="muted">{tech.Position || "Kỹ thuật viên"} • {tech.Specialization || "Chăm sóc sắc đẹp"}</p><div className="tech-info-grid"><div className="tech-info-box"><b>Chi nhánh</b>{tech.BranchName || "Beauty Salon"}</div><div className="tech-info-box"><b>Trạng thái</b>{tech.Status || "ACTIVE"}</div><div className="tech-info-box"><b>Đánh giá</b>★★★★★ 4.8/5</div><div className="tech-info-box"><b>Lịch làm việc</b>08:00 - 20:00</div></div><p className="muted">Kỹ thuật viên có kinh nghiệm tư vấn, thực hiện dịch vụ và theo dõi liệu trình phù hợp với từng khách hàng.</p><Link className="btn btn-outline" to="/technicians">Quay lại danh sách</Link></div>
    </div>
  </section>;
}
