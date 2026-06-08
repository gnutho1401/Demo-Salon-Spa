import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState(null);

  useEffect(() => {
    axiosClient
      .get(`/services/${id}`)
      .then((res) => setService(res.data.data || res.data))
      .catch((err) => console.log(err));
  }, [id]);

  if (!service) return <p className="container">Đang tải...</p>;

  return (
    <section className="section container">
      <div
        className="dashboard-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 30,
          alignItems: "center",
        }}
      >
        <img
          style={{ width: "100%", borderRadius: 18 }}
          src={resolveFileUrl(service.ImageUrl)}
          alt={service.ServiceName}
        />

        <div>
          <div className="eyebrow">{service.CategoryName}</div>
          <h1 className="section-title">{service.ServiceName}</h1>

          <p className="muted">{service.Description}</p>

          <p>
            <b>Thời lượng:</b> {service.DurationMinutes} phút
          </p>

          <p>
            <b>Giá:</b>{" "}
            <span className="price">
              {Number(service.Price).toLocaleString("vi-VN")}đ
            </span>
          </p>

          <Link to={`/customer/booking?serviceId=${service.ServiceId}`} className="btn">
            Đặt lịch dịch vụ này
          </Link>
        </div>
      </div>
    </section>
  );
}
