const express = require("express");
const router = express.Router();
const Repair = require("../models/Repair.model.js");
const Technician = require("../models/User.model.js");
const auth = require("../middleware/auth.js");
const checkPermission = require("../middleware/checkPermission.js");
const Notification = require("../models/Notification.model.js");

// ✅ جلب جميع الصيانات مع فلترة للفنيين
router.get("/", auth, async (req, res) => {
  try {
    let filters = {};

    if (req.user.role !== "admin" && !req.user.permissions?.receiveDevice) {
      filters.$or = [{ technician: req.user.id }, { recipient: req.user.id }];
    }

    const repairs = await Repair.find(filters)
      .populate("technician", "name phone")
      .populate("recipient", "name phone");

    res.json(repairs);
  } catch (err) {
    console.error("Error fetching repairs:", err);
    res.status(500).json({ message: "فشل في جلب الصيانات" });
  }
});

// ✅ جلب صيانة واحدة
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
      status: "في الانتظار",
    });

    await newRepair.save();

    const recipientUser = await Technician.findById(req.body.recipient);
    const technicianUser = await Technician.findById(req.body.technician);

    if (technicianUser) {
      await Notification.create({
        user: technicianUser._id,
        message: `تم إسناد صيانة جديدة لك من قبل ${
          recipientUser?.name || "أحد المستخدمين"
        }`,
        type: "repair",
      });
    }

    if (req.user.role !== "admin") {
      const admins = await Technician.find({ role: "admin" });
      for (let admin of admins) {
        await Notification.create({
          user: admin._id,
          message: `قام ${recipientUser?.name || "مستخدم"} بإضافة صيانة للفني ${
            technicianUser?.name
          }`,
          type: "repair",
        });
      }
    }

    res.json(newRepair);
  } catch (err) {
    res.status(400).json({
      message: "فشل في إنشاء الصيانة",
      error: err.message,
    });
  }
});

// ✅ تحديث صيانة
router.put("/:id", auth, checkPermission("editRepair"), async (req, res) => {
  try {
    const repair = await Repair.findById(req.params.id);
    if (!repair) return res.status(404).json({ message: "الصيانة غير موجودة" });

    if (
      req.user.role !== "admin" &&
      repair.technician.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "ليس لديك صلاحية لتعديل هذه الصيانة" });
    }

    if (req.body.status === "تم التسليم") {
      const { price, parts } = req.body;
      if (!price) {
        return res
          .status(400)
          .json({ message: "يجب إدخال سعر الصيانة عند التسليم" });
      }

      const partsTotal = (parts || []).reduce(
        (sum, p) => sum + Number(p.cost || 0),
        0
      );

      repair.price = price;
      repair.parts = parts || [];
      repair.profit = price - partsTotal;
      repair.totalPartsCost = partsTotal;
    }

    // فقط حدّث الحقول الفعليّة (بدون undefined)
    Object.entries(req.body).forEach(([key, val]) => {
      if (val !== undefined) repair[key] = val;
    });

    await repair.save();

    // ✅ إشعارات عند التسليم
    if (repair.status === "تم التسليم") {
      const adminUsers = await Technician.find({ role: "admin" });
      for (let admin of adminUsers) {
        await Notification.create({
          user: admin._id,
          message: `تم تغيير حالة الصيانة بواسطة ${req.user.name} للجهاز (${repair.deviceType})`,
          type: "status",
        });
      }

      if (repair.recipient) {
        await Notification.create({
          user: repair.recipient,
          message: `تم تسليم جهاز (${repair.deviceType}) بواسطة الفني ${req.user.name}`,
          type: "status",
        });
      }
    }

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
