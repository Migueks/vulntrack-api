const { z } = require("zod");
const { USER_ROLE_VALUES } = require("../../constants/roles");

// Política de contraseñas para nuevas cuentas.
const passwordSchema = z
  .string()
  .min(15, "Password must contain at least 15 characters.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password exceeds the supported byte length.",
  )
  .refine(
    (password) => password.trim().length > 0,
    "Password cannot contain only whitespace.",
  );

// Valida la creación de usuarios.
const createUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(100, "Name is too long."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email address is too long.")
      .email("Enter a valid email address."),

    password: passwordSchema,

    role: z.enum(USER_ROLE_VALUES),
  })
  .strict();

// Permite modificar exclusivamente los campos administrativos.
const updateUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(100, "Name is too long.")
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email address is too long.")
      .email("Enter a valid email address.")
      .optional(),

    role: z.enum(USER_ROLE_VALUES).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided.",
  );

// La activación y desactivación tienen su propio endpoint.
const updateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

// Permite al usuario modificar únicamente sus propios datos básicos.
const updateMeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(100, "Name is too long.")
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email address is too long.")
      .email("Enter a valid email address.")
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided.",
  );

// Exige la contraseña actual antes de establecer una nueva.
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required.")
      .refine(
        (password) => Buffer.byteLength(password, "utf8") <= 72,
        "Current password exceeds the supported byte length.",
      ),

    newPassword: passwordSchema,
  })
  .strict();

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateMeSchema,
  changePasswordSchema,
};
