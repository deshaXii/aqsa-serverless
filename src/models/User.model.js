const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const permissionsSchema = new mongoose.Schema({
  addRepair: { type: Boolean, default: false },
  editRepair: { type: Boolean, default: false },
  deleteRepair: { type: Boolean, default: false },
  receiveDevice: { type: Boolean, default: false },
  accessAccounts: { type: Boolean, default: false },
  adminOverride: { type: Boolean, default: false }, // صلاحية تعطي كل صلاحيات الأدمن
});

const userSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
    name: String,
    role: { type: String, default: "technician" }, // admin or technician
    permissions: permissionsSchema,
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model("User", userSchema);
