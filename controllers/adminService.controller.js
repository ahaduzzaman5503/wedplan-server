const { getDB } = require("../config/db");
const {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  FREE_PLAN_ACTIVE_LIMIT,
} = require("../config/constants");
const { isPremium } = require("../utils/subscription");
const { toObjectId } = require("../utils/objectId");

// Only strings are accepted from the query
function getString(value, maxLength = 100) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Joins the vendor (kept even if the vendor account no longer exists)
const vendorStages = [
  {
    $lookup: {
      from: "user",
      localField: "vendorId",
      foreignField: "_id",
      as: "vendor",
    },
  },
  { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
];

function formatService(doc) {
  const { vendor, ...rest } = doc;
  return {
    ...rest,
    vendor: vendor
      ? {
          id: String(vendor._id),
          name: vendor.name,
          email: vendor.email,
          businessName: vendor.businessName || null,
          image: vendor.image || null,
          isBlocked: Boolean(vendor.isBlocked),
          isPremium: isPremium(vendor),
        }
      : null,
  };
}

// GET /api/admin/services
async function listAllServices(req, res, next) {
  try {
    const search = getString(req.query.search);
    const status = getString(req.query.status);
    const category = getString(req.query.category);

    if (status && !SERVICE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (category && !SERVICE_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const match = {};
    if (status) match.status = status;
    if (category) match.category = category;

    // Search by service name, vendor name or business name (after the join)
    const searchStage = [];
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      searchStage.push({
        $match: {
          $or: [
            { serviceName: regex },
            { "vendor.name": regex },
            { "vendor.businessName": regex },
          ],
        },
      });
    }

    const services = getDB().collection("services");

    const [pageResult, countRows] = await Promise.all([
      services
        .aggregate([
          { $match: match },
          ...vendorStages,
          ...searchStage,
          { $sort: { createdAt: -1, _id: 1 } },
          {
            $facet: {
              items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
              total: [{ $count: "count" }],
            },
          },
        ])
        .toArray(),
      // Counts for the status tabs (not affected by filters)
      services
        .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
    ]);

    const result = pageResult[0];
    const total = result?.total?.[0]?.count || 0;

    const counts = { pending: 0, approved: 0, rejected: 0, all: 0 };
    countRows.forEach((row) => {
      if (row._id in counts) counts[row._id] = row.count;
      counts.all += row.count;
    });

    res.json({
      success: true,
      services: (result?.items || []).map(formatService),
      counts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/services/:id/status
async function updateServiceStatus(req, res, next) {
  try {
    const serviceId = toObjectId(req.params.id);
    if (!serviceId) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const { status } = req.body;
    if (!SERVICE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved or rejected",
      });
    }

    const db = getDB();
    const services = db.collection("services");
    const service = await services.findOne({ _id: serviceId });

    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    if (service.status === status) {
      return res.json({
        success: true,
        message: `Service is already ${status}`,
        status,
      });
    }

    // A rejected service does not count toward the Free limit.
    // Bringing it back must not push a Free vendor over the limit.
    const wasCounted = service.status !== "rejected";
    const willCount = status !== "rejected";
    if (service.isActive && !wasCounted && willCount) {
      const vendor = await db.collection("user").findOne({ _id: service.vendorId });
      if (vendor && !isPremium(vendor)) {
        const activeCount = await services.countDocuments({
          vendorId: service.vendorId,
          isActive: true,
          status: { $in: ["pending", "approved"] },
        });
        if (activeCount >= FREE_PLAN_ACTIVE_LIMIT) {
          return res.status(409).json({
            success: false,
            message: `This vendor is on the Free plan and already has ${FREE_PLAN_ACTIVE_LIMIT} active services, so this service cannot be restored.`,
          });
        }
      }
    }

    await services.updateOne(
      { _id: serviceId },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Service ${status} successfully`,
      status,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/admin/services/:id
async function deleteServiceByAdmin(req, res, next) {
  try {
    const serviceId = toObjectId(req.params.id);
    if (!serviceId) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const result = await getDB()
      .collection("services")
      .deleteOne({ _id: serviceId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAllServices, updateServiceStatus, deleteServiceByAdmin };