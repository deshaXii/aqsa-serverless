"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin } = require("../middleware/perm");
const Repair = require("../models/Repair.model");

// أدوات مساعدة لتطبيع الحقول النصية
const trimOrNull = (v) => (typeof v === "string" ? v.trim() : v);

// Coalesce عام: أول قيمة صحيحة بعد التشذيب
const coalesce = (...vals) => {
  for (const v of vals) {
    const t = trimOrNull(v);
    if (t !== undefined && t !== null && t !== "") return t;
  }
  return null;
};

// GET /api/invoices/parts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get("/parts", auth, requireAny(isAdmin), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // نعتمد الحقول الصحيحة في الـSchema: purchaseDate / supplier / cost
    const match = { "parts.purchaseDate": { $type: "date" } };
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
      match["parts.purchaseDate"] = {};
      if (start) match["parts.purchaseDate"].$gte = start;
      if (end) match["parts.purchaseDate"].$lte = end;
    }

    // العناصر التفصيلية (مع إرجاع أسماء المفاتيح القديمة كما يتوقع الفرونت)
    const items = await Repair.aggregate([
      { $match: { parts: { $exists: true, $ne: [] } } },
      { $unwind: "$parts" },
      { $match: match },
      {
        $addFields: {
          _vendorNorm: {
            $let: {
              vars: {
                v: {
                  $ifNull: [
                    { $trim: { input: "$parts.supplier" } },
                    { $trim: { input: "$parts.vendor" } },
                    { $trim: { input: "$parts.vendorName" } },
                    { $trim: { input: "$parts.supplierName" } },
                  ],
                },
              },
              in: {
                $cond: [
                  { $or: [{ $eq: ["$$v", null] }, { $eq: ["$$v", ""] }] },
                  "غير محدد",
                  "$$v",
                ],
              },
            },
          },
          _sourceNorm: {
            $let: {
              vars: {
                s: {
                  $ifNull: [
                    { $trim: { input: "$parts.source" } },
                    { $trim: { input: "$parts.store" } },
                    { $trim: { input: "$parts.location" } },
                  ],
                },
              },
              in: {
                $cond: [
                  { $or: [{ $eq: ["$$s", null] }, { $eq: ["$$s", ""] }] },
                  "غير محدد",
                  "$$s",
                ],
              },
            },
          },
        },
      },
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
            source: "$_sourceNorm",
            vendor: "$_vendorNorm",
            price: {
              $convert: {
                input: "$parts.cost",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            date: "$parts.purchaseDate",
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

    // ملخص حسب (المورد، المصدر) مع تطبيع قوي
    const byVendor = await Repair.aggregate([
      { $match: { parts: { $exists: true, $ne: [] } } },
      { $unwind: "$parts" },
      { $match: match },
      {
        $addFields: {
          _vendorNorm: {
            $let: {
              vars: {
                v: {
                  $ifNull: [
                    { $trim: { input: "$parts.supplier" } },
                    { $trim: { input: "$parts.vendor" } },
                    { $trim: { input: "$parts.vendorName" } },
                    { $trim: { input: "$parts.supplierName" } },
                  ],
                },
              },
              in: {
                $cond: [
                  { $or: [{ $eq: ["$$v", null] }, { $eq: ["$$v", ""] }] },
                  "غير محدد",
                  "$$v",
                ],
              },
            },
          },
          _sourceNorm: {
            $let: {
              vars: {
                s: {
                  $ifNull: [
                    { $trim: { input: "$parts.source" } },
                    { $trim: { input: "$parts.store" } },
                    { $trim: { input: "$parts.location" } },
                  ],
                },
              },
              in: {
                $cond: [
                  { $or: [{ $eq: ["$$s", null] }, { $eq: ["$$s", ""] }] },
                  "غير محدد",
                  "$$s",
                ],
              },
            },
          },
          _priceNum: {
            $convert: {
              input: "$parts.cost",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          _qtyNum: { $ifNull: ["$parts.qty", 1] },
        },
      },
      {
        $group: {
          _id: { vendor: "$_vendorNorm", source: "$_sourceNorm" },
          total: { $sum: { $multiply: ["$_priceNum", "$_qtyNum"] } },
          count: { $sum: "$_qtyNum" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totals = byVendor.reduce(
      (acc, v) => ({
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
