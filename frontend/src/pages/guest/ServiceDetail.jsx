import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_IMAGE = "/images/services/default-service.png";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [service, setService] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function money(value) {
    return Number(value || 0).toLocaleString("vi-VN") + "đ";
  }

  function image(url) {
    return resolveFileUrl(url) || DEFAULT_IMAGE;
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [serviceRes, techRes] = await Promise.all([
          axiosClient.get(`/services/${id}`),
          axiosClient.get(`/employees/by-service/${id}`),
        ]);

        setService(serviceRes.data.data || serviceRes.data);
        setTechnicians(techRes.data.data || techRes.data || []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Không tải được chi tiết dịch vụ",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  function handleBooking(employeeId = "") {
    const url = `/customer/booking?serviceId=${id}${
      employeeId ? `&employeeId=${employeeId}` : ""
    }`;

    if (!user) {
      navigate(`/login?redirectUrl=${encodeURIComponent(url)}`);
      return;
    }

    navigate(url);
  }

  if (loading) {
    return (
      <section className="section container">
        <p>Đang tải chi tiết dịch vụ...</p>
      </section>
    );
  }

  if (error || !service) {
    return (
      <section className="section container">
        <div className="dashboard-card">
          <h3>Không tìm thấy dịch vụ</h3>
          <p className="muted">{error}</p>
          <Link className="btn" to="/services">
            Quay lại dịch vụ
          </Link>
        </div>
      </section>
    );
  }

  const getTreatmentSteps = (categoryName, serviceName) => {
    const cat = (categoryName || "").toLowerCase();
    const name = (serviceName || "").toLowerCase();
    if (cat.includes("massage") || name.includes("massage")) {
      return [
        {
          title: "Bước 1: Khởi động & Giãn cơ",
          desc: "Xoa bóp nhẹ nhàng vùng lưng và vai với tinh dầu thảo dược giúp giãn cơ, tăng tuần hoàn.",
        },
        {
          title: "Bước 2: Trị liệu chuyên sâu",
          desc: "Tác động lực vừa phải lên các nhóm cơ căng cứng, miết dọc sống lưng để giải phóng các điểm chèn ép.",
        },
        {
          title: "Bước 3: Ấn huyệt giải độc",
          desc: "Bấm các huyệt vị quan trọng trên cơ thể để kích thích đào thải độc tố và xua tan căng thẳng mệt mỏi.",
        },
        {
          title: "Bước 4: Thư giãn & Làm sạch",
          desc: "Đắp khăn nóng thảo dược giúp lưu thông khí huyết và lau sạch tinh dầu thừa nhẹ nhàng.",
        },
      ];
    }
    if (
      cat.includes("tóc") ||
      cat.includes("hair") ||
      name.includes("tóc") ||
      name.includes("nhuộm")
    ) {
      return [
        {
          title: "Bước 1: Tư vấn & Kiểm tra da đầu",
          desc: "Chuyên gia kiểm tra tình trạng tóc, da đầu và tư vấn kiểu dáng, màu sắc hoặc liệu trình phục hồi phù hợp.",
        },
        {
          title: "Bước 2: Gội xả sinh học thư giãn",
          desc: "Gội đầu thảo dược nhẹ nhàng giúp làm sạch bụi bẩn, bã nhờn và massage da đầu lưu thông khí huyết.",
        },
        {
          title: "Bước 3: Kỹ thuật chuyên sâu",
          desc: "Tiến hành cắt, uốn, duỗi, nhuộm hoặc hấp phục hồi keratin cao cấp bằng máy móc chuyên nghiệp.",
        },
        {
          title: "Bước 4: Dưỡng tóc & Tạo nếp",
          desc: "Thoa serum dưỡng bóng tóc chống tia UV và sấy tạo kiểu bồng bềnh tự nhiên.",
        },
      ];
    }
    if (
      cat.includes("da") ||
      cat.includes("skin") ||
      name.includes("da") ||
      name.includes("detox") ||
      name.includes("mặt")
    ) {
      return [
        {
          title: "Bước 1: Rửa mặt sạch sâu",
          desc: "Dùng sữa rửa mặt dịu nhẹ loại bỏ lớp trang điểm, kem chống nắng và bụi bẩn tích tụ.",
        },
        {
          title: "Bước 2: Tẩy tế bào chết & Xông hơi",
          desc: "Lấy đi lớp sừng già cỗi trên bề mặt da kết hợp xông hơi nóng giúp giãn nở lỗ chân lông.",
        },
        {
          title: "Bước 3: Hút mụn & Oxy tươi",
          desc: "Hút sạch bã nhờn, mụn cám vùng chữ T và phun oxy tinh khiết cung cấp dưỡng chất sâu cho da.",
        },
        {
          title: "Bước 4: Điện di tinh chất & Đắp mặt nạ",
          desc: "Điện di tinh chất (Vitamin C/Collagen) giúp thẩm thấu và đắp mặt nạ phục hồi dịu da.",
        },
      ];
    }
    if (
      cat.includes("nail") ||
      name.includes("nail") ||
      name.includes("móng")
    ) {
      return [
        {
          title: "Bước 1: Ngâm tay/chân vệ sinh móng",
          desc: "Làm sạch móng và ngâm nước ấm muối khoáng giúp làm mềm da quanh móng.",
        },
        {
          title: "Bước 2: Cắt da & Tạo phom",
          desc: "Nhặt sạch tế bào da thừa quanh móng và dũa tạo dáng móng vuông hoặc tròn theo ý muốn.",
        },
        {
          title: "Bước 3: Sơn liên kết & Sơn màu gel",
          desc: "Sơn lớp base bảo vệ móng, sơn 2 lớp màu gel cao cấp chuẩn màu và sấy máy UV khô nhanh.",
        },
        {
          title: "Bước 4: Sơn phủ bóng & Thoa dưỡng",
          desc: "Sơn lớp phủ bóng bảo vệ màu lâu trôi và massage nhẹ nhàng vùng quanh móng bằng dầu dưỡng.",
        },
      ];
    }
    return [
      {
        title: "Bước 1: Tư vấn & Chuẩn bị",
        desc: "Kiểm tra nhu cầu của khách hàng, chuẩn bị dụng cụ và vệ sinh sạch sẽ vùng điều trị.",
      },
      {
        title: "Bước 2: Chuẩn bị bề mặt",
        desc: "Làm sạch da/tóc hoặc ngâm mềm vùng điều trị để chuẩn bị tiếp nhận liệu trình chính.",
      },
      {
        title: "Bước 3: Kỹ thuật chuyên môn",
        desc: "Chuyên viên giàu kinh nghiệm thực hiện các thao tác kỹ thuật bài bản, tối ưu hiệu quả điều trị.",
      },
      {
        title: "Bước 4: Bảo vệ & Hướng dẫn",
        desc: "Thoa dưỡng chất bảo vệ và hướng dẫn quy trình tự chăm sóc tại nhà để duy trì kết quả.",
      },
    ];
  };

  const getBenefits = (categoryName, serviceName) => {
    const cat = (categoryName || "").toLowerCase();
    const name = (serviceName || "").toLowerCase();
    if (cat.includes("massage") || name.includes("massage")) {
      return [
        "Xua tan mệt mỏi, stress tức thì sau giờ làm việc.",
        "Giảm co thắt cơ, đau mỏi vai gáy hiệu quả nhanh chóng.",
        "Kích thích tuần hoàn máu, cải thiện sức khỏe thể chất.",
        "Nâng cao chất lượng giấc ngủ giúp bạn ngủ sâu giấc hơn.",
      ];
    }
    if (cat.includes("tóc") || cat.includes("hair") || name.includes("tóc")) {
      return [
        "Mái tóc óng ả, thời thượng, giữ nếp lâu dài.",
        "Phục hồi hư tổn từ lõi tóc bằng dưỡng chất organic.",
        "Không kích ứng da đầu hay khô xơ sau liệu trình.",
        "Tự tin thể hiện cá tính riêng với kiểu tóc sang trọng.",
      ];
    }
    if (
      cat.includes("da") ||
      cat.includes("skin") ||
      name.includes("da") ||
      name.includes("mặt")
    ) {
      return [
        "Làn da mịn màng, căng bóng và hồng hào rõ rệt.",
        "Đào thải độc tố tích tụ sâu dưới da, se khít chân lông.",
        "Kích thích sinh Collagen tự nhiên chống nếp nhăn.",
        "Mờ thâm mụn, giúp da sáng đều màu tràn đầy sức sống.",
      ];
    }
    return [
      "Liệu trình chuyên nghiệp chuẩn Spa cao cấp.",
      "Kỹ thuật viên chuyên nghiệp trực tiếp đảm nhận.",
      "Cam kết sử dụng mỹ phẩm nguồn gốc thảo dược chính hãng.",
      "Cảm nhận hiệu quả rõ rệt ngay từ lần thực hiện đầu tiên.",
    ];
  };

  const getFAQs = (categoryName, serviceName) => {
    return [
      {
        q: "Liệu trình này có gây kích ứng hay khó chịu gì không?",
        a: `Hoàn toàn không. Dịch vụ ${serviceName} được thực hiện với các bước nhẹ nhàng, sử dụng sản phẩm thảo dược và mỹ phẩm cao cấp an toàn cho mọi đối tượng. Quá trình làm chỉ mang lại sự dễ chịu, thư giãn.`,
      },
      {
        q: "Nên thực hiện dịch vụ này với tần suất thế nào để tốt nhất?",
        a: "Bạn nên duy trì tần suất từ 1 đến 2 lần mỗi tuần để đạt hiệu quả tối ưu và giúp cơ thể/làn da giữ trạng thái tốt nhất.",
      },
      {
        q: "Sau khi thực hiện liệu trình tôi cần lưu ý kiêng cữ gì?",
        a: "Nên hạn chế sử dụng hóa chất tẩy rửa mạnh hoặc tiếp xúc ánh nắng gay gắt trong 24 giờ đầu. Uống nhiều nước và dưỡng ẩm thường xuyên theo chỉ dẫn.",
      },
    ];
  };

  return (
    <section className="section container">
      <style>{`
        .svc-detail-hero {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 28px;
          align-items: stretch;
        }

        .svc-main-card,
        .svc-side-card,
        .svc-section-card {
          background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
          border: 1px solid #ead8c5;
          border-radius: 30px;
          box-shadow: 0 22px 55px rgba(88, 62, 39, .10);
        }

        .svc-main-card {
          overflow: hidden;
        }

        .svc-main-card img {
          width: 100%;
          height: 430px;
          object-fit: cover;
          background: #f7efe5;
        }

        .svc-main-body {
          padding: 28px;
        }

        .svc-main-body h1 {
          margin: 8px 0 12px;
          font-size: 38px;
          color: #3e2a1f;
        }

        .svc-info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin: 22px 0;
        }

        .svc-info-box {
          padding: 16px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .svc-info-box b {
          display: block;
          margin-bottom: 6px;
          color: #4a3325;
        }

        .svc-side-card {
          padding: 28px;
        }

        .svc-tech-list {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .svc-tech-item {
          display: grid;
          grid-template-columns: 82px 1fr;
          gap: 14px;
          align-items: center;
          padding: 14px;
          border-radius: 22px;
          background: #fff;
          border: 1px solid #ead8c5;
        }

        .svc-tech-item img {
          width: 82px;
          height: 82px;
          object-fit: cover;
          border-radius: 20px;
          background: #f7efe5;
        }

        .svc-tech-item h3 {
          margin: 0 0 6px;
          color: #4a3325;
        }

        .svc-tech-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        @media(max-width: 980px) {
          .svc-detail-hero,
          .svc-info-grid,
          .svc-tabs-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="svc-detail-hero">
        <div className="svc-main-card">
          <img src={image(service.ImageUrl)} alt={service.ServiceName} />

          <div className="svc-main-body">
            <div className="eyebrow">
              {service.CategoryName || "Beauty Service"}
            </div>

            <h1>{service.ServiceName}</h1>
            <p className="muted">{service.Description}</p>

            <div className="svc-info-grid">
              <div className="svc-info-box">
                <b>Giá dịch vụ</b>
                {money(service.Price)}
              </div>

              <div className="svc-info-box">
                <b>Thời lượng</b>
                {service.DurationMinutes} phút
              </div>

              <div className="svc-info-box">
                <b>Trạng thái</b>
                {service.Status || "AVAILABLE"}
              </div>
            </div>

            <button
              className="btn"
              type="button"
              onClick={() => handleBooking()}
            >
              Đặt lịch dịch vụ này
            </button>
          </div>
        </div>

        <aside className="svc-side-card">
          <div className="eyebrow">Kỹ thuật viên phù hợp</div>
          <h2>Nhân viên có thể thực hiện</h2>

          <div className="svc-tech-list">
            {technicians.length === 0 ? (
              <p className="muted">
                Chưa có kỹ thuật viên nào được gán cho dịch vụ này.
              </p>
            ) : (
              technicians.map((t) => (
                <div className="svc-tech-item" key={t.EmployeeId}>
                  <img src={image(t.ImageUrl)} alt={t.FullName} />

                  <div>
                    <h3>{t.FullName}</h3>

                    <p className="muted">
                      {t.Position || "Kỹ thuật viên"} •{" "}
                      {t.Specialization || "Chăm sóc sắc đẹp"}
                    </p>

                    <p className="muted">
                      ⭐ {Number(t.AverageRating || 0).toFixed(1)} •{" "}
                      {t.ReviewCount || 0} đánh giá
                    </p>

                    <div className="svc-tech-actions">
                      <Link
                        className="card-btn"
                        to={`/technicians/${t.EmployeeId}`}
                      >
                        Xem hồ sơ
                      </Link>

                      <button
                        className="card-btn primary"
                        type="button"
                        onClick={() => handleBooking(t.EmployeeId)}
                      >
                        Đặt lịch
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* New Sections for Complete Service Detail Page */}
      <div className="svc-detail-tabs-section" style={{ marginTop: "40px" }}>
        <div
          className="svc-tabs-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "28px",
          }}
        >
          <div className="svc-tabs-left-col">
            {/* 1. Quy trình thực hiện */}
            <div
              className="svc-section-card"
              style={{ padding: "28px", marginBottom: "28px" }}
            >
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#3e2a1f",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>📋</span> Quy trình thực hiện chi tiết
              </h2>

              <div
                className="svc-steps-timeline"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {getTreatmentSteps(
                  service.CategoryName,
                  service.ServiceName,
                ).map((step, idx) => (
                  <div
                    key={idx}
                    className="svc-step-node"
                    style={{ display: "flex", gap: "16px" }}
                  >
                    <div
                      className="step-badge"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #ff5ea8 0%, #ef4f83 100%)",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="step-content">
                      <h4
                        style={{
                          margin: "0 0 4px 0",
                          color: "#4a3325",
                          fontWeight: 700,
                          fontSize: "16px",
                        }}
                      >
                        {step.title}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          color: "#7a675b",
                          fontSize: "14px",
                          lineHeight: "1.5",
                        }}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Đánh giá từ khách hàng */}
            <div
              className="svc-section-card"
              style={{ padding: "28px", marginBottom: "28px" }}
            >
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#3e2a1f",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>⭐</span> Đánh giá từ khách hàng
              </h2>

              {!service.Reviews || service.Reviews.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px 10px",
                    background: "#faf7f5",
                    borderRadius: "20px",
                    border: "1px dashed #ead8c5",
                  }}
                >
                  <p style={{ color: "#7a675b", margin: "0 0 8px 0" }}>
                    Chưa có đánh giá nào cho dịch vụ này.
                  </p>
                  <small style={{ color: "#a8968a" }}>
                    Hãy là người đầu tiên trải nghiệm và chia sẻ cảm nhận!
                  </small>
                </div>
              ) : (
                <div
                  className="svc-reviews-list"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {service.Reviews.map((rev) => (
                    <div
                      key={rev.ReviewId}
                      className="svc-review-item"
                      style={{
                        padding: "16px",
                        borderRadius: "20px",
                        background: "#fff",
                        border: "1px solid #ead8c5",
                        display: "flex",
                        gap: "14px",
                      }}
                    >
                      <img
                        src={resolveFileUrl(
                          rev.CustomerAvatar ||
                            "/images/avatars/default-avatar.png",
                        )}
                        alt={rev.CustomerName}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                          border: "1px solid #ead8c5",
                        }}
                      />
                      <div className="rev-body" style={{ flexGrow: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            marginBottom: "4px",
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              color: "#3e2a1f",
                              fontWeight: 700,
                            }}
                          >
                            {rev.CustomerName}
                          </h4>
                          <span style={{ fontSize: "12px", color: "#a8968a" }}>
                            {new Date(rev.CreatedAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            color: "#d79b43",
                            fontWeight: 800,
                            fontSize: "14px",
                            marginBottom: "6px",
                          }}
                        >
                          {"★".repeat(rev.Rating)}
                          {"☆".repeat(5 - rev.Rating)}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: "#5c493c",
                            fontSize: "14px",
                            lineHeight: "1.5",
                          }}
                        >
                          {rev.Comment}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="svc-tabs-right-col">
            {/* 3. Lợi ích vượt trội */}
            <div
              className="svc-section-card"
              style={{ padding: "28px", marginBottom: "28px" }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#3e2a1f",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✨</span> Lợi ích vượt trội
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {getBenefits(service.CategoryName, service.ServiceName).map(
                  (b, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "10px",
                        fontSize: "14.5px",
                        color: "#5c493c",
                        lineHeight: "1.4",
                      }}
                    >
                      <span style={{ color: "#ef4f83", fontWeight: "bold" }}>
                        ✓
                      </span>
                      <span>{b}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* 4. FAQs */}
            <div className="svc-section-card" style={{ padding: "28px" }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#3e2a1f",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>💡</span> Giải đáp thắc mắc
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {getFAQs(service.CategoryName, service.ServiceName).map(
                  (faq, idx) => (
                    <details
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "16px",
                        background: "#fff",
                        border: "1px solid #ead8c5",
                        cursor: "pointer",
                      }}
                    >
                      <summary
                        style={{
                          fontWeight: 700,
                          color: "#4a3325",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      >
                        {faq.q}
                      </summary>
                      <p
                        style={{
                          margin: "8px 0 0 0",
                          color: "#7a675b",
                          fontSize: "13.5px",
                          lineHeight: "1.5",
                          cursor: "default",
                        }}
                      >
                        {faq.a}
                      </p>
                    </details>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link className="btn btn-outline" to="/services">
          Quay lại danh sách dịch vụ
        </Link>
      </div>
    </section>
  );
}
