const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const errorMiddleware = require("./middlewares/error.middleware");
const { connectDB } = require("./config/db");

const app = express();
const configuredOrigins = String(
  process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "",
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const localBackendOrigins = [
  `http://localhost:${process.env.PORT || 5000}`,
  `http://127.0.0.1:${process.env.PORT || 5000}`,
];
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...localBackendOrigins,
  ...(process.env.NODE_ENV === "production" ? [] : developmentOrigins),
]);

app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      // Cho phép linh hoạt trong môi trường phát triển hoặc khi dùng Cloudflare Tunnels
      if (
        process.env.NODE_ENV !== "production" ||
        origin.endsWith(".trycloudflare.com")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);
const jsonLimit = process.env.JSON_BODY_LIMIT || "12mb";
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ limit: jsonLimit, extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.get("/api", (req, res) =>
  res.json({ message: "Beauty Salon Management API" }),
);
if (process.env.NODE_ENV !== "production") {
  app.get("/", (req, res) =>
    res.json({ message: "Beauty Salon Management API" }),
  );
}
app.get("/api/health", async (req, res) => {
  try {
    const pool = await connectDB();
    await pool.request().query("SELECT 1 AS Healthy");
    return res.json({
      status: "ok",
      database: "connected",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: "unavailable",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/customers", require("./modules/customers/customers.routes"));
app.use("/api/technician", require("./modules/technician/technician.routes"));
app.use("/api/attendance", require("./modules/technician/attendance.routes"));
app.use("/api/timesheet", require("./modules/technician/timesheet.routes"));
app.use("/api/employees", require("./modules/employees/employees.routes"));
app.use("/api/services", require("./modules/services/services.routes"));
app.use("/api/packages", require("./modules/packages/packages.routes"));
app.use(
  "/api/appointments",
  require("./modules/appointments/appointments.routes"),
);
app.use("/api/payments", require("./modules/payments/payments.routes"));
app.use("/api/membership", require("./modules/membership/membership.routes"));
app.use(
  "/api/notifications",
  require("./modules/notifications/notifications.routes"),
);
app.use("/api/ai", require("./modules/ai/general/ai.routes"));
app.use("/api/reports", require("./modules/reports/reports.routes"));
app.use("/api/admin", require("./modules/admin/admin.routes"));
app.use(
  "/api/admin/employees",
  require("./modules/admin/adminEmployees.routes"),
);
app.use(
  "/api/admin/work-shifts",
  require("./modules/admin/adminWorkShifts.routes"),
);
app.use("/api/admin/services", require("./modules/admin/adminServices.routes"));
app.use(
  "/api/admin/service-assignments",
  require("./modules/admin/adminServiceAssignments.routes"),
);
app.use(
  "/api/admin/promotions",
  require("./modules/admin/adminPromotions.routes"),
);
app.use("/api/admin/vouchers", require("./modules/admin/adminVouchers.routes"));
app.use(
  "/api/admin/memberships",
  require("./modules/admin/adminMemberships.routes"),
);
app.use("/api/admin/users", require("./modules/admin/adminUsers.routes"));
app.use("/api/admin/packages", require("./modules/admin/adminPackages.routes"));
app.use("/api/admin/reviews", require("./modules/admin/adminReviews.routes"));
app.use(
  "/api/admin/feedbacks",
  require("./modules/admin/adminFeedbacks.routes"),
);
app.use("/api/admin/reports", require("./modules/admin/adminReports.routes"));
app.use(
  "/api/admin/system-logs",
  require("./modules/admin/adminSystemLogs.routes"),
);
app.use(
  "/api/admin/ai-monitoring",
  require("./modules/admin/adminAIMonitoring.routes"),
);
app.use(
  "/api/admin/customers",
  require("./modules/admin/adminCustomers.routes"),
);
app.use(
  "/api/internal-analytics",
  require("./modules/internal-analytics/internalAnalytics.routes"),
);
app.use(
  "/api/receptionist",
  require("./modules/receptionist/receptionist.routes"),
);
app.use("/api/vouchers", require("./modules/vouchers/vouchers.routes"));
app.use(
  "/api/waiting-list",
  require("./modules/waiting-list/waiting-list.routes"),
);
app.use(
  "/api/v2/treatment-notes",
  require("./modules/treatment-notes-v2/treatment-notes-v2.routes"),
);
app.use("/api/reschedule", require("./modules/reschedule/reschedule.routes"));

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(
    express.static(frontendDist, {
      index: false,
      maxAge: "1d",
      etag: true,
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    if (!req.accepts("html")) return next();
    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorMiddleware);
module.exports = app;
