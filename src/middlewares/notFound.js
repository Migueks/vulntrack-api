const ApiError = require("../utils/ApiError");

// Gestiona las rutas que no existen en nuestra API.
const notFound = (req, res, next) => {
  next(new ApiError(404, "Route not found."));
};

module.exports = notFound;
