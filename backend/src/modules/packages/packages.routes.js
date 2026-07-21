const router = require("express").Router();
const controller = require("./packages.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

/* ===========================================================
   CUSTOMER ROUTES
   =========================================================== */
router.get("/my", authMiddleware, controller.getMine);
router.get(
  "/my/:customerPackageId/usages",
  authMiddleware,
  controller.getUsageHistory,
);
router.get(
  "/my/:customerPackageId/detail",
  authMiddleware,
  controller.getMyPackageDetail,
);
router.get(
  "/my/:customerPackageId/usages-paginated",
  authMiddleware,
  controller.getUsageHistoryPaginated,
);
router.post(
  "/my/:customerPackageId/book",
  authMiddleware,
  controller.bookCustomerPackage,
);
router.post(
  "/my/:customerPackageId/reschedule",
  authMiddleware,
  controller.rescheduleCustomerPackageAppointment,
);

router.get("/my/combo-history", authMiddleware, controller.getComboHistoryAndReviews);
router.post("/my/combo-review", authMiddleware, controller.submitComboReview);




// Enterprise: Gia hạn / Đóng băng / Hủy đóng băng (Đã bãi bỏ)
/*
router.post(
  "/my/:customerPackageId/extend",
  authMiddleware,
  controller.requestExtension,
);
router.post(
  "/my/:customerPackageId/freeze",
  authMiddleware,
  controller.requestFreeze,
);
router.post(
  "/my/:customerPackageId/unfreeze",
  authMiddleware,
  controller.unfreezePackage,
);
*/

// Enterprise: Combo gia đình
router.post(
  "/my/:customerPackageId/members",
  authMiddleware,
  controller.addFamilyMember,
);
router.post(
  "/my/:customerPackageId/repay",
  authMiddleware,
  controller.repayCustomerPackage,
);
router.post(
  "/my/:customerPackageId/repay-payos",
  authMiddleware,
  controller.repayPayosCustomerPackage,
);
router.delete(
  "/my/:customerPackageId/members/:memberId",
  authMiddleware,
  controller.removeFamilyMember,
);

/* ===========================================================
   STAFF ROUTES (Receptionist duyệt yêu cầu - Đã bãi bỏ)
   =========================================================== */
/*
router.get(
  "/approvals",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getApprovals,
);
router.post(
  "/approvals/:requestId/process",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.approveRequest,
);
*/

/* ===========================================================
   ADMIN ROUTES (Báo cáo)
   =========================================================== */
router.get(
  "/report",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.getPackageReport,
);

/* ===========================================================
   PUBLIC & ADMIN CRUD ROUTES
   =========================================================== */
router.get("/find-member", authMiddleware, controller.findMember);
router.get("/categories/list", controller.getCategories);
router.get("/vnpay-return", controller.vnpayReturn);
router.get("/payos-return", controller.payosReturn);
router.post("/:id/buy", authMiddleware, controller.buyPackage);
router.post("/:id/vnpay", authMiddleware, controller.createVnpayPackage);
router.post("/:id/payos", authMiddleware, controller.createPayosPackage);
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
