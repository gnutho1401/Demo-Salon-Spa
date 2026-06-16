const router = require("express").Router();
const controller = require("./adminReviews.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/respond", controller.respond);
router.patch("/:id/remove-response", controller.removeResponse);

module.exports = router;
