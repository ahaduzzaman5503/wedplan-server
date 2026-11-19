const { getDB } = require("../config/db");
const { toObjectId } = require("../utils/objectId");
const { getString, escapeRegex, getPagination } = require("../utils/query");

const ROLES = ["admin", "vendor", "customer"];
const SERVICE_STATUSES = ["pending", "approved", "rejected"];
const BOOKING_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function formatUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image || null,
    role: user.role || "customer",
    isBlocked: Boolean(user.isBlocked),
    businessName: user.businessName || null,
    phone: user.phone || null,
    address: user.address || null,
    subscriptionPlan: user.subscriptionPlan || "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    createdAt: user.createdAt,
  };
}

// Turns [{_id: "pending", count: 2}, ...] into { total, pending: 2, ... }
function toCounts(rows, keys) {
  const counts = { total: 0 };
  keys.forEach((key) => {
    counts[key] = 0;
  });
  rows.forEach((row) => {
    if (keys.includes(row._id)) counts[row._id] = row.count;
    counts.total += row.count;
  });
  return counts;
}

// GET /api/admin/users
async function listUsers(req, res, next) {
  try {
    const search = getString(req.query.search);
    const role = getString(req.query.role);

    if (role && !ROLES.includes(role)) {
      return fail(res, 400, "Invalid role");
    }

    const { page, limit } = getPagination(req.query);

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const users = getDB().collection("user");

    const [items, total, roleRows] = await Promise.all([
      users
        .find(filter)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      users.countDocuments(filter),
      users.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]).toArray(),
    ]);

    // Counts for the role tabs (not affected by search or filter)
    const counts = { all: 0, admin: 0, vendor: 0, customer: 0 };
    roleRows.forEach((row) => {
      const key = ROLES.includes(row._id) ? row._id : "customer";
      counts[key] += row.count;
      counts.all += row.count;
    });

    res.json({
      success: true,
      users: items.map(formatUser),
      counts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/users/:id
async function getUserDetails(req, res, next) {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return fail(res, 400, "Invalid user ID");

    const db = getDB();
    const user = await db.collection("user").findOne({ _id: userId });
    if (!user) return fail(res, 404, "User not found");

    const role = user.role || "customer";
    const activity = {};

    if (role === "vendor") {
      const [serviceRows, activeServices, bookingRows, transactionCount] =
        await Promise.all([
          db
            .collection("services")
            .aggregate([
              { $match: { vendorId: userId } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ])
            .toArray(),
          db.collection("services").countDocuments({
            vendorId: userId,
            isActive: true,
            status: { $in: ["pending", "approved"] },
          }),
          db
            .collection("bookings")
            .aggregate([
              { $match: { vendorId: userId } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ])
            .toArray(),
          db.collection("transactions").countDocuments({ vendorId: userId }),
        ]);

      activity.services = {
        ...toCounts(serviceRows, SERVICE_STATUSES),
        active: activeServices,
      };
      activity.bookingsReceived = toCounts(bookingRows, BOOKING_STATUSES);
      activity.transactions = transactionCount;
    }

    if (role === "customer") {
      const bookingRows = await db
        .collection("bookings")
        .aggregate([
          { $match: { customerId: userId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
        .toArray();

      activity.bookingsMade = toCounts(bookingRows, BOOKING_STATUSES);
    }

    res.json({ success: true, user: formatUser(user), activity });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/users/:id/block   body: { isBlocked: true | false }
async function setUserBlocked(req, res, next) {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return fail(res, 400, "Invalid user ID");

    const { isBlocked } = req.body;
    if (typeof isBlocked !== "boolean") {
      return fail(res, 400, "isBlocked must be true or false");
    }

    if (userId.equals(req.user._id)) {
      return fail(res, 403, "You cannot block your own account");
    }

    const users = getDB().collection("user");
    const target = await users.findOne({ _id: userId });
    if (!target) return fail(res, 404, "User not found");

    if (target.role === "admin") {
      return fail(res, 403, "Admin accounts cannot be blocked");
    }

    await users.updateOne(
      { _id: userId, role: { $ne: "admin" } },
      { $set: { isBlocked, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: isBlocked ? "User blocked successfully" : "User unblocked successfully",
      isBlocked,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, getUserDetails, setUserBlocked };

