const { z } = require("zod");

// Evita superar el límite de entrada de bcrypt.
const passwordSchema = z
  .string()
  .min(1, "Password is required.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password exceeds the supported byte length.",
  );

// Valida y normaliza únicamente las credenciales del login.
const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email address is too long.")
      .email("Enter a valid email address."),

    password: passwordSchema,
  })
  .strict();

module.exports = {
  loginSchema,
};
