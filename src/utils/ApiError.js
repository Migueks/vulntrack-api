// Representa errores controlados de nuestra API.
class ApiError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = ApiError;
