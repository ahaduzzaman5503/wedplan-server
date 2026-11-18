const { ObjectId } = require("mongodb");

// Returns an ObjectId, or null if the text is not a valid 24-character id
function toObjectId(value) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value)) {
    return null;
  }
  return new ObjectId(value);
}

module.exports = { toObjectId };