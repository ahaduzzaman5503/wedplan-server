const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/admin", verifyToken, requireRole("admin"), (req, res) => {
  res.json({ success: true, message: "Hello admin" });
});

router.get("/vendor", verifyToken, requireRole("vendor"), (req, res) => {
  res.json({ success: true, message: "Hello vendor" });
});

router.get("/customer", verifyToken, requireRole("customer"), (req, res) => {
  res.json({ success: true, message: "Hello customer" });
});

module.exports = router;
