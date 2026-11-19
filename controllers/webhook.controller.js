const { getDB } = require("../config/db");
const { getStripe } = require("../config/stripe");
const { toObjectId } = require("../utils/objectId");

// Stripe sometimes gives an id string, sometimes the full object
function getId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

// Newer Stripe API versions keep the period end on the subscription item
function getPeriodEnd(subscription) {
  const ends = (subscription.items?.data || [])
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));
  const seconds =
    ends.length > 0 ? Math.max(...ends) : subscription.current_period_end;
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
}

function getInvoiceSubscriptionId(invoice) {
  return (
    getId(invoice.parent?.subscription_details?.subscription) ||
    getId(invoice.subscription)
  );
}

// Saves a transaction once. A repeated webhook with the same filter does nothing.
async function recordTransaction(filter, doc) {
  await getDB()
    .collection("transactions")
    .updateOne(filter, { $setOnInsert: doc }, { upsert: true });
}

// Makes the vendor's plan match the subscription status in Stripe
async function syncSubscription(subscription) {
  const vendorId = toObjectId(subscription.metadata?.vendorId);
  if (!vendorId) {
    console.warn("Subscription has no valid vendorId:", subscription.id);
    return;
  }

  const users = getDB().collection("user");

  if (["active", "trialing"].includes(subscription.status)) {
    await users.updateOne(
      { _id: vendorId, role: "vendor" },
      {
        $set: {
          subscriptionPlan: "premium",
          subscriptionExpiresAt: getPeriodEnd(subscription),
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date(),
        },
      }
    );
    return;
  }

  if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
    // Only downgrade if this is the vendor's current subscription
    await users.updateOne(
      {
        _id: vendorId,
        role: "vendor",
        $or: [
          { stripeSubscriptionId: subscription.id },
          { stripeSubscriptionId: { $exists: false } },
        ],
      },
      {
        $set: {
          subscriptionPlan: "free",
          subscriptionExpiresAt: null,
          updatedAt: new Date(),
        },
      }
    );
  }
  // Other statuses (past_due, incomplete, paused): no change
}

// First payment: checkout.session.completed
async function handleCheckoutCompleted(session) {
  if (session.mode !== "subscription") return;

  if (session.payment_status !== "paid") {
    console.log("Checkout session is not paid yet:", session.id);
    return;
  }

  const vendorId = toObjectId(session.metadata?.vendorId);
  const subscriptionId = getId(session.subscription);
  if (!vendorId || !subscriptionId) {
    console.warn("Checkout session is missing vendorId or subscription:", session.id);
    return;
  }

  const vendor = await getDB()
    .collection("user")
    .findOne({ _id: vendorId, role: "vendor" });
  if (!vendor) {
    console.warn("Vendor not found for checkout session:", session.id);
    return;
  }

  await recordTransaction(
    { stripeSessionId: session.id },
    {
      vendorId,
      plan: "premium",
      amount: session.amount_total,
      currency: session.currency,
      stripeSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      status: "paid",
      createdAt: new Date(),
    }
  );

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription);
}

// Monthly renewal that was paid
async function handleInvoicePaid(invoice) {
  // The first payment is already handled by checkout.session.completed
  if (invoice.billing_reason !== "subscription_cycle") return;

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const vendorId = toObjectId(subscription.metadata?.vendorId);
  if (!vendorId) return;

  await recordTransaction(
    { stripeInvoiceId: invoice.id, status: "paid" },
    {
      vendorId,
      plan: "premium",
      amount: invoice.amount_paid,
      currency: invoice.currency,
      stripeSessionId: null,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      status: "paid",
      createdAt: new Date(),
    }
  );

  await syncSubscription(subscription);
}

// Monthly renewal that failed (Premium is not changed here)
async function handleInvoiceFailed(invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return;

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const vendorId = toObjectId(subscription.metadata?.vendorId);
  if (!vendorId) return;

  await recordTransaction(
    { stripeInvoiceId: invoice.id, status: "failed" },
    {
      vendorId,
      plan: "premium",
      amount: invoice.amount_due,
      currency: invoice.currency,
      stripeSessionId: null,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      status: "failed",
      createdAt: new Date(),
    }
  );
}

// POST /api/webhooks/stripe  (called by Stripe, NOT by the browser)
async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).send("Webhook is not configured");
  }

  // 1. Verify that the request really comes from Stripe
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send("Invalid signature");
  }

  // 2. Handle the verified event
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break; // events we do not use are ignored
    }

    console.log(`Stripe event handled: ${event.type} (${event.id})`);
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler failed:", event.type, error);
    // A 500 tells Stripe to try again later
    res.status(500).send("Webhook handler failed");
  }
}

module.exports = { handleStripeWebhook };

