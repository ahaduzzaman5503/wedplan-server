require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "WedPlan server is running" });
});

// Future routes will be added here

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