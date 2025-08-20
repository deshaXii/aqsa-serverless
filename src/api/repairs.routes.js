// src/api/repairs.routes.js
const express = require("express");
const router = express.Router();
const Repair = require("../models/Repair.model");
const User = require("../models/User.model");
const Log = require("../models/Log.model");
const Counter = require("../models/Counter.model");
const Notification = require("../models/Notification.model");
const Settings = require("../models/Settings.model");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

router.use(auth);

// ===== Helpers =====
function canViewAll(user) {
  return (
    user?.role === "admin" ||
    user?.permissions?.adminOverride ||
    user?.permissions?.addRepair ||
    user?.permissions?.receiveDevice
  );
}
async function getAdmins() {
  return User.find({
    $or: [{ role: "admin" }, { "permissions.adminOverride": true }],
  })
    .select("_id")
    .lean();
}

// بث + حفظ إشعار
async function notifyUsers(req, userIds, message, type = "repair", meta = {}) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const docs = await Notification.insertMany(
    userIds.map((u) => ({ user: u, message, type, meta }))
  );
  const io = req.app.get("io");
  if (io) {
    for (const n of docs) {
      io.to(String(n.user)).emit("notification:new", {
        _id: String(n._id),
        message: n.message,
        type: n.type,
        meta: n.meta || {},
        createdAt: n.createdAt,
      });
    }
  }
}

function diffChanges(oldDoc, newDoc, fields) {
  const changes = [];
  fields.forEach((f) => {
    const a = oldDoc[f],
      b = newDoc[f];
    if (JSON.stringify(a) !== JSON.stringify(b))
      changes.push({ field: f, from: a, to: b });
  });
  return changes;
}
async function nextRepairId() {
  const c = await Counter.findOneAndUpdate(
    { name: "repairId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return c.seq;
}
function buildCreatedAtFilter(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const createdAt = {};
  if (startDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      createdAt.$gte = s;
    } else createdAt.$gte = new Date(startDate);
  }
  if (endDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const e = new Date(endDate);
      e.setHours(0, 0, 0, 0);
      e.setDate(e.getDate() + 1);
      createdAt.$lt = e;
    } else createdAt.$lte = new Date(endDate);
  }
  return createdAt;
}

// ===== LIST =====
router.get("/", auth, async (req, res) => {
  try {
    const { q, status, technician, startDate, endDate } = req.query;

    const filter = {};

    // نص بحث بسيط
    if (q) {
      const rx = new RegExp(
        String(q)
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [
        { customerName: rx },
        { phone: rx },
        { deviceType: rx },
        { issue: rx },
        ...(filter.$or || []),
      ];
    }

    // تصفية بالحالة
    if (status) filter.status = status;

    // تصفية بالفني (لو مبعوتة من الفرونت)
    if (technician) filter.technician = technician;

    // ⬅️ أهم تعديل: نطاق التاريخ يشمل createdAt **أو** deliveryDate
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null; // محلي
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null; // محلي

      const createdCond = {};
      const deliveredCond = {};
      if (start) {
        createdCond.$gte = start;
        deliveredCond.$gte = start;
      }
      if (end) {
        createdCond.$lte = end;
        deliveredCond.$lte = end;
      }

      const dateOr = [];
      if (Object.keys(createdCond).length)
        dateOr.push({ createdAt: createdCond });
      if (Object.keys(deliveredCond).length)
        dateOr.push({ deliveryDate: deliveredCond });

      if (dateOr.length) {
        // لو كان فيه $or من البحث، ضيف OR جديد بطريقة صحيحة
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: dateOr }];
          delete filter.$or;
        } else {
          filter.$or = dateOr;
        }
      }
    }

    // (اختياري) احترام صلاحيات العرض: لو المستخدم مش Admin ولا عنده امتيازات معينة
    // اقفل البيانات على الصيانات اللي هو فنيها
    const canViewAll =
      req.user.role === "admin" ||
      req.user.permissions?.adminOverride ||
      req.user.permissions?.addRepair ||
      req.user.permissions?.receiveDevice;

    if (!canViewAll) {
      // شوف فقط اللي مُعيّن عليها
      filter.technician = req.user.id;
    }

    const list = await Repair.find(filter)
      .sort({ createdAt: -1 })
      .populate("technician", "name")
      .populate("createdBy", "name")
      .populate("recipient", "name")
      .lean();

    res.json(list);
  } catch (e) {
    console.error("list repairs error:", e);
    res.status(500).json({ message: "تعذر تحميل البيانات" });
  }
});

// ===== GET one =====
router.get("/:id", async (req, res) => {
  const r = await Repair.findById(req.params.id)
    .populate("technician", "name")
    .populate("recipient", "name")
    .populate("createdBy", "name")
    .populate({
      path: "logs",
      options: { sort: { createdAt: -1 } },
      populate: { path: "changedBy", select: "name" },
    })
    .lean();
  if (!r) return res.status(404).json({ message: "Not found" });

  if (!canViewAll(req.user)) {
    if (
      !r.technician ||
      String(r.technician._id || r.technician) !== String(req.user.id)
    ) {
      return res
        .status(403)
        .json({ message: "ليست لديك صلاحية عرض هذه الصيانة" });
    }
  }

  res.json(r);
});

