const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: String,
    username: { type: String, unique: true },
    password: String,
    role: {
      type: String,
      enum: ["admin", "technician"],
      default: "technician",
    },
    permissions: {
      addRepair: { type: Boolean, default: false },
      editRepair: { type: Boolean, default: false },
      deleteRepair: { type: Boolean, default: false },
      receiveDevice: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model("User", userSchema);
