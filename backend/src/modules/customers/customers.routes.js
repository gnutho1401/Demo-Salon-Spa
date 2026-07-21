const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./customers.controller");
const service = require("./customers.service");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const avatarDir = path.join(__dirname, "../../../uploads/avatars");
const reviewDir = path.join(__dirname, "../../../uploads/reviews");
fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedExts.has(ext) || !allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Chỉ được upload ảnh JPG, PNG hoặc WEBP"));
  }

  cb(null, true);
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `avatar-${req.user.userId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ được upload file ảnh"));
    }
    cb(null, true);
  },
});

const reviewUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, reviewDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `review-${req.user.userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: imageFileFilter,
});

router.post("/contact", controller.createGuestContact);
router.get("/public-reviews", controller.getPublicReviews);

router.get("/me/dashboard", authMiddleware, controller.getMyDashboard);
router.get("/me/profile", authMiddleware, controller.getMyProfile);
router.get("/me/feedbacks", authMiddleware, controller.getMyFeedbacks);
router.post("/me/feedbacks", authMiddleware, controller.createMyFeedback);
router.get("/me/service-history", authMiddleware, async (req, res) => {
  try {
    const data = await service.getMyServiceHistory(req.user.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});
router.get("/me/reviews", authMiddleware, controller.getMyReviews);
router.get("/me/reviewable-services", authMiddleware, controller.getMyReviewableServices);
router.get("/me/favorites", authMiddleware, async (req, res) => {
  try {
    const data = await service.getMyFavorites(req.user.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});
router.get("/me/favorites/services", authMiddleware, controller.getMyFavoriteServices);
router.get("/me/favorites/employees", authMiddleware, controller.getMyFavoriteEmployees);
router.post("/me/favorites/services/toggle", authMiddleware, controller.toggleFavoriteService);
router.post("/me/favorites/employees/toggle", authMiddleware, controller.toggleFavoriteEmployee);
router.post("/me/reviews", authMiddleware, reviewUpload.array("images", 6), controller.createMyReview);
router.put("/me/profile", authMiddleware, controller.updateMyProfile);
router.put(
  "/me/avatar",
  authMiddleware,
  avatarUpload.single("avatar"),
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
