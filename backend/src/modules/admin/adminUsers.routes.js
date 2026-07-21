const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./adminUsers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const avatarDir = path.join(__dirname, "../../../uploads/avatars");
fs.mkdirSync(avatarDir, { recursive: true });

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `avatar-${req.params.id || "user"}-${Date.now()}${ext}`);
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

router.get("/roles", controller.getRoles);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.post("/:id/avatar", uploadAvatar.single("image"), controller.uploadAvatar);
router.patch("/:id/role", controller.updateRole);
router.patch("/:id/status", controller.changeStatus);
router.patch("/:id/password", controller.resetPassword);
router.delete("/:id", controller.remove);

module.exports = router;

