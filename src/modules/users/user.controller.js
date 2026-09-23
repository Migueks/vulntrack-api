const userService = require("./user.service");
const asyncHandler = require("../../utils/asyncHandler");

// Devuelve los usuarios paginados.
const getUsers = asyncHandler(async (req, res) => {
  const result = await userService.getUsers(req.query);

  return res.status(200).json({
    success: true,
    data: result.users,
    pagination: result.pagination,
  });
});

// Consulta un usuario por su identificador.
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// Crea una cuenta nueva.
const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);

  return res.status(201).json({
    success: true,
    data: user,
  });
});

// Modifica el perfil administrativo de un usuario.
const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// Modifica el estado de una cuenta.
const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(
    req.params.id,
    req.body,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// Permite editar el perfil del usuario autenticado.
const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateMe(req.user._id, req.body);

  return res.status(200).json({
    success: true,
    data: user,
  });
});

// Cambia la contraseña del usuario autenticado.
const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user._id, req.body);

  return res.status(200).json({
    success: true,
    data: {
      message: "Password updated successfully.",
    },
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateMe,
  changePassword,
};
