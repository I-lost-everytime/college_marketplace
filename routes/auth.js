const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");

const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");

// ====== GOOGLE STRATEGY SETUP ======

passport.use(
  new GoogleStrategy(
    {
      clientID: "784218402045-287ldcu2bse9rs71jd99svfoelmdi7j6.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "https://college-marketplace-qe59.onrender.com/auth/google/callback",

    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const photo = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

        console.log("Google Profile:", profile);

        // ✅ TEMP: Allow all emails for now — uncomment to restrict later
        // if (!email.endsWith("@nith.ac.in")) {
        //   console.log("Blocked non-NITH email:", email);
        //   return done(null, false);
        // }

        // Check if user already exists
        let user = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (user.rows.length === 0) {
          // Insert new user with Google profile photo
          const insert = await db.query(
            "INSERT INTO users (name, email, password, profile_pic) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email, "google-login(32.11n76.48e)", photo]
          );
          user = insert;
        } else {
          // Update photo if changed
          if (photo && user.rows[0].profile_pic !== photo) {
            await db.query("UPDATE users SET profile_pic = $1 WHERE id = $2", [photo, user.rows[0].id]);
            user.rows[0].profile_pic = photo;
          }
        }

        return done(null, user.rows[0]);
      } catch (err) {
        console.error("Google auth error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ====== MIDDLEWARE SETUP ======

router.use(passport.initialize());
router.use(passport.session());

// ====== ROUTES ======

// Home redirect
router.get("/", (req, res) => {
  res.redirect("/login");
});

// REGISTER
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
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );

    res.redirect("/login");
  } catch (err) {
    console.error("Register error:", err);
    res.render("register", { error: "Registration failed. Try again." });
  }
});

// LOGIN
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

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

    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/menu");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Login failed. Try again." });
  }
});

// ====== GOOGLE AUTH ROUTES ======

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    console.log("✅ Google login successful for:", req.user.email);

    // Manually set session for your session-based system
    req.session.user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    };

    res.redirect("/menu");
  }
);

// ====== LOGOUT ======

router.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });
});

// ====== PROTECT ROUTES ======

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect("/login");
}

module.exports = {
  router,
  ensureAuth,
};
