const router = require("express").Router();
const controller = require("./ai.controller");
const stylistController = require("./stylist/stylist.controller");
const hairController = require("./stylist/hair.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const { verifyToken } = require("../../utils/jwt");

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
  } catch (err) {
    req.user = null;
  }
  next();
}

router.get("/my/recommendations", authMiddleware, controller.getMine);
router.get("/my/chat", authMiddleware, controller.getChatHistory);
router.post("/chat", optionalAuthMiddleware, controller.chat);
router.delete("/my/chat", authMiddleware, controller.clearMyChatHistory);
router.post("/stylist/analyze", authMiddleware, stylistController.analyze);
router.post("/stylist/tryon", authMiddleware, hairController.tryOn);
router.get("/stylist/history", authMiddleware, stylistController.getHistory);
router.get(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.getAll,
);
router.get(
  "/customers/churn-prediction",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.predictChurn
);
router.post(
  "/customers/:id/send-voucher",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.sendVoucherToCustomer
);
router.post(
  "/customers/:id/send-reminder",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.sendReminderToCustomer
);
router.post(
  "/customers/:id/upgrade-vip",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.upgradeVipCustomer
);
router.post(
  "/customers/:id/gift-free-service",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.giftFreeServiceToCustomer
);
router.post(
  "/customers/:id/add-points",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.addPointsToCustomer
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
