require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const session = require("express-session");

const app = express();

/* =========================
   CORS (FIXED FOR SESSIONS)
========================= */
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.static(__dirname + "/public"));

/* =========================
   SESSION
========================= */
app.use(session({
  secret: "attendance_secret_key_2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}));

/* =========================
   ADMIN LOGIN
========================= */
const ADMIN_USER = "admin";
const ADMIN_PASS = "3058";

/* =========================
   STAFF PINS
========================= */
const staffPins = {
  "Geoffrey Onyango": "2587",
  "Jackline Mbithi": "3469",
  "Sherill Cornel": "8136",
  "Owet Cynthia": "4387",
  "Anthony Kihara": "5835"
};

/* =========================
   MYSQL CONNECTION
========================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB connection failed");
    console.log(err);
    return;
  }
  console.log("✅ Connected to MySQL");
});

/* =========================
   FORMATTERS
========================= */
function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/* =========================
   ADMIN LOGIN
========================= */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.json({ success: true });
  }

  res.status(401).json({ success: false });
});

/* =========================
   MIDDLEWARE
========================= */
function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

/* =========================
   LOGOUT
========================= */
app.post("/admin/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

/* =========================
   CLOCK IN
========================= */
app.post("/clock-in", (req, res) => {
  const { name, pin } = req.body;

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const check = `
    SELECT * FROM attendance
    WHERE name = ? AND work_date = CURDATE() AND time_out IS NULL
  `;

  db.query(check, [name], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });

    if (result.length > 0) {
      return res.json({ message: "Already clocked in" });
    }

    const insert = `
      INSERT INTO attendance (name, work_date, time_in)
      VALUES (?, CURDATE(), NOW())
    `;

    db.query(insert, [name], (err) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({ message: "Clocked in successfully" });
    });
  });
});

/* =========================
   CLOCK OUT
========================= */
app.post("/clock-out", (req, res) => {
  const { name, pin } = req.body;

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const check = `
    SELECT * FROM attendance
    WHERE name = ? AND work_date = CURDATE() AND time_out IS NULL
  `;

  db.query(check, [name], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });

    if (result.length === 0) {
      return res.json({ message: "No active clock-in found" });
    }

    const id = result[0].id;

    const update = `
      UPDATE attendance SET time_out = NOW() WHERE id = ?
    `;

    db.query(update, [id], (err) => {
      if (err) return res.status(500).json({ message: err.message });

      res.json({ message: "Clocked out successfully" });
    });
  });
});

/* =========================
   PUBLIC HISTORY
========================= */
app.get("/attendance-history", (req, res) => {
  const query = `
    SELECT * FROM attendance
    ORDER BY work_date DESC, time_in DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    res.json(results.map(r => ({
      name: r.name,
      work_date: formatDate(r.work_date),
      time_in: formatTime(r.time_in),
      time_out: formatTime(r.time_out)
    })));
  });
});

/* =========================
   ADMIN HISTORY (FIXED)
========================= */
app.get("/admin/history", requireAdmin, (req, res) => {
  const query = `
    SELECT * FROM attendance
    ORDER BY work_date DESC, time_in DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    res.json(results.map(r => ({
      name: r.name,
      work_date: formatDate(r.work_date),
      time_in: formatTime(r.time_in),
      time_out: formatTime(r.time_out)
    })));
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});