const express = require("express");

const userController = require("./user.controller");

const {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateMeSchema,
  changePasswordSchema,
} = require("./user.schema");

const authenticate = require("../../middlewares/authenticate");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validate");

const { USER_ROLES } = require("../../constants/roles");

const router = express.Router();

// Todas las rutas de usuarios requieren autenticación.
router.use(authenticate);

// Operaciones disponibles para cualquier usuario autenticado.
router.patch("/me", validate(updateMeSchema), userController.updateMe);

router.patch(
  "/me/password",
  validate(changePasswordSchema),
  userController.changePassword,
);

// A partir de aquí las operaciones son exclusivas de ADMIN.
router.use(authorize(USER_ROLES.ADMIN));

router.get("/", userController.getUsers);

router.post("/", validate(createUserSchema), userController.createUser);

router.patch(
  "/:id/status",
  validate(updateUserStatusSchema),
  userController.updateUserStatus,
);

router.get("/:id", userController.getUserById);

router.patch("/:id", validate(updateUserSchema), userController.updateUser);

module.exports = router;
