const router = require("express").Router();
const controller = require("./receptionist.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const avatarUploadDir = path.join(
  __dirname,
  "../../../uploads/receptionist-avatars",
);
fs.mkdirSync(avatarUploadDir, { recursive: true });

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
});

router.use(authMiddleware);
router.use(allowRoles("Receptionist", "Admin", "Manager"));

router.get("/reviews", controller.getReviews);
router.get("/dashboard", controller.getDashboard);
router.get("/notifications", controller.getNotifications);
router.put("/notifications/read-all", controller.markAllNotificationsRead);
router.put("/notifications/:id/read", controller.markNotificationRead);

router.get("/appointments", controller.getAppointments);
router.post("/appointments", controller.createAppointment);
router.post("/walk-ins", controller.createWalkInAppointment);
router.get("/appointments/:id", controller.getAppointmentById);

router.get("/available-technicians", controller.getAvailableTechnicians);
router.get("/available-slots", controller.getAvailableSlots);

router.get("/customers", controller.getCustomers);
router.get("/customers/search", controller.getCustomersSearch);
router.get("/customers/:id", controller.getCustomerById);
router.put("/customers/:id", controller.updateCustomer);
router.post("/customers", controller.createCustomer);

router.get("/services", controller.getServices);
router.get("/technicians", controller.getTechnicians);

router.get("/invoices", controller.getInvoices);
router.get("/invoices/:id", controller.getInvoiceById);
router.post("/invoices/:id/mark-paid", controller.markInvoicePaid);
router.post("/invoices/:id/refund", controller.requestInvoiceRefund);
router.put("/invoices/:id/update-details", controller.updateInvoiceDetails);
router.post("/invoices/:id/send-email", controller.sendInvoiceEmail);
router.post(
  "/appointments/:id/create-invoice",
  controller.createInvoiceManually,
);

router.put("/appointments/:id/confirm", controller.confirmAppointment);
router.put("/appointments/:id/check-in", controller.checkInAppointment);
router.put("/appointments/:id/start", controller.startAppointment);
router.put("/appointments/:id/complete", controller.completeAppointment);
router.post("/appointments/:id/checkout", controller.checkoutAppointment);
router.get("/technicians/:id/workload", controller.getTechnicianWorkload);
router.put("/appointments/:id/assign-technician", controller.assignTechnician);
router.post(
  "/technicians/transfer-appointments",
  controller.transferAppointments,
);
router.put("/appointments/:id/cancel", controller.cancelAppointment);
router.put("/appointments/:id/reschedule", controller.rescheduleAppointment);
router.put("/appointments/:id/no-show", controller.noShowAppointment);
router.put(
  "/appointment-services/:id/status",
  controller.updateAppointmentServiceStatus,
);

router.get("/waiting-list", controller.getWaitingList);
router.post("/waiting-list", controller.createWaitingList);
router.put("/waiting-list/:id", controller.updateWaitingList);
router.delete("/waiting-list/:id", controller.deleteWaitingList);
router.get(
  "/waiting-list/:id/available-slots",
  controller.getWaitingAvailableSlots,
);
router.post(
  "/waiting-list/:id/convert",
  controller.convertWaitingListToAppointment,
);

router.get(
  "/smart-booking-suggestions",
  authMiddleware,
  controller.getSmartBookingSuggestions,
);

router.get("/profile", controller.getProfile);
router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);
router.put("/avatar", uploadAvatar.single("avatar"), controller.updateAvatar);

router.patch(
  "/appointments/:id/change-technician",
  controller.changeTechnician,
);

module.exports = router;
