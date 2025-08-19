const mongoose = require("mongoose");

const repairSchema = new mongoose.Schema(
  {
    repairId: { type: Number, unique: true },
    customerName: { type: String, required: true },
    deviceType: { type: String, required: true },
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
    partsUsed: [
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
    finalPrice: Number,
    endTime: Date,
    deliveryDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Repair", repairSchema);
