const express = require("express");

const userController = require("./user.controller");

const {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
} = require("./user.schema");

const authenticate = require("../../middlewares/authenticate");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validate");

const { USER_ROLES } = require("../../constants/roles");

const router = express.Router();

// Todas las rutas del módulo requieren rol ADMIN.
router.use(authenticate, authorize(USER_ROLES.ADMIN));

// Consulta y creación de usuarios.
router.get("/", userController.getUsers);

router.post("/", validate(createUserSchema), userController.createUser);

// Modifica la activación de una cuenta.
router.patch(
  "/:id/status",
  validate(updateUserStatusSchema),
  userController.updateUserStatus,
);

// Consulta y edición individual.
router.get("/:id", userController.getUserById);

router.patch("/:id", validate(updateUserSchema), userController.updateUser);

module.exports = router;
