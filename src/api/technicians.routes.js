const express = require("express");
const User = require("../models/User.model.js");
const auth = require("../middleware/auth.js");
const checkAdmin = require("../middleware/checkAdmin.js");

const router = express.Router();

// ✅ Get all technicians
router.get("/", auth, async (req, res) => {
  try {
    // إذا معاه صلاحية استلام، يقدر يشوف الفنيين
    if (
      req.user.role === "admin" ||
      req.user.permissions?.adminOverride ||
      req.user.permissions?.receiveDevice
    ) {
      const users = await User.find().select("-password");
      res.json(users);
    } else {
      res.status(403).json({ message: "ليس لديك صلاحية لعرض قائمة الفنيين" });
    }
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "فشل في تحميل الفنيين" });
  }
});

router.get("/receivers", auth, async (req, res) => {
  try {
    const receivers = await User.find(
      { "permissions.receiveDevice": true },
      "name phone"
    );
    res.json(receivers);
  } catch (err) {
    res.status(500).json({ message: "فشل في جلب المستلمين" });
  }
});

// إضافة فني
router.post("/", auth, checkAdmin, async (req, res) => {
  try {
    const { name, username, password, permissions } = req.body;
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "اسم المستخدم موجود بالفعل" });
    }

    const tech = await User.create({
      name,
      username,
      password,
      role: "technician",
      permissions: permissions || {
        addRepair: false,
        editRepair: false,
        deleteRepair: false,
        receiveDevice: false,
      },
    });

    res.status(201).json(tech);
  } catch (err) {
    res.status(500).json({ message: "فشل في إضافة الفني" });
  }
});

// تعديل فني
router.put("/:id", auth, checkAdmin, async (req, res) => {
  try {
    const updatedTech = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedTech)
      return res.status(404).json({ message: "الفني غير موجود" });
    res.json(updatedTech);
  } catch (err) {
    res.status(500).json({ message: "فشل في تعديل الفني" });
  }
});

// حذف فني
router.delete("/:id", auth, checkAdmin, async (req, res) => {
  try {
    const deletedTech = await User.findByIdAndDelete(req.params.id);
    if (!deletedTech)
      return res.status(404).json({ message: "الفني غير موجود" });
    res.json({ message: "تم حذف الفني بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "فشل في حذف الفني" });
  }
});

module.exports = router;
