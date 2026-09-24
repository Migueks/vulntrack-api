const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../modules/users/user.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const isTokenVersionValid = require("../utils/isTokenVersionValid");

// Comprueba el JWT y recupera el usuario actual.
const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;

  // Solo admitimos tokens enviados mediante Authorization: Bearer.
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    throw new ApiError(401, "Authentication required.");
  }

  let payload;

  try {
    // Comprueba firma, caducidad, algoritmo, emisor y destinatario.
    payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "vulntrack-api",
      audience: "vulntrack-web",
    });
  } catch {
    throw new ApiError(401, "Invalid or expired token.");
  }

  // Impide consultar MongoDB con un identificador malformado.
  if (typeof payload !== "object" || !mongoose.isValidObjectId(payload.sub)) {
    throw new ApiError(401, "Invalid or expired token.");
  }

  // Recuperamos la información actual del usuario.
  const user = await User.findById(payload.sub);

  // Invalida JWT antiguos tras cambios de contraseña o estado de cuenta.
  if (!isTokenVersionValid(payload, user)) {
    throw new ApiError(401, "Invalid or expired token.");
  }

  // Los siguientes middlewares podrán consultar req.user.
  req.user = user;

  next();
});

module.exports = authenticate;
