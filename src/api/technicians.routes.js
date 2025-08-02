const express = require("express");
const User = require("./src/models/User.model.js");
const auth = require("./src/middleware/auth.js");
const checkAdmin = require("./src/middleware/checkAdmin.js");

const router = express.Router();

// جلب جميع الفنيين
router.get("/", auth, checkAdmin, async (req, res) => {
  try {
    const techs = await User.find();
    res.json(techs);
  } catch (err) {
    res.status(500).json({ message: "فشل في جلب الفنيين" });
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
