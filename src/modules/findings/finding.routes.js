const express = require("express");

const findingController = require("./finding.controller");

const {
  findingQuerySchema,
  createFindingSchema,
  assignFindingSchema,
  updateFindingStatusSchema,
  addFindingNoteSchema,
} = require("./finding.schema");

const authenticate = require("../../middlewares/authenticate");

const authorize = require("../../middlewares/authorize");

const validate = require("../../middlewares/validate");

const validateQuery = require("../../middlewares/validateQuery");

const uploadEvidence = require("../../middlewares/uploadEvidence");

const { USER_ROLES } = require("../../constants/roles");

const router = express.Router();

// Todas las peticiones requieren JWT.
router.use(authenticate);

// Los tres roles pueden consultar los Findings.
router.get(
  "/",
  validateQuery(findingQuerySchema),
  findingController.getFindings,
);

router.get("/:id", findingController.getFindingById);

// Descarga protegida por permisos adicionales del service.
router.get(
  "/:id/evidence/:evidenceId/file",
  findingController.downloadEvidence,
);

// ADMIN y ANALYST pueden crear Findings.
router.post(
  "/",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(createFindingSchema),
  findingController.createFinding,
);

// Asignación y desasignación.
router.patch(
  "/:id/assignment",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(assignFindingSchema),
  findingController.assignFinding,
);

// Gestión del workflow.
router.patch(
  "/:id/status",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(updateFindingStatusSchema),
  findingController.changeStatus,
);

// Notas del historial.
router.post(
  "/:id/notes",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(addFindingNoteSchema),
  findingController.addNote,
);

// Subida privada de evidencias.
router.post(
  "/:id/evidence",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  uploadEvidence,
  findingController.uploadEvidence,
);

// Eliminación de evidencias.
router.delete(
  "/:id/evidence/:evidenceId",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  findingController.deleteEvidence,
);

module.exports = router;
