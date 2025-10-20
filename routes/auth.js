// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

// ================= PASSPORT CONFIG =================
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];

      if (!user) return done(null, false, { message: "No user found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: "Invalid password" });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ================= HOME REDIRECT =================
router.get("/", (req, res) => {
  res.redirect("/login");
});

// ================= REGISTER =================
router.get("/register", (req, res) => {
  res.render("register", { error: null });
});

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
      "INSERT INTO users (name, email, password, is_verified) VALUES ($1, $2, $3, $4)",
      [name, email, hashedPassword, true] // Mark as verified by default
    );

    res.redirect("/login");
  } catch (err) {
    console.error("Register error:", err);
    res.render("register", { error: "Registration failed. Try again." });
  }
});

// ================= LOGIN =================
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/menu",
    failureRedirect: "/login",
    failureFlash: true,
    successFlash: "Welcome back!"
  })
);

// ================= LOGOUT =================
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});

// ================= PROTECT ROUTES =================
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
}

module.exports = { router, ensureAuth };
