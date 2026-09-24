const express = require("express");

const dashboardController = require("./dashboard.controller");

const authenticate = require("../../middlewares/authenticate");

const router = express.Router();

// Todas las estadísticas requieren una sesión válida.
router.use(authenticate);

// Devuelve el resumen operativo de VulnTrack.
router.get("/overview", dashboardController.getDashboardOverview);

module.exports = router;
