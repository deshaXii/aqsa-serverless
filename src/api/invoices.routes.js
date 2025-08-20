// src/api/invoices.routes.js
const express = require("express");
const router = express.Router();
const Repair = require("../models/Repair.model");

// helpers
function buildInclusiveRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const range = {};
  if (startDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      range.$gte = s;
    } else {
      range.$gte = new Date(startDate);
    }
  }
  if (endDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const e = new Date(endDate);
      e.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() + 1); // end-of-day inclusive => $lt next day
      range.$lt = e;
    } else {
      range.$lte = new Date(endDate);
    }
  }
  return range;
}
function todayRange() {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { $gte: s, $lt: e };
}

router.get("/", async (req, res) => {
  let { startDate, endDate, all } = req.query;

  // match “delivered invoices” only
  const match = { status: "تم التسليم" };

  // all=true => لا نطاق تاريخ
  if (String(all) === "true") {
    // no date filter
  } else if (startDate || endDate) {
    const range = buildInclusiveRange(startDate, endDate);
    if (range) match.deliveryDate = range;
  } else {
    // default: اليوم
    match.deliveryDate = todayRange();
  }

  const repairs = await Repair.find(match)
    .populate("technician", "name")
    .lean();

  const result = [];
  let partsCostTotal = 0;

  const bySupplierMap = new Map(); // supplier -> { items:[], totalCost }

  for (const r of repairs) {
    const parts = (r.parts || []).map((p) => ({
      name: p.name,
      cost: Number(p.cost) || 0,
      supplier: p.supplier || "—",
      source: p.source || "—",
      purchaseDate: p.purchaseDate,
    }));
    const partsCost = parts.reduce((s, p) => s + (Number(p.cost) || 0), 0);
    partsCostTotal += partsCost;

    result.push({
      _id: r._id,
      repairId: r.repairId,
      customerName: r.customerName,
      deviceType: r.deviceType,
      technician: r.technician
        ? { id: r.technician._id, name: r.technician.name }
        : null,
      deliveryDate: r.deliveryDate,
      parts,
      partsCost,
      finalPrice: Number(r.finalPrice || r.price || 0),
      profit: Math.max(0, Number(r.finalPrice || r.price || 0) - partsCost),
    });

    for (const p of parts) {
      const key = p.supplier || "—";
      if (!bySupplierMap.has(key))
        bySupplierMap.set(key, { items: [], totalCost: 0 });
      bySupplierMap.get(key).items.push({
        repairId: r.repairId,
        name: p.name,
        source: p.source,
        cost: Number(p.cost) || 0,
        purchaseDate: p.purchaseDate,
      });
      bySupplierMap.get(key).totalCost += Number(p.cost) || 0;
    }
  }

  const bySupplier = [...bySupplierMap.entries()]
    .map(([supplier, v]) => ({
      supplier,
      items: v.items,
      totalCost: v.totalCost,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  res.json({
    range: { startDate, endDate, all: String(all) === "true" },
    totals: {
      partsCostTotal, // 👈 مطلوب في الملخص
      // محتفظين بباقي المجاميع لو احتجتها لاحقًا
      repairsCount: repairs.length,
      finalPriceTotal: result.reduce((s, r) => s + r.finalPrice, 0),
      profitTotal: result.reduce((s, r) => s + r.profit, 0),
    },
    repairs: result,
    bySupplier, // 👈 اجمالي لكل مورد (totalCost)
  });
});

module.exports = router;
