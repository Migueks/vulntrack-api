const { rateLimit } = require("express-rate-limit");

// Limita los intentos de autenticación por dirección IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Try again later.",
    });
  },
});

module.exports = loginLimiter;
