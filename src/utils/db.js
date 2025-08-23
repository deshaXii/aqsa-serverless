const mongoose = require("mongoose");

let isConnected = false; // cache connection

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI not found in environment variables");
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 500000, // أسرع فشل
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }

  mongoose.connection.once("open", async () => {
    try {
      const coll = mongoose.connection.collection("repairs");
      const indexes = await coll.indexes();
      const toDrop = indexes.find(
        (i) => i.name === "parts.id_1" || (i.key && i.key["parts.id"] === 1)
      );
      if (toDrop) {
        await coll.dropIndex(toDrop.name);
        console.log("Dropped index:", toDrop.name);
      }
    } catch (e) {
      console.log("Index drop check:", e.message);
    }
  });
}

module.exports = connectDB;
