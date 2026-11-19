const { isValidImageUrl } = require("./validators");

// Only these fields can ever be changed through the profile endpoint.
// role, isBlocked, subscriptionPlan, subscriptionExpiresAt and email are NOT here.
function validateProfileInput(body = {}, role) {
  const errors = {};
  const data = {};

  if (body.name !== undefined) {
    const value = typeof body.name === "string" ? body.name.trim() : "";
    if (value.length < 2 || value.length > 60) {
      errors.name = "Name must be 2 to 60 characters";
    } else {
      data.name = value;
    }
  }

  // image: an ImgBB link, or null to remove the photo
  if (body.image !== undefined) {
    if (body.image === null) {
      data.image = null;
    } else if (isValidImageUrl(body.image)) {
      data.image = body.image;
    } else {
      errors.image = "Profile image must be uploaded through ImgBB";
    }
  }

  // businessName is only for vendors
  if (role === "vendor" && body.businessName !== undefined) {
    const value =
      typeof body.businessName === "string" ? body.businessName.trim() : "";
    if (value.length < 2 || value.length > 100) {
      errors.businessName = "Business name must be 2 to 100 characters";
    } else {
      data.businessName = value;
    }
  }

  if (body.phone !== undefined) {
    const value = typeof body.phone === "string" ? body.phone.trim() : "";
    if (value === "") {
      data.phone = null;
    } else if (!/^[+0-9()\-\s]{7,20}$/.test(value)) {
      errors.phone = "Enter a valid phone number";
    } else {
      data.phone = value;
    }
  }

  if (body.address !== undefined) {
    const value = typeof body.address === "string" ? body.address.trim() : "";
    if (value.length > 200) {
      errors.address = "Address must be 200 characters or less";
    } else {
      data.address = value || null;
    }
  }

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateProfileInput };

