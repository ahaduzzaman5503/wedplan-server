const { getDB } = require("../config/db");
const { SERVICE_CATEGORIES } = require("../config/constants");
const { isPremium } = require("../utils/subscription");
const { toObjectId } = require("../utils/objectId");

// Only strings are accepted from the query (blocks tricks like ?search[$ne]=x)
function getString(value, maxLength = 100) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Joins the vendor from the "user" collection and hides blocked vendors
const vendorStages = [
  {
    $lookup: {
      from: "user",
      localField: "vendorId",
      foreignField: "_id",
      as: "vendor",
    },
  },
  { $unwind: "$vendor" },
  { $match: { "vendor.isBlocked": { $ne: true } } },
  {
    $addFields: {
      vendor: {
        _id: "$vendor._id",
        name: "$vendor.name",
        businessName: "$vendor.businessName",
        image: "$vendor.image",
        subscriptionPlan: "$vendor.subscriptionPlan",
        subscriptionExpiresAt: "$vendor.subscriptionExpiresAt",
      },
    },
  },
];

// Keeps only safe vendor fields (no email) and adds the premium badge flag
function formatService(doc) {
  const { vendor, ...rest } = doc;
  return {
    ...rest,
    vendor: {
      id: String(vendor._id),
      name: vendor.name,
      businessName: vendor.businessName || null,
      image: vendor.image || null,
      isPremium: isPremium(vendor),
    },
  };
}

const AVAILABLE = { status: "approved", isActive: true };

// GET /api/services
async function listServices(req, res, next) {
  try {
    const search = getString(req.query.search);
    const category = getString(req.query.category);
    const location = getString(req.query.location);
    const sort = getString(req.query.sort);

    if (category && !SERVICE_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

    const match = { ...AVAILABLE };
    if (search) match.serviceName = { $regex: escapeRegex(search), $options: "i" };
    if (category) match.category = category;
    if (location) match.location = { $regex: escapeRegex(location), $options: "i" };

    let sortStage = { createdAt: -1, _id: 1 }; // newest first
    if (sort === "price_asc") sortStage = { price: 1, _id: 1 };
    if (sort === "price_desc") sortStage = { price: -1, _id: 1 };

    const [result] = await getDB()
      .collection("services")
      .aggregate([
        { $match: match },
        ...vendorStages,
        { $sort: sortStage },
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
      services: (result?.items || []).map(formatService),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/services/locations
async function getServiceLocations(req, res, next) {
  try {
    const locations = await getDB()
      .collection("services")
      .distinct("location", AVAILABLE);

    locations.sort((a, b) => a.localeCompare(b));
    res.json({ success: true, locations });
  } catch (error) {
    next(error);
  }
}

// GET /api/services/:id
async function getServiceById(req, res, next) {
  try {
    const serviceId = toObjectId(req.params.id);
    if (!serviceId) {
      return res.status(400).json({ success: false, message: "Invalid service ID" });
    }

    const [service] = await getDB()
      .collection("services")
      .aggregate([{ $match: { _id: serviceId, ...AVAILABLE } }, ...vendorStages])
      .toArray();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or no longer available",
      });
    }

    res.json({ success: true, service: formatService(service) });
  } catch (error) {
    next(error);
  }
}

module.exports = { listServices, getServiceLocations, getServiceById };
