// Centraliza las respuestas de error de Express.
const errorHandler = (err, req, res, next) => {
  // Evita devolver detalles internos al cliente.
  const statusCode =
    err.isOperational && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;

  const message = statusCode === 500 ? "Internal server error." : err.message;

  // Conserva el detalle del error en la terminal.
  if (statusCode === 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
