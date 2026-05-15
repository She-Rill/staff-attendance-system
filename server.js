require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(__dirname + "/public"));

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
   FORMAT HELPERS
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
   GET ATTENDANCE HISTORY (USER VIEW)
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

    const formatted = results.map((row) => ({
      id: row.id,
      name: row.name,
      work_date: formatDate(row.work_date),
      time_in: formatTime(row.time_in),
      time_out: formatTime(row.time_out)
    }));

    res.json(formatted);
  });
});

/* =========================
   CLOCK IN (WITH PIN)
========================= */
app.post("/clock-in", (req, res) => {
  const { name, pin } = req.body;

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const check = `
    SELECT * FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(check, [name], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.length > 0) {
      return res.json({ message: "Already clocked in" });
    }

    const insert = `
      INSERT INTO attendance (name, work_date, time_in)
      VALUES (?, CURDATE(), NOW())
    `;

    db.query(insert, [name], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Insert failed" });
      }

      res.json({ message: "Clocked in successfully" });
    });
  });
});

/* =========================
   CLOCK OUT (WITH PIN)
========================= */
app.post("/clock-out", (req, res) => {
  const { name, pin } = req.body;

  if (!name || !pin) {
    return res.status(400).json({ message: "Name and PIN required" });
  }

  if (staffPins[name] !== pin) {
    return res.status(401).json({ message: "Invalid PIN" });
  }

  const check = `
    SELECT * FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(check, [name], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.length === 0) {
      return res.json({ message: "No active clock-in found" });
    }

    const id = result[0].id;

    const update = `
      UPDATE attendance
      SET time_out = NOW()
      WHERE id = ?
    `;

    db.query(update, [id], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Database error" });
      }

      res.json({ message: "Clocked out successfully" });
    });
  });
});

/* =========================
   ADMIN - ACTIVE STAFF
========================= */
app.get("/admin/active", (req, res) => {
  const query = `
    SELECT name, time_in
    FROM attendance
    WHERE time_out IS NULL
    ORDER BY time_in DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Database error" });
    }

    const formatted = results.map(r => ({
      name: r.name,
      time_in: formatTime(r.time_in)
    }));

    res.json(formatted);
  });
});

/* =========================
   ADMIN - FULL HISTORY
========================= */
app.get("/admin/history", (req, res) => {
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

    const formatted = results.map((row) => ({
      id: row.id,
      name: row.name,
      work_date: formatDate(row.work_date),
      time_in: formatTime(row.time_in),
      time_out: formatTime(row.time_out)
    }));

    res.json(formatted);
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});