// backend/routes/notifications.js
const express = require("express");
const auth = require("../middleware/auth.js");
const Notification = require("../models/Notification.model.js");

const router = express.Router();

// ✅ Get all notifications for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "فشل في تحميل الإشعارات" });
  }
});

// ✅ Mark one as read
router.put("/:id/read", auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "فشل في تحديث الإشعار" });
  }
});

// ✅ Clear all
router.delete("/clear", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "فشل في حذف الإشعارات" });
  }
});

module.exports = router;
