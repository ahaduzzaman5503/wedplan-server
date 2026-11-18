const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  createService,
  getMyServices,
  updateService,
  setAvailability,
  deleteService,
} = require("../controllers/service.controller");
const {
  listServices,
  getServiceLocations,
  getServiceById,
} = require("../controllers/publicService.controller");

const router = express.Router();

// Public routes
router.get("/", listServices);
router.get("/locations", getServiceLocations);

// Vendor routes
router.post("/", verifyToken, requireRole("vendor"), createService);
router.get("/mine", verifyToken, requireRole("vendor"), getMyServices);

// IMPORTANT: every route with "/:id" must stay BELOW "/locations" and "/mine"
router.get("/:id", getServiceById);
router.patch("/:id/availability", verifyToken, requireRole("vendor"), setAvailability);
router.patch("/:id", verifyToken, requireRole("vendor"), updateService);
router.delete("/:id", verifyToken, requireRole("vendor"), deleteService);

module.exports = router;
