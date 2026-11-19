const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { updateProfile } = require("../controllers/profile.controller");

const router = express.Router();

router.patch("/", verifyToken, updateProfile);

module.exports = router;

