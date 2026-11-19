const { getStripe } = require("../config/stripe");
const { PREMIUM_PLAN } = require("../config/constants");
const { isPremium } = require("../utils/subscription");

// POST /api/payments/create-checkout-session  (vendor only)
async function createCheckoutSession(req, res, next) {
  try {
    // Already premium? Do not charge twice.
    if (isPremium(req.user)) {
      return res.status(409).json({
        success: false,
        message: "You already have an active Premium plan",
      });
    }

    const stripe = getStripe();
    const clientUrl = process.env.CLIENT_URL.replace(/\/$/, "");

    // The vendor comes from the verified token, never from the request body
    const vendorId = req.user.id;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PREMIUM_PLAN.currency,
            unit_amount: PREMIUM_PLAN.priceCents,
            recurring: { interval: PREMIUM_PLAN.interval },
            product_data: {
              name: PREMIUM_PLAN.name,
              description: PREMIUM_PLAN.description,
            },
          },
        },
      ],
      customer_email: req.user.email,
      client_reference_id: vendorId,
      // The webhook reads these to know WHO paid
      metadata: { vendorId, plan: "premium" },
      subscription_data: { metadata: { vendorId, plan: "premium" } },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    if (error?.type && String(error.type).startsWith("Stripe")) {
      // Log the real reason on the server, but do not expose it to the browser
      console.error("Stripe error:", error.type, error.message);
      return res.status(502).json({
        success: false,
        message: "Could not start the payment. Please try again later.",
      });
    }
    next(error);
  }
}

module.exports = { createCheckoutSession };

