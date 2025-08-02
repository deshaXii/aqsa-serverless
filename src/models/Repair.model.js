const mongoose = require("mongoose");

const repairSchema = new mongoose.Schema(
  {
    customerName: String,
    deviceType: String,
    issue: String,
    color: String,
    phone: String,
    price: Number,
    technician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    parts: [
      {
        name: String,
        source: String, // محل الشراء
        cost: Number,
      },
    ],
    totalPartsCost: Number,
    profit: Number,
    status: {
      type: String,
      enum: ["مرفوض", "تم التسليم", "مكتمل", "جاري العمل", "في الانتظار"],
      default: "في الانتظار",
    },
    logs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Log" }],
    notes: String,
    startTime: Date,
    endTime: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Repair", repairSchema);
