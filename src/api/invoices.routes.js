"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin } = require("../middleware/perm");
const Repair = require("../models/Repair.model");

// GET /api/invoices/parts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// يرجّع كل قطع الغيار داخل الفترة بغض النظر عن حالة الصيانة
router.get("/parts", auth, requireAny(isAdmin), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const match = { "parts.date": { $type: "date" } };
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
      match["parts.date"] = {};
      if (start) match["parts.date"].$gte = start;
      if (end) match["parts.date"].$lte = end;
    }

    const items = await Repair.aggregate([
      { $match: { parts: { $exists: true, $ne: [] } } },
      { $unwind: "$parts" },
      { $match: match },
      {
        $project: {
          repairId: 1,
          status: 1,
          deviceType: 1,
          customerName: 1,
          technician: 1,
          deliveryDate: 1,
          part: {
            name: "$parts.name",
            source: "$parts.source",
            vendor: "$parts.vendor",
            price: "$parts.price",
            date: "$parts.date",
            qty: { $ifNull: ["$parts.qty", 1] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "technician",
          foreignField: "_id",
          as: "tech",
        },
      },
      { $unwind: { path: "$tech", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          delivered: {
            $cond: [
              { $ifNull: ["$deliveryDate", false] },
              true,
              { $eq: ["$status", "تم التسليم"] },
            ],
          },
        },
      },
      { $sort: { "part.date": 1, _id: 1 } },
    ]);

    const byVendor = await Repair.aggregate([
      { $match: { parts: { $exists: true, $ne: [] } } },
      { $unwind: "$parts" },
      { $match: match },
      {
        $group: {
          _id: { vendor: "$parts.vendor", source: "$parts.source" },
          total: { $sum: { $toDouble: "$parts.price" } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          vendor: "$_id.vendor",
          source: "$_id.source",
          total: 1,
          count: 1,
        },
      },
      { $sort: { vendor: 1, source: 1 } },
    ]);

    const totals = byVendor.reduce(
      (acc, v) => ({
        ...acc,
        totalParts: acc.totalParts + (v.total || 0),
        count: acc.count + (v.count || 0),
      }),
      { totalParts: 0, count: 0 }
    );

    res.json({ items, byVendor, totals });
  } catch (e) {
    console.error("invoices/parts error:", e);
    res.status(500).json({ message: "تعذر تحميل قطع الغيار" });
  }
});

module.exports = router;
