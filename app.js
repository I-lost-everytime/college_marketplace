const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
require("dotenv").config();
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
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Routes
app.use("/", authRouter);
app.use("/books", booksRouter);
app.use("/messages", messagesRouter);

app.listen(3000, () => console.log("Server started on http://localhost:3000"));
