// src/app.js
"use strict";

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const app = express();

// ===== Middleware أساسية =====
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS — عدّل origin حسب بيئة التطوير والإنتاج
const ALLOW_ORIGINS = [
  "http://localhost:5173", // Vite dev
  "http://localhost:3000",
  process.env.FRONTEND_ORIGIN, // ضعها في .env للإنتاج
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/Server-to-server
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, true); // أو ارفض حسب رغبتك
    },
    credentials: true,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ===== Routes =====
app.use("/api/auth", require("./api/auth.routes"));
app.use("/api/repairs", require("./api/repairs.routes"));
app.use("/api/technicians", require("./api/technicians.routes"));
app.use("/api/notifications", require("./api/notifications.routes"));
app.use("/api/invoices", require("./api/invoices.routes"));
app.use("/api/settings", require("./api/settings.routes"));
app.use("/api/chat", require("./api/chat.routes"));
app.use("/api/accounts", require("./api/accounts.routes"));
app.use("/api/backup", require("./api/backup.routes"));
app.use("/api/public", require("./api/public.routes"));
app.use("/api/push", require("./api/push.routes"));

// صحة السيرفر
app.get("/health", (req, res) => res.json({ ok: true }));

// 404 افتراضي للـ API
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "Not Found" });
  }
  next();
});

// Error handler بسيط
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

// مهم: نصدر app فقط — بدون app.listen
module.exports = app;
