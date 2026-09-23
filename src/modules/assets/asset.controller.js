const assetService = require("./asset.service");

const asyncHandler = require("../../utils/asyncHandler");

// Obtiene el inventario con filtros y paginación.
const getAssets = asyncHandler(async (req, res) => {
  const result = await assetService.getAssets(req.validatedQuery);

  return res.status(200).json({
    success: true,
    data: result.assets,
    pagination: result.pagination,
  });
});

// Consulta el detalle de un activo.
const getAssetById = asyncHandler(async (req, res) => {
  const asset = await assetService.getAssetById(req.params.id);

  return res.status(200).json({
    success: true,
    data: asset,
  });
});

// Crea un activo con el usuario autenticado como creador.
const createAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.createAsset(req.body, req.user);

  return res.status(201).json({
    success: true,
    data: asset,
  });
});

// Actualiza los datos permitidos de un activo.
const updateAsset = asyncHandler(async (req, res) => {
  const asset = await assetService.updateAsset(
    req.params.id,
    req.body,
    req.user,
  );

  return res.status(200).json({
    success: true,
    data: asset,
  });
});

// Modifica el estado de un activo.
const updateAssetStatus = asyncHandler(async (req, res) => {
  const asset = await assetService.updateAssetStatus(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    data: asset,
  });
});

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  updateAssetStatus,
};
