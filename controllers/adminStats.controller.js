const { getDB } = require("../config/db");
const { getString, getPagination } = require("../utils/query");

// GET /api/admin/stats
async function getStats(req, res, next) {
  try {
    const db = getDB();
    const users = db.collection("user");
    const services = db.collection("services");

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalServices,
      pendingServices,
      totalTransactions,
    ] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: "vendor" }),
      users.countDocuments({ role: "customer" }),
      services.countDocuments({}),
      services.countDocuments({ status: "pending" }),
      db.collection("transactions").countDocuments({}),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        totalTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/transactions   (read-only: there is no route to change a payment)
async function listTransactions(req, res, next) {
  try {
    const status = getString(req.query.status, 30);
    const { page, limit } = getPagination(req.query);

    const match = {};
    if (status) match.status = status;

    const [result] = await getDB()
      .collection("transactions")
      .aggregate([
        { $match: match },
        { $sort: { createdAt: -1, _id: 1 } },
        {
          $lookup: {
            from: "user",
            localField: "vendorId",
            foreignField: "_id",
            as: "vendor",
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            plan: 1,
            amount: 1,
            currency: 1,
            status: 1,
            createdAt: 1,
            vendor: {
              id: "$vendor._id",
              name: "$vendor.name",
              email: "$vendor.email",
              businessName: "$vendor.businessName",
            },
          },
        },
        {
          $facet: {
            items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
            total: [{ $count: "count" }],
          },
        },
      ])
      .toArray();

    const total = result?.total?.[0]?.count || 0;

    res.json({
      success: true,
      transactions: result?.items || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getStats, listTransactions };

