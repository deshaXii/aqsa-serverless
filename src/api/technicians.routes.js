// src/api/technicians.routes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User.model");
const Repair = require("../models/Repair.model");
const Settings = require("../models/Settings.model");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");
const calcProfit = require("../utils/calculateProfit");
const bcrypt = require("bcryptjs");

router.use(auth);

// قائمة الفنيين
router.get("/", async (req, res) => {
  const techs = await User.find({ role: "technician" })
    .select("name username commissionPct permissions")
    .lean();
  res.json(techs);
});

// بروفايل الفني (كما أرسلته لك سابقًا)
router.get("/:id/profile", async (req, res) => {
  const techId = req.params.id;
  const tech = await User.findById(techId).select("name commissionPct").lean();
  if (!tech) return res.status(404).json({ message: "Technician not found" });

  const settings = await Settings.findOne().lean();
  const commissionPct =
    tech.commissionPct ?? settings?.defaultTechCommissionPct ?? 50;

  const repairs = await Repair.find({ technician: techId }).lean();
  const counts = {
    total: repairs.length,
    open: repairs.filter((r) => !["تم التسليم", "مرفوض"].includes(r.status))
      .length,
    completed: repairs.filter((r) => r.status === "مكتمل").length,
    delivered: repairs.filter((r) => r.status === "تم التسليم").length,
    returned: repairs.filter((r) => r.status === "مرتجع").length,
    rejected: repairs.filter((r) => r.status === "مرفوض").length,
  };

  let sumProfit = 0,
    sumTech = 0,
    sumShop = 0;
  for (const r of repairs) {
    const { profit, techShare, shopShare } = calcProfit({
      finalPrice: r.finalPrice ?? r.price ?? 0,
      parts: r.parts || [],
      commissionPct,
    });
    sumProfit += profit;
    sumTech += techShare;
    sumShop += shopShare;
  }

  const currentAssignments = repairs
    .filter(
      (r) =>
        ["في الانتظار", "جاري العمل", "مكتمل", "مرتجع"].includes(r.status) &&
        r.status !== "تم التسليم"
    )
    .map((r) => ({
      id: r._id,
      repairId: r.repairId,
      status: r.status,
      customerName: r.customerName,
      createdAt: r.createdAt,
      startTime: r.startTime,
    }));

  res.json({
    tech,
    counts,
    totals: { profit: sumProfit, techShare: sumTech, shopShare: sumShop },
    currentAssignments,
  });
});

// إنشاء فني — أدمن فقط
router.post("/", checkPermission("adminOverride"), async (req, res) => {
  const { username, name, password, commissionPct } = req.body || {};
  if (!username || !name || !password)
    return res.status(400).json({ message: "بيانات ناقصة" });
  const exist = await User.findOne({ username });
  if (exist) return res.status(400).json({ message: "اسم المستخدم مستخدم" });
  const u = new User({
    username,
    name,
    password,
    role: "technician",
    commissionPct,
  });
  await u.save();
  res.json({ ok: true, id: u._id });
});

// تحديث بيانات وصلاحيات الفني — أدمن فقط
router.put("/:id", checkPermission("adminOverride"), async (req, res) => {
  const { name, username, commissionPct, permissions, password } =
    req.body || {};
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "Not found" });
  if (typeof name === "string") u.name = name;
  if (typeof username === "string") u.username = username;
  if (typeof commissionPct !== "undefined") u.commissionPct = commissionPct;
  if (permissions && typeof permissions === "object") {
    u.permissions = { ...(u.permissions || {}), ...permissions };
  }
  if (password) {
    const salt = await bcrypt.genSalt(10);
    u.password = await bcrypt.hash(password, salt);
  }
  await u.save();
  res.json({ ok: true });
});

router.delete("/:id", checkPermission("adminOverride"), async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
