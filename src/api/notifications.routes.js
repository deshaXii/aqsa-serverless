const express = require("express");
const {
  getNotifications,
  markAsRead,
  clearNotifications,
} = require("./src/controllers/notificationController.js");
const auth = require("../src/middleware/auth.js");

const router = express.Router();

router.get("/", auth, getNotifications);
router.put("/:id/read", auth, markAsRead);
router.delete("/clear", auth, clearNotifications);

module.exports = router;
