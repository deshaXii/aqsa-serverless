// src/models/PushSubscription.model.js
const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    endpoint: { type: String, unique: true },
    keys: {
      p256dh: String,
      auth: String,
    },
    ua: String,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", PushSubscriptionSchema);
