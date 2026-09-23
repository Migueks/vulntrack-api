const mongoose = require("mongoose");

const Asset = require("./asset.model");
const ApiError = require("../../utils/ApiError");

const Finding = require("../findings/finding.model");

const { USER_ROLES } = require("../../constants/roles");

const { ASSET_STATUSES } = require("../../constants/asset.constants");

const { FINDING_STATUSES } = require("../../constants/finding.constants");

const priorityUtils = require("../../utils/calculatePriority");
const dueDateUtils = require("../../utils/calculateDueDate");

const calculatePriority = priorityUtils.calculatePriority ?? priorityUtils;

const calculateDueDate = dueDateUtils.calculateDueDate ?? dueDateUtils;

// Escapa caracteres especiales antes de construir búsquedas RegExp.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Estados de Findings que todavía representan trabajo pendiente.
const ACTIVE_FINDING_STATUSES = [
  FINDING_STATUSES.OPEN,
  FINDING_STATUSES.IN_PROGRESS,
  FINDING_STATUSES.MITIGATED,
];

// Comprueba el formato de un ObjectId recibido por la API.
const validateAssetId = (id) => {
  if (
    typeof id !== "string" ||
    !/^[0-9a-fA-F]{24}$/.test(id) ||
    !mongoose.isValidObjectId(id)
  ) {
    throw new ApiError(400, "Invalid asset ID.");
  }
};

// Recupera un activo o devuelve un error controlado.
const findAssetOrFail = async (id, session = null) => {
  validateAssetId(id);

  const query = Asset.findById(id);

  if (session) {
    query.session(session);
  }

  const asset = await query;

  if (!asset) {
    throw new ApiError(404, "Asset not found.");
  }

  return asset;
};

// Impide retirar un activo con Findings pendientes.
const ensureNoActiveFindings = async (assetId) => {
  const finding = await Finding.exists({
    asset: assetId,
    status: {
      $in: ACTIVE_FINDING_STATUSES,
    },
  });

  if (finding) {
    throw new ApiError(
      409,
      "Resolve or close active findings before decommissioning this asset.",
    );
  }
};

