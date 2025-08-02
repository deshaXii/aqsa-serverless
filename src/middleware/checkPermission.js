const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user?.role === "admin" || req.user?.permissions?.[permission]) {
      return next();
    }
    return res.status(403).json({ message: "Permission denied" });
  };
};

export default checkPermission;
