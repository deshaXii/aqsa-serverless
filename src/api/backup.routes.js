const express = require("express");
const auth = require("./src/middleware/auth.js");
const checkAdmin = require("./src/middleware/checkAdmin.js");
const Repair = require("./src/models/Repair.model.js");
const User = require("./src/models/User.model.js");
const Log = require("./src/models/Log.model.js");

const router = express.Router();

// مسح كل البيانات ما عدا الأدمن
router.delete("/clear", auth, checkAdmin, async (req, res) => {
  try {
    const admin = await User.findOne({ role: "admin" });

    await Repair.deleteMany({});
    await Log.deleteMany({});
    await User.deleteMany({ _id: { $ne: admin?._id } });

    res.json({ message: "تم مسح كل البيانات ماعدا الأدمن" });
  } catch (err) {
    res.status(500).json({ message: "فشل في مسح البيانات" });
  }
});

// Endpoint لجلب إحصائيات حجم قاعدة البيانات وعدد الفنيين والصيانات
router.get("/stats", auth, checkAdmin, async (req, res) => {
  try {
    const repairCount = await Repair.countDocuments();
    const technicianCount = await User.countDocuments();
    const dbSizeMB = (repairCount * 0.002 + technicianCount * 0.001).toFixed(2); // تقدير تقريبي

    const usagePercent = ((dbSizeMB / 512) * 100).toFixed(1);

    res.json({
      repairs: repairCount,
      technicians: technicianCount,
      dbSizeMB,
      usagePercent,
      warning: usagePercent >= 90,
    });
  } catch (err) {
    res.status(500).json({ message: "فشل في جلب إحصائيات النسخ الاحتياطي" });
  }
});

module.exports = router;
