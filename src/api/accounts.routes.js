const express = require("express");
const router = express.Router();
const Account = require("../models/Account.model.js");
const auth = require("../middleware/auth.js");
const RepairModel = require("../models/Repair.model.js");

// ✅ إضافة معاملة جديدة
router.post("/", auth, async (req, res) => {
  try {
    const { type, amount, note } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ message: "النوع والمبلغ مطلوبان" });
    }

    const transaction = await Account.create({
      type,
      amount,
      note,
      createdBy: req.user?.id,
    });

    res.status(201).json(transaction);
  } catch (err) {
    console.error("Error creating account transaction:", err);
    res.status(500).json({ message: "فشل في إضافة المعاملة" });
  }
});

// ✅ إحصائيات الحسابات
router.get("/summary", auth, async (req, res) => {
  try {
    // 1️⃣ جلب كل المعاملات
    const transactions = await Account.find().lean();

    // 2️⃣ جلب كل الصيانات المسلمة
    const deliveredRepairs = await RepairModel.find({ status: "تم التسليم" })
      .populate("technician", "name")
      .populate("parts")
      .lean();

    // إجمالي الربح وقطع الغيار
    let totalProfit = 0;
    let totalPartsCost = 0;

    // أرباح الفنيين
    const technicianProfits = {};

    const repairDetails = deliveredRepairs.map((r) => {
      const partsCost = (r.parts || []).reduce(
        (sum, p) => sum + (p.cost || 0),
        0
      );
      const repairProfit = (r.price || 0) - partsCost;

      totalProfit += repairProfit;
      totalPartsCost += partsCost;

      if (r.technician) {
        if (!technicianProfits[r.technician._id]) {
          technicianProfits[r.technician._id] = {
            name: r.technician.name,
            count: 0,
            profit: 0,
          };
        }
        technicianProfits[r.technician._id].count += 1;
        technicianProfits[r.technician._id].profit += repairProfit / 2;
      }

      return {
        customerName: r.customerName,
        deviceType: r.deviceType,
        price: r.price,
        partsCost,
        repairProfit,
        technician: r.technician?.name || "-",
      };
    });

    // معاملات الداخل والخارج
    const totalIn = transactions
      .filter((t) => t.type === "داخل")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = transactions
      .filter((t) => t.type === "خارج")
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = totalProfit / 2 + totalIn - totalOut; // نصيب المحل من الصيانات + الداخل - الخارج

    res.json({
      totalProfit, // إجمالي الربح قبل توزيع الفني/المحل
      totalPartsCost,
      totalIn,
      totalOut,
      netProfit,
      technicians: Object.values(technicianProfits),
      repairs: repairDetails,
      transactions,
    });
  } catch (err) {
    console.error("Error fetching accounts summary:", err);
    res.status(500).json({ message: "فشل في جلب ملخص الحسابات" });
  }
});

// ✅ (اختياري) حذف معاملة
router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await Account.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "المعاملة غير موجودة" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    res.status(500).json({ message: "فشل في حذف المعاملة" });
  }
});

module.exports = router;
