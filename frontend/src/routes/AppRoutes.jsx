import { Navigate, Routes, Route } from "react-router-dom";
import TechniciansPage from "../pages/guest/TechniciansPage";
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
import RescheduleAppointment from "../pages/customer/RescheduleAppointment";
import ReceptionistProfile from "../pages/receptionist/ReceptionistProfile";
import ReceptionistSettings from "../pages/receptionist/ReceptionistSettings";
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

import CustomerPackages from "../pages/customer/CustomerPackages";
import MembershipPage from "../pages/customer/MembershipPage";
import NotificationsPage from "../pages/customer/NotificationsPage";
import AiAssistantPage from "../pages/customer/AiAssistantPage";
import AiStylistAdvisor from "../pages/customer/AiStylistAdvisor";
import SkinAnalyzerPage from "../pages/customer/SkinAnalyzerPage";
import FeedbackPage from "../pages/customer/FeedbackPage";
import VouchersPage from "../pages/customer/VouchersPage";
import WaitingListPage from "../pages/customer/WaitingListPage";
import AppointmentSuccess from "../pages/customer/AppointmentSuccess";
import AppointmentDetail from "../pages/customer/AppointmentDetail";
import PaymentPage from "../pages/customer/PaymentPage";
import ServiceHistory from "../pages/customer/ServiceHistory";
import FavoritesPage from "../pages/customer/FavoritesPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminEmployees from "../pages/admin/AdminEmployees";
import AdminWorkShifts from "../pages/admin/AdminWorkShifts";
import AdminServices from "../pages/admin/AdminServices";
import AdminPromotions from "../pages/admin/AdminPromotions";
import AdminVouchers from "../pages/admin/AdminVouchers";
import AdminMemberships from "../pages/admin/AdminMemberships";
import AdminServiceCategories from "../pages/admin/AdminServiceCategories";
import AdminReviews from "../pages/admin/AdminReviews";
import AdminFeedbacks from "../pages/admin/AdminFeedbacks";
import AdminSystemLogs from "../pages/admin/AdminSystemLogs";
import AdminReports from "../pages/admin/AdminReports";
import AdminAIMonitoring from "../pages/admin/AdminAIMonitoring";
import AdminPackages from "../pages/admin/AdminPackages";
import AdminRefunds from "../pages/admin/AdminRefunds";
import AdminCustomers from "../pages/admin/AdminCustomers";
import AdminAiCrm from "../pages/admin/AdminAiCrm";
import ReceptionistDashboard from "../pages/receptionist/ReceptionistDashboard";
import ReceptionistAppointments from "../pages/receptionist/ReceptionistAppointments";
import ReceptionistAppointmentDetail from "../pages/receptionist/ReceptionistAppointmentDetail";
import ReceptionistCreateAppointment from "../pages/receptionist/ReceptionistCreateAppointment";
import ReceptionistCustomers from "../pages/receptionist/ReceptionistCustomers";
import ReceptionistCustomerDetail from "../pages/receptionist/ReceptionistCustomerDetail";
import ReceptionistInvoices from "../pages/receptionist/ReceptionistInvoices";
import ReceptionistInvoiceDetail from "../pages/receptionist/ReceptionistInvoiceDetail";
import ReceptionistWaitingList from "../pages/receptionist/ReceptionistWaitingList";
import ReceptionistReviews from "../pages/receptionist/ReceptionistReviews";
import ReceptionistNotifications from "../pages/receptionist/ReceptionistNotifications";
import TechnicianDispatcher from "../pages/receptionist/TechnicianDispatcher";
import ReceptionistRescheduleRequests from "../pages/receptionist/ReceptionistRescheduleRequests";
import ReceptionistPackages from "../pages/receptionist/ReceptionistPackages";
import TechnicianDashboard from "../pages/technician/TechnicianDashboard";
import TechnicianSchedule from "../pages/technician/TechnicianSchedule";
import ProtectedRoute from "./ProtectedRoute";
import TechnicianAppointmentDetail from "../pages/technician/TechnicianAppointmentDetail";
import TechnicianAppointments from "../pages/technician/TechnicianAppointments";
import TechnicianCustomers from "../pages/technician/TechnicianCustomers";
import TreatmentNotesHistory from "../pages/technician/TreatmentNotesHistory";
import TreatmentNotesV2 from "../pages/technician/TreatmentNotesV2";
import TechnicianEarnings from "../pages/technician/TechnicianEarnings";
import TechnicianProfile from "../pages/technician/TechnicianProfile";
import TechnicianSettings from "../pages/technician/TechnicianSettings";
import TechnicianAttendanceManager from "../pages/technician/TechnicianAttendanceManager";
import TechnicianNotifications from "../pages/technician/TechnicianNotifications";
import TechnicianReviews from "../pages/technician/TechnicianReviews";
import AdminLayout from "../components/layout/AdminLayout";
import ReviewPage from "../pages/customer/ReviewPage";
// import PackageApprovalPage from "../pages/receptionist/PackageApprovalPage";
import PackageReportPage from "../pages/admin/PackageReportPage";

