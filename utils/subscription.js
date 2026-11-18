// A vendor is premium only if the plan is "premium" AND it has not expired
function isPremium(user) {
  if (!user || user.subscriptionPlan !== "premium") return false;
  if (!user.subscriptionExpiresAt) return true;
  return new Date(user.subscriptionExpiresAt) > new Date();
}

module.exports = { isPremium };