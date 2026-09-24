const Finding = require("../findings/finding.model");
const Asset = require("../assets/asset.model");
const Vulnerability = require("../vulnerabilities/vulnerability.model");
const User = require("../users/user.model");

const { USER_ROLES } = require("../../constants/roles");

const {
  FINDING_STATUSES,
  FINDING_PRIORITIES,
} = require("../../constants/finding.constants");

const {
  ASSET_STATUSES,
  ASSET_CRITICALITIES,
} = require("../../constants/asset.constants");

const {
  VULNERABILITY_STATUSES,
  VULNERABILITY_SEVERITIES,
} = require("../../constants/vulnerability.constants");

// Estados que representan trabajo todavía pendiente.
const ACTIVE_STATUSES = [
  FINDING_STATUSES.OPEN,
  FINDING_STATUSES.IN_PROGRESS,
  FINDING_STATUSES.MITIGATED,
];

// Estados que representan un cierre.
const CLOSED_STATUSES = [
  FINDING_STATUSES.RESOLVED,
  FINDING_STATUSES.ACCEPTED_RISK,
  FINDING_STATUSES.FALSE_POSITIVE,
];

// Orden de representación de indicadores.
const PRIORITY_ORDER = [
  FINDING_PRIORITIES.P1,
  FINDING_PRIORITIES.P2,
  FINDING_PRIORITIES.P3,
  FINDING_PRIORITIES.P4,
];

const SEVERITY_ORDER = [
  VULNERABILITY_SEVERITIES.CRITICAL,
  VULNERABILITY_SEVERITIES.HIGH,
  VULNERABILITY_SEVERITIES.MEDIUM,
  VULNERABILITY_SEVERITIES.LOW,
];

// Convierte agregaciones {_id, count} en objetos de búsqueda.
const countsToMap = (rows) => new Map(rows.map((row) => [row._id, row.count]));

// Incluye valores con cero aunque no existan documentos.
const completeDistribution = (values, rows, field) => {
  const counts = countsToMap(rows);

  return values.map((value) => ({
    [field]: value,
    count: counts.get(value) ?? 0,
  }));
};

// Redondea indicadores numéricos.
const roundTo = (number, decimals = 1) => {
  const factor = 10 ** decimals;

  return Math.round(number * factor) / factor;
};

// Devuelve el inicio del primer mes incluido en la tendencia.
const getTrendStartDate = (now) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

// Genera los 12 meses, incluidos aquellos sin actividad.
const buildMonthlyTrend = (detectedRows, closedRows, now) => {
  const detectedMap = countsToMap(detectedRows);
  const closedMap = countsToMap(closedRows);

  const months = [];

  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );

    const month = date.toISOString().slice(0, 7);

    months.push({
      month,
      detected: detectedMap.get(month) ?? 0,
      closed: closedMap.get(month) ?? 0,
    });
  }

  return months;
};

