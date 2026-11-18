const express = require("express");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Returns the verified user (read from the database)
router.get("/me", verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;