const router = require("express").Router();
const controller = require("./adminUsers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/roles", controller.getRoles);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/role", controller.updateRole);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/password", controller.resetPassword);

module.exports = router;
