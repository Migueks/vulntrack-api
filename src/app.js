const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");

const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// Añade cabeceras HTTP de seguridad.
app.use(helmet());

// Permite peticiones del frontend autorizado.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);

// Interpreta cuerpos JSON y limita su tamaño.
app.use(express.json({ limit: "1mb" }));

// Comprueba que la API está funcionando.
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
    },
  });
});

// Rutas de autenticación de VulnTrack.
app.use("/api/v1/auth", authRoutes);

// Gestiona rutas inexistentes y errores.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
