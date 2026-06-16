const router = require("express").Router();
const controller = require("./adminVouchers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/disable", controller.disable);
router.delete("/:id", controller.remove);

module.exports = router;
