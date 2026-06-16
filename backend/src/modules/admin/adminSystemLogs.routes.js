const router = require("express").Router();
const controller = require("./adminSystemLogs.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/", controller.list);
router.get("/:id", controller.getById);

module.exports = router;
