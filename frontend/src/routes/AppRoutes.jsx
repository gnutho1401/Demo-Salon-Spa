import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import GuestLayout from "../components/layout/GuestLayout";
import Home from "../pages/guest/Home";
import ServiceList from "../pages/guest/ServiceList";
import ServiceDetail from "../pages/guest/ServiceDetail";
import ContactPage from "../pages/guest/ContactPage";
import PromotionsPage from "../pages/guest/PromotionsPage";
import TechnicianDetail from "../pages/guest/TechnicianDetail";
import PackageList from "../pages/guest/PackageList";
import PackageDetail from "../pages/guest/PackageDetail";
import PaymentResult from "../pages/customer/PaymentResult";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import VerifyEmail from "../pages/auth/VerifyEmail";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";

import CustomerDashboard from "../pages/customer/CustomerDashboard";
import BookingPage from "../pages/customer/BookingPage";
import MyAppointments from "../pages/customer/MyAppointments";
import PaymentHistory from "../pages/customer/PaymentHistory";
import CustomerProfile from "../pages/customer/CustomerProfile";
import ChangePassword from "../pages/customer/ChangePassword";
import CustomerPackages from "../pages/customer/CustomerPackages";
import MembershipPage from "../pages/customer/MembershipPage";
import NotificationsPage from "../pages/customer/NotificationsPage";
import AiAssistantPage from "../pages/customer/AiAssistantPage";
import FeedbackPage from "../pages/customer/FeedbackPage";
import VouchersPage from "../pages/customer/VouchersPage";
import WaitingListPage from "../pages/customer/WaitingListPage";
import AppointmentSuccess from "../pages/customer/AppointmentSuccess";
import AppointmentDetail from "../pages/customer/AppointmentDetail";
import PaymentPage from "../pages/customer/PaymentPage";
import ServiceHistory from "../pages/customer/ServiceHistory";

import AdminDashboard from "../pages/admin/AdminDashboard";
import ReceptionistDashboard from "../pages/receptionist/ReceptionistDashboard";
import TechnicianDashboard from "../pages/technician/TechnicianDashboard";

import axiosClient, { resolveFileUrl } from "../api/axiosClient";
import ProtectedRoute from "./ProtectedRoute";

function PublicPage({ children }) {
  return <GuestLayout>{children}</GuestLayout>;
}

function CustomerProtectedPage({ children }) {
  return (
    <ProtectedRoute allowedRoles={["CUSTOMER"]}>{children}</ProtectedRoute>
  );
}

