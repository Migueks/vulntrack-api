const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../users/user.model");
const ApiError = require("../../utils/ApiError");

// Selecciona únicamente la información pública de un usuario.
const getPublicUser = (user) => ({
  id: user._id.toString(),
  userCode: user.userCode,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  avatar: user.avatar?.url || null,
  lastLogin: user.lastLogin,
});

// Comprueba credenciales y genera un token de sesión.
const login = async ({ email, password }) => {
  // La contraseña tiene select:false en nuestro modelo.
  const user = await User.findOne({ email }).select("+password");

  // No revelamos si un correo concreto existe.
  if (!user) {
    throw new ApiError(401, "Invalid credentials.");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid credentials.");
  }

  // Si las credenciales son correctas, informamos del estado de la cuenta.
  if (!user.isActive) {
    throw new ApiError(403, "User account is inactive.", "USER_INACTIVE");
  }

  // El token identifica al usuario e incluye su versión de sesión.
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "2h",
      issuer: "vulntrack-api",
      audience: "vulntrack-web",
    },
  );

  // Registramos el último inicio de sesión correcto.
  user.lastLogin = new Date();

  await User.updateOne(
    { _id: user._id },
    { $set: { lastLogin: user.lastLogin } },
  );

  return {
    token,
    tokenType: "Bearer",
    expiresIn: 7200,
    user: getPublicUser(user),
  };
};

module.exports = {
  login,
  getPublicUser,
};
