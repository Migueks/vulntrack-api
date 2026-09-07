// Tipos de activos que puede gestionar VulnTrack.
const ASSET_TYPES = {
  SERVER: "SERVER",
  WORKSTATION: "WORKSTATION",
  NETWORK: "NETWORK",
  WEB_APPLICATION: "WEB_APPLICATION",
  DATABASE: "DATABASE",
  CLOUD: "CLOUD",
  OTHER: "OTHER",
};

// Entornos donde puede encontrarse un activo.
const ASSET_ENVIRONMENTS = {
  PRODUCTION: "PRODUCTION",
  PREPRODUCTION: "PREPRODUCTION",
  DEVELOPMENT: "DEVELOPMENT",
};

// Nivel de importancia del activo para la organización.
const ASSET_CRITICALITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

// Estado del ciclo de vida del activo.
const ASSET_STATUSES = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DECOMMISSIONED: "DECOMMISSIONED",
};

// Arrays reutilizables para los enums de Mongoose y futuras validaciones.
const ASSET_TYPE_VALUES = Object.values(ASSET_TYPES);
const ASSET_ENVIRONMENT_VALUES = Object.values(ASSET_ENVIRONMENTS);
const ASSET_CRITICALITY_VALUES = Object.values(ASSET_CRITICALITIES);
const ASSET_STATUS_VALUES = Object.values(ASSET_STATUSES);

module.exports = {
  ASSET_TYPES,
  ASSET_ENVIRONMENTS,
  ASSET_CRITICALITIES,
  ASSET_STATUSES,
  ASSET_TYPE_VALUES,
  ASSET_ENVIRONMENT_VALUES,
  ASSET_CRITICALITY_VALUES,
  ASSET_STATUS_VALUES,
};
