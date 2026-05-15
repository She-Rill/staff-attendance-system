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
   PIN SYSTEM
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
   FORMAT TIME
========================= */
function formatTime(dateValue) {

  if (!dateValue) return null;

  return new Date(dateValue).toLocaleTimeString("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

}

/* =========================
   FORMAT DATE
========================= */
function formatDate(dateValue) {

  if (!dateValue) return null;

  return new Date(dateValue).toLocaleDateString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

}

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

  res.json({
    success: true
  });

});

/* =========================
   ATTENDANCE HISTORY
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

      return res.status(500).json({
        message: "Database error"
      });
    }

    const formatted = results.map((row) => ({
      id: row.id,
      name: row.name,
      work_date: formatDate(row.work_date),
      time_in: formatTime(row.time_in),
      time_out: row.time_out
        ? formatTime(row.time_out)
        : null
    }));

    res.json(formatted);

  });

});

/* =========================
   CLOCK IN
========================= */
app.post("/clock-in", (req, res) => {

  const { name, pin } = req.body || {};

  /* VALIDATION */
  if (!name || !pin) {

    return res.status(400).json({
      message: "Name and PIN are required"
    });

  }

  /* INVALID PIN */
  if (staffPins[name] !== pin) {

    return res.status(401).json({
      message: "Invalid PIN"
    });

  }

  /* CHECK IF ALREADY CLOCKED IN */
  const checkQuery = `
    SELECT *
    FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(checkQuery, [name], (checkErr, checkResults) => {

    if (checkErr) {

      console.log(checkErr);

      return res.status(500).json({
        message: "Database error"
      });

    }

    /* PREVENT MULTIPLE CLOCK-INS */
    if (checkResults.length > 0) {

      return res.status(400).json({
        message: "You are already clocked in"
      });

    }

    /* INSERT CLOCK-IN */
    const insertQuery = `
      INSERT INTO attendance (name, work_date, time_in)
      VALUES (?, CURDATE(), NOW())
    `;

    db.query(insertQuery, [name], (insertErr) => {

      if (insertErr) {

        console.log(insertErr);

        return res.status(500).json({
          message: "Clock-in failed"
        });

      }

      res.json({
        message: "Clocked in successfully"
      });

    });

  });

});

/* =========================
   CLOCK OUT
========================= */
app.post("/clock-out", (req, res) => {

  const { name, pin } = req.body || {};

  /* VALIDATION */
  if (!name || !pin) {

    return res.status(400).json({
      message: "Name and PIN are required"
    });

  }

  /* INVALID PIN */
  if (staffPins[name] !== pin) {

    return res.status(401).json({
      message: "Invalid PIN"
    });

  }

  /* CHECK ACTIVE CLOCK-IN */
  const checkQuery = `
    SELECT *
    FROM attendance
    WHERE name = ?
    AND work_date = CURDATE()
    AND time_out IS NULL
  `;

  db.query(checkQuery, [name], (checkErr, checkResults) => {

    if (checkErr) {

      console.log(checkErr);

      return res.status(500).json({
        message: "Database error"
      });

    }

    /* NO ACTIVE SESSION */
    if (checkResults.length === 0) {

      return res.status(400).json({
        message: "No active clock-in found"
      });

    }

    /* UPDATE CLOCK-OUT */
    const updateQuery = `
      UPDATE attendance
      SET time_out = NOW()
      WHERE id = ?
    `;

    db.query(updateQuery, [checkResults[0].id], (updateErr) => {

      if (updateErr) {

        console.log(updateErr);

        return res.status(500).json({
          message: "Clock-out failed"
        });

      }

      res.json({
        message: "Clocked out successfully"
      });

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