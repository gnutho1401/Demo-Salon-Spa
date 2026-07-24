const router = require("express").Router();
const controller = require("./treatment-notes-v2.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

// Initialize decoupled EventBus listener
require("./treatment-notes-v2.listener");

// 1. Search notes (MUST be placed before parameterized /:id routes)
router.get(
  "/search",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.searchNotes,
);

// 2. Global analytics stats (Admin and Manager only)
router.get(
  "/analytics",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.getAnalytics,
);

// 2.5. AI Smart Note Autocomplete
router.post(
  "/ai-generate",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician"),
  controller.generateAINote,
);

// 2.6. AI Customer Advisor Insights
router.get(
  "/customers/:id/ai-insights",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.getCustomerAIInsights,
);

// 3. Get customer treatment history (accessible to KTV, Receptionist, Managers, Admins)
router.get(
  "/customers/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.getCustomerHistory,
);

// 4. Get specific appointment's note
router.get(
  "/appointments/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.getNoteByAppointment,
);

// 4b. Get specific note by UUID (note id)
router.get(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.getNoteById,
);

// 5. Create a Treatment Note (internal creation or manually triggered)
router.post(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician", "Receptionist"),
  controller.createNote,
);

// 6. Update a Treatment Note (only draft is allowed to be edited)
router.patch(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician"),
  controller.updateNote,
);

// 7. Finalize and lock a Treatment Note
router.post(
  "/:id/finalize",
  authMiddleware,
  allowRoles("Admin", "Manager", "Technician"),
  controller.finalizeNote,
);

module.exports = router;
