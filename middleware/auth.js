const { createRemoteJWKSet, jwtVerify } = require("jose");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

// Downloads Better Auth's public keys (and caches them)
const JWKS = createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL));

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// 1) Checks the token, then loads the REAL user from the database
async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return sendError(res, 401, "Authentication required");
    }

    let payload;
    try {
      const result = await jwtVerify(token, JWKS, {
        issuer: process.env.AUTH_ISSUER,
      });
      payload = result.payload;
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED") {
        return sendError(res, 401, "Token has expired. Please log in again.");
      }
      console.error("JWT verification failed:", error.code || error.message);
      return sendError(res, 401, "Invalid token");
    }

    const userId = payload.sub;
    if (!userId || !ObjectId.isValid(userId)) {
      return sendError(res, 401, "Invalid token");
    }

    // The role always comes from the database, never from the client
    const user = await getDB()
      .collection("user")
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return sendError(res, 401, "User not found");
    }

    if (user.isBlocked) {
      return sendError(res, 403, "Your account has been blocked");
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image || null,
      role: user.role || "customer",
      subscriptionPlan: user.subscriptionPlan || "free",
      subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    };

    next();
  } catch (error) {
    next(error);
  }
}

// 2) Use AFTER verifyToken: requireRole("admin") or requireRole("vendor", "admin")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, "Authentication required");
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, "You do not have permission to do this");
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };