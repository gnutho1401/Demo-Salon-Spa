const express = require("express");
const cors = require("cors");
const path = require("path");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.get("/", (req, res) =>
  res.json({ message: "Beauty Salon Management API" }),
);

app.use("/api/auth", require("./modules/auth/auth.routes"));
// app.use("/api/users", require("./modules/users/users.routes"));
app.use("/api/customers", require("./modules/customers/customers.routes"));
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
app.use("/api/ai", require("./modules/ai/ai.routes"));
app.use("/api/reports", require("./modules/reports/reports.routes"));
app.use("/api/vouchers", require("./modules/vouchers/vouchers.routes"));
app.use("/api/waiting-list", require("./modules/waiting-list/waiting-list.routes"));


app.use(errorMiddleware);
module.exports = app;
