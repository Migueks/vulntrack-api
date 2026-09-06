const express = require("express");

const app = express();

// Permite recibir JSON en las peticiones
app.use(express.json());

// Ruta básica para comprobar que la API funciona
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
    },
  });
});

module.exports = app;
