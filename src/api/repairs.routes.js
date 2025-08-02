const express = require("express");
const Repair = require("./src/models/Repair.model.js");
const User = require("./src/models/User.model.js");
const auth = require("./src/middleware/auth.js");
const checkPermission = require("./src/middleware/checkPermission.js");
const { calculateProfit } = require("./src/utils/calculateProfit.js");

const router = express.Router();

// جلب جميع الصيانات
router.get("/", auth, async (req, res) => {
  try {
    const repairs = await Repair.find()
      .populate("technician", "name")
      .populate("recipient", "name");
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ message: "فشل في تحميل بيانات الصيانة" });
  }
});

// جلب صيانة واحدة
router.get("/:id", auth, async (req, res) => {
  try {
    const repair = await Repair.findById(req.params.id)
      .populate("technician recipient")
      .exec();
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });
    res.json(repair);
  } catch (err) {
    res.status(500).json({ message: "فشل في تحميل تفاصيل الصيانة" });
  }
});

// إنشاء صيانة جديدة
router.post("/", auth, checkPermission("addRepair"), async (req, res) => {
  try {
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
    const { totalPartsCost, profit } = calculateProfit(price || 0, partsArray);

    const repair = new Repair({
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

    await repair.save();
    res.status(201).json(repair);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "فشل في إنشاء الصيانة" });
  }
});

// تعديل الصيانة
router.put("/:id", auth, checkPermission("editRepair"), async (req, res) => {
  try {
    const repair = await Repair.findById(req.params.id);
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });

    Object.assign(repair, req.body);

    const { totalPartsCost, profit } = calculateProfit(
      repair.price || 0,
      repair.parts || []
    );
    repair.totalPartsCost = totalPartsCost;
    repair.profit = profit;

    await repair.save();
    res.json(repair);
  } catch (err) {
    res.status(500).json({ message: "فشل في تعديل الصيانة" });
  }
});

// حذف صيانة
router.delete(
  "/:id",
  auth,
  checkPermission("deleteRepair"),
  async (req, res) => {
    try {
      const repair = await Repair.findByIdAndDelete(req.params.id);
      if (!repair)
        return res.status(404).json({ message: "الصيانة غير موجودة" });

      res.json({ message: "تم حذف الصيانة بنجاح" });
    } catch (err) {
      res.status(500).json({ message: "فشل في حذف الصيانة" });
    }
  }
);

module.exports = router;
