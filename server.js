require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public"));

/* =========================
   ADMIN CREDENTIALS
========================= */
const ADMIN_USER = "admin";
const ADMIN_PASS = "3058";

/* =========================
   STAFF PIN SYSTEM
========================= */
const staffPins = {
  "Geoffrey Onyango": "2587",
  "Jackline Mbithi": "3469",
  "Sherill Cornel": "8136",
  "Owet Cynthia": "4387",
  "Anthony Kihara": "5835",
  "Wambui Kinuthia": "7925"
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
   ADMIN LOGIN
========================= */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password required"
    });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({
      success: true,
      message: "Login successful"
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
});

/* =========================
   ADMIN LOGOUT
========================= */
app.post("/admin/logout", (req, res) => {
  res.json({ success: true });
});

/* =========================
   ATTENDANCE HISTORY (RAW SAFE)
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

    // Send RAW values (frontend will format safely)
    res.json(results);
  });
});

/* =========================
   CLOCK IN (SAFE + NO DUPLICATES)
========================= */
app.post("/clock-in", (req, res) => {
  const { name, pin } = req.body || {};

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const checkQuery = `
    SELECT id
    FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(checkQuery, [name], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length > 0) {
      return res.status(400).json({
        message: "Already clocked in"
      });
    }

    const insertQuery = `
      INSERT INTO attendance (name, work_date, time_in)
      VALUES (?, CURDATE(), NOW())
    `;

    db.query(insertQuery, [name], (err2) => {
      if (err2) {
        console.log(err2);
        return res.status(500).json({ message: "Clock-in failed" });
      }

      res.json({ message: "Clocked in successfully" });
    });
  });
});

/* =========================
   CLOCK OUT (SAFE)
========================= */
app.post("/clock-out", (req, res) => {
  const { name, pin } = req.body || {};

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const checkQuery = `
    SELECT id
    FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(checkQuery, [name], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(400).json({
        message: "No active session found"
      });
    }

    const updateQuery = `
      UPDATE attendance
      SET time_out = NOW()
      WHERE id = ?
    `;

    db.query(updateQuery, [results[0].id], (err2) => {
      if (err2) {
        console.log(err2);
        return res.status(500).json({ message: "Clock-out failed" });
      }

      res.json({ message: "Clocked out successfully" });
    });
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});