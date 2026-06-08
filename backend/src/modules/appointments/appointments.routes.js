const router = require("express").Router();
const controller = require("./appointments.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// Customer: xem lịch hẹn của chính mình
router.get("/my", authMiddleware, controller.getMyAppointments);

router.get("/available-slots", authMiddleware, controller.getAvailableSlots);

// Customer: tạo lịch hẹn mới
router.post("/", authMiddleware, controller.create);

// Admin / Receptionist / Manager: xem tất cả lịch hẹn
router.get("/", authMiddleware, controller.getAll);

// Xem chi tiết lịch hẹn
router.get("/:id", authMiddleware, controller.getById);

// Cập nhật lịch hẹn
router.put("/:id", authMiddleware, controller.update);

// Xóa / hủy lịch hẹn
router.delete("/:id", authMiddleware, controller.remove);

module.exports = router;
