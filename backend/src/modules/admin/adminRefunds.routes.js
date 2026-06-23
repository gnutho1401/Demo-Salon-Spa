const router = require("express").Router();
const controller = require("./adminRefunds.controller");

router.get("/", controller.getAllRefunds);
router.post("/:id/process", controller.processRefund);
router.post("/:id/reject", controller.rejectRefund);

module.exports = router;
