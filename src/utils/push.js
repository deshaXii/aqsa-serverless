// src/utils/push.js
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription.model");

// لازم تضيف دول في بيئة التشغيل
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

const enabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("[push] VAPID keys missing – Web Push disabled");
}

async function sendOne(sub, payload) {
  try {
    await webPush.sendNotification(sub, JSON.stringify(payload));
  } catch (e) {
    // 404/410 = الاشتراك انتهت صلاحيته → امسحه
    if (e.statusCode === 404 || e.statusCode === 410) return "gone";
    console.warn("[push] send error:", e.statusCode, e.message);
  }
}

async function sendToUsers(userIds, payload) {
  if (!enabled || !Array.isArray(userIds) || userIds.length === 0) return;
  const subs = await PushSubscription.find({ user: { $in: userIds } }).lean();
  for (const s of subs) {
    const res = await sendOne({ endpoint: s.endpoint, keys: s.keys }, payload);
    if (res === "gone") await PushSubscription.deleteOne({ _id: s._id });
  }
}

module.exports = { enabled, VAPID_PUBLIC_KEY, sendToUsers };
