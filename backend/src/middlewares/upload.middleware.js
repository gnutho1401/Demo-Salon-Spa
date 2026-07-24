const multer = require("multer");
const path = require("path");
const fs = require("fs");

const reviewDir = path.join(__dirname, "../../uploads/reviews");
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

const reviewUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, reviewDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const userId = req.user?.userId || "guest";
      cb(
        null,
        `review-${userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`,
      );
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: imageFileFilter,
});

module.exports = reviewUpload;
