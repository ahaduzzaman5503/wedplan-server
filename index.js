require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { handleStripeWebhook } = require("./controllers/webhook.controller");
const userRoutes = require("./routes/user.routes");
const serviceRoutes = require("./routes/service.routes");
const bookingRoutes = require("./routes/booking.routes");
const profileRoutes = require("./routes/profile.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminRoutes = require("./routes/admin.routes");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Stripe webhook: needs the RAW body, so it must come BEFORE express.json()
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "WedPlan server is running" });
});

// Routes
app.use("/api", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use(helmet());
app.use(express.json());
app.use(express.json({ limit: "100kb" }));


// Error handlers (must stay at the bottom, after all routes)
app.use(notFound);
app.use(errorHandler);

// Connect to the database first, then start the server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  });

