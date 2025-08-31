// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mailer = require("./mailer.js");
const sendOTP = mailer.sendOTP;

// ================= PASSPORT CONFIG =================
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];

      if (!user) return done(null, false, { message: "No user found" });
      if (!user.is_verified) return done(null, false, { message: "Please verify your email first" });

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

/// verify otp
router.get("/verify-otp", (req, res) => {
  const { email } = req.query;
  res.render("verify_otp", { email, error: null });
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      "INSERT INTO users (name, email, password, is_verified, otp_code, otp_expires) VALUES ($1, $2, $3, $4, $5, $6)",
      [name, email, hashedPassword, false, otp, otpExpires]
    );

    await sendOTP(email, otp);

res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Register error:", err);
    res.render("register", { error: "Registration failed. Try again." });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) return res.render("verify_otp", { email, error: "User not found" });
    if (user.is_verified) return res.redirect("/login");

    if (user.otp_code !== otp || new Date() > user.otp_expires) {
      return res.render("verify_otp", { email, error: "Invalid or expired OTP" });
    }

    await db.query(
      "UPDATE users SET is_verified = true, otp_code = NULL, otp_expires = NULL WHERE email = $1",
      [email]
    );

    res.redirect("/login");
  } catch (err) {
    console.error("OTP verify error:", err);
    res.render("verify_otp", { email, error: "Verification failed" });
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
