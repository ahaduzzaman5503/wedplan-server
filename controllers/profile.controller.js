const { getDB } = require("../config/db");
const { validateProfileInput } = require("../utils/profileValidator");

// PATCH /api/profile  (any logged-in, non-blocked user)
async function updateProfile(req, res, next) {
  try {
    const { data, errors, isValid } = validateProfileInput(
      req.body,
      req.user.role
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors,
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // The user id comes from the verified token, never from the request
    await getDB()
      .collection("user")
      .updateOne(
        { _id: req.user._id },
        { $set: { ...data, updatedAt: new Date() } }
      );

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = { updateProfile };

