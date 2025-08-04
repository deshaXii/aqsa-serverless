const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["داخل", "خارج"], required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
