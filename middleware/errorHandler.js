// Runs when no route matches (404)
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// Runs when any route throws an error
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || err.statusCode || 500;

  // Never leak internal details of server errors in production
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };

