const router = require("express").Router();
const controller = require("./ai.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.get("/my/recommendations", authMiddleware, controller.getMine);
router.get("/my/chat", authMiddleware, controller.getChatHistory);
router.post("/chat", authMiddleware, controller.chat);
router.get(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.getAll,
);
router.get(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.getById,
);
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
