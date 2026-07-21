const router = require("express").Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");
const controller = require("./reschedule.controller");

// Technician routes
router.post(
  "/technician/appointments/:id/reschedule-request",
  authMiddleware,
  allowRoles("TECHNICIAN"),
  controller.createRequest
);

router.get(
  "/technician/reschedule-requests",
  authMiddleware,
  allowRoles("TECHNICIAN"),
  controller.getTechnicianRequests
);

router.put(
  "/technician/reschedule-requests/:id/cancel",
  authMiddleware,
  allowRoles("TECHNICIAN"),
  controller.technicianCancelRequest
);

// Receptionist routes
router.get(
  "/receptionist/reschedule-requests",
  authMiddleware,
  allowRoles("RECEPTIONIST", "ADMIN", "MANAGER"),
  controller.getReceptionistRequests
);

router.put(
  "/receptionist/reschedule-requests/:id/approve",
  authMiddleware,
  allowRoles("RECEPTIONIST", "ADMIN", "MANAGER"),
  controller.approveRequest
);

router.put(
  "/receptionist/reschedule-requests/:id/reject",
  authMiddleware,
  allowRoles("RECEPTIONIST", "ADMIN", "MANAGER"),
  controller.rejectRequest
);

// Customer routes
router.get(
  "/customer/appointments/:appointmentId/pending-reschedule",
  authMiddleware,
  allowRoles("CUSTOMER"),
  controller.getCustomerPendingRequest
);

router.put(
  "/customer/reschedule-requests/:id/confirm",
  authMiddleware,
  allowRoles("CUSTOMER"),
  controller.customerConfirm
);

router.put(
  "/customer/reschedule-requests/:id/reject",
  authMiddleware,
  allowRoles("CUSTOMER"),
  controller.customerReject
);

module.exports = router;