function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient
      .get("/employees")
      .then((res) => setTechnicians(res.data.data || res.data || []))
      .catch((err) => console.log("Lỗi lấy kỹ thuật viên:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section container technicians-page">
      <div className="section-head">
        <div>
          <div className="eyebrow">Đội ngũ chuyên gia</div>
          <h2 className="section-title">Danh sách kỹ thuật viên</h2>
          <p className="muted">
            Xem thông tin chuyên môn, chi nhánh và đặt lịch trực tiếp với kỹ
            thuật viên phù hợp.
          </p>
        </div>

        <Link className="btn" to="/customer/booking">
          Đặt lịch ngay
        </Link>
      </div>

      {loading ? <p className="muted">Đang tải kỹ thuật viên...</p> : null}

      <div className="tech-list-grid">
        {technicians.map((t, index) => (
          <article className="tech-profile-card" key={t.EmployeeId}>
            <div className="tech-cover">
              <img src={resolveFileUrl(t.ImageUrl)} alt={t.FullName} />
              <span className="tech-rating">
                ★ {Number(4.8 - index * 0.1).toFixed(1)}
              </span>
            </div>

            <div className="tech-profile-body">
              <div className="tech-status">{t.Status || "ACTIVE"}</div>

              <h3>{t.FullName}</h3>

              <p className="muted">
                {t.Position || "Kỹ thuật viên"} •{" "}
                {t.Specialization || "Chăm sóc sắc đẹp"}
              </p>

              <div className="tech-meta">
                <span>📍 {t.BranchName || "Beauty Salon"}</span>
                <span>💼 {5 + index} năm kinh nghiệm</span>
              </div>

              <div className="tech-actions">
                <Link className="card-btn" to={`/technicians/${t.EmployeeId}`}>
                  Xem chi tiết
                </Link>

                <Link
                  className="card-btn primary"
                  to={`/customer/booking?employeeId=${t.EmployeeId}`}
                >
                  Đặt với kỹ thuật viên này
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {selectedTech ? (
        <div className="modal-backdrop" onClick={() => setSelectedTech(null)}>
          <div
            className="modal-card technician-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelectedTech(null)}
            >
              ×
            </button>

            <div className="technician-detail">
              <img
                src={resolveFileUrl(selectedTech.ImageUrl)}
                alt={selectedTech.FullName}
              />

              <div>
                <div className="eyebrow">Thông tin kỹ thuật viên</div>

                <h2>{selectedTech.FullName}</h2>

                <p className="muted">
                  {selectedTech.Position || "Kỹ thuật viên"} tại{" "}
                  {selectedTech.BranchName || "Beauty Salon & Spa"}
                </p>

                <div className="detail-grid">
                  <p>
                    <b>Chuyên môn:</b>
                    <br />
                    {selectedTech.Specialization ||
                      "Massage, Nail, Hair, Skincare"}
                  </p>

                  <p>
                    <b>Trạng thái:</b>
                    <br />
                    {selectedTech.Status || "ACTIVE"}
                  </p>

                  <p>
                    <b>Đánh giá:</b>
                    <br />
                    ★★★★★ 4.8/5
                  </p>

                  <p>
                    <b>Lịch làm việc:</b>
                    <br />
                    08:00 - 20:00
                  </p>
                </div>

                <p className="muted">
                  Kỹ thuật viên sẽ hỗ trợ tư vấn dịch vụ phù hợp và cập nhật ghi
                  chú liệu trình cho khách hàng.
                </p>

                <Link
                  className="btn"
                  to={`/customer/booking?employeeId=${selectedTech.EmployeeId}`}
                >
                  Đặt lịch ngay
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Guest */}
      <Route
        path="/"
        element={
          <PublicPage>
            <Home />
          </PublicPage>
        }
      />

      <Route
        path="/services"
        element={
          <PublicPage>
            <ServiceList />
          </PublicPage>
        }
      />

      <Route
        path="/customer/payment-result"
        element={
          <CustomerProtectedPage>
            <PaymentResult />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/services/:id"
        element={
          <PublicPage>
            <ServiceDetail />
          </PublicPage>
        }
      />

      <Route
        path="/packages"
        element={
          <PublicPage>
            <PackageList />
          </PublicPage>
        }
      />

      <Route
        path="/packages/:id"
        element={
          <PublicPage>
            <PackageDetail />
          </PublicPage>
        }
      />

      <Route
        path="/technicians"
        element={
          <PublicPage>
            <TechniciansPage />
          </PublicPage>
        }
      />

      <Route
        path="/technicians/:id"
        element={
          <PublicPage>
            <TechnicianDetail />
          </PublicPage>
        }
      />

      <Route
        path="/promotions"
        element={
          <PublicPage>
            <PromotionsPage />
          </PublicPage>
        }
      />

      <Route
        path="/contact"
        element={
          <PublicPage>
            <ContactPage />
          </PublicPage>
        }
      />

      <Route
        path="/login"
        element={
          <PublicPage>
            <Login />
          </PublicPage>
        }
      />

      <Route
        path="/register"
        element={
          <PublicPage>
            <Register />
          </PublicPage>
        }
      />

      <Route
        path="/verify-email"
        element={
          <PublicPage>
            <VerifyEmail />
          </PublicPage>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicPage>
            <ForgotPassword />
          </PublicPage>
        }
      />

      <Route
        path="/reset-password"
        element={
          <PublicPage>
            <ResetPassword />
          </PublicPage>
        }
      />

      {/* Customer - protected */}
      <Route
        path="/customer"
        element={
          <CustomerProtectedPage>
            <CustomerDashboard />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/booking"
        element={
          <CustomerProtectedPage>
            <BookingPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/appointments"
        element={
          <CustomerProtectedPage>
            <MyAppointments />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/appointments/:id"
        element={
          <CustomerProtectedPage>
            <AppointmentDetail />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/payment/:appointmentId"
        element={
          <CustomerProtectedPage>
            <PaymentPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/payments"
        element={
          <CustomerProtectedPage>
            <PaymentHistory />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/service-history"
        element={
          <CustomerProtectedPage>
            <ServiceHistory />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/packages"
        element={
          <CustomerProtectedPage>
            <CustomerPackages />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/membership"
        element={
          <CustomerProtectedPage>
            <MembershipPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/notifications"
        element={
          <CustomerProtectedPage>
            <NotificationsPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/vouchers"
        element={
          <CustomerProtectedPage>
            <VouchersPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/waiting-list"
        element={
          <CustomerProtectedPage>
            <WaitingListPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/ai"
        element={
          <CustomerProtectedPage>
            <AiAssistantPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/feedback"
        element={
          <CustomerProtectedPage>
            <FeedbackPage />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/profile"
        element={
          <CustomerProtectedPage>
            <CustomerProfile />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/change-password"
        element={
          <CustomerProtectedPage>
            <ChangePassword />
          </CustomerProtectedPage>
        }
      />

      <Route
        path="/customer/appointment-success/:appointmentId"
        element={
          <CustomerProtectedPage>
            <AppointmentSuccess />
          </CustomerProtectedPage>
        }
      />

      {/* Other roles */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST"]}>
            <ReceptionistDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/technician"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
