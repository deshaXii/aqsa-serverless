require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/utils/db.js");

// Models (مهمة لتسجيل الـ schema قبل الاستخدام)
require("./src/models/User.model.js");
require("./src/models/Repair.model.js");
require("./src/models/Log.model.js");
require("./src/models/Part.model.js");
require("./src/models/Notification.model.js");

const authRoutes = require("./src/api/auth.routes.js");
const repairsRoutes = require("./src/api/repairs.routes.js");
const techniciansRoutes = require("./src/api/technicians.routes.js");
const invoicesRoutes = require("./src/api/invoices.routes.js");
const backupRoutes = require("./src/api/backup.routes.js");
const partsRoutes = require("./src/api/parts.routes.js");
const logsRoutes = require("./src/api/logs.routes.js");
const notificationsRoutes = require("./src/api/notifications.routes.js");

const app = express();

// ✅ Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// ✅ Connect MongoDB with caching
(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ Failed to connect MongoDB at startup:", err.message);
  }
})();

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/repairs", repairsRoutes);
app.use("/api/technicians", techniciansRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/notifications", notificationsRoutes);

// ✅ Health Check Route
app.get("/", (req, res) => {
  res.json({ status: "Server is running ✅", time: new Date().toISOString() });
});

// ✅ Export for Vercel
module.exports = app;

// ✅ Local development only
if (!module.parent) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
