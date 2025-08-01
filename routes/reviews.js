const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

// Submit a review
router.post("/:bookId", requireAuth, async (req, res) => {
  const { bookId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.session.user.id;

  try {
    await db.query(
      "INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1, $2, $3, $4)",
      [userId, bookId, rating, comment]
    );
    res.redirect(`/books/${bookId}`);
  } catch (err) {
    console.error("Error adding review:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
