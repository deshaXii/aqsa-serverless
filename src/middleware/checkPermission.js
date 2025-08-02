// middleware/checkPermission.js
module.exports = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    if (req.user.role === "admin") {
      return next(); // الأدمن له كل الصلاحيات
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    next();
  };
};
