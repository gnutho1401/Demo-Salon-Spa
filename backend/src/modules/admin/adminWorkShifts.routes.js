const router = require("express").Router();
const controller = require("./adminWorkShifts.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/technicians", controller.getTechnicians);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

router.get("/:id/registrations", controller.getRegistrations);
router.post("/:id/assign", controller.assignTechnician);
router.patch("/registrations/:registrationId/status", controller.updateRegistrationStatus);
router.delete("/registrations/:registrationId", controller.removeRegistration);

module.exports = router;

