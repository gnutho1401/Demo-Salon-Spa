const router = require("express").Router();
const controller = require("./vouchers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.get("/", controller.getAllActive);
router.get("/my", authMiddleware, controller.getMine);
router.post("/:id/save", authMiddleware, controller.saveVoucher);
router.post("/validate", authMiddleware, controller.validateVoucher);
module.exports = router;
