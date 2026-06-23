const router = require("express").Router();
const controller = require("./waiting-list.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.get("/options", authMiddleware, controller.getOptions);
router.get("/my", authMiddleware, controller.getMine);
router.get("/:id", authMiddleware, controller.getById);
router.post("/", authMiddleware, controller.create);
router.put("/:id", authMiddleware, controller.update);
router.patch("/:id", authMiddleware, controller.update);
router.delete("/:id", authMiddleware, controller.cancel);
router.post("/:id/confirm", authMiddleware, controller.confirmMatch);
router.post("/:id/reject", authMiddleware, controller.rejectMatch);

module.exports = router;
