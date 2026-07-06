const router = require("express").Router();
const controller = require("./adminCustomers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/memberships", controller.getMembershipLevels);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/points", controller.adjustPoints);
router.patch("/:id/password", controller.resetPassword);

module.exports = router;
