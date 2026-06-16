const express = require("express");
const cors = require("cors");
const path = require("path");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.get("/", (req, res) => res.json({ message: "Beauty Salon Management API" }));

app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/customers", require("./modules/customers/customers.routes"));
app.use("/api/technician", require("./modules/technician/technician.routes"));
app.use("/api/employees", require("./modules/employees/employees.routes"));
app.use("/api/services", require("./modules/services/services.routes"));
app.use("/api/packages", require("./modules/packages/packages.routes"));
app.use("/api/appointments", require("./modules/appointments/appointments.routes"));
app.use("/api/payments", require("./modules/payments/payments.routes"));
app.use("/api/membership", require("./modules/membership/membership.routes"));
app.use("/api/notifications", require("./modules/notifications/notifications.routes"));
app.use("/api/ai", require("./modules/ai/ai.routes"));
app.use("/api/reports", require("./modules/reports/reports.routes"));
app.use("/api/admin", require("./modules/admin/admin.routes"));
app.use("/api/admin/employees", require("./modules/admin/adminEmployees.routes"));
app.use("/api/admin/work-shifts", require("./modules/admin/adminWorkShifts.routes"));
app.use("/api/admin/services", require("./modules/admin/adminServices.routes"));
app.use("/api/admin/service-assignments", require("./modules/admin/adminServiceAssignments.routes"));
app.use("/api/admin/promotions", require("./modules/admin/adminPromotions.routes"));
app.use("/api/admin/vouchers", require("./modules/admin/adminVouchers.routes"));
app.use("/api/admin/memberships", require("./modules/admin/adminMemberships.routes"));
app.use("/api/admin/users", require("./modules/admin/adminUsers.routes"));
app.use("/api/admin/packages", require("./modules/admin/adminPackages.routes"));
app.use("/api/admin/reviews", require("./modules/admin/adminReviews.routes"));
app.use("/api/admin/feedbacks", require("./modules/admin/adminFeedbacks.routes"));
app.use("/api/admin/reports", require("./modules/admin/adminReports.routes"));
app.use("/api/admin/system-logs", require("./modules/admin/adminSystemLogs.routes"));
app.use("/api/admin/ai-monitoring", require("./modules/admin/adminAIMonitoring.routes"));
app.use("/api/receptionist", require("./modules/receptionist/receptionist.routes"));
app.use("/api/vouchers", require("./modules/vouchers/vouchers.routes"));
app.use("/api/waiting-list", require("./modules/waiting-list/waiting-list.routes"));

app.use(errorMiddleware);
module.exports = app;
