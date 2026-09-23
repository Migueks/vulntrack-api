const ApiError = require("../utils/ApiError");

// Valida los parámetros de consulta sin modificar req.query.
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(" ");

    return next(new ApiError(400, message));
  }

  // Express 5 expone req.query mediante un getter.
  req.validatedQuery = result.data;

  next();
};

module.exports = validateQuery;
