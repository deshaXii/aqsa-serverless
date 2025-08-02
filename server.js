require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ✅ إعدادات CORS
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json());

// ✅ اتصال MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ استيراد الموديلات (مهم لفنكشنات populate)
require("./src/api/models/User.model.js");
require("./src/models/Repair.model.js");
require("./src/models/Part.model.js");
require("./src/models/Log.model.js");

// ✅ استيراد الروترات
const authRoutes = require("./src/api/auth.routes.js");
const repairsRoutes = require("./src/api/repairs.routes.js");
const techniciansRoutes = require("./src/api/technicians.routes.js");
const invoicesRoutes = require("./src/api/invoices.routes.js");
const backupRoutes = require("./src/api/backup.routes.js");
const partsRoutes = require("./src/api/parts.routes.js");
const logsRoutes = require("./src/api/logs.routes.js");
// const notificationsRoutes = require("./src/api/notifications.routes.js");

// ✅ ربط الروترات
app.use("/api/auth", authRoutes);
app.use("/api/repairs", repairsRoutes);
app.use("/api/technicians", techniciansRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/logs", logsRoutes);
// app.use("/api/notifications", notificationsRoutes);

// ✅ Endpoint للتأكد إن السيرفر شغال
app.get("/", (req, res) => {
  res.send("🚀 Aqsa Serverless API is running!");
});

// ✅ لازم تصدّر app علشان Vercel يشتغل
module.exports = app;

// ✅ للتشغيل المحلي
const PORT = process.env.PORT || 5000;
if (!module.parent) {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
