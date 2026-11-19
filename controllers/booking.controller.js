const { getDB } = require("../config/db");
const { toObjectId } = require("../utils/objectId");
const {
  BOOKING_STATUSES,
  validateBookingInput,
} = require("../utils/bookingValidator");

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// Joins service + the other party, and shapes the result
function bookingPipeline(match, party) {
  const partyField = party === "customer" ? "customerId" : "vendorId";
  const partyShape =
    party === "customer"
      ? {
          id: "$party._id",
          name: "$party.name",
          email: "$party.email",
          image: "$party.image",
        }
      : {
          id: "$party._id",
          name: "$party.name",
          businessName: "$party.businessName",
          image: "$party.image",
        };

  return [
    { $match: match },
    {
      $lookup: {
        from: "services",
        localField: "serviceId",
        foreignField: "_id",
        as: "service",
      },
    },
    { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "user",
        localField: partyField,
        foreignField: "_id",
        as: "party",
      },
    },
    { $unwind: { path: "$party", preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1, _id: 1 } },
    {
      $project: {
        serviceId: 1,
        vendorId: 1,
        customerId: 1,
        eventDate: 1,
        eventLocation: 1,
        message: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        service: {
          _id: "$service._id",
          serviceName: "$service.serviceName",
          category: "$service.category",
          price: "$service.price",
          location: "$service.location",
          image: { $arrayElemAt: ["$service.images", 0] },
        },
        [party === "customer" ? "customer" : "vendor"]: partyShape,
      },
    },
  ];
}

// POST /api/bookings  (customer only)
async function createBooking(req, res, next) {
  try {
    const serviceId = toObjectId(req.body.serviceId);
    if (!serviceId) return fail(res, 400, "Invalid service ID");

    const { data, errors, isValid } = validateBookingInput(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors,
      });
    }

    const db = getDB();

    // Only approved and active services can be booked
    const service = await db
      .collection("services")
      .findOne({ _id: serviceId, status: "approved", isActive: true });
    if (!service) {
      return fail(res, 404, "Service not found or no longer available");
    }

    const vendor = await db.collection("user").findOne({ _id: service.vendorId });
    if (!vendor || vendor.isBlocked) {
      return fail(res, 404, "Service not found or no longer available");
    }

    if (service.vendorId.equals(req.user._id)) {
      return fail(res, 403, "You cannot book your own service");
    }

    const bookings = db.collection("bookings");

    // No duplicate active request for the same service and date
    const duplicate = await bookings.findOne({
      serviceId,
      customerId: req.user._id,
      eventDate: data.eventDate,
      status: { $in: ["pending", "accepted"] },
    });
    if (duplicate) {
      return fail(
        res,
        409,
        "You already have an active booking request for this service on this date"
      );
    }

    const now = new Date();
    const booking = {
      serviceId,
      vendorId: service.vendorId, // from the service, never from the client
      customerId: req.user._id, // from the verified token
      eventDate: data.eventDate,
      eventLocation: data.eventLocation,
      message: data.message,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const result = await bookings.insertOne(booking);

    res.status(201).json({
      success: true,
      message: "Booking request sent. The vendor will review it soon.",
      booking: { ...booking, _id: result.insertedId },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/bookings/mine  (customer only)
async function getMyBookings(req, res, next) {
  try {
    const bookings = await getDB()
      .collection("bookings")
      .aggregate(bookingPipeline({ customerId: req.user._id }, "vendor"))
      .toArray();

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

// GET /api/bookings/vendor  (vendor only)
async function getVendorBookings(req, res, next) {
  try {
    const match = { vendorId: req.user._id };

    if (req.query.status !== undefined) {
      if (!BOOKING_STATUSES.includes(req.query.status)) {
        return fail(res, 400, "Invalid status");
      }
      match.status = req.query.status;
    }

    const bookings = await getDB()
      .collection("bookings")
      .aggregate(bookingPipeline(match, "customer"))
      .toArray();

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/bookings/:id/status  (vendor, owner only)
async function updateBookingStatus(req, res, next) {
  try {
    const bookingId = toObjectId(req.params.id);
    if (!bookingId) return fail(res, 400, "Invalid booking ID");

    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return fail(res, 400, "Status must be accepted or rejected");
    }

    const bookings = getDB().collection("bookings");
    const booking = await bookings.findOne({ _id: bookingId });

    if (!booking) return fail(res, 404, "Booking request not found");

    if (!booking.vendorId.equals(req.user._id)) {
      return fail(res, 403, "You can only manage booking requests for your own services");
    }

    if (booking.status !== "pending") {
      return fail(
        res,
        409,
        `This request is already ${booking.status} and cannot be changed`
      );
    }

    // The filter requires "pending", so two quick clicks cannot both succeed
    const result = await bookings.updateOne(
      { _id: bookingId, vendorId: req.user._id, status: "pending" },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return fail(res, 409, "This request was already processed");
    }

    res.json({
      success: true,
      message: `Booking request ${status}`,
      status,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/bookings/:id/cancel  (customer, owner only)
async function cancelBooking(req, res, next) {
  try {
    const bookingId = toObjectId(req.params.id);
    if (!bookingId) return fail(res, 400, "Invalid booking ID");

    const bookings = getDB().collection("bookings");
    const booking = await bookings.findOne({ _id: bookingId });

    if (!booking) return fail(res, 404, "Booking request not found");

    if (!booking.customerId.equals(req.user._id)) {
      return fail(res, 403, "You can only cancel your own booking requests");
    }

    if (booking.status !== "pending") {
      return fail(
        res,
        409,
        `Only pending requests can be cancelled. This request is already ${booking.status}.`
      );
    }

    const result = await bookings.updateOne(
      { _id: bookingId, customerId: req.user._id, status: "pending" },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return fail(res, 409, "This request was already processed");
    }

    res.json({
      success: true,
      message: "Booking request cancelled",
      status: "cancelled",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getVendorBookings,
  updateBookingStatus,
  cancelBooking,
};

