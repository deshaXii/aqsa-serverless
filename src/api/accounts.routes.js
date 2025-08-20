"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin, hasPerm } = require("../middleware/perm");
const Repair = require("../models/Repair.model");
const Transaction = require("../models/Transaction.model");

// GET /api/accounts/summary
router.get(
  "/summary",
  auth,
  requireAny(isAdmin, hasPerm("accounts")),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

      const deliveredMatch = { deliveryDate: { $type: "date" } };
      if (start || end) {
        deliveredMatch.deliveryDate = {};
        if (start) deliveredMatch.deliveryDate.$gte = start;
        if (end) deliveredMatch.deliveryDate.$lte = end;
      }

      const delivered = await Repair.aggregate([
        { $match: deliveredMatch },
        {
          $addFields: {
            partsCost: {
              $sum: {
                $map: {
                  input: "$parts",
                  as: "p",
                  in: { $toDouble: { $ifNull: ["$$p.price", 0] } },
                },
              },
            },
            final: { $toDouble: { $ifNull: ["$finalPrice", "$price", 0] } },
          },
        },
        { $project: { technician: 1, final: 1, partsCost: 1 } },
      ]);

      const grossRevenue = delivered.reduce((s, r) => s + (r.final || 0), 0);
      const partsCostSum = delivered.reduce(
        (s, r) => s + (r.partsCost || 0),
        0
      );

      const defaultTechPct = Number(process.env.DEFAULT_TECH_PCT || 50);
      const byTech = new Map();
      for (const r of delivered) {
        const id = String(r.technician || "unknown");
        const net = (r.final || 0) - (r.partsCost || 0);
        const pct = r.technicianPercentageOverride ?? defaultTechPct;
        const techShare = net * (pct / 100);
        const shopShare = net - techShare;
        const cur = byTech.get(id) || {
          techId: id,
          deliveredCount: 0,
          netProfit: 0,
          techShare: 0,
          shopShare: 0,
        };
        cur.deliveredCount++;
        cur.netProfit += net;
        cur.techShare += techShare;
        cur.shopShare += shopShare;
        byTech.set(id, cur);
      }
      const perTechnician = Array.from(byTech.values());

      const txMatch = {};
      if (start || end) {
        txMatch.date = {};
        if (start) txMatch.date.$gte = start;
        if (end) txMatch.date.$lte = end;
      }
      const txs = await Transaction.find(txMatch).sort({ date: -1 }).lean();
      const transactionsIn = txs
        .filter((t) => t.type === "in")
        .reduce((s, t) => s + t.amount, 0);
      const transactionsOut = txs
        .filter((t) => t.type === "out")
        .reduce((s, t) => s + t.amount, 0);

      res.json({
        totals: {
          grossRevenue,
          partsCost: partsCostSum,
          transactionsIn,
          transactionsOut,
          netCash:
            grossRevenue - partsCostSum + transactionsIn - transactionsOut,
        },
        perTechnician,
        transactions: txs,
      });
    } catch (e) {
      console.error("accounts/summary error:", e);
      res.status(500).json({ message: "تعذر تحميل ملخص الحسابات" });
    }
  }
);

// CRUD معاملات
router.get(
  "/transactions",
  auth,
  requireAny(isAdmin, hasPerm("accounts")),
  async (req, res) => {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(`${startDate}T00:00:00`);
      if (endDate) match.date.$lte = new Date(`${endDate}T23:59:59.999`);
    }
    const tx = await Transaction.find(match).sort({ date: -1 }).lean();
    res.json(tx);
  }
);

router.post(
  "/transactions",
  auth,
  requireAny(isAdmin, hasPerm("accounts")),
  async (req, res) => {
    const { type, amount, description, date } = req.body || {};
    if (!type || !["in", "out"].includes(type) || amount == null) {
      return res.status(400).json({ message: "حقول ناقصة" });
    }
    const t = await Transaction.create({
      type,
      amount: Number(amount),
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
  requireAny(isAdmin, hasPerm("accounts")),
  async (req, res) => {
    const { id } = req.params;
    const { type, amount, description, date } = req.body || {};
    const t = await Transaction.findById(id);
    if (!t) return res.status(404).json({ message: "غير موجود" });
    if (type) t.type = type;
    if (amount != null) t.amount = Number(amount);
    if (description != null) t.description = description;
    if (date) t.date = new Date(date);
    await t.save();
    res.json(t.toObject());
  }
);

router.delete(
  "/transactions/:id",
  auth,
  requireAny(isAdmin, hasPerm("accounts")),
  async (req, res) => {
    const { id } = req.params;
    const r = await Transaction.deleteOne({ _id: id });
    res.json({ ok: true, deleted: r.deletedCount || 0 });
  }
);

module.exports = router;
