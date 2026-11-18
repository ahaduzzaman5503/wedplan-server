const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  listAllServices,
  updateServiceStatus,
  deleteServiceByAdmin,
} = require("../controllers/adminService.controller");

const router = express.Router();

// Everything below this line needs a valid token AND the admin role
router.use(verifyToken, requireRole("admin"));

router.get("/services", listAllServices);
router.patch("/services/:id/status", updateServiceStatus);
router.delete("/services/:id", deleteServiceByAdmin);

module.exports = router;