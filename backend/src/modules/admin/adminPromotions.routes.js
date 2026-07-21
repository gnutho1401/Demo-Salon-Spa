const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./adminPromotions.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const promoImageDir = path.join(__dirname, "../../../uploads/promotions");
fs.mkdirSync(promoImageDir, { recursive: true });

const uploadPromoImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, promoImageDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `promo-${req.params.id || "new"}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ được upload file ảnh"));
    }
    cb(null, true);
  },
});

router.use(authMiddleware);
router.use(allowRoles("ADMIN", "MANAGER"));

router.get("/services", controller.getServices);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.get("/:id/services", controller.getAssignedServices);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/services", controller.updateAssignedServices);
router.post("/:id/image", uploadPromoImage.single("image"), controller.uploadImage);
router.delete("/:id", controller.remove);

module.exports = router;

