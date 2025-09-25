const express = require("express");
const session = require("express-session");
const flashMiddleware = require("./routes/flash");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
require("dotenv").config();
const passport = require("passport");
const http = require("http");
const { Server } = require("socket.io");
const db = require("./db");

const { router: authRouter, ensureAuth } = require("./routes/auth");
const booksRouter = require("./routes/books");
const messagesRouter = require("./routes/messages");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== Middleware =====
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");

// ===== Session =====
app.use(
  session({
    store: new pgSession({ pool: pool }),
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ===== Flash Middleware =====
app.use(flashMiddleware);

// No need for connect-flash style locals.
// Instead, just expose all flash messages via res.locals
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  next();
});

// ===== MENU ROUTE (Protected) =====
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
    const user = req.user || req.session.user;

    res.render("menu", {
      books: result.rows,
      user,
      search,
      category,
    });
  } catch (err) {
    console.error("Menu route error:", err);
    res.status(500).send("Server Error");
  }
});

// ===== PROFILE ROUTE (Protected) =====
app.get("/profile", ensureAuth, async (req, res) => {
  const user = req.user || req.session.user;

  try {
    const listedBooksResult = await db.query(
      "SELECT * FROM books WHERE user_id = $1",
      [user.id]
    );
    const listedBooks = listedBooksResult.rows;

    res.render("profile", {
      user: {
        name: user.name,
        email: user.email,
        id: user.id,
      },
      listedBooks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ===== Socket.IO =====
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("chatMessage", async (messageData) => {
    try {
      const result = await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, item_id) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          messageData.sender_id,
          messageData.receiver_id,
          messageData.content,
          messageData.item_id || null,
        ]
      );

      const savedMessage = result.rows[0];

      io.to(messageData.roomId).emit("message", {
        id: savedMessage.id,
        sender_id: savedMessage.sender_id,
        receiver_id: savedMessage.receiver_id,
        content: savedMessage.content,
        created_at: savedMessage.created_at,
        timestamp: savedMessage.timestamp,
        item_id: savedMessage.item_id,
      });
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("messageError", {
        error: "Failed to save message",
        originalMessage: messageData,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

// ===== Routers =====
app.use("/", authRouter);
app.use("/books", ensureAuth, booksRouter);
app.use("/messages", ensureAuth, messagesRouter);

// ===== Server =====
server.listen(3000, () =>
  console.log("🚀 Server + Socket.IO running on http://localhost:3000")
);
