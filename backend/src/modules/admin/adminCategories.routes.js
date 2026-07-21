const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./adminCategories.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const catImageDir = path.join(__dirname, "../../../uploads/categories");
fs.mkdirSync(catImageDir, { recursive: true });

const uploadCatImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, catImageDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `cat-${req.params.id || "new"}-${Date.now()}${ext}`);
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

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.post("/:id/image", uploadCatImage.single("image"), controller.uploadImage);
router.patch("/:id/toggle-active", controller.toggleActive);
router.delete("/:id", controller.remove);

module.exports = router;

