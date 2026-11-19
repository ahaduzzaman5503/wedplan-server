const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  createBooking,
  getMyBookings,
  getVendorBookings,
  updateBookingStatus,
  cancelBooking,
} = require("../controllers/booking.controller");

const router = express.Router();

// Customer
router.post("/", verifyToken, requireRole("customer"), createBooking);
router.get("/mine", verifyToken, requireRole("customer"), getMyBookings);
router.patch("/:id/cancel", verifyToken, requireRole("customer"), cancelBooking);

// Vendor
router.get("/vendor", verifyToken, requireRole("vendor"), getVendorBookings);
router.patch("/:id/status", verifyToken, requireRole("vendor"), updateBookingStatus);

module.exports = router;

