const router = require("express").Router();
const controller = require("./adminAIMonitoring.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/", controller.list);
router.get("/:type/:id", controller.getById);
router.patch("/:type/:id/checked", controller.markChecked);

module.exports = router;
