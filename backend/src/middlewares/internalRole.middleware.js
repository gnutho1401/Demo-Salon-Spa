const { isInternalRole } = require("../modules/internal-analytics/internalAnalytics.catalog");

function requireInternalRole(req, res, next) {
  if (!req.user || !isInternalRole(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Báo cáo nội bộ không khả dụng cho Guest hoặc Customer",
    });
  }
  return next();
}

module.exports = requireInternalRole;
