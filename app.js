const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./db");

const { router: authRouter, ensureAuth } = require("./routes/auth");
const booksRouter = require("./routes/books");
const messagesRouter = require("./routes/messages");

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

// Session
app.use(
  session({
    store: new pgSession({ pool: db }),
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ========== GOOGLE OAUTH STRATEGY ==========
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      const name = profile.displayName;

      // Restrict to college domain
      if (!email.endsWith("@nith.ac.in")) {
        return done(null, false, { message: "Only @nith.ac.in emails allowed" });
      }

      try {
        const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
          return done(null, existingUser.rows[0]);
        }

        const newUser = await db.query(
          "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
          [name, email, "0"] // Password default is "0"
        );
        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Session user handling
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});


app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Set session manually
    req.session.user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    };

    res.redirect("/books/dashboard");
  }
);


// Routes
app.use("/", authRouter);
app.use("/books", booksRouter);
app.use("/messages", messagesRouter);

app.listen(3000, () => console.log(" Server started on http://localhost:3000"));
