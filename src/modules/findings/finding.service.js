const mongoose = require("mongoose");

const { randomUUID } = require("node:crypto");

const path = require("node:path");

const { mkdir, writeFile, readFile, unlink } = require("node:fs/promises");

const Finding = require("./finding.model");

const Asset = require("../assets/asset.model");

const Vulnerability = require("../vulnerabilities/vulnerability.model");

const User = require("../users/user.model");

const ApiError = require("../../utils/ApiError");

const { USER_ROLES } = require("../../constants/roles");

const {
  uploadPrivateEvidence,
  downloadPrivateEvidence,
  deletePrivateEvidence,
} = require("../../services/evidenceCloudinary");

const {
  FINDING_STATUSES,
  FINDING_HISTORY_ACTIONS: HISTORY_ACTIONS,
} = require("../../constants/finding.constants");

const { ASSET_STATUSES } = require("../../constants/asset.constants");

const {
  VULNERABILITY_STATUSES,
} = require("../../constants/vulnerability.constants");

const {
  EVIDENCE_DIR,
  MAX_EVIDENCE_COUNT,
} = require("../../config/evidenceStorage");

const priorityModule = require("../../utils/calculatePriority");

const dueDateModule = require("../../utils/calculateDueDate");

// Reutilizamos las funciones ya utilizadas por el seed.
const calculatePriority = priorityModule.calculatePriority ?? priorityModule;

const calculateDueDate = dueDateModule.calculateDueDate ?? dueDateModule;

// Estados todavía pendientes de cierre.
const OPEN_STATUSES = [
  FINDING_STATUSES.OPEN,
  FINDING_STATUSES.IN_PROGRESS,
  FINDING_STATUSES.MITIGATED,
];

// Estados considerados cerrados.
const CLOSED_STATUSES = [
  FINDING_STATUSES.RESOLVED,
  FINDING_STATUSES.ACCEPTED_RISK,
  FINDING_STATUSES.FALSE_POSITIVE,
];

// Transiciones permitidas en VulnTrack.
const TRANSITIONS = {
  [FINDING_STATUSES.OPEN]: [
    FINDING_STATUSES.IN_PROGRESS,
    FINDING_STATUSES.ACCEPTED_RISK,
    FINDING_STATUSES.FALSE_POSITIVE,
  ],

  [FINDING_STATUSES.IN_PROGRESS]: [
    FINDING_STATUSES.OPEN,
    FINDING_STATUSES.MITIGATED,
  ],

  [FINDING_STATUSES.MITIGATED]: [
    FINDING_STATUSES.IN_PROGRESS,
    FINDING_STATUSES.RESOLVED,
  ],

  [FINDING_STATUSES.RESOLVED]: [FINDING_STATUSES.OPEN],

  [FINDING_STATUSES.ACCEPTED_RISK]: [],

  [FINDING_STATUSES.FALSE_POSITIVE]: [],
};

// Escapa caracteres especiales en búsquedas RegExp.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Comprueba identificadores de MongoDB.
const isValidId = (value) =>
  typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);

// Compara ObjectIds de forma segura.
const sameId = (a, b) => Boolean(a && b && String(a) === String(b));

const isAdmin = (user) => user.role === USER_ROLES.ADMIN;

const isAssignedAnalyst = (finding, user) =>
  user.role === USER_ROLES.ANALYST && sameId(finding.assignedTo, user._id);

// Devuelve errores controlados para IDs incorrectos.
const assertId = (id, label = "finding") => {
  if (!isValidId(id)) {
    throw new ApiError(400, `Invalid ${label} ID.`);
  }
};

// ADMIN o ANALYST asignado pueden gestionar el trabajo.
const assertCanWork = (finding, user, { allowClosedAdmin = false } = {}) => {
  if (isAdmin(user)) {
    if (!allowClosedAdmin && CLOSED_STATUSES.includes(finding.status)) {
      throw new ApiError(
        409,
        "Closed findings cannot be modified in this way.",
      );
    }

    return;
  }

  if (!isAssignedAnalyst(finding, user)) {
    throw new ApiError(
      403,
      "Only the administrator or assigned analyst can manage this finding.",
    );
  }

  if (CLOSED_STATUSES.includes(finding.status)) {
    throw new ApiError(409, "Closed findings cannot be modified in this way.");
  }
};

// Devuelve únicamente información pública de usuarios.
const publicPerson = (person) =>
  person && typeof person === "object" && person._id
    ? {
        id: String(person._id),
        userCode: person.userCode,
        name: person.name,
        role: person.role,
      }
    : null;