// Calcula el siguiente código numérico del inventario.
const generateAssetCode = async () => {
  const result = await Asset.aggregate([
    {
      $match: {
        assetCode: /^AST-\d+$/,
      },
    },
    {
      $group: {
        _id: null,

        maxNumber: {
          $max: {
            $convert: {
              input: {
                $arrayElemAt: [{ $split: ["$assetCode", "-"] }, 1],
              },
              to: "int",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
    },
  ]);

  const lastNumber = result[0]?.maxNumber ?? 0;

  return `AST-${String(lastNumber + 1).padStart(3, "0")}`;
};

// Convierte un activo en la representación pública de la API.
const toPublicAsset = (asset) => ({
  id: asset._id.toString(),
  assetCode: asset.assetCode,
  name: asset.name,
  type: asset.type,
  hostname: asset.hostname || null,
  ipAddress: asset.ipAddress || null,
  operatingSystem: asset.operatingSystem || null,
  environment: asset.environment,
  criticality: asset.criticality,
  department: asset.department,
  status: asset.status,
  description: asset.description,
  image: asset.image?.url || null,

  createdBy: asset.createdBy
    ? {
        id: asset.createdBy._id.toString(),
        userCode: asset.createdBy.userCode,
        name: asset.createdBy.name,
      }
    : null,

  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
});

// Construye los filtros a partir de los parámetros validados.
const buildAssetFilters = ({
  search,
  type,
  environment,
  criticality,
  status,
}) => {
  const filters = {};

  if (type) {
    filters.type = type;
  }

  if (environment) {
    filters.environment = environment;
  }

  if (criticality) {
    filters.criticality = criticality;
  }

  if (status) {
    filters.status = status;
  }

  // Busca coincidencias parciales en los campos del inventario.
  if (search) {
    const safeSearch = escapeRegex(search);
    const regex = new RegExp(safeSearch, "i");

    filters.$or = [
      { assetCode: regex },
      { name: regex },
      { hostname: regex },
      { ipAddress: regex },
      { department: regex },
    ];
  }

  return filters;
};

// Obtiene el inventario con filtros, ordenación y paginación.
const getAssets = async ({
  page,
  limit,
  search,
  type,
  environment,
  criticality,
  status,
  sortBy,
  order,
}) => {
  const filters = buildAssetFilters({
    search,
    type,
    environment,
    criticality,
    status,
  });

  const skip = (page - 1) * limit;
  const direction = order === "desc" ? -1 : 1;

  // Mantiene un orden estable cuando varios activos coinciden.
  const sort =
    sortBy === "assetCode"
      ? { assetCode: direction }
      : {
          [sortBy]: direction,
          assetCode: 1,
        };

  const [assets, total] = await Promise.all([
    Asset.find(filters)
      .populate("createdBy", "userCode name")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),

    Asset.countDocuments(filters),
  ]);

  return {
    assets: assets.map(toPublicAsset),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Recupera un activo concreto mediante su ObjectId.
const getAssetById = async (id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id) || !mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid asset ID.");
  }

  const asset = await Asset.findById(id)
    .populate("createdBy", "userCode name")
    .lean();

  if (!asset) {
    throw new ApiError(404, "Asset not found.");
  }

  return toPublicAsset(asset);
};

// Crea un activo relacionado con el usuario autenticado.
const createAsset = async (data, currentUser) => {
  // Evita almacenar cadenas vacías en campos opcionales.
  const normalizedData = {
    ...data,
    hostname: data.hostname || undefined,
    ipAddress: data.ipAddress || undefined,
    operatingSystem: data.operatingSystem || undefined,
    description: data.description || "",
  };

  // Reintenta si dos altas simultáneas generan el mismo código.
  for (let attempt = 0; attempt < 3; attempt++) {
    const assetCode = await generateAssetCode();

    try {
      const asset = await Asset.create({
        ...normalizedData,
        assetCode,
        createdBy: currentUser._id,
        status: ASSET_STATUSES.ACTIVE,
      });

      return getAssetById(asset._id.toString());
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.assetCode) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(409, "Unable to allocate an asset code. Please retry.");
};

// Actualiza prioridades y vencimientos tras cambiar la criticidad.
const recalculateActiveFindings = async (
  asset,
  previousCriticality,
  performedBy,
  session,
) => {
  const findings = await Finding.find({
    asset: asset._id,
    status: {
      $in: ACTIVE_FINDING_STATUSES,
    },
  })
    .populate("vulnerability", "severity")
    .session(session);

  for (const finding of findings) {
    if (!finding.vulnerability) {
      throw new ApiError(
        409,
        "A finding has an invalid vulnerability reference.",
      );
    }

    const previousPriority = finding.priority;

    const nextPriority = calculatePriority(
      finding.vulnerability.severity,
      asset.criticality,
    );

    // Evita escrituras innecesarias si la prioridad no cambia.
    if (previousPriority === nextPriority) {
      continue;
    }

    finding.priority = nextPriority;

    finding.dueDate = calculateDueDate(nextPriority, finding.detectedAt);

    // Conserva una explicación del cambio automático.
    finding.history.push({
      action: "NOTE_ADDED",
      performedBy,
      note:
        `Asset criticality changed from ${previousCriticality} ` +
        `to ${asset.criticality}. ` +
        `Priority recalculated from ${previousPriority} ` +
        `to ${nextPriority}.`,
      date: new Date(),
    });

    await finding.save({ session });
  }
};

// Actualiza los datos permitidos de un activo.
const updateAsset = async (id, data, currentUser) => {
  const asset = await findAssetOrFail(id);

  // Los activos retirados quedan como registros históricos.
  if (asset.status === ASSET_STATUSES.DECOMMISSIONED) {
    throw new ApiError(409, "Decommissioned assets cannot be edited.");
  }

  const criticalityChanged =
    data.criticality !== undefined && data.criticality !== asset.criticality;

  // Solo ADMIN puede modificar la criticidad de negocio.
  if (criticalityChanged && currentUser.role !== USER_ROLES.ADMIN) {
    throw new ApiError(
      403,
      "Only administrators can change asset criticality.",
    );
  }

  // Normaliza campos opcionales enviados vacíos.
  const normalizedData = {
    ...data,
  };

  for (const field of ["hostname", "ipAddress", "operatingSystem"]) {
    if (normalizedData[field] === "") {
      normalizedData[field] = undefined;
    }
  }

  // Una edición ordinaria no requiere modificar otras colecciones.
  if (!criticalityChanged) {
    asset.set(normalizedData);

    await asset.save();

    return getAssetById(id);
  }

  // La criticidad y los Findings se actualizan conjuntamente.
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const currentAsset = await findAssetOrFail(id, session);

      if (currentAsset.status === ASSET_STATUSES.DECOMMISSIONED) {
        throw new ApiError(409, "Decommissioned assets cannot be edited.");
      }

      const previousCriticality = currentAsset.criticality;

      currentAsset.set(normalizedData);

      await currentAsset.save({ session });

      if (previousCriticality !== currentAsset.criticality) {
        await recalculateActiveFindings(
          currentAsset,
          previousCriticality,
          currentUser._id,
          session,
        );
      }
    });

    return getAssetById(id);
  } finally {
    await session.endSession();
  }
};

// Modifica el estado de un activo respetando su ciclo de vida.
const updateAssetStatus = async (id, { status }) => {
  const asset = await findAssetOrFail(id);

  // Repetir el mismo estado no provoca modificaciones.
  if (asset.status === status) {
    return getAssetById(id);
  }

  // La retirada definitiva no admite reactivación.
  if (asset.status === ASSET_STATUSES.DECOMMISSIONED) {
    throw new ApiError(409, "Decommissioned assets cannot be reactivated.");
  }

  // Retirar un activo exige cerrar antes su trabajo pendiente.
  if (status === ASSET_STATUSES.DECOMMISSIONED) {
    await ensureNoActiveFindings(asset._id);
  }

  asset.status = status;

  await asset.save();

  return getAssetById(id);
};

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  updateAssetStatus,
};
