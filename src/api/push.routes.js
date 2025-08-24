"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAny, isAdmin } = require("../middleware/perm");
const webpush = require("web-push");
const NotificationSub = require("../models/NotificationSub.model");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

router.use(auth);

// حفظ اشتراك المتصفح
router.post("/subscribe", async (req, res) => {
  if (!req.body?.endpoint)
    return res.status(400).json({ message: "Bad subscription" });
  await NotificationSub.updateOne(
    { user: req.user.id, endpoint: req.body.endpoint },
    { user: req.user.id, ...req.body },
    { upsert: true }
  );
  res.json({ ok: true });
});

// إرسال اختبار (للمدراء)
router.post("/test", requireAny(isAdmin), async (req, res) => {
  const subs = await NotificationSub.find({}).lean();
  const payload = JSON.stringify({
    title: "اختبار إشعار",
    body: "لو وصلك الإشعار يبقى الإعدادات سليمة ✅",
    url: "/notifications",
  });
  await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s, payload).catch(() => {}))
  );
  res.json({ ok: true });
});

module.exports = router;