// Prepara los datos que recibirá React.
const toPublicFinding = (finding) => ({
  id: String(finding._id),

  findingCode: finding.findingCode,

  asset:
    finding.asset && typeof finding.asset === "object" && finding.asset._id
      ? {
          id: String(finding.asset._id),
          assetCode: finding.asset.assetCode,
          name: finding.asset.name,
          criticality: finding.asset.criticality,
          status: finding.asset.status,
        }
      : null,

  vulnerability:
    finding.vulnerability &&
    typeof finding.vulnerability === "object" &&
    finding.vulnerability._id
      ? {
          id: String(finding.vulnerability._id),
          vulnerabilityCode: finding.vulnerability.vulnerabilityCode,
          title: finding.vulnerability.title,
          severity: finding.vulnerability.severity,
          cvssScore: finding.vulnerability.cvssScore,
          status: finding.vulnerability.status,
        }
      : null,

  assignedTo: publicPerson(finding.assignedTo),

  createdBy: publicPerson(finding.createdBy),

  status: finding.status,

  priority: finding.priority,

  detectedAt: finding.detectedAt,

  dueDate: finding.dueDate,

  // overdue se calcula; no se almacena en MongoDB.
  overdue:
    OPEN_STATUSES.includes(finding.status) &&
    new Date(finding.dueDate) < new Date(),

  closedAt: finding.closedAt ?? null,

  closureNote: finding.closureNote || "",

  evidence: (finding.evidence || []).map((item) => ({
    id: String(item._id),
    url: item.url,
    originalName: item.originalName,
    mimeType: item.mimeType,
    size: item.size,
    uploadedBy: publicPerson(item.uploadedBy),
    uploadedAt: item.uploadedAt,
  })),

  history: (finding.history || []).map((item) => ({
    id: String(item._id),
    action: item.action,
    fromStatus: item.fromStatus ?? null,
    toStatus: item.toStatus ?? null,
    performedBy: publicPerson(item.performedBy),
    note: item.note || "",
    date: item.date,
  })),

  createdAt: finding.createdAt,

  updatedAt: finding.updatedAt,
});

// Enriquece los ObjectIds con información relacionada.
const withRelations = (query) =>
  query
    .populate("asset", "assetCode name criticality status")
    .populate(
      "vulnerability",
      "vulnerabilityCode title severity cvssScore status",
    )
    .populate("assignedTo", "userCode name role")
    .populate("createdBy", "userCode name role")
    .populate("evidence.uploadedBy", "userCode name role")
    .populate("history.performedBy", "userCode name role");

// Recupera un Finding para operaciones internas.
const readFinding = async (id) => {
  assertId(id);

  const finding = await Finding.findById(id);

  if (!finding) {
    throw new ApiError(404, "Finding not found.");
  }

  return finding;
};

// Consulta el detalle completo.
const getFindingById = async (id) => {
  assertId(id);

  const finding = await withRelations(Finding.findById(id)).lean();

  if (!finding) {
    throw new ApiError(404, "Finding not found.");
  }

  return toPublicFinding(finding);
};

// Consulta Findings con filtros, búsqueda y paginación.
const getFindings = async ({
  page,
  limit,
  search,
  status,
  priority,
  assetId,
  vulnerabilityId,
  assignedTo,
  overdue,
  sortBy,
  order,
}) => {
  const conditions = [];

  const filters = {};

  if (status) {
    filters.status = status;
  }

  if (priority) {
    filters.priority = priority;
  }

  if (assetId) {
    filters.asset = assetId;
  }

  if (vulnerabilityId) {
    filters.vulnerability = vulnerabilityId;
  }

  if (assignedTo) {
    filters.assignedTo = assignedTo === "unassigned" ? null : assignedTo;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");

    // Busca también por códigos y nombres relacionados.
    const [assetIds, vulnerabilityIds] = await Promise.all([
      Asset.find({
        $or: [{ assetCode: regex }, { name: regex }, { hostname: regex }],
      }).distinct("_id"),

      Vulnerability.find({
        $or: [{ vulnerabilityCode: regex }, { cveId: regex }, { title: regex }],
      }).distinct("_id"),
    ]);

    conditions.push({
      $or: [
        { findingCode: regex },

        { closureNote: regex },

        {
          asset: {
            $in: assetIds,
          },
        },

        {
          vulnerability: {
            $in: vulnerabilityIds,
          },
        },
      ],
    });
  }

  // Solo Findings pendientes cuyo SLA ya venció.
  if (overdue === "true") {
    conditions.push({
      status: {
        $in: OPEN_STATUSES,
      },

      dueDate: {
        $lt: new Date(),
      },
    });
  } else if (overdue === "false") {
    conditions.push({
      $or: [
        {
          status: {
            $in: CLOSED_STATUSES,
          },
        },

        {
          dueDate: {
            $gte: new Date(),
          },
        },
      ],
    });
  }

  if (conditions.length) {
    filters.$and = conditions;
  }

  const direction = order === "desc" ? -1 : 1;

  const sort =
    sortBy === "findingCode"
      ? {
          findingCode: direction,
        }
      : {
          [sortBy]: direction,
          findingCode: 1,
        };

  const [findings, total] = await Promise.all([
    withRelations(
      Finding.find(filters)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),

    Finding.countDocuments(filters),
  ]);

  return {
    findings: findings.map(toPublicFinding),

    pagination: {
      page,
      limit,
      total,

      totalPages: Math.ceil(total / limit),
    },
  };
};