function PublicPage({ children }) {
  return <GuestLayout>{children}</GuestLayout>;
}
function CustomerProtectedPage({ children }) {
  return (
    <ProtectedRoute allowedRoles={["CUSTOMER"]}>{children}</ProtectedRoute>
  );
}
function AdminProtectedPage({ children }) {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]}>
      {children}
    </ProtectedRoute>
  );
}
function AdminOnlyPage({ children }) {
  return <ProtectedRoute allowedRoles={["ADMIN"]}>{children}</ProtectedRoute>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicPage>
            <Home />
          </PublicPage>
        }
      />
      <Route
        path="/customer/reschedule/:id"
        element={
          <CustomerProtectedPage>
            <RescheduleAppointment />
          </CustomerProtectedPage>
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
        path="/customer/favorites"
        element={
          <CustomerProtectedPage>
            <FavoritesPage />
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
        path="/customer/stylist-advisor"
        element={
          <CustomerProtectedPage>
            <AiStylistAdvisor />
          </CustomerProtectedPage>
        }
      />
      <Route
        path="/customer/skin-analyzer"
        element={
          <CustomerProtectedPage>
            <SkinAnalyzerPage />
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
        path="/customer/reviews"
        element={
          <CustomerProtectedPage>
            <ReviewPage />
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
        path="/customer/appointment-success/:appointmentId"
        element={
          <CustomerProtectedPage>
            <AppointmentSuccess />
          </CustomerProtectedPage>
        }
      />
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/dashboard"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/appointments"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistAppointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/dispatch"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <TechnicianDispatcher />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/appointments/create"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistCreateAppointment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/appointments/:id"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistAppointmentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/customers"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistCustomers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/customers/:id"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistCustomerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/invoices"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistInvoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/invoices/:id"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistInvoiceDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/waiting-list"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistWaitingList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/profile"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/settings"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/notifications"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistNotifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/reviews"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistReviews />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/reschedule-requests"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistRescheduleRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/packages"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <ReceptionistPackages />
          </ProtectedRoute>
        }
      />
      {/* Commented out as freeze/extension features are deprecated
      <Route
        path="/receptionist/approvals"
        element={
          <ProtectedRoute allowedRoles={["RECEPTIONIST", "ADMIN", "MANAGER"]}>
            <PackageApprovalPage />
          </ProtectedRoute>
        }
      />
      */}
      <Route
        path="/technician"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/schedule"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianSchedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/appointments/:id"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianAppointmentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/appointments"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianAppointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/customers"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianCustomers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/treatment-notes"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TreatmentNotesV2 />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/earnings"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianEarnings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/notifications"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianNotifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/attendance"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianAttendanceManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/profile"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/settings"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technician/reviews"
        element={
          <ProtectedRoute allowedRoles={["TECHNICIAN"]}>
            <TechnicianReviews />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminEmployees />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/work-shifts"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminWorkShifts />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/services"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminServices />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/service-categories"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminServiceCategories />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/promotions"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminPromotions />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/vouchers"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminVouchers />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/memberships"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminMemberships />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/users"
        element={<Navigate to="/admin/employees" replace />}
      />
      <Route
        path="/admin/packages"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminPackages />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/refunds"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminRefunds />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/reviews"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminReviews />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/feedbacks"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminFeedbacks />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/system-logs"
        element={
          <AdminOnlyPage>
            <AdminLayout>
              <AdminSystemLogs />
            </AdminLayout>
          </AdminOnlyPage>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminOnlyPage>
            <AdminLayout>
              <AdminReports />
            </AdminLayout>
          </AdminOnlyPage>
        }
      />
      <Route
        path="/admin/ai-monitoring"
        element={
          <AdminOnlyPage>
            <AdminLayout>
              <AdminAIMonitoring />
            </AdminLayout>
          </AdminOnlyPage>
        }
      />
      <Route
        path="/admin/package-reports"
        element={
          <AdminOnlyPage>
            <AdminLayout>
              <PackageReportPage />
            </AdminLayout>
          </AdminOnlyPage>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminCustomers />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
      <Route
        path="/admin/ai-crm"
        element={
          <AdminProtectedPage>
            <AdminLayout>
              <AdminAiCrm />
            </AdminLayout>
          </AdminProtectedPage>
        }
      />
    </Routes>
  );
}
