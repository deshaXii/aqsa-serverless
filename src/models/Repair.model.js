// src/models/Repair.model.js
const mongoose = require("mongoose");

const PartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    source: { type: String, trim: true },
    cost: { type: Number, default: 0 },
    supplier: { type: String, trim: true },
    // تاريخ شراء القطعة
    purchaseDate: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RepairSchema = new mongoose.Schema(
  {
    repairId: { type: Number, unique: true, index: true },
    customerName: { type: String, required: true, trim: true },
    deviceType: { type: String, required: true, trim: true },
    issue: { type: String, trim: true },
    color: { type: String, trim: true },
    phone: { type: String, trim: true },
    price: { type: Number, default: 0 },

    technician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // من استلم الجهاز
    parts: { type: [PartSchema], default: [] },

    status: {
      type: String,
      enum: [
        "في الانتظار",
        "جاري العمل",
        "مكتمل",
        "تم التسليم",
        "مرفوض",
        "مرتجع",
      ],
      default: "في الانتظار",
    },

    // سجلات وملاحظات
    logs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Log" }],
    notes: { type: String, trim: true },

    // أزمنة العمل
    startTime: { type: Date }, // بدأ الشغل فعليًا
    finalPrice: { type: Number }, // السعر النهائي للعميل
    endTime: { type: Date }, // اكتملت الصيانة
    deliveryDate: { type: Date }, // تم التسليم
    // المرتجع
    returned: { type: Boolean, default: false },
    returnDate: { type: Date },

    // حالة "مرفوض" — هل الجهاز بالمحل أم أخذه العميل؟
    rejectedDeviceLocation: {
      type: String,
      enum: ["بالمحل", "مع العميل", null],
      default: null,
    },

    // تتبُّع الإنشاء/التعديل
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Repair || mongoose.model("Repair", RepairSchema);
