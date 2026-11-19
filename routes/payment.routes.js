const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createCheckoutSession } = require("../controllers/payment.controller");

const router = express.Router();

router.post(
  "/create-checkout-session",
  verifyToken,
  requireRole("vendor"),
  createCheckoutSession
);

module.exports = router;

