const { z } = require("zod");
const { isIP } = require("node:net");

const {
  ASSET_TYPES,
  ASSET_ENVIRONMENTS,
  ASSET_CRITICALITIES,
  ASSET_STATUSES,
} = require("../../constants/asset.constants");

// Valida los filtros, la ordenación y la paginación.
const assetQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1, "Page must be at least 1.")
      .max(100000, "Page is too large.")
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .min(1, "Limit must be at least 1.")
      .max(100, "Limit cannot exceed 100.")
      .default(10),

    search: z.string().trim().max(100, "Search is too long.").optional(),

    type: z.enum(Object.values(ASSET_TYPES)).optional(),

    environment: z.enum(Object.values(ASSET_ENVIRONMENTS)).optional(),

    criticality: z.enum(Object.values(ASSET_CRITICALITIES)).optional(),

    status: z.enum(Object.values(ASSET_STATUSES)).optional(),

    sortBy: z
      .enum(["assetCode", "name", "type", "criticality", "status", "createdAt"])
      .default("assetCode"),

    order: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

// Campos que el cliente puede proporcionar al crear un activo.
const assetFields = {
  name: z
    .string()
    .trim()
    .min(2, "Asset name must contain at least 2 characters.")
    .max(150, "Asset name is too long."),

  type: z.enum(Object.values(ASSET_TYPES)),

  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .max(253, "Hostname is too long.")
    .optional(),

  ipAddress: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || isIP(value) !== 0,
      "Enter a valid IP address.",
    )
    .optional(),

  operatingSystem: z
    .string()
    .trim()
    .max(150, "Operating system is too long.")
    .optional(),

  environment: z.enum(Object.values(ASSET_ENVIRONMENTS)),

  criticality: z.enum(Object.values(ASSET_CRITICALITIES)),

  department: z
    .string()
    .trim()
    .min(2, "Department must contain at least 2 characters.")
    .max(100, "Department is too long."),

  description: z
    .string()
    .trim()
    .max(2000, "Description is too long.")
    .optional(),
};

// Valida los datos necesarios para crear un activo.
const createAssetSchema = z.object(assetFields).strict();

// Permite modificar uno o varios campos del activo.
const updateAssetSchema = createAssetSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided.",
  );

// El ciclo de vida tiene un endpoint independiente.
const updateAssetStatusSchema = z
  .object({
    status: z.enum(Object.values(ASSET_STATUSES)),
  })
  .strict();

module.exports = {
  assetQuerySchema,
  createAssetSchema,
  updateAssetSchema,
  updateAssetStatusSchema,
};
