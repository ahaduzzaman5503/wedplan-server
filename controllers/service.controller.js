const { getDB } = require("../config/db");
const { FREE_PLAN_ACTIVE_LIMIT } = require("../config/constants");
const { isPremium } = require("../utils/subscription");
const { validateServiceInput } = require("../utils/validators");
const { toObjectId } = require("../utils/objectId");

function activeServicesFilter(vendorId) {
  return {
    vendorId,
    isActive: true,
    status: { $in: ["pending", "approved"] },
  };
}

// Loads the service from :id and checks it belongs to the logged-in vendor.
// Sends the error response itself and returns null if something is wrong.
async function loadOwnedService(req, res) {
  const serviceId = toObjectId(req.params.id);
  if (!serviceId) {
    res.status(400).json({ success: false, message: "Invalid service ID" });
    return null;
  }

  const service = await getDB()
    .collection("services")
    .findOne({ _id: serviceId });

  if (!service) {
    res.status(404).json({ success: false, message: "Service not found" });
    return null;
  }

  if (!service.vendorId.equals(req.user._id)) {
    res.status(403).json({
      success: false,
      message: "You can only manage your own services",
    });
    return null;
  }

  return service;
}

// POST /api/services  (vendor only)
async function createService(req, res, next) {
  try {
    const { data, errors, isValid } = validateServiceInput(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors,
      });
    }

    const services = getDB().collection("services");

    // Free plan limit: max 3 active services
    if (!isPremium(req.user)) {
      const activeCount = await services.countDocuments(
        activeServicesFilter(req.user._id)
      );

      if (activeCount >= FREE_PLAN_ACTIVE_LIMIT) {
        return res.status(403).json({
          success: false,
          message: `Free plan allows a maximum of ${FREE_PLAN_ACTIVE_LIMIT} active services. Upgrade to Premium to publish more.`,
        });
      }
    }

    const now = new Date();
    const service = {
      ...data,
      vendorId: req.user._id, // always from the verified token
      status: "pending", // always pending until an admin approves
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await services.insertOne(service);

    res.status(201).json({
      success: true,
      message: "Service submitted. It will be visible after admin approval.",
      service: { ...service, _id: result.insertedId },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/services/mine  (vendor only)
async function getMyServices(req, res, next) {
  try {
    const services = await getDB()
      .collection("services")
      .find({ vendorId: req.user._id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, services });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/services/:id  (vendor, owner only)
async function updateService(req, res, next) {
  try {
    const service = await loadOwnedService(req, res);
    if (!service) return;

    // Only the allowed fields are picked. status, vendorId and isActive are ignored.
    const { data, errors, isValid } = validateServiceInput(req.body, {
      partial: true,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors,
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const services = getDB().collection("services");
    await services.updateOne(
      { _id: service._id, vendorId: req.user._id }, // ownership also in the query
      { $set: { ...data, updatedAt: new Date() } }
    );

    const updated = await services.findOne({ _id: service._id });

    res.json({
      success: true,
      message: "Service updated successfully",
      service: updated,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/services/:id/availability  (vendor, owner only)
async function setAvailability(req, res, next) {
  try {
    const service = await loadOwnedService(req, res);
    if (!service) return;

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const services = getDB().collection("services");

    // Turning a counted service back on must respect the Free plan limit
    const wouldCount = isActive && !service.isActive && service.status !== "rejected";
    if (wouldCount && !isPremium(req.user)) {
      const activeCount = await services.countDocuments(
        activeServicesFilter(req.user._id)
      );
      if (activeCount >= FREE_PLAN_ACTIVE_LIMIT) {
        return res.status(403).json({
          success: false,
          message: `Free plan allows a maximum of ${FREE_PLAN_ACTIVE_LIMIT} active services. Deactivate another service or upgrade to Premium.`,
        });
      }
    }

    await services.updateOne(
      { _id: service._id, vendorId: req.user._id },
      { $set: { isActive, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: isActive ? "Service is now active" : "Service is now inactive",
      isActive,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/services/:id  (vendor, owner only)
async function deleteService(req, res, next) {
  try {
    const service = await loadOwnedService(req, res);
    if (!service) return;

    await getDB()
      .collection("services")
      .deleteOne({ _id: service._id, vendorId: req.user._id });

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createService,
  getMyServices,
  updateService,
  setAvailability,
  deleteService,
};