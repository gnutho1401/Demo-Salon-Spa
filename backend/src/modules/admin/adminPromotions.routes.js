const router = require("express").Router();
const controller = require("./adminPromotions.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/services", controller.getServices);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.get("/:id/services", controller.getAssignedServices);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/services", controller.updateAssignedServices);
router.delete("/:id", controller.remove);

module.exports = router;