// Genera FND-301, FND-302, etc.
const generateFindingCode = async () => {
  const result = await Finding.aggregate([
    {
      $match: {
        findingCode: /^FND-\d+$/,
      },
    },

    {
      $group: {
        _id: null,

        maxNumber: {
          $max: {
            $convert: {
              input: {
                $arrayElemAt: [
                  {
                    $split: ["$findingCode", "-"],
                  },
                  1,
                ],
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

  const nextNumber = (result[0]?.maxNumber ?? 0) + 1;

  return `FND-${String(nextNumber).padStart(3, "0")}`;
};

// Comprueba que el responsable existe y puede trabajar.
const findAssignee = async (id) => {
  assertId(id, "user");

  const user = await User.findById(id).select("role isActive");

  if (
    !user ||
    !user.isActive ||
    ![USER_ROLES.ADMIN, USER_ROLES.ANALYST].includes(user.role)
  ) {
    throw new ApiError(400, "Assignee must be an active ADMIN or ANALYST.");
  }

  return user;
};

// Crea un hallazgo sobre un activo y vulnerabilidad existentes.
const createFinding = async (
  { assetId, vulnerabilityId, assignedToId },
  currentUser,
) => {
  const [asset, vulnerability] = await Promise.all([
    Asset.findById(assetId),

    Vulnerability.findById(vulnerabilityId),
  ]);

  if (!asset) {
    throw new ApiError(404, "Asset not found.");
  }

  if (!vulnerability) {
    throw new ApiError(404, "Vulnerability not found.");
  }

  // No registramos nuevos Findings sobre activos inactivos.
  if (asset.status !== ASSET_STATUSES.ACTIVE) {
    throw new ApiError(409, "Only active assets admit new findings.");
  }

  if (vulnerability.status !== VULNERABILITY_STATUSES.ACTIVE) {
    throw new ApiError(
      409,
      "Archived vulnerabilities cannot be used for new findings.",
    );
  }

  let assignedTo = null;

  if (assignedToId) {
    // ANALYST solo puede asignarse a sí mismo.
    if (!isAdmin(currentUser) && !sameId(assignedToId, currentUser._id)) {
      throw new ApiError(
        403,
        "Analysts may assign new findings only to themselves.",
      );
    }

    const assignee = await findAssignee(assignedToId);

    assignedTo = assignee._id;
  }

  // Evita dos Findings pendientes para la misma pareja.
  const existing = await Finding.exists({
    asset: asset._id,

    vulnerability: vulnerability._id,

    status: {
      $in: OPEN_STATUSES,
    },
  });

  if (existing) {
    throw new ApiError(
      409,
      "An active finding already exists for this asset and vulnerability.",
    );
  }

  const detectedAt = new Date();

  if (vulnerability.publishedAt && vulnerability.publishedAt > detectedAt) {
    throw new ApiError(
      409,
      "Vulnerability publication date is after detection.",
    );
  }

  // Prioridad calculada desde riesgo + criticidad.
  const priority = calculatePriority(vulnerability.severity, asset.criticality);

  const history = [
    {
      action: HISTORY_ACTIONS.CREATED,

      performedBy: currentUser._id,

      date: detectedAt,

      note: "Finding created through the API.",
    },
  ];

  if (assignedTo) {
    history.push({
      action: HISTORY_ACTIONS.ASSIGNED,

      performedBy: currentUser._id,

      date: detectedAt,

      note: "Initial assignment.",
    });
  }

  // Reintenta si dos peticiones generan el mismo código.
  for (let attempt = 0; attempt < 3; attempt++) {
    const findingCode = await generateFindingCode();

    try {
      const finding = await Finding.create({
        findingCode,

        asset: asset._id,

        vulnerability: vulnerability._id,

        assignedTo,

        createdBy: currentUser._id,

        status: FINDING_STATUSES.OPEN,

        priority,

        detectedAt,

        dueDate: calculateDueDate(priority, detectedAt),

        closedAt: null,

        closureNote: "",

        evidence: [],

        history,
      });

      return getFindingById(String(finding._id));
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.findingCode) {
        continue;
      }

      if (
        error.code === 11000 &&
        error.keyPattern?.asset &&
        error.keyPattern?.vulnerability
      ) {
        throw new ApiError(
          409,
          "An active finding already exists for this asset and vulnerability.",
        );
      }

      throw error;
    }
  }

  throw new ApiError(
    409,
    "Unable to allocate a finding code. Retry the operation.",
  );
};

// Asigna o desasigna un hallazgo según rol y estado.
const updateFindingAssignment = async (id, { assignedToId }, currentUser) => {
  const finding = await readFinding(id);

  if (CLOSED_STATUSES.includes(finding.status)) {
    throw new ApiError(409, "Closed findings cannot be reassigned.");
  }

  const currentAssignee = finding.assignedTo ?? null;

  // Solo ADMIN o ANALYST autorizado pueden modificar.
  if (!isAdmin(currentUser)) {
    if (
      finding.status !== FINDING_STATUSES.OPEN ||
      currentAssignee ||
      !sameId(assignedToId, currentUser._id)
    ) {
      throw new ApiError(
        403,
        "Analysts may only self-assign unassigned OPEN findings.",
      );
    }
  }

  if (
    sameId(currentAssignee, assignedToId) ||
    (!currentAssignee && assignedToId === null)
  ) {
    return getFindingById(id);
  }

  // Un Finding avanzado no puede quedarse sin responsable.
  if (assignedToId === null && finding.status !== FINDING_STATUSES.OPEN) {
    throw new ApiError(409, "Only OPEN findings may be unassigned.");
  }

  const assignee = assignedToId ? await findAssignee(assignedToId) : null;

  const history = {
    action: assignee ? HISTORY_ACTIONS.ASSIGNED : HISTORY_ACTIONS.UNASSIGNED,

    performedBy: currentUser._id,

    date: new Date(),

    note: assignee ? `Assigned to ${assignee._id}.` : "Assignment removed.",
  };

  // Condiciona la escritura al estado observado.
  const updated = await Finding.findOneAndUpdate(
    {
      _id: finding._id,

      status: finding.status,

      assignedTo: currentAssignee,
    },

    {
      $set: {
        assignedTo: assignee?._id ?? null,
      },

      $push: {
        history,
      },
    },

    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "Finding changed during assignment. Retry.");
  }

  return getFindingById(id);
};

// Cambia el estado respetando workflow, rol y asignación.
const updateFindingStatus = async (id, { status, note }, currentUser) => {
  const finding = await readFinding(id);

  // Comprobamos permisos incluso cuando no cambia el estado.
  if (!isAdmin(currentUser) && !isAssignedAnalyst(finding, currentUser)) {
    throw new ApiError(
      403,
      "Only the administrator or assigned analyst may change status.",
    );
  }

  if (finding.status === status) {
    return getFindingById(id);
  }

  if (!TRANSITIONS[finding.status]?.includes(status)) {
    throw new ApiError(
      409,
      `Invalid transition: ${finding.status} -> ${status}.`,
    );
  }

  // Aceptar riesgos y descartar falsos positivos: solo ADMIN.
  if (
    [FINDING_STATUSES.ACCEPTED_RISK, FINDING_STATUSES.FALSE_POSITIVE].includes(
      status,
    ) &&
    !isAdmin(currentUser)
  ) {
    throw new ApiError(
      403,
      "Only administrators may accept risk or mark false positives.",
    );
  }

  // Reabrir un hallazgo resuelto también requiere ADMIN.
  if (finding.status === FINDING_STATUSES.RESOLVED && !isAdmin(currentUser)) {
    throw new ApiError(
      403,
      "Only administrators may reopen resolved findings.",
    );
  }

  if (
    [
      FINDING_STATUSES.IN_PROGRESS,
      FINDING_STATUSES.MITIGATED,
      FINDING_STATUSES.RESOLVED,
    ].includes(status) &&
    !finding.assignedTo
  ) {
    throw new ApiError(
      409,
      "Assign the finding before progressing its workflow.",
    );
  }

  const now = new Date();

  const closes = CLOSED_STATUSES.includes(status);

  const history = {
    action: HISTORY_ACTIONS.STATUS_CHANGED,

    fromStatus: finding.status,

    toStatus: status,

    performedBy: currentUser._id,

    date: now,

    note: note || "",
  };

  const changes = {
    status,

    closedAt: closes ? now : null,

    closureNote: closes ? note : "",
  };

  // Al reabrir, revisamos el estado actual de ambas referencias.
  if (
    finding.status === FINDING_STATUSES.RESOLVED &&
    status === FINDING_STATUSES.OPEN
  ) {
    const [asset, vulnerability] = await Promise.all([
      Asset.findById(finding.asset),

      Vulnerability.findById(finding.vulnerability),
    ]);

    if (
      !asset ||
      asset.status !== ASSET_STATUSES.ACTIVE ||
      !vulnerability ||
      vulnerability.status !== VULNERABILITY_STATUSES.ACTIVE
    ) {
      throw new ApiError(
        409,
        "Cannot reopen a finding with an inactive asset or archived vulnerability.",
      );
    }

    // El nuevo plazo se calcula desde la reapertura.
    const nextPriority = calculatePriority(
      vulnerability.severity,
      asset.criticality,
    );

    changes.priority = nextPriority;

    changes.dueDate = calculateDueDate(nextPriority, now);
  }

  try {
    const updated = await Finding.findOneAndUpdate(
      {
        _id: finding._id,

        status: finding.status,

        assignedTo: finding.assignedTo ?? null,
      },

      {
        $set: changes,

        $push: {
          history,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      throw new ApiError(
        409,
        "Finding changed during the status update. Retry.",
      );
    }
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(
        409,
        "An active finding already exists for this asset and vulnerability.",
      );
    }

    throw error;
  }

  return getFindingById(id);
};

// Registra una actuación sin modificar el estado.
const addFindingNote = async (id, { note }, currentUser) => {
  const finding = await readFinding(id);

  // ADMIN también puede documentar hallazgos cerrados.
  assertCanWork(finding, currentUser, {
    allowClosedAdmin: true,
  });

  const updated = await Finding.findOneAndUpdate(
    {
      _id: finding._id,

      status: finding.status,

      ...(isAdmin(currentUser)
        ? {}
        : {
            assignedTo: currentUser._id,
          }),
    },

    {
      $push: {
        history: {
          action: HISTORY_ACTIONS.NOTE_ADDED,

          performedBy: currentUser._id,

          note,

          date: new Date(),
        },
      },
    },

    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "Finding changed during the note update. Retry.");
  }

  return getFindingById(id);
};

const ALLOWED_FILE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Sube una evidencia privada y registra sus metadatos.
const addEvidence = async (id, file, currentUser) => {
  const finding = await readFinding(id);

  assertCanWork(finding, currentUser);

  if (finding.evidence.length >= MAX_EVIDENCE_COUNT) {
    throw new ApiError(
      409,
      "This finding already has the maximum number of evidence files.",
    );
  }

  // Detecta el contenido real del archivo.
  const { fileTypeFromBuffer } = await import("file-type");

  const detected = await fileTypeFromBuffer(file.buffer);

  const extension = ALLOWED_FILE_TYPES[detected?.mime];

  if (!extension || detected.mime !== file.mimetype) {
    throw new ApiError(
      400,
      "Evidence must be a genuine PNG, JPEG, WEBP or PDF file.",
    );
  }

  // Primero almacenamos el recurso en Cloudinary.
  const uploaded = await uploadPrivateEvidence(file.buffer, extension);

  const evidenceId = new mongoose.Types.ObjectId();

  const now = new Date();

  const evidence = {
    _id: evidenceId,

    // Siempre exponemos la descarga protegida de nuestra API.
    url: `/api/v1/findings/${id}` + `/evidence/${evidenceId}/file`,

    // Identificador remoto; nunca exponemos el API Secret.
    publicId: uploaded.publicId,

    originalName: path.basename(file.originalname).slice(0, 255),

    mimeType: detected.mime,

    size: file.size,

    uploadedBy: currentUser._id,

    uploadedAt: now,
  };

  try {
    const updated = await Finding.findOneAndUpdate(
      {
        _id: finding._id,

        status: {
          $in: OPEN_STATUSES,
        },

        "evidence.9": {
          $exists: false,
        },

        ...(isAdmin(currentUser)
          ? {}
          : {
              assignedTo: currentUser._id,
            }),
      },

      {
        $push: {
          evidence,

          history: {
            action: HISTORY_ACTIONS.EVIDENCE_ADDED,

            performedBy: currentUser._id,

            date: now,

            note: `Added evidence: ${evidence.originalName}.`,
          },
        },
      },

      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updated) {
      throw new ApiError(
        409,
        "Finding changed or evidence limit reached. Retry.",
      );
    }

    return getFindingById(id);
  } catch (error) {
    // Evita dejar recursos remotos si falla MongoDB.
    await deletePrivateEvidence(uploaded.publicId).catch((cleanupError) => {
      console.error("Cloudinary cleanup failed:", cleanupError);
    });

    throw error;
  }
};

// Recupera evidencias locales o privadas de Cloudinary.
const readEvidence = async (id, evidenceId, currentUser) => {
  assertId(evidenceId, "evidence");

  const finding = await readFinding(id);

  if (!isAdmin(currentUser) && !isAssignedAnalyst(finding, currentUser)) {
    throw new ApiError(403, "You cannot download this evidence.");
  }

  const evidence = finding.evidence.id(evidenceId);

  if (!evidence) {
    throw new ApiError(404, "Evidence not found.");
  }

  const extension = ALLOWED_FILE_TYPES[evidence.mimeType];

  if (!extension) {
    throw new ApiError(500, "Unsupported stored evidence format.");
  }

  // Identifica los archivos antiguos del almacenamiento local.
  const isLocalEvidence = /^[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(
    evidence.publicId,
  );

  let content;

  if (isLocalEvidence) {
    try {
      content = await readFile(path.join(EVIDENCE_DIR, evidence.publicId));
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new ApiError(404, "Evidence file not found.");
      }

      throw error;
    }
  } else {
    // Recupera el recurso autenticado desde Cloudinary.
    content = await downloadPrivateEvidence(evidence.publicId, extension);
  }

  return {
    content,

    mimeType: evidence.mimeType,

    originalName: evidence.originalName,
  };
};

// Elimina una evidencia y conserva el evento en el historial.
const removeEvidence = async (id, evidenceId, currentUser) => {
  assertId(evidenceId, "evidence");

  const finding = await readFinding(id);

  assertCanWork(finding, currentUser);

  const evidence = finding.evidence.id(evidenceId);

  if (!evidence) {
    throw new ApiError(404, "Evidence not found.");
  }

  if (!isAdmin(currentUser) && !sameId(evidence.uploadedBy, currentUser._id)) {
    throw new ApiError(403, "Analysts may remove only their own evidence.");
  }

  const filename = evidence.publicId;

  const updated = await Finding.findOneAndUpdate(
    {
      _id: finding._id,

      status: {
        $in: OPEN_STATUSES,
      },

      "evidence._id": evidence._id,

      ...(isAdmin(currentUser)
        ? {}
        : {
            assignedTo: currentUser._id,
          }),
    },

    {
      $pull: {
        evidence: {
          _id: evidence._id,
        },
      },

      $push: {
        history: {
          action: HISTORY_ACTIONS.EVIDENCE_REMOVED,

          performedBy: currentUser._id,

          date: new Date(),

          note: `Removed evidence: ${evidence.originalName}.`,
        },
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "Evidence changed during removal. Retry.");
  }

  // Compatibilidad con evidencias locales anteriores.
  const isLocalEvidence = /^[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(filename);

  if (isLocalEvidence) {
    await unlink(path.join(EVIDENCE_DIR, filename)).catch((error) => {
      if (error.code !== "ENOENT") {
        console.error("Local evidence cleanup failed:", error);
      }
    });
  } else {
    await deletePrivateEvidence(filename).catch((error) => {
      console.error("Cloudinary evidence cleanup failed:", error);
    });
  }

  return getFindingById(id);
};

module.exports = {
  getFindings,
  getFindingById,
  createFinding,
  updateFindingAssignment,
  updateFindingStatus,
  addFindingNote,
  addEvidence,
  readEvidence,
  removeEvidence,
};
