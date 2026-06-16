const router = require("express").Router();
const controller = require("./adminServiceAssignments.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/:serviceId/technicians", controller.getAssignedTechnicians);
router.put("/:serviceId/technicians", controller.updateAssignedTechnicians);

module.exports = router;
