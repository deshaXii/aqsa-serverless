require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// -------------------- Database --------------------
if (!process.env.MONGO_URI) throw new Error("Please define MONGO_URI in .env");
await mongoose.connect(process.env.MONGO_URI, {});

// -------------------- Models --------------------
const userSchema = new mongoose.Schema(
  {
    name: String,
    username: String,
    password: String,
    role: { type: String, default: "technician" },
    permissions: {
      addRepair: Boolean,
      editRepair: Boolean,
      deleteRepair: Boolean,
      receiveDevice: Boolean,
    },
  },
  { timestamps: true }
);

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
    parts: [{ name: String, source: String, cost: Number }],
    totalPartsCost: Number,
    profit: Number,
    status: {
      type: String,
      enum: ["مرفوض", "تم التسليم", "مكتمل", "جاري العمل", "في الانتظار"],
      default: "في الانتظار",
    },
    notes: String,
  },
  { timestamps: true }
);

const logSchema = new mongoose.Schema(
  {
    repair: { type: mongoose.Schema.Types.ObjectId, ref: "Repair" },
    oldTechnician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    newTechnician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Repair = mongoose.model("Repair", repairSchema);
const Log = mongoose.model("Log", logSchema);

// -------------------- Middleware --------------------
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const checkAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ message: "Admins only" });
};

const checkPermission = (permission) => (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.permissions?.[permission])
    return next();
  return res.status(403).json({ message: "Permission denied" });
};

// Utility
const calculateProfit = (repairPrice, parts) => {
  const totalPartsCost = (parts || []).reduce(
    (sum, p) => sum + (p.cost || 0),
    0
  );
  const profit = (repairPrice || 0) - totalPartsCost;
  return { totalPartsCost, profit };
};

// -------------------- API Routes --------------------

// AUTH
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user._id, role: user.role, permissions: user.permissions },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
    },
  });
});

// TECHNICIANS
app.get("/api/technicians", auth, checkAdmin, async (req, res) => {
  const techs = await User.find();
  res.json(techs);
});

app.post("/api/technicians", auth, checkAdmin, async (req, res) => {
  const { name, username, password, permissions } = req.body;
  const existing = await User.findOne({ username });
  if (existing)
    return res.status(400).json({ message: "اسم المستخدم موجود بالفعل" });

  const hashed = await bcrypt.hash(password, 10);
  const tech = await User.create({
    name,
    username,
    password: hashed,
    role: "technician",
    permissions: permissions || {
      addRepair: false,
      editRepair: false,
      deleteRepair: false,
      receiveDevice: false,
    },
  });
  res.status(201).json(tech);
});

// REPAIRS
app.get("/api/repairs", auth, async (req, res) => {
  const repairs = await Repair.find()
    .populate("technician", "name")
    .populate("recipient", "name");
  res.json(repairs);
});

app.post(
  "/api/repairs",
  auth,
  checkPermission("addRepair"),
  async (req, res) => {
    const {
      customerName,
      deviceType,
      issue,
      color,
      phone,
      price,
      parts,
      technician,
      recipient,
      notes,
    } = req.body;
    const partsArray = Array.isArray(parts) ? parts : [];
    const { totalPartsCost, profit } = calculateProfit(price, partsArray);

    const repair = await Repair.create({
      customerName,
      deviceType,
      issue,
      color,
      phone,
      price,
      parts: partsArray,
      technician,
      recipient,
      totalPartsCost,
      profit,
      notes,
    });

    res.status(201).json(repair);
  }
);

app.put(
  "/api/repairs/:id",
  auth,
  checkPermission("editRepair"),
  async (req, res) => {
    const repair = await Repair.findById(req.params.id);
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });

    Object.assign(repair, req.body);
    const { totalPartsCost, profit } = calculateProfit(
      repair.price,
      repair.parts || []
    );
    repair.totalPartsCost = totalPartsCost;
    repair.profit = profit;

    await repair.save();
    res.json(repair);
  }
);

app.delete(
  "/api/repairs/:id",
  auth,
  checkPermission("deleteRepair"),
  async (req, res) => {
    const repair = await Repair.findByIdAndDelete(req.params.id);
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });

    res.json({ message: "تم حذف الصيانة بنجاح" });
  }
);

// BACKUP CLEAR
app.delete("/api/backup/clear", auth, checkAdmin, async (req, res) => {
  await Repair.deleteMany({});
  await Log.deleteMany({});
  await User.deleteMany({ role: { $ne: "admin" } });
  res.json({ message: "تم مسح كل البيانات ماعدا الأدمن" });
});

// Default
app.get("/", (req, res) => res.send("Serverless Backend is Running ✅"));

// -------------------- Start --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
