const ApiError = require("../utils/ApiError");

// Permite acceder únicamente a los roles autorizados.
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions."));
    }

    next();
  };

module.exports = authorize;
