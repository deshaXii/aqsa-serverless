// src/api/notifications.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Notification = require("../models/Notification.model");

router.use(auth);

function setReadFlags(doc) {
  doc.isRead = true;
  doc.read = true;
  doc.seen = true;
  doc.readAt = new Date();
}

// عداد غير المقروء
router.get("/unread-count", async (req, res) => {
  const userId = req.user.id;
  const filter = {
    user: userId,
    $or: [
      { isRead: false },
      { read: false },
      { seen: false },
      {
        $and: [
          { isRead: { $exists: false } },
          { read: { $exists: false } },
          { seen: { $exists: false } },
        ],
      },
    ],
  };
  const count = await Notification.countDocuments(filter);
  res.json({ count });
});

// لستة الإشعارات (ادعم unread=true)
router.get("/", async (req, res) => {
  const { unread, limit = 50, offset = 0 } = req.query;
  const filter = { user: req.user.id };
  if (String(unread) === "true") {
    filter.$or = [
      { isRead: false },
      { read: false },
      { seen: false },
      {
        $and: [
          { isRead: { $exists: false } },
          { read: { $exists: false } },
          { seen: { $exists: false } },
        ],
      },
    ];
  }
  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(Number(offset))
    .limit(Math.max(1, Math.min(200, Number(limit))))
    .lean();
  res.json(items);
});

// علِّم واحد كمقروء
router.put("/:id/read", async (req, res) => {
  const { id } = req.params;
  const n = await Notification.findOne({ _id: id, user: req.user.id });
  if (!n) return res.status(404).json({ message: "Not found" });
  setReadFlags(n);
  await n.save();
  res.json({ ok: true, notification: n.toObject() });
});

// علِّم الكل كمقروء
router.put("/mark-all-read", async (req, res) => {
  const filter = {
    user: req.user.id,
    $or: [
      { isRead: false },
      { read: false },
      { seen: false },
      {
        $and: [
          { isRead: { $exists: false } },
          { read: { $exists: false } },
          { seen: { $exists: false } },
        ],
      },
    ],
  };
  const r = await Notification.updateMany(filter, {
    $set: { isRead: true, read: true, seen: true, readAt: new Date() },
  });
  res.json({ ok: true, modified: r.modifiedCount ?? r.nModified ?? 0 });
});

// 🧹 مسح الإشعارات
// DELETE /api/notifications/clear
// ?all=true  → امسح الكل
// (الافتراضي) امسح "المقروء فقط" للحفاظ على غير المقروء
router.delete("/clear", async (req, res) => {
  const all = String(req.query.all || "").toLowerCase() === "true";
  const baseFilter = { user: req.user.id };

  let filter;
  if (all) {
    filter = baseFilter;
  } else {
    filter = {
      ...baseFilter,
      $or: [{ isRead: true }, { read: true }, { seen: true }],
    };
  }

  const r = await Notification.deleteMany(filter);
  res.json({ ok: true, deleted: r.deletedCount || 0 });
});

module.exports = router;
