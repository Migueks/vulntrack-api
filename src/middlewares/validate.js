const ApiError = require("../utils/ApiError");

// Valida el cuerpo de una petición mediante un esquema Zod.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(" ");

    return next(new ApiError(400, message));
  }

  // Conserva los datos normalizados por Zod.
  req.body = result.data;

  next();
};

module.exports = validate;
