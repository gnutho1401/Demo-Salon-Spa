const router = require("express").Router();
const controller = require("./payments.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.get("/my", authMiddleware, controller.getMine);

// VNPay routes
router.get("/vnpay-return", controller.vnpayReturn);
router.get("/vnpay-ipn", controller.vnpayIpn);

router.post(
  "/appointment/:appointmentId/vnpay",
  authMiddleware,
  controller.createVnpayPayment,
);

// PayOS routes
router.get("/payos-return", controller.payosReturn);
router.post("/payos-webhook", controller.payosWebhook);

router.post(
  "/appointment/:appointmentId/payos",
  authMiddleware,
  controller.createPayosPayment,
);

router.post(
  "/appointment/:appointmentId/apply-voucher",
  authMiddleware,
  controller.applyVoucher,
);

router.post(
  "/:id/cancel-payos",
  authMiddleware,
  controller.cancelPayos,
);

router.post(
  "/:id/refund",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.refundPayos,
);

router.post(
  "/appointment/:appointmentId/pay",
  authMiddleware,
  controller.payAppointment,
);

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

