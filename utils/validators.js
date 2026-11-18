const { SERVICE_CATEGORIES } = require("../config/constants");

function isValidImageUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "ibb.co" || url.hostname.endsWith(".ibb.co"))
    );
  } catch {
    return false;
  }
}

// partial = true: only validate the fields that were sent (used for updates)
function validateServiceInput(body = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const shouldCheck = (key) => !partial || body[key] !== undefined;

  if (shouldCheck("serviceName")) {
    const value = typeof body.serviceName === "string" ? body.serviceName.trim() : "";
    if (value.length < 3 || value.length > 100) {
      errors.serviceName = "Service name must be 3 to 100 characters";
    } else {
      data.serviceName = value;
    }
  }

  if (shouldCheck("category")) {
    if (!SERVICE_CATEGORIES.includes(body.category)) {
      errors.category = "Please choose a valid category";
    } else {
      data.category = body.category;
    }
  }

  if (shouldCheck("description")) {
    const value = typeof body.description === "string" ? body.description.trim() : "";
    if (value.length < 10 || value.length > 2000) {
      errors.description = "Description must be 10 to 2000 characters";
    } else {
      data.description = value;
    }
  }

  if (shouldCheck("price")) {
    const value = Number(body.price);
    if (!Number.isFinite(value) || value <= 0 || value > 10000000) {
      errors.price = "Price must be a number greater than 0";
    } else {
      data.price = value;
    }
  }

  if (shouldCheck("location")) {
    const value = typeof body.location === "string" ? body.location.trim() : "";
    if (value.length < 2 || value.length > 100) {
      errors.location = "Location must be 2 to 100 characters";
    } else {
      data.location = value;
    }
  }

  if (shouldCheck("images")) {
    const images = body.images;
    if (
      !Array.isArray(images) ||
      images.length < 1 ||
      images.length > 5 ||
      !images.every(isValidImageUrl)
    ) {
      errors.images = "Add 1 to 5 images uploaded through ImgBB";
    } else {
      data.images = images;
    }
  }

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { validateServiceInput };
