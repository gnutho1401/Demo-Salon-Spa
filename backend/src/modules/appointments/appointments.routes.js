const router = require("express").Router();
const controller = require("./appointments.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

// Customer: xem lịch hẹn của chính mình
router.get("/my", authMiddleware, controller.getMyAppointments);

router.get("/available-slots", authMiddleware, controller.getAvailableSlots);
router.get("/:id/reschedule", authMiddleware, controller.getRescheduleInfo);
router.post("/:id/reschedule", authMiddleware, controller.reschedule);

// Customer: tạo lịch hẹn mới
router.post("/", authMiddleware, controller.create);

// Admin / Receptionist / Manager: xem tất cả lịch hẹn
router.get(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getAll,
);

// Xem chi tiết lịch hẹn
router.get("/:id", authMiddleware, controller.getById);

// Cập nhật lịch hẹn
router.put("/:id", authMiddleware, controller.update);

// Staff đánh dấu vắng mặt
router.patch(
  "/:id/no-show",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.markNoShow,
);

// Xóa / hủy lịch hẹn
router.delete("/:id", authMiddleware, controller.remove);

// Khách hàng & Staff: Xem KTV khả dụng & Đổi KTV
router.get("/:id/available-technicians", authMiddleware, controller.getAvailableTechniciansForStep);
router.patch("/:id/change-technician", authMiddleware, controller.changeTechnician);

module.exports = router;

