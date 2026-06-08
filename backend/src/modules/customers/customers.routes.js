const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./customers.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const avatarDir = path.join(__dirname, "../../../uploads/avatars");
fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Chỉ được upload file ảnh"));
    cb(null, true);
  },
});

router.post("/contact", controller.createGuestContact);

router.get("/me/dashboard", authMiddleware, controller.getMyDashboard);
router.get("/me/profile", authMiddleware, controller.getMyProfile);
router.get("/me/feedbacks", authMiddleware, controller.getMyFeedbacks);
router.post("/me/feedbacks", authMiddleware, controller.createMyFeedback);
router.get("/me/reviews", authMiddleware, controller.getMyReviews);
router.get("/me/reviewable-services", authMiddleware, controller.getMyReviewableServices);
router.post("/me/reviews", authMiddleware, controller.createMyReview);
router.put("/me/profile", authMiddleware, controller.updateMyProfile);
router.put(
  "/me/avatar",
  authMiddleware,
  upload.single("avatar"),
  controller.updateMyAvatar,
);

router.get(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getAll,
);
router.get(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager", "Receptionist"),
  controller.getById,
);
router.post(
  "/",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.create,
);
router.put(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.update,
);
router.delete(
  "/:id",
  authMiddleware,
  allowRoles("Admin", "Manager"),
  controller.remove,
);

module.exports = router;
