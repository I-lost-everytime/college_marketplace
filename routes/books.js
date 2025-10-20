const express = require("express");
const router = express.Router();
const db = require("../db");

// Middleware to protect routes
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log("✅ User authenticated via Passport:", req.user);
    req.session.user = req.user; // Always sync with session
    return next();
  }
  if (req.session && req.session.user) {
    console.log("✅ User authenticated via Session:", req.session.user);
    return next();
  }
  console.log("❌ User not authenticated, redirecting...");
  res.redirect("/login");
}

// Dashboard: Show all books
router.get("/dashboard", ensureAuth, async (req, res) => {
  const search = req.query.search || "";
  try {
    const result = await db.query(
      `
      SELECT books.*, users.name AS seller, users.id AS user_id
      FROM books
      JOIN users ON books.user_id = users.id
      WHERE LOWER(books.title) LIKE LOWER($1) OR LOWER(books.author) LIKE LOWER($1)
      ORDER BY books.id DESC
      `,
      [`%${search}%`]
    );
    res.render("dashboard", {
      books: result.rows,
      user: req.session.user,
      search
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading books");
  }
});

// Render Add Book Form
router.get("/add", ensureAuth, (req, res) => {
  res.render("addBook", { user: req.session.user });
});

// Handle Add Book POST
router.post("/add", ensureAuth, async (req, res) => {
  const {
    title,
    author,
    description,
    price,
    image_url,
    tags,
    category,
    rent_per_day,
    brand,
    size,
    art_by,
    wingman
  } = req.body;

  try {
    await db.query(
      `INSERT INTO books
        (title, author, description, price, image_url, user_id, tags, category, rent_per_day, brand, size, art_by, wingman)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        title,
        author,
        description,
        price,
        image_url,
        req.session.user.id,
        tags ? tags.split(',').map(tag => tag.trim()) : null,
        category,
        rent_per_day || null,
        brand,
        size,
        art_by,
        wingman
      ]
    );

    res.redirect("/menu");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding book");
  }
});

// Delete Book
router.post("/delete/:id", ensureAuth, async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = result.rows[0];

    if (!book || book.user_id !== req.session.user.id) {
      return res.status(403).send("Unauthorized");
    }

    await db.query("DELETE FROM books WHERE id = $1", [bookId]);
    res.redirect("/menu");
  } catch (err) {
    console.error(err);
    res.send("Error deleting book");
  }
});

// Render Edit Form
router.get("/edit/:id", ensureAuth, async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = result.rows[0];

    if (!book || book.user_id !== req.session.user.id) {
      return res.status(403).send("Unauthorized");
    }

    res.render("editBook", { book, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.send("Error loading book for editing");
  }
});

// Handle Edit Form POST
router.post("/edit/:id", ensureAuth, async (req, res) => {
  const bookId = req.params.id;
  const { title, author, description, price, image_url, category } = req.body;

  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = result.rows[0];

    if (!book || book.user_id !== req.session.user.id) {
      return res.status(403).send("Unauthorized");
    }

    await db.query(
      "UPDATE books SET title=$1, author=$2, description=$3, price=$4, image_url=$5, category=$6 WHERE id=$7",
      [title, author, description, price, image_url, category, bookId]
    );

    res.redirect("/menu"); // keeping your redirect
  } catch (err) {
    console.error(err);
    res.send("Error updating book");
  }
});


module.exports = router;
