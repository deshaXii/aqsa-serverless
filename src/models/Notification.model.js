// backend/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    type: { type: String }, // optional: e.g., "repair", "status"
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
