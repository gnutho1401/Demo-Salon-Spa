const router = require("express").Router();
const controller = require("./packages.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.get("/my", authMiddleware, controller.getMine);
router.get("/categories/list", controller.getCategories);
router.get("/vnpay-return", controller.vnpayReturn);
router.post("/:id/buy", authMiddleware, controller.buyPackage);
router.post("/:id/vnpay", authMiddleware, controller.createVnpayPackage);
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
