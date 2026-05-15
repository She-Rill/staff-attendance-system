require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public"));

/* =========================
   ADMIN CREDENTIALS (SIMPLE)
========================= */
const ADMIN_USER = "admin";
const ADMIN_PASS = "3058";

/* =========================
   PIN SYSTEM
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
    console.log("❌ Database connection failed");
    console.log(err);
    return;
  }
  console.log("✅ Connected to MySQL");
});

/* =========================
   ADMIN LOGIN (NO JWT, NO SESSION)
========================= */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({
      success: true
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
});

/* =========================
   ADMIN LOGOUT (FRONTEND HANDLED)
========================= */
app.post("/admin/logout", (req, res) => {
  res.json({ success: true });
});

/* =========================
   ATTENDANCE HISTORY (FOR ADMIN)
========================= */
app.get("/attendance-history", (req, res) => {
  const query = `
    SELECT id, name, work_date, time_in, time_out
    FROM attendance
    ORDER BY work_date DESC, time_in DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

/* =========================
   CLOCK IN
========================= */
app.post("/clock-in", (req, res) => {
  const { name, pin } = req.body || {};

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const query = `
    INSERT INTO attendance (name, work_date, time_in)
    VALUES (?, CURDATE(), NOW())
  `;

  db.query(query, [name], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Insert failed" });
    }

    res.json({ message: "Clocked in successfully" });
  });
});

/* =========================
   CLOCK OUT
========================= */
app.post("/clock-out", (req, res) => {
  const { name, pin } = req.body || {};

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const query = `
    UPDATE attendance
    SET time_out = NOW()
    WHERE name = ? AND work_date = CURDATE() AND time_out IS NULL
  `;

  db.query(query, [name], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Update failed" });
    }

    res.json({ message: "Clocked out successfully" });
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});