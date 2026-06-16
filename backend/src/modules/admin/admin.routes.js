const router = require("express").Router();
const controller = require("./admin.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/dashboard", controller.getDashboard);
router.use("/service-categories", require("./adminCategories.routes"));

module.exports = router;
