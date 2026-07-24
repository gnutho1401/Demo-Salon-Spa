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

  // 5 slides data with corresponding images and messages
  const heroSlides = useMemo(() => [
    {
      badge: "🌸 Beauty Salon Management System",
      heading: <>Chăm sóc sắc đẹp <br /><span>chuẩn spa hiện đại</span></>,
      description: "Khách hàng có thể xem dịch vụ, chọn kỹ thuật viên, đặt lịch, thanh toán, dùng voucher, mua combo liệu trình và theo dõi lịch hẹn ngay trên hệ thống.",
      trustItems: ["💗 Tư vấn tận tâm", "💅 Dịch vụ thật", "💳 Thanh toán online"],
      imageUrl: "/images/home/hero-girl.png"
    },
    {
      badge: "💇 Premium Hair Care",
      heading: <>Tạo mẫu tóc thời thượng <br /><span>tỏa sáng khí chất</span></>,
      description: "Đội ngũ chuyên gia tạo mẫu tóc chuyên nghiệp, luôn cập nhật các xu hướng cắt, uốn, duỗi và nhuộm màu thời trang nhất giúp bạn lột xác hoàn hảo.",
      trustItems: ["✨ Stylist hàng đầu", "🧪 Thuốc nhuộm organic", "💇 Bảo hành nếp tóc"],
      imageUrl: "/images/home/hero-hair.png"
    },
    {
      badge: "💅 Luxury Nail Spa",
      heading: <>Thiết kế móng nghệ thuật <br /><span>tinh tế từng chi tiết</span></>,
      description: "Điểm tô nét duyên dáng cho đôi tay với các dịch vụ chăm sóc móng, sơn gel cao cấp và thiết kế vẽ móng đính đá nghệ thuật độc bản từ các nghệ nhân lành nghề.",
      trustItems: ["🌟 Gel nhập khẩu", "🛡️ Khử trùng 100%", "🎨 Vẽ móng nghệ thuật"],
      imageUrl: "/images/home/hero-nails.png"
    },
    {
      badge: "💆 Deep Body Wellness",
      heading: <>Massage trị liệu <br /><span>tái tạo năng lượng sống</span></>,
      description: "Đánh tan mọi mỏi mệt và căng thẳng với các liệu trình massage body đá nóng, bấm huyệt y học cổ truyền kết hợp hương thảo dược tinh dầu tự nhiên.",
      trustItems: ["🌿 Tinh dầu hữu cơ", "💆 Trị liệu chuyên sâu", "🧘 Không gian yên bình"],
      imageUrl: "/images/home/hero-spa-interior.png"
    },
    {
      badge: "🤖 AI Beauty Skin Analyzer",
      heading: <>Chẩn đoán da thông minh <br /><span>phân tích 11 chỉ số AI</span></>,
      description: "Trải nghiệm công nghệ AI Skin Analyzer hiện đại nhất, chụp ảnh và phân tích tức thì 11 chỉ số sức khỏe của da để đưa ra liệu trình chăm sóc chuẩn y khoa phù hợp nhất.",
      trustItems: ["📸 Phân tích tức thì", "🔍 Chính xác vượt trội", "📈 Lịch sử chẩn đoán"],
      imageUrl: "/images/home/hero-ai-skin.png"
    }
  ], []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  // Auto-play hero slider transitions (every 6 seconds)
  useEffect(() => {
    if (heroPaused) return;
    const timer = setInterval(() => {
      handleNextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [heroPaused]);

  // Gallery items for the luxury salon space section
  const galleryItems = useMemo(() => [
    {
      title: "Phòng Gội Đầu Dưỡng Sinh",
      desc: "Trải nghiệm gội đầu thảo dược kết hợp bấm huyệt trị liệu vai gáy trong không gian ấm cúng, thoảng hương sả chanh.",
      imageUrl: "/images/gallery/shampoo.png",
      tag: "Dưỡng sinh",
      size: "large"
    },
    {
      title: "Khu Vực Tạo Mẫu Tóc Chuyên Nghiệp",
      desc: "Thiết kế hiện đại chuẩn Salon cao cấp với hệ thống gương LED cảm ứng và trang thiết bị uốn nhuộm tối tân nhất.",
      imageUrl: "/images/gallery/hair.png",
      tag: "Hair Salon",
      size: "medium"
    },
    {
      title: "Phòng Trị Liệu VIP",
      desc: "Không gian khép kín yên tĩnh tuyệt đối dành cho các liệu trình chăm sóc da chuyên sâu và massage body đá nóng.",
      imageUrl: "/images/gallery/vip.png",
      tag: "Spa Trị Liệu",
      size: "medium"
    },
    {
      title: "Lounge Chờ & Quầy Trà Thảo Mộc",
      desc: "Nơi đón tiếp khách hàng sang trọng với trà hoa cúc mật ong tự nhiên giúp bạn thư giãn trước và sau buổi làm đẹp.",
      imageUrl: "/images/gallery/lounge.png",
      tag: "Sảnh Chờ",
      size: "wide"
    },
    {
      title: "Khu Vực Nail & Foot Massage",
      desc: "Hệ thống ghế ngồi nhung bồn ngâm chân bọc đồng cao cấp, mang lại sự dễ chịu tối đa khi chăm sóc móng.",
      imageUrl: "/images/gallery/nails.png",
      tag: "Nails & Foot",
      size: "small"
    }
  ], []);

  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Voucher saving states and handler
  const [voucherStatus, setVoucherStatus] = useState({}); // { [voucherId]: "saving" | "saved" | "error" }

  const [reviews, setReviews] = useState([]);
  const [currentReview, setCurrentReview] = useState(0);

  const reviewsToShow = reviews;

  const handleReviewDotClick = (idx) => {
    setCurrentReview(idx);
  };

  // Swiping and auto-play states
  const [touchStart, setTouchStart] = useState(0);
  const [dragged, setDragged] = useState(false);
  const [reviewsPaused, setReviewsPaused] = useState(false);

  const handleMouseUp = (endX) => {
    if (!touchStart) return;
    const diff = touchStart - endX;
    if (diff > 50) {
      const nextIdx = (currentReview + 1) % reviewsToShow.length;
      handleReviewDotClick(nextIdx);
    } else if (diff < -50) {
      const prevIdx = (currentReview - 1 + reviewsToShow.length) % reviewsToShow.length;
      handleReviewDotClick(prevIdx);
    }
    setTouchStart(0);
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const endX = e.changedTouches[0].clientX;
    const diff = touchStart - endX;
    if (diff > 50) {
      const nextIdx = (currentReview + 1) % reviewsToShow.length;
      handleReviewDotClick(nextIdx);
    } else if (diff < -50) {
      const prevIdx = (currentReview - 1 + reviewsToShow.length) % reviewsToShow.length;
      handleReviewDotClick(prevIdx);
    }
    setTouchStart(0);
  };

  // Auto-play review transitions (every 5 seconds)
  useEffect(() => {
    if (reviewsPaused || reviewsToShow.length <= 1) return;
    const timer = setInterval(() => {
      const nextIdx = (currentReview + 1) % reviewsToShow.length;
      handleReviewDotClick(nextIdx);
    }, 5000);
    return () => clearInterval(timer);
  }, [currentReview, reviewsPaused, reviewsToShow]);

  const handleSaveVoucher = async (voucherId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Redirect to login page
      navigate("/login");
      return;
    }

    setVoucherStatus((prev) => ({ ...prev, [voucherId]: "saving" }));
    try {
      await axiosClient.post(`/vouchers/${voucherId}/save`);
      setVoucherStatus((prev) => ({ ...prev, [voucherId]: "saved" }));
      alert("🎉 Đã lưu voucher thành công vào ví của bạn!");
    } catch (err) {
      setVoucherStatus((prev) => ({ ...prev, [voucherId]: "error" }));
      const errMsg = err.response?.data?.message || "Lưu voucher thất bại hoặc bạn đã lưu voucher này rồi.";
      alert(`❌ ${errMsg}`);
    }
  };

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem("token");

    const promises = [
      axiosClient.get("/services"),
      axiosClient.get("/employees"),
      axiosClient.get("/packages?sort=newest"),
      axiosClient.get("/vouchers"),
      axiosClient.get("/customers/public-reviews"),
    ];

    if (token) {
      promises.push(axiosClient.get("/vouchers/my"));
    }

    Promise.allSettled(promises)
      .then(([serviceRes, techRes, packageRes, voucherRes, reviewsRes, myRes]) => {
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

        if (reviewsRes.status === "fulfilled") {
          const list = reviewsRes.value.data.data || reviewsRes.value.data || [];
          setReviews(list);
        } else {
          setReviews([]);
        }

        if (token && myRes && myRes.status === "fulfilled") {
          const mySavedVouchers = myRes.value.data.data || myRes.value.data || [];
          const savedStatuses = {};
          mySavedVouchers.forEach(item => {
            savedStatuses[item.VoucherId] = "saved";
          });
          setVoucherStatus(prev => ({ ...prev, ...savedStatuses }));
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const sections = document.querySelectorAll(".reveal-section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          } else {
            // Remove class when element exits the viewport to allow re-triggering when scrolling back!
            entry.target.classList.remove("revealed");
          }
        });
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      sections.forEach((section) => {
        observer.unobserve(section);
      });
    };
  }, [loading]);

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
      .sort((a, b) => Number(b.IsHot || 0) - Number(a.IsHot || 0))
      .slice(0, 6);
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
        <section 
          className="home-hero-pink"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          <div className="home-hero-bg home-hero-bg-1" />
          <div className="home-hero-bg home-hero-bg-2" />

          <div className="home-hero-slider-track-wrapper">
            <div className="home-hero-slider-track">
              {heroSlides.map((slide, idx) => (
                <div 
                  className={`home-hero-slide-item ${idx === currentSlide ? "active" : ""}`}
                  key={idx}
                >
                  <div className="container home-hero-inner-pink">
                    {/* Left Side: Text Content */}
                    <div className="home-hero-content-pink">
                      <div className="home-badge-pink">
                        {slide.badge}
                      </div>

                      <h1>
                        {slide.heading}
                      </h1>

                      <p>
                        {slide.description}
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
                        {slide.trustItems.map((item, trustIdx) => (
                          <span key={trustIdx}>{item}</span>
                        ))}
                      </div>
                    </div>

                    {/* Right Side: Interactive Image Card */}
                    <div className="home-hero-visual-pink">
                      <div 
                        className="home-hero-interactive-card"
                        onClick={handleNextSlide}
                        title="Nhấp chuột vào hình ảnh để đổi dịch vụ tiếp theo!"
                      >
                        <img
                          src={slide.imageUrl}
                          alt="Luna Beauty Service"
                        />
                      </div>
                      {/* Twinkling sparkle lights around the frame */}
                      <div className="sparkle-light sp-1">✨</div>
                      <div className="sparkle-light sp-2">⭐</div>
                      <div className="sparkle-light sp-3">✨</div>
                      <div className="sparkle-light sp-4">⭐</div>
                      <div className="sparkle-light sp-5">✨</div>
                      <div className="sparkle-light sp-6">✨</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container home-search-panel-pink reveal-section reveal-scale-up">
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

        <section className="container home-stats-pink reveal-section reveal-fade-up">
          {stats.map((item) => (
            <div className="home-stat-card-pink" key={item.label}>
              <strong>{loading ? "..." : item.number}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <section className="container home-section-pink reveal-section reveal-fade-left">
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
                    resolveFileUrl("/images/home/hero-girl.png"),
                  )}
                  alt={item.ServiceName}
                />

                <div className="home-service-body-pink">
                  <span>{item.CategoryName || "Beauty Service"}</span>
                  <h3>{item.ServiceName}</h3>
                  
                  <div className="home-service-meta-pink">
                    <b>{formatMoney(item.Price)}</b>
                    <small>{item.DurationMinutes || 0} phút</small>
                  </div>
                </div>

                {/* Hover Overlay */}
                <div className="home-service-overlay-pink">
                  <h4 className="overlay-service-title">{item.ServiceName}</h4>
                  <p>{item.Description || "Dịch vụ chăm sóc sắc đẹp cao cấp tại salon của chúng tôi, mang lại cho bạn sự thư giãn và tỏa sáng nhất."}</p>
                  <div className="hover-actions">
                    <Link to={`/services/${item.ServiceId}`} className="btn-detail">Chi tiết</Link>
                    <Link to={`/customer/booking?serviceId=${item.ServiceId}`} className="btn-book">Đặt lịch ngay</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Salon Space Gallery Section */}
        <section className="container home-gallery-section-pink reveal-section reveal-fade-up">
          <div className="home-section-head-pink center">
            <div>
              <span>Khám phá salon</span>
              <h2>Không gian trị liệu & thư giãn 5 sao</h2>
              <p>
                LUNA Beauty Salon & Spa sở hữu hệ thống phòng chức năng khép kín, thiết kế tối giản sang trọng với ánh sáng dịu nhẹ, âm nhạc du dương giúp bạn thư giãn trọn vẹn.
              </p>
            </div>
          </div>

          <div className="home-gallery-grid-pink">
            {galleryItems.map((item, idx) => (
              <div 
                className={`home-gallery-card-pink ${item.size}`} 
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                title="Nhấp vào để phóng to xem không gian!"
              >
                <div className="gallery-img-wrapper">
                  <img src={item.imageUrl} alt={item.title} />
                  <div className="gallery-overlay">
                    <span className="gallery-tag">{item.tag}</span>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                    <span className="gallery-view-btn">Phóng to xem không gian 🔍</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-promo-band-pink reveal-section reveal-scale-up">
          {/* Decorative background orbs & floating sparkles */}
          <div className="promo-decor-circle-1" />
          <div className="promo-decor-circle-2" />
          
          <svg className="promo-decor-sparkle-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" fill="#ffe4b2" />
          </svg>
          <svg className="promo-decor-sparkle-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" fill="#ffe4b2" />
          </svg>

          <div className="container home-promo-inner-pink">
            <div>
              <span>Ưu đãi đang hoạt động</span>
              <h2>Voucher dành cho khách hàng</h2>
              <p>
                Khách hàng có thể thu thập các mã giảm giá đặc biệt dưới đây vào ví tài khoản của mình và áp dụng trực tiếp tại bước thanh toán lịch hẹn.
              </p>
              <div className="home-voucher-actions">
                <Link to="/customer/vouchers" className="home-btn-primary small-btn">
                  Ví voucher của tôi →
                </Link>
              </div>
            </div>

            <div className="home-voucher-list-pink">
              {vouchers.slice(0, 3).map((item) => {
                const isPercent = String(item.DiscountType).toUpperCase() === "PERCENT";
                const discountNumStr = isPercent
                  ? String(item.DiscountValue)
                  : Number(item.DiscountValue).toLocaleString("vi-VN");

                const minOrderText = !item.MinOrderAmount || Number(item.MinOrderAmount) === 0
                  ? "Mọi đơn hàng"
                  : `Đơn từ ${formatMoney(item.MinOrderAmount)}`;

                return (
                  <article className="luxury-voucher-card" key={item.VoucherId}>
                    {/* Left side: big discount value with split symbol to prevent breaking */}
                    <div className="voucher-left">
                      <span className="voucher-percent" style={{
                        fontSize: discountNumStr.length > 5 ? '18px' : discountNumStr.length > 3 ? '22px' : '28px'
                      }}>
                        {discountNumStr}
                        {isPercent ? <span className="currency-symbol">%</span> : <span className="currency-symbol">đ</span>}
                      </span>
                      <span className="voucher-off">GIẢM GIÁ</span>
                    </div>

                    {/* Ticket divider with circular punch cuts */}
                    <div className="voucher-divider">
                      <div className="divider-circle top" />
                      <div className="divider-line" />
                      <div className="divider-circle bottom" />
                    </div>

                    {/* Right side: details, terms and collect action button */}
                    <div className="voucher-right">
                      <div className="voucher-right-top">
                        <span className="voucher-code-label">MÃ VOUCHER</span>
                        <strong className="voucher-code-text">{item.Code}</strong>
                        <p className="voucher-terms">
                          Điều kiện: {minOrderText} 
                          {item.MaxDiscountAmount > 0 && ` | Giảm tối đa ${formatMoney(item.MaxDiscountAmount)}`}
                        </p>
                        <p className="voucher-expiry">Hạn dùng: {formatDate(item.EndDate)}</p>
                      </div>

                      <div className="voucher-right-bottom">
                        <button 
                          className={`btn-voucher-action ${voucherStatus[item.VoucherId] || ""}`}
                          onClick={() => handleSaveVoucher(item.VoucherId)}
                          disabled={voucherStatus[item.VoucherId] === "saving" || voucherStatus[item.VoucherId] === "saved"}
                        >
                          {voucherStatus[item.VoucherId] === "saving" && "Đang lưu..."}
                          {voucherStatus[item.VoucherId] === "saved" && "Đã lưu ✓"}
                          {!voucherStatus[item.VoucherId] && "Lưu mã ngay"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {!vouchers.length && (
                <article className="luxury-voucher-card placeholder" style={{ height: 'auto', padding: '24px' }}>
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <strong style={{ display: 'block', fontSize: '18px', color: '#ef4f83', marginBottom: '8px' }}>Chương trình Voucher mới đang cập nhật</strong>
                    <p style={{ margin: 0, color: '#5c4554', fontSize: '14px' }}>Vui lòng quay lại sau để nhận các chương trình khuyến mãi và quà tặng hấp dẫn từ LUNA!</p>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>

        <section className="container home-section-pink reveal-section reveal-fade-right">
          <div className="home-section-head-pink">
            <div>
              <span>Combo / liệu trình</span>
              <h2>Gói chăm sóc tiết kiệm</h2>
            </div>

            <Link to="/packages">Xem tất cả combo →</Link>
          </div>

          <div className="home-package-grid-pink">
            {hotPackages.map((item) => {
              const origPrice = Number(item.Price || item.OriginalPrice || 0);
              const salePrice = Number(item.FinalPrice || item.SalePrice || 0);
              const hasDiscount = origPrice > salePrice;
              const discPercent = item.DiscountPercent || (origPrice > 0 ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0);

              return (
                <article className="home-package-card-pink" key={item.PackageId}>
                  <div className="home-package-img-pink">
                    <img
                      src={safeImage(
                        item.ImageUrl,
                        resolveFileUrl("/images/home/hero-girl.png"),
                      )}
                      alt={item.PackageName}
                    />
                    {item.IsHot ? (
                      <span className="hot-badge" style={{ 
                        background: 'linear-gradient(135deg, #ef4f83 0%, #ff7dbd 100%)', 
                        color: '#fff', 
                        padding: '6px 12px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 900, 
                        position: 'absolute', 
                        top: '12px', 
                        left: '12px',
                        right: 'auto',
                        boxShadow: '0 4px 10px rgba(239, 79, 131, 0.3)'
                      }}>
                        HOT
                      </span>
                    ) : null}
                    {hasDiscount && (
                      <span className="sale-badge" style={{ 
                        background: 'linear-gradient(135deg, #ff2a70 0%, #ff659f 100%)', 
                        color: '#fff', 
                        padding: '6px 12px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 900, 
                        position: 'absolute', 
                        top: '12px', 
                        right: '12px',
                        left: 'auto',
                        boxShadow: '0 4px 10px rgba(255, 42, 112, 0.35)'
                      }}>
                        -{discPercent}%
                      </span>
                    )}
                  </div>

                  <div className="home-package-body-pink" style={{ padding: '16px 20px' }}>
                    <small style={{ color: '#ef4f83', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                      {item.CategoryName || "Liệu trình"}
                    </small>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '6px 0 12px 0', color: '#2d1424', minHeight: '44px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.PackageName}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <b style={{ fontSize: '20px', color: '#ef4f83', fontWeight: 800 }}>{formatMoney(salePrice)}</b>
                        {hasDiscount && (
                          <del style={{ fontSize: '13px', color: '#8c7784', fontWeight: 500 }}>{formatMoney(origPrice)}</del>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#5c4554', borderTop: '1px dashed rgba(239, 79, 131, 0.1)', paddingTop: '8px', marginTop: '4px' }}>
                        <span>🕘 {item.TotalSessions || 1} buổi</span>
                        <span>📅 {item.ValidityDays || 180} ngày</span>
                      </div>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className="home-package-overlay-pink">
                    <h4 className="overlay-package-title">{item.PackageName}</h4>
                    <p>{item.Description || item.ServiceNames || "Combo chăm sóc sắc đẹp đặc biệt."}</p>
                    <div className="hover-actions">
                      <Link to={`/packages/${item.PackageId}`} className="btn-detail">Chi tiết</Link>
                      <Link to={`/packages/${item.PackageId}`} className="btn-book">Mua Combo</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="home-why-pink reveal-section reveal-fade-up">
          <div className="container">
            <div className="home-section-head-pink center">
              <div>
                <span>Trải nghiệm đẳng cấp</span>
                <h2>Hành trình đánh thức vẻ đẹp tự nhiên</h2>
                <p>
                  LUNA Beauty Salon & Spa không chỉ mang đến các dịch vụ làm đẹp thông thường, mà kiến tạo một hành trình trị liệu tinh tế, kết hợp công nghệ thông minh cá nhân hóa trọn vẹn và không gian thư giãn tối đa.
                </p>
              </div>
            </div>

            <div className="home-process-grid-pink">
              <article>
                <span>01</span>
                <h3>Công Nghệ AI Cá Nhân Hóa</h3>
                <p>Độc quyền chẩn đoán da mặt AI Skin Analyzer & tư vấn kiểu tóc AI Stylist, thiết lập phác đồ chính xác cho riêng bạn.</p>
              </article>

              <article>
                <span>02</span>
                <h3>Kỹ Thuật Viên 5 Sao</h3>
                <p>Đội ngũ chuyên viên hàng đầu giàu kinh nghiệm, tận tâm, mang lại sự hoàn hảo trong từng nét chạm chăm sóc.</p>
              </article>

              <article>
                <span>03</span>
                <h3>Không Gian Trị Liệu Zen</h3>
                <p>Hệ thống phòng VIP khép kín sang trọng, âm nhạc trị liệu sâu kết hợp tinh dầu organic dịu lành thư giãn tinh thần.</p>
              </article>

              <article>
                <span>04</span>
                <h3>Dược Mỹ Phẩm Thượng Hạng</h3>
                <p>
                  Cam kết sử dụng 100% dòng sản phẩm sinh học cao cấp, nhập khẩu chính hãng từ Thụy Sĩ, Pháp, Hàn Quốc lành tính.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="container home-section-pink reveal-section reveal-scale-up">
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
                      resolveFileUrl("/images/home/hero-girl.png"),
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

        {/* Customer Reviews Section */}
        <section className="container home-section-pink reveal-section reveal-fade-up">
          <div className="home-section-head-pink center">
            <div>
              <span>Khách hàng chia sẻ</span>
              <h2>Đánh giá từ khách hàng về dịch vụ</h2>
              <p>
                Những phản hồi chân thực từ khách hàng sau khi trải nghiệm các dịch vụ chăm sóc tóc, móng, da mặt và công nghệ AI đột phá tại LUNA.
              </p>
            </div>
          </div>

          <div 
            className={`home-reviews-container ${dragged ? 'grabbing' : ''}`}
            onMouseDown={(e) => {
              setTouchStart(e.clientX);
              setDragged(true);
            }}
            onMouseUp={(e) => {
              if (dragged) {
                handleMouseUp(e.clientX);
                setDragged(false);
              }
            }}
            onMouseLeave={() => {
              setReviewsPaused(false);
              if (dragged) {
                setDragged(false);
              }
            }}
            onMouseEnter={() => setReviewsPaused(true)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="home-reviews-slider-track-wrapper">
              <div 
                className="home-reviews-slider-track"
                style={{ 
                  transform: `translateX(-${currentReview * (100 / reviewsToShow.length)}%)`,
                  width: `${reviewsToShow.length * 100}%`
                }}
              >
                {reviewsToShow.map((item, idx) => {
                  const formattedDate = item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString("vi-VN") : "Gần đây";
                  return (
                    <div 
                      className={`home-review-slide ${idx === currentReview ? 'active' : ''}`}
                      key={item.ReviewId || idx}
                      style={{ width: `${100 / reviewsToShow.length}%` }}
                    >
                      <div className="review-card-left">
                        <div className="review-user-info">
                          <div className="review-avatar-badge">
                            {item.CustomerName ? item.CustomerName.charAt(0) : "K"}
                          </div>
                          <div>
                            <h3>{item.CustomerName || "Khách hàng ẩn danh"}</h3>
                            <span className="review-date">{formattedDate}</span>
                          </div>
                        </div>

                        <div className="review-service-tag">
                          🌸 {item.ServiceName || "Dịch vụ tổng hợp"}
                        </div>

                        <div className="review-stars">
                          {Array.from({ length: item.Rating || 5 }).map((_, i) => (
                            <span key={i} className="star-icon">★</span>
                          ))}
                        </div>
                      </div>

                      <div className="review-card-right">
                        <span className="quote-mark">“</span>
                        <p className="review-comment">{item.Comment}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slider Dots */}
            <div className="home-reviews-dots">
              {reviewsToShow.map((_, idx) => (
                <button
                  key={idx}
                  className={`review-dot-btn ${idx === currentReview ? 'active' : ''}`}
                  onClick={() => handleReviewDotClick(idx)}
                  title={`Xem đánh giá thứ ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

      {/* Lightbox Modal for viewing salon space */}
      {lightboxIndex !== null && (
        <div className="gallery-lightbox-modal" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIndex(null)}>×</button>
          
          <button 
            className="lightbox-nav prev" 
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev === 0 ? galleryItems.length - 1 : prev - 1));
            }}
          >
            ‹
          </button>
          
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={galleryItems[lightboxIndex].imageUrl} 
              alt={galleryItems[lightboxIndex].title} 
            />
            <div className="lightbox-caption">
              <span className="caption-tag">{galleryItems[lightboxIndex].tag}</span>
              <h3>{galleryItems[lightboxIndex].title}</h3>
              <p>{galleryItems[lightboxIndex].desc}</p>
            </div>
          </div>
          
          <button 
            className="lightbox-nav next" 
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev === galleryItems.length - 1 ? 0 : prev + 1));
            }}
          >
            ›
          </button>
        </div>
      )}
      </main>

      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Column 1: Store Intro & Social Links */}
          <div className="footer-col">
            <Link to="/" className="logo">
              <span className="logo-icon">🌸</span>
              <div>
                Beauty<span>Salon & Spa</span>
              </div>
            </Link>
            <p className="footer-desc">
              LUNA Beauty Salon mang đến những dịch vụ chăm sóc tóc, nail và liệu trình spa đẳng cấp 5 sao. Sự hài lòng và tỏa sáng của bạn là sứ mệnh của chúng tôi.
            </p>
            <div className="footer-socials">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" title="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" title="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" title="TikTok">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.99 1.25 2.37 2.14 3.91 2.58v3.66c-1.87-.01-3.7-.63-5.22-1.78-.45-.34-.86-.73-1.22-1.16v7.36c.07 1.84-.46 3.67-1.52 5.16-1.37 1.93-3.64 3.09-6.02 3.07-2.61.02-5.06-1.34-6.36-3.61-1.35-2.31-1.35-5.21 0-7.52 1.3-2.27 3.75-3.63 6.36-3.61.16 0 .32.01.48.02V12.1c-.16-.01-.32-.02-.48-.02-1.63-.03-3.15.86-3.95 2.27-.85 1.51-.85 3.42 0 4.93.8 1.41 2.32 2.3 3.95 2.27 1.97.02 3.65-1.42 3.86-3.38.03-.26.04-.52.04-.78V.02h.01z"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" title="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z"/><polygon points="10 15 15 12 10 9"/></svg>
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-col">
            <h4>Liên kết nhanh</h4>
            <ul className="footer-links">
              <li><Link to="/">Trang chủ</Link></li>
              <li><Link to="/services">Dịch vụ lẻ</Link></li>
              <li><Link to="/packages">Combo liệu trình</Link></li>
              <li><Link to="/promotions">Chương trình ưu đãi</Link></li>
              <li><Link to="/technicians">Kỹ thuật viên</Link></li>
            </ul>
          </div>

          {/* Column 3: Contact Details */}
          <div className="footer-col">
            <h4>Thông tin liên hệ</h4>
            <ul className="footer-contact-info">
              <li>
                <span className="contact-icon">🏢</span>
                <div>
                  <strong>Địa chỉ:</strong>
                  <br />
                  123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng
                </div>
              </li>
              <li>
                <span className="contact-icon">📞</span>
                <div>
                  <strong>Hotline hỗ trợ:</strong>
                  <br />
                  0123 456 789
                </div>
              </li>
              <li>
                <span className="contact-icon">✉️</span>
                <div>
                  <strong>Email:</strong>
                  <br />
                  spa@beautysalon.com
                </div>
              </li>
              <li>
                <span className="contact-icon">🕒</span>
                <div>
                  <strong>Giờ làm việc:</strong>
                  <br />
                  Hàng ngày: 08:00 - 20:00
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4: Google Map Iframe */}
          <div className="footer-col">
            <h4>Bản đồ cửa hàng</h4>
            <div className="footer-map-container">
              <iframe
                title="Bản đồ salon"
                src="https://maps.google.com/maps?q=123%20Nguy%E1%BB%85n%20V%C4%83n%20Linh%2C%20H%E1%BA%A3i%20Ch%C3%A2u%2C%20%C4%90%C3%A0%20N%E1%BA%B5ng&t=&z=16&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, display: "block" }}
                allowFullScreen=""
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Footer Bottom copyright & links */}
        <div className="footer-bottom">
          <p>© 2026 LUNA Beauty Salon & Spa. Tất cả quyền được bảo lưu.</p>
          <div className="footer-bottom-links">
            <a href="#privacy">Chính sách bảo mật</a>
            <a href="#terms">Điều khoản sử dụng</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
