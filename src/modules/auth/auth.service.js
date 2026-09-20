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

  // No revelamos si el email existe o si el usuario está inactivo.
  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid credentials.");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid credentials.");
  }

  // El token identifica al usuario, pero no guarda su rol.
  const token = jwt.sign(
    {
      sub: user._id.toString(),
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
