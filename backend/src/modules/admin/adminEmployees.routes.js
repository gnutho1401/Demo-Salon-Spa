const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./adminEmployees.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

const empImageDir = path.join(__dirname, "../../../uploads/employees");
fs.mkdirSync(empImageDir, { recursive: true });

const uploadEmpImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, empImageDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `emp-${req.params.id || "new"}-${Date.now()}${ext}`);
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
router.get("/branches", controller.getBranches);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.post("/:id/image", uploadEmpImage.single("image"), controller.uploadImage);
router.patch("/:id/status", controller.changeStatus);
router.get("/:id/services", controller.getAssignedServices);
router.put("/:id/services", controller.updateAssignedServices);
router.delete("/:id", controller.remove);

module.exports = router;

