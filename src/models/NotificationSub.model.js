const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    endpoint: { type: String, unique: true, required: true },
    expirationTime: { type: Date },
    keys: {
      p256dh: String,
      auth: String,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.NotificationSub || mongoose.model("NotificationSub", schema);
