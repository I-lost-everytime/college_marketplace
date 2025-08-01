const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");

// Redirect root to login
router.get("/", (req, res) => {
  res.redirect("/login");
});

// ========== REGISTER ==========

// Render Register Page
router.get("/register", (req, res) => {
  res.render("register", { error: null });
});

// Register User
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render("register", { error: "All fields are required" });
  }

  try {
    const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userCheck.rows.length > 0) {
      return res.render("register", { error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );

    res.redirect("/login");
  } catch (err) {
    console.error("Register error:", err);
    res.render("register", { error: "Registration failed. Try again." });
  }
});

// ========== LOGIN ==========

// Render Login Page
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Login User
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("login", { error: "All fields are required" });
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.render("login", { error: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login", { error: "Incorrect password" });
    }

    // Set session
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/books/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Login failed. Try again." });
  }
});

// ========== LOGOUT ==========
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ========== AUTH MIDDLEWARE ==========
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
}

module.exports = {
  router,
  ensureAuth
};
