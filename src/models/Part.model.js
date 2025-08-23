const mongoose = require("mongoose");

const partSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: String,
    source: String,
    cost: Number,
    usedIn: { type: mongoose.Schema.Types.ObjectId, ref: "Repair" },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, _id: true }
);

module.exports = mongoose.model("Part", partSchema);
