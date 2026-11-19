const SERVICE_CATEGORIES = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
];

const SERVICE_STATUSES = ["pending", "approved", "rejected"];

const FREE_PLAN_ACTIVE_LIMIT = 3;

const PREMIUM_PLAN = {
  name: "WedPlan Premium",
  description:
    "Unlimited active services, Premium vendor badge and promotional benefits",
  priceCents: 999, // $9.99
  currency: "usd",
  interval: "month",
};

module.exports = {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  FREE_PLAN_ACTIVE_LIMIT,
  PREMIUM_PLAN,
};

