const router = require("express").Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const requireInternalRole = require("../../middlewares/internalRole.middleware");
const controller = require("./internalAnalytics.controller");

router.use(authMiddleware);
router.use(requireInternalRole);

router.get("/catalog", controller.getCatalog);
router.get("/dashboard", controller.getDashboard);
router.get("/charts/:chartKey/export", controller.exportChart);
router.get("/charts/:chartKey", controller.getChart);

module.exports = router;
