// src/api/accounts.routes.js
"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin } = require("../middleware/perm");

const Repair = require("../models/Repair.model");
const User = require("../models/User.model");
const Settings = require("../models/Settings.model");

// حاول نلقط موديل المعاملات لو موجود بأي اسم معتاد
let TxModel = null;
try {
  TxModel = require("../models/AccountTransaction.model");
} catch {}
if (!TxModel) {
  try {
    TxModel = require("../models/Transaction.model");
  } catch {}
}

router.use(auth);
router.use(requireAny(isAdmin));

/** أدوات تاريخ محلي YYYY-MM-DD → بداية/نهاية اليوم */
function toRange(startDate, endDate) {
  let start = null,
    end = null;
  if (startDate) {
    start = new Date(`${startDate}T00:00:00`);
  }
  if (endDate) {
    end = new Date(`${endDate}T23:59:59.999`);
  }
  return { start, end };
}

/** يحسب تكلفة قطع الصيانة */
function partsCostOfRepair(repair) {
  const parts = Array.isArray(repair.parts) ? repair.parts : [];
  let sum = 0;
  for (const p of parts) {
    const price = Number(p?.cost ?? p?.price ?? 0) || 0;
    const qty = Number(p?.qty ?? 1) || 1;
    sum += price * qty;
  }
  return sum;
}

/** يجيب خريطة نسبة عمولة لكل فني */
async function getCommissionMap(techIds) {
  const settings = await Settings.findOne().lean();
  const fallback = Number(settings?.defaultTechCommissionPct ?? 50) || 50;

  const techs = await User.find({ _id: { $in: techIds } })
    .select("_id commissionPct")
    .lean();

  const map = {};
  for (const t of techs) {
    const pct =
      typeof t.commissionPct === "number" && !Number.isNaN(t.commissionPct)
        ? t.commissionPct
        : fallback;
    map[String(t._id)] = Number(pct);
  }
  return { map, fallback };
}

// ========= ملخص الحسابات =========
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query || {};
    const { start, end } = toRange(startDate, endDate);

    // نقيّد الملخص على الصيانات "المسلّمة" داخل المدى الزمني (بناءً على deliveryDate)
    const deliveryMatch = {};
    if (start) deliveryMatch.$gte = start;
    if (end) deliveryMatch.$lte = end;

    const repairs = await Repair.find({
      status: "تم التسليم",
      ...(Object.keys(deliveryMatch).length
        ? { deliveryDate: deliveryMatch }
        : {}),
    })
      .select(
        "finalPrice price parts technician deliveryDate deviceType customerName"
      )
      .lean();

    // إجمالي الدخل والأجزاء
    let grossRevenue = 0;
    let allPartsCost = 0;

    // جهّز per-tech
    const perTechAcc = new Map(); // techId -> { deliveredCount, netProfit, techShare, shopShare }

    const techIds = new Set();

    for (const r of repairs) {
      const revenue = Number(r.finalPrice ?? r.price ?? 0) || 0;
      const cost = partsCostOfRepair(r);
      const profit = revenue - cost;

      grossRevenue += revenue;
      allPartsCost += cost;

      const techId = r.technician ? String(r.technician) : null;
      if (techId) techIds.add(techId);

      const existing = (techId && perTechAcc.get(techId)) || {
        deliveredCount: 0,
        netProfit: 0,
        techShare: 0,
        shopShare: 0,
      };

      existing.deliveredCount += 1;
      existing.netProfit += profit;

      if (techId) perTechAcc.set(techId, existing);
    }

    // طبّق نسب العمولات لكل فني
    const { map: commissionMap, fallback } = await getCommissionMap(
      Array.from(techIds)
    );
    for (const [techId, rec] of perTechAcc.entries()) {
      const pct = Number(commissionMap[techId] ?? fallback) || 0;
      const techShare = (rec.netProfit * pct) / 100;
      const shopShare = rec.netProfit - techShare;
      rec.techShare = techShare;
      rec.shopShare = shopShare;
      perTechAcc.set(techId, rec);
    }

    // المعاملات النقدية (اختياري)
    let transactionsIn = 0;
    let transactionsOut = 0;
    if (TxModel) {
      const txFilter = {};
      if (start || end) {
        txFilter.date = {};
        if (start) txFilter.date.$gte = start;
        if (end) txFilter.date.$lte = end;
      }
      const txs = await TxModel.find(txFilter)
        .select("type amount")
        .lean()
        .catch(() => []);
      for (const t of txs || []) {
        const amt = Number(t.amount || 0) || 0;
        if (String(t.type) === "in") transactionsIn += amt;
        else if (String(t.type) === "out") transactionsOut += amt;
      }
    }

    const net = grossRevenue - allPartsCost + transactionsIn - transactionsOut;

    // صيغة الخرج زي ما الفرونت متوقّعها
    const perTechnician = Array.from(perTechAcc.entries()).map(
      ([techId, v]) => ({
        technician: techId,
        deliveredCount: v.deliveredCount,
        netProfit: Math.round(v.netProfit),
        techShare: Math.round(v.techShare),
        shopShare: Math.round(v.shopShare),
      })
    );

    res.json({
      summary: {
        grossRevenue: Math.round(grossRevenue),
        partsCost: Math.round(allPartsCost),
        transactionsIn: Math.round(transactionsIn),
        transactionsOut: Math.round(transactionsOut),
        net: Math.round(net),
        perTechnician,
      },
      txs: [], // (الفرونت عنده إندبوينت منفصل لعرض المعاملات التفصيلية)
    });
  } catch (e) {
    console.error("accounts/summary error:", e);
    res.status(500).json({ message: "تعذر تحميل ملخص الحسابات" });
  }
});

module.exports = router;
