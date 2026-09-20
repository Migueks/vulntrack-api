const express = require("express");

const authController = require("./auth.controller");
const { loginSchema } = require("./auth.schema");

const validate = require("../../middlewares/validate");
const authenticate = require("../../middlewares/authenticate");
const loginLimiter = require("../../middlewares/loginLimiter");

const router = express.Router();

// Inicio de sesión público con validación y limitación de intentos.
router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  authController.login,
);

// Consulta de sesión accesible únicamente con un JWT válido.
router.get("/me", authenticate, authController.me);

module.exports = router;
