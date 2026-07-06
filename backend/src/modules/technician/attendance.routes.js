const router = require("express").Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const controller = require("./technician.controller");

router.use(authMiddleware);
router.use(allowRoles("TECHNICIAN", "ADMIN", "MANAGER"));

router.post("/check-in", controller.checkIn);
router.post("/check-out", controller.checkOut);
router.get("/my", controller.getMyAttendance);
router.get("/:shiftId", controller.getAttendanceByShift);

module.exports = router;