// ===== CREATE =====
router.post(
  "/",
  require("../middleware/checkPermission")("addRepair"),
  async (req, res) => {
    const payload = req.body || {};
    payload.repairId = await nextRepairId();
    payload.createdBy = req.user.id;

    const r = new Repair(payload);
    await r.save();

    const log = await Log.create({
      repair: r._id,
      action: "create",
      changedBy: req.user.id,
      details: "إنشاء صيانة جديدة",
    });
    await Repair.findByIdAndUpdate(r._id, { $push: { logs: log._id } });

    const admins = await getAdmins();
    const recipients = [];
    if (r.technician) recipients.push(r.technician.toString());
    recipients.push(...admins.map((a) => a._id.toString()));
    await notifyUsers(
      req,
      recipients,
      `تم إضافة صيانة جديدة #${r.repairId}`,
      "repair",
      { repairId: r._id }
    );

    res.json(r);
  }
);

// ===== UPDATE =====
router.put("/:id", async (req, res) => {
  const repair = await Repair.findById(req.params.id);
  if (!repair) return res.status(404).json({ message: "Not found" });

  const body = req.body || {};
  const user = req.user;

  const canEditAll =
    user.role === "admin" ||
    user.permissions?.adminOverride ||
    user.permissions?.editRepair;
  const isAssignedTech =
    repair.technician && String(repair.technician) === String(user.id);

  if (!canEditAll) {
    if (!isAssignedTech)
      return res.status(403).json({ message: "غير مسموح بالتعديل" });

    const allowedKeys = ["status", "password"];
    if (body.status === "تم التسليم") allowedKeys.push("finalPrice", "parts");
    if (body.status === "مرفوض") allowedKeys.push("rejectedDeviceLocation");

    const unknown = Object.keys(body).filter((k) => !allowedKeys.includes(k));
    if (unknown.length)
      return res.status(403).json({ message: "غير مسموح بالتعديل" });

    if (!body.password)
      return res.status(400).json({ message: "مطلوب كلمة السر للتأكيد" });
    const fresh = await User.findById(user.id);
    const ok = await fresh.comparePassword(body.password);
    if (!ok) return res.status(400).json({ message: "كلمة السر غير صحيحة" });
  }

  const before = repair.toObject();

  if (body.status) {
    if (body.status === "جاري العمل" && !repair.startTime)
      repair.startTime = new Date();
    if (body.status === "مكتمل" && !repair.endTime) repair.endTime = new Date();
    if (body.status === "تم التسليم") {
      repair.deliveryDate = new Date();
      repair.returned = false;
      repair.returnDate = undefined;
      if (typeof body.finalPrice !== "undefined")
        repair.finalPrice = Number(body.finalPrice) || 0;
      if (Array.isArray(body.parts)) repair.parts = body.parts;
    }
    if (body.status === "مرتجع") {
      repair.returned = true;
      repair.returnDate = new Date();
    }
    if (body.status === "مرفوض" && body.rejectedDeviceLocation) {
      repair.rejectedDeviceLocation = body.rejectedDeviceLocation;
    }
    repair.status = body.status;
  }

  if (canEditAll) {
    const assignIfDefined = (key, castFn) => {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        repair[key] = castFn ? castFn(body[key]) : body[key];
      }
    };
    assignIfDefined("customerName");
    assignIfDefined("phone");
    assignIfDefined("deviceType");
    assignIfDefined("color");
    assignIfDefined("issue");
    assignIfDefined("price", (v) => Number(v) || 0);
    if (
      typeof body.finalPrice !== "undefined" &&
      body.status !== "تم التسليم"
    ) {
      repair.finalPrice = Number(body.finalPrice) || 0;
    }
    if (Array.isArray(body.parts) && body.status !== "تم التسليم")
      repair.parts = body.parts;
    assignIfDefined("notes");
    if (
      body.technician &&
      String(body.technician) !== String(repair.technician || "")
    ) {
      repair.technician = body.technician;
    }
    if (body.recipient) repair.recipient = body.recipient;
  }

  repair.updatedBy = user.id;
  await repair.save();

  const fieldsToTrack = [
    "status",
    "technician",
    "finalPrice",
    "notes",
    "recipient",
    "parts",
    "deliveryDate",
    "returnDate",
    "rejectedDeviceLocation",
    "customerName",
    "phone",
    "deviceType",
    "color",
    "issue",
    "price",
  ];
  const after = repair.toObject();
  const changes = diffChanges(before, after, fieldsToTrack);
  const log = await Log.create({
    repair: repair._id,
    action: body.status && !canEditAll ? "status_change" : "update",
    changedBy: user.id,
    details: "تعديل على الصيانة",
    changes,
  });
  await Repair.findByIdAndUpdate(repair._id, { $push: { logs: log._id } });

  const admins = await getAdmins();
  const recipients = new Set(admins.map((a) => a._id.toString()));
  if (repair.technician) recipients.add(String(repair.technician));
  await notifyUsers(
    req,
    [...recipients],
    `تم تحديث صيانة #${repair.repairId}`,
    "repair",
    { repairId: repair._id }
  );

  const populated = await Repair.findById(repair._id)
    .populate("technician", "name")
    .populate("recipient", "name")
    .populate("createdBy", "name")
    .lean();

  res.json(populated);
});

// ===== DELETE =====
router.delete(
  "/:id",
  require("../middleware/checkPermission")("deleteRepair"),
  async (req, res) => {
    const r = await Repair.findById(req.params.id);
    if (!r) return res.status(404).json({ message: "Not found" });
    await Repair.deleteOne({ _id: r._id });
    const log = await Log.create({
      repair: r._id,
      action: "delete",
      changedBy: req.user.id,
      details: "حذف الصيانة",
    });
    const admins = await getAdmins();
    await notifyUsers(
      req,
      admins.map((a) => a._id),
      `تم حذف صيانة #${r.repairId}`,
      "repair",
      { repairId: r._id }
    );
    res.json({ ok: true, logId: log._id });
  }
);

module.exports = router;
