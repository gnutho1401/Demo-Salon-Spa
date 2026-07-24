const router = require("express").Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const controller = require("./technician.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const treatmentUploadDir = path.join(
  __dirname,
  "../../../uploads/treatment-notes",
);

const avatarUploadDir = path.join(
  __dirname,
  "../../../uploads/technician-avatars",
);

[treatmentUploadDir, avatarUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function makeSafeFileName(originalname) {
  const ext = path.extname(originalname || "");
  const baseName = path
    .basename(originalname || "file", ext)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
    baseName || "file"
  }${ext}`;
}

const treatmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, treatmentUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, makeSafeFileName(file.originalname));
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, makeSafeFileName(file.originalname));
  },
});

const treatmentAllowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
];

const avatarAllowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const uploadTreatmentFiles = multer({
  storage: treatmentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!treatmentAllowedTypes.includes(file.mimetype)) {
      return cb(new Error("Chỉ cho phép upload ảnh hoặc PDF"));
    }

    return cb(null, true);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!avatarAllowedTypes.includes(file.mimetype)) {
      return cb(new Error("Chỉ cho phép upload ảnh JPG, PNG hoặc WEBP"));
    }

    return cb(null, true);
  },
});

router.get(
  "/dashboard",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getDashboard,
);

router.get(
  "/schedule",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getSchedule,
);

router.get(
  "/schedule/available-slots",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAvailableSlots,
);

router.get(
  "/shifts",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAvailableShifts,
);

router.post(
  "/shifts/register",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.registerShift,
);

router.delete(
  "/shifts/register/:id",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.cancelRegistration,
);

router.get(
  "/my-shifts",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getMyShifts,
);

router.get(
  "/shifts/quotas",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getShiftQuotas,
);

router.get(
  "/shifts/stats",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAttendanceWeeklyStats,
);

router.post(
  "/attendance/check-in",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.checkIn,
);

router.post(
  "/attendance/check-out",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.checkOut,
);

router.get(
  "/reviews",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getReviews,
);

router.get(
  "/customers/summary",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getCustomersSummary,
);

router.get(
  "/customers",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getCustomers,
);

router.get(
  "/appointments/summary",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAppointmentsSummary,
);

router.get(
  "/customers/:id",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getCustomerDetail,
);

router.get(
  "/customers/:id/insights",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getCustomerInsights,
);

router.patch(
  "/appointments/:id/start",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.startAppointment,
);
router.put(
  "/appointments/:id/start",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.startAppointment,
);

router.patch(
  "/appointments/:id/complete",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.completeAppointment,
);
router.put(
  "/appointments/:id/complete",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.completeAppointment,
);

// Hoàn thành bước dịch vụ của KTV trong Combo (đồng bộ với lễ tân)
router.patch(
  "/appointments/:id/complete-step",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.completeMyStep,
);
router.put(
  "/appointments/:id/complete-step",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.completeMyStep,
);

router.patch(
  "/appointments/:id/duration",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.updateAppointmentDuration,
);

router.get(
  "/appointments/:id",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAppointmentDetail,
);

router.patch(
  "/appointments/:id/no-show",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.markNoShow,
);

router.post(
  "/appointments/:id/treatment-notes",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.addTreatmentNote,
);

router.get(
  "/appointments",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getAppointments,
);

router.post(
  "/appointments",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.createAppointment,
);

router.get(
  "/treatment-notes",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getTreatmentNotesPage,
);

router.post(
  "/treatment-notes",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.saveTreatmentNote,
);

router.get(
  "/treatment-notes/:appointmentId/history",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getCustomerNoteHistory,
);

router.delete(
  "/treatment-notes/:noteId",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.deleteTreatmentNote,
);

router.post(
  "/treatment-notes/:noteId/attachments",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  uploadTreatmentFiles.array("files", 10),
  controller.uploadTreatmentAttachments,
);

router.patch(
  "/treatment-notes/:noteId/progress",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.updateTreatmentProgress,
);

router.get(
  "/earnings",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getEarnings,
);

router.get(
  "/earnings/export",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.exportEarnings,
);

router.get(
  "/earnings/payouts",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getEarningPayoutHistory,
);

router.post(
  "/earnings/payouts",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.createPayoutRequest,
);

router.put(
  "/earnings/goal",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.updateEarningGoal,
);

router.get(
  "/profile",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getProfile,
);

router.put(
  "/profile",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.updateProfile,
);

router.put(
  "/avatar",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  uploadAvatar.single("avatar"),
  controller.updateAvatar,
);

router.get(
  "/settings",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.getSettings,
);

router.put(
  "/settings",
  authMiddleware,
  allowRoles("TECHNICIAN", "ADMIN", "MANAGER"),
  controller.updateSettings,
);

module.exports = router;
