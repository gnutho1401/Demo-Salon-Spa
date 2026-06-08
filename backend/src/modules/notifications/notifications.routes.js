const router = require("express").Router();
const controller = require("./notifications.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.get("/my", authMiddleware, controller.getMine);
router.put("/my/read-all", authMiddleware, controller.markAllRead);
router.put("/my/:id/read", authMiddleware, controller.markRead);
router.get(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getAll,
);
router.get(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getById,
);
router.post(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.remove,
);

module.exports = router;
