const router = require("express").Router();
const controller = require("./admin.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.get("/dashboard", allowRoles("ADMIN"), controller.getDashboard);
router.use(allowRoles("ADMIN", "MANAGER"));
router.use("/service-categories", require("./adminCategories.routes"));
router.use("/refunds", require("./adminRefunds.routes"));

module.exports = router;
