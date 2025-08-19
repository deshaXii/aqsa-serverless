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
    const { dateFilter } = req.query;
    let dateRange = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === "today") {
      dateRange = { $gte: today };
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      dateRange = { $gte: yesterday, $lt: today };
    } else if (dateFilter === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateRange = { $gte: weekAgo };
    } else if (dateFilter === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateRange = { $gte: monthAgo };
    } else {
      // الافتراضي: اليوم
      dateRange = { $gte: today };
    }

    // 1️⃣ جلب المعاملات حسب التاريخ
    const transactions = await Account.find({
      createdAt: dateRange,
    }).lean();

    // 2️⃣ جلب الصيانات حسب تاريخ التسليم (updatedAt وليس createdAt)
    const deliveredRepairs = await RepairModel.find({
      status: "تم التسليم",
      updatedAt: dateRange, // التعديل هنا لاستخدام updatedAt بدلاً من createdAt
    })
      .populate("technician", "name")
      .populate("parts")
      .lean();

    // العمليات الحسابية
    let totalProfit = 0;
    let totalPartsCost = 0;
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

    const totalIn = transactions
      .filter((t) => t.type === "داخل")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = transactions
      .filter((t) => t.type === "خارج")
      .reduce((sum, t) => sum + t.amount, 0);

    // نصيب المحل: 50% من أرباح الصيانات + الدخل - المصروفات
    const netProfit = totalProfit / 2 + totalIn - totalOut;

    res.json({
      totalProfit,
      totalPartsCost,
      totalIn,
      totalOut,
      netProfit,
      technicians: Object.values(technicianProfits),
      repairs: repairDetails,
      transactions,
      dateFilter: dateFilter || "today",
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
