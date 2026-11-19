const BOOKING_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// One day before today in UTC: safe for every time zone
function getMinEventDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getMaxEventDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 5);
  return date.toISOString().slice(0, 10);
}

function validateBookingInput(body = {}) {
  const errors = {};
  const data = {};

  if (!isValidDateString(body.eventDate)) {
    errors.eventDate = "Please choose a valid event date";
  } else if (body.eventDate < getMinEventDate()) {
    errors.eventDate = "Event date cannot be in the past";
  } else if (body.eventDate > getMaxEventDate()) {
    errors.eventDate = "Event date is too far in the future";
  } else {
    data.eventDate = body.eventDate;
  }

  const location =
    typeof body.eventLocation === "string" ? body.eventLocation.trim() : "";
  if (location.length < 2 || location.length > 200) {
    errors.eventLocation = "Event location must be 2 to 200 characters";
  } else {
    data.eventLocation = location;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length > 1000) {
    errors.message = "Message must be 1000 characters or less";
  } else {
    data.message = message; // optional, may be empty
  }

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

module.exports = { BOOKING_STATUSES, validateBookingInput };

