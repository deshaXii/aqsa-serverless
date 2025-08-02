require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Models
const Customer = mongoose.model(
  "Customer",
  new mongoose.Schema({
    name: String,
    phone: String,
    receivedAt: { type: Date, default: Date.now },
  })
);

const Technician = mongoose.model(
  "Technician",
  new mongoose.Schema({
    name: String,
    username: { type: String, unique: true },
    password: String,
    canReceive: { type: Boolean, default: false },
    canAdd: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
  })
);

const Repair = mongoose.model(
  "Repair",
  new mongoose.Schema({
    customerName: String,
    deviceType: String,
    fault: String,
    color: String,
    phoneNumber: String,
    price: Number,
    technicianName: String,
    receiverName: String,
    receiverUsername: String,
    wholesalePrice: Number,
    wholesaleType: String,
    profit: Number,
    status: {
      type: String,
      enum: ["pending", "completed", "delivered", "rejected"],
      default: "pending",
    },
    notes: String,
    lastActionBy: String,
    createdAt: { type: Date, default: Date.now },
  })
);

// Stats API
app.get("/api/stats", async (req, res) => {
  try {
    const dbStats = await mongoose.connection.db.stats();
    const [customers, repairs, technicians] = await Promise.all([
      Customer.countDocuments(),
      Repair.countDocuments(),
      Technician.countDocuments(),
    ]);
    res.json({
      customers,
      repairs,
      technicians,
      dbSizeMB: Math.round((dbStats.storageSize / 1024 / 1024) * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "خطأ في جلب الإحصائيات" });
  }
});

// Customers API
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ receivedAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Technicians API
app.get("/api/technicians", async (req, res) => {
  try {
    const technicians = await Technician.find();
    res.json(technicians);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/technicians", async (req, res) => {
  try {
    if (!req.body.username) {
      return res.status(400).json({ error: "اسم المستخدم مطلوب" });
    }
    const technician = await Technician.create(req.body);
    res.json(technician);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/technicians/:id", async (req, res) => {
  try {
    if (!req.body.username) {
      return res.status(400).json({ error: "اسم المستخدم مطلوب" });
    }
    const updated = await Technician.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/technicians/login", async (req, res) => {
  const { username, password } = req.body;
  const tech = await Technician.findOne({ username });
  if (tech && tech.password === password) {
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post("/api/technicians/verify", async (req, res) => {
  const { username, password } = req.body;
  const tech = await Technician.findOne({ username });
  if (tech && tech.password === password) {
    return res.json({
      success: true,
      canAdd: tech.canAdd,
      canEdit: tech.canEdit,
      canReceive: tech.canReceive,
      name: tech.name,
    });
  }
  res.json({ success: false });
});

app.delete("/api/technicians/:id", async (req, res) => {
  try {
    await Technician.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Repairs API
app.get("/api/repairs", async (req, res) => {
  try {
    const repairs = await Repair.find().lean().maxTimeMS(30000);
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message || "حدث خطأ في الخادم" });
  }
});

app.post("/api/repairs", async (req, res) => {
  try {
    const repairData = {
      ...req.body,
      profit: req.body.price - (req.body.wholesalePrice || 0),
    };
    const repair = await Repair.create(repairData);
    res.json(repair);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/repairs/:id", async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      profit: req.body.price - (req.body.wholesalePrice || 0),
    };
    const repair = await Repair.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    res.json(repair);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/repairs/:id", async (req, res) => {
  try {
    await Repair.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Backup API
app.get("/api/backup", async (req, res) => {
  try {
    const [customers, repairs, technicians] = await Promise.all([
      Customer.find(),
      Repair.find(),
      Technician.find(),
    ]);
    res.json({ customers, repairs, technicians });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/restore", async (req, res) => {
  try {
    await Promise.all([
      Customer.deleteMany(),
      Repair.deleteMany(),
      Technician.deleteMany(),
    ]);
    const [customers, repairs, technicians] = await Promise.all([
      Customer.insertMany(req.body.customers || []),
      Repair.insertMany(req.body.repairs || []),
      Technician.insertMany(req.body.technicians || []),
    ]);
    res.json({ success: true, customers, repairs, technicians });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/all", async (req, res) => {
  try {
    await Promise.all([
      Customer.deleteMany(),
      Repair.deleteMany(),
      Technician.deleteMany(),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vercel requires this to work properly
module.exports = app;

// Listen only once
const PORT = process.env.PORT || 5000;
if (!module.parent) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
