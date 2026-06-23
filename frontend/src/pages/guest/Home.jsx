import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function formatDate(value) {
  if (!value) return "Không giới hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function safeImage(url, fallback) {
  return url ? resolveFileUrl(url) : fallback;
}

export default function Home() {
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [techs, setTechs] = useState([]);
  const [packages, setPackages] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState({
    serviceId: "",
    employeeId: "",
    appointmentDate: "",
  });

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      axiosClient.get("/services"),
      axiosClient.get("/employees"),
      axiosClient.get("/packages?sort=newest"),
      axiosClient.get("/vouchers"),
    ])
      .then(([serviceRes, techRes, packageRes, voucherRes]) => {
        if (!mounted) return;

        if (serviceRes.status === "fulfilled") {
          setServices(
            serviceRes.value.data.data || serviceRes.value.data || [],
          );
        }

        if (techRes.status === "fulfilled") {
          setTechs(techRes.value.data.data || techRes.value.data || []);
        }

        if (packageRes.status === "fulfilled") {
          setPackages(
            packageRes.value.data.data || packageRes.value.data || [],
          );
        }

        if (voucherRes.status === "fulfilled") {
          setVouchers(
            voucherRes.value.data.data || voucherRes.value.data || [],
          );
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const hotServices = useMemo(() => {
    return [...services]
      .sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0))
      .slice(0, 6);
  }, [services]);

  const topTechs = useMemo(() => {
    return [...techs]
      .sort(
        (a, b) =>
          Number(b.AverageRating || 0) - Number(a.AverageRating || 0) ||
          Number(b.ReviewCount || 0) - Number(a.ReviewCount || 0),
      )
      .slice(0, 4);
  }, [techs]);

  const hotPackages = useMemo(() => {
    return [...packages]
      .sort(
        (a, b) =>
          Number(b.IsHot || 0) - Number(a.IsHot || 0) ||
          Number(b.PackageId || 0) - Number(a.PackageId || 0),
      )
      .slice(0, 3);
  }, [packages]);

  const stats = useMemo(
    () => [
      {
        number: `${services.length}+`,
        label: "Dịch vụ đang mở",
      },
      {
        number: `${techs.length}+`,
        label: "Kỹ thuật viên",
      },
      {
        number: `${packages.length}+`,
        label: "Combo / liệu trình",
      },
      {
        number: `${vouchers.length}+`,
        label: "Voucher hiệu lực",
      },
    ],
    [services.length, techs.length, packages.length, vouchers.length],
  );

  const handleQuickBooking = () => {
    const params = new URLSearchParams();

    if (search.serviceId) params.set("serviceId", search.serviceId);
    if (search.employeeId) params.set("employeeId", search.employeeId);
    if (search.appointmentDate) params.set("date", search.appointmentDate);

    navigate(
      `/customer/booking${params.toString() ? `?${params.toString()}` : ""}`,
    );
  };

  return (
    <>
      <main className="home-pink-page">
        <section className="home-hero-pink">
          <div className="home-hero-bg home-hero-bg-1" />
          <div className="home-hero-bg home-hero-bg-2" />

          <div className="container home-hero-inner-pink">
            <div className="home-hero-content-pink">
              <div className="home-badge-pink">
                🌸 Beauty Salon Management System
              </div>

              <h1>
                Chăm sóc sắc đẹp
                <span>chuẩn spa hiện đại</span>
              </h1>

              <p>
                Khách hàng có thể xem dịch vụ, chọn kỹ thuật viên, đặt lịch,
                thanh toán, dùng voucher, mua combo liệu trình và theo dõi lịch
                hẹn ngay trên hệ thống.
              </p>

              <div className="home-hero-actions-pink">
                <Link to="/customer/booking" className="home-btn-primary">
                  Đặt lịch ngay
                </Link>

                <Link to="/services" className="home-btn-light">
                  Xem dịch vụ
                </Link>

                <Link to="/packages" className="home-btn-light">
                  Xem combo
                </Link>
              </div>

              <div className="home-trust-row-pink">
                <span>💗 Tư vấn tận tâm</span>
                <span>💅 Dịch vụ thật</span>
                <span>💳 Thanh toán online</span>
              </div>
            </div>

            <div className="home-hero-visual-pink">
              <div className="home-main-photo-pink">
                <img
                  src="http://localhost:5000/images/home/hero-girl.png"
                  alt="Beauty Salon Spa"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="container home-search-panel-pink">
          <div className="home-search-field">
            <span>💆</span>
            <div>
              <label>Dịch vụ</label>
              <select
                value={search.serviceId}
                onChange={(e) =>
                  setSearch((prev) => ({ ...prev, serviceId: e.target.value }))
                }
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map((item) => (
                  <option key={item.ServiceId} value={item.ServiceId}>
                    {item.ServiceName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="home-search-field">
            <span>👩‍🔧</span>
            <div>
              <label>Kỹ thuật viên</label>
              <select
                value={search.employeeId}
                onChange={(e) =>
                  setSearch((prev) => ({ ...prev, employeeId: e.target.value }))
                }
              >
                <option value="">Bất kỳ kỹ thuật viên</option>
                {techs.map((item) => (
                  <option key={item.EmployeeId} value={item.EmployeeId}>
                    {item.FullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="home-search-field">
            <span>📅</span>
            <div>
              <label>Ngày hẹn</label>
              <input
                type="date"
                value={search.appointmentDate}
                onChange={(e) =>
                  setSearch((prev) => ({
                    ...prev,
                    appointmentDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <button type="button" onClick={handleQuickBooking}>
            Tìm lịch phù hợp
          </button>
        </section>

        <section className="container home-stats-pink">
          {stats.map((item) => (
            <div className="home-stat-card-pink" key={item.label}>
              <strong>{loading ? "..." : item.number}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <section className="container home-section-pink">
          <div className="home-section-head-pink">
            <div>
              <span>Dịch vụ của salon</span>
              <h2>Dịch vụ nổi bật đang được cung cấp</h2>
            </div>

            <Link to="/services">Xem tất cả dịch vụ →</Link>
          </div>

          <div className="home-service-grid-pink">
            {hotServices.map((item) => (
              <article className="home-service-card-pink" key={item.ServiceId}>
                <img
                  src={safeImage(
                    item.ImageUrl,
                    "http://localhost:5000/images/home/hero-girl.png",
                  )}
                  alt={item.ServiceName}
                />

                <div className="home-service-body-pink">
                  <span>{item.CategoryName || "Beauty Service"}</span>
                  <h3>{item.ServiceName}</h3>
                  <p>
                    {item.Description || "Dịch vụ chăm sóc sắc đẹp tại salon."}
                  </p>

                  <div className="home-service-meta-pink">
                    <b>{formatMoney(item.Price)}</b>
                    <small>{item.DurationMinutes || 0} phút</small>
                  </div>

                  <div className="home-card-actions-pink">
                    <Link to={`/services/${item.ServiceId}`}>Chi tiết</Link>
                    <Link to={`/customer/booking?serviceId=${item.ServiceId}`}>
                      Đặt lịch
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-promo-band-pink">
          <div className="container home-promo-inner-pink">
            <div>
              <span>Ưu đãi đang hoạt động</span>
              <h2>Voucher dành cho khách hàng</h2>
              <p>
                Khách hàng có thể lưu voucher vào tài khoản và dùng khi thanh
                toán lịch hẹn.
              </p>
            </div>

            <div className="home-voucher-list-pink">
              {vouchers.slice(0, 3).map((item) => (
                <article key={item.VoucherId}>
                  <small>Mã voucher</small>
                  <strong>{item.Code}</strong>
                  <p>
                    Giảm{" "}
                    {String(item.DiscountType).toUpperCase() === "PERCENT"
                      ? `${item.DiscountValue}%`
                      : formatMoney(item.DiscountValue)}
                  </p>
                  <span>HSD: {formatDate(item.EndDate)}</span>
                </article>
              ))}

              {!vouchers.length && (
                <article>
                  <small>Voucher</small>
                  <strong>Đang cập nhật</strong>
                  <p>Chưa có voucher hiệu lực</p>
                  <span>Vui lòng quay lại sau</span>
                </article>
              )}
            </div>
          </div>
        </section>

        <section className="container home-section-pink">
          <div className="home-section-head-pink">
            <div>
              <span>Combo / liệu trình</span>
              <h2>Gói chăm sóc tiết kiệm</h2>
            </div>

            <Link to="/packages">Xem tất cả combo →</Link>
          </div>

          <div className="home-package-grid-pink">
            {hotPackages.map((item) => (
              <article className="home-package-card-pink" key={item.PackageId}>
                <div className="home-package-img-pink">
                  <img
                    src={safeImage(
                      item.ImageUrl,
                      "http://localhost:5000/images/home/hero-girl.png",
                    )}
                    alt={item.PackageName}
                  />
                  {item.IsHot ? <span>HOT</span> : null}
                </div>

                <div>
                  <small>{item.CategoryName || "Liệu trình"}</small>
                  <h3>{item.PackageName}</h3>
                  <p>{item.Description || item.ServiceNames}</p>

                  <div className="home-package-info-pink">
                    <b>{formatMoney(item.FinalPrice || item.SalePrice)}</b>
                    <span>{item.TotalSessions || 1} buổi</span>
                    <span>{item.ValidityDays || 0} ngày</span>
                  </div>

                  <Link to={`/packages/${item.PackageId}`}>Xem chi tiết</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-why-pink">
          <div className="container">
            <div className="home-section-head-pink center">
              <div>
                <span>Quy trình hoàn chỉnh</span>
                <h2>Một website salon đầy đủ từ xem dịch vụ đến thanh toán</h2>
                <p>
                  Trang chủ giới thiệu đầy đủ các chức năng chính của hệ thống:
                  dịch vụ, nhân viên, đặt lịch, thanh toán, voucher, combo và
                  chăm sóc khách hàng.
                </p>
              </div>
            </div>

            <div className="home-process-grid-pink">
              <article>
                <span>01</span>
                <h3>Chọn dịch vụ</h3>
                <p>Xem giá, thời lượng, mô tả và danh mục dịch vụ.</p>
              </article>

              <article>
                <span>02</span>
                <h3>Chọn kỹ thuật viên</h3>
                <p>Xem chuyên môn, kinh nghiệm, đánh giá và chi nhánh.</p>
              </article>

              <article>
                <span>03</span>
                <h3>Đặt lịch</h3>
                <p>Chọn ngày giờ phù hợp và theo dõi trạng thái lịch hẹn.</p>
              </article>

              <article>
                <span>04</span>
                <h3>Thanh toán</h3>
                <p>
                  Thanh toán online, áp dụng voucher và xem lịch sử giao dịch.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="container home-section-pink">
          <div className="home-section-head-pink">
            <div>
              <span>Kỹ thuật viên</span>
              <h2>Đội ngũ chuyên viên nổi bật</h2>
            </div>

            <Link to="/technicians">Xem tất cả kỹ thuật viên →</Link>
          </div>

          <div className="home-tech-grid-pink">
            {topTechs.map((item) => (
              <article className="home-tech-card-pink" key={item.EmployeeId}>
                <div className="home-tech-img-pink">
                  <img
                    src={safeImage(
                      item.ImageUrl,
                      "http://localhost:5000/images/home/hero-girl.png",
                    )}
                    alt={item.FullName}
                  />
                </div>

                <div>
                  <h3>{item.FullName}</h3>
                  <p>
                    {item.Specialization || item.Position || "Beauty Expert"}
                  </p>

                  <div className="home-tech-meta-pink">
                    <span>⭐ {Number(item.AverageRating || 0).toFixed(1)}</span>
                    <span>{item.ReviewCount || 0} đánh giá</span>
                    <span>{item.YearsOfExperience || 0} năm KN</span>
                  </div>

                  <div className="home-card-actions-pink">
                    <Link to={`/technicians/${item.EmployeeId}`}>Hồ sơ</Link>
                    <Link
                      to={`/customer/booking?employeeId=${item.EmployeeId}`}
                    >
                      Đặt lịch
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-final-cta-pink">
          <div className="container home-final-cta-inner-pink">
            <div>
              <span>BeautyMS</span>
              <h2>Sẵn sàng đặt lịch chăm sóc sắc đẹp?</h2>
              <p>
                Đăng nhập hoặc tạo tài khoản để đặt lịch, thanh toán, lưu
                voucher và quản lý lịch hẹn của bạn.
              </p>
            </div>

            <div>
              <Link to="/register" className="home-btn-light">
                Tạo tài khoản
              </Link>
              <Link to="/customer/booking" className="home-btn-primary">
                Đặt lịch ngay
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="container footer-grid">
        <div>
          <div className="logo">
            🌸
            <div>
              Beauty<span>Salon & Spa</span>
            </div>
          </div>
          <p className="muted">
            Hệ thống quản lý salon hỗ trợ khách hàng đặt lịch, thanh toán, mua
            combo, lưu voucher và theo dõi lịch sử dịch vụ.
          </p>
        </div>

        <div>
          <h4>Dịch vụ</h4>
          <ul>
            <li>Chăm sóc da</li>
            <li>Nail cao cấp</li>
            <li>Làm tóc</li>
            <li>Massage thư giãn</li>
          </ul>
        </div>

        <div>
          <h4>Chức năng</h4>
          <ul>
            <li>Đặt lịch online</li>
            <li>Thanh toán VNPay</li>
            <li>Voucher</li>
            <li>Combo / liệu trình</li>
          </ul>
        </div>

        <div>
          <h4>Liên hệ</h4>
          <ul>
            <li>☎ 0123 456 789</li>
            <li>✉ spa@beautysalon.com</li>
            <li>📍 Đà Nẵng</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
