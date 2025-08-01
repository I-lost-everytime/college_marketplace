const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure user is authenticated
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

// View all chat threads (users the current user has messaged)
router.get("/", ensureAuth, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const result = await db.query(
      `
      SELECT DISTINCT
        CASE
          WHEN sender_id = $1 THEN receiver_id
          ELSE sender_id
        END AS user_id,
        u.name
      FROM messages
      JOIN users u ON u.id = CASE
                              WHEN sender_id = $1 THEN receiver_id
                              ELSE sender_id
                            END
      WHERE sender_id = $1 OR receiver_id = $1
      `,
      [userId]
    );

    res.render("messages/inbox", {
      users: result.rows,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).send("Error loading messages");
  }
});

/// View chat with a specific user
router.get("/:userId", ensureAuth, async (req, res) => {
  const myId = req.session.user.id;
  const userId = parseInt(req.params.userId);

  try {
    const messages = await db.query(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at`,
      [myId, userId]
    );

    const userResult = await db.query("SELECT id, name FROM users WHERE id = $1", [userId]);
    const chatPartner = userResult.rows[0];

    res.render("messages/chat", {
      user: req.session.user,
      messages: messages.rows,
      chatPartner,
      userId: chatPartner.id, // Now userId is defined for the form
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.sendStatus(500);
  }
});


// Send message
router.post("/:userId", ensureAuth, async (req, res) => {
  const senderId = req.session.user.id;
  const receiverId = parseInt(req.params.userId);
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.redirect(`/messages/${receiverId}`);
  }

  try {
    await db.query(
      `
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES ($1, $2, $3)
      `,
      [senderId, receiverId, content.trim()]
    );
    res.redirect(`/messages/${receiverId}`);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).send("Message sending failed");
  }
});

module.exports = router;
