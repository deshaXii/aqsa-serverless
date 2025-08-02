const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    repair: { type: mongoose.Schema.Types.ObjectId, ref: "Repair" },
    action: String, // تعديل، تغيير فني، حذف...
    oldTechnician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    newTechnician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Log || mongoose.model("Log", logSchema);
