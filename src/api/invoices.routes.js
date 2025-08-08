const express = require("express");
const auth = require("../middleware/auth.js");
const checkAdmin = require("../middleware/checkAdmin.js");
const Repair = require("../models/Repair.model.js");

const router = express.Router();

// GET /api/invoices?startDate=2025-08-01&endDate=2025-08-05
router.get("/", auth, async (req, res) => {
  try {
    if (
      req.user.role === "admin" ||
      req.user.permissions?.adminOverride ||
      req.user.permissions?.receiveDevice
    ) {
      const { startDate, endDate } = req.query;
      const query = {};

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      } else if (startDate) {
        query.createdAt = { $gte: new Date(startDate) };
      } else if (endDate) {
        query.createdAt = { $lte: new Date(endDate) };
      }

      const repairs = await Repair.find(query).populate("technician");

      const totalProfit = repairs.reduce((sum, r) => sum + (r.profit || 0), 0);
      const totalPartsCost = repairs.reduce(
        (sum, r) => sum + (r.totalPartsCost || 0),
        0
      );

      const technicianProfits = repairs.reduce((acc, r) => {
        if (!r.technician) return acc;
        const tech = acc.find((t) => t.technicianName === r.technician.name);
        const profitShare = (r.profit || 0) / 2;
        if (tech) tech.profit += profitShare;
        else
          acc.push({ technicianName: r.technician.name, profit: profitShare });
        return acc;
      }, []);

      const partsByShop = {};
      repairs.forEach((r) => {
        (r.parts || []).forEach((part) => {
          const shop = part.source || "المحل";
          if (!partsByShop[shop]) partsByShop[shop] = [];
          partsByShop[shop].push({
            name: part.name,
            cost: part.cost,
            customerName: r.customerName,
            technicianName: r.technician?.name || "-",
          });
        });
      });

      res.json({
        totalProfit,
        totalPartsCost,
        technicianProfits,
        repairs,
        partsByShop,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "فشل في جلب بيانات الفواتير" });
  }
});

module.exports = router;
