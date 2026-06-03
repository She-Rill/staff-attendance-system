require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public"));

/* =========================
   SECURITY TOKEN (QR)
========================= */
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

/* =========================
   ADMIN CREDENTIALS
========================= */
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

/* =========================
   STAFF PIN SYSTEM (NO JACKLINE)
========================= */
const staffPins = {
  "Geoffrey Onyango": "2587",
  "Sherill Cornel": "8136",
  "Owet Cynthia": "4387",
  "Anthony Kihara": "5835",
  "Wambui Kinuthia": "7925"
};

/* =========================
   POSTGRES CONNECTION
========================= */
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* Connection test */
db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => {
    console.log("❌ PostgreSQL connection failed");
    console.log(err);
  });

/* =========================
   QR MIDDLEWARE
========================= */
function checkAccessToken(req, res, next) {
  const token =
    req.headers["x-access-token"] ||
    req.body.token ||
    req.query.token;

  if (!token || token !== ACCESS_TOKEN) {
    return res.status(403).json({
      message: "Access denied: Invalid QR code"
    });
  }


  next();
}

function checkOfficeWifi(req, res, next) {
  const requestIP =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  const officeIP = process.env.OFFICE_IP;

  if (!officeIP) {
    return next(); // fallback if not set
  }

  if (requestIP !== officeIP) {
    return res.status(403).json({
      message: "Clock-in allowed only from office network"
    });
  }

  next();
}

/* =========================
   ADMIN LOGIN
========================= */
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ success: true, message: "Login successful" });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
});

/* =========================
   ATTENDANCE HISTORY
========================= */
app.get("/attendance-history", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, work_date, time_in, time_out
      FROM attendance
      ORDER BY work_date DESC, time_in DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.log("❌ DATABASE ERROR (history):");
    console.log(err);

    res.status(500).json({
      message: "Database error",
      error: err.message
    });
  }
});

/* =========================
   CLOCK IN
========================= */
app.post("/clock-in", checkOfficeWifi, checkAccessToken, async (req, res) => {
  const { name, pin } = req.body || {};

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  try {
    const check = await db.query(
      `SELECT id FROM attendance
       WHERE name = $1
       AND work_date = CURRENT_DATE
       AND time_out IS NULL`,
      [name]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Already clocked in" });
    }

    await db.query(
      `INSERT INTO attendance (name, work_date, time_in)
       VALUES ($1, CURRENT_DATE, NOW())`,
      [name]
    );

    res.json({ message: "Clocked in successfully" });

  } catch (err) {
    console.log("❌ DATABASE ERROR (clock-in):");
    console.log(err);

    res.status(500).json({
      message: "Database error",
      error: err.message
    });
  }
});

/* =========================
   CLOCK OUT
========================= */
app.post("/clock-out", checkAccessToken, async (req, res) => {
  const { name, pin } = req.body || {};

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  try {
    const check = await db.query(
      `SELECT id FROM attendance
       WHERE name = $1
       AND work_date = CURRENT_DATE
       AND time_out IS NULL`,
      [name]
    );

    if (check.rows.length === 0) {
      return res.status(400).json({ message: "No active session found" });
    }

    await db.query(
      `UPDATE attendance
       SET time_out = NOW()
       WHERE id = $1`,
      [check.rows[0].id]
    );

    res.json({ message: "Clocked out successfully" });

  } catch (err) {
    console.log("❌ DATABASE ERROR (clock-out):");
    console.log(err);

    res.status(500).json({
      message: "Database error",
      error: err.message
    });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});