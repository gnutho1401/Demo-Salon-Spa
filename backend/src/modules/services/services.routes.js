const router = require("express").Router();
const controller = require("./services.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);

router.post(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.remove,
);

module.exports = router;
