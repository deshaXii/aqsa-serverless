const express = require("express");
const {
  getNotifications,
  markAsRead,
  clearNotifications,
} = require("../controllers/notificationController.js");
const auth = require("../middleware/auth.js");

const router = express.Router();

router.get("/", auth, getNotifications);
router.put("/:id/read", auth, markAsRead);
router.delete("/clear", auth, clearNotifications);

module.exports = router;
