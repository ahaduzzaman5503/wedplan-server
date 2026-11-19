const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  listAllServices,
  updateServiceStatus,
  deleteServiceByAdmin,
} = require("../controllers/adminService.controller");
const {
  listUsers,
  getUserDetails,
  setUserBlocked,
} = require("../controllers/adminUser.controller");
const {
  getStats,
  listTransactions,
} = require("../controllers/adminStats.controller");

const router = express.Router();

// Everything below this line needs a valid token AND the admin role
router.use(verifyToken, requireRole("admin"));

router.get("/stats", getStats);

// Users
router.get("/users", listUsers);
router.get("/users/:id", getUserDetails);
router.patch("/users/:id/block", setUserBlocked);

// Services
router.get("/services", listAllServices);
router.patch("/services/:id/status", updateServiceStatus);
router.delete("/services/:id", deleteServiceByAdmin);

// Transactions: read-only. There is intentionally no POST, PATCH or DELETE here.
router.get("/transactions", listTransactions);

module.exports = router;

