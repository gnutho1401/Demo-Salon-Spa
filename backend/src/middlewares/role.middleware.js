function allowRoles(...roles) {
  return (req, res, next) => {
    const userRole = String(req.user?.role || "").toUpperCase();
    const allowedRoles = roles.map((r) => String(r).toUpperCase());

    if (!req.user || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập chức năng này",
      });
    }

    next();
  };
}

module.exports = allowRoles;
