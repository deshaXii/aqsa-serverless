require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// ✅ Import Models
const Repair = require("./src/models/Repair.model.js");
const User = require("./src/models/User.model.js");
const Log = require("./src/models/Log.model.js");
const Part = require("./src/models/Part.model.js");

// ✅ Import Routes
const authRoutes = require("./src/api/auth.routes.js");
const repairsRoutes = require("./src/api/repairs.routes.js");
const techniciansRoutes = require("./src/api/technicians.routes.js");
const invoicesRoutes = require("./src/api/invoices.routes.js");
const backupRoutes = require("./src/api/backup.routes.js");
const partsRoutes = require("./src/api/parts.routes.js");
const logsRoutes = require("./src/api/logs.routes.js");
const notificationsRoutes = require("./src/api/notifications.routes.js");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ All Routes
app.use("/api/auth", authRoutes);
app.use("/api/repairs", repairsRoutes);
app.use("/api/technicians", techniciansRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/notifications", notificationsRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Aqsa Backend is running!");
});

// ✅ Export app for Vercel
module.exports = app;

// ✅ Run locally if not serverless
const PORT = process.env.PORT || 5000;
if (!module.parent) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
