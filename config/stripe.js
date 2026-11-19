const Stripe = require("stripe");

let stripe;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error("Payments are not configured on the server");
    error.status = 500;
    throw error;
  }
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

module.exports = { getStripe };

