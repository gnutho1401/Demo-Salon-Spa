const router = require("express").Router();
const controller = require("./adminCategories.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/toggle-active", controller.toggleActive);
router.delete("/:id", controller.remove);

module.exports = router;
