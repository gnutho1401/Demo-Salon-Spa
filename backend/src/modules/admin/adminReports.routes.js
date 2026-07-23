const router = require("express").Router();
const controller = require("./adminReports.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN"));

router.get("/summary", controller.getSummary);

module.exports = router;
