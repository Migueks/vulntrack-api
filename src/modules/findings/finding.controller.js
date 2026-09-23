const findingService = require("./finding.service");

const asyncHandler = require("../../utils/asyncHandler");

// Devuelve el listado paginado.
const getFindings = asyncHandler(async (req, res) => {
  const result = await findingService.getFindings(req.validatedQuery);

  return res.status(200).json({
    success: true,

    data: result.findings,

    pagination: result.pagination,
  });
});

// Consulta un Finding.
const getFindingById = asyncHandler(async (req, res) => {
  const data = await findingService.getFindingById(req.params.id);

  return res.status(200).json({
    success: true,
    data,
  });
});

// Crea un Finding.
const createFinding = asyncHandler(async (req, res) => {
  const data = await findingService.createFinding(req.body, req.user);

  return res.status(201).json({
    success: true,
    data,
  });
});

// Gestiona la asignación.
const assignFinding = asyncHandler(async (req, res) => {
  const data = await findingService.updateFindingAssignment(
    req.params.id,
    req.body,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data,
  });
});

// Gestiona las transiciones de estado.
const changeStatus = asyncHandler(async (req, res) => {
  const data = await findingService.updateFindingStatus(
    req.params.id,
    req.body,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data,
  });
});

// Registra una nota.
const addNote = asyncHandler(async (req, res) => {
  const data = await findingService.addFindingNote(
    req.params.id,
    req.body,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data,
  });
});

// Recibe una evidencia.
const uploadEvidence = asyncHandler(async (req, res) => {
  const data = await findingService.addEvidence(
    req.params.id,
    req.file,
    req.user,
  );

  return res.status(201).json({
    success: true,
    data,
  });
});

// Descarga una evidencia privada.
const downloadEvidence = asyncHandler(async (req, res) => {
  const file = await findingService.readEvidence(
    req.params.id,
    req.params.evidenceId,
    req.user,
  );

  res.set("Content-Type", file.mimeType);

  res.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  );

  res.set("Cache-Control", "no-store");

  return res.status(200).send(file.content);
});

// Elimina una evidencia.
const deleteEvidence = asyncHandler(async (req, res) => {
  const data = await findingService.removeEvidence(
    req.params.id,
    req.params.evidenceId,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  getFindings,
  getFindingById,
  createFinding,
  assignFinding,
  changeStatus,
  addNote,
  uploadEvidence,
  downloadEvidence,
  deleteEvidence,
};