// Calcula las estadísticas generales mediante MongoDB Aggregation.
const aggregateFindingStatistics = async (now, trendStart) => {
  const [result] = await Finding.aggregate([
    {
      $facet: {
        // Distribución global de Findings por estado.
        statuses: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],

        // Prioridades de los Findings todavía pendientes.
        activePriorities: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
            },
          },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
            },
          },
        ],

        // Severidad de las vulnerabilidades presentes en Findings activos.
        activeSeverities: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
            },
          },
          {
            $lookup: {
              from: Vulnerability.collection.name,
              localField: "vulnerability",
              foreignField: "_id",
              as: "vulnerabilityData",
            },
          },
          {
            $unwind: "$vulnerabilityData",
          },
          {
            $group: {
              _id: "$vulnerabilityData.severity",
              count: { $sum: 1 },
            },
          },
        ],

        // Findings que han superado su fecha límite.
        overdue: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
              dueDate: { $lt: now },
            },
          },
          {
            $count: "count",
          },
        ],

        // Trabajo pendiente sin responsable.
        unassigned: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
              assignedTo: null,
            },
          },
          {
            $count: "count",
          },
        ],

        // Número de activos con al menos un Finding pendiente.
        affectedAssets: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
              asset: { $ne: null },
            },
          },
          {
            $group: {
              _id: "$asset",
            },
          },
          {
            $count: "count",
          },
        ],

        // Detecciones registradas en los últimos 12 meses.
        monthlyDetected: [
          {
            $match: {
              detectedAt: {
                $gte: trendStart,
                $lte: now,
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$detectedAt",
                  timezone: "UTC",
                },
              },
              count: { $sum: 1 },
            },
          },
        ],

        // Cierres registrados en los últimos 12 meses.
        monthlyClosed: [
          {
            $match: {
              status: { $in: CLOSED_STATUSES },
              closedAt: {
                $gte: trendStart,
                $lte: now,
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$closedAt",
                  timezone: "UTC",
                },
              },
              count: { $sum: 1 },
            },
          },
        ],

        // Promedio de días entre detección y resolución.
        resolutionTime: [
          {
            $match: {
              status: FINDING_STATUSES.RESOLVED,
              closedAt: { $type: "date" },
              detectedAt: { $type: "date" },
            },
          },
          {
            $match: {
              $expr: {
                $gte: ["$closedAt", "$detectedAt"],
              },
            },
          },
          {
            $group: {
              _id: null,
              averageDays: {
                $avg: {
                  $divide: [
                    {
                      $subtract: ["$closedAt", "$detectedAt"],
                    },
                    86400000,
                  ],
                },
              },
            },
          },
        ],

        // Activos con más Findings todavía pendientes.
        topAffectedAssets: [
          {
            $match: {
              status: { $in: ACTIVE_STATUSES },
            },
          },
          {
            $group: {
              _id: "$asset",
              activeFindings: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: Asset.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "assetData",
            },
          },
          {
            $unwind: "$assetData",
          },
          {
            $sort: {
              activeFindings: -1,
              "assetData.assetCode": 1,
            },
          },
          {
            $limit: 5,
          },
          {
            $project: {
              _id: 0,
              id: "$assetData._id",
              assetCode: "$assetData.assetCode",
              name: "$assetData.name",
              criticality: "$assetData.criticality",
              activeFindings: 1,
            },
          },
        ],
      },
    },
  ]);

  return result;
};

// Calcula estadísticas del inventario tecnológico.
const aggregateAssetStatistics = async () => {
  const [result] = await Asset.aggregate([
    {
      $facet: {
        statuses: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],

        activeCritical: [
          {
            $match: {
              status: ASSET_STATUSES.ACTIVE,
              criticality: ASSET_CRITICALITIES.CRITICAL,
            },
          },
          {
            $count: "count",
          },
        ],
      },
    },
  ]);

  return result;
};

