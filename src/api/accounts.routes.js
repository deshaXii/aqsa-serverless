"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin, hasPerm } = require("../middleware/perm");
const Repair = require("../models/Repair.model");
const Transaction = require("../models/Transaction.model");

// ===== Helpers =====
function toNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(/,/g, " ").trim().replace(/\s+/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  // أحيانًا بيكون Decimal128 أو Types تانية
  try {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// ===== Routes =====

// GET /api/accounts/summary
router.get(
  "/summary",
  auth,
  requireAny(isAdmin, hasPerm("accessAccounts")),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

      // نعتمد التسليم داخل الفترة كمرجع للدخل
      const deliveredQuery = { deliveryDate: { $ne: null } };
      if (start || end) {
        deliveredQuery.deliveryDate = {};
        if (start) deliveredQuery.deliveryDate.$gte = start;
        if (end) deliveredQuery.deliveryDate.$lte = end;
      }

      // هنجمع بالـJS بدل Aggregation لتفادي مشاكل الأنواع/الإصدار
      const delivered = await Repair.find(deliveredQuery)
        .select("technician finalPrice price parts")
        .lean();

      let grossRevenue = 0;
      let partsCostSum = 0;
      const byTech = new Map();

      for (const r of delivered) {
        const final = toNum(r.finalPrice ?? r.price ?? 0);
        const partsArr = Array.isArray(r.parts) ? r.parts : [];
        const partsCost = partsArr.reduce((acc, p) => {
          const unit = toNum(p?.cost ?? p?.price ?? 0);
          const qty = toNum(p?.qty ?? 1);
          return acc + unit * (qty || 1);
        }, 0);

        grossRevenue += final;
        partsCostSum += partsCost;

        const techId = String(r.technician || "unknown");
        const profit = Math.max(final - partsCost, 0);
        const techShare = 0; // لو عندك نسبة للفنيين نضيفها لاحقًا
        const shopShare = profit - techShare;

        const cur = byTech.get(techId) || {
          technician: techId,
          profit: 0,
          techShare: 0,
          shopShare: 0,
        };
        cur.profit += profit;
        cur.techShare += techShare;
        cur.shopShare += shopShare;
        byTech.set(techId, cur);
      }

      const perTechnician = Array.from(byTech.values());

      // المعاملات داخل نفس الفترة
      const txMatch = {};
      if (start || end) {
        txMatch.date = {};
        if (start) txMatch.date.$gte = start;
        if (end) txMatch.date.$lte = end;
      }
      const txs = await Transaction.find(txMatch).sort({ date: -1 }).lean();
      const transactionsIn = txs
        .filter((t) => t.type === "in")
        .reduce((s, t) => s + toNum(t.amount), 0);
      const transactionsOut = txs
        .filter((t) => t.type === "out")
        .reduce((s, t) => s + toNum(t.amount), 0);

      res.json({
        summary: {
          grossRevenue,
          partsCost: partsCostSum,
          transactionsIn,
          transactionsOut,
          net: grossRevenue - partsCostSum + transactionsIn - transactionsOut,
          perTechnician,
        },
        txs,
      });
    } catch (e) {
      console.error("accounts/summary error:", e);
      res.status(500).json({ message: "تعذر تحميل الملخص" });
    }
  }
);

// CRUD للمعاملات (مصروف/إيراد)
router.get(
  "/transactions",
  auth,
  requireAny(isAdmin, hasPerm("accessAccounts")),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query || {};
      const match = {};
      if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = new Date(`${startDate}T00:00:00`);
        if (endDate) match.date.$lte = new Date(`${endDate}T23:59:59.999`);
      }
      const list = await Transaction.find(match).sort({ date: -1 }).lean();
      res.json(list);
    } catch (e) {
      console.error("accounts/transactions error:", e);
      res.status(500).json({ message: "تعذر تحميل المعاملات" });
    }
  }
);

router.post(
  "/transactions",
  auth,
  requireAny(isAdmin, hasPerm("accessAccounts")),
  async (req, res) => {
    const { type, amount, description, date } = req.body || {};
    if (!type || typeof amount === "undefined") {
      return res.status(400).json({ message: "حقول ناقصة" });
    }
    const t = await Transaction.create({
      type,
      amount: toNum(amount),
      description: description || "",
      date: date ? new Date(date) : new Date(),
      createdBy: req.user.id,
    });
    res.status(201).json(t);
  }
);

router.put(
  "/transactions/:id",
  auth,
  requireAny(isAdmin, hasPerm("accessAccounts")),
  async (req, res) => {
    const { id } = req.params;
    const { type, amount, description, date } = req.body || {};
    const update = {};
    if (type) update.type = type;
    if (typeof amount !== "undefined") update.amount = toNum(amount);
    if (typeof description === "string") update.description = description;
    if (date) update.date = new Date(date);
    const t = await Transaction.findByIdAndUpdate(id, update, { new: true });
    res.json(t);
  }
);

router.delete(
  "/transactions/:id",
  auth,
  requireAny(isAdmin, hasPerm("accessAccounts")),
  async (req, res) => {
    const { id } = req.params;
    const r = await Transaction.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount || 0 });
  }
);

module.exports = router;
