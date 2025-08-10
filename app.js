const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const http = require("http");
const { Server } = require("socket.io");
const db = require("./db");

const { router: authRouter, ensureAuth } = require("./routes/auth");
const booksRouter = require("./routes/books");
const messagesRouter = require("./routes/messages");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
          [name, email, "0"]
        );
        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err);
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
    done(err);
  }
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      photo: req.user.photo || req.user.photos?.[0]?.value || null
    };
    res.redirect("/menu");
  }
);

// ======== MENU ROUTE ========
app.get("/menu", ensureAuth, async (req, res) => {
  const search = req.query.search || "";
  const category = req.query.category || "";

  try {
    let query = `
      SELECT books.*, users.name AS seller, books.user_id
      FROM books
      JOIN users ON books.user_id = users.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (LOWER(books.title) LIKE LOWER($${paramCount}) 
                     OR LOWER(books.author) LIKE LOWER($${paramCount})
                     OR LOWER(books.description) LIKE LOWER($${paramCount}))`;
      params.push(`%${search}%`);
    }

    if (category && category !== "all") {
      paramCount++;
      query += ` AND books.category = $${paramCount}`;
      params.push(category);
    }

    const result = await db.query(query, params);

    res.render("menu", {
      books: result.rows,
      user: req.session.user,
      search: search,
      category: category,
    });
  } catch (err) {
    console.error("Menu route error:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const user = req.user;

  try {
    const listedBooksResult = await db.query("SELECT * FROM books WHERE user_id = $1", [user.id]);
    const listedBooks = listedBooksResult.rows;

    res.render("profile", {
      user: {
        name: user.name,
        email: user.email,
        photo: user.photo,
        id: user.id,
      },
      listedBooks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  // Listen for room join from client and join socket room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Listen for chat messages from client
  socket.on("chatMessage", async (messageData) => {
    try {
      // First, save the message to database (using your exact table structure)
      const result = await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, item_id) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          messageData.sender_id,
          messageData.receiver_id,
          messageData.content,
          messageData.item_id || null  // item_id can be null for general chat
        ]
      );

      const savedMessage = result.rows[0];
      
      // Broadcast the saved message to everyone in the room (including sender for confirmation)
      io.to(messageData.roomId).emit("message", {
        id: savedMessage.id,
        sender_id: savedMessage.sender_id,
        receiver_id: savedMessage.receiver_id,
        content: savedMessage.content,
        created_at: savedMessage.created_at,
        timestamp: savedMessage.timestamp,
        item_id: savedMessage.item_id
      });

      // console.log("Message saved and broadcasted:", savedMessage);
      
    } catch (error) {
      console.error("Error saving message:", error);
      
      // Send error back to sender
      socket.emit("messageError", {
        error: "Failed to save message",
        originalMessage: messageData
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});
// Use routers
app.use("/", authRouter);
app.use("/books", booksRouter);
app.use("/messages", messagesRouter);

// Start server with Socket.IO
server.listen(3000, () => console.log("🚀 Server + Socket.IO running on http://localhost:3000"));
