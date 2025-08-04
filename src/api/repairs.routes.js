const express = require("express");
const router = express.Router();
const Repair = require("../models/Repair.model.js");
const auth = require("../middleware/auth.js");
const checkPermission = require("../middleware/checkPermission.js");

// ✅ جلب جميع الصيانات مع فلترة للفنيين
router.get("/", auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== "admin") {
      // الفني العادي يشوف الصيانات الخاصة به فقط
      query = { technician: req.user.id };
    }
    const repairs = await Repair.find(query)
      .populate("technician", "name")
      .populate("recipient", "name")
      .populate("parts")
      .sort({ createdAt: -1 });
    res.json(repairs);
  } catch (err) {
    res
      .status(500)
      .json({ message: "فشل في جلب بيانات الصيانة", error: err.message });
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

// ✅ إنشاء صيانة جديدة
router.post("/", auth, checkPermission("addRepair"), async (req, res) => {
  try {
    const newRepair = new Repair({
      ...req.body,
      status: "في الانتظار", // الحالة الافتراضية
      technician: req.user.id,
    });
    await newRepair.save();
    res.json(newRepair);
  } catch (err) {
    res
      .status(400)
      .json({ message: "فشل في إنشاء الصيانة", error: err.message });
  }
});

// ✅ تحديث حالة أو بيانات الصيانة
router.put("/:id", auth, checkPermission("editRepair"), async (req, res) => {
  try {
    const repair = await Repair.findById(req.params.id);
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });

    // الفني العادي لا يمكنه تعديل صيانة ليست له
    if (
      req.user.role !== "admin" &&
      repair.technician.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "ليس لديك صلاحية لتعديل هذه الصيانة" });
    }

    // ✅ عند تغيير الحالة إلى تم التسليم
    if (req.body.status === "تم التسليم") {
      const { price, parts } = req.body;
      if (!price)
        return res
          .status(400)
          .json({ message: "يجب إدخال سعر الصيانة عند التسليم" });

      // حساب الربح
      const partsTotal = (parts || []).reduce(
        (sum, p) => sum + (p.cost || 0),
        0
      );
      repair.price = price;
      repair.parts = parts || [];
      repair.profit = price - partsTotal;
    }

    // تحديث باقي الحقول
    Object.assign(repair, req.body);
    await repair.save();

    res.json(repair);
  } catch (err) {
    res
      .status(400)
      .json({ message: "فشل في تحديث الصيانة", error: err.message });
  }
});

// ✅ حذف صيانة
router.delete(
  "/:id",
  auth,
  checkPermission("deleteRepair"),
  async (req, res) => {
    try {
      const repair = await Repair.findById(req.params.id);
      if (!repair)
        return res.status(404).json({ message: "الصيانة غير موجودة" });

      // الفني العادي لا يمكنه حذف صيانة ليست له
      if (
        req.user.role !== "admin" &&
        repair.technician.toString() !== req.user.id
      ) {
        return res
          .status(403)
          .json({ message: "ليس لديك صلاحية لحذف هذه الصيانة" });
      }

      await repair.deleteOne();
      res.json({ message: "تم حذف الصيانة" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "فشل في حذف الصيانة", error: err.message });
    }
  }
);

module.exports = router;
