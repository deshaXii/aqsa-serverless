module.exports = (permission) => {
  return (req, res, next) => {
    const user = req.user;

    if (
      user?.role === "admin" ||
      user?.permissions?.isAdmin ||
      user?.permissions?.[permission]
    ) {
      return next();
    }

    return res.status(403).json({ message: "ليس لديك صلاحية" });
  };
};
