const authService = require("./auth.service");
const asyncHandler = require("../../utils/asyncHandler");

// Procesa el login y devuelve el JWT junto al usuario.
const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);

  return res.status(200).json({
    success: true,
    data,
  });
});

// Devuelve los datos públicos del usuario autenticado.
const me = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: authService.getPublicUser(req.user),
  });
});

module.exports = {
  login,
  me,
};
