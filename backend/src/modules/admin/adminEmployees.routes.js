const router = require("express").Router();
const controller = require("./adminEmployees.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/roles", controller.getRoles);
router.get("/branches", controller.getBranches);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.get("/:id/services", controller.getAssignedServices);
router.put("/:id/services", controller.updateAssignedServices);

module.exports = router;
