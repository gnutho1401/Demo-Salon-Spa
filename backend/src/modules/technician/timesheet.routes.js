const router = require("express").Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const controller = require("./technician.controller");

router.use(authMiddleware);
router.use(allowRoles("TECHNICIAN", "ADMIN", "MANAGER"));

router.get("/weekly", controller.getWeeklyTimesheet);
router.get("/monthly", controller.getMonthlyTimesheet);

module.exports = router;