// Calcula estadísticas del catálogo de vulnerabilidades.
const aggregateVulnerabilityStatistics = async () => {
  const [result] = await Vulnerability.aggregate([
    {
      $facet: {
        statuses: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],

        // Solo el catálogo activo participa en este gráfico.
        activeSeverities: [
          {
            $match: {
              status: VULNERABILITY_STATUSES.ACTIVE,
            },
          },
          {
            $group: {
              _id: "$severity",
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  return result;
};

// Calcula la distribución de Findings activos por responsable.
const aggregateAnalystWorkload = async () => {
  const rows = await Finding.aggregate([
    {
      $match: {
        status: { $in: ACTIVE_STATUSES },
      },
    },
    {
      $group: {
        _id: "$assignedTo",
        activeFindings: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "userData",
      },
    },
    {
      $unwind: {
        path: "$userData",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: "$_id",
        userCode: "$userData.userCode",
        name: "$userData.name",
        role: "$userData.role",
        isActive: "$userData.isActive",
        activeFindings: 1,
      },
    },
    {
      $sort: {
        activeFindings: -1,
        userCode: 1,
      },
    },
  ]);

  return rows.map((row) => ({
    id: row.id ? String(row.id) : null,
    userCode: row.userCode ?? null,
    name: row.name ?? "Unassigned",
    role: row.role ?? null,
    isActive: row.isActive ?? null,
    activeFindings: row.activeFindings,
  }));
};

// Recupera los últimos hallazgos con sus relaciones principales.
const getRecentFindings = async (now) => {
  const findings = await Finding.find({
    detectedAt: { $lte: now },
  })
    .select(
      "findingCode asset vulnerability assignedTo status priority detectedAt dueDate",
    )
    .populate("asset", "assetCode name")
    .populate("vulnerability", "vulnerabilityCode title severity")
    .populate("assignedTo", "userCode name")
    .sort({
      detectedAt: -1,
      _id: -1,
    })
    .limit(8)
    .lean();

  return findings.map((finding) => ({
    id: String(finding._id),

    findingCode: finding.findingCode,

    asset: finding.asset
      ? {
          id: String(finding.asset._id),
          assetCode: finding.asset.assetCode,
          name: finding.asset.name,
        }
      : null,

    vulnerability: finding.vulnerability
      ? {
          id: String(finding.vulnerability._id),
          vulnerabilityCode: finding.vulnerability.vulnerabilityCode,
          title: finding.vulnerability.title,
          severity: finding.vulnerability.severity,
        }
      : null,

    assignedTo: finding.assignedTo
      ? {
          id: String(finding.assignedTo._id),
          userCode: finding.assignedTo.userCode,
          name: finding.assignedTo.name,
        }
      : null,

    status: finding.status,
    priority: finding.priority,
    detectedAt: finding.detectedAt,
    dueDate: finding.dueDate,

    overdue: ACTIVE_STATUSES.includes(finding.status) && finding.dueDate < now,
  }));
};

// Construye la respuesta completa del Dashboard.
const getDashboardOverview = async (currentUser) => {
  const now = new Date();

  const trendStart = getTrendStartDate(now);

  const [
    findingStats,
    assetStats,
    vulnerabilityStats,
    recentFindings,
    analystWorkload,
  ] = await Promise.all([
    aggregateFindingStatistics(now, trendStart),

    aggregateAssetStatistics(),

    aggregateVulnerabilityStatistics(),

    getRecentFindings(now),

    // La carga de trabajo individual es exclusiva de ADMIN.
    currentUser.role === USER_ROLES.ADMIN
      ? aggregateAnalystWorkload()
      : Promise.resolve([]),
  ]);

  const findingCounts = countsToMap(findingStats.statuses);

  const assetCounts = countsToMap(assetStats.statuses);

  const vulnerabilityCounts = countsToMap(vulnerabilityStats.statuses);

  const totalFindings = Array.from(findingCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  const activeFindings = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + (findingCounts.get(status) ?? 0),
    0,
  );

  const closedFindings = CLOSED_STATUSES.reduce(
    (sum, status) => sum + (findingCounts.get(status) ?? 0),
    0,
  );

  const totalAssets = Array.from(assetCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  const totalVulnerabilities = Array.from(vulnerabilityCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  const averageDays = findingStats.resolutionTime[0]?.averageDays ?? null;

  return {
    generatedAt: now,

    // Indicadores para las tarjetas principales.
    summary: {
      totalFindings,

      activeFindings,

      closedFindings,

      resolvedFindings: findingCounts.get(FINDING_STATUSES.RESOLVED) ?? 0,

      overdueFindings: findingStats.overdue[0]?.count ?? 0,

      unassignedFindings: findingStats.unassigned[0]?.count ?? 0,

      totalAssets,

      activeAssets: assetCounts.get(ASSET_STATUSES.ACTIVE) ?? 0,

      criticalActiveAssets: assetStats.activeCritical[0]?.count ?? 0,

      affectedAssets: findingStats.affectedAssets[0]?.count ?? 0,

      totalVulnerabilities,

      activeVulnerabilities:
        vulnerabilityCounts.get(VULNERABILITY_STATUSES.ACTIVE) ?? 0,

      averageResolutionDays:
        averageDays === null ? null : roundTo(averageDays, 1),
    },

    // Distribución global por estado.
    findingsByStatus: completeDistribution(
      Object.values(FINDING_STATUSES),
      findingStats.statuses,
      "status",
    ),

    // Distribución de riesgo del trabajo pendiente.
    activeFindingsByPriority: completeDistribution(
      PRIORITY_ORDER,
      findingStats.activePriorities,
      "priority",
    ),

    activeFindingsBySeverity: completeDistribution(
      SEVERITY_ORDER,
      findingStats.activeSeverities,
      "severity",
    ),

    // Distribución del catálogo de vulnerabilidades activas.
    vulnerabilitiesBySeverity: completeDistribution(
      SEVERITY_ORDER,
      vulnerabilityStats.activeSeverities,
      "severity",
    ),

    // Serie temporal preparada para Recharts.
    monthlyTrend: buildMonthlyTrend(
      findingStats.monthlyDetected,
      findingStats.monthlyClosed,
      now,
    ),

    // Activos con mayor número de hallazgos pendientes.
    topAffectedAssets: findingStats.topAffectedAssets.map((asset) => ({
      ...asset,
      id: String(asset.id),
    })),

    // Información operativa y actividad reciente.
    recentFindings,

    analystWorkload,
  };
};

module.exports = {
  getDashboardOverview,
};
