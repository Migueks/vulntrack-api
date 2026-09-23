const { z } = require("zod");

const {
  FINDING_STATUSES,
  FINDING_PRIORITIES,
} = require("../../constants/finding.constants");

// Valida identificadores de MongoDB.
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId.");

// Filtros, ordenación y paginación.
const findingQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().max(100).optional(),

    status: z.enum(Object.values(FINDING_STATUSES)).optional(),

    priority: z.enum(Object.values(FINDING_PRIORITIES)).optional(),

    assetId: objectId.optional(),

    vulnerabilityId: objectId.optional(),

    assignedTo: z.union([objectId, z.literal("unassigned")]).optional(),

    overdue: z.enum(["true", "false"]).optional(),

    sortBy: z
      .enum([
        "findingCode",
        "detectedAt",
        "dueDate",
        "priority",
        "status",
        "createdAt",
      ])
      .default("detectedAt"),

    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

// Al crear, el backend controla código, prioridad y estado.
const createFindingSchema = z
  .object({
    assetId: objectId,

    vulnerabilityId: objectId,

    assignedToId: objectId.nullable().optional(),
  })
  .strict();

// Valida asignaciones y desasignaciones.
const assignFindingSchema = z
  .object({
    assignedToId: objectId.nullable(),
  })
  .strict();

// Valida las transiciones del workflow.
const updateFindingStatusSchema = z
  .object({
    status: z.enum(Object.values(FINDING_STATUSES)),

    note: z.string().trim().min(3).max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const closingStatuses = [
      FINDING_STATUSES.RESOLVED,
      FINDING_STATUSES.ACCEPTED_RISK,
      FINDING_STATUSES.FALSE_POSITIVE,
    ];

    // Toda decisión de cierre debe estar justificada.
    if (
      closingStatuses.includes(value.status) &&
      (!value.note || value.note.length < 10)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Closing a finding requires a note of at least 10 characters.",
      });
    }
  });

// Valida las notas añadidas al historial.
const addFindingNoteSchema = z
  .object({
    note: z.string().trim().min(3).max(2000),
  })
  .strict();

module.exports = {
  findingQuerySchema,
  createFindingSchema,
  assignFindingSchema,
  updateFindingStatusSchema,
  addFindingNoteSchema,
};
