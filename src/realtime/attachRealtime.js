// src/realtime/attachRealtime.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

module.exports = function attachRealtime(server, app) {
  const io = new Server(server, {
    cors: { origin: "*", credentials: true },
    path: "/socket.io",
  });

  // مصادقة مبسطة: نحاول قراءة التوكن من auth أو query
  io.use((socket, next) => {
    try {
      const raw =
        socket.handshake.auth?.token || socket.handshake.query?.token || "";
      const token = String(raw || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const uid = String(payload.id || payload._id || "");
        if (uid) {
          socket.data.userId = uid;
          socket.join(uid); // Room = userId
        }
      }
    } catch {
      /* اتصال بدون توكن → هيعتمد على الـ polling fallback في الفرونت */
    }
    next();
  });

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true });
  });

  app.set("io", io);
  return io;
};
